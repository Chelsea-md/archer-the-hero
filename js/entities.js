// ============================================================
// entities.js — Archer (procedurally posed stickman), Arrow
// projectile, Apple pickups, Platforms, Hazards, and the FX pool.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});
  const GEO = RA.GEO;

  // ------------------------------------------------------------------
  // FX pool: sparks, floating texts, expanding rings, screen shake.
  // ------------------------------------------------------------------
  class FXPool {
    constructor() {
      this.sparks = [];
      this.texts = [];
      this.rings = [];
      this.shakeT = 0;
      this.shakeMag = 0;
    }
    spark(x, y, color, n, speed) {
      for (let i = 0; i < (n || 6); i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (speed || 160) * (0.4 + Math.random() * 0.8);
        this.sparks.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - s * 0.3,
          t: 0, ttl: 0.35 + Math.random() * 0.35, color: color || '#ffd23e',
          r: 1.6 + Math.random() * 2.2,
        });
      }
    }
    blood(x, y, kx, ky) {
      for (let i = 0; i < 7; i++) {
        this.sparks.push({
          x, y,
          vx: (kx || 0) * 0.25 + (Math.random() - 0.5) * 180,
          vy: (ky || 0) * 0.25 - Math.random() * 160,
          t: 0, ttl: 0.4 + Math.random() * 0.3, color: '#d94a41',
          r: 1.8 + Math.random() * 2.4,
        });
      }
    }
    text(x, y, str, color, size) {
      this.texts.push({ x, y, str, color: color || '#fff', size: size || 17, t: 0, ttl: 0.95, vy: -64 });
    }
    ring(x, y, r, color) {
      this.rings.push({ x, y, r0: 10, r1: r, t: 0, ttl: 0.35, color: color || '#ffd23e' });
    }
    shake(m) {
      this.shakeMag = Math.max(this.shakeMag, m);
      this.shakeT = 0.28;
    }
    update(dt) {
      for (const s of this.sparks) {
        s.t += dt; s.vy += 900 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
      }
      this.sparks = this.sparks.filter((s) => s.t < s.ttl);
      for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= 0.94; }
      this.texts = this.texts.filter((t) => t.t < t.ttl);
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter((r) => r.t < r.ttl);
      if (this.shakeT > 0) this.shakeT -= dt; else this.shakeMag = 0;
    }
    offset() {
      if (this.shakeT <= 0) return { x: 0, y: 0 };
      const m = this.shakeMag * (this.shakeT / 0.28);
      return { x: (Math.random() - 0.5) * m, y: (Math.random() - 0.5) * m };
    }
    draw(ctx) {
      for (const s of this.sparks) {
        ctx.globalAlpha = 1 - s.t / s.ttl;
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      }
      for (const r of this.rings) {
        const k = r.t / r.ttl;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(r.x, r.y, GEO.lerp(r.r0, r.r1, k), 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      for (const t of this.texts) {
        ctx.globalAlpha = 1 - Math.pow(t.t / t.ttl, 2);
        // Pop-in: numbers land oversized and snap down to size.
        const pop = t.t < 0.14 ? 1 + 0.8 * (1 - t.t / 0.14) : 1;
        ctx.font = '700 ' + Math.round(t.size * pop) + 'px "Arial Black", Impact, sans-serif';
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }
  }
  RA.FXPool = FXPool;

  // ------------------------------------------------------------------
  // Platform: floating diamond the enemy stands on. Player's tower is
  // a special static platform handled by the game.
  // ------------------------------------------------------------------
  class Platform {
    constructor(cx, cy, s, opts) {
      opts = opts || {};
      this.cx = cx; this.cy = cy; this.s = s;      // s = half-diagonal
      this.bobA = opts.bobA || 0;
      this.bobS = opts.bobS || 0.9;
      this.phase = Math.random() * 6.28;
      this.t = 0;
    }
    update(dt) { this.t += dt; }
    get yNow() { return this.cy + Math.sin(this.t * this.bobS + this.phase) * this.bobA; }
    topY() { return this.yNow - this.s; }
    get half() { return this.s * 0.55; }           // walkable half-width
    rect() {
      return { x: this.cx - this.s * 0.55, y: this.topY(), w: this.s * 1.1, h: this.s * 1.7, plat: this };
    }
    draw(ctx) {
      const side = this.s * 1.35;
      ctx.save();
      ctx.translate(this.cx, this.yNow);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#6f6f6f';
      ctx.fillRect(-side / 2, -side / 2, side, side);
      ctx.fillStyle = '#7d7d7d';
      ctx.fillRect(-side / 2, -side / 2, side, side * 0.45);
      ctx.restore();
    }
  }
  RA.Platform = Platform;

  // ------------------------------------------------------------------
  // Dwarf support helpers, drawn standing on the tower beside the player.
  // type: 'dwarfHunter' | 'dwarfWizard' | 'dwarfRogue'
  // fireAnim: 0..0.5 countdown right after their skill fires (little hop).
  // ------------------------------------------------------------------
  RA.drawDwarf = function (ctx, x, y, type, time, fireAnim) {
    const colors = {
      dwarfHunter: { body: '#a8c98a', acc: '#7da05f' },
      dwarfWizard: { body: '#9fb0e0', acc: '#5a6bb0' },
      dwarfRogue:  { body: '#9a9aa5', acc: '#5a5a65' },
      dwarfHealer: { body: '#8fcf9a', acc: '#4f9c62' },
    };
    const c = colors[type] || colors.dwarfHunter;
    const hop = fireAnim > 0.3 ? -(fireAnim - 0.3) * 90 : 0;
    const bob = Math.sin(time * 2.6 + x * 0.05) * 1.5;
    const by = y + hop + bob; // feet baseline
    const headY = by - 26;

    ctx.lineCap = 'round';
    // legs
    ctx.strokeStyle = c.body;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 4, by); ctx.lineTo(x - 1, by - 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 4, by); ctx.lineTo(x + 1, by - 9); ctx.stroke();
    // stout torso
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x, by - 9); ctx.lineTo(x, by - 18); ctx.stroke();
    // arms
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(x, by - 16); ctx.lineTo(x + 7, by - 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, by - 16); ctx.lineTo(x - 7, by - 12); ctx.stroke();
    // head
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.arc(x, headY, 6.5, 0, 7); ctx.fill();
    // beard — it's a dwarf, after all
    ctx.fillStyle = '#d9d9d9';
    ctx.beginPath();
    ctx.moveTo(x - 5, headY + 2); ctx.lineTo(x + 5, headY + 2); ctx.lineTo(x, headY + 11);
    ctx.closePath(); ctx.fill();

    if (type === 'dwarfHunter') {
      // tiny bow held out front
      ctx.strokeStyle = '#f0a63c';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x + 9, by - 13, 7, -1.2, 1.2); ctx.stroke();
    } else if (type === 'dwarfWizard') {
      // pointy hat
      ctx.fillStyle = c.acc;
      ctx.beginPath();
      ctx.moveTo(x - 8, headY - 3); ctx.lineTo(x + 8, headY - 3); ctx.lineTo(x + 1, headY - 17);
      ctx.closePath(); ctx.fill();
      // faint magic glow at the raised hand
      ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.25;
      ctx.fillStyle = '#cfe0f2';
      ctx.beginPath(); ctx.arc(x + 8, by - 12, 3.2, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (type === 'dwarfHealer') {
      // medic cap with a red cross
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath(); ctx.arc(x, headY - 3, 6, Math.PI, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e0453c';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, headY - 9); ctx.lineTo(x, headY - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 2, headY - 7); ctx.lineTo(x + 2, headY - 7); ctx.stroke();
      // pulsing potion vial in the outstretched hand
      ctx.globalAlpha = 0.6 + Math.sin(time * 5) * 0.25;
      ctx.fillStyle = '#a5e07b';
      ctx.fillRect(x + 6, by - 16, 3.5, 5.5);
      ctx.globalAlpha = 1;
    } else if (type === 'dwarfRogue') {
      // hood
      ctx.fillStyle = c.acc;
      ctx.beginPath(); ctx.arc(x, headY - 1, 7.5, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      // shuriken in hand
      ctx.fillStyle = '#d9d9d9';
      ctx.save();
      ctx.translate(x + 8, by - 12);
      ctx.rotate(time * 3);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillRect(0, -1, 4.5, 2);
      }
      ctx.restore();
    }
  };

  // ------------------------------------------------------------------
  // Apple pickups — red heals, green restores stamina, gold does both,
  // winged gold (rare) gives triple bonuses plus an extra life.
  // Shared renderer so the tutorial popup can draw the same icons.
  // ------------------------------------------------------------------
  RA.drawApple = function (ctx, x, y, r, type, t) {
    t = t || 0;
    const colors = { red: '#e0453c', green: '#7dc93b', gold: '#f0c040', winged: '#f0c040' };
    if (type === 'gold' || type === 'winged') {
      ctx.globalAlpha = 0.25 + Math.sin(t * 6) * 0.12;
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(x, y, r + 7, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (type === 'winged') {
      // wings
      const flap = Math.sin(t * 9) * 0.25;
      ctx.fillStyle = '#f5f5f5';
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(x + s * (r + 2), y - 2);
        ctx.rotate(s * (0.5 + flap));
        ctx.beginPath();
        ctx.ellipse(s * 7, -2, 11, 5, s * 0.35, 0, 7);
        ctx.fill();
        ctx.restore();
      }
      // halo
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y - r - 9, 9, 3.4, 0, 0, 7);
      ctx.stroke();
    }
    ctx.fillStyle = colors[type] || '#e0453c';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    // stem + leaf
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + 2, y - r - 6); ctx.stroke();
    ctx.fillStyle = '#7dc93b';
    ctx.beginPath();
    ctx.ellipse(x + 7, y - r - 5, 5, 2.6, -0.5, 0, 7);
    ctx.fill();
    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(x - 4, y - 4, 3.4, 0, 7); ctx.fill();
  };

  class Apple {
    constructor(game, type, dir) {
      this.type = type;
      this.r = RA.BAL.APPLE_RADIUS;
      this.x = dir > 0 ? -40 : game.W + 40;
      this.vx = dir * (110 + Math.random() * 110) * (type === 'winged' ? 0.75 : 1);
      this.baseY = game.H * (0.1 + Math.random() * 0.4);
      this.y = this.baseY;
      this.t = Math.random() * 10;
      this.dead = false;
    }
    update(dt, game) {
      this.t += dt;
      this.x += this.vx * dt;
      this.y = this.baseY + Math.sin(this.t * 2.6) * 16;
      if (this.x < -70 || this.x > game.W + 70) this.dead = true;
    }
    draw(ctx) {
      RA.drawApple(ctx, this.x, this.y, this.r, this.type, this.t);
    }
  }
  RA.Apple = Apple;

  // ------------------------------------------------------------------
  // Hazards left on platforms by special arrows (spikes / saw / slider).
  // ------------------------------------------------------------------
  class Hazard {
    constructor(game, type, x, plat, opts) {
      opts = opts || {};
      this.game = game; this.type = type; this.plat = plat;
      this.x = GEO.clamp(x, plat.cx - plat.half, plat.cx + plat.half);
      this.ttl = opts.ttl || 5;
      this.dmg = opts.dmg || 10;
      this.dps = opts.dps || 0;
      this.fromPlayer = opts.fromPlayer !== false;
      this.dir = opts.dir || 1;
      this.speed = opts.speed || 0;
      this.tick = 0; this.t = 0; this.dead = false;
      this.hitOnce = new Set();
    }
    update(dt) {
      this.t += dt; this.ttl -= dt;
      if (this.ttl <= 0) { this.dead = true; return; }
      const g = this.game;
      const min = this.plat.cx - this.plat.half, max = this.plat.cx + this.plat.half;
      if (this.type === 'saw') {
        const tg = g.targetsFor(this.fromPlayer).find((a) => a.plat === this.plat);
        if (tg) this.dir = Math.sign(tg.anchorX - this.x) || this.dir;
        this.x += this.dir * 300 * dt;
        if (this.x < min || this.x > max) { this.dir *= -1; this.x = GEO.clamp(this.x, min, max); }
      } else if (this.type === 'slider') {
        this.x += this.dir * this.speed * dt;
        if (this.x < min - 30 || this.x > max + 30) { this.dead = true; return; }
      }
      this.tick -= dt;
      for (const tg of g.targetsFor(this.fromPlayer)) {
        if (tg.plat !== this.plat || tg.jumpY < -4) continue; // jumping dodges hazards
        if (Math.abs(tg.anchorX - this.x) < 46) {
          if (this.type === 'slider') {
            if (!this.hitOnce.has(tg)) {
              this.hitOnce.add(tg);
              tg.takeDamage(this.dmg, { part: 'kneeF', kx: this.dir * 350, ky: -160, source: 'hazard' });
            }
          } else if (this.tick <= 0) {
            this.tick = this.type === 'spikes' ? 0.5 : 0.35;
            const d = this.type === 'spikes' ? Math.round(this.dps * 0.5) : this.dmg;
            tg.takeDamage(d, { part: 'kneeF', ky: -80, source: 'hazard' });
          }
        }
      }
    }
    draw(ctx) {
      const y = this.plat.topY();
      if (this.type === 'spikes') {
        ctx.fillStyle = '#b9b9b9';
        for (let i = -3; i <= 3; i++) {
          const sx = this.x + i * 9;
          ctx.beginPath();
          ctx.moveTo(sx - 4, y); ctx.lineTo(sx, y - 13); ctx.lineTo(sx + 4, y);
          ctx.closePath(); ctx.fill();
        }
      } else if (this.type === 'saw') {
        ctx.save();
        ctx.translate(this.x, y - 11);
        ctx.rotate(this.t * 14 * this.dir);
        RA.drawArrowShape(ctx, RA.ARROWS.byId.circular, 0);
        ctx.restore();
      } else if (this.type === 'slider') {
        ctx.save();
        ctx.translate(this.x, y - 5);
        ctx.scale(this.dir, 1);
        RA.drawArrowShape(ctx, RA.ARROWS.byId.sliding, 40);
        ctx.restore();
      }
    }
  }
  RA.Hazard = Hazard;

  // ------------------------------------------------------------------
  // Arrow projectile. Swept collision in 3 sub-samples per frame so
  // fast arrows can't tunnel through thin limbs.
  // ------------------------------------------------------------------
  class Arrow {
    constructor(game, o) {
      this.game = game;
      this.x = o.x; this.y = o.y;
      this.sx = o.x; this.sy = o.y; // spawn point (for travel-distance gates)
      this.vx = o.vx; this.vy = o.vy;
      this.def = o.def;
      this.fromPlayer = !!o.fromPlayer;
      this.power = o.power == null ? 1 : o.power;
      this.baseDmg = o.baseDmg; // enemy arrows override the def's damage
      this.noXp = !!o.noXp;     // support-skill projectiles don't feed XP
      this.stunDur = o.stunDur; // per-star stun override (dwarf rogue)
      this.len = o.def.len || 46;
      this.grav = RA.BAL.ARROW_GRAVITY * (o.def.gravityScale == null ? 1 : o.def.gravityScale);
      this.t = 0;
      this.ttl = o.ttl || o.def.ttl || 9;
      this.dead = false;
      this.hitSet = o.def.pierce ? new Set() : null;
    }
    get angle() {
      return this.def.spin ? this.t * this.def.spin : Math.atan2(this.vy, this.vx);
    }
    update(dt) {
      this.t += dt;
      if (this.t > this.ttl) { this.dead = true; return; }
      if (this.def.onTick) this.def.onTick(this.game, this, dt);
      if (this.dead) return;

      const px = this.x, py = this.y;
      this.vy += this.grav * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      const g = this.game;
      // Sample count scales with displacement so the fastest arrows
      // (colt/lewis at a clamped 30fps dt) can't tunnel through limbs.
      const steps = Math.max(3, Math.ceil(Math.hypot(this.x - px, this.y - py) / 10));
      for (let i = 1; i <= steps; i++) {
        const sx = px + (this.x - px) * (i / steps);
        const sy = py + (this.y - py) * (i / steps);

        // Terrain first: a sample already buried in a solid lands the arrow
        // there — it must never clip a body part "through the floor" in the
        // same step.
        for (const r of g.solids()) {
          if (GEO.pointInRect(sx, sy, r)) {
            this.x = sx; this.y = sy;
            this.dead = true;
            if (this.def.onLand) this.def.onLand(g, this, r);
            if (!this.def.noStick) {
              g.groundArrows.push({
                x: sx, y: sy, angle: Math.atan2(this.vy, this.vx),
                defId: this.def.id, len: this.len, ttl: 7,
                fromPlayer: this.fromPlayer,
              });
            }
            return;
          }
        }

        const rr = this.fromPlayer ? 3 * (g.sk ? g.sk.hitSize : 1) : 3;
        for (const tgt of g.targetsFor(this.fromPlayer)) {
          if (this.hitSet && this.hitSet.has(tgt)) continue;
          const hit = tgt.hitTest(sx, sy, rr);
          if (hit) {
            // Floor forgiveness — PLAYER ONLY, by design: a shot skimming
            // the tower floor reads as "stuck in the ground", so let it land
            // instead of clipping a foot (dodged poison arrows used to
            // infect players as they touched down). Shins/feet get a wider
            // band than thighs so low arcs bury themselves. Enemies get no
            // such mercy — the asymmetry favors the player on purpose.
            const shin = hit.zone === 'legF2' || hit.zone === 'legB2';
            if (tgt.isPlayer && hit.zone.indexOf('leg') === 0 && sy > tgt.anchorY - (shin ? 24 : 10)) continue;
            this.x = sx; this.y = sy;
            g.arrowHit(this, tgt, hit, sx, sy);
            if (this.hitSet) this.hitSet.add(tgt);
            if (!this.def.pierce) { this.dead = true; return; }
          }
        }

        if (this.fromPlayer) {
          for (const ap of g.apples) {
            if (!ap.dead && Math.hypot(ap.x - sx, ap.y - sy) < ap.r + 7) g.collectApple(ap);
          }
        }
      }

      if (this.x < -160 || this.x > g.W + 160 || this.y > g.H + 220) this.dead = true;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      RA.drawArrowShape(ctx, this.def, this.len);
      ctx.restore();
    }
  }
  RA.Arrow = Arrow;

  // ------------------------------------------------------------------
  // Archer — the stickman. Alive: procedurally posed with two-bone IK
  // and a spring "wobble" for hit reactions. Dead: hands its pose to
  // a Verlet Ragdoll (physics.js).
  // ------------------------------------------------------------------
  class Archer {
    constructor(game, opts) {
      this.game = game;
      this.isPlayer = !!opts.isPlayer;
      this.facing = opts.facing || 1;
      this.u = opts.scale || 1;
      this.anchorX = opts.anchorX;
      this.anchorY = opts.anchorY;
      this.plat = opts.plat || null;
      this.color = opts.color || '#ececec';
      this.backColor = opts.backColor || null;
      this.giant = !!opts.giant;
      this.boss = opts.boss || null;
      this.bossName = '';

      this.hpMax = opts.hpMax || 100;
      this.hp = this.hpMax;
      this.staMax = opts.staMax || 100;
      this.sta = this.staMax;
      this.staRegen = opts.staRegen || 0;
      this.armorReduce = opts.armorReduce || 0;

      this.alive = true;
      this.invuln = 0;
      this.aim = { active: false, angle: this.facing > 0 ? -0.2 : Math.PI + 0.2, draw: 0 };
      this.wob = { x: 0, y: 0, vx: 0, vy: 0 };
      this.jumpY = 0;
      this.vyJump = 0;
      this.stunT = 0;
      this.flashT = 0;       // white impact flash right after being hit
      this.crouching = false; // holding crouch — low profile, can't shoot
      this.downT = 0;        // > 0: knocked down (player only) — jump to stand up
      this.dots = [];        // [{kind, dps, t, tick}]
      this.stuck = [];       // arrows lodged in the body
      this.hurt = {};        // zone name -> 0..1 accumulated damage tint
      this.pose = null;
      this.computePose();
    }

    get headR() { return 11 * this.u; }

    // Horizontal shove along the platform; enemies can be pushed off.
    // A single shove is capped below the walkable half-width so one hit
    // from a centered stance can never be an automatic edge-fall kill.
    pushAnchor(dx) {
      if (this.plat) {
        const cap = this.plat.half * 0.85;
        dx = GEO.clamp(dx, -cap, cap);
      }
      this.anchorX += dx;
      if (!this.plat) return;
      const min = this.plat.cx - this.plat.half;
      const max = this.plat.cx + this.plat.half;
      if (this.anchorX < min || this.anchorX > max) {
        if (this.isPlayer) {
          this.anchorX = GEO.clamp(this.anchorX, min, max);
        } else if (this.alive) {
          // Shoved off the edge — fatal fall.
          this.takeDamage(99999, { part: 'pelvis', kx: dx * 6, ky: -120, source: 'fall', armorPierce: true });
        }
      }
    }

    jump() {
      if (!this.alive || this.stunT > 0) return false;
      // Knocked down: jumping means standing back up (free).
      if (this.downT > 0) {
        this.downT = 0;
        RA.SND.play('jump');
        return true;
      }
      this.crouching = false; // jumping out of a crouch stands you up
      if (this.jumpY < 0 || this.vyJump !== 0) return false; // vyJump guard: no double-cost from key repeat
      if (this.isPlayer) {
        if (this.sta < RA.BAL.JUMP_COST) {
          this.game.notifyLowStamina();
          return false;
        }
        this.sta -= RA.BAL.JUMP_COST;
      }
      this.vyJump = -RA.BAL.JUMP_VELOCITY * (this.giant ? 0.7 : 1);
      RA.SND.play('jump');
      return true;
    }

    addDot(kind, dps, dur) {
      const existing = this.dots.find((d) => d.kind === kind);
      if (existing) { existing.t = dur; existing.dps = Math.max(existing.dps, dps); }
      else this.dots.push({ kind, dps, t: dur, tick: 0.5 });
    }

    update(dt) {
      if (!this.alive) return;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.stunT > 0) this.stunT -= dt;
      if (this.flashT > 0) this.flashT -= dt;

      // Enemy anchors ride their (possibly bobbing) platform.
      if (this.plat && !this.isPlayer) this.anchorY = this.plat.topY();

      // Damage-over-time ticks
      for (const d of this.dots) {
        d.t -= dt; d.tick -= dt;
        if (d.tick <= 0) {
          d.tick = 0.5;
          const dmg = Math.max(1, Math.round(d.dps * 0.5));
          this.takeDamage(dmg, {
            part: 'torso', source: 'dot', armorPierce: true, silentKnock: true,
            color: d.kind === 'poison' ? '#9dc93b' : '#ff9c3a',
          });
          this.game.fx.spark(this.pose.chest.x, this.pose.chest.y,
            d.kind === 'poison' ? '#9dc93b' : '#ff9c3a', 2, 70);
        }
      }
      this.dots = this.dots.filter((d) => d.t > 0);

      // Stamina regen (player only)
      if (this.isPlayer && this.staRegen) {
        this.sta = Math.min(this.staMax, this.sta + this.staRegen * dt);
      }

      // Jump physics
      if (this.jumpY < 0 || this.vyJump !== 0) {
        this.vyJump += RA.BAL.RAGDOLL_GRAVITY * dt;
        this.jumpY += this.vyJump * dt;
        if (this.jumpY >= 0) { this.jumpY = 0; this.vyJump = 0; }
      }

      // Knockdown recovery timer
      if (this.downT > 0) this.downT -= dt;

      // Final bosses shed aura sparks.
      if (this.boss && this.boss.aura && Math.random() < 5 * dt) {
        this.game.fx.spark(
          this.pose.chest.x + (Math.random() - 0.5) * 44 * this.u,
          this.pose.chest.y + (Math.random() - 0.5) * 54 * this.u,
          this.boss.aura, 1, 90
        );
      }

      // Hit-reaction spring
      const w = this.wob;
      w.vx += (-46 * w.x - 7 * w.vx) * dt;
      w.vy += (-46 * w.y - 7 * w.vy) * dt;
      w.x += w.vx * dt;
      w.y += w.vy * dt;

      this.computePose();
    }

    computePose() {
      if (this.downT > 0) return this.computeDownPose();
      if (this.crouching) return this.computeCrouchPose();
      const u = this.u, f = this.facing;
      const x = this.anchorX, y = this.anchorY + this.jumpY;
      const w = this.wob;

      const pelvis = { x: x + w.x * 0.3, y: y - 46 * u + w.y * 0.3 };
      const chest = { x: pelvis.x + f * 3 * u + w.x * 0.6, y: pelvis.y - 30 * u + w.y * 0.6 };
      const head = { x: chest.x + f * 2 * u + w.x, y: chest.y - 10 * u - this.headR + w.y };

      const footF = { x: x + f * 11 * u, y };
      const footB = { x: x - f * 9 * u, y };
      const kneeF = GEO.ik(pelvis.x, pelvis.y, footF.x, footF.y, 25 * u, 24 * u, -f);
      const kneeB = GEO.ik(pelvis.x, pelvis.y, footB.x, footB.y, 25 * u, 24 * u, -f);

      let a = this.aim.angle;
      const drawing = this.aim.active && this.stunT <= 0;
      if (!drawing) a = f > 0 ? -0.15 : Math.PI + 0.15;
      const reach = 36 * u;
      const armUp = 21 * u, armLo = 20 * u;
      const handF = { x: chest.x + Math.cos(a) * reach, y: chest.y + Math.sin(a) * reach };
      const elbowF = GEO.ik(chest.x, chest.y, handF.x, handF.y, armUp, armLo, f);
      const pull = drawing ? this.aim.draw : 0;
      const handB = {
        x: handF.x - Math.cos(a) * (6 + 30 * pull) * u,
        y: handF.y - Math.sin(a) * (6 + 30 * pull) * u,
      };
      const elbowB = GEO.ik(chest.x, chest.y, handB.x, handB.y, armUp, armLo, f);

      this.pose = { head, chest, pelvis, elbowF, handF, elbowB, handB, kneeF, footF, kneeB, footB };
      return this.pose;
    }

    // Ducked low behind the parapet — a small target while held.
    computeCrouchPose() {
      const u = this.u, f = this.facing;
      const x = this.anchorX, y = this.anchorY;
      const w = this.wob;
      const pelvis = { x: x - f * 4 * u + w.x * 0.3, y: y - 22 * u };
      const chest = { x: pelvis.x + f * 8 * u + w.x * 0.6, y: pelvis.y - 16 * u + w.y * 0.5 };
      const head = { x: chest.x + f * 6 * u + w.x, y: chest.y - 8 * u - this.headR };
      const P = {
        pelvis, chest, head,
        footF: { x: x + f * 14 * u, y },
        footB: { x: x - f * 10 * u, y },
        kneeF: { x: x + f * 18 * u, y: y - 12 * u },
        kneeB: { x: x - f * 2 * u, y: y - 12 * u },
        elbowF: { x: chest.x + f * 6 * u, y: chest.y + 10 * u },
        handF: { x: chest.x + f * 14 * u, y: chest.y + 4 * u },
        elbowB: { x: chest.x - f * 6 * u, y: chest.y + 10 * u },
        handB: { x: chest.x - f * 2 * u, y: chest.y + 6 * u },
      };
      this.pose = P;
      return P;
    }

    // Sprawled on the ground after a heavy hit (design doc: "STAND UP").
    computeDownPose() {
      const u = this.u, f = this.facing;
      const x = this.anchorX, y = this.anchorY;
      const w = this.wob;
      const P = {
        pelvis: { x: x + w.x * 0.3, y: y - 10 * u },
        chest:  { x: x - f * 24 * u + w.x * 0.6, y: y - 13 * u + w.y * 0.4 },
        head:   { x: x - f * 42 * u + w.x, y: y - 13 * u + w.y * 0.6 },
        kneeF:  { x: x + f * 14 * u, y: y - 20 * u },
        footF:  { x: x + f * 30 * u, y: y - 4 * u },
        kneeB:  { x: x + f * 10 * u, y: y - 15 * u },
        footB:  { x: x + f * 26 * u, y: y - 2 * u },
        elbowF: { x: x - f * 8 * u, y: y - 24 * u },
        handF:  { x: x + f * 6 * u, y: y - 28 * u },
        elbowB: { x: x - f * 18 * u, y: y - 6 * u },
        handB:  { x: x - f * 4 * u, y: y - 4 * u },
      };
      this.pose = P;
      return P;
    }

    // Point-vs-body test. rr widens the test (projectile radius).
    hitTest(px, py, rr) {
      if (!this.alive || !this.pose) return null;
      const P = this.pose;
      const dh = Math.hypot(px - P.head.x, py - P.head.y);
      if (dh < this.headR + rr) {
        return { part: 'head', a: 'head', b: 'chest', t: 0.12, mult: RA.BAL.HEADSHOT_MULT, isHead: true, zone: 'head' };
      }
      for (const b of RA.BONES) {
        const pa = P[b.a], pb = P[b.b];
        const res = GEO.segPoint(pa.x, pa.y, pb.x, pb.y, px, py);
        const th = b.th * this.u + rr;
        if (res.d2 < th * th) {
          // The neck counts as part of the head: crits land generously on
          // the whole head area, so near-misses under the chin still feel
          // like the sharpshooter shot the player lined up.
          if (b.name === 'neck') {
            return { part: 'head', a: b.a, b: b.b, t: res.t, mult: RA.BAL.HEADSHOT_MULT, isHead: true, zone: 'head' };
          }
          return { part: b.a, a: b.a, b: b.b, t: res.t, mult: b.mult, isHead: false, zone: b.name };
        }
      }
      return null;
    }

    takeDamage(raw, info) {
      info = info || {};
      if (!this.alive) return 0;
      if (this.isPlayer && this.invuln > 0) return 0;

      let dmg = raw;
      if (!info.armorPierce && this.armorReduce > 0) dmg *= 1 - this.armorReduce;
      if (this.isPlayer && this.game.sk) dmg *= this.game.sk.dmgTaken; // The Uniform
      dmg = Math.max(1, Math.round(dmg));
      this.hp -= dmg;

      // Persistent per-part wound tint (design doc: hit parts turn red).
      if (info.zone) this.hurt[info.zone] = Math.min(1, (this.hurt[info.zone] || 0) + 0.45);

      if (!info.silentKnock) {
        this.wob.vx += (info.kx || 0) * 0.06;
        this.wob.vy += (info.ky || 0) * 0.06;
      }
      if (info.shift) this.pushAnchor(info.shift);

      if (this.alive) { // pushAnchor may already have killed us via fall
        const P = this.pose;
        const gore = RA.SAVE.data.settings.gore;
        if (info.source !== 'dot') this.flashT = 0.09;
        if (this.isPlayer && info.source !== 'dot') {
          this.game.fx.shake(7);
          RA.UI && RA.UI.damageFlash();
        }
        if (info.source !== 'dot' && gore === 'full') {
          this.game.fx.blood(P.chest.x, P.chest.y, info.kx, info.ky);
        }
        if (info.source !== 'fall') { // no '-99999' popup on edge-fall kills
          this.game.fx.text(
            P.head.x, P.head.y - this.headR - 14,
            '-' + dmg,
            info.color || (info.isHead ? '#ffd23e' : this.isPlayer ? '#ff6b5e' : '#ffffff'),
            info.isHead ? 22 : 16
          );
        }
        // Heavy hits floor the player (stand up with JUMP).
        if (this.isPlayer && this.hp > 0 && dmg >= RA.BAL.KNOCKDOWN_DMG && info.source !== 'dot') {
          this.downT = RA.BAL.KNOCKDOWN_TIME;
          this.aim.active = false;
          this.aim.draw = 0;
          this.game.aimP = null;
        }
        if (this.hp <= 0) this.die(info);
        else if (info.source === 'arrow') RA.SND.play(this.isPlayer ? 'hurt' : info.isHead ? 'headshot' : 'hit');
      }
      return dmg;
    }

    heal(n) {
      if (!this.alive || n <= 0) return;
      this.hp = Math.min(this.hpMax, this.hp + n);
      this.game.fx.text(this.pose.head.x, this.pose.head.y - 26, '+' + Math.round(n), '#7dc93b', 16);
    }
    addStamina(n) {
      if (!this.alive || n <= 0) return;
      this.sta = Math.min(this.staMax, this.sta + n);
      this.game.fx.text(this.pose.head.x + 22, this.pose.head.y - 14, '+' + Math.round(n), '#4f8fd0', 14);
    }

    die(info) {
      if (!this.alive) return;
      this.alive = false;
      this.aim.active = false;
      const corpse = new RA.Ragdoll(this.pose, this.u, {
        vx: (info.kx || 0) * 1.6,
        vy: (info.ky || 0) * 1.6 - 140,
        hit: { part: info.part || 'chest', ix: (info.kx || 0) * 3, iy: (info.ky || 0) * 3 },
        color: this.color,
        backColor: this.backColor,
        headR: this.headR,
        stuck: this.stuck,
        hurt: this.hurt,
      });
      this.game.corpses.push(corpse);
      RA.SND.play('death');
      if (this.onDeath) this.onDeath(this, info);
    }

    draw(ctx) {
      if (!this.alive) return;
      const P = this.pose;
      const flash = this.isPlayer && this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0;
      if (flash) ctx.globalAlpha = 0.35;

      const gore = RA.SAVE.data.settings.gore;
      // Final bosses radiate a pulsing aura behind everything else.
      if (this.boss && this.boss.aura) {
        const pulse = 0.14 + 0.06 * Math.sin(this.game.time * 5);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = this.boss.aura;
        ctx.beginPath();
        ctx.arc(P.chest.x, P.chest.y, 62 * this.u, 0, 7);
        ctx.fill();
        ctx.globalAlpha = pulse * 1.6;
        ctx.beginPath();
        ctx.arc(P.chest.x, P.chest.y, 40 * this.u, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Boss accents drawn behind the body (wings) …
      if (this.boss && this.boss.accent === 'wings') {
        const flap = Math.sin(this.game.time * 10) * 0.25;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.translate(P.chest.x, P.chest.y - 4 * this.u);
          ctx.scale(s, 1); // mirror the wing cleanly to both sides
          ctx.rotate(-0.5 + flap);
          ctx.beginPath();
          ctx.ellipse(15 * this.u, -7 * this.u, 15 * this.u, 6 * this.u, 0.45, 0, 7);
          ctx.fill();
          ctx.restore();
        }
      }
      const flashing = this.flashT > 0;
      RA.drawBody(ctx, P, this.u, {
        color: flashing ? '#ffffff' : this.color,
        backColor: flashing ? '#ffffff' : (this.backColor || undefined),
        headR: this.headR,
        stunned: this.stunT > 0,
        stunPhase: this.game.time,
        hurt: flashing || gore === 'off' ? null : this.hurt,
      });
      // … and in front of it (halo, helmet).
      if (this.boss && this.boss.accent === 'halo') {
        ctx.strokeStyle = '#ffd23e';
        ctx.lineWidth = 3 * this.u;
        ctx.beginPath();
        ctx.ellipse(P.head.x, P.head.y - this.headR - 8 * this.u, 10 * this.u, 3.6 * this.u, 0, 0, 7);
        ctx.stroke();
      } else if (this.boss && this.boss.accent === 'helmet') {
        const ha = Math.atan2(P.chest.x - P.head.x, P.head.y - P.chest.y); // tilt with the neck
        ctx.save();
        ctx.translate(P.head.x, P.head.y);
        ctx.rotate(ha);
        ctx.fillStyle = '#4a5462';
        ctx.beginPath();
        ctx.arc(0, 0, this.headR + 1.5, Math.PI * 0.95, Math.PI * 2.05);
        ctx.fill();
        ctx.fillRect(-this.headR - 1.5, -3 * this.u, 3.5 * this.u, this.headR * 0.9); // nose guard
        ctx.fillStyle = '#e0453c';
        ctx.fillRect(-2 * this.u, -this.headR - 6 * this.u, 4 * this.u, 6 * this.u); // crest
        ctx.restore();
      }

      // Bow — anchored at the front hand, oriented along the aim.
      const drawing = this.aim.active && this.stunT <= 0 && this.downT <= 0 && !this.crouching;
      const a = drawing ? this.aim.angle : (this.facing > 0 ? -0.15 : Math.PI + 0.15);
      const u = this.u;
      ctx.save();
      ctx.translate(P.handF.x, P.handF.y);
      ctx.rotate(a);
      ctx.strokeStyle = '#f0a63c';
      ctx.lineWidth = 4.2 * u;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * u, -1.15, 1.15);
      ctx.stroke();
      // string
      const tipX = Math.cos(1.15) * 26 * u, tipY = Math.sin(1.15) * 26 * u;
      const dx = P.handB.x - P.handF.x, dy = P.handB.y - P.handF.y;
      const nockX = dx * Math.cos(-a) - dy * Math.sin(-a);
      const nockY = dx * Math.sin(-a) + dy * Math.cos(-a);
      ctx.strokeStyle = '#e8e2d4';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tipX, -tipY);
      ctx.lineTo(drawing ? nockX : tipX, drawing ? nockY : 0);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      // nocked arrow
      if (drawing && this.aim.draw > 0.02) {
        const def = this.currentDef || RA.ARROWS.byId.default;
        ctx.save();
        ctx.translate(nockX + Math.cos(0) * 40 * u, nockY);
        ctx.scale(u, u);
        RA.drawArrowShape(ctx, def, 40);
        ctx.restore();
      }
      ctx.restore();

      // Arrows stuck in the body follow their bone.
      for (const s of this.stuck) {
        const pa = P[s.a], pb = P[s.b];
        if (!pa || !pb) continue;
        const x = GEO.lerp(pa.x, pb.x, s.t);
        const y = GEO.lerp(pa.y, pb.y, s.t);
        const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x) + s.rel;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        RA.drawArrowShape(ctx, RA.ARROWS.byId[s.defId], s.len);
        ctx.restore();
      }

      // Enemy HP bar (+ boss name)
      if (!this.isPlayer) {
        const bw = 64 * this.u;
        const bx = P.head.x - bw / 2;
        const by = P.head.y - this.headR - 22 * this.u;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(bx, by, bw, 7);
        ctx.fillStyle = '#e0453c';
        ctx.fillRect(bx, by, bw * GEO.clamp(this.hp / this.hpMax, 0, 1), 7);
        if (this.bossName) {
          ctx.font = '900 ' + Math.round(11 + 4 * this.u) + 'px "Arial Black", Impact, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = this.boss ? this.boss.color : '#ffd23e';
          ctx.fillText(this.bossName, P.head.x, by - 7);
        }
      }
      ctx.globalAlpha = 1;
    }
  }
  RA.Archer = Archer;
})();
