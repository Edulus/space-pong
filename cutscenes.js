// Cutscene controllers — companion to cutscenes.css.
//
// Public surface:
//   Cutscenes.init(audioCtx)              // wire up audio context, kick off MP3 preload
//   Cutscenes.defeat.show(delayMs = 0)    // earth-destruction sequence (delay before fade-in)
//   Cutscenes.defeat.hide()               // also cancels any pending delayed show
//   Cutscenes.defeat.isVisible()
//   Cutscenes.victory.show(delayMs = 0)   // earth welcomed into the galactic community
//   Cutscenes.victory.hide()
//   Cutscenes.victory.isVisible()
//
// HTML templates (#narrative-screen, #defeat-screen, #victory-screen) live in
// index.html. Game state, input handling, and music remain the caller's
// responsibility. show(delayMs) wraps the visible reveal in a CSS opacity
// transition so the cutscene cross-fades in over the (still-running) game canvas.

window.Cutscenes = (function () {
  let ctx = null;
  let explosionBuffer = null;

  function init(audioCtx) {
    ctx = audioCtx;
    // Preload the explosion MP3 so playEarthExplosion() fires sample-accurate
    // at the 5.9s mark instead of waiting on a fetch + decode.
    fetch('dragon-studio-nuclear-explosion-386181.mp3')
      .then(r => r.arrayBuffer())
      .then(b => ctx.decodeAudioData(b))
      .then(buf => { explosionBuffer = buf; })
      .catch(err => console.warn('Explosion sound failed to preload:', err));
  }

  // ─── Shared audio helpers ──────────────────────────────────────────────────

  function playTypeBeep() {
    if (!ctx || ctx.state === 'suspended') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(700 + Math.random() * 500, t);
    osc.frequency.exponentialRampToValueAtTime(400 + Math.random() * 200, t + 0.03);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.05);
  }

  function playEarthRumble(duration = 2.2) {
    if (!ctx || ctx.state === 'suspended') return;
    const t = ctx.currentTime;

    const bufLen = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(110, t);
    noiseFilter.frequency.linearRampToValueAtTime(220, t + duration);
    noiseFilter.Q.value = 4;
    const noiseG = ctx.createGain();
    noiseG.gain.setValueAtTime(0.0, t);
    noiseG.gain.linearRampToValueAtTime(0.25, t + 0.15);
    noiseG.gain.linearRampToValueAtTime(0.55, t + duration * 0.95);
    noiseG.gain.exponentialRampToValueAtTime(0.001, t + duration);
    noise.connect(noiseFilter); noiseFilter.connect(noiseG); noiseG.connect(ctx.destination);
    noise.start(t); noise.stop(t + duration);

    const sub = ctx.createOscillator();
    sub.type = 'sine'; sub.frequency.value = 42;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 7;
    const lfoG = ctx.createGain(); lfoG.gain.value = 9;
    lfo.connect(lfoG); lfoG.connect(sub.frequency);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0, t);
    subG.gain.linearRampToValueAtTime(0.25, t + 0.2);
    subG.gain.linearRampToValueAtTime(0.5, t + duration * 0.95);
    subG.gain.exponentialRampToValueAtTime(0.001, t + duration);
    sub.connect(subG); subG.connect(ctx.destination);
    sub.start(t); sub.stop(t + duration);
    lfo.start(t); lfo.stop(t + duration);
  }

  function playEarthExplosion() {
    if (!ctx || ctx.state === 'suspended') return;
    const t = ctx.currentTime;

    if (explosionBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = explosionBuffer;
      const g = ctx.createGain();
      g.gain.value = 0.9;
      src.connect(g); g.connect(ctx.destination);
      src.start(t);
      return;
    }

    // Direct Audio element — works on file:// where fetch() is blocked.
    try {
      const audio = new Audio('dragon-studio-nuclear-explosion-386181.mp3');
      audio.volume = 0.9;
      const p = audio.play();
      if (p) p.catch(() => {});
      return;
    } catch (e) {}

    // Full synthesis fallback — layered for a catastrophic planetary scale.
    const dur = 4.5;
    const sr  = ctx.sampleRate;

    // Helper: create a mono noise buffer with a given envelope shape.
    function noiseBuf(seconds, envFn) {
      const len = Math.ceil(sr * seconds);
      const b   = ctx.createBuffer(1, len, sr);
      const d   = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * envFn(i / len);
      return b;
    }
    function play(buf, gainNode) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gainNode);
      gainNode.connect(ctx.destination);
      src.start(t);
    }

    // Layer 1: Initial shockwave crack — wideband noise transient (0–0.2s).
    {
      const g = ctx.createGain();
      g.gain.setValueAtTime(1.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      play(noiseBuf(0.22, p => 1 - p), g);
    }

    // Layer 2: Massive low-end explosion — filtered noise, sweeps from 3 kHz → 55 Hz.
    {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(55, t + dur);
      lp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(1.1, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(dur, p => Math.pow(1 - p, 0.6));
      src.connect(lp); lp.connect(g); g.connect(ctx.destination);
      src.start(t);
    }

    // Layer 3: Sub-bass sine thud — drops from 90 Hz → 18 Hz (felt more than heard).
    {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(18, t + 2.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.95, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 3.1);
    }

    // Layer 4: Mid crunch — bandpass noise, center sweeps 800 Hz → 120 Hz.
    {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(800, t);
      bp.frequency.exponentialRampToValueAtTime(120, t + 2.2);
      bp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(2.3, p => Math.pow(1 - p, 1.1));
      src.connect(bp); bp.connect(g); g.connect(ctx.destination);
      src.start(t);
    }

    // Layer 5: Deep rumble tail — very low LP noise sustain, fades over full dur.
    {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 100;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.5);
      g.gain.setValueAtTime(0.45, t + 1.5);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(dur, () => 1);
      src.connect(lp); lp.connect(g); g.connect(ctx.destination);
      src.start(t);
    }

    // Layer 6: Second oscillator thud at 40 Hz — adds weight at 0.08s offset.
    {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(40, t + 0.08);
      osc.frequency.exponentialRampToValueAtTime(14, t + 2.0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t + 0.08);
      g.gain.linearRampToValueAtTime(0.8, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t + 0.08); osc.stop(t + 2.9);
    }
  }

  // ─── Magical reveal sound (victory — friends fade in) ─────────────────────

  function semitones(n) { return Math.pow(2, n / 12); }

  function playHarp() {
    if (!ctx || ctx.state === 'suspended') return;
    const notes = [261.63,293.66,329.63,392,440,523.25,587.33,659.25,783.99,880];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 1.6);
    });
  }

  function playSparkles() {
    if (!ctx || ctx.state === 'suspended') return;
    const freqs = [2093,2349,2637,3136,3520,4186,4699];
    for (let i = 0; i < 32; i++) {
      const t = ctx.currentTime + Math.random() * 2.8;
      const freq = freqs[Math.floor(Math.random() * freqs.length)];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.45);
    }
  }

  function playSwell() {
    if (!ctx || ctx.state === 'suspended') return;
    const t = ctx.currentTime;
    [261.63, 329.63, 392.00].forEach(freq => {
      const osc    = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain   = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, t);
      filter.frequency.linearRampToValueAtTime(1800, t + 1.2);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.3);
      gain.gain.linearRampToValueAtTime(0.04, t + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 3.0);
    });
  }

  function playMagicalReveal() {
    playHarp();
    playSparkles();
    playSwell();
  }

  // ─── Cross-fade helper ─────────────────────────────────────────────────────
  // Mounts the clone at opacity 0 and transitions to 1 so the cutscene fades in
  // over the still-rendered game canvas. Internal CSS keyframes start running
  // immediately on insertion — that's intentional, the fade is purely cosmetic.

  const FADE_IN_MS = 1000;

  function mountWithFadeIn(template) {
    // Hide any other full-screen overlays so only this cutscene is visible.
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.add('hidden');
    const narrativeScreen = document.getElementById('narrative-screen');
    if (narrativeScreen) narrativeScreen.classList.add('hidden');
    // Fade the star canvas in simultaneously so it covers the game canvas.
    if (window.showStarCanvas) window.showStarCanvas(true);
    const fresh = template.cloneNode(true);
    fresh.classList.remove('hidden');
    fresh.style.opacity = '0';
    fresh.style.transition = `opacity ${FADE_IN_MS}ms ease-in`;
    template.parentNode.insertBefore(fresh, template.nextSibling);
    // Two rAFs: first commits the opacity:0 paint, second triggers the transition.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (fresh.isConnected) fresh.style.opacity = '1';
    }));
    return fresh;
  }

  // ─── Defeat cutscene ───────────────────────────────────────────────────────

  const defeat = (function () {
    let liveScreen = null;
    let timeouts = [];
    let pendingShow = null; // setTimeout id while waiting for `delayMs` before mounting

    function clearAllTimeouts() {
      timeouts.forEach(clearTimeout);
      timeouts = [];
    }

    function show(delayMs = 0) {
      hide(); // cancel any in-flight pending show or live instance
      if (delayMs > 0) {
        pendingShow = setTimeout(() => { pendingShow = null; doShow(); }, delayMs);
      } else {
        doShow();
      }
    }

    function doShow() {
      const template = document.getElementById('defeat-screen');
      if (!template) { console.warn('Cutscenes.defeat.show: no #defeat-screen template'); return; }

      // Keep the id on the clone so #defeat-screen CSS rules (dark bg,
      // position:fixed, z-index:100) apply — without them the canvas WIN
      // overlay bleeds through. The duplicate id is harmless because
      // getElementById('defeat-screen') resolves to the (hidden) template
      // first, and we always query from the clone scope below.
      const fresh = mountWithFadeIn(template);
      liveScreen = fresh;

      const subtitleEl = fresh.querySelector('#defeat-subtitle');
      const line3El    = fresh.querySelector('#defeat-line3');
      const SUBTITLE = 'you have failed';
      const LINE3    = 'humanity has been deemed not worthy';

      timeouts.push(setTimeout(() => {
        if (liveScreen === fresh) playEarthRumble(2.2);
      }, 3700));
      timeouts.push(setTimeout(() => {
        if (liveScreen === fresh) playEarthExplosion();
      }, 5900));
      timeouts.push(setTimeout(() => {
        if (liveScreen !== fresh || !subtitleEl) return;
        typeIntoLine(fresh, subtitleEl, SUBTITLE, () => {
          timeouts.push(setTimeout(() => {
            if (liveScreen === fresh && line3El) typeIntoLine(fresh, line3El, LINE3);
          }, 800));
        });
      }, 9800));
    }

    function typeIntoLine(owner, el, text, onDone) {
      el.textContent = '';
      let i = 0;
      function step() {
        if (liveScreen !== owner || !el.isConnected) return; // cancelled by hide()
        if (i >= text.length) { if (onDone) onDone(); return; }
        el.textContent += text[i];
        playTypeBeep();
        i++;
        timeouts.push(setTimeout(step, 38));
      }
      step();
    }

    function hide() {
      if (pendingShow) { clearTimeout(pendingShow); pendingShow = null; }
      clearAllTimeouts();
      if (liveScreen) {
        liveScreen.remove();
        liveScreen = null;
      }
    }

    function isVisible() { return liveScreen !== null; }

    return { show, hide, isVisible };
  })();

  // ─── Victory cutscene ──────────────────────────────────────────────────────
  // Provisional: Earth + 7 friendly planets/stars fly in, settle into orbit and
  // hover gently. Headline types in via CSS; subtitle + line3 via JS.

  const victory = (function () {
    let liveScreen = null;
    let timeouts = [];
    let pendingShow = null;

    function clearAllTimeouts() {
      timeouts.forEach(clearTimeout);
      timeouts = [];
    }

    function show(delayMs = 0) {
      hide();
      if (delayMs > 0) {
        pendingShow = setTimeout(() => { pendingShow = null; doShow(); }, delayMs);
      } else {
        doShow();
      }
    }

    function doShow() {
      const template = document.getElementById('victory-screen');
      if (!template) { console.warn('Cutscenes.victory.show: no #victory-screen template'); return; }

      const fresh = mountWithFadeIn(template);
      liveScreen = fresh;

      const subtitleEl = fresh.querySelector('#victory-subtitle');
      const line3El    = fresh.querySelector('#victory-line3');
      const SUBTITLE = 'you have been deemed worthy';
      const LINE3    = 'arise and claim your place in the galactic community';

      // Magical reveal fires as the first friend starts fading in (2.5s CSS delay).
      timeouts.push(setTimeout(() => {
        if (liveScreen === fresh) playMagicalReveal();
      }, 2500));

      // Subtitle starts after the last friend has settled (~5.5s into scene).
      timeouts.push(setTimeout(() => {
        if (liveScreen !== fresh || !subtitleEl) return;
        typeIntoLine(fresh, subtitleEl, SUBTITLE, () => {
          timeouts.push(setTimeout(() => {
            if (liveScreen === fresh && line3El) typeIntoLine(fresh, line3El, LINE3);
          }, 800));
        });
      }, 5500));
    }

    function typeIntoLine(owner, el, text, onDone) {
      el.textContent = '';
      let i = 0;
      function step() {
        if (liveScreen !== owner || !el.isConnected) return;
        if (i >= text.length) { if (onDone) onDone(); return; }
        el.textContent += text[i];
        playTypeBeep();
        i++;
        timeouts.push(setTimeout(step, 38));
      }
      step();
    }

    function hide() {
      if (pendingShow) { clearTimeout(pendingShow); pendingShow = null; }
      clearAllTimeouts();
      if (liveScreen) {
        liveScreen.remove();
        liveScreen = null;
      }
    }

    function isVisible() { return liveScreen !== null; }

    return { show, hide, isVisible };
  })();

  return { init, defeat, victory };
})();
