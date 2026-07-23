// ============================================================
// arrows.js — Data-driven ammunition system.
//
// Every arrow is a plain definition object. Behavior is expressed
// through optional hooks the engine calls:
//   onFire(game, shooter, shot) -> true if it handled spawning itself
//   onHit(game, arrow, target, res)   (res = {dmg, part})
//   onTick(game, arrow, dt)
//   onLand(game, arrow, solid)
// plus declarative flags (dot, stun, pierce, noStick, gravityScale…).
// Unlock costs mirror the design document.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});

  // ---------------------------------------------------------------
  // Renderer: arrow drawn with its TIP at the origin, pointing +x.
  // ---------------------------------------------------------------
  RA.drawArrowShape = function (ctx, def, len) {
    if (!def) return;
    len = len || def.len || 46;
    const shaft = def.shaft || '#e8e2d4';
    const tip = def.tipColor || '#f5f5f5';
    const fletch = def.fletch || '#d8d2c4';
    const icon = def.icon || 'arrow';
    ctx.lineCap = 'round';

    // Self-contained shapes (no shaft)
    if (icon === 'bird') {
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-8, -6, 7, 3.5, -0.6, 0, 7); ctx.fill(); // wing
      ctx.fillStyle = '#f0a63c';
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(17, -2); ctx.lineTo(11, 3); ctx.closePath(); ctx.fill(); // beak
      ctx.fillStyle = '#2e2e2e';
      ctx.beginPath(); ctx.arc(6, -2, 1.4, 0, 7); ctx.fill(); // eye
      return;
    }
    if (icon === 'poop') {
      ctx.fillStyle = '#8a6a4a';
      ctx.beginPath(); ctx.arc(0, 2, 6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(-2, -3, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(1, -7, 2.5, 0, 7); ctx.fill();
      return;
    }
    if (icon === 'hand') {
      ctx.fillStyle = '#cfe0f2';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, 7); ctx.fill(); // palm
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#cfe0f2'; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        const fa = -0.6 + i * 0.4;
        ctx.beginPath(); ctx.moveTo(6, 0);
        ctx.lineTo(6 + Math.cos(fa) * 10, Math.sin(fa) * 10); ctx.stroke(); // fingers
      }
      return;
    }
    if (icon === 'shuriken') {
      ctx.fillStyle = tip;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 4 : 12;
        const a = (i * Math.PI) / 4;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      return;
    }
    if (icon === 'saw') {
      ctx.fillStyle = tip;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 ? 8 : 13;
        const a = (i * Math.PI) / 8;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a8a8a';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
      return;
    }

    // Shaft + fletching common to the rest
    ctx.strokeStyle = shaft;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-4, 0); ctx.stroke();
    ctx.strokeStyle = fletch;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) {
      const fx = -len + 5 + i * 6;
      ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx - 5, -5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx - 5, 5); ctx.stroke();
    }

    ctx.fillStyle = tip;
    switch (icon) {
      case 'ball': // mace / balls
        ctx.beginPath(); ctx.arc(-2, 0, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#555';
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.arc(-2 + Math.cos(a) * 9, Math.sin(a) * 9, 1.8, 0, 7);
          ctx.fill();
        }
        break;
      case 'axe':
        ctx.beginPath();
        ctx.moveTo(-4, -11); ctx.quadraticCurveTo(9, 0, -4, 11);
        ctx.quadraticCurveTo(1, 0, -4, -11);
        ctx.fill();
        break;
      case 'tnt':
        ctx.fillStyle = '#e0453c';
        ctx.fillRect(-18, -6, 15, 12);
        ctx.fillStyle = '#2e2e2e';
        ctx.fillRect(-12, -6, 2.5, 12);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
        ctx.fillStyle = tip; ctx.fill();
        break;
      case 'balloon':
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = def.shaft2 || '#e0b98a';
        ctx.beginPath(); ctx.ellipse(-len * 0.45, -10, 9, 11, 0, 0, 7); ctx.fill();
        break;
      case 'sword':
        ctx.beginPath();
        ctx.moveTo(2, 0); ctx.lineTo(-26, -5); ctx.lineTo(-26, 5); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#9a7b4f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-26, -8); ctx.lineTo(-26, 8); ctx.stroke();
        break;
      case 'bullet':
        ctx.beginPath();
        ctx.moveTo(2, 0); ctx.lineTo(-4, -3.5); ctx.lineTo(-10, -3.5);
        ctx.lineTo(-10, 3.5); ctx.lineTo(-4, 3.5); ctx.closePath();
        ctx.fill();
        break;
      case 'rocket':
        ctx.fillStyle = def.body || '#4f8fd0';
        ctx.fillRect(-20, -5, 18, 10);
        ctx.fillStyle = tip;
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e0453c';
        ctx.beginPath(); ctx.moveTo(-20, -5); ctx.lineTo(-26, -8); ctx.lineTo(-20, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-20, 5); ctx.lineTo(-26, 8); ctx.lineTo(-20, 0); ctx.closePath(); ctx.fill();
        break;
      case 'hook':
        ctx.strokeStyle = tip; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(-3, -5, 7, Math.PI * 0.2, Math.PI * 1.5); ctx.stroke();
        break;
      case 'sai':
        ctx.strokeStyle = tip; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-14, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, -7); ctx.quadraticCurveTo(-4, -6, -2, -1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, 7); ctx.quadraticCurveTo(-4, 6, -2, 1); ctx.stroke();
        break;
      case 'magnet':
        ctx.strokeStyle = '#e0453c'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(-6, 0, 7, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        ctx.fillStyle = '#4f8fd0';
        ctx.fillRect(-8, -9, 4, 4); ctx.fillRect(-8, 5, 4, 4);
        break;
      case 'trap':
        ctx.fillStyle = tip;
        for (let i = 0; i < 4; i++) {
          const tx = -16 + i * 5;
          ctx.beginPath(); ctx.moveTo(tx, 2); ctx.lineTo(tx + 2.5, -7); ctx.lineTo(tx + 5, 2); ctx.closePath(); ctx.fill();
        }
        break;
      case 'laser':
        ctx.fillStyle = '#8a8a8a'; ctx.fillRect(-14, -4, 12, 8);
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
        break;
      case 'cracker':
        ctx.fillStyle = '#e0453c';
        for (let i = 0; i < 6; i++) ctx.fillRect(-24 + i * 3.4, -5, 2.6, 10);
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
        ctx.fillStyle = '#f0c040'; ctx.fill();
        break;
      case 'corsair':
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-20, -5, 16, 10);
        ctx.fillStyle = '#f0c040';
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
        break;
      case 'firework':
        ctx.fillStyle = '#e0453c'; ctx.fillRect(-22, -6, 20, 12);
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-2, -6); ctx.lineTo(-2, 6); ctx.closePath(); ctx.fill();
        break;
      case 'sparkler':
        ctx.fillStyle = '#ff7bac';
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 1.8, 0, 7); ctx.fill();
        }
        break;
      default: // plain arrowhead
        ctx.beginPath();
        ctx.moveTo(2, 0); ctx.lineTo(-9, -5); ctx.lineTo(-9, 5); ctx.closePath();
        ctx.fill();
    }
  };

  // ---------------------------------------------------------------
  // Shared behavior helpers
  // ---------------------------------------------------------------
  function burstFire(count, interval, jitter) {
    return function (game, shooter, shot) {
      for (let i = 0; i < count; i++) {
        game.schedule(i * interval, () => {
          if (!shooter.alive) return;
          const a = shot.angle + (Math.random() - 0.5) * jitter;
          game.spawnArrow({
            x: shot.x, y: shot.y,
            vx: Math.cos(a) * shot.speed, vy: Math.sin(a) * shot.speed,
            def: shot.def, fromPlayer: shot.fromPlayer, power: shot.power,
            baseDmg: shot.baseDmg,
          });
          if (i > 0) RA.SND.play('shoot');
        });
      }
      return true;
    };
  }

  function spreadFire(count, spread) {
    return function (game, shooter, shot) {
      for (let i = 0; i < count; i++) {
        const a = shot.angle + (i - (count - 1) / 2) * spread;
        game.spawnArrow({
          x: shot.x, y: shot.y,
          vx: Math.cos(a) * shot.speed, vy: Math.sin(a) * shot.speed,
          def: shot.def, fromPlayer: shot.fromPlayer, power: shot.power,
          baseDmg: shot.baseDmg,
        });
      }
      return true;
    };
  }

  function homingTick(turnRate) {
    return function (game, arrow, dt) {
      if (arrow.t < 0.12) return;
      const targets = game.targetsFor(arrow.fromPlayer);
      if (!targets.length) return;
      const t = targets[0];
      const aim = t.pose ? t.pose.chest : { x: t.anchorX, y: t.anchorY - 60 };
      const cur = Math.atan2(arrow.vy, arrow.vx);
      const want = Math.atan2(aim.y - arrow.y, aim.x - arrow.x);
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const step = RA.GEO.clamp(diff, -turnRate * dt, turnRate * dt);
      const sp = Math.hypot(arrow.vx, arrow.vy);
      const na = cur + step;
      arrow.vx = Math.cos(na) * sp;
      arrow.vy = Math.sin(na) * sp;
    };
  }

  // ---------------------------------------------------------------
  // The catalog. Order matches the design document's shop list.
  // stats: [damage, stamina, weight] each 1..5 (shop dots display)
  // ---------------------------------------------------------------
  const DEFS = [
    { id: 'default', cost: 0, dmg: 22, stats: [2, 1, 1], icon: 'arrow' },

    { id: 'poison', cost: 10, dmg: 12, stats: [1, 1, 1], icon: 'arrow',
      tipColor: '#9dc93b', fletch: '#b6d95c', dot: { kind: 'poison', dps: 5, dur: 6 } },

    { id: 'electro', cost: 20, dmg: 12, stats: [1, 2, 1], icon: 'arrow',
      tipColor: '#ffd23e', fletch: '#f5e08a', stun: 1.6 },

    { id: 'fire', cost: 30, dmg: 16, stats: [2, 2, 1], icon: 'arrow',
      tipColor: '#ffffff', fletch: '#f0a63c', shaft: '#e8b06a',
      dot: { kind: 'burn', dps: 7, dur: 3.5 },
      onTick(game, a) { if (Math.random() < 0.5) game.fx.spark(a.x, a.y, '#ff9c3a', 1, 60); } },

    { id: 'balloon', cost: 40, dmg: 20, stats: [2, 1, 2], icon: 'balloon',
      gravityScale: 0.15, speedScale: 0.55, fletch: '#e0b98a' },

    { id: 'shot', cost: 50, dmg: 13, stats: [1, 2, 1], icon: 'arrow',
      tipColor: '#f0d040', fletch: '#e0453c', onFire: spreadFire(3, 0.09) },

    { id: 'minigun', cost: 'ad', dmg: 8, stats: [1, 1, 1], icon: 'bullet',
      tipColor: '#c9c9c9', fletch: '#8a8a8a', speedScale: 1.15,
      onFire: burstFire(6, 0.055, 0.05) },

    { id: 'shuriken', cost: 'ad', dmg: 24, stats: [3, 2, 2], icon: 'shuriken',
      tipColor: '#d9d9d9', pierce: true, noStick: true, spin: 18 },

    { id: 'hook', cost: 'ad', dmg: 18, stats: [2, 3, 3], icon: 'hook',
      tipColor: '#c9b98a', speedScale: 0.9,
      onHit(game, arrow, target) {
        const scale = target.giant ? 0.35 : 1;
        target.pushAnchor(-Math.sign(arrow.vx || 1) * 45 * scale);
      } },

    { id: 'mace', cost: 90, dmg: 40, stats: [4, 4, 5], icon: 'ball',
      tipColor: '#7d7d7d', speedScale: 0.8, knockShift: 34, noStick: true },

    { id: 'axe', cost: 100, dmg: 36, stats: [4, 3, 4], icon: 'axe',
      tipColor: '#c9c9c9', shaft: '#9a7b4f', speedScale: 0.85, knockShift: 20, spin: 9 },

    { id: 'magnet', cost: 'ad', dmg: 12, stats: [1, 2, 2], icon: 'magnet',
      onTick(game, arrow, dt) {
        for (const ap of game.apples) {
          const d = Math.hypot(ap.x - arrow.x, ap.y - arrow.y);
          if (d < 300 && d > 4) {
            ap.x += ((arrow.x - ap.x) / d) * 480 * dt;
            ap.baseY += ((arrow.y - ap.baseY) / d) * 480 * dt;
          }
        }
      } },

    { id: 'tnt', cost: 140, dmg: 26, stats: [3, 3, 3], icon: 'tnt',
      knockShift: 14,
      onHit(game, arrow) { game.explode(arrow.x, arrow.y, 90, 30, arrow.fromPlayer); },
      onLand(game, arrow) { game.explode(arrow.x, arrow.y, 90, 30, arrow.fromPlayer); } },

    { id: 'sixpaths', cost: 150, dmg: 12, stats: [2, 4, 1], icon: 'arrow',
      tipColor: '#8a7fb5', fletch: '#6a5f95', shaft: '#4a4a5a',
      onFire(game, shooter, shot) {
        for (let i = 0; i < 6; i++) {
          const a = shot.angle - 0.22 + i * 0.088;
          game.spawnArrow({
            x: shot.x, y: shot.y,
            vx: Math.cos(a) * shot.speed, vy: Math.sin(a) * shot.speed,
            def: shot.def, fromPlayer: shot.fromPlayer, power: shot.power,
            baseDmg: shot.baseDmg,
          });
        }
        return true;
      },
      onTick: homingTick(1.8) },

    { id: 'sai', cost: 160, dmg: 26, stats: [3, 2, 2], icon: 'sai',
      tipColor: '#d9d9d9', speedScale: 1.15, armorPierce: true },

    { id: 'trap', cost: 'ad', dmg: 16, stats: [2, 2, 3], icon: 'trap',
      tipColor: '#b9b9b9',
      onLand(game, arrow, solid) {
        if (solid && solid.plat) game.addHazard('spikes', arrow.x, solid.plat, { ttl: 8, dps: 10 });
      } },

    { id: 'vampire', cost: 'ad', dmg: 18, stats: [2, 2, 1], icon: 'arrow',
      tipColor: '#a03a45', fletch: '#7d2a35', shaft: '#5a4a4a', healFrac: 0.45 },

    { id: 'rocket', cost: 190, dmg: 24, stats: [3, 3, 2], icon: 'rocket',
      gravityScale: 0.2, speedScale: 0.7,
      onTick(game, arrow, dt) {
        const sp = Math.hypot(arrow.vx, arrow.vy) || 1;
        if (sp < 1900) {
          arrow.vx += (arrow.vx / sp) * 1000 * dt;
          arrow.vy += (arrow.vy / sp) * 1000 * dt;
        }
        game.fx.spark(arrow.x - (arrow.vx / sp) * 22, arrow.y - (arrow.vy / sp) * 22, '#ffb04a', 1, 90);
      },
      onHit(game, arrow) { game.explode(arrow.x, arrow.y, 75, 24, arrow.fromPlayer); },
      onLand(game, arrow) { game.explode(arrow.x, arrow.y, 75, 24, arrow.fromPlayer); } },

    { id: 'sparkler', cost: 200, dmg: 16, stats: [2, 2, 1], icon: 'sparkler',
      onTick(game, arrow) { game.fx.spark(arrow.x, arrow.y, ['#ff7bac', '#ffd23e', '#7bdcff'][(Math.random() * 3) | 0], 1, 120); },
      onHit(game, arrow) { game.explode(arrow.x, arrow.y, 50, 8, arrow.fromPlayer, { silent: true }); } },

    { id: 'cracker', cost: 210, dmg: 14, stats: [2, 3, 2], icon: 'cracker',
      onTick(game, arrow) {
        // Split only past the apex AND after real travel, so a flat or
        // downward shot never showers bomblets at the shooter's feet.
        const traveled = Math.hypot(arrow.x - arrow.sx, arrow.y - arrow.sy);
        if (!arrow.split && arrow.vy > 0 && traveled > 220) {
          arrow.split = true;
          arrow.dead = true;
          const fwd = Math.sign(arrow.vx) || 1;
          for (let i = 0; i < 5; i++) {
            game.spawnArrow({
              x: arrow.x, y: arrow.y,
              vx: arrow.vx * 0.7 + fwd * Math.random() * 200,
              vy: arrow.vy * 0.5 - Math.random() * 140,
              def: RA.ARROWS.byId.crackerFrag, fromPlayer: arrow.fromPlayer, power: arrow.power,
            });
          }
          game.fx.spark(arrow.x, arrow.y, '#f0c040', 8, 160);
        }
      } },

    { id: 'corsair', cost: 220, dmg: 24, stats: [3, 3, 3], icon: 'corsair',
      gravityScale: 0.12, speedScale: 0.9,
      onHit(game, arrow) { game.explode(arrow.x, arrow.y, 55, 16, arrow.fromPlayer); },
      onLand(game, arrow) { game.explode(arrow.x, arrow.y, 55, 16, arrow.fromPlayer); } },

    { id: 'firework', cost: 230, dmg: 18, stats: [3, 3, 2], icon: 'firework',
      onTick(game, arrow) {
        // Burst near the apex, but only after real travel — and fragments
        // fan out in the FORWARD half-circle so none fly back at the shooter.
        const traveled = Math.hypot(arrow.x - arrow.sx, arrow.y - arrow.sy);
        if (!arrow.burst && traveled > 260 && arrow.vy > -60) {
          arrow.burst = true;
          arrow.dead = true;
          game.explode(arrow.x, arrow.y, 60, 12, arrow.fromPlayer, { silent: true });
          const heading = Math.atan2(arrow.vy, arrow.vx);
          const fwd = Math.sign(arrow.vx) || 1;
          for (let i = 0; i < 8; i++) {
            const a = heading - Math.PI * 0.44 + (i * Math.PI * 0.88) / 7;
            let vx = Math.cos(a) * 520;
            // Never let a fragment travel back toward the shooter.
            if (vx * fwd < 40) vx = fwd * Math.max(40, Math.abs(vx));
            game.spawnArrow({
              x: arrow.x, y: arrow.y,
              vx, vy: Math.sin(a) * 520,
              def: RA.ARROWS.byId.fwFrag, fromPlayer: arrow.fromPlayer, power: arrow.power,
            });
          }
          game.fx.ring(arrow.x, arrow.y, 60, '#ff6b5e');
          RA.SND.play('explosion');
        }
      } },

    { id: 'sliding', cost: 240, dmg: 22, stats: [3, 2, 2], icon: 'sword',
      tipColor: '#c9d4d9',
      onLand(game, arrow, solid) {
        if (solid && solid.plat) {
          game.addHazard('slider', arrow.x, solid.plat, {
            dir: Math.sign(arrow.vx || 1), speed: 520, ttl: 1.4,
            dmg: 18, fromPlayer: arrow.fromPlayer,
          });
        }
      } },

    { id: 'sword', cost: 'ad', dmg: 46, stats: [5, 4, 4], icon: 'sword',
      tipColor: '#e0e6ea', speedScale: 0.9, knockShift: 42 },

    { id: 'balls', cost: 260, dmg: 34, stats: [4, 4, 5], icon: 'ball',
      tipColor: '#5a5a5a', speedScale: 0.75, knockShift: 36, noStick: true,
      onHit(game, arrow) { game.explode(arrow.x, arrow.y, 60, 12, arrow.fromPlayer, { silent: true }); } },

    { id: 'colt', cost: 270, dmg: 18, stats: [2, 1, 1], icon: 'bullet',
      tipColor: '#f0a63c', speedScale: 1.9, gravityScale: 0.12, noStick: true },

    { id: 'shotgun', cost: 280, dmg: 9, stats: [1, 3, 2], icon: 'bullet',
      tipColor: '#f0a63c', speedScale: 1.5, gravityScale: 0.6, noStick: true,
      onFire: spreadFire(6, 0.075) },

    { id: 'lewis', cost: 290, dmg: 8, stats: [1, 2, 1], icon: 'bullet',
      tipColor: '#c9c9c9', speedScale: 1.7, gravityScale: 0.15, noStick: true,
      onFire: burstFire(5, 0.09, 0.04) },

    { id: 'circular', cost: 'ad', dmg: 30, stats: [4, 3, 3], icon: 'saw',
      tipColor: '#d9d9d9', spin: 14, noStick: true,
      onLand(game, arrow, solid) {
        if (solid && solid.plat) {
          game.addHazard('saw', arrow.x, solid.plat, {
            ttl: 3, dmg: 14, fromPlayer: arrow.fromPlayer,
          });
        }
      } },

    { id: 'laser', cost: 310, dmg: 26, stats: [3, 2, 1], icon: 'laser',
      hitscan: true,
      onFire(game, shooter, shot) {
        game.beam(shot, shot.def);
        return true;
      } },

    { id: 'arrowrain', cost: 320, dmg: 14, stats: [2, 5, 2], icon: 'arrow',
      tipColor: '#e0453c', fletch: '#e0453c',
      onFire(game, shooter, shot) {
        // Fire the aimed arrow normally…
        game.spawnArrow({
          x: shot.x, y: shot.y,
          vx: Math.cos(shot.angle) * shot.speed, vy: Math.sin(shot.angle) * shot.speed,
          def: shot.def, fromPlayer: shot.fromPlayer, power: shot.power,
          baseDmg: shot.baseDmg,
        });
        // …then call down a volley above the opposition.
        game.schedule(0.55, () => {
          if (game.state === 'gameover') return; // no posthumous volleys
          const targets = game.targetsFor(shot.fromPlayer);
          const cx = targets.length ? targets[0].anchorX : shot.x + Math.cos(shot.angle) * 700;
          for (let i = 0; i < 9; i++) {
            game.schedule(i * 0.05, () => {
              game.spawnArrow({
                x: cx + (Math.random() - 0.5) * 260, y: -40 - Math.random() * 60,
                vx: (Math.random() - 0.5) * 60, vy: 420,
                def: RA.ARROWS.byId.rainArrow, fromPlayer: shot.fromPlayer, power: shot.power,
              });
            });
          }
        });
        return true;
      } },

    // --- hidden sub-projectiles (not shown in the shop) ---
    { id: 'crackerFrag', cost: 0, shop: false, dmg: 8, stats: [1, 1, 1], icon: 'tnt', len: 20,
      onHit(game, arrow) { game.explode(arrow.x, arrow.y, 40, 8, arrow.fromPlayer, { silent: true }); },
      onLand(game, arrow) { game.explode(arrow.x, arrow.y, 40, 8, arrow.fromPlayer, { silent: true }); } },
    { id: 'fwFrag', cost: 0, shop: false, dmg: 9, stats: [1, 1, 1], icon: 'arrow', len: 18,
      gravityScale: 0.6, tipColor: '#ff6b5e', fletch: '#ffd23e', ttl: 0.7, noStick: true },
    { id: 'rainArrow', cost: 0, shop: false, dmg: 14, stats: [1, 1, 1], icon: 'arrow',
      tipColor: '#e0453c', fletch: '#e0453c' },

    // --- support-skill projectiles (skills.js) ---
    { id: 'sBird', cost: 0, shop: false, dmg: 16, stats: [1, 1, 1], icon: 'bird', len: 0,
      gravityScale: 0, noStick: true, ttl: 4, onTick: homingTick(2.6) },
    { id: 'sPoop', cost: 0, shop: false, dmg: 10, stats: [1, 1, 1], icon: 'poop', len: 0,
      gravityScale: 0.35, noStick: true },
    { id: 'sHand', cost: 0, shop: false, dmg: 18, stats: [1, 1, 1], icon: 'hand', len: 0,
      gravityScale: 0, noStick: true, ttl: 5, onTick: homingTick(2.2),
      // ghostly trail so the seeking hand reads as magic
      onLand() {}, },
    { id: 'sShuriken', cost: 0, shop: false, dmg: 12, stats: [1, 1, 1], icon: 'shuriken', len: 0,
      gravityScale: 0.2, noStick: true, spin: 16 },
  ];

  const byId = {};
  for (const d of DEFS) byId[d.id] = d;

  RA.ARROWS = { DEFS, byId };
})();
