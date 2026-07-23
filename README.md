# STICK ARCHERS

A dependency-free HTML5 canvas archery game inspired by the *Ragdoll Archers*
design document: stickman archers with procedural poses and Verlet ragdoll
deaths, skull-currency upgrades, 31 arrow types, flying apples, and a
10-boss roster. **1 Player mode only.**

## Run it

No build step, no dependencies.

- **Easiest:** double-click `index.html` (everything works from `file://`).
- **Or serve it:** `python -m http.server 8734` (or any static server) and open
  `http://localhost:8734`.

## Controls

| Input | Action |
| --- | --- |
| Hold + drag (mouse/touch) | Aim — drag direction is the shot direction; holding longer pulls the bow further (Pull Speed stat) |
| Release | Fire (costs stamina per the arrow's stamina stat) |
| `Space` / JUMP button | Jump (5 stamina) — dodges arrows and hazards |
| Hold `Ctrl` / CROUCH button | Duck low (3 stamina/s) — smaller target, can't shoot |
| `Q` / `Tab` / click arrow badge | Cycle equipped arrows during a run |

Jump and crouch keys are rebindable in Settings. The game targets both
desktop and small embeds — layouts adapt down to 932×587 (PLAY3).

**Title screen**: a close-up camera on the archer with the kingdom
tagline; the holo-green START button zooms the camera out to the
battlefield and begins the run (first run shows the apples tutorial).
ARCHER SHOP opens the 3-column arrow catalog modal, UPGRADE the stat
upgrades, SETTINGS the options.

Firing your first arrow from the menu starts a **14:00 survival run**.
Kills award skulls (banked immediately) and score.

**Run timeline** (`BAL.BOSS_TIMES`): mid-bosses at 3:00 and 5:00, the
**FINAL BOSS** at 7:00, then rising difficulty with more mid-bosses at
9:00/11:00 and a second final at 13:00. Survive to 14:00 → RUN COMPLETE.
Mid-bosses are normal-sized with drab colors; final bosses are all huge
(the Giant hugest at 2.2×) with vivid colors and a pulsing aura
(`BAL.MID_BOSSES` / `BAL.FINAL_BOSSES` — Giant/Fairy/Knight/Golem/Goddess).

The first `EASY_KILLS` (5) regular enemies of every run are squishy
(40 HP): one headshot or two full-draw body shots — the neck counts as
head, so the opening moments feel like sharpshooting.

**Roguelike growth**: landing arrows earns XP (`XP_HIT`/`XP_KILL`/boss
bonuses). Each level-up offers a choice of 3 skills (plus **1 reroll per
run**, `SKILL_REROLLS`) that start at ★ and
gain a star when re-picked (max ★★★★★, `js/skills.js`): 10 passive
**Items** (max 5 held — HP regen, damage taken −, stamina cost −, effect
duration +, hit size +, pull speed +, skull/XP/damage +, max HP +) and 5
**Supports** (max 2 held — White Bird, Blue Bird, Dwarf Hunter, Dwarf
Wizard, Dwarf Rogue auto-attacks on cooldowns; held dwarfs visibly stand
on the tower beside the player, hop when their skill fires, and their
projectiles launch from where they stand). The XP curve follows the
design spec: +10/level to 20, +13 to 40, +16 after, with big spikes on
the 20→21 and 40→41 level-ups; early levels are boosted ×2 (to Lv4) and
×1.5 (to Lv8) so the run snowballs immediately (`BAL.earlyXpBoost`).

**Archer License** (top-right in the menu): lifetime records — best
score, best skulls in one run, total kills, best level — plus the book
of LEGENDS: every *completed* run is recorded as "ARCHER #n KEPT THE
PEACE WITH {most-fired weapon}". The victory screen plays the ending
("AND SO, WORLD PEACE CAME… / A LEGEND IS WRITTEN… / YOU ARE ARCHER #n").

**Backgrounds** are a full painted-sky system (`BAL.BG_PHASES`): gradient
sky, a sun/moon that wanders and recolors across the run, drifting
procedural clouds whose tint follows the phase, two rolling-hill
silhouette layers, and per-phase ambience — fresh meadow (start, flowers
+ pollen) → windswept meadow (5:00) → burning meadow (7:00, red sun +
embers) → frozen meadow (10:00, snow) → ominous meadow (12:00, violet
moon + wisps). All colors crossfade smoothly. Skill cards use procedural
canvas illustrations (`js/art.js`), including the actual in-game dwarf
portraits.

Skull purchases ask for confirmation ("BUY X? COSTS N ☠") and celebrate
with an UNLOCKED! modal; ad arrows are labeled "WATCH AD TO UNLOCK".

**Game feel**: impacts trigger hit-stop (`HITSTOP_*`), white hit-flashes,
popping damage numbers, HEADSHOT! call-outs, kill rings + screen shake,
skull/score counter bumps, an XP-bar glow, and a red vignette when the
player takes damage. Apples:
red = +30 health, green = +30 stamina, gold = both, **winged gold** (rare) =
+90/+90 and +1 extra life. A heavy hit knocks the player down — press JUMP
("STAND UP") to get back on your feet. Beating your all-time best mid-run
triggers a fanfare + confetti + "NEW BEST!" banner.

Hit body parts blush red and stay wounded (also on the corpse ragdoll).
The **VIOLENCE** setting (Settings → OFF / LOW / FULL) controls gore:
OFF = no blood and no wound tint, LOW = wound tint only, FULL = both.
The in-game ❚❚ button pauses (modals freeze the simulation).

## Project layout

```
index.html          DOM scaffold (HUD is DOM; the world is canvas)
css/style.css       HUD styling
js/balance.js       ALL gameplay tuning numbers — designers edit this file
js/i18n.js          Localization (English now; add a language = add a dict)
js/save.js          localStorage persistence (skulls, upgrades, unlocks, leaders)
js/audio.js         Procedural WebAudio SFX (no sound files)
js/physics.js       Geometry helpers, stickman renderer, Verlet ragdoll corpses
js/arrows.js        The 31-arrow catalog: data defs + onFire/onHit/onTick/onLand hooks
js/entities.js      Archer (IK-posed), Arrow projectile, Apple, Platform, Hazard, FX
js/ai.js            Enemy brain — real ballistic solve with score-scaled aim noise
js/game.js          State machine, combat resolution, economy, rendering
js/ui.js            DOM HUD: shop, upgrades, modals, toasts
js/main.js          Bootstrap: canvas sizing, input, game loop
```

## Design notes

- **Living archers are not physics-simulated.** They're posed each frame with
  two-bone IK plus a spring "wobble" for hit reactions; only on death is the
  pose handed to a Verlet ragdoll. This keeps aiming rock-solid while deaths
  stay floppy.
- **Arrows are data.** A new arrow type is usually just a def object in
  `js/arrows.js` — declarative flags (`dot`, `stun`, `pierce`, `gravityScale`,
  `knockShift`…) plus optional behavior hooks.
- **Difficulty = accuracy.** Enemies solve the true projectile arc; the score
  shrinks their aim noise and fire delay (`enemyAimError`, `enemyFireDelay` in
  `js/balance.js`).
- **i18n-ready.** Every user-facing string routes through `RA.I18N.t()`. To add
  Korean later: add a `ko` dictionary in `js/i18n.js` and it appears in the
  settings language picker.
- **Ads are stubbed.** `RA.UI.playAd()` fakes a 2-second rewarded video for the
  `+100` button and "ONE GAME" arrows. Swap its body for a real ads SDK call
  (e.g. CrazyGames rewarded video) when integrating.

## Tuning

Open `js/balance.js` — every number the game uses lives there: player/enemy
curves, upgrade costs, apple frequency, giant cadence, physics constants.
`js/arrows.js` holds per-arrow damage/stats/costs.
