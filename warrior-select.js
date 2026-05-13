// Warrior selection controller — companion to warrior-select.css and warriors.js.
//
// Public surface:
//   WarriorSelect.init(audioCtx)
//   WarriorSelect.show(onDone)   // onDone({ earth, alien }) fires after the VS screen
//   WarriorSelect.hide()         // cancel/teardown
//   WarriorSelect.isVisible()
//
// Templates (#warrior-select-screen, #vs-screen) live in index.html. Show()
// clones the warrior-select template (so re-entry restarts the carousel
// cleanly), wires up its own keyboard/click handlers, and tears them all
// down in hide().

window.WarriorSelect = (function () {
  const VS_AUTO_ADVANCE_MS = 2500;
  const PHASE_OVERLAY_MS   = 1500;
  const SLIDE_MS           = 230;

  let ctx = null;
  let liveScreen = null;     // cloned #warrior-select-screen
  let liveVS     = null;     // cloned #vs-screen
  let onDoneCb   = null;
  let phase = 'earth';
  let currentIdx = 0;
  let transitioning = false;
  let chosenEarth = null;
  let chosenAlien = null;
  let timeouts = [];
  let keyHandler = null;

  function init(audioCtx) { ctx = audioCtx; }

  function clearAllTimeouts() {
    timeouts.forEach(clearTimeout);
    timeouts = [];
  }

  function getRoster() {
    return phase === 'earth' ? Warriors.earth : Warriors.alien;
  }

  function show(onDone) {
    hide();
    onDoneCb = onDone || null;
    phase = 'earth';
    currentIdx = 0;
    transitioning = false;
    chosenEarth = null;
    chosenAlien = null;

    const template = document.getElementById('warrior-select-screen');
    if (!template) {
      console.warn('WarriorSelect.show: no #warrior-select-screen template');
      return;
    }

    // Hide any other overlays so only this screen is visible.
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.add('hidden');
    const narrativeScreen = document.getElementById('narrative-screen');
    if (narrativeScreen) narrativeScreen.classList.add('hidden');
    if (window.showStarCanvas) window.showStarCanvas(true);

    const fresh = template.cloneNode(true);
    fresh.classList.remove('hidden');
    fresh.style.opacity = '0';
    fresh.style.transition = 'opacity 600ms ease-in';
    template.parentNode.insertBefore(fresh, template.nextSibling);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (fresh.isConnected) fresh.style.opacity = '1';
    }));
    liveScreen = fresh;

    bindUI(fresh);
    bindKeys();
    setupPhase('earth');
  }

  // ─── DOM bindings ──────────────────────────────────────────────────────────

  function bindUI(root) {
    root.querySelector('.ws-prev-btn').addEventListener('click', () => switchWarrior(-1));
    root.querySelector('.ws-next-btn').addEventListener('click', () => switchWarrior(1));
    root.querySelector('.ws-test-fire-btn').addEventListener('click', testFire);
    root.querySelector('.ws-burst-btn').addEventListener('click', testBurst);
    root.querySelector('.ws-select-btn').addEventListener('click', lockIn);
  }

  function bindKeys() {
    keyHandler = (e) => {
      if (!liveScreen && !liveVS) return;
      // VS screen: any key skips ahead.
      if (liveVS) {
        e.preventDefault();
        finishVS();
        return;
      }
      if (transitioning) return;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); switchWarrior(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); switchWarrior(1); }
      else if (e.key === 'Enter')      { e.preventDefault(); lockIn(); }
    };
    document.addEventListener('keydown', keyHandler);
  }

  function unbindKeys() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  function setColor(c) {
    if (liveScreen) liveScreen.style.setProperty('--ws-color', c);
  }

  function buildCounter(n) {
    if (!liveScreen) return;
    const counter = liveScreen.querySelector('.ws-counter');
    counter.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'ws-counter-dot';
      counter.appendChild(d);
    }
  }

  function renderWarrior(idx) {
    if (!liveScreen) return;
    const w = getRoster()[idx];
    setColor(w.color);

    const $ = (sel) => liveScreen.querySelector(sel);

    const nameEl = $('.ws-name');
    nameEl.textContent = w.name;
    nameEl.style.color = w.color;
    $('.ws-weapon').textContent = `Weapon: ${w.weapon}`;
    $('.ws-lore').textContent = w.lore;

    // Reset bars to 0, then animate to target on next frame so the CSS
    // transition replays each card switch.
    const bars = {
      power:   $('.ws-stat-power   .ws-stat-bar-fill'),
      speed:   $('.ws-stat-speed   .ws-stat-bar-fill'),
      rate:    $('.ws-stat-rate    .ws-stat-bar-fill'),
      deflect: $('.ws-stat-deflect .ws-stat-bar-fill'),
    };
    Object.values(bars).forEach(b => { b.style.width = '0%'; b.style.background = w.color; });
    requestAnimationFrame(() => {
      bars.power.style.width   = w.power   + '%';
      bars.speed.style.width   = w.speed   + '%';
      bars.rate.style.width    = w.rate    + '%';
      bars.deflect.style.width = w.deflect + '%';
    });

    const paddle = $('.ws-paddle-visual');
    paddle.style.background = w.color;
    paddle.style.boxShadow =
      `0 0 10px ${w.color}88, 0 0 25px ${w.color}44, inset 0 0 6px rgba(255,255,255,0.2)`;

    liveScreen.querySelectorAll('.ws-counter-dot').forEach((dot, i) => {
      dot.style.background = i === idx ? w.color : 'rgba(255,255,255,0.1)';
      dot.style.boxShadow  = i === idx ? `0 0 8px ${w.color}` : 'none';
    });

    $('.ws-burst-btn').textContent = `>>> Burst (${w.burst}x)`;
  }

  function setupPhase(p) {
    if (!liveScreen) return;
    phase = p;
    currentIdx = 0;
    const roster = getRoster();
    buildCounter(roster.length);

    const $ = (sel) => liveScreen.querySelector(sel);
    $('.ws-faction-icon').textContent = p === 'earth' ? '🌍' : '👾';
    const tag = $('.ws-faction-tag');
    tag.textContent = p === 'earth' ? 'Earth Defense' : 'Alien Invaders';
    tag.classList.remove('earth', 'alien');
    tag.classList.add(p === 'earth' ? 'earth' : 'alien');
    $('.ws-phase-sub').textContent  = p === 'earth' ? 'Step 1 of 2' : 'Step 2 of 2';
    $('.ws-phase-title').textContent = p === 'earth' ? 'Choose Your Warrior' : 'Choose Your Opponent';

    renderWarrior(0);
  }

  // ─── Carousel motion ───────────────────────────────────────────────────────

  function playCarouselSwipe(dir) {
    if (!ctx || ctx.state === 'suspended') return;
    const t = ctx.currentTime;

    // Tonal sweep: rises right, falls left
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(dir > 0 ? 190 : 430, t);
    osc.frequency.exponentialRampToValueAtTime(dir > 0 ? 430 : 190, t + 0.18);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.022);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.23);

    // High-passed noise whoosh underneath
    const dur    = 0.2;
    const bufLen = Math.ceil(ctx.sampleRate * dur);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0, t);
    ng.gain.linearRampToValueAtTime(0.045, t + 0.05);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
    noise.start(t); noise.stop(t + dur + 0.02);
  }

  function switchWarrior(dir) {
    if (transitioning || !liveScreen) return;
    if (ctx && ctx.state === 'suspended') ctx.resume();
    playCarouselSwipe(dir);
    transitioning = true;
    const card   = liveScreen.querySelector('.ws-card');
    const roster = getRoster();
    const outCls = dir > 0 ? 'slide-out-left'  : 'slide-out-right';
    const inCls  = dir > 0 ? 'slide-in-left'   : 'slide-in-right';
    card.classList.add(outCls);
    timeouts.push(setTimeout(() => {
      card.classList.remove(outCls);
      currentIdx = (currentIdx + dir + roster.length) % roster.length;
      renderWarrior(currentIdx);
      card.classList.add(inCls);
      timeouts.push(setTimeout(() => {
        card.classList.remove(inCls);
        transitioning = false;
      }, SLIDE_MS - 10));
    }, SLIDE_MS));
  }

  // ─── Test fire / burst ─────────────────────────────────────────────────────

  function fireBulletVisual() {
    if (!liveScreen) return;
    const w   = getRoster()[currentIdx];
    const dir = phase === 'alien' ? -1 : 1;
    const stage = liveScreen.querySelector('.ws-bullet-demo');
    if (!stage) return;
    const dot = document.createElement('div');
    dot.style.cssText =
      `position:absolute;width:6px;height:6px;border-radius:50%;` +
      `background:${w.color};box-shadow:0 0 6px ${w.color};` +
      `left:50%;top:50%;opacity:1;pointer-events:none;`;
    stage.appendChild(dot);
    let x = 0;
    const step = () => {
      x += 6;
      dot.style.transform = `translate(calc(-50% + ${x * dir}px), -50%)`;
      dot.style.opacity = Math.max(0, 1 - x / 100);
      if (x < 110 && dot.isConnected) requestAnimationFrame(step);
      else dot.remove();
    };
    requestAnimationFrame(step);
  }

  function testFire() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    getRoster()[currentIdx].fire(ctx);
    fireBulletVisual();
  }

  function testBurst() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const w = getRoster()[currentIdx];
    for (let i = 0; i < w.burst; i++) {
      timeouts.push(setTimeout(() => {
        if (!liveScreen) return;
        w.fire(ctx);
        fireBulletVisual();
      }, i * 120));
    }
  }

  // ─── Lock in / phase advance / VS screen ───────────────────────────────────

  function lockIn() {
    if (transitioning || !liveScreen) return;
    transitioning = true;
    const w = getRoster()[currentIdx];
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (ctx) {
      w.fire(ctx);
      timeouts.push(setTimeout(() => w.fire(ctx), 120));
      timeouts.push(setTimeout(() => w.fire(ctx), 240));
    }

    if (phase === 'earth') {
      chosenEarth = w;
      showPhaseOverlay(w, 'Warrior Locked In', `${w.weapon}  •  Now choose your alien opponent...`, () => {
        setupPhase('alien');
        transitioning = false;
      });
    } else {
      chosenAlien = w;
      showPhaseOverlay(w, 'Opponent Locked In', w.weapon, () => {
        showVsScreen();
        transitioning = false;
      });
    }
  }

  function showPhaseOverlay(w, sub, summary, onClose) {
    const overlay = document.createElement('div');
    overlay.id = 'warrior-select-overlay';
    overlay.classList.add('show');
    overlay.innerHTML =
      `<div class="ws-overlay-name" style="color:${w.color}">${escapeHtml(w.name)}</div>` +
      `<div class="ws-overlay-sub">${escapeHtml(sub)}</div>` +
      `<div class="ws-overlay-summary">${escapeHtml(summary)}</div>`;
    document.body.appendChild(overlay);
    timeouts.push(setTimeout(() => {
      overlay.remove();
      if (onClose) onClose();
    }, PHASE_OVERLAY_MS));
  }

  function showVsScreen() {
    if (liveScreen) {
      liveScreen.remove();
      liveScreen = null;
    }
    const template = document.getElementById('vs-screen');
    if (!template) {
      console.warn('WarriorSelect.showVsScreen: no #vs-screen template');
      finishVS();
      return;
    }
    const fresh = template.cloneNode(true);
    fresh.classList.remove('hidden');
    document.body.appendChild(fresh);
    liveVS = fresh;

    const $ = (sel) => fresh.querySelector(sel);
    $('.vs-earth-name').textContent   = chosenEarth.name;
    $('.vs-earth-name').style.color   = chosenEarth.color;
    $('.vs-earth-weapon').textContent = chosenEarth.weapon;
    const ep = $('.vs-earth-paddle');
    ep.style.background = chosenEarth.color;
    ep.style.color      = chosenEarth.color;

    $('.vs-alien-name').textContent   = chosenAlien.name;
    $('.vs-alien-name').style.color   = chosenAlien.color;
    $('.vs-alien-weapon').textContent = chosenAlien.weapon;
    const ap = $('.vs-alien-paddle');
    ap.style.background = chosenAlien.color;
    ap.style.color      = chosenAlien.color;

    const vsText = $('.vs-text');
    vsText.style.background              = `linear-gradient(135deg, ${chosenEarth.color}, ${chosenAlien.color})`;
    vsText.style.webkitBackgroundClip    = 'text';
    vsText.style.webkitTextFillColor     = 'transparent';

    if (ctx) {
      chosenEarth.fire(ctx);
      timeouts.push(setTimeout(() => chosenAlien.fire(ctx), 300));
    }

    timeouts.push(setTimeout(finishVS, VS_AUTO_ADVANCE_MS));
  }

  function finishVS() {
    if (!liveVS) return;
    clearAllTimeouts();
    liveVS.remove();
    liveVS = null;
    unbindKeys();
    const cb = onDoneCb;
    onDoneCb = null;
    if (cb) cb({ earth: chosenEarth, alien: chosenAlien });
  }

  // ─── Teardown ──────────────────────────────────────────────────────────────

  function hide() {
    clearAllTimeouts();
    unbindKeys();
    if (liveScreen) { liveScreen.remove(); liveScreen = null; }
    if (liveVS)     { liveVS.remove();     liveVS = null;     }
    const overlay = document.getElementById('warrior-select-overlay');
    if (overlay) overlay.remove();
    onDoneCb = null;
    transitioning = false;
  }

  function isVisible() { return liveScreen !== null || liveVS !== null; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }

  return { init, show, hide, isVisible };
})();
