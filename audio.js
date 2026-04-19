// audio.js
// All sounds are synthesized via the Web Audio API — no audio files.
// Boots on first user interaction to comply with browser autoplay policies.

const STORAGE_KEY = "edulus.audio.muted";

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.humNodes = null;
    this.started = false;
    this.muted = this._loadMutedPref();
    this._bootHandler = null;
  }

  _loadMutedPref() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  _saveMutedPref() {
    try {
      localStorage.setItem(STORAGE_KEY, String(this.muted));
    } catch {
      /* ignore */
    }
  }

  /**
   * Arms a one-time listener that boots the audio context on first user
   * interaction (required by browser autoplay policies).
   */
  armAutoStart() {
    if (this.started) return;
    const boot = () => {
      this.start();
      window.removeEventListener("pointerdown", boot);
      window.removeEventListener("keydown", boot);
    };
    this._bootHandler = boot;
    window.addEventListener("pointerdown", boot);
    window.addEventListener("keydown", boot);
  }

  start() {
    if (this.started) return;
    this.started = true;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      console.warn("AudioEngine: Web Audio API not supported.");
      return;
    }
    this.ctx = new AC();
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(this.ctx.destination);

    this._startHum();
  }

  /**
   * Constant industrial purr — two detuned low oscillators through a lowpass
   * filter, with a slow LFO modulating amplitude for the "breathing" feel.
   */
  _startHum() {
    const ctx = this.ctx;

    const humBus = ctx.createGain();
    humBus.gain.value = 0;
    humBus.connect(this.masterGain);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    filter.Q.value = 0.7;
    filter.connect(humBus);

    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.value = 55;
    osc1.detune.value = -8;
    osc1.connect(filter);

    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = 82.5;
    osc2.detune.value = 6;
    osc2.connect(filter);

    // Slow amplitude LFO — the "purr"
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(humBus.gain);

    osc1.start();
    osc2.start();
    lfo.start();

    // Fade in (lowered from 0.18 → 0.07)
    const now = ctx.currentTime;
    humBus.gain.setValueAtTime(0, now);
    humBus.gain.linearRampToValueAtTime(0.07, now + 1.5);

    this.humNodes = { humBus, filter, osc1, osc2, lfo, lfoGain };
  }

  /**
   * Short hover chirp — a sine blip with a quick upward frequency sweep.
   * Pitch is varied by index so each button has its own voice.
   */
  playHoverChirp(index = 0) {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const baseFreqs = [880, 988, 1175, 1318, 1568]; // A5, B5, D6, E6, G6
    const f = baseFreqs[index % baseFreqs.length];

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Click engagement chirp — two-tone confirmation blip.
   */
  playClickChirp(index = 0) {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const baseFreqs = [660, 740, 880, 988, 1100];
    const f = baseFreqs[index % baseFreqs.length];

    this._blip(f, now, 0.06, 0.18);
    this._blip(f * 1.5, now + 0.05, 0.08, 0.16);
  }

  _blip(freq, startTime, duration, peak) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  /**
   * Rushing sound — filtered white noise with a rising lowpass cutoff,
   * suggesting acceleration toward something.
   * @param {number} duration seconds
   */
  playRush(duration = 0.35) {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(6000, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.5, now + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + duration + 0.02);
  }

  toggleMute() {
    this.muted = !this.muted;
    this._saveMutedPref();
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(
        this.muted ? 0 : 1,
        now + 0.08
      );
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  _ready() {
    return this.started && this.ctx && this.masterGain;
  }
}
