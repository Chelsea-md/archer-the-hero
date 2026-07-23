// ============================================================
// i18n.js — Localization layer. English only for now, but every
// user-facing string routes through RA.I18N.t() so adding a new
// language is just another dictionary entry.
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});

  const dict = {
    en: {
      'game.title': 'STICK ARCHERS',

      'mode.onePlayer': '1 PLAYER',

      'title.kingdom': 'THIS LITTLE KINGDOM RESTS IN YOUR HANDS.',
      'title.war': 'WIN THE WAR — SURVIVE 14 MINUTES.',
      'title.hint1': 'HOLD AND RELEASE TO SHOOT',
      'title.hint2': 'SHOOTING REQUIRES STAMINA',
      'ui.start': 'START',
      'ui.shop': 'ARCHER SHOP',
      'ui.upgradeBtn': 'UPGRADE',
      'ui.settingsBtn': 'SETTINGS',
      'shop.equipped': 'EQUIPPED',
      'shop.owned': 'OWNED',
      'pause.title': 'PAUSED',
      'pause.home': 'GO TO HOME',
      'pause.resume': 'RESUME',
      'recap.title': 'YOUR BUILD',
      'coach.drag': 'HOLD & DRAG — RELEASE!',
      'ui.scoreNow': 'SCORE {n}',
      'license.bestSkulls1': 'BEST SKULLS',
      'license.bestSkulls2': '(ONE RUN)',
      'pause.confirmTitle': 'THE JOURNEY ENDS HERE.',
      'pause.confirmSub': 'REALLY RETURN HOME?',
      'pause.confirmYes': 'GO HOME',
      'pause.confirmNo': 'KEEP FIGHTING',

      'settings.jumpKey': 'JUMP KEY',
      'settings.crouchKey': 'CROUCH KEY',
      'settings.pressKey': 'PRESS A KEY…',

      'ui.score': 'SCORE {cur}/{best}',
      'ui.jump': 'JUMP',
      'ui.jumpCost': '{n} STAMINA',
      'ui.crouch': 'CROUCH',
      'ui.crouchCost': 'HOLD · {n}/s',
      'ui.controlArea': 'CONTROL AREA',
      'ui.holdRelease': 'HOLD AND RELEASE',
      'ui.staminaHint1': 'SHOOTING',
      'ui.staminaHint2': 'REQUIRES',
      'ui.staminaHint3': 'STAMINA',
      'ui.watchAd1': 'WATCH AD',
      'ui.watchAd2': 'TO UNLOCK',

      'ui.license': 'ARCHER LICENSE',
      'license.bestScore': 'BEST SCORE',
      'license.bestSkulls': 'BEST SKULLS (ONE RUN)',
      'license.totalKills': 'ENEMIES DEFEATED',
      'license.bestLevel': 'BEST LEVEL',
      'license.legends': 'LEGENDS',
      'license.legendRow': 'ARCHER #{n} KEPT THE PEACE WITH {weapon}',
      'license.noLegends': 'NO LEGENDS YET — SURVIVE 14:00',

      'shop.confirmTitle': 'BUY {name}?',
      'shop.confirmCost': 'COSTS {n} ☠',
      'shop.buy': 'BUY',
      'shop.cancel': 'CANCEL',
      'shop.gratsTitle': 'UNLOCKED!',
      'shop.gratsSub': '{name} IS YOURS',

      'stats.damage': 'DAMAGE',
      'stats.stamina': 'STAMINA',
      'stats.weight': 'WEIGHT',

      'upgrade.armor': 'ARMOR',
      'upgrade.health': 'HEALTH',
      'upgrade.lives': 'LIVES',
      'upgrade.stamina': 'STAMINA',
      'upgrade.staminaRefresh': 'STAMINA REFRESH',
      'upgrade.pullSpeed': 'PULL SPEED',
      'upgrade.damage': 'DAMAGE',
      'upgrade.arrowSlots': 'ARROW SLOTS',

      'arrow.default': 'DEFAULT',
      'arrow.poison': 'POISON',
      'arrow.electro': 'ELECTRO',
      'arrow.fire': 'FIRE',
      'arrow.balloon': 'BALLOON',
      'arrow.shot': 'SHOT',
      'arrow.minigun': 'MINIGUN',
      'arrow.shuriken': 'SHURIKEN',
      'arrow.hook': 'HOOK',
      'arrow.mace': 'MACE',
      'arrow.axe': 'AXE',
      'arrow.magnet': 'MAGNET',
      'arrow.tnt': 'TNT',
      'arrow.sixpaths': 'SIX PATHS',
      'arrow.sai': 'SAI',
      'arrow.trap': 'TRAP',
      'arrow.vampire': 'VAMPIRE',
      'arrow.rocket': 'ROCKET',
      'arrow.sparkler': 'SPARKLER',
      'arrow.cracker': 'CRACKER',
      'arrow.corsair': 'CORSAIR',
      'arrow.firework': 'FIREWORK',
      'arrow.sliding': 'SLIDING',
      'arrow.sword': 'SWORD',
      'arrow.balls': 'BALLS',
      'arrow.colt': 'COLT',
      'arrow.shotgun': 'SHOTGUN',
      'arrow.lewis': 'LEWIS',
      'arrow.circular': 'CIRCULAR',
      'arrow.laser': 'LASER',
      'arrow.arrowrain': 'ARROW RAIN',

      'toast.newBest': 'NEW BEST!',
      'fx.headshot': 'HEADSHOT!',
      'ui.standUp': 'STAND UP',
      'apples.title1': 'HIT', 'apples.title2': 'THE', 'apples.title3': 'APPLES',
      'apples.sub': 'THE APPLES GIVE BONUSES',
      'apples.health': '+{n} HEALTH',
      'apples.stamina': '+{n} STAMINA',
      'apples.life': '+1 LIFE',
      'settings.violence': 'VIOLENCE',
      'violence.off': 'OFF', 'violence.low': 'LOW', 'violence.full': 'FULL',
      'toast.comingSoon': 'COMING SOON',
      'toast.notEnoughSkulls': 'NOT ENOUGH SKULLS',
      'toast.needMore': 'NOT ENOUGH SKULLS — {n} MORE NEEDED',
      'shop.needMore': '{n} MORE ☠ NEEDED',
      'shop.getSkulls': '▶ +100',
      'fx.lowStamina': 'LOW STAMINA',
      'fx.cured': 'CURED!',
      'toast.slotsFull': 'ARROW SLOTS FULL',
      'toast.unlockedRun': '{name} — THIS GAME ONLY',
      'toast.bossIncoming': '{name} INCOMING!',
      'toast.maxLevel': 'MAX LEVEL',

      'boss.giant': 'GIANT',
      'boss.fairy': 'FAIRY',
      'boss.goddess': 'GODDESS',
      'boss.knight': 'KNIGHT',
      'boss.golem': 'GOLEM',
      'toast.finalBoss': 'FINAL BOSS: {name}!',

      'ui.level': 'LV {n}',
      'victory.title': 'RUN COMPLETE!',
      'victory.sub': 'YOU SURVIVED 14:00',
      'victory.level': 'REACHED LV {n}',
      'victory.peace': 'AND SO, WORLD PEACE CAME…',
      'victory.legend': 'A LEGEND IS WRITTEN…',
      'victory.archerNo': 'YOU ARE ARCHER #{n}',

      'skill.title': 'LEVEL UP!',
      'skill.pick': 'CHOOSE A SKILL',
      'skill.reroll': 'REROLL ({n})',
      'skill.cat.item': 'ITEM',
      'skill.cat.support': 'SUPPORT',
      'skill.cat.bonus': 'BONUS',

      'skill.mothersEgg': "MOTHER'S EGG",
      'skill.mothersEgg.desc': 'RECOVER {v}% HP EVERY 5s',
      'skill.uniform': 'THE UNIFORM',
      'skill.uniform.desc': 'DAMAGE TAKEN -{v}%',
      'skill.handyTool': 'HANDY TOOL',
      'skill.handyTool.desc': 'ARROW STAMINA COST -{v}%',
      'skill.wristwatch': 'WRISTWATCH',
      'skill.wristwatch.desc': 'POISON / BURN / STUN DURATION +{v}%',
      'skill.superAmp': 'SUPER AMPLIFIER',
      'skill.superAmp.desc': 'ARROW HIT SIZE +{v}%',
      'skill.eagleBoots': 'EAGLE BOOTS',
      'skill.eagleBoots.desc': 'PULL SPEED +{v}%',
      'skill.woodenVault': 'WOODEN VAULT',
      'skill.woodenVault.desc': 'SKULL GAIN +{v}%',
      'skill.greatStamp': 'GREAT STAMP',
      'skill.greatStamp.desc': 'MAX HP +{v}%',
      'skill.license': 'THE LICENSE',
      'skill.license.desc': 'XP GAIN +{v}%',
      'skill.licksKnife': "LICK'S KNIFE",
      'skill.licksKnife.desc': 'DAMAGE DEALT +{v}%',

      'skill.whiteBird': 'WHITE BIRD',
      'skill.whiteBird.desc': 'STRIKES THE ENEMY EVERY {cd}s ({d} DMG)',
      'skill.blueBird': 'BLUE BIRD',
      'skill.blueBird.desc': 'BOMBS EVERY {cd}s — {acc}% ACCURACY ({d} DMG)',
      'skill.dwarfHunter': 'DWARF HUNTER',
      'skill.dwarfHunter.desc': 'RAINS {n} ARROWS EVERY {cd}s ({d} DMG EACH)',
      'skill.dwarfWizard': 'DWARF WIZARD',
      'skill.dwarfWizard.desc': 'A SEEKING HAND EVERY {cd}s ({d} DMG)',
      'skill.dwarfRogue': 'DWARF ROGUE',
      'skill.dwarfRogue.desc': 'STUNNING SHURIKEN EVERY {cd}s ({d} DMG, {st}s STUN)',
      'skill.dwarfHealer': 'DWARF HEALER',
      'skill.dwarfHealer.desc': 'CURES EVERY AILMENT + {h} HP EVERY {cd}s',

      'skill.skullCache': 'SKULL CACHE',
      'skill.skullCache.desc': '+{n} SKULLS RIGHT NOW',

      'death.title': 'YOU DIED',
      'death.score': 'SCORE {n}',
      'death.best': 'BEST {n}',
      'death.skulls': '+{n} SKULLS EARNED',
      'death.tap': 'TAP TO CONTINUE',

      'settings.title': 'SETTINGS',
      'settings.sound': 'SOUND',
      'settings.language': 'LANGUAGE',
      'settings.reset': 'RESET PROGRESS',
      'settings.resetConfirm': 'TAP AGAIN TO CONFIRM',
      'settings.on': 'ON',
      'settings.off': 'OFF',
      'settings.close': 'CLOSE',

      'ad.watching': 'WATCHING AD…',
      'ad.reward': '+{n} SKULLS',
    },
  };

  RA.I18N = {
    lang: 'en',
    languages: [{ code: 'en', label: 'ENGLISH' }],

    t(key, vars) {
      const table = dict[this.lang] || dict.en;
      let s = table[key] != null ? table[key] : (dict.en[key] != null ? dict.en[key] : key);
      if (vars) {
        for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      }
      return s;
    },

    setLang(code) {
      if (dict[code]) {
        this.lang = code;
        this.apply();
      }
    },

    // Fill every element carrying a data-i18n attribute.
    apply(root) {
      (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = this.t(el.getAttribute('data-i18n'));
      });
      document.title = this.t('game.title');
    },
  };
})();
