// ============================================================
// balance.js — All gameplay tuning numbers live here.
// Designers: tweak this file freely; engine code never needs to change.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});

  RA.BAL = {
    // --- World / projectiles ---
    ARROW_GRAVITY: 1150,         // px/s^2 applied to arrows
    RAGDOLL_GRAVITY: 1600,       // px/s^2 applied to corpses
    ARROW_SPEED: 1350,           // muzzle speed at full draw, weight 1
    WEIGHT_SPEED_PENALTY: 0.04,  // each weight point above 1 slows the arrow (0.08 made maces unable to reach anything)
    MIN_DRAW_TO_FIRE: 0.15,      // release below this cancels the shot
    MIN_DRAG_PIXELS: 12,         // drag shorter than this cancels the shot

    // --- Player ---
    PLAYER_HP_BASE: 100,   PLAYER_HP_PER_LVL: 12,
    PLAYER_STA_BASE: 100,  PLAYER_STA_PER_LVL: 12,
    STA_REGEN_BASE: 8,     STA_REGEN_PER_LVL: 1.4,   // per second
    DRAW_TIME_BASE: 1.05,        // seconds to full draw at Pull Speed +0
    DRAW_TIME_LVL_FACTOR: 0.10,  // drawTime = BASE / (1 + lvl * factor)
    ARMOR_REDUCE_PER_LVL: 0.05, ARMOR_REDUCE_MAX: 0.6,
    DMG_PER_LVL: 0.08,           // +8% player damage per level
    JUMP_COST: 5, JUMP_VELOCITY: 640,
    CROUCH_DRAIN: 3, // stamina per second while holding crouch
    HEADSHOT_MULT: 2.0, LIMB_MULT: 0.65,
    RESPAWN_DELAY: 1.4, RESPAWN_INVULN: 1.2,

    // Stamina cost from an arrow's "sta" stat (1..5)
    staminaCost(stat) { return 8 + stat * 4; },

    // --- Upgrades (base costs straight from the design doc) ---
    UPGRADES: [
      { key: 'armor',          base: 10  },
      { key: 'health',         base: 10  },
      { key: 'lives',          base: 100 },
      { key: 'stamina',        base: 10  },
      { key: 'staminaRefresh', base: 10  },
      { key: 'pullSpeed',      base: 10  },
      { key: 'damage',         base: 10  },
      { key: 'arrowSlots',     base: 50  },
    ],
    upgradeCost(base, lvl) { return Math.round(base * Math.pow(1.55, lvl)); },
    MAX_UPGRADE_LVL: 20,
    ARROW_SLOTS_MAX: 5,          // arrowSlots level cap (1 slot base + lvl)

    // --- Enemies (difficulty curve over the run's score) ---
    // The first few kills are deliberately squishy: one headshot (44) or
    // two full-draw body shots (22+22) — instant sharpshooter feeling.
    EASY_KILLS: 5, EASY_HP: 40,
    enemyHp(score)       { return Math.round(100 * (1 + score * 0.07)); },
    enemyDamage(score)   { return Math.min(60, 13 + score * 0.9); },
    enemySkulls(score, mult) {
      const base = 3 + Math.floor(score / 4);
      return Math.round(base * (mult || 1));
    },
    enemyFireDelay(score) { return Math.max(1.15, 2.6 - score * 0.05); },
    enemyAimError(score)  { return Math.max(0.02, 0.14 - score * 0.004); },

    // ================= RUN STRUCTURE (roguelike) =================
    RUN_DURATION: 840, // survive 14:00 to complete the run
    // Boss timeline: mid-bosses at 3:00 / 5:00, the FINAL boss at 7:00,
    // then post-final pressure at 9:00 / 11:00 and a second final at 13:00.
    BOSS_TIMES: [
      { t: 180, kind: 'mid' },
      { t: 300, kind: 'mid' },
      { t: 420, kind: 'final' },
      { t: 540, kind: 'mid' },
      { t: 660, kind: 'mid' },
      { t: 780, kind: 'final' },
    ],
    // Global difficulty multiplier (applies to enemy hp AND damage).
    // Gentle ramp across the run; an extra ramp once the final boss is down.
    difficulty(timeSec, finalDownAt) {
      let m = 1 + (timeSec / 840) * 0.5;
      if (finalDownAt != null) m += Math.max(0, (timeSec - finalDownAt) / 60) * 0.1;
      return m;
    },

    // --- MID-BOSSES: normal-ish bodies, deliberately drab colors ---
    MID_BOSSES: [
      { id: 'giant',   scale: 1.15, hp: 3,   reward: 5, dmg: 1.15, armor: 0,    arrow: 'axe',
        color: '#a8a8a8', back: '#8a8a8a', fireMult: 1.1,  accent: null },
      { id: 'fairy',   scale: 0.9,  hp: 2.2, reward: 4, dmg: 0.9,  armor: 0,    arrow: 'poison',
        color: '#9aa89a', back: '#7d8a7d', fireMult: 0.75, accent: 'wings', jumpy: true },
      { id: 'knight',  scale: 1.0,  hp: 2.8, reward: 5, dmg: 1.1,  armor: 0.25, arrow: 'sai',
        color: '#98a0a8', back: '#7a828a', fireMult: 1,    accent: 'helmet' },
      { id: 'golem',   scale: 1.15, hp: 3.5, reward: 6, dmg: 1.2,  armor: 0.15, arrow: 'mace',
        color: '#a89a8a', back: '#8a7d70', fireMult: 1.3,  accent: null },
      { id: 'goddess', scale: 1.05, hp: 2.8, reward: 5, dmg: 1,    armor: 0,    arrow: 'electro',
        color: '#b0a898', back: '#948c7d', fireMult: 0.9,  accent: 'halo' },
    ],
    // --- FINAL BOSSES: all huge, vivid colors + pulsing aura.
    // Punishing if the player hasn't leveled. The giant is the biggest.
    FINAL_BOSSES: [
      { id: 'giant',   scale: 2.2, hp: 8,  reward: 16, dmg: 1.7,  armor: 0.15, arrow: 'axe',
        color: '#ff8c5a', back: '#d96a3a', aura: '#ff6b3a', fireMult: 1.1,  accent: null },
      { id: 'fairy',   scale: 1.5, hp: 6,  reward: 14, dmg: 1.4,  armor: 0,    arrow: 'fire',
        color: '#ff9ce0', back: '#d970b8', aura: '#ff7bac', fireMult: 0.6,  accent: 'wings', jumpy: true },
      { id: 'knight',  scale: 1.6, hp: 7,  reward: 15, dmg: 1.55, armor: 0.45, arrow: 'sai',
        color: '#7ba8ff', back: '#5580d9', aura: '#4f8fd0', fireMult: 0.85, accent: 'helmet' },
      { id: 'golem',   scale: 1.8, hp: 10, reward: 17, dmg: 1.7,  armor: 0.35, arrow: 'mace',
        color: '#7fe0a8', back: '#55b880', aura: '#4fd08f', fireMult: 1.25, accent: null },
      { id: 'goddess', scale: 1.6, hp: 7,  reward: 15, dmg: 1.5,  armor: 0.1,  arrow: 'electro',
        color: '#ffe07a', back: '#d9b850', aura: '#ffd23e', fireMult: 0.75, accent: 'halo' },
    ],

    SKILL_REROLLS: 1, // level-up offer rerolls per run

    // ================= XP / LEVELS =================
    // Landing arrows earns XP; leveling offers a choice of 3 skills.
    XP_HIT: 3, XP_HEADSHOT: 5, XP_KILL: 10,
    XP_BOSS_MID: 25, XP_BOSS_FINAL: 60,
    // Early levels come thick and fast, then the boost tapers off.
    earlyXpBoost(level) { return level <= 4 ? 2 : level <= 8 ? 1.5 : 1; },
    // Per-level requirement, exactly per the design spec:
    // L1-20: +10 per level; L21-40: +13; L41+: +16, with big one-off
    // spikes on the 20->21 and 40->41 level-ups.
    xpForNext(level) {
      if (level <= 19) return 5 + 10 * (level - 1);
      if (level === 20) return 195 + 100;  // spike
      if (level <= 39) return 208 + 13 * (level - 21);
      if (level === 40) return 455 + 150;  // spike
      return 471 + 16 * (level - 41);
    },

    // --- Apples (values match the design doc's tutorial popup) ---
    APPLE_RADIUS: 17,
    APPLE_HEAL: 30, APPLE_STA: 30,
    APPLE_WINGED_MULT: 3,        // winged golden apple: +90/+90 and +1 life
    APPLE_INTERVAL_MIN: 5, APPLE_INTERVAL_MAX: 11,
    APPLE_GOLD_CHANCE: 0.12, APPLE_WINGED_CHANCE: 0.04,

    // --- Player knockdown (heavy hits floor you; jump to stand up) ---
    KNOCKDOWN_DMG: 26,           // single post-armor hit at/above this floors the player
    KNOCKDOWN_TIME: 2.6,         // auto stand-up after this many seconds

    // --- Meta ---
    AD_REWARD: 100,
    SEASON: 1,

    // --- Game feel: brief time-freezes on impact (seconds) ---
    HITSTOP_HIT: 0.045, HITSTOP_HEAD: 0.09, HITSTOP_KILL: 0.13,

    // --- Background phases across the run. Everything crossfades:
    // gradient sky (top/bottom), two hill silhouette layers, drifting
    // clouds (tint + opacity), a sun/moon that wanders and recolors as
    // time passes, star visibility, and per-phase ambient particles.
    // The very first stage IS the fresh green meadow. ---
    BG_PHASES: [
      { t: 0, accent: 'grass',      // fresh meadow under a soft day sky
        skyTop: '#48708c', skyBottom: '#7ca98a', hillFar: '#4a7a55', hillNear: '#35603f',
        cloud: '#e8eee6', cloudA: 0.5, sun: '#ffe8b0', sunX: 0.78, sunY: 0.18, sunR: 46, starA: 0.15 },
      { t: 300, accent: 'grassWind', // agitated meadow, greying sky
        skyTop: '#39566b', skyBottom: '#5d8a6e', hillFar: '#3d6a4a', hillNear: '#2b5236',
        cloud: '#b8c4bc', cloudA: 0.55, sun: '#ffd9a0', sunX: 0.6, sunY: 0.22, sunR: 42, starA: 0.2 },
      { t: 420, accent: 'embers',    // burning meadow, fire on the horizon
        skyTop: '#3d2320', skyBottom: '#a04424', hillFar: '#5c3226', hillNear: '#40221a',
        cloud: '#6b4038', cloudA: 0.6, sun: '#ff6b3a', sunX: 0.42, sunY: 0.3, sunR: 54, starA: 0.1 },
      { t: 600, accent: 'snow',      // frozen meadow, pale winter light
        skyTop: '#2c3a50', skyBottom: '#7a94ad', hillFar: '#5c7288', hillNear: '#3d4f63',
        cloud: '#d8e4ee', cloudA: 0.45, sun: '#d8e8f5', sunX: 0.3, sunY: 0.24, sunR: 36, starA: 0.5 },
      { t: 720, accent: 'omen',      // ominous meadow, a violet moon rises
        skyTop: '#1d1830', skyBottom: '#4a2c52', hillFar: '#3a2545', hillNear: '#281733',
        cloud: '#4a3a5a', cloudA: 0.6, sun: '#b07ae0', sunX: 0.22, sunY: 0.2, sunR: 30, starA: 1 },
    ],
    BG_FADE: 6, // seconds to crossfade between phases
  };
})();
