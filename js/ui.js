// ============================================================
// ui.js — DOM HUD layer: arrow shop, upgrade panel, modals,
// toasts, bars. The canvas renders the world; the DOM renders
// everything textual (which keeps i18n trivial).
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});
  const t = (k, v) => RA.I18N.t(k, v);
  const $ = (id) => document.getElementById(id);

  const UPGRADE_COLORS = {
    armor: 'red', health: 'red', lives: 'red',
    stamina: 'blue', staminaRefresh: 'blue',
    pullSpeed: 'yellow', damage: 'yellow', arrowSlots: 'yellow',
  };

  // Emoji art for the skill cards / chips.
  const SKILL_ICONS = {
    mothersEgg: '🥚', uniform: '👕', handyTool: '🔧', wristwatch: '⌚',
    superAmp: '📢', eagleBoots: '👢', woodenVault: '💰', greatStamp: '❤️',
    license: '📜', licksKnife: '🔪',
    whiteBird: '🕊️', blueBird: '🐦',
    dwarfHunter: '🏹', dwarfWizard: '🧙', dwarfRogue: '🥷', dwarfHealer: '🧑‍⚕️',
    skullCache: '💀',
  };

  RA.UI = {
    game: null,
    _cache: {},
    _resetArmed: false,

    init(game) {
      this.game = game;
      RA.I18N.apply();

      $('jumpCost').textContent = t('ui.jumpCost', { n: RA.BAL.JUMP_COST });
      $('crouchCost').textContent = t('ui.crouchCost', { n: RA.BAL.CROUCH_DRAIN });

      this.refreshEconomy();
      this.refreshBadge();

      // Title buttons
      $('startBtn').addEventListener('click', () => {
        game.startFromTitle();
        if (game.camAnim) this.onStateChange('playing'); // swap HUD as the camera pulls out
      });
      $('shopBtn').addEventListener('click', () => this.openShop());
      $('upgradeBtn').addEventListener('click', () => this.openUpgrades());

      // --- static wiring ---
      $('jumpBtn').addEventListener('click', () => game.jumpPlayer());
      $('adBtn').addEventListener('click', () => {
        this.playAd(() => {
          RA.SAVE.addSkulls(RA.BAL.AD_REWARD);
          this.refreshEconomy();
        }, t('ad.reward', { n: RA.BAL.AD_REWARD }));
      });
      $('settingsBtn').addEventListener('click', () => this.openSettings());
      $('pauseBtn').addEventListener('click', () => this.openPause());
      $('licenseBtn').addEventListener('click', () => this.openLicense());
      $('arrowBadge').addEventListener('click', () => game.cycleArrow());

      // Hold-to-crouch button (touch & mouse)
      const crouch = $('crouchBtn');
      crouch.addEventListener('pointerdown', (e) => { e.preventDefault(); game.setCrouch(true); });
      const upCrouch = () => game.setCrouch(false);
      crouch.addEventListener('pointerup', upCrouch);
      crouch.addEventListener('pointercancel', upCrouch);
      crouch.addEventListener('pointerleave', upCrouch);
    },

    // ---------------------------------------------------------------
    // Upgrade modal ([ UPGRADE ] on the title screen)
    // ---------------------------------------------------------------
    openUpgrades() {
      this.openModal(
        '<div class="modalTitle">⚔ ' + t('ui.upgradeBtn') + '</div>' +
        '<div id="upModalList"></div>' +
        '<button id="closeModal" class="setBtn wide">' + t('settings.close') + '</button>'
      );
      const wrap = $('upModalList');
      for (const u of RA.BAL.UPGRADES) {
        const row = document.createElement('div');
        row.className = 'upRow';
        const btn = document.createElement('button');
        btn.className = 'costPill';
        btn.dataset.key = u.key;
        const label = document.createElement('span');
        label.className = 'upLabel ' + (UPGRADE_COLORS[u.key] || '');
        row.appendChild(btn);
        row.appendChild(label);
        wrap.appendChild(row);
        btn.addEventListener('click', () => {
          if (this.game.buyUpgrade(u.key)) this.refreshEconomy();
          else { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); }
        });
      }
      this.refreshUpgrades();
      $('closeModal').addEventListener('click', () => this.closeModal());
    },

    refreshUpgrades() {
      const S = RA.SAVE;
      document.querySelectorAll('#upModalList .upRow').forEach((row, i) => {
        const u = RA.BAL.UPGRADES[i];
        const lvl = S.upgradeLvl(u.key);
        const max = u.key === 'arrowSlots' ? RA.BAL.ARROW_SLOTS_MAX : RA.BAL.MAX_UPGRADE_LVL;
        const btn = row.querySelector('.costPill');
        const label = row.querySelector('.upLabel');
        if (lvl >= max) {
          btn.innerHTML = '<span class="skullMini">☠</span> MAX';
          btn.classList.add('maxed');
        } else {
          btn.innerHTML = '<span class="skullMini">☠</span> ' + RA.BAL.upgradeCost(u.base, lvl);
          btn.classList.remove('maxed');
        }
        label.textContent = t('upgrade.' + u.key) + ' +' + lvl;
      });
    },

    // ---------------------------------------------------------------
    // Archer Shop modal — 3-column catalog, scrolls vertically
    // ---------------------------------------------------------------
    openShop() {
      this.openModal(
        '<div class="modalTitle">🏹 ' + t('ui.shop') + '</div>' +
        '<div class="shopLegend">' +
        '<span><i class="dot red"></i>' + t('stats.damage') + '</span>' +
        '<span><i class="dot blue"></i>' + t('stats.stamina') + '</span>' +
        '<span><i class="dot yellow"></i>' + t('stats.weight') + '</span>' +
        '</div>' +
        '<div id="shopGrid"></div>' +
        '<button id="closeModal" class="setBtn wide">' + t('settings.close') + '</button>'
      );
      this.renderShopGrid();
      $('closeModal').addEventListener('click', () => this.closeModal());
    },

    renderShopGrid() {
      const grid = $('shopGrid');
      if (!grid) return;
      const S = RA.SAVE, g = this.game;
      const dots = (n, cls) => {
        let s = '';
        for (let i = 0; i < 5; i++) s += '<span class="dot ' + (i < n ? cls : 'off') + '"></span>';
        return s;
      };
      grid.innerHTML = RA.ARROWS.DEFS.filter((d) => d.shop !== false).map((def) => {
        const owned = S.data.unlocked.includes(def.id);
        const adRun = g.adArrows.includes(def.id);
        const selected = S.data.selected.includes(def.id) || adRun;
        let cls = 'shopCell';
        if (owned || adRun) cls += ' owned';
        if (selected) cls += ' selected';
        if (!owned && !adRun) cls += def.cost === 'ad' ? ' adCell' : ' locked';
        let state;
        if (selected) state = '<b class="eq">' + t('shop.equipped') + '</b>';
        else if (owned || adRun) state = '<span class="own">' + t('shop.owned') + '</span>';
        else if (def.cost === 'ad') {
          state = '<span class="adTag">▶</span><span class="adTxt">' +
            t('ui.watchAd1') + '<br>' + t('ui.watchAd2') + '</span>';
        } else {
          // prices you can't afford yet read red at a glance
          const afford = S.data.skulls >= def.cost;
          state = '<span class="' + (afford ? '' : 'cantAfford') + '">☠ ' + def.cost + '</span>';
        }
        return '<div class="' + cls + '" data-id="' + def.id + '">' +
          '<canvas class="shopIcon" data-id="' + def.id + '" width="120" height="28"></canvas>' +
          '<div class="shopName">' + t('arrow.' + def.id) + '</div>' +
          '<div class="shopDots">' +
          '<div>' + dots(def.stats[0], 'red') + '</div>' +
          '<div>' + dots(def.stats[1], 'blue') + '</div>' +
          '<div>' + dots(def.stats[2], 'yellow') + '</div>' +
          '</div>' +
          '<div class="shopState">' + state + '</div>' +
          '</div>';
      }).join('');
      grid.querySelectorAll('.shopIcon').forEach((cv) => {
        const c = cv.getContext('2d');
        c.translate(12, 14);
        c.rotate(Math.PI);
        RA.drawArrowShape(c, RA.ARROWS.byId[cv.dataset.id], 96);
      });
      grid.querySelectorAll('.shopCell').forEach((cell) => {
        cell.addEventListener('click', () => this.onArrowClick(RA.ARROWS.byId[cell.dataset.id]));
      });
    },

    onArrowClick(def) {
      const S = RA.SAVE, g = this.game;
      if (S.data.unlocked.includes(def.id)) {
        g.toggleSelect(def.id);
      } else if (def.cost === 'ad') {
        if (g.adArrows.includes(def.id)) {
          g.adUnlockArrow(def.id); // already unlocked this run — just re-select
        } else {
          // After the ad resolves, come back to the shop catalog.
          this.playAd(() => g.adUnlockArrow(def.id), t('arrow.' + def.id), () => this.openShop());
          return;
        }
      } else {
        this.confirmBuy(def); // skull purchases ask first, then celebrate
        return;
      }
      this.refreshEconomy();
      this.refreshBadge();
    },

    // "Buy X for N skulls?" → BUY / CANCEL → congratulations modal.
    // When skulls are short, BUY is disabled and the modal says exactly
    // how many more are needed — with a +100 ad shortcut right there.
    confirmBuy(def) {
      const name = t('arrow.' + def.id);
      const skulls = RA.SAVE.data.skulls;
      const afford = skulls >= def.cost;
      this.openModal(
        '<div class="buyBox">' +
        '<canvas id="buyIcon" width="140" height="34"></canvas>' +
        '<div class="modalTitle">' + t('shop.confirmTitle', { name }) + '</div>' +
        '<div class="buyCost">' + t('shop.confirmCost', { n: def.cost }) + '</div>' +
        (afford ? '' :
          '<div class="buyShort">' + t('shop.needMore', { n: def.cost - skulls }) + '</div>') +
        '<div class="buyRow">' +
        (afford
          ? '<button id="buyYes" class="holoBtn"><span class="startShine"></span>' + t('shop.buy') + '</button>'
          : '<button class="setBtn buyDead" disabled>' + t('shop.buy') + '</button>' +
            '<button id="buyAd" class="setBtn adGold">' + t('shop.getSkulls') + '</button>') +
        '<button id="buyNo" class="setBtn">' + t('shop.cancel') + '</button>' +
        '</div></div>'
      );
      const icx = $('buyIcon').getContext('2d');
      icx.translate(14, 17); icx.rotate(Math.PI);
      RA.drawArrowShape(icx, def, 110);
      $('buyNo').addEventListener('click', () => this.openShop());
      if (afford) {
        $('buyYes').addEventListener('click', () => {
          this.closeModal();
          if (this.game.buyArrow(def.id)) {
            this.refreshEconomy();
            this.refreshBadge();
            this.congratsBuy(def);
          } else {
            this.openShop(); // race fallback — toast explains the deficit
          }
        });
      } else {
        // Watch an ad for +100 and land right back on this confirm dialog.
        $('buyAd').addEventListener('click', () => {
          this.playAd(() => {
            RA.SAVE.addSkulls(RA.BAL.AD_REWARD);
            this.bumpSkulls();
          }, t('ad.reward', { n: RA.BAL.AD_REWARD }), () => this.confirmBuy(def));
        });
      }
    },

    congratsBuy(def) {
      const name = t('arrow.' + def.id);
      RA.SND.play('fanfare');
      // Confetti bursts on the battlefield behind the modal.
      const g = this.game;
      const palette = ['#ffd23e', '#e0453c', '#7dc93b', '#4f8fd0', '#ff7bac'];
      g.fx.shake(6);
      const burst = (n) => {
        for (let i = 0; i < n; i++) {
          const x = g.W * (0.12 + Math.random() * 0.76);
          const y = g.H * (0.12 + Math.random() * 0.4);
          g.fx.ring(x, y, 90 + Math.random() * 60, palette[(Math.random() * 5) | 0]);
          for (const c of palette) g.fx.spark(x, y, c, 8, 430);
        }
      };
      burst(3);
      setTimeout(() => burst(3), 280);
      setTimeout(() => { burst(2); RA.SND.play('fanfare'); }, 640);
      setTimeout(() => burst(3), 1050);
      this.openModal(
        '<div class="buyBox grats">' +
        '<div class="gratsTitle">' + t('shop.gratsTitle') + '</div>' +
        '<canvas id="gratsIcon" width="180" height="40"></canvas>' +
        '<div class="gratsSub">' + t('shop.gratsSub', { name }) + '</div>' +
        '<button id="closeModal" class="setBtn wide">' + t('settings.close') + '</button>' +
        '</div>'
      );
      const icx = $('gratsIcon').getContext('2d');
      icx.translate(20, 20); icx.rotate(Math.PI); icx.scale(1.3, 1.3);
      RA.drawArrowShape(icx, def, 110);
      $('closeModal').addEventListener('click', () => this.openShop());
    },

    // The Archer License — an actual ID card: portrait, license number,
    // official seal, and a holo-shine that sweeps across every 3 seconds.
    openLicense() {
      const S = RA.SAVE.data;
      const licNo = String(S.legends.length ? S.legends[S.legends.length - 1].gen : 0).padStart(4, '0');
      // Values live in a fixed left-aligned column; long labels stack a
      // small second line instead of wrapping mid-word.
      const row = (label, val, sub) =>
        '<div class="licRow"><span class="licLabel">' + label +
        (sub ? '<small>' + sub + '</small>' : '') +
        '</span><b>' + val + '</b></div>';
      let legends;
      if (S.legends.length) {
        legends = '<div class="licLegends">' + S.legends.slice(-10).map((l) =>
          '<div class="licLegendRow">' +
          t('license.legendRow', { n: l.gen, weapon: t('arrow.' + l.weapon) }) +
          '<span class="licDate">' + l.date + '</span></div>'
        ).join('') + '</div>';
      } else {
        legends = '<div class="licEmpty">' + t('license.noLegends') + '</div>';
      }
      this.openModal(
        '<div class="licCard">' +
        '<div class="licShine"></div>' +
        '<div class="licHead"><span>🏹 ' + t('ui.license') + '</span><span class="licNo">No. ' + licNo + '</span></div>' +
        '<div class="licBody">' +
        '<div class="licPhoto"><canvas id="licPortrait" width="86" height="104"></canvas></div>' +
        '<div class="licStats">' +
        row(t('license.bestScore'), S.best) +
        row(t('license.bestSkulls1'), '☠ ' + S.stats.bestSkulls, t('license.bestSkulls2')) +
        row(t('license.totalKills'), S.stats.totalKills) +
        row(t('license.bestLevel'), 'LV ' + S.stats.bestLevel) +
        '</div></div>' +
        '<div class="licSeal">☠<br><span>APPROVED</span></div>' +
        '</div>' +
        '<div class="licSub">' + t('license.legends') + '</div>' +
        legends +
        '<button id="closeModal" class="setBtn wide">' + t('settings.close') + '</button>'
      );
      // Portrait: the currently equipped arrow, standing tall in the frame.
      const c = $('licPortrait').getContext('2d');
      c.fillStyle = '#efe8d8'; c.fillRect(0, 0, 86, 104);
      const eqDef = RA.ARROWS.byId[RA.SAVE.data.selected[0]] || RA.ARROWS.byId.default;
      c.save();
      c.translate(43, 16);       // tip near the top of the frame
      c.rotate(-Math.PI / 2);    // tip up, shaft running straight down
      RA.drawArrowShape(c, eqDef, 74);
      c.restore();
      c.strokeStyle = '#8a8a8a'; c.lineWidth = 1;
      c.strokeRect(2, 2, 82, 100);
      $('closeModal').addEventListener('click', () => this.closeModal());
    },

    // ---------------------------------------------------------------
    // HUD refresh (cheap, called every frame with change-detection)
    // ---------------------------------------------------------------
    updateHUD(game) {
      const c = this._cache;
      const p = game.player;
      const set = (key, el, val) => {
        if (c[key] !== val) { c[key] = val; el.textContent = val; }
      };
      // Keep the bars/buttons (and the first-run drag coach) glued to the
      // tower through the live camera — a CSS vw anchor drifts off the archer
      // once towerX clamps at 480 on wide screens.
      const cam = game.camNow();
      const s = game.viewScale || 1;
      const toPx = (wx) => Math.round(((wx - cam.fx) * cam.z + game.W / 2) * s) + 'px';
      const hudLeft = toPx(game.towerX);
      if (c.hudLeft !== hudLeft) {
        c.hudLeft = hudLeft;
        $('playerHud').style.left = hudLeft;
        $('dragCoach').style.left = toPx(game.towerX + 75);
      }
      if (p) {
        const hpPct = Math.max(0, Math.round((p.hp / p.hpMax) * 100));
        const staPct = Math.max(0, Math.round((p.sta / p.staMax) * 100));
        if (c.hpPct !== hpPct) { c.hpPct = hpPct; $('hpFill').style.width = hpPct + '%'; }
        if (c.staPct !== staPct) { c.staPct = staPct; $('staFill').style.width = staPct + '%'; }
        set('hpTxt', $('hpText'), Math.max(0, Math.round(p.hp)));
        set('staTxt', $('staText'), Math.round(p.sta));
        const downed = p.alive && p.downT > 0;
        const jumpOk = p.alive && (downed || (p.sta >= RA.BAL.JUMP_COST && p.jumpY === 0));
        if (c.jumpOk !== jumpOk) { c.jumpOk = jumpOk; $('jumpBtn').classList.toggle('disabled', !jumpOk); }
        if (c.downed !== downed) { c.downed = downed; $('standUpHint').classList.toggle('hidden', !downed); }
      }
      set('skulls', $('skullCount'), RA.SAVE.data.skulls);
      set('score', $('scoreLabel'), t('ui.scoreNow', { n: game.score }));
      // Extra lives shown flanked by wings, like the design doc.
      const lives = game.state === 'playing' && game.lives > 0 ? '🪽 ' + game.lives + ' 🪽' : '';
      set('lives', $('livesText'), lives);
      // Run countdown + XP bar
      if (game.state === 'playing') {
        // QA: the clock builds up 00:00 → 14:00 rather than counting down.
        const clock = Math.min(RA.BAL.RUN_DURATION, game.runTime);
        const mm = String(Math.floor(clock / 60)).padStart(2, '0');
        const ss = String(Math.floor(clock % 60)).padStart(2, '0');
        set('timer', $('runTimer'), mm + ':' + ss);
        const need = RA.BAL.xpForNext(game.level);
        const pct = Math.round(Math.min(1, game.xp / need) * 100);
        if (c.xpPct !== pct) { c.xpPct = pct; $('xpFill').style.width = pct + '%'; }
        set('lv', $('lvLabel'), t('ui.level', { n: game.level }));
      }
    },

    refreshEconomy() {
      if ($('upModalList')) this.refreshUpgrades();
      if ($('shopGrid')) this.renderShopGrid();
      this._cache.skulls = null; // force skull counter re-render
    },

    refreshBadge() {
      const g = this.game;
      if (!g) return;
      // Pips above the badge show WHICH equipped arrow is nocked (2+ slots).
      const n = g.runArrows.length;
      const hint = $('arrowHint');
      hint.classList.toggle('hidden', n < 2 || $('arrowBadge').classList.contains('hidden'));
      if (n >= 2) {
        let pips = '';
        for (let i = 0; i < n; i++) pips += '<span class="pip' + (i === g.curArrow ? ' on' : '') + '"></span>';
        $('arrowPips').innerHTML = pips;
      }
      const def = g.currentDef();
      $('badgeName').textContent = t('arrow.' + def.id);
      const cv = $('badgeIcon');
      const ictx = cv.getContext('2d');
      ictx.setTransform(1, 0, 0, 1, 0, 0);
      ictx.clearRect(0, 0, cv.width, cv.height);
      ictx.translate(8, 10);
      ictx.rotate(Math.PI);
      RA.drawArrowShape(ictx, def, 56);
    },

    pulseStamina() {
      const bar = document.querySelector('.bar.sta');
      bar.classList.remove('pulse'); void bar.offsetWidth; bar.classList.add('pulse');
    },

    // --- juice: little UI reactions to scoring events ---
    _bump(el) {
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    },
    bumpSkulls() { this._bump(document.querySelector('#topLeft .skulls')); },
    bumpScore() { this._bump($('scoreLabel')); },
    xpPulse() {
      const bar = $('xpBar');
      if (!bar) return;
      bar.classList.remove('glow'); void bar.offsetWidth; bar.classList.add('glow');
    },
    damageFlash() {
      const v = $('dmgVignette');
      if (!v) return;
      v.classList.remove('show'); void v.offsetWidth; v.classList.add('show');
    },

    // ---------------------------------------------------------------
    // State transitions
    // ---------------------------------------------------------------
    onStateChange(state) {
      document.body.classList.toggle('in-game', state !== 'menu');
      $('arrowBadge').classList.toggle('hidden', state === 'menu');
      this.refreshBadge();
      if (state === 'menu') {
        this.refreshEconomy();
      }
    },

    // ---------------------------------------------------------------
    // Toast + modals
    // ---------------------------------------------------------------
    toast(msg) {
      const el = $('toast');
      el.textContent = msg;
      el.classList.remove('hidden', 'show');
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => el.classList.add('hidden'), 1700);
    },

    // bare=true renders content directly on the dim overlay (no card box) —
    // used for cinematic full-screen text beats.
    openModal(html, bare) {
      $('overlay').classList.remove('hidden');
      $('modalBox').classList.toggle('bare', !!bare);
      $('modalBox').innerHTML = html;
    },
    closeModal() {
      $('overlay').classList.add('hidden');
      $('modalBox').classList.remove('bare');
      $('modalBox').innerHTML = '';
      document.querySelectorAll('.deathTapOut').forEach((el) => el.remove());
      this._resetArmed = false;
    },

    // Simulated rewarded ad. Replace playAd() with a real ads SDK call
    // (e.g. CrazyGames SDK rewarded video) when integrating.
    // Both timers re-check that the ad modal is still the one showing:
    // it may have been cancelled (Escape) or replaced by the death screen,
    // and must then neither grant the reward nor close someone else's modal.
    playAd(onDone, rewardLabel, onClosed) {
      this.openModal(
        '<div class="adBox"><div class="adTitle">' + t('ad.watching') + '</div>' +
        '<div class="adBar"><div class="adFill"></div></div></div>'
      );
      const fill = document.querySelector('.adFill');
      requestAnimationFrame(() => { fill.style.width = '100%'; });
      setTimeout(() => {
        const box = document.querySelector('.adBox');
        if (!box) return; // ad was cancelled or superseded — no reward
        onDone();
        box.innerHTML = '<div class="adTitle reward">' + rewardLabel + '</div>';
        setTimeout(() => {
          if (document.querySelector('.adBox')) {
            this.closeModal();
            if (onClosed) onClosed();
          }
        }, 800);
        this.refreshEconomy();
      }, 1900);
    },

    // ---------------------------------------------------------------
    // Pause menu (in-game ❚❚): PAUSED → Settings / Go Home / Close
    // ---------------------------------------------------------------
    openPause() {
      this.openModal(
        '<div class="modalTitle">❚❚ ' + t('pause.title') + '</div>' +
        '<div class="pauseCol">' +
        '<button id="pauseSettings" class="setBtn wide">' + t('ui.settingsBtn') + '</button>' +
        '<button id="pauseHome" class="setBtn wide">' + t('pause.home') + '</button>' +
        '<button id="pauseResume" class="holoBtn wide"><span class="startShine"></span>' + t('pause.resume') + '</button>' +
        '</div>'
      );
      $('pauseSettings').addEventListener('click', () => this.openSettings(true));
      $('pauseHome').addEventListener('click', () => this.confirmHome());
      $('pauseResume').addEventListener('click', () => this.closeModal());
    },

    confirmHome() {
      this.openModal(
        '<div class="homeBox">' +
        '<div class="homeTitle">' + t('pause.confirmTitle') + '</div>' +
        '<div class="homeSub">' + t('pause.confirmSub') + '</div>' +
        '<div class="buyRow">' +
        '<button id="homeYes" class="setBtn danger">' + t('pause.confirmYes') + '</button>' +
        '<button id="homeNo" class="setBtn">' + t('pause.confirmNo') + '</button>' +
        '</div></div>'
      );
      $('homeYes').addEventListener('click', () => {
        this.closeModal();
        this.game.abandonRun();
      });
      $('homeNo').addEventListener('click', () => this.openPause());
    },

    openSettings(fromPause) {
      const S = RA.SAVE;
      const langOpts = RA.I18N.languages
        .map((l) => '<option value="' + l.code + '"' + (RA.I18N.lang === l.code ? ' selected' : '') + '>' + l.label + '</option>')
        .join('');
      const vol = Math.round((S.data.settings.volume != null ? S.data.settings.volume : 1) * 100);
      const sens = Math.round((S.data.settings.sensitivity != null ? S.data.settings.sensitivity : 1) * 100);
      this.openModal(
        '<div class="modalTitle">' + t('settings.title') + '</div>' +
        '<div class="setRow"><span>' + t('settings.sound') + '</span>' +
        '<input type="range" id="volSlider" class="volRange" min="0" max="100" value="' + vol + '"></div>' +
        '<div class="setRow"><span>' + t('settings.sensitivity') + '</span>' +
        '<input type="range" id="sensSlider" class="volRange" min="20" max="100" value="' + sens + '">' +
        '<button id="sensReset" class="setBtn mini">' + t('settings.sensReset') + '</button></div>' +
        '<div class="setRow"><span>' + t('settings.violence') + '</span>' +
        '<button id="goreToggle" class="setBtn">' + t('violence.' + S.data.settings.gore) + '</button></div>' +
        '<div class="setRow"><span>' + t('settings.language') + '</span>' +
        '<select id="langSel" class="setBtn">' + langOpts + '</select></div>' +
        '<div class="setRow"><span>' + t('settings.jumpKey') + '</span>' +
        '<button id="bindJump" class="setBtn">' + this.keyLabel(S.data.settings.keys.jump) + '</button></div>' +
        '<div class="setRow"><span>' + t('settings.crouchKey') + '</span>' +
        '<button id="bindCrouch" class="setBtn">' + this.keyLabel(S.data.settings.keys.crouch) + '</button></div>' +
        '<div class="setRow"><button id="resetBtn" class="setBtn danger">' + t('settings.reset') + '</button></div>' +
        '<button id="closeModal" class="setBtn wide">' + t('settings.close') + '</button>'
      );
      $('bindJump').addEventListener('click', () => {
        this._binding = 'jump';
        $('bindJump').textContent = t('settings.pressKey');
      });
      $('bindCrouch').addEventListener('click', () => {
        this._binding = 'crouch';
        $('bindCrouch').textContent = t('settings.pressKey');
      });
      $('volSlider').addEventListener('input', (e) => {
        const v = e.target.value / 100;
        S.data.settings.volume = v;
        S.data.settings.sound = v > 0;
        RA.SND.setVolume(v);
        RA.SND.setEnabled(true);
      });
      $('volSlider').addEventListener('change', () => {
        S.save();
        RA.SND.play('click'); // audible sample of the chosen volume
      });
      $('sensSlider').addEventListener('input', (e) => {
        S.data.settings.sensitivity = (+e.target.value) / 100;
        S.save();
      });
      $('sensReset').addEventListener('click', () => {
        S.data.settings.sensitivity = 1;
        $('sensSlider').value = 100;
        S.save();
        RA.SND.play('click');
      });
      $('goreToggle').addEventListener('click', () => {
        const order = ['off', 'low', 'full'];
        const cur = order.indexOf(S.data.settings.gore);
        S.data.settings.gore = order[(cur + 1) % order.length];
        S.save();
        $('goreToggle').textContent = t('violence.' + S.data.settings.gore);
        RA.SND.play('click');
      });
      $('langSel').addEventListener('change', (e) => {
        RA.I18N.setLang(e.target.value);
        S.data.settings.lang = e.target.value;
        S.save();
        this.buildUpgrades();
        this.buildArrowList();
      });
      $('resetBtn').addEventListener('click', () => {
        if (!this._resetArmed) {
          this._resetArmed = true;
          $('resetBtn').textContent = t('settings.resetConfirm');
          return;
        }
        RA.SAVE.reset();
        this.closeModal();
        this.game.backToMenu();
        this.game.applyUpgrades();
        this.refreshEconomy();
        this.refreshBadge();
      });
      // From the pause menu, closing Settings returns to PAUSED.
      $('closeModal').addEventListener('click', () =>
        fromPause && this.game.state === 'playing' ? this.openPause() : this.closeModal());
    },

    showDeath(score, best, skulls, isNewBest) {
      this.openModal(
        '<div class="deathBox">' +
        (isNewBest ? '<div class="deathNew">' + t('toast.newBest') + '</div>' : '') +
        '<div class="deathTitle">' + t('death.title') + '</div>' +
        '<div class="deathScore">' + t('death.score', { n: score }) + '</div>' +
        '<div class="deathBest">' + t('death.best', { n: best }) + '</div>' +
        '<div class="deathSkulls">' + t('death.skulls', { n: skulls }) + '</div>' +
        this.skillRecapHtml() +
        '</div>'
      );
      // QA: the continue prompt floats on the gloom below the modal box.
      document.querySelectorAll('.deathTapOut').forEach((el) => el.remove());
      const tapEl = document.createElement('div');
      tapEl.className = 'deathTapOut';
      tapEl.textContent = t('death.tap');
      $('overlay').appendChild(tapEl);
      const done = () => {
        $('overlay').removeEventListener('click', done);
        tapEl.remove();
        this.closeModal();
        this.game.backToMenu();
      };
      setTimeout(() => $('overlay').addEventListener('click', done), 400);
    },

    // ---------------------------------------------------------------
    // Roguelike skill picks
    // ---------------------------------------------------------------
    choiceOpen: false,

    showSkillChoice(offers) {
      this.choiceOpen = true;
      const stars = (n) => {
        let s = '';
        for (let i = 1; i <= 5; i++) s += i <= n ? '★' : '☆';
        return s;
      };
      const card = (o, i) => {
        const def = RA.SKILLS.byId[o.id];
        const vars = o.kind === 'bonus'
          ? { n: RA.SKILLS.SKULL_CACHE }
          : def.vars(o.star);
        const tier = o.kind === 'bonus' ? 0 : o.star;
        return '<button class="skillCard t' + tier + '" data-i="' + i + '">' +
          '<span class="skillCat ' + o.kind + '">' + t('skill.cat.' + o.kind) + '</span>' +
          '<canvas class="skillArt" data-id="' + o.id + '" width="128" height="84"></canvas>' +
          '<span class="skillName">' + t('skill.' + o.id) + '</span>' +
          '<span class="skillStars tier' + tier + '">' + (o.kind === 'bonus' ? '' : stars(o.star)) + '</span>' +
          '<span class="skillDesc">' + t('skill.' + o.id + '.desc', vars) + '</span>' +
          '</button>';
      };
      const g = this.game;
      this.openModal(
        '<div class="skillBox">' +
        '<div class="skillTitle">' + t('skill.title') + '</div>' +
        '<div class="skillSub">' + t('skill.pick') + '</div>' +
        '<div class="skillRow">' + offers.map(card).join('') + '</div>' +
        (g.rerolls > 0
          ? '<button id="rerollBtn" class="rerollBtn">🎲 ' + t('skill.reroll', { n: g.rerolls }) + '</button>'
          : '') +
        '</div>'
      );
      document.querySelectorAll('.skillArt').forEach((cv) => {
        RA.drawSkillArt(cv.getContext('2d'), cv.dataset.id, 128, 84);
      });
      document.querySelectorAll('.skillCard').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.choiceOpen = false;
          this.closeModal();
          g.applySkill(offers[+btn.dataset.i]);
        });
      });
      const reroll = $('rerollBtn');
      if (reroll) {
        reroll.addEventListener('click', () => {
          g.rerolls--;
          RA.SND.play('click');
          this.showSkillChoice(RA.SKILLS.genOffers(g)); // re-render with fresh offers
        });
      }
    },

    // This run's build (skills + star tiers) for the end-of-run screens.
    skillRecapHtml() {
      const g = this.game;
      const chips = [];
      for (const id in g.items) chips.push({ id, s: g.items[id] });
      for (const id in g.supports) chips.push({ id, s: g.supports[id] });
      if (!chips.length) return '';
      return '<div class="recapTitle">' + t('recap.title') + '</div>' +
        '<div class="recapRow">' +
        chips.map((c) =>
          '<span class="recapChip">' + (SKILL_ICONS[c.id] || '') + ' ' + t('skill.' + c.id) +
          ' <b class="tier' + c.s + '">' + '★'.repeat(c.s) + '</b></span>'
        ).join('') +
        '</div>';
    },

    // One-time drag gesture coachmark on the very first run.
    showDragCoach() {
      $('dragCoach').classList.remove('hidden');
      clearTimeout(this._coachT);
      this._coachT = setTimeout(() => this.hideDragCoach(), 12000);
    },
    hideDragCoach() {
      clearTimeout(this._coachT);
      $('dragCoach').classList.add('hidden');
    },

    // Held-skill chips under the skull counter.
    refreshChips() {
      const g = this.game;
      const el = $('skillChips');
      if (!g || !el) return;
      const chip = (id, s, cls) =>
        '<div class="chip ' + cls + '">' + (SKILL_ICONS[id] || '') + ' ' + t('skill.' + id) +
        ' <b class="tier' + s + '">' + '★'.repeat(s) + '</b></div>';
      let html = '';
      for (const id in g.items) html += chip(id, g.items[id], 'item');
      for (const id in g.supports) html += chip(id, g.supports[id], 'support');
      el.innerHTML = html;
    },

    // Staged ending: wistful text beats advanced by click, then the
    // stats card slams in with confetti bursts.
    showVictory(score, level, skulls, gen) {
      const g = this.game;
      const burst = (n) => {
        const palette = ['#ffd23e', '#e0453c', '#7dc93b', '#4f8fd0', '#ff7bac'];
        for (let i = 0; i < n; i++) {
          const x = g.W * (0.12 + Math.random() * 0.76);
          const y = g.H * (0.1 + Math.random() * 0.4);
          g.fx.ring(x, y, 95, palette[i % 5]);
          for (const c of palette) g.fx.spark(x, y, c, 6, 400);
        }
        g.fx.shake(6);
      };

      const cine = (text, cls, next) => {
        this.openModal(
          '<div class="cineWrap"><div class="cineText ' + cls + '">' + text + '</div>' +
          '<div class="cineTap">' + t('death.tap') + '</div></div>',
          true
        );
        const onClick = () => {
          $('overlay').removeEventListener('click', onClick);
          RA.SND.play('click');
          next();
        };
        setTimeout(() => $('overlay').addEventListener('click', onClick), 700);
      };

      const finale = () => {
        RA.SND.play('fanfare');
        burst(4);
        setTimeout(() => burst(3), 380);
        setTimeout(() => burst(3), 800);
        this.openModal(
          '<div class="deathBox vicPop">' +
          '<div class="victoryTitle">' + t('victory.title') + '</div>' +
          '<div class="archerNo">' + t('victory.archerNo', { n: gen }) + '</div>' +
          '<div class="deathBest">' + t('victory.sub') + '</div>' +
          '<div class="deathScore">' + t('death.score', { n: score }) + '</div>' +
          '<div class="deathScore">' + t('victory.level', { n: level }) + '</div>' +
          '<div class="deathSkulls">' + t('death.skulls', { n: skulls }) + '</div>' +
          this.skillRecapHtml() +
          '<div class="deathTap">' + t('death.tap') + '</div>' +
          '</div>'
        );
        const done = () => {
          $('overlay').removeEventListener('click', done);
          this.closeModal();
          g.backToMenu();
        };
        setTimeout(() => $('overlay').addEventListener('click', done), 1200);
      };

      cine(t('victory.peace'), 'white', () =>
        cine(t('victory.legend'), 'gold', finale));
    },

    // Big pop-in banner + confetti when the all-time best is beaten mid-run.
    showBestBanner() {
      const el = $('bestBanner');
      el.classList.remove('hidden', 'show');
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(this._bestT);
      this._bestT = setTimeout(() => el.classList.add('hidden'), 2600);
    },

    // First-run tutorial popup explaining apple bonuses (from the design doc).
    showAppleTip() {
      const B = RA.BAL;
      const cell = (type, lines) =>
        '<div class="appleCell"><canvas class="appleIcon" data-type="' + type + '" width="90" height="72"></canvas>' +
        lines.map((l) => '<div class="appleLine ' + l.cls + '">' + l.txt + '</div>').join('') + '</div>';
      this.openModal(
        '<div class="appleBox">' +
        '<div class="appleTitle"><span class="red">' + t('apples.title1') + '</span> ' +
        '<span class="yellow">' + t('apples.title2') + '</span> ' +
        '<span class="green">' + t('apples.title3') + '</span></div>' +
        '<div class="appleSub">' + t('apples.sub') + '</div>' +
        '<div class="appleGrid">' +
        cell('red', [{ cls: 'red', txt: t('apples.health', { n: B.APPLE_HEAL }) }]) +
        cell('gold', [
          { cls: 'red', txt: t('apples.health', { n: B.APPLE_HEAL }) },
          { cls: 'blue', txt: t('apples.stamina', { n: B.APPLE_STA }) },
        ]) +
        cell('winged', [
          { cls: 'red', txt: t('apples.health', { n: B.APPLE_HEAL * B.APPLE_WINGED_MULT }) },
          { cls: 'blue', txt: t('apples.stamina', { n: B.APPLE_STA * B.APPLE_WINGED_MULT }) },
          { cls: 'yellow', txt: t('apples.life') },
        ]) +
        cell('green', [{ cls: 'blue', txt: t('apples.stamina', { n: B.APPLE_STA }) }]) +
        '</div>' +
        '<button id="closeModal" class="setBtn wide">' + t('settings.close') + '</button>' +
        '</div>'
      );
      document.querySelectorAll('.appleIcon').forEach((cv) => {
        RA.drawApple(cv.getContext('2d'), 45, 42, 18, cv.dataset.type, 1);
      });
      $('closeModal').addEventListener('click', () => this.closeModal());
    },

    // ---------------------------------------------------------------
    // Key rebinding (PC)
    // ---------------------------------------------------------------
    _binding: null, // 'jump' | 'crouch' while waiting for a key press

    keyLabel(code) {
      if (!code) return '?';
      if (code === 'Space') return 'SPACE';
      if (code.startsWith('Control')) return 'CTRL';
      if (code.startsWith('Shift')) return 'SHIFT';
      if (code.startsWith('Alt')) return 'ALT';
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      if (code === 'ArrowUp') return '↑';
      if (code === 'ArrowDown') return '↓';
      if (code === 'ArrowLeft') return '←';
      if (code === 'ArrowRight') return '→';
      return code.toUpperCase();
    },

    finishBinding() {
      const keys = RA.SAVE.data.settings.keys;
      if ($('bindJump')) $('bindJump').textContent = this.keyLabel(keys.jump);
      if ($('bindCrouch')) $('bindCrouch').textContent = this.keyLabel(keys.crouch);
      this._binding = null;
    },

    get modalOpen() {
      return !$('overlay').classList.contains('hidden');
    },
  };
})();
