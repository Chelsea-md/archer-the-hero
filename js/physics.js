// ============================================================
// physics.js — Geometry helpers, the shared stickman renderer,
// and the Verlet ragdoll used for corpses.
//
// Living archers are posed procedurally (see entities.js); only
// when an archer dies do we hand its pose to a Ragdoll, which
// simulates it with Verlet integration + distance constraints.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});

  const GEO = (RA.GEO = {
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },

    // Closest point on segment AB to P. Returns {t, cx, cy, d2}.
    segPoint(ax, ay, bx, by, px, py) {
      const abx = bx - ax, aby = by - ay;
      const l2 = abx * abx + aby * aby || 1e-6;
      let t = ((px - ax) * abx + (py - ay) * aby) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + abx * t, cy = ay + aby * t;
      const dx = px - cx, dy = py - cy;
      return { t, cx, cy, d2: dx * dx + dy * dy };
    },

    // Two-bone IK: joint position between A and target B.
    // bend (+1/-1) picks which side the joint folds toward.
    ik(ax, ay, bx, by, l1, l2, bend) {
      const dx = bx - ax, dy = by - ay;
      let d = Math.hypot(dx, dy) || 0.0001;
      const dc = GEO.clamp(d, Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
      const cos = GEO.clamp((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc), -1, 1);
      const a = Math.acos(cos);
      const base = Math.atan2(dy, dx);
      const ang = base + bend * a;
      return { x: ax + Math.cos(ang) * l1, y: ay + Math.sin(ang) * l1 };
    },

    pointInRect(px, py, r) {
      return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
    },
  });

  // ------------------------------------------------------------------
  // Shared stickman renderer. P is a map of named joints:
  // head, chest, pelvis, elbowF, handF, elbowB, handB,
  // kneeF, footF, kneeB, footB.
  // o.hurt: optional map of zone name -> 0..1 damage tint intensity
  // (zones match RA.BONES names + 'head'); injured parts blush red.
  // ------------------------------------------------------------------
  const HURT_RGB = [242, 96, 96];
  function hexRgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  function mixHurt(baseHex, t) {
    if (!t) return baseHex;
    const b = hexRgb(baseHex);
    const r = Math.round(GEO.lerp(b[0], HURT_RGB[0], t));
    const g = Math.round(GEO.lerp(b[1], HURT_RGB[1], t));
    const bl = Math.round(GEO.lerp(b[2], HURT_RGB[2], t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  RA.drawBody = function (ctx, P, u, o) {
    o = o || {};
    const c = o.color || '#ececec';
    const back = o.backColor || '#c2c2c2';
    const hurt = o.hurt || {};
    const lw = 6.5 * u;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const seg = (a, b, w, zone, baseCol) => {
      ctx.strokeStyle = mixHurt(baseCol, hurt[zone] || 0);
      ctx.beginPath();
      ctx.moveTo(P[a].x, P[a].y);
      ctx.lineTo(P[b].x, P[b].y);
      ctx.lineWidth = w;
      ctx.stroke();
    };
    // Far-side limbs first (slightly darker for depth)
    seg('chest', 'elbowB', lw, 'armB', back); seg('elbowB', 'handB', lw * 0.9, 'armB2', back);
    seg('pelvis', 'kneeB', lw, 'legB', back); seg('kneeB', 'footB', lw * 0.9, 'legB2', back);
    // Torso + near limbs
    seg('chest', 'pelvis', lw * 1.55, 'torso', c);
    seg('pelvis', 'kneeF', lw, 'legF', c); seg('kneeF', 'footF', lw * 0.9, 'legF2', c);
    seg('chest', 'elbowF', lw, 'armF', c); seg('elbowF', 'handF', lw * 0.9, 'armF2', c);
    // Head
    const hr = o.headR || 11 * u;
    ctx.fillStyle = mixHurt(c, hurt.head || 0);
    ctx.beginPath();
    ctx.arc(P.head.x, P.head.y, hr, 0, 7);
    ctx.fill();
    if (o.stunned) {
      // little dizzy stars
      ctx.fillStyle = '#ffd23e';
      for (let i = 0; i < 3; i++) {
        const a = (o.stunPhase || 0) * 4 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(P.head.x + Math.cos(a) * hr * 1.7, P.head.y - hr - 4 + Math.sin(a) * 4, 2.2, 0, 7);
        ctx.fill();
      }
    }
  };

  // Bone pairs used for hit-testing and for pinning stuck arrows.
  // (balance.js loads first, so RA.BAL is available here.)
  const LIMB = RA.BAL.LIMB_MULT;
  RA.BONES = [
    { a: 'head',   b: 'chest',  th: 6,   mult: 1,    name: 'neck'  },
    { a: 'chest',  b: 'pelvis', th: 9,   mult: 1,    name: 'torso' },
    { a: 'chest',  b: 'elbowF', th: 5.5, mult: LIMB, name: 'armF'  },
    { a: 'elbowF', b: 'handF',  th: 5,   mult: LIMB, name: 'armF2' },
    { a: 'chest',  b: 'elbowB', th: 5.5, mult: LIMB, name: 'armB'  },
    { a: 'elbowB', b: 'handB',  th: 5,   mult: LIMB, name: 'armB2' },
    { a: 'pelvis', b: 'kneeF',  th: 5.5, mult: LIMB, name: 'legF'  },
    { a: 'kneeF',  b: 'footF',  th: 5,   mult: LIMB, name: 'legF2' },
    { a: 'pelvis', b: 'kneeB',  th: 5.5, mult: LIMB, name: 'legB'  },
    { a: 'kneeB',  b: 'footB',  th: 5,   mult: LIMB, name: 'legB2' },
  ];

  // ------------------------------------------------------------------
  // Verlet ragdoll (corpse).
  // ------------------------------------------------------------------
  class Ragdoll {
    /**
     * pose: map name -> {x, y} (taken from the archer's last live pose)
     * u: limb scale, opts: {vx, vy, hit: {part, ix, iy}, color, headR, stuck}
     */
    constructor(pose, u, opts) {
      opts = opts || {};
      this.u = u;
      this.color = opts.color || '#ececec';
      this.backColor = opts.backColor || null;
      this.headR = opts.headR || 11 * u;
      this.stuck = opts.stuck || []; // arrows lodged in the body
      this.hurt = opts.hurt || null; // per-part damage tint carried from life
      this.t = 0;
      this.dead = false;

      const vx = (opts.vx || 0) / 60, vy = (opts.vy || 0) / 60;
      this.parts = {};
      this.list = [];
      for (const k in pose) {
        const p = { x: pose[k].x, y: pose[k].y, px: pose[k].x - vx, py: pose[k].y - vy };
        this.parts[k] = p;
        this.list.push(p);
      }
      if (opts.hit && this.parts[opts.hit.part]) {
        const p = this.parts[opts.hit.part];
        p.px -= (opts.hit.ix || 0) / 60;
        p.py -= (opts.hit.iy || 0) / 60;
      }

      const S = (a, b, st) => {
        const pa = this.parts[a], pb = this.parts[b];
        return { a: pa, b: pb, len: GEO.dist(pa.x, pa.y, pb.x, pb.y), st: st == null ? 1 : st };
      };
      this.sticks = [
        S('head', 'chest'), S('chest', 'pelvis'),
        S('chest', 'elbowF'), S('elbowF', 'handF'),
        S('chest', 'elbowB'), S('elbowB', 'handB'),
        S('pelvis', 'kneeF'), S('kneeF', 'footF'),
        S('pelvis', 'kneeB'), S('kneeB', 'footB'),
        S('head', 'pelvis', 0.06), // soft brace: keeps the spine from folding flat
      ];
    }

    step(dt, solids, W, H) {
      this.t += dt;
      const g = RA.BAL.RAGDOLL_GRAVITY;
      for (const p of this.list) {
        const nvx = (p.x - p.px) * 0.985;
        const nvy = (p.y - p.py) * 0.985;
        p.px = p.x; p.py = p.y;
        p.x += nvx;
        p.y += nvy + g * dt * dt;
      }
      for (let it = 0; it < 5; it++) {
        for (const s of this.sticks) {
          const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
          const d = Math.hypot(dx, dy) || 1e-6;
          const diff = ((d - s.len) / d) * 0.5 * s.st;
          s.a.x += dx * diff; s.a.y += dy * diff;
          s.b.x -= dx * diff; s.b.y -= dy * diff;
        }
        // Collide with solid rectangles (tower + platforms)
        for (const p of this.list) {
          for (const r of solids) {
            if (GEO.pointInRect(p.x, p.y, r)) {
              const dl = p.x - r.x, dr = r.x + r.w - p.x;
              const dtp = p.y - r.y, db = r.y + r.h - p.y;
              const m = Math.min(dl, dr, dtp, db);
              if (m === dtp) {
                p.y = r.y;
                p.px = p.x - (p.x - p.px) * 0.4; // ground friction
              } else if (m === dl) p.x = r.x;
              else if (m === dr) p.x = r.x + r.w;
              else p.y = r.y + r.h;
            }
          }
        }
      }
      // Cull when fallen far below the screen or after fading out.
      if (this.list[0].y > H + 400 || this.t > 6) this.dead = true;
    }

    draw(ctx) {
      const fade = this.t > 4.8 ? Math.max(0, 1 - (this.t - 4.8) / 1.2) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      const gore = RA.SAVE.data.settings.gore;
      RA.drawBody(ctx, this.parts, this.u, {
        color: this.color, backColor: this.backColor || undefined, headR: this.headR,
        hurt: gore !== 'off' ? this.hurt : null,
      });
      // Arrows still lodged in the corpse follow their bone.
      for (const s of this.stuck) {
        const pa = this.parts[s.a], pb = this.parts[s.b];
        if (!pa || !pb) continue;
        const x = GEO.lerp(pa.x, pb.x, s.t);
        const y = GEO.lerp(pa.y, pb.y, s.t);
        const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x) + s.rel;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        RA.drawArrowShape(ctx, RA.ARROWS.byId[s.defId], s.len || 40);
        ctx.restore();
      }
      ctx.restore();
    }
  }
  RA.Ragdoll = Ragdoll;
})();
