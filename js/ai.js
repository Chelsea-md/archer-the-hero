// ============================================================
// ai.js — Enemy archer brain. Solves the real ballistic arc to
// the player, with aim noise that shrinks as the score climbs.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});

  class Brain {
    constructor(game, archer) {
      this.game = game;
      this.a = archer;
      this.state = 'wait';
      this.timer = 1.2 + Math.random() * 0.8; // grace period after spawning
      this.targetDraw = 0.75 + Math.random() * 0.25;
      this.drawSpeed = 1 / 0.85; // enemies reach full draw in ~0.85s
      this.angle = Math.PI;
      this.pickArrow();
    }

    pickArrow() {
      const s = this.game.score;
      const byId = RA.ARROWS.byId;
      // Bosses shoot their signature arrow (defined in BAL.MID_BOSSES / FINAL_BOSSES).
      if (this.a.boss) { this.def = byId[this.a.boss.arrow] || byId.default; return; }
      let def = byId.default;
      const r = Math.random();
      if (s >= 12 && r < 0.2) def = byId.fire;
      else if (s >= 6 && r < 0.4) def = byId.poison;
      this.def = def;
    }

    update(dt) {
      const a = this.a;
      if (!a.alive) return;
      const player = this.game.player;
      if (!player || !player.alive) { a.aim.active = false; return; }
      if (a.stunT > 0) {
        a.aim.active = false;
        a.aim.draw = 0;
        this.state = 'wait';
        this.timer = Math.max(this.timer, 0.5);
        return;
      }

      if (this.state === 'wait') {
        this.timer -= dt;
        // Occasionally hop to dodge incoming arrows (fairies flit constantly).
        const hopRate = a.boss && a.boss.jumpy ? 0.9 : 0.25;
        if (a.jumpY === 0 && Math.random() < hopRate * dt) a.jump();
        if (this.timer <= 0) {
          this.state = 'draw';
          a.aim.active = true;
          a.aim.draw = 0;
          this.solve();
        }
      } else if (this.state === 'draw') {
        a.aim.draw = Math.min(1, a.aim.draw + this.drawSpeed * dt);
        this.solve(); // keep tracking a moving/jumping player
        a.aim.angle = this.angle;
        if (a.aim.draw >= this.targetDraw) this.fire();
      }
    }

    // Low-arc ballistic solution with score-scaled noise.
    solve() {
      const g = this.game, a = this.a, p = g.player;
      const src = a.pose.handF;
      const tgt = p.pose.chest;
      const def = this.def;
      const B = RA.BAL;
      const base = B.ARROW_SPEED * (def.speedScale || 1) *
        (1 - B.WEIGHT_SPEED_PENALTY * (def.stats[2] - 1));
      const grav = B.ARROW_GRAVITY * (def.gravityScale == null ? 1 : def.gravityScale) || 1;

      const dx = tgt.x - src.x;
      const R = Math.max(20, Math.abs(dx));
      const h = src.y - tgt.y; // height of target above source (screen y is down)
      let v = base * (0.45 + 0.55 * this.targetDraw);
      let disc = v * v * v * v - grav * (grav * R * R + 2 * h * v * v);
      if (disc <= 0 && this.targetDraw < 1) {
        // Out of range at the lazy draw — commit to a full draw and re-solve.
        this.targetDraw = 1;
        v = base;
        disc = v * v * v * v - grav * (grav * R * R + 2 * h * v * v);
      }
      let phi;
      if (disc <= 0) phi = 0.7; // still out of range — lob it high and hope
      else phi = Math.atan((v * v - Math.sqrt(disc)) / (grav * R));
      phi += (Math.random() - 0.5) * 2 * B.enemyAimError(g.score);

      const sign = Math.sign(dx) || -1;
      const vx = Math.cos(phi) * v * sign;
      const vy = -Math.sin(phi) * v;
      this.angle = Math.atan2(vy, vx);
    }

    fire() {
      const a = this.a;
      a.aim.angle = this.angle;
      this.game.fire(a, this.angle, a.aim.draw);
      a.aim.active = false;
      a.aim.draw = 0;
      this.state = 'wait';
      this.timer = RA.BAL.enemyFireDelay(this.game.score) *
        (a.boss ? a.boss.fireMult : 1) *
        (0.8 + Math.random() * 0.5);
      this.targetDraw = 0.75 + Math.random() * 0.25;
      this.pickArrow();
    }
  }
  RA.Brain = Brain;
})();
