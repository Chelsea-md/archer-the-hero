// ============================================================
// skills.js — Roguelike per-run growth. Landing arrows earns XP;
// each level-up offers 3 choices. Skills start at ★ and gain a
// star when picked again (max 5).
//
//   ITEMS (passive, max 5 held): flat % boosts per star — kept
//   deliberately small (~5%/star) so stacks never feel broken.
//   SUPPORTS (max 2 held): cooldown-based auto-attacks that fire
//   hidden projectile defs. Stars shorten cooldowns / raise damage.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});

  const ITEMS = [
    { id: 'mothersEgg', vars: (s) => ({ v: (0.5 * s).toFixed(1) }) }, // % max HP per 5s
    { id: 'uniform',    vars: (s) => ({ v: 5 * s }) },                // damage taken -
    { id: 'handyTool',  vars: (s) => ({ v: 5 * s }) },                // stamina cost -
    { id: 'wristwatch', vars: (s) => ({ v: 5 * s }) },                // effect duration +
    { id: 'superAmp',   vars: (s) => ({ v: 5 * s }) },                // hit size +
    { id: 'eagleBoots', vars: (s) => ({ v: 5 * s }) },                // pull speed +
    { id: 'woodenVault',vars: (s) => ({ v: 10 * s }) },               // skull gain +
    { id: 'greatStamp', vars: (s) => ({ v: 5 * s }) },                // max HP +
    { id: 'license',    vars: (s) => ({ v: 5 * s }) },                // XP gain +
    { id: 'licksKnife', vars: (s) => ({ v: 5 * s }) },                // damage dealt +
  ];

  // Helper: current live target for supports (the enemy).
  function target(game) {
    const t = game.targetsFor(true);
    return t.length ? t[0] : null;
  }

  const SUPPORTS = [
    {
      id: 'whiteBird',
      cd: (s) => Math.max(13, 20 - 1.5 * (s - 1)),
      vars: (s) => ({ cd: Math.round(Math.max(13, 20 - 1.5 * (s - 1))), d: 14 + 4 * s }),
      fire(game, s) {
        const t = target(game);
        if (!t) return false;
        const fromLeft = t.anchorX > game.W * 0.5;
        const sx = fromLeft ? -30 : game.W + 30;
        game.spawnArrow({
          x: sx,
          y: t.pose.chest.y - 60 - Math.random() * 80,
          vx: (fromLeft ? 1 : -1) * 760, vy: 60,
          def: RA.ARROWS.byId.sBird, fromPlayer: true, power: 1,
          baseDmg: 14 + 4 * s, noXp: true,
          ttl: Math.max(4, Math.abs(t.anchorX - sx) / 760 + 1.2), // ultrawide flights outlive the default 4s
        });
        return true;
      },
    },
    {
      id: 'blueBird',
      cd: () => 10,
      vars: (s) => ({ cd: 10, acc: Math.round((0.5 + 0.08 * s) * 100), d: 8 + 3 * s }),
      fire(game, s) {
        const t = target(game);
        if (!t) return false;
        const hit = Math.random() < 0.5 + 0.08 * s;
        const offX = hit
          ? (Math.random() - 0.5) * 30
          : (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 80);
        game.spawnArrow({
          x: t.anchorX + offX, y: -30,
          vx: 0, vy: 380,
          def: RA.ARROWS.byId.sPoop, fromPlayer: true, power: 1,
          baseDmg: 8 + 3 * s, noXp: true,
        });
        return true;
      },
    },
    {
      id: 'dwarfHunter', dwarf: true,
      cd: (s) => Math.max(11, 16 - 1 * (s - 1)),
      vars: (s) => ({ cd: Math.round(Math.max(11, 16 - (s - 1))), n: 3 + s, d: 6 + 2 * s }),
      fire(game, s) {
        const t = target(game);
        if (!t) return false;
        // Cosmetic: the dwarf visibly looses an arrow skyward first.
        const pos = game.dwarfSlots().dwarfHunter;
        if (pos) {
          game.spawnArrow({
            x: pos.x + 10, y: pos.y - 20, vx: 60, vy: -1400,
            def: RA.ARROWS.byId.rainArrow, fromPlayer: true, power: 1,
            baseDmg: 1, noXp: true, ttl: 0.55,
          });
        }
        const cx = t.anchorX;
        for (let i = 0; i < 3 + s; i++) {
          game.schedule(0.4 + i * 0.07, () => {
            game.spawnArrow({
              x: cx + (Math.random() - 0.5) * 220, y: -40 - Math.random() * 50,
              vx: (Math.random() - 0.5) * 50, vy: 430,
              def: RA.ARROWS.byId.rainArrow, fromPlayer: true, power: 1,
              baseDmg: 6 + 2 * s, noXp: true,
            });
          });
        }
        return true;
      },
    },
    {
      id: 'dwarfWizard', dwarf: true,
      cd: (s) => Math.max(15, 20 - 1 * (s - 1)),
      vars: (s) => ({ cd: Math.round(Math.max(15, 20 - (s - 1))), d: 15 + 6 * s }),
      fire(game, s) {
        const t = target(game);
        if (!t || !game.player) return false;
        const pos = game.dwarfSlots().dwarfWizard || { x: game.player.pose.chest.x, y: game.player.pose.chest.y - 50 };
        game.spawnArrow({
          x: pos.x + 8, y: pos.y - 40,
          vx: 420, vy: -160,
          def: RA.ARROWS.byId.sHand, fromPlayer: true, power: 1,
          baseDmg: 15 + 6 * s, noXp: true,
        });
        return true;
      },
    },
    {
      id: 'dwarfRogue', dwarf: true,
      cd: () => 18,
      vars: (s) => ({ cd: 18, d: 10 + 3 * s, st: (1 + 0.25 * s).toFixed(2) }),
      fire(game, s) {
        const t = target(game);
        if (!t || !game.player) return false;
        const pos = game.dwarfSlots().dwarfRogue || { x: game.player.pose.chest.x, y: game.player.pose.chest.y };
        const a = Math.atan2(t.pose.chest.y - (pos.y - 14), t.pose.chest.x - pos.x);
        game.spawnArrow({
          x: pos.x + Math.cos(a) * 16, y: pos.y - 14,
          vx: Math.cos(a) * 900, vy: Math.sin(a) * 900 - 60,
          def: RA.ARROWS.byId.sShuriken, fromPlayer: true, power: 1,
          baseDmg: 10 + 3 * s, stunDur: 1 + 0.25 * s, noXp: true,
        });
        return true;
      },
    },
  ];

  const byId = {};
  for (const d of ITEMS) { d.kind = 'item'; byId[d.id] = d; }
  for (const d of SUPPORTS) { d.kind = 'support'; byId[d.id] = d; }

  RA.SKILLS = {
    ITEMS, SUPPORTS, byId,
    MAX_STARS: 5, MAX_ITEMS: 5, MAX_SUPPORTS: 2,
    SKULL_CACHE: 15, // fallback card when everything is maxed

    // Cached multipliers the engine reads every frame — recompute on pick.
    stats(items) {
      const s = (id) => items[id] || 0;
      return {
        regenPct: 0.005 * s('mothersEgg'),      // of max HP, every 5s
        dmgTaken: 1 - 0.05 * s('uniform'),
        staCost:  1 - 0.05 * s('handyTool'),
        effDur:   1 + 0.05 * s('wristwatch'),
        hitSize:  1 + 0.05 * s('superAmp'),
        pull:     1 + 0.05 * s('eagleBoots'),
        skull:    1 + 0.10 * s('woodenVault'),
        maxHp:    1 + 0.05 * s('greatStamp'),
        xp:       1 + 0.05 * s('license'),
        dmg:      1 + 0.05 * s('licksKnife'),
      };
    },

    // Build 3 level-up offers respecting hold caps and star caps.
    genOffers(game) {
      const eligible = [];
      const held = (map) => Object.keys(map).length;
      for (const d of ITEMS) {
        const stars = game.items[d.id] || 0;
        if (stars > 0 && stars < this.MAX_STARS) eligible.push({ id: d.id, kind: 'item', star: stars + 1 });
        else if (stars === 0 && held(game.items) < this.MAX_ITEMS) eligible.push({ id: d.id, kind: 'item', star: 1 });
      }
      for (const d of SUPPORTS) {
        const stars = game.supports[d.id] || 0;
        if (stars > 0 && stars < this.MAX_STARS) eligible.push({ id: d.id, kind: 'support', star: stars + 1 });
        else if (stars === 0 && held(game.supports) < this.MAX_SUPPORTS) eligible.push({ id: d.id, kind: 'support', star: 1 });
      }
      // Fisher–Yates, take 3
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }
      const offers = eligible.slice(0, 3);
      while (offers.length < 3) offers.push({ id: 'skullCache', kind: 'bonus', star: 0 });
      return offers;
    },
  };
})();
