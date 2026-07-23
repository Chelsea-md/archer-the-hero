// ============================================================
// main.js — Bootstrap: canvas sizing, input wiring, game loop.
// ============================================================
(function () {
  const RA = window.RA;

  window.addEventListener('load', () => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    RA.SND.setEnabled(RA.SAVE.data.settings.sound);
    RA.SND.setVolume(RA.SAVE.data.settings.volume != null ? RA.SAVE.data.settings.volume : 1);
    if (RA.SAVE.data.settings.lang) RA.I18N.lang = RA.SAVE.data.settings.lang;

    const game = new RA.Game(canvas);
    RA.UI.init(game);

    // Fixed world scale: the world is always ~1200 units tall no matter
    // the window, so battle distances feel identical on a 4K monitor and
    // a 932x587 PLAY3 embed. Input coords are divided by the same scale.
    const VIEW_H = 1200;
    function fit() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = window.innerWidth, cssH = window.innerHeight;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      const s = Math.max(0.42, cssH / VIEW_H);
      game.viewScale = s;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      game.resize(cssW / s, cssH / s);
    }
    fit();
    window.addEventListener('resize', fit);

    // --- Pointer input (mouse + touch via Pointer Events) ---
    canvas.addEventListener('pointerdown', (e) => {
      RA.SND.unlock();
      if (RA.UI.modalOpen || e.button === 2) return;
      canvas.setPointerCapture(e.pointerId);
      game.aimStart(e.clientX / game.viewScale, e.clientY / game.viewScale);
    });
    canvas.addEventListener('pointermove', (e) => {
      game.aimMove(e.clientX / game.viewScale, e.clientY / game.viewScale);
    });
    const release = () => game.aimEnd();
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Keyboard (jump/crouch are rebindable in Settings) ---
    const boundKeys = () => RA.SAVE.data.settings.keys;
    const normKey = (c) => c.replace(/Right$/, 'Left'); // either Ctrl/Shift side counts
    window.addEventListener('keydown', (e) => {
      // Key-capture mode for the Settings rebinding buttons.
      if (RA.UI._binding) {
        e.preventDefault();
        if (e.code !== 'Escape') {
          RA.SAVE.data.settings.keys[RA.UI._binding] = e.code;
          RA.SAVE.save();
        }
        RA.UI.finishBinding();
        return;
      }
      const k = boundKeys();
      if (normKey(e.code) === normKey(k.jump)) {
        e.preventDefault();
        if (!RA.UI.modalOpen) game.jumpPlayer();
      } else if (normKey(e.code) === normKey(k.crouch)) {
        e.preventDefault();
        if (!RA.UI.modalOpen) game.setCrouch(true);
      } else if (e.code === 'KeyQ' || e.code === 'Tab') {
        e.preventDefault();
        if (!RA.UI.modalOpen) game.cycleArrow();
      } else if (e.code === 'Escape') {
        // Skill picks and end-of-run screens can't be escaped away.
        if (RA.UI.modalOpen) {
          if (game.state !== 'gameover' && game.state !== 'victory' && !RA.UI.choiceOpen) {
            RA.UI.closeModal();
          }
        } else if (game.state === 'playing' && !game.camAnim) {
          RA.UI.openPause(); // Esc = pause, like every PC game
        }
      } else if (e.code === 'Enter') {
        // Enter on the title starts the run.
        if (!RA.UI.modalOpen && game.state === 'menu' && !game.camAnim) {
          game.startFromTitle();
          if (game.camAnim) RA.UI.onStateChange('playing');
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (normKey(e.code) === normKey(boundKeys().crouch)) game.setCrouch(false);
    });

    // Auto-pause when the player tabs away mid-run.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.state === 'playing' && !RA.UI.modalOpen && !game.camAnim) {
        RA.UI.openPause();
      }
    });
    window.addEventListener('blur', () => {
      if (game.state === 'playing' && !RA.UI.modalOpen && !game.camAnim) {
        RA.UI.openPause();
      }
    });

    // --- Main loop (clamped dt so a background tab doesn't explode physics) ---
    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      // Modals pause the simulation (ads, settings, skill picks) so enemies
      // can't shoot a player who can't respond. The death/victory overlays
      // are the exception — ragdolls settle and confetti falls behind them.
      // Even while paused, ambience (clouds, particles, transition
      // cinematics) keeps breathing so nothing freezes mid-flash.
      if (!RA.UI.modalOpen || game.state === 'gameover' || game.state === 'victory') game.update(dt);
      else game.tickAmbient(dt);
      game.render();
      RA.UI.updateHUD(game);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
})();
