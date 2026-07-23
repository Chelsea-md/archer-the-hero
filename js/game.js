// ============================================================
// game.js — The orchestrator: state machine (menu → playing →
// gameover), combat resolution, economy, spawning, rendering.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});
  const GEO = RA.GEO;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.fx = new RA.FXPool();
      this.time = 0;

      this.state = 'menu'; // 'menu' | 'playing' | 'gameover' | 'victory'
      this.score = 0;
      this.runSkulls = 0;
      this.lives = 0;
      this.hitStop = 0; // brief world-freeze on meaty hits (game feel)
      this.camAnim = null; // title zoom-out / zoom-in animation
      this.resetRogue();

      this.arrows = [];
      this.apples = [];
      this.corpses = [];
      this.hazards = [];
      this.groundArrows = [];
      this.beams = [];
      this.enemies = [];
      this.platforms = [];
      this.timers = [];
      this.appleTimer = 4;

      this.adArrows = [];   // "one game" unlocks, valid for this run only
      this.runArrows = RA.SAVE.data.selected.slice();
      this.curArrow = 0;
      this.aimP = null;     // active pointer drag {sx, sy, x, y, drag}

      this.W = 1280; this.H = 720;
      this.viewScale = 1; // css px per world unit (set by main.js fit)
      this.stars = [];
      for (let i = 0; i < 90; i++) {
        this.stars.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, a: 0.04 + Math.random() * 0.12 });
      }
      // Background eases toward the current run-phase palette: gradient
      // sky, hill layers, cloud tint, and a wandering sun/moon.
      const p0 = RA.BAL.BG_PHASES[0];
      this.bgCol = {
        skyTop: this.hexRgb(p0.skyTop), skyBottom: this.hexRgb(p0.skyBottom),
        hillFar: this.hexRgb(p0.hillFar), hillNear: this.hexRgb(p0.hillNear),
        cloud: this.hexRgb(p0.cloud), sun: this.hexRgb(p0.sun),
      };
      this.bgNum = { cloudA: p0.cloudA, sunX: p0.sunX, sunY: p0.sunY, sunR: p0.sunR, starA: p0.starA };
      this.bgAccent = p0.accent;
      this._bgPhase = p0;   // last phase, to detect transitions
      this.bgEvent = null;  // active phase-transition cinematic
      this.grassPhase = 0;  // integrated sway phase (no snap on wind changes)
      // Slow procedural clouds that drift across and wrap around.
      this.clouds = [];
      for (let i = 0; i < 7; i++) {
        this.clouds.push({
          x: Math.random() * 1600,
          yf: 0.05 + Math.random() * 0.24,          // fraction of screen height
          s: 0.55 + Math.random() * 0.9,            // scale
          v: 7 + Math.random() * 13,                // px/s drift
          variant: i % 3,                           // sprite shape
        });
      }

      // Convert to world units up front (same formula as main.js fit()) so
      // the first spawn isn't computed in raw CSS pixels.
      const s0 = Math.max(0.42, window.innerHeight / 1200);
      this.resize(window.innerWidth / s0, window.innerHeight / s0);
      this.initWorld();
    }

    // ---------------------------------------------------------------
    resize(w, h) {
      this.W = w; this.H = h;
      this.towerTop = h * 0.66;
      // Center the battle: the tower sits so the tower→farthest-spawn span
      // (~1100 units, see spawnDistBand) straddles the screen center — wide
      // monitors get symmetric margins instead of a right-side void.
      this.towerX = GEO.clamp((w - 1100) / 2, 150, w * 0.4);
      this.tower = {
        cx: this.towerX,
        half: 88,
        topY: () => this.towerTop,
      };
      if (this.player) {
        this.player.anchorX = this.towerX;
        this.player.anchorY = this.towerTop;
        this.player.plat = this.tower;
      }
      for (const p of this.platforms) {
        p.cy = GEO.clamp(p.cy, h * 0.34, h * 0.62);
        const occ = this.enemies.find((e) => e.plat === p);
        const band = this.spawnDistBand(p, occ && occ.boss);
        p.cx = Math.min(GEO.clamp(p.cx, this.towerX + band.lo, this.towerX + band.hi), w - 150);
      }
      // Keep enemies standing on their (possibly relocated) platform.
      for (const e of this.enemies) {
        if (e.plat) e.anchorX = GEO.clamp(e.anchorX, e.plat.cx - e.plat.half, e.plat.cx + e.plat.half);
      }
    }

    // Fresh roguelike state (per run): timer, boss schedule, XP, skills.
    resetRogue() {
      this.runTime = 0;
      this.bossSchedule = RA.BAL.BOSS_TIMES.slice();
      this.pendingBosses = [];
      this.midIdx = 0;
      this.finalIdx = 0;
      this.finalDownAt = null;
      this.level = 1;
      this.xp = 0;
      this.pendingChoices = 0;
      this.choiceDelay = 0; // lets the headshot/kill juice play before the modal
      this.rerolls = RA.BAL.SKILL_REROLLS;
      this.items = {};
      this.supports = {};
      this.supportTimers = {};
      this.supportFireAnim = {};
      this.shotCounts = {}; // arrows fired per def — the run's "legend weapon"
      this.eggT = 5;
      this.sk = RA.SKILLS.stats({});
    }

    recalcSkills() {
      this.sk = RA.SKILLS.stats(this.items);
      this.applyUpgrades(); // max HP / pull speed read skill multipliers
      RA.UI && RA.UI.refreshChips();
    }

    // Where each held dwarf support stands on the tower (left of the player).
    dwarfSlots() {
      const out = {};
      let slot = 0;
      for (const id in this.supports) {
        if (RA.SKILLS.byId[id] && RA.SKILLS.byId[id].dwarf) {
          out[id] = { x: this.towerX - 48 - slot * 30, y: this.towerTop };
          slot++;
        }
      }
      return out;
    }

    towerRect() {
      return { x: this.towerX - 92, y: this.towerTop, w: 184, h: this.H - this.towerTop + 60 };
    }

    // The tower→platform gap must be bridgeable by BOTH archers: the player's
    // default arrow at 90% draw (×0.85 margin) and the occupant's own arrow at
    // full draw (×0.9 — the brain re-solves at full draw when short). Distances
    // are absolute world units so battle range no longer grows with monitor
    // aspect ratio; heavy-arrow bosses (mace/axe) pull the whole band closer.
    spawnDistBand(plat, boss) {
      const B = RA.BAL, u = boss ? boss.scale : 1;
      const def = (boss && RA.ARROWS.byId[boss.arrow]) || RA.ARROWS.byId.default;
      const pHand = this.towerTop - 80, pChest = this.towerTop - 76;
      const range = (v, g, h) => g > 1 ? (v / g) * Math.sqrt(Math.max(0, v * v - 2 * g * h)) : 4000;
      const gE = B.ARROW_GRAVITY * (def.gravityScale == null ? 1 : def.gravityScale);
      const vP = B.ARROW_SPEED * (0.45 + 0.55 * 0.9);
      const vE = B.ARROW_SPEED * (def.speedScale || 1) *
        (1 - B.WEIGHT_SPEED_PENALTY * (def.stats[2] - 1));
      let hi = Math.min(
        range(vP, B.ARROW_GRAVITY, pHand - (plat.cy - plat.s - plat.bobA - 76 * u)) * 0.85,
        range(vE, gE, (plat.cy - plat.s + plat.bobA - 80 * u) - pChest) * 0.9
      );
      hi = Math.max(hi, 480);
      const menu = this.state === 'menu';
      if (menu) hi = Math.min(hi, 1050);
      const lo = Math.max(420, Math.min(menu ? 800 : 650, hi * 0.8));
      return { lo, hi };
    }

    // ---------------------------------------------------------------
    // Camera: the title screen holds a close-up on the archer; START
    // eases the view out to the full battlefield and begins the run.
    // ---------------------------------------------------------------
    titleCam() {
      const z = Math.min(1.6, Math.max(1.3, this.H / 800));
      return { z, fx: this.towerX + 50, fy: this.towerTop - 120 };
    }

    camNow() {
      if (this.camAnim) {
        const a = this.camAnim;
        const k = Math.min(1, a.t / a.dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
        return {
          z: a.from.z + (a.to.z - a.from.z) * e,
          fx: a.from.fx + (a.to.fx - a.from.fx) * e,
          fy: a.from.fy + (a.to.fy - a.from.fy) * e,
        };
      }
      if (this.state === 'menu') return this.titleCam();
      return { z: 1, fx: this.W / 2, fy: this.H / 2 };
    }

    startFromTitle() {
      if (this.state !== 'menu' || this.camAnim) return;
      RA.SND.play('click');
      this.camAnim = {
        t: 0, dur: 1.15,
        from: this.titleCam(),
        to: { z: 1, fx: this.W / 2, fy: this.H / 2 },
        onDone: () => this.beginRun(),
      };
    }

    // ---------------------------------------------------------------
    // Background phases (meadow → burning → frozen → ominous)
    // ---------------------------------------------------------------
    hexRgb(hex) {
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }

    bgTargetPhase() {
      const t = this.state === 'menu' ? 0 : this.runTime;
      const P = RA.BAL.BG_PHASES;
      let cur = P[0];
      for (const p of P) if (t >= p.t) cur = p;
      return cur;
    }

    updateBg(dt) {
      const target = this.bgTargetPhase();
      // Entering a new phase mid-run gets a sky-wide cinematic beat.
      if (this._bgPhase !== target) {
        const prev = this._bgPhase;
        this._bgPhase = target;
        if (prev && this.state === 'playing' && target.t > prev.t) this.triggerBgEvent(target);
      }
      if (this.bgEvent) {
        this.bgEvent.t += dt;
        if (this.bgEvent.t > this.bgEvent.dur) this.bgEvent = null;
      }
      // Integrate the grass-sway phase so wind-speed changes accelerate
      // the sway instead of teleporting every blade.
      this.grassPhase += (this.bgAccent === 'grassWind' ? 2.1 : 1.3) * dt;
      const k = 1 - Math.exp(-dt / (RA.BAL.BG_FADE * 0.35));
      for (const key in this.bgCol) {
        const tc = this.hexRgb(target[key]);
        for (let i = 0; i < 3; i++) this.bgCol[key][i] += (tc[i] - this.bgCol[key][i]) * k;
      }
      for (const key in this.bgNum) {
        this.bgNum[key] += (target[key] - this.bgNum[key]) * k;
      }
      this.bgAccent = target.accent;
      // Clouds drift and wrap.
      for (const c of this.clouds) {
        c.x += c.v * dt;
        if (c.x > this.W + 260) c.x = -260;
      }
    }

    rgbStr(c, a) {
      return a == null
        ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
        : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
    }

    mixRgb(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }

    // Height of a rolling hill at x — shared by the fill and the trees.
    hillY(x, baseFrac, amp, seed) {
      return this.H * baseFrac +
        Math.sin(x * 0.004 + seed) * amp +
        Math.sin(x * 0.011 + seed * 2.7) * amp * 0.45;
    }

    drawHills(ctx, baseFrac, amp, seed, color) {
      const W = this.W, H = this.H;
      const x0 = -W * 0.3, x1 = W * 1.3; // wide enough for the title zoom
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x0, H + H * 0.5);
      for (let x = x0; x <= x1; x += 36) {
        ctx.lineTo(x, this.hillY(x, baseFrac, amp, seed));
      }
      ctx.lineTo(x1, H + H * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    // Silhouette trees planted along a hill's ridge line. Each tree is a
    // single-fill union path, so it stays perfectly solid.
    drawTreeline(ctx, baseFrac, amp, seed, count, color) {
      const W = this.W;
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const x = ((i * 197 + seed * 131) % (W + 60)) - 30;
        const y = this.hillY(x, baseFrac, amp, seed) + 3;
        const s = 0.65 + ((i * 37) % 50) / 100;
        ctx.beginPath();
        ctx.rect(x - 2 * s, y - 15 * s, 4 * s, 15 * s); // trunk
        const canopy = [[0, -22, 11], [-8, -15, 8.5], [8, -15, 8.5], [0, -12, 9]];
        for (const p of canopy) {
          const px = x + p[0] * s, py = y + p[1] * s, pr = p[2] * s;
          ctx.moveTo(px + pr, py);
          ctx.arc(px, py, pr, 0, 7);
        }
        ctx.fill();
      }
    }

    // Low bushes hugging the near hill.
    drawBushes(ctx, baseFrac, amp, seed, count, color) {
      const W = this.W;
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const x = ((i * 263 + seed * 71) % (W + 40)) - 20;
        const y = this.hillY(x, baseFrac, amp, seed) + 4;
        const s = 0.6 + ((i * 53) % 40) / 100;
        ctx.beginPath();
        const lumps = [[0, 0, 11], [-11, 3, 8], [11, 3, 8]];
        for (const p of lumps) {
          const px = x + p[0] * s, py = y + p[1] * s, pr = p[2] * s;
          ctx.moveTo(px + pr, py);
          ctx.arc(px, py, pr, 0, 7);
        }
        ctx.fill();
      }
    }

    // ---- Clouds: shaded sprites rendered OPAQUE offscreen, stamped with
    // group alpha — no overlapping-circle blotches, real volume. Sprites
    // are cached per (shape variant, quantized phase color). ----
    static CLOUD_PUFFS = [
      [[0, 0, 30], [-32, 7, 22], [30, 7, 24], [-14, -11, 23], [12, -13, 20]],
      [[0, 0, 26], [-26, 6, 20], [26, 4, 21], [-8, -12, 19], [16, -9, 16], [42, 8, 13]],
      [[0, 0, 34], [-36, 8, 24], [34, 8, 26], [-16, -14, 24], [14, -16, 22], [48, -4, 16], [-48, 2, 15]],
    ];

    // Keeps the world "breathing" behind modals: particles settle, clouds
    // drift, transition cinematics finish — while gameplay stays frozen.
    tickAmbient(dt) {
      this.time += dt;
      this.fx.update(dt);
      this.updateBg(dt);
    }

    cloudSprite(variant, col) {
      const q = (v) => (v | 0) & ~3; // fine quantization: no visible tint steps
      const key = variant + '|' + q(col[0]) + ',' + q(col[1]) + ',' + q(col[2]);
      if (!this._cloudCache) this._cloudCache = new Map();
      let spr = this._cloudCache.get(key);
      if (spr) return spr;
      if (this._cloudCache.size > 48) this._cloudCache.clear();

      const puffs = Game.CLOUD_PUFFS[variant % Game.CLOUD_PUFFS.length];
      const cv = document.createElement('canvas');
      cv.width = 170; cv.height = 110;
      const c = cv.getContext('2d');
      const ox = 85, oy = 62;
      const layer = (dx, dy, rMul, color) => {
        c.fillStyle = color;
        c.beginPath();
        for (const p of puffs) {
          const px = ox + p[0] + dx, py = oy + p[1] + dy, pr = p[2] * rMul;
          c.moveTo(px + pr, py);
          c.arc(px, py, pr, 0, 7);
        }
        c.fill();
      };
      const body = col;
      const shade = this.mixRgb(col, [40, 45, 60], 0.3);
      const light = this.mixRgb(col, [255, 255, 255], 0.4);
      layer(2, 6, 1, this.rgbStr(shade));    // under-shadow
      layer(0, 0, 1, this.rgbStr(body));     // body
      layer(-4, -7, 0.68, this.rgbStr(light)); // sunlit top
      this._cloudCache.set(key, cv);
      return cv;
    }

    drawCloud(ctx, x, y, s, variant, alpha) {
      const spr = this.cloudSprite(variant, this.bgCol.cloud);
      ctx.globalAlpha = alpha;
      ctx.drawImage(spr, x - 85 * s, y - 62 * s, 170 * s, 110 * s);
      ctx.globalAlpha = 1;
    }

    // ---- Phase-transition cinematics: flash, light sweep, lightning
    // bolts, wind-blown leaves — the sky announces each new era. ----
    static EVENT_TINT = {
      grass: '220,240,210', grassWind: '215,238,205',
      embers: '255,120,60', snow: '190,220,255', omen: '150,90,220',
    };

    triggerBgEvent(phase) {
      const type = phase.accent;
      const ev = { type, t: 0, dur: 2.8, bolts: [] };
      if (type === 'embers' || type === 'omen') {
        const n = type === 'omen' ? 3 : 2;
        for (let b = 0; b < n; b++) {
          // Stored as viewport FRACTIONS so a mid-event resize can't strand
          // the bolts outside the new viewport.
          const pts = [];
          let x = this.W * (0.2 + Math.random() * 0.6), y = -10;
          pts.push([x / this.W, y / this.H]);
          while (y < this.H * 0.55) {
            y += 34 + Math.random() * 44;
            x += (Math.random() - 0.5) * 76;
            pts.push([x / this.W, y / this.H]);
          }
          ev.bolts.push({ pts, offset: Math.random() * 2 });
        }
        RA.SND.play('thunder');
        this.fx.shake(type === 'omen' ? 10 : 8);
      } else if (type === 'snow') {
        RA.SND.play('frost');
        this.fx.spark(this.W * 0.5, this.H * 0.25, '#e8f2ff', 22, 320);
      } else {
        RA.SND.play('gust');
      }
      this.bgEvent = ev;
    }

    drawBgEvent(ctx) {
      const ev = this.bgEvent;
      if (!ev) return;
      const W = this.W, H = this.H;
      const t = ev.t, k = t / ev.dur;
      const tint = Game.EVENT_TINT[ev.type] || '255,255,255';

      // Full-screen flash: double-pulse for lightning types, single fade otherwise.
      let fa;
      if (ev.type === 'embers' || ev.type === 'omen') {
        fa = t < 0.12 ? 0.34 : t < 0.2 ? 0.08 : t < 0.32 ? 0.26 : Math.max(0, 0.22 * (1 - (t - 0.32) / 0.5));
      } else {
        fa = Math.max(0, 0.2 * (1 - t / 0.6));
      }
      if (fa > 0.005) {
        ctx.fillStyle = 'rgba(' + tint + ',' + fa.toFixed(3) + ')';
        ctx.fillRect(-20, -20, W + 40, H + 40);
      }

      // A band of light sweeping across the sky.
      if (k < 1) {
        const bx = (k * 1.5 - 0.25) * W;
        const bw = W * 0.14;
        const g = ctx.createLinearGradient(bx - bw, 0, bx + bw, 0);
        g.addColorStop(0, 'rgba(' + tint + ',0)');
        g.addColorStop(0.5, 'rgba(' + tint + ',' + (0.12 * (1 - k)).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + tint + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - bw, -20, bw * 2, H + 40);
      }

      // Flickering lightning bolts (burning / ominous).
      if (t < 0.75 && ev.bolts.length) {
        for (const b of ev.bolts) {
          if (Math.sin((t + b.offset) * 40) < 0.2) continue;
          ctx.beginPath();
          for (let i = 0; i < b.pts.length; i++) {
            const p = b.pts[i];
            if (i) ctx.lineTo(p[0] * W, p[1] * H); else ctx.moveTo(p[0] * W, p[1] * H);
          }
          ctx.strokeStyle = 'rgba(' + tint + ',' + (0.4 * (1 - t / 0.75)).toFixed(3) + ')';
          ctx.lineWidth = 8;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * (1 - t / 0.75)).toFixed(3) + ')';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }

      // Wind-blown leaves racing across (agitated-meadow entrance).
      if (ev.type === 'grassWind') {
        ctx.fillStyle = 'rgba(158, 198, 122, ' + (0.65 * (1 - k)).toFixed(3) + ')';
        for (let i = 0; i < 22; i++) {
          const lx = ((i * 211 + t * (620 + (i % 4) * 120)) % (W + 120)) - 60;
          const ly = H * (0.16 + ((i * 67) % 60) / 100) + Math.sin(t * 6 + i) * 26;
          const ls = 1 + (i % 3) * 0.5;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(t * 9 + i);
          ctx.beginPath();
          ctx.ellipse(0, 0, 8 * ls, 3.6 * ls, 0, 0, 7);
          ctx.fill();
          ctx.restore();
        }
      }

      // Frost crystals drifting down (frozen-meadow entrance).
      if (ev.type === 'snow' && k < 0.7) {
        ctx.fillStyle = 'rgba(230, 242, 255, ' + (0.7 * (1 - k / 0.7)).toFixed(3) + ')';
        for (let i = 0; i < 16; i++) {
          const sx2 = ((i * 173) % W) + Math.sin(t * 3 + i) * 30;
          const sy2 = H * 0.1 + t * 160 + ((i * 91) % 120);
          ctx.beginPath(); ctx.arc(sx2, sy2, 2 + (i % 3), 0, 7); ctx.fill();
        }
      }
    }

    // Ambient accents, computed deterministically from time (stateless).
    drawBgAccents(ctx) {
      const W = this.W, H = this.H, time = this.time, type = this.bgAccent;
      if (!type) return;
      if (type === 'grass' || type === 'grassWind') {
        // two-tone swaying grass along the ground
        for (let i = 0; i < 80; i++) {
          ctx.fillStyle = i % 3 ? 'rgba(38, 82, 44, 0.7)' : 'rgba(78, 148, 78, 0.6)';
          const gx = ((i * 47) % W) + Math.sin(time * 1.4 + i) * 3;
          const gh = 10 + ((i * 37) % 18);
          ctx.beginPath();
          ctx.moveTo(gx - 4, H);
          ctx.quadraticCurveTo(gx, H - gh, gx + 1, H - gh - 3);
          ctx.quadraticCurveTo(gx + 2, H - gh, gx + 5, H);
          ctx.fill();
        }
        // scattered wildflowers on the near hill
        for (let i = 0; i < 16; i++) {
          const fx = (i * 83 + 40) % W;
          const fy = H - 6 - ((i * 29) % 26);
          ctx.fillStyle = i % 3 === 0 ? '#f2e8b8' : i % 3 === 1 ? '#e8a8b8' : '#f5f5f5';
          ctx.globalAlpha = 0.75;
          ctx.beginPath(); ctx.arc(fx + Math.sin(time * 1.2 + i) * 2, fy, 2.2, 0, 7); ctx.fill();
        }
        // drifting pollen motes catching the light
        for (let i = 0; i < 12; i++) {
          const px = ((i * 149 + time * (9 + (i % 4) * 5)) % (W + 60)) - 30;
          const py = H * 0.45 + ((i * 71) % Math.round(H * 0.4)) + Math.sin(time * 0.9 + i * 2) * 14;
          ctx.globalAlpha = 0.18 + 0.12 * Math.sin(time * 2.2 + i * 3);
          ctx.fillStyle = '#f5f0d5';
          ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (type === 'grassWind') {
          ctx.strokeStyle = 'rgba(255,255,255,0.07)';
          ctx.lineWidth = 2;
          for (let i = 0; i < 9; i++) {
            const wx = ((i * 211 + time * 260) % (W + 240)) - 120;
            const wy = H * (0.18 + ((i * 53) % 45) / 100);
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.quadraticCurveTo(wx + 35, wy - 6, wx + 80, wy);
            ctx.stroke();
          }
        }
      } else if (type === 'embers') {
        for (let i = 0; i < 26; i++) {
          const ey = H - (((i * 131 + time * (60 + (i % 5) * 22)) % (H + 40)));
          const ex = ((i * 179) % W) + Math.sin(time * 1.3 + i) * 24;
          ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 7 + i * 2);
          ctx.fillStyle = i % 3 ? '#ff9c3a' : '#ff6b3a';
          ctx.beginPath(); ctx.arc(ex, ey, 1.6 + (i % 3), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // heat glow along the ground line
        ctx.fillStyle = 'rgba(255, 107, 58, 0.08)';
        ctx.fillRect(0, H * 0.86, W, H * 0.14);
      } else if (type === 'snow') {
        ctx.fillStyle = 'rgba(240, 246, 255, 0.6)';
        for (let i = 0; i < 34; i++) {
          const sy = (((i * 131 + time * (40 + (i % 4) * 14)) % (H + 40))) - 20;
          const sx = ((i * 179) % W) + Math.sin(time * 0.8 + i) * 34;
          ctx.globalAlpha = 0.25 + ((i * 29) % 40) / 100;
          ctx.beginPath(); ctx.arc(sx, sy, 1.4 + (i % 3) * 0.8, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (type === 'omen') {
        for (let i = 0; i < 14; i++) {
          const ox = ((i * 223) % W) + Math.sin(time * 0.5 + i * 1.7) * 60;
          const oy = H * 0.25 + ((i * 97) % Math.round(H * 0.55)) + Math.sin(time * 0.8 + i) * 18;
          ctx.globalAlpha = 0.10 + 0.06 * Math.sin(time * 2 + i * 3);
          ctx.fillStyle = '#b07ae0';
          ctx.beginPath(); ctx.arc(ox, oy, 8 + (i % 4) * 4, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Distant birds crossing the sky (they flee once the meadow burns).
      if (type === 'grass' || type === 'grassWind' || type === 'snow') {
        ctx.strokeStyle = 'rgba(30, 34, 38, 0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const bx = ((i * 331 + time * (13 + i * 4)) % (W + 200)) - 100;
          const by = H * (0.14 + ((i * 61) % 22) / 100) + Math.sin(time * 1.6 + i * 2) * 9;
          const flap = Math.sin(time * 8 + i * 2.4) * 3.5;
          const bs = 0.8 + (i % 3) * 0.25;
          ctx.beginPath();
          ctx.moveTo(bx - 8 * bs, by);
          ctx.quadraticCurveTo(bx - 4 * bs, by - 4 * bs - flap, bx, by);
          ctx.quadraticCurveTo(bx + 4 * bs, by - 4 * bs - flap, bx + 8 * bs, by);
          ctx.stroke();
        }
      }
    }

    solids() {
      const arr = [this.towerRect()];
      for (const p of this.platforms) arr.push(p.rect());
      return arr;
    }

    initWorld() {
      this.spawnPlayer();
      this.spawnEnemy();
    }

    // ---------------------------------------------------------------
    // Player + upgrades
    // ---------------------------------------------------------------
    playerStats() {
      const B = RA.BAL, U = RA.SAVE.data.upgrades;
      return {
        hpMax: B.PLAYER_HP_BASE + U.health * B.PLAYER_HP_PER_LVL,
        staMax: B.PLAYER_STA_BASE + U.stamina * B.PLAYER_STA_PER_LVL,
        staRegen: B.STA_REGEN_BASE + U.staminaRefresh * B.STA_REGEN_PER_LVL,
        drawTime: B.DRAW_TIME_BASE / (1 + U.pullSpeed * B.DRAW_TIME_LVL_FACTOR),
        dmgMult: 1 + U.damage * B.DMG_PER_LVL,
        armorReduce: Math.min(B.ARMOR_REDUCE_MAX, U.armor * B.ARMOR_REDUCE_PER_LVL),
      };
    }

    spawnPlayer(invuln) {
      const st = this.playerStats();
      const p = new RA.Archer(this, {
        isPlayer: true, facing: 1,
        anchorX: this.towerX, anchorY: this.towerTop,
        plat: this.tower, color: '#ececec',
        hpMax: Math.round(st.hpMax * this.sk.maxHp), staMax: st.staMax,
        staRegen: st.staRegen, armorReduce: st.armorReduce,
      });
      p.onDeath = () => this.playerDied();
      this.player = p;
      this.drawTime = st.drawTime / this.sk.pull;
      this.playerDmgMult = st.dmgMult;
      if (invuln) p.invuln = RA.BAL.RESPAWN_INVULN;
    }

    // Re-read upgrade levels after a purchase (keeps current hp/sta ratio benefits).
    applyUpgrades() {
      const p = this.player;
      if (!p) return;
      const st = this.playerStats();
      const skHpMax = Math.round(st.hpMax * this.sk.maxHp);
      const hpGain = skHpMax - p.hpMax;
      const staGain = st.staMax - p.staMax;
      p.hpMax = skHpMax; p.staMax = st.staMax;
      if (hpGain > 0) p.hp = Math.min(p.hpMax, p.hp + hpGain);
      if (staGain > 0) p.sta = Math.min(p.staMax, p.sta + staGain);
      p.staRegen = st.staRegen;
      p.armorReduce = st.armorReduce;
      this.drawTime = st.drawTime / this.sk.pull;
      this.playerDmgMult = st.dmgMult;
    }

    // ---------------------------------------------------------------
    // Enemies
    // ---------------------------------------------------------------
    spawnEnemy() {
      // Bosses come from the run's timed schedule (3:00 / 5:00 / 7:00 …).
      let boss = null, bossKind = null;
      if (this.state === 'playing' && this.pendingBosses.length) {
        bossKind = this.pendingBosses.shift();
        boss = bossKind === 'final'
          ? RA.BAL.FINAL_BOSSES[this.finalIdx++ % RA.BAL.FINAL_BOSSES.length]
          : RA.BAL.MID_BOSSES[this.midIdx++ % RA.BAL.MID_BOSSES.length];
      }
      const W = this.W, H = this.H;
      const plat = new RA.Platform(
        0, // cx set below — the platform's height/bob determine the fair band
        H * (0.34 + Math.random() * 0.28),
        boss ? Math.round(62 * Math.max(1, boss.scale * 0.92)) : 62,
        { bobA: Math.random() < 0.45 ? 8 + Math.random() * 16 : 0, bobS: 0.5 + Math.random() * 0.8 }
      );
      const band = this.spawnDistBand(plat, boss);
      plat.cx = Math.min(this.towerX + band.lo + Math.random() * (band.hi - band.lo), W - 150);
      this.platforms = [plat];

      const diff = this.state === 'playing'
        ? RA.BAL.difficulty(this.runTime, this.finalDownAt)
        : 1;
      // The first few regular enemies are squishy on purpose (sharpshooter opening).
      const hp = !boss && this.score < RA.BAL.EASY_KILLS
        ? RA.BAL.EASY_HP
        : Math.round(RA.BAL.enemyHp(this.score) * (boss ? boss.hp : 1) * diff);
      const e = new RA.Archer(this, {
        facing: -1,
        anchorX: plat.cx, anchorY: plat.topY(),
        plat, scale: boss ? boss.scale : 1,
        hpMax: hp,
        color: boss ? boss.color : '#e0e0e0',
        backColor: boss ? boss.back : null,
        armorReduce: boss ? boss.armor : 0,
        giant: !!boss && boss.scale >= 1.4, // heavy bosses resist knockback / jump lower
        boss,
      });
      if (boss) {
        const nm = RA.I18N.t('boss.' + boss.id);
        e.bossKind = bossKind;
        e.bossName = bossKind === 'final' ? '★ ' + nm + ' ★' : nm;
      }
      e.onDeath = (a, info) => this.onEnemyKilled(a, info);
      e.brain = new RA.Brain(this, e);
      this.enemies = [e];

      if (boss) {
        RA.SND.play('giant');
        RA.UI && RA.UI.toast(bossKind === 'final'
          ? RA.I18N.t('toast.finalBoss', { name: RA.I18N.t('boss.' + boss.id) })
          : RA.I18N.t('toast.bossIncoming', { name: e.bossName }));
      }
    }

    onEnemyKilled(e) {
      this.enemies = this.enemies.filter((x) => x !== e);
      // Posthumous kills (lingering DoT/hazards after the run ended) must
      // not mutate the already-saved score/skull/giant accounting.
      if (this.state === 'gameover' || this.state === 'victory') return;
      const reward = Math.round(
        RA.BAL.enemySkulls(this.score, e.boss ? e.boss.reward : 1) * this.sk.skull
      );
      this.score++;
      if (this.state === 'playing') {
        this.gainXp(e.bossKind === 'final' ? RA.BAL.XP_BOSS_FINAL
          : e.bossKind === 'mid' ? RA.BAL.XP_BOSS_MID
          : RA.BAL.XP_KILL);
        if (e.bossKind === 'final' && this.finalDownAt == null) this.finalDownAt = this.runTime;
      }
      this.runSkulls += reward;
      RA.SAVE.data.stats.totalKills++;
      RA.SAVE.addSkulls(reward); // also persists the kill counter
      this.fx.text(e.pose.head.x, e.pose.head.y - 44, '+' + reward + ' ☠', '#ffd23e', 30);
      if (RA.UI) { RA.UI.bumpScore(); RA.UI.bumpSkulls(); }
      // Beating the all-time best mid-run gets a fanfare (once per run).
      if (this.state === 'playing' && !this.newBestHit && this.startBest > 0 && this.score > this.startBest) {
        this.newBestHit = true;
        this.celebrateBest();
      }
      this.schedule(1.1, () => {
        if (this.state === 'playing' || this.state === 'menu') this.spawnEnemy();
      });
      RA.UI && RA.UI.refreshEconomy();
    }

    celebrateBest() {
      RA.SND.play('fanfare');
      this.fx.shake(8);
      const p = this.player;
      const cx = p ? p.pose.chest.x : this.W / 2;
      const cy = p ? p.pose.chest.y - 60 : this.H / 3;
      const palette = ['#ffd23e', '#e0453c', '#7dc93b', '#4f8fd0', '#ff7bac'];
      for (let i = 0; i < 5; i++) {
        this.schedule(i * 0.18, () => {
          const x = cx + (Math.random() - 0.5) * this.W * 0.5;
          const y = cy - Math.random() * this.H * 0.2;
          this.fx.ring(x, y, 70, palette[i % palette.length]);
          for (const c of palette) this.fx.spark(x, y, c, 6, 330);
        });
      }
      RA.UI && RA.UI.showBestBanner();
    }

    // ---------------------------------------------------------------
    // XP / levels / skill picks (roguelike growth, per run)
    // ---------------------------------------------------------------
    gainXp(v) {
      if (this.state !== 'playing') return;
      this.xp += v * this.sk.xp * RA.BAL.earlyXpBoost(this.level);
      RA.UI && RA.UI.xpPulse();
      let need = RA.BAL.xpForNext(this.level);
      while (this.xp >= need) {
        this.xp -= need;
        this.level++;
        this.pendingChoices++;
        RA.SND.play('levelup');
        need = RA.BAL.xpForNext(this.level);
        // Don't interrupt the moment: the hit-stop, HEADSHOT! text and
        // kill rings play out on screen before the skill modal opens.
        this.choiceDelay = 0.85;
      }
    }

    presentChoice() {
      if (this.pendingChoices <= 0) return;
      this.pendingChoices--;
      RA.UI && RA.UI.showSkillChoice(RA.SKILLS.genOffers(this));
    }

    applySkill(offer) {
      if (offer.kind === 'bonus') {
        RA.SAVE.addSkulls(RA.SKILLS.SKULL_CACHE);
        this.runSkulls += RA.SKILLS.SKULL_CACHE;
        RA.UI && RA.UI.refreshEconomy();
      } else if (offer.kind === 'item') {
        this.items[offer.id] = offer.star;
        this.recalcSkills();
      } else {
        this.supports[offer.id] = offer.star;
        if (this.supportTimers[offer.id] == null) this.supportTimers[offer.id] = 2; // first strike soon
        RA.UI && RA.UI.refreshChips();
      }
      RA.SND.play('buy');
      if (this.pendingChoices > 0) this.presentChoice(); // chained level-ups
    }

    // Surviving the full 14:00 completes the run.
    winRun() {
      if (this.state !== 'playing') return;
      this.state = 'victory';
      this.timers = [];
      this.arrows = [];
      const S = RA.SAVE;
      if (this.score > S.data.best) S.data.best = this.score;
      this.recordRunStats();
      // Only completed runs are written into the Archer License legends.
      const gen = S.data.legends.length + 1;
      S.data.legends.push({
        gen, weapon: this.legendWeapon(),
        score: this.score, level: this.level,
        date: new Date().toISOString().slice(0, 10),
      });
      S.pushLeader({ score: this.score, skulls: this.runSkulls, date: new Date().toISOString().slice(0, 10) });
      S.save();
      RA.SND.play('fanfare');
      const palette = ['#ffd23e', '#e0453c', '#7dc93b', '#4f8fd0', '#ff7bac'];
      for (let i = 0; i < 6; i++) {
        const x = this.W * (0.2 + Math.random() * 0.6);
        const y = this.H * (0.15 + Math.random() * 0.3);
        this.fx.ring(x, y, 80, palette[i % palette.length]);
        for (const c of palette) this.fx.spark(x, y, c, 5, 340);
      }
      RA.UI && RA.UI.showVictory(this.score, this.level, this.runSkulls, gen);
    }

    playerDied() {
      this.aimP = null;
      if (this.state === 'menu') {
        // Shouldn't normally happen, but never leave the menu without an archer.
        this.schedule(RA.BAL.RESPAWN_DELAY, () => {
          if (this.state === 'menu' && (!this.player || !this.player.alive)) this.spawnPlayer();
        });
        return;
      }
      if (this.state !== 'playing') return;
      if (this.lives > 0) {
        this.lives--;
        this.schedule(RA.BAL.RESPAWN_DELAY, () => {
          if (this.state === 'playing') this.spawnPlayer(true);
        });
      } else {
        this.schedule(0.9, () => this.endRun());
      }
    }

    // ---------------------------------------------------------------
    // Run lifecycle
    // ---------------------------------------------------------------
    beginRun() {
      if (this.state !== 'menu') return;
      this.state = 'playing';
      this.score = 0;
      this.runSkulls = 0;
      this.lives = RA.SAVE.data.upgrades.lives;
      this.startBest = RA.SAVE.data.best;
      this.newBestHit = false;
      this.resetRogue();
      this.recalcSkills();
      RA.UI && RA.UI.onStateChange('playing');
      // First-ever run: explain the apples (design doc tutorial popup).
      if (!RA.SAVE.data.seenAppleTip) {
        RA.SAVE.data.seenAppleTip = true;
        RA.SAVE.save();
        RA.UI && RA.UI.showAppleTip();
      }
      // …and coach the core verb once: hold, drag, release.
      if (!RA.SAVE.data.seenDragTip) {
        RA.SAVE.data.seenDragTip = true;
        RA.SAVE.save();
        RA.UI && RA.UI.showDragCoach();
      }
    }

    endRun() {
      if (this.state !== 'playing') return;
      this.state = 'gameover';
      // Stop pending volleys/bursts and in-flight arrows from mutating
      // the run's stats after they've been recorded.
      this.timers = [];
      this.arrows = [];
      const S = RA.SAVE;
      const isNewBest = this.score > S.data.best && S.data.best > 0;
      if (this.score > S.data.best) S.data.best = this.score;
      this.recordRunStats();
      S.pushLeader({ score: this.score, skulls: this.runSkulls, date: new Date().toISOString().slice(0, 10) });
      S.save();
      RA.UI && RA.UI.showDeath(this.score, S.data.best, this.runSkulls, isNewBest);
    }

    recordRunStats() {
      const st = RA.SAVE.data.stats;
      st.bestSkulls = Math.max(st.bestSkulls, this.runSkulls);
      st.bestLevel = Math.max(st.bestLevel, this.level);
    }

    // The weapon this run will be remembered by — the most-fired arrow.
    legendWeapon() {
      let best = 'default', n = -1;
      for (const id in this.shotCounts) {
        if (this.shotCounts[id] > n) { n = this.shotCounts[id]; best = id; }
      }
      return best;
    }

    // Quit from the pause menu: keep banked skulls/stats, no death screen.
    abandonRun() {
      if (this.state !== 'playing') return;
      this.recordRunStats();
      RA.SAVE.save();
      this.backToMenu();
    }

    backToMenu() {
      this.state = 'menu';
      this.arrows = [];
      this.hazards = [];
      this.beams = [];
      this.timers = [];
      this.apples = [];
      this.groundArrows = [];
      this.adArrows = [];
      this.runArrows = RA.SAVE.data.selected.slice();
      this.curArrow = 0;
      this.score = 0;
      this.runSkulls = 0;
      this.bgEvent = null; // a mid-run cinematic must not replay over the menu
      this.resetRogue(); // a pending boss/skill state must not leak onto the menu
      this.recalcSkills();
      this.spawnPlayer();
      this.spawnEnemy();
      // Ease the camera back into the title close-up.
      this.camAnim = {
        t: 0, dur: 0.8,
        from: { z: 1, fx: this.W / 2, fy: this.H / 2 },
        to: this.titleCam(),
        onDone: null,
      };
      RA.UI && RA.UI.onStateChange('menu');
    }

    // ---------------------------------------------------------------
    // Combat helpers
    // ---------------------------------------------------------------
    targetsFor(fromPlayer) {
      if (fromPlayer) return this.enemies.filter((e) => e.alive);
      const p = this.player;
      return p && p.alive && p.invuln <= 0 ? [p] : [];
    }

    currentDef() {
      return RA.ARROWS.byId[this.runArrows[this.curArrow]] || RA.ARROWS.byId.default;
    }

    fire(shooter, angle, draw) {
      const def = shooter.isPlayer ? this.currentDef() : (shooter.brain ? shooter.brain.def : RA.ARROWS.byId.default);
      if (shooter.isPlayer) {
        const cost = RA.BAL.staminaCost(def.stats[1]) * this.sk.staCost;
        if (shooter.sta < cost) { RA.SND.play('denied'); return false; }
        shooter.sta -= cost;
        this.shotCounts[def.id] = (this.shotCounts[def.id] || 0) + 1;
        RA.UI && RA.UI.hideDragCoach(); // first real shot ends the coachmark
      }
      const B = RA.BAL;
      const speed = B.ARROW_SPEED * (def.speedScale || 1) *
        (1 - B.WEIGHT_SPEED_PENALTY * (def.stats[2] - 1)) *
        (0.45 + 0.55 * draw);
      const sx = shooter.pose.handF.x + Math.cos(angle) * 12;
      const sy = shooter.pose.handF.y + Math.sin(angle) * 12;
      const shot = {
        x: sx, y: sy, angle, speed, def,
        fromPlayer: shooter.isPlayer, power: draw,
        baseDmg: shooter.isPlayer
          ? undefined
          : B.enemyDamage(this.score) * (shooter.boss ? shooter.boss.dmg : 1) *
            (this.state === 'playing' ? B.difficulty(this.runTime, this.finalDownAt) : 1),
      };
      RA.SND.play('shoot');
      if (def.onFire && def.onFire(this, shooter, shot)) return true;
      this.spawnArrow({
        x: shot.x, y: shot.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        def, fromPlayer: shot.fromPlayer, power: draw, baseDmg: shot.baseDmg,
      });
      return true;
    }

    spawnArrow(o) {
      const a = new RA.Arrow(this, o);
      this.arrows.push(a);
      return a;
    }

    arrowHit(arrow, target, hit) {
      const def = arrow.def;
      let dmg = arrow.baseDmg != null ? arrow.baseDmg : def.dmg;
      dmg *= 0.55 + 0.45 * arrow.power;
      if (arrow.fromPlayer) dmg *= this.playerDmgMult * this.sk.dmg;
      dmg *= hit.mult;

      const kx = arrow.vx * 0.35, ky = arrow.vy * 0.35 - 60;
      const shiftScale = target.giant ? 0.35 : 1;
      const dealt = target.takeDamage(dmg, {
        part: hit.part, isHead: hit.isHead, zone: hit.zone, kx, ky,
        armorPierce: def.armorPierce, source: 'arrow',
        shift: def.knockShift ? Math.sign(arrow.vx || 1) * def.knockShift * shiftScale : 0,
      });

      // Landing arrows is how XP is earned (support strikes excluded).
      if (arrow.fromPlayer && !arrow.noXp && dealt > 0) {
        this.gainXp(hit.isHead ? RA.BAL.XP_HEADSHOT : RA.BAL.XP_HIT);
      }

      // Impact juice for the player's own hits.
      if (arrow.fromPlayer && dealt > 0) {
        const killed = !target.alive;
        this.hitStop = Math.max(this.hitStop,
          killed ? RA.BAL.HITSTOP_KILL : hit.isHead ? RA.BAL.HITSTOP_HEAD : RA.BAL.HITSTOP_HIT);
        this.fx.shake(killed ? 9 : hit.isHead ? 5 : 2.5);
        if (hit.isHead) {
          this.fx.ring(arrow.x, arrow.y, 42, '#ffd23e');
          if (target.alive) this.fx.text(arrow.x, arrow.y - 46, RA.I18N.t('fx.headshot'), '#ffd23e', 13);
        }
        if (killed) this.fx.ring(arrow.x, arrow.y, 80, '#ffffff');
      }

      const durMult = arrow.fromPlayer ? this.sk.effDur : 1;
      if (def.dot && target.alive) target.addDot(def.dot.kind, def.dot.dps, def.dot.dur * durMult);
      const stunDur = arrow.stunDur != null ? arrow.stunDur : def.stun;
      if (stunDur && target.alive) {
        target.stunT = Math.max(target.stunT, stunDur * durMult);
        RA.SND.play('stun');
        this.fx.spark(arrow.x, arrow.y, '#ffd23e', 8, 200);
      }
      if (def.healFrac && arrow.fromPlayer && this.player) this.player.heal(dealt * def.healFrac);
      if (def.onHit) def.onHit(this, arrow, target, { dmg: dealt, part: hit.part });

      // Lodge the arrow in the body so it rides the pose / ragdoll.
      if (!def.noStick && !def.pierce && target.pose) {
        const pa = target.pose[hit.a], pb = target.pose[hit.b];
        const boneAngle = Math.atan2(pb.y - pa.y, pb.x - pa.x);
        target.stuck.push({
          a: hit.a, b: hit.b, t: hit.t,
          rel: Math.atan2(arrow.vy, arrow.vx) - boneAngle,
          defId: def.id, len: arrow.len,
        });
        if (target.stuck.length > 14) target.stuck.shift();
      }
    }

    explode(x, y, r, dmg, fromPlayer, opts) {
      opts = opts || {};
      if (fromPlayer) r *= this.sk.hitSize;
      if (!opts.silent) {
        RA.SND.play('explosion');
        this.fx.shake(12);
      }
      this.fx.ring(x, y, r, '#ffb04a');
      this.fx.spark(x, y, '#ffb04a', 14, 320);
      this.fx.spark(x, y, '#e0453c', 8, 220);
      for (const t of this.targetsFor(fromPlayer)) {
        const c = t.pose.chest;
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < r + 40) {
          const falloff = 1 - 0.5 * Math.min(1, d / (r + 40));
          t.takeDamage(dmg * falloff, {
            part: 'torso', zone: 'torso',
            kx: (c.x - x) * 4, ky: (c.y - y) * 4 - 150,
            source: 'explosion',
          });
        }
      }
    }

    // Hitscan beam (laser). Pierces bodies, stops at solids.
    beam(shot, def) {
      RA.SND.play('laser');
      const maxD = Math.hypot(this.W, this.H) + 300;
      const ca = Math.cos(shot.angle), sa = Math.sin(shot.angle);
      let endD = maxD;
      const hitTargets = new Set();
      const solids = this.solids();
      outer:
      for (let d = 0; d < maxD; d += 8) {
        const px = shot.x + ca * d, py = shot.y + sa * d;
        for (const r of solids) {
          if (GEO.pointInRect(px, py, r)) { endD = d; break outer; }
        }
        for (const t of this.targetsFor(shot.fromPlayer)) {
          if (hitTargets.has(t)) continue;
          const hit = t.hitTest(px, py, 2);
          if (hit) {
            hitTargets.add(t);
            let dmg = def.dmg * (0.55 + 0.45 * shot.power) * hit.mult;
            if (shot.fromPlayer) dmg *= this.playerDmgMult * this.sk.dmg;
            t.takeDamage(dmg, { part: hit.part, isHead: hit.isHead, zone: hit.zone, kx: ca * 200, ky: sa * 200, source: 'arrow' });
            if (shot.fromPlayer) this.gainXp(hit.isHead ? RA.BAL.XP_HEADSHOT : RA.BAL.XP_HIT);
          }
        }
        if (px < -50 || px > this.W + 50 || py < -50 || py > this.H + 50) { endD = d; break; }
      }
      this.beams.push({ x1: shot.x, y1: shot.y, x2: shot.x + ca * endD, y2: shot.y + sa * endD, t: 0, ttl: 0.16 });
    }

    addHazard(type, x, plat, opts) {
      this.hazards.push(new RA.Hazard(this, type, x, plat, opts));
    }

    schedule(delay, fn) {
      this.timers.push({ t: delay, fn });
    }

    collectApple(ap) {
      if (ap.dead) return;
      ap.dead = true;
      const p = this.player;
      RA.SND.play('pickup');
      const colors = { red: '#e0453c', green: '#7dc93b', gold: '#f0c040' };
      this.fx.spark(ap.x, ap.y, colors[ap.type], 10, 200);
      if (!p || !p.alive) return;
      const B = RA.BAL;
      if (ap.type === 'winged') {
        p.heal(B.APPLE_HEAL * B.APPLE_WINGED_MULT);
        p.addStamina(B.APPLE_STA * B.APPLE_WINGED_MULT);
        if (this.state === 'playing') {
          this.lives++;
          this.fx.text(ap.x, ap.y - 30, '+1 ' + RA.I18N.t('upgrade.lives'), '#ffd23e', 20);
        }
        return;
      }
      if (ap.type === 'red' || ap.type === 'gold') p.heal(B.APPLE_HEAL);
      if (ap.type === 'green' || ap.type === 'gold') p.addStamina(B.APPLE_STA);
    }

    // ---------------------------------------------------------------
    // Player aiming input
    // ---------------------------------------------------------------
    aimStart(x, y) {
      // Shooting only on the battlefield — the title uses the START button.
      if (this.state !== 'playing' || this.camAnim) return;
      const p = this.player;
      if (!p || !p.alive || p.stunT > 0 || p.downT > 0 || p.crouching) return;
      const def = this.currentDef();
      if (p.sta < RA.BAL.staminaCost(def.stats[1]) * this.sk.staCost) {
        this.notifyLowStamina();
        return;
      }
      this.aimP = { sx: x, sy: y, x, y, drag: 0 };
      RA.SND.play('draw');
    }

    aimMove(x, y) {
      const a = this.aimP, p = this.player;
      if (!a || !p || !p.alive) return;
      a.x = x; a.y = y;
      const dx = x - a.sx, dy = y - a.sy;
      a.drag = Math.hypot(dx, dy);
      if (a.drag >= RA.BAL.MIN_DRAG_PIXELS) {
        p.aim.active = true;
        p.aim.angle = Math.atan2(dy, dx);
      }
    }

    aimEnd() {
      const a = this.aimP, p = this.player;
      this.aimP = null;
      if (!a || !p || !p.alive) { if (p) { p.aim.active = false; p.aim.draw = 0; } return; }
      const ok = p.aim.active &&
        p.aim.draw >= RA.BAL.MIN_DRAW_TO_FIRE &&
        a.drag >= RA.BAL.MIN_DRAG_PIXELS &&
        p.stunT <= 0;
      if (ok) this.fire(p, p.aim.angle, p.aim.draw);
      p.aim.active = false;
      p.aim.draw = 0;
    }

    jumpPlayer() {
      if (this.player) this.player.jump();
    }

    // Unified "out of stamina" feedback: sound + bar pulse + floating text,
    // throttled so button-mashing doesn't spam it.
    notifyLowStamina() {
      if (this.time - (this._lowStaAt || 0) < 0.8) return;
      this._lowStaAt = this.time;
      RA.SND.play('denied');
      RA.UI && RA.UI.pulseStamina();
      if (this.player && this.player.alive) {
        this.fx.text(
          this.player.pose.head.x, this.player.pose.head.y - 44,
          RA.I18N.t('fx.lowStamina'), '#5aa8f0', 15
        );
      }
    }

    // Hold-to-crouch: a smaller target, but you can't draw the bow.
    setCrouch(on) {
      const p = this.player;
      if (!p || !p.alive) return;
      if (on) {
        if (p.downT > 0) return;
        if (p.sta <= 0) { this.notifyLowStamina(); return; }
        if (!p.crouching) {
          p.crouching = true;
          p.aim.active = false;
          p.aim.draw = 0;
          this.aimP = null;
        }
      } else {
        p.crouching = false;
      }
    }

    cycleArrow() {
      if (this.runArrows.length < 2) return;
      this.curArrow = (this.curArrow + 1) % this.runArrows.length;
      RA.SND.play('click');
      RA.UI && RA.UI.refreshBadge();
    }

    // ---------------------------------------------------------------
    // Economy (called from the UI layer)
    // ---------------------------------------------------------------
    buyUpgrade(key) {
      const B = RA.BAL, S = RA.SAVE;
      const meta = B.UPGRADES.find((u) => u.key === key);
      const lvl = S.upgradeLvl(key);
      const max = key === 'arrowSlots' ? B.ARROW_SLOTS_MAX : B.MAX_UPGRADE_LVL;
      if (lvl >= max) { RA.UI && RA.UI.toast(RA.I18N.t('toast.maxLevel')); return false; }
      const cost = B.upgradeCost(meta.base, lvl);
      if (!S.spendSkulls(cost)) {
        RA.SND.play('denied');
        RA.UI && RA.UI.toast(RA.I18N.t('toast.needMore', { n: cost - S.data.skulls }));
        return false;
      }
      S.data.upgrades[key] = lvl + 1;
      S.save();
      this.applyUpgrades();
      RA.SND.play('buy');
      RA.UI && RA.UI.bumpSkulls();
      return true;
    }

    buyArrow(id) {
      const def = RA.ARROWS.byId[id];
      const S = RA.SAVE;
      if (!def || typeof def.cost !== 'number') return false;
      if (S.data.unlocked.includes(id)) return false;
      if (!S.spendSkulls(def.cost)) {
        RA.SND.play('denied');
        RA.UI && RA.UI.toast(RA.I18N.t('toast.needMore', { n: def.cost - S.data.skulls }));
        return false;
      }
      S.data.unlocked.push(id);
      S.save();
      RA.SND.play('buy');
      RA.UI && RA.UI.bumpSkulls();
      this.toggleSelect(id); // auto-equip on purchase when a slot is free
      return true;
    }

    // Equip / unequip an owned arrow (menu only).
    toggleSelect(id) {
      const S = RA.SAVE;
      if (!S.data.unlocked.includes(id)) return;
      const slots = 1 + S.upgradeLvl('arrowSlots');
      const sel = S.data.selected;
      const i = sel.indexOf(id);
      if (i >= 0) {
        if (sel.length > 1) sel.splice(i, 1);
      } else if (sel.length < slots) {
        sel.push(id);
      } else {
        sel.shift(); // slots full — the oldest pick makes room for the new one
        sel.push(id);
      }
      S.save();
      if (this.state === 'menu') {
        // Keep "one game" ad unlocks equipped alongside the saved selection.
        this.runArrows = sel.concat(this.adArrows.filter((a) => !sel.includes(a)));
        this.curArrow = Math.min(this.curArrow, this.runArrows.length - 1);
      }
      RA.SND.play('click');
    }

    // "One game" ad unlock: usable this run (and the run started next).
    adUnlockArrow(id) {
      if (!this.adArrows.includes(id)) this.adArrows.push(id);
      if (!this.runArrows.includes(id)) this.runArrows.push(id);
      this.curArrow = this.runArrows.indexOf(id);
      RA.UI && RA.UI.toast(RA.I18N.t('toast.unlockedRun', { name: RA.I18N.t('arrow.' + id) }));
    }

    // ---------------------------------------------------------------
    // Main loop
    // ---------------------------------------------------------------
    update(dt) {
      this.time += dt;
      this.fx.update(dt);
      this.updateBg(dt);

      if (this.camAnim) {
        this.camAnim.t += dt;
        if (this.camAnim.t >= this.camAnim.dur) {
          const done = this.camAnim.onDone;
          this.camAnim = null;
          if (done) done();
        }
      }

      // Hit-stop: the world freezes for a beat while particles keep
      // flying — impacts read as weight, not lag.
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        return;
      }

      // Scheduled callbacks
      for (const t of this.timers) t.t -= dt;
      const due = this.timers.filter((t) => t.t <= 0);
      this.timers = this.timers.filter((t) => t.t > 0);
      for (const t of due) t.fn();

      // Run clock: timed boss schedule, victory check, regen, supports.
      if (this.state === 'playing') {
        this.runTime += dt;
        while (this.bossSchedule.length && this.runTime >= this.bossSchedule[0].t) {
          this.pendingBosses.push(this.bossSchedule.shift().kind);
        }
        if (this.runTime >= RA.BAL.RUN_DURATION) {
          this.winRun();
          return;
        }
        if (this.sk.regenPct > 0 && this.player && this.player.alive) {
          this.eggT -= dt;
          if (this.eggT <= 0) {
            this.eggT = 5;
            this.player.heal(this.player.hpMax * this.sk.regenPct);
          }
        }
        for (const id in this.supports) {
          const def = RA.SKILLS.byId[id];
          const star = this.supports[id];
          if (this.supportTimers[id] == null) this.supportTimers[id] = def.cd(star);
          this.supportTimers[id] -= dt;
          if (this.supportTimers[id] <= 0) {
            // If there was no target, retry shortly instead of a full cooldown.
            const fired = def.fire(this, star);
            this.supportTimers[id] = fired ? def.cd(star) : 1;
            if (fired) this.supportFireAnim[id] = 0.5; // little hop on the tower
          }
        }
      }
      for (const id in this.supportFireAnim) {
        if (this.supportFireAnim[id] > 0) this.supportFireAnim[id] -= dt;
      }

      // Deferred level-up presentation (after the impact juice finishes).
      if (this.pendingChoices > 0 && !(RA.UI && RA.UI.modalOpen)) {
        this.choiceDelay -= dt;
        if (this.choiceDelay <= 0) this.presentChoice();
      }

      for (const p of this.platforms) p.update(dt);

      // Player draw grows while holding
      const p = this.player;
      if (p && p.alive) {
        if (this.aimP && p.aim.active && p.stunT <= 0) {
          p.aim.draw = Math.min(1, p.aim.draw + dt / this.drawTime);
        }
        // Crouching slowly drains stamina; empty tank stands you up.
        if (p.crouching) {
          p.sta -= RA.BAL.CROUCH_DRAIN * dt;
          if (p.sta <= 0) { p.sta = 0; p.crouching = false; }
        }
        p.update(dt);
      }

      for (const e of this.enemies) {
        if (e.brain && this.state === 'playing') e.brain.update(dt);
        e.update(dt);
      }

      for (const a of this.arrows) a.update(dt);
      this.arrows = this.arrows.filter((a) => !a.dead);

      if (this.state === 'playing') {
        this.appleTimer -= dt;
        if (this.appleTimer <= 0) {
          this.appleTimer = RA.BAL.APPLE_INTERVAL_MIN +
            Math.random() * (RA.BAL.APPLE_INTERVAL_MAX - RA.BAL.APPLE_INTERVAL_MIN);
          const roll = Math.random();
          const type = roll < RA.BAL.APPLE_WINGED_CHANCE ? 'winged'
            : roll < RA.BAL.APPLE_WINGED_CHANCE + RA.BAL.APPLE_GOLD_CHANCE ? 'gold'
            : Math.random() < 0.5 ? 'red' : 'green';
          this.apples.push(new RA.Apple(this, type, Math.random() < 0.5 ? 1 : -1));
        }
      }
      for (const ap of this.apples) ap.update(dt, this);
      this.apples = this.apples.filter((ap) => !ap.dead);

      for (const hz of this.hazards) {
        if (!this.platforms.includes(hz.plat)) hz.dead = true;
        else hz.update(dt);
      }
      this.hazards = this.hazards.filter((h) => !h.dead);

      const solids = this.solids();
      for (const c of this.corpses) c.step(dt, solids, this.W, this.H);
      this.corpses = this.corpses.filter((c) => !c.dead);

      for (const ga of this.groundArrows) {
        ga.ttl -= dt;
        // Player-favoring asymmetry: enemies standing on a stuck dot arrow
        // (poison/fire) get infected — the player's own floor stays safe.
        if (!ga.fromPlayer || this.state !== 'playing') continue;
        const gdef = RA.ARROWS.byId[ga.defId];
        const dot = gdef && gdef.dot;
        if (!dot) continue;
        for (const e of this.enemies) {
          if (!e.alive || e.jumpY < -4) continue; // hopping clears the barbs
          if (Math.abs(e.anchorX - ga.x) < 34 && Math.abs(e.anchorY - ga.y) < 28) {
            const fresh = !e.dots.some((d) => d.kind === dot.kind);
            e.addDot(dot.kind, dot.dps, dot.dur * (this.sk ? this.sk.effDur : 1));
            if (fresh) {
              this.fx.spark(ga.x, ga.y - 8, dot.kind === 'poison' ? '#9dc93b' : '#ff9c3a', 6, 130);
            }
          }
        }
      }
      this.groundArrows = this.groundArrows.filter((g) => g.ttl > 0);

      for (const b of this.beams) b.t += dt;
      this.beams = this.beams.filter((b) => b.t < b.ttl);
    }

    // ---------------------------------------------------------------
    render() {
      const ctx = this.ctx, W = this.W, H = this.H;
      const off = this.fx.offset();
      ctx.save();
      ctx.translate(off.x, off.y);

      // World camera (title close-up ⇄ battlefield); painted regions are
      // widened so a zoomed view never reveals unpainted margins.
      const cam = this.camNow();
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.z, cam.z);
      ctx.translate(-cam.fx, -cam.fy);

      const C = this.bgCol, N = this.bgNum;
      // Gradient sky — the run's clock is written in the weather.
      const grad = ctx.createLinearGradient(0, -20, 0, H * 0.9);
      grad.addColorStop(0, this.rgbStr(C.skyTop));
      grad.addColorStop(1, this.rgbStr(C.skyBottom));
      ctx.fillStyle = grad;
      ctx.fillRect(-W * 0.5, -H * 0.5, W * 2, H * 2);

      // Sun / moon with a soft halo, wandering across the run.
      const sx = N.sunX * W, sy = N.sunY * H, sr = N.sunR;
      ctx.fillStyle = this.rgbStr(C.sun, 0.12);
      ctx.beginPath(); ctx.arc(sx, sy, sr * 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = this.rgbStr(C.sun, 0.2);
      ctx.beginPath(); ctx.arc(sx, sy, sr * 1.6, 0, 7); ctx.fill();
      ctx.fillStyle = this.rgbStr(C.sun, 0.9);
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
      // slow-turning soft rays
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(this.time * 0.03);
      ctx.fillStyle = this.rgbStr(C.sun, 0.05);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, sr * 3.2, -0.1, 0.1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Stars fade in as the sky darkens toward the end of the run.
      if (N.starA > 0.02) {
        ctx.fillStyle = '#ffffff';
        for (const s of this.stars) {
          ctx.globalAlpha = s.a * 2 * N.starA;
          ctx.beginPath(); ctx.arc(s.x * W, s.y * H * 0.7, s.r, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Warm glow where the sun meets the horizon.
      const hg = ctx.createRadialGradient(sx, H * 0.8, 10, sx, H * 0.8, W * 0.32);
      hg.addColorStop(0, this.rgbStr(C.sun, 0.1));
      hg.addColorStop(1, this.rgbStr(C.sun, 0));
      ctx.fillStyle = hg;
      ctx.fillRect(-W * 0.25, H * 0.5, W * 1.5, H * 0.6);

      // Drifting clouds — shaded sprites stamped with group alpha.
      for (const c of this.clouds) {
        this.drawCloud(ctx, c.x, c.yf * H, c.s, c.variant, N.cloudA * 0.85);
      }

      // Three hill layers, hazier with distance, dressed with silhouettes.
      const hazeCol = this.mixRgb(C.hillFar, C.skyBottom, 0.55);
      this.drawHills(ctx, 0.74, 30, 7.9, this.rgbStr(hazeCol));
      this.drawHills(ctx, 0.8, 26, 1.3, this.rgbStr(C.hillFar));
      this.drawTreeline(ctx, 0.8, 26, 1.3, 12, this.rgbStr(this.mixRgb(C.hillFar, [10, 14, 10], 0.35)));
      this.drawHills(ctx, 0.88, 20, 4.1, this.rgbStr(C.hillNear));
      this.drawBushes(ctx, 0.88, 20, 4.1, 10, this.rgbStr(this.mixRgb(C.hillNear, [8, 12, 8], 0.35)));

      this.drawBgAccents(ctx);
      this.drawBgEvent(ctx);

      // Title deco: a pointing hand gesturing "hold and release" at the archer.
      if (this.state === 'menu' && this.player) {
        const target = this.player.pose.chest;
        const hx = W * 0.1, hy = H * 0.62;
        const ang = Math.atan2(target.y - 20 - hy, target.x - hx);
        const bob = Math.sin(this.time * 1.8) * 5; // gentle beckoning motion

        ctx.save();
        ctx.translate(hx + Math.cos(ang) * bob, hy + Math.sin(ang) * bob);
        ctx.rotate(ang);
        ctx.lineCap = 'round';
        // forearm from off-screen lower-left
        ctx.strokeStyle = '#9a9a9a';
        ctx.lineWidth = 40;
        ctx.beginPath(); ctx.moveTo(-190, 70); ctx.lineTo(-42, 10); ctx.stroke();
        // palm / fist
        ctx.fillStyle = '#c9c9c9';
        ctx.beginPath(); ctx.ellipse(-14, 0, 32, 27, 0, 0, 7); ctx.fill();
        // folded fingers along the front edge
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(10, -2 + i * 13, 9, 0, 7);
          ctx.fill();
        }
        // extended index finger
        ctx.strokeStyle = '#c9c9c9';
        ctx.lineWidth = 16;
        ctx.beginPath(); ctx.moveTo(2, -16); ctx.lineTo(52, -18); ctx.stroke();
        // thumb resting on top
        ctx.beginPath();
        ctx.ellipse(-22, -22, 13, 9, -0.5, 0, 7);
        ctx.fillStyle = '#c9c9c9';
        ctx.fill();
        ctx.restore();

        // dashed "drag" line from the fingertip to the archer
        const tipX = hx + Math.cos(ang) * 55 - Math.sin(ang) * -18;
        const tipY = hy + Math.sin(ang) * 55 + Math.cos(ang) * -18;
        ctx.setLineDash([2, 13]);
        ctx.strokeStyle = '#c9c9c9';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(tipX + Math.cos(ang) * 26, tipY + Math.sin(ang) * 26);
        ctx.lineTo(target.x - 46, target.y - 8);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      this.drawTower(ctx);
      // Held dwarf supports stand on the tower beside the player.
      const slots = this.dwarfSlots();
      for (const id in slots) {
        RA.drawDwarf(ctx, slots[id].x, slots[id].y, id, this.time, this.supportFireAnim[id] || 0);
      }
      for (const p of this.platforms) p.draw(ctx);

      for (const g of this.groundArrows) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, g.ttl);
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);
        RA.drawArrowShape(ctx, RA.ARROWS.byId[g.defId], g.len);
        ctx.restore();
      }
      for (const hz of this.hazards) hz.draw(ctx);
      for (const c of this.corpses) c.draw(ctx);
      for (const ap of this.apples) ap.draw(ctx);

      for (const e of this.enemies) {
        e.currentDef = e.brain ? e.brain.def : null;
        e.draw(ctx);
      }
      if (this.player) {
        this.player.currentDef = this.currentDef();
        this.player.draw(ctx);
      }

      for (const a of this.arrows) a.draw(ctx);

      for (const b of this.beams) {
        ctx.globalAlpha = 1 - b.t / b.ttl;
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      this.drawAimPreview(ctx);
      this.fx.draw(ctx);
      ctx.restore(); // end world camera — frame layers are screen-space
      this.drawForegroundGrass(ctx);

      // Subtle cinematic vignette framing the whole scene.
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = vig;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.restore();
    }

    drawTower(ctx) {
      const r = this.towerRect();
      ctx.fillStyle = '#6f6f6f';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // crenellations
      const mw = r.w / 5;
      ctx.fillRect(r.x, r.y - 16, mw, 16);
      ctx.fillRect(r.x + mw * 2, r.y - 16, mw, 16);
      ctx.fillRect(r.x + mw * 4, r.y - 16, mw, 16);
      // subtle brick lines
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(r.x, r.y, r.w, 10);
    }

    drawAimPreview(ctx) {
      const p = this.player, a = this.aimP;
      if (!p || !p.alive || !a || !p.aim.active || p.aim.draw <= 0.02) return;
      const def = this.currentDef();
      const B = RA.BAL;
      const speed = B.ARROW_SPEED * (def.speedScale || 1) *
        (1 - B.WEIGHT_SPEED_PENALTY * (def.stats[2] - 1)) *
        (0.45 + 0.55 * p.aim.draw);
      const grav = B.ARROW_GRAVITY * (def.gravityScale == null ? 1 : def.gravityScale);
      let x = p.pose.handF.x, y = p.pose.handF.y;
      let vx = Math.cos(p.aim.angle) * speed, vy = Math.sin(p.aim.angle) * speed;
      ctx.fillStyle = '#e8e2d4';
      const step = 0.05;
      for (let i = 0; i < 14; i++) {
        vy += grav * step;
        x += vx * step; y += vy * step;
        let blocked = false;
        for (const r of this.solids()) if (GEO.pointInRect(x, y, r)) { blocked = true; break; }
        if (blocked) break;
        ctx.globalAlpha = 0.75 * (1 - i / 14);
        ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Tall foreground grass swaying in front of everything — the
    // parallax layer that frames the scene from below.
    drawForegroundGrass(ctx) {
      const W = this.W, H = this.H, time = this.time;
      const C = this.bgCol;
      const dark = this.rgbStr(this.mixRgb(C.hillNear, [6, 8, 6], 0.5));
      const lite = this.rgbStr(this.mixRgb(C.hillNear, C.skyBottom, 0.28));
      // gusts bend the whole row during the windswept-phase entrance
      let gust = 0;
      if (this.bgEvent && this.bgEvent.type === 'grassWind') {
        gust = 10 * Math.max(0, 1 - this.bgEvent.t / this.bgEvent.dur);
      }
      for (let i = 0; i < 46; i++) {
        const x = ((i * 53) % (W + 30)) - 15;
        const hgt = 20 + ((i * 41) % 34);
        const sway = Math.sin(this.grassPhase + i * 0.7) * (4 + hgt * 0.12) + gust;
        ctx.fillStyle = i % 4 ? dark : lite;
        ctx.beginPath();
        ctx.moveTo(x - 3.5, H + 2);
        ctx.quadraticCurveTo(x - 1 + sway * 0.4, H - hgt * 0.55, x + sway, H - hgt);
        ctx.quadraticCurveTo(x + 2 + sway * 0.4, H - hgt * 0.55, x + 3.5, H + 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }
  RA.Game = Game;
})();
