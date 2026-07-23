// ============================================================
// save.js — Persistent progress via localStorage.
// Everything the player keeps between sessions lives in RA.SAVE.data.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});
  const KEY = 'stickArchers.save.v1';

  function defaults() {
    return {
      skulls: 0,
      best: 0,
      upgrades: {
        armor: 0, health: 0, lives: 0, stamina: 0,
        staminaRefresh: 0, pullSpeed: 0, damage: 0, arrowSlots: 0,
      },
      unlocked: ['default'],   // permanently owned arrow ids
      selected: ['default'],   // equipped arrow ids (max 1 + arrowSlots lvl)
      settings: {
        sound: true, volume: 1, lang: 'en', gore: 'full', // gore: 'off' | 'low' | 'full'
        keys: { jump: 'Space', crouch: 'ControlLeft' }, // PC bindings (rebindable)
      },
      seenAppleTip: false,
      seenDragTip: false,
      leaders: [],             // [{score, skulls, date}]
      stats: { bestSkulls: 0, totalKills: 0, bestLevel: 1 }, // Archer License
      legends: [],             // successful runs: [{gen, weapon, score, level, date}]
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const data = JSON.parse(raw);
      // Merge saved data INTO fresh defaults (never mutate the defaults
      // object first — nested keys added in later builds must survive).
      const d = defaults();
      const out = Object.assign({}, d, data);
      out.upgrades = Object.assign({}, d.upgrades, data.upgrades || {});
      out.settings = Object.assign({}, d.settings, data.settings || {});
      out.settings.keys = Object.assign({}, d.settings.keys, (data.settings || {}).keys || {});
      out.stats = Object.assign({}, d.stats, data.stats || {});
      if (!Array.isArray(out.legends)) out.legends = [];
      if (!Array.isArray(out.unlocked) || !out.unlocked.length) out.unlocked = ['default'];
      if (!Array.isArray(out.selected) || !out.selected.length) out.selected = ['default'];
      return out;
    } catch (e) {
      return defaults();
    }
  }

  RA.SAVE = {
    data: load(),

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ }
    },

    addSkulls(n) {
      this.data.skulls += n;
      this.save();
    },

    spendSkulls(n) {
      if (this.data.skulls < n) return false;
      this.data.skulls -= n;
      this.save();
      return true;
    },

    upgradeLvl(key) { return this.data.upgrades[key] || 0; },

    pushLeader(entry) {
      this.data.leaders.push(entry);
      this.data.leaders.sort((a, b) => b.score - a.score);
      this.data.leaders = this.data.leaders.slice(0, 10);
      this.save();
    },

    reset() {
      this.data = defaults();
      this.save();
    },
  };
})();
