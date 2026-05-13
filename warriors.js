// Warrior roster — pure data + per-warrior fire() audio synth.
// Consumed by warrior-select.js (UI) and index.html (gameplay).
//
// Each warrior:
//   { name, weapon, color, lore, power, speed, rate, deflect, burst, fire(ctx) }
// Stats are 0-100. fire(ctx) takes a shared AudioContext and plays a one-shot SFX.

window.Warriors = (function () {

  // ─── Earth — pre-spacefaring human tech ─────────────────────────────────
  const earth = [
    {
      name: "Kira",
      weapon: "Slug Cannon",
      color: "#ff4081",
      lore: "Ex-artillery officer. Kinetic rounds — pure gunpowder and steel. What she lacks in finesse, she makes up in raw stopping power.",
      power: 80, speed: 60, rate: 55, deflect: 65, burst: 3,
      fire(ctx) {
        const t = ctx.currentTime;
        const bufSize = ctx.sampleRate * 0.08;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
        const n = ctx.createBufferSource(); n.buffer = buf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.35, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(2500, t);
        lp.frequency.exponentialRampToValueAtTime(400, t + 0.08);
        n.connect(lp).connect(ng).connect(ctx.destination);
        n.start(t); n.stop(t + 0.1);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(180, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.14);
      }
    },
    {
      name: "Gorak",
      weapon: "Railgun Mk I",
      color: "#ffd740",
      lore: "Built from scrapyard magnets and sheer stubbornness. Slow to charge, but nothing survives the impact. A garage-born doomsday device.",
      power: 95, speed: 40, rate: 30, deflect: 40, burst: 2,
      fire(ctx) {
        const t = ctx.currentTime;
        const w = ctx.createOscillator(), wg = ctx.createGain();
        w.type = 'sawtooth';
        w.frequency.setValueAtTime(120, t);
        w.frequency.exponentialRampToValueAtTime(800, t + 0.12);
        wg.gain.setValueAtTime(0.08, t);
        wg.gain.linearRampToValueAtTime(0.2, t + 0.11);
        wg.gain.setValueAtTime(0.001, t + 0.12);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
        w.connect(lp).connect(wg).connect(ctx.destination);
        w.start(t); w.stop(t + 0.14);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(200, t + 0.12);
        o.frequency.exponentialRampToValueAtTime(30, t + 0.25);
        g.gain.setValueAtTime(0.4, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.connect(g).connect(ctx.destination);
        o.start(t + 0.12); o.stop(t + 0.28);
      }
    },
    {
      name: "Pip",
      weapon: "Nail Gun",
      color: "#69f0ae",
      lore: "Hardware store hero. Rapid-fire nails won't punch deep, but good luck getting a ball past this scrapper. Born to defend.",
      power: 25, speed: 95, rate: 100, deflect: 95, burst: 7,
      fire(ctx) {
        const t = ctx.currentTime;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(880, t);
        o.frequency.setValueAtTime(660, t + 0.015);
        o.frequency.setValueAtTime(440, t + 0.03);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.06);
      }
    },
    {
      name: "Seren",
      weapon: "EMP Launcher",
      color: "#ff6e40",
      lore: "Military engineer who jury-rigged an electromagnetic pulse into a weapon. Disrupts anything it touches. Solid all-rounder.",
      power: 70, speed: 65, rate: 50, deflect: 75, burst: 4,
      fire(ctx) {
        const t = ctx.currentTime;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(400, t);
        o.frequency.exponentialRampToValueAtTime(100, t + 0.12);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 3;
        o.connect(bp).connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.16);
        const bs = ctx.sampleRate * 0.06;
        const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
        const n = ctx.createBufferSource(); n.buffer = buf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.15, t + 0.03);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        n.connect(ng).connect(ctx.destination);
        n.start(t + 0.03); n.stop(t + 0.11);
      }
    }
  ];

  // ─── Aliens — advanced extraterrestrial tech ────────────────────────────
  const alien = [
    {
      name: "Azurion",
      weapon: "Plasma Bolt",
      color: "#00e5ff",
      lore: "Born from collapsing stars. Plasma bolts phase through matter — technology far beyond human comprehension.",
      power: 55, speed: 85, rate: 80, deflect: 70, burst: 5,
      fire(ctx) {
        const t = ctx.currentTime;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1800, t);
        o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.15);
      }
    },
    {
      name: "Vex",
      weapon: "Laser Whip",
      color: "#7c4dff",
      lore: "A rogue signal given physical form. Cracks a photonic whip that bends spacetime. Untouchable reflexes.",
      power: 60, speed: 90, rate: 75, deflect: 85, burst: 4,
      fire(ctx) {
        const t = ctx.currentTime;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(2400, t);
        o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
        g.gain.setValueAtTime(0.3, t);
        g.gain.linearRampToValueAtTime(0.15, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.18);
      }
    },
    {
      name: "Nyx",
      weapon: "Void Spit",
      color: "#b388ff",
      lore: "Spits compressed dark matter. Each shot tears a micro-hole in spacetime. Unpredictable angles on defense.",
      power: 70, speed: 70, rate: 60, deflect: 80, burst: 4,
      fire(ctx) {
        const t = ctx.currentTime;
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(1000, t);
        o.frequency.exponentialRampToValueAtTime(250, t + 0.08);
        og.gain.setValueAtTime(0.2, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 5;
        o.connect(bp).connect(og).connect(ctx.destination);
        o.start(t); o.stop(t + 0.16);
        const bs = ctx.sampleRate * 0.1;
        const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
        const n = ctx.createBufferSource(); n.buffer = buf;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.08, t + 0.02);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass';
        bp2.frequency.setValueAtTime(1200, t);
        bp2.frequency.exponentialRampToValueAtTime(400, t + 0.1);
        bp2.Q.value = 8;
        n.connect(bp2).connect(ng).connect(ctx.destination);
        n.start(t + 0.02); n.stop(t + 0.14);
      }
    },
    {
      name: "Lyric",
      weapon: "Harmonic Disruptor",
      color: "#84ffff",
      lore: "Weaponized frequency. Two tuned tones that shatter molecular bonds on resonance. Fast but fragile.",
      power: 50, speed: 80, rate: 85, deflect: 55, burst: 5,
      fire(ctx) {
        const t = ctx.currentTime;
        const o1 = ctx.createOscillator(), g1 = ctx.createGain();
        o1.type = 'sine'; o1.frequency.value = 1320;
        g1.gain.setValueAtTime(0.25, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        o1.connect(g1).connect(ctx.destination);
        o1.start(t); o1.stop(t + 0.05);
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.type = 'sine'; o2.frequency.value = 1980;
        g2.gain.setValueAtTime(0.2, t + 0.04);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        o2.connect(g2).connect(ctx.destination);
        o2.start(t + 0.04); o2.stop(t + 0.1);
      }
    }
  ];

  return { earth, alien };
})();
