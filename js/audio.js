// ============================================================
// audio.js — Tiny WebAudio synth. No sound files needed; every
// effect is generated procedurally (oscillator + noise bursts).
// ============================================================
(function () {
  const RA = (window.RA = window.RA || {});

  let ctx = null;
  let enabled = true;
  let master = 1; // master volume 0..1 (settings slider)

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    return ctx;
  }

  // Simple tone: freq glide + exponential fade. `delay` schedules it
  // relative to now (used for melodies like the new-best fanfare).
  function tone(freq, dur, type, vol, glideTo, delay) {
    const c = ac();
    if (!c || !enabled) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
    g.gain.setValueAtTime((vol || 0.15) * master, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // White-noise burst through a lowpass — used for hits/explosions.
  function noise(dur, vol, freq) {
    const c = ac();
    if (!c || !enabled) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq || 900;
    const g = c.createGain();
    g.gain.value = (vol || 0.25) * master;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  RA.SND = {
    setEnabled(b) { enabled = b; },
    setVolume(v) { master = Math.max(0, Math.min(1, v)); },
    // Must be called from a user gesture once (browser autoplay policy).
    unlock() {
      const c = ac();
      if (c && c.state === 'suspended') c.resume();
    },
    play(name) {
      if (!enabled || master <= 0.005) return;
      switch (name) {
        case 'shoot':     tone(700, 0.09, 'square', 0.08, 220); noise(0.05, 0.10, 2400); break;
        case 'draw':      tone(140, 0.10, 'sawtooth', 0.03, 200); break;
        case 'hit':       noise(0.08, 0.22, 1200); tone(160, 0.08, 'square', 0.10, 80); break;
        case 'headshot':  noise(0.10, 0.25, 1600); tone(520, 0.14, 'square', 0.12, 130); break;
        case 'hurt':      tone(240, 0.16, 'sawtooth', 0.14, 90); break;
        case 'death':     tone(300, 0.5, 'sawtooth', 0.16, 40); noise(0.3, 0.2, 700); break;
        case 'explosion': noise(0.45, 0.4, 500); tone(90, 0.4, 'sine', 0.25, 30); break;
        case 'pickup':    tone(660, 0.09, 'square', 0.10, 660); tone(990, 0.12, 'square', 0.10, 990); break;
        case 'buy':       tone(520, 0.08, 'square', 0.10, 780); break;
        case 'denied':    tone(180, 0.16, 'square', 0.12, 120); break;
        case 'click':     tone(420, 0.05, 'square', 0.07); break;
        case 'jump':      tone(300, 0.12, 'square', 0.08, 520); break;
        case 'giant':     tone(110, 0.6, 'sawtooth', 0.18, 55); noise(0.4, 0.15, 300); break;
        case 'laser':     tone(1400, 0.18, 'sawtooth', 0.10, 300); break;
        case 'levelup':   tone(660, 0.1, 'square', 0.12, null, 0); tone(880, 0.14, 'square', 0.12, null, 0.09); tone(1320, 0.2, 'square', 0.1, null, 0.18); break;
        case 'stun':      tone(900, 0.2, 'square', 0.08, 1400); break;
        case 'thunder':   noise(0.9, 0.35, 350); tone(60, 0.8, 'sine', 0.2, 35); break;
        case 'gust':      noise(0.7, 0.16, 1200); tone(320, 0.6, 'sine', 0.05, 90); break;
        case 'frost':     tone(1800, 0.5, 'triangle', 0.08, 900); tone(1250, 0.5, 'triangle', 0.07, 620, 0.14); noise(0.4, 0.07, 5200); break;
        case 'fanfare': {
          // Ta-da! ascending arpeggio + sparkle for a new best score.
          const seq = [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.34], [784, 0.5], [1047, 0.6]];
          for (const [f, d] of seq) tone(f, 0.3, 'square', 0.13, null, d);
          tone(1568, 0.5, 'triangle', 0.1, null, 0.72);
          tone(2093, 0.6, 'triangle', 0.08, null, 0.8);
          noise(0.3, 0.12, 3200);
          break;
        }
      }
    },
  };
})();
