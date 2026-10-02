/**
 * Звуки заезда Pit Stop — синтез Web Audio (бесплатно, без внешних файлов).
 * Движок, визг в повороте, тихий удар о бортик, триумф + аплодисменты.
 */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let engineLfo: OscillatorNode | null = null;
let tireOsc: OscillatorNode | null = null;
let tireGain: GainNode | null = null;
let unlocked = false;
let bumpCooldown = 0;
let triumphPlaying = false;

const ensure = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  return ctx;
};

export const unlockRaceAudio = async () => {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      /* autoplay policy */
    }
  }
  unlocked = c.state === 'running';
  if (unlocked) startLoops();
};

const startLoops = () => {
  const c = ensure();
  if (!c || !master || engineOsc) return;

  engineOsc = c.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineGain = c.createGain();
  engineGain.gain.value = 0;
  const engFilter = c.createBiquadFilter();
  engFilter.type = 'lowpass';
  engFilter.frequency.value = 420;
  engineLfo = c.createOscillator();
  engineLfo.frequency.value = 8;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 4;
  engineLfo.connect(lfoGain);
  lfoGain.connect(engineOsc.frequency);
  engineOsc.connect(engFilter);
  engFilter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
  engineLfo.start();

  tireOsc = c.createOscillator();
  tireOsc.type = 'triangle';
  tireOsc.frequency.value = 180;
  tireGain = c.createGain();
  tireGain.gain.value = 0;
  const tireFilter = c.createBiquadFilter();
  tireFilter.type = 'bandpass';
  tireFilter.frequency.value = 900;
  tireFilter.Q.value = 4;
  tireOsc.connect(tireFilter);
  tireFilter.connect(tireGain);
  tireGain.connect(master);
  tireOsc.start();
};

/** 0…1 throttle/speed — громкость и тон разгона. */
export const setEngine = (speedNorm: number, throttle: number) => {
  if (!unlocked || !ctx || !engineOsc || !engineGain) return;
  const t = ctx.currentTime;
  const going = speedNorm > 0.02 || throttle > 0.05;
  const target = going ? 0.04 + speedNorm * 0.1 + Math.max(0, throttle) * 0.04 : 0;
  engineGain.gain.setTargetAtTime(target, t, 0.08);
  engineOsc.frequency.setTargetAtTime(55 + speedNorm * 140 + Math.max(0, throttle) * 30, t, 0.1);
};

/** |steer| 0…1 при скорости — лёгкий визг шин. */
export const setSteer = (amount: number, speedNorm: number) => {
  if (!unlocked || !ctx || !tireGain || !tireOsc) return;
  const t = ctx.currentTime;
  const a = Math.min(1, Math.abs(amount)) * Math.min(1, speedNorm * 1.4);
  tireGain.gain.setTargetAtTime(a > 0.25 ? a * 0.045 : 0, t, 0.06);
  tireOsc.frequency.setTargetAtTime(160 + a * 220, t, 0.08);
};

/** Тихий приглушённый удар о стенку. */
export const playBump = (strength = 0.5) => {
  const c = ensure();
  if (!c || !master || !unlocked) return;
  const now = c.currentTime;
  if (now < bumpCooldown) return;
  bumpCooldown = now + 0.12;
  const s = Math.max(0.15, Math.min(1, strength));

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 90 + s * 40;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.07 * s, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

  const noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.08), c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.04 * s, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 280;

  osc.connect(g);
  g.connect(master);
  noise.connect(lp);
  lp.connect(ng);
  ng.connect(master);
  osc.start(now);
  osc.stop(now + 0.16);
  noise.start(now);
  noise.stop(now + 0.09);
};

/** Триумф + аплодисменты (только при рекорде). */
export const playTriumph = () => {
  const c = ensure();
  if (!c || !master || !unlocked || triumphPlaying) return;
  triumphPlaying = true;
  const now = c.currentTime;

  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = c.createGain();
    const t0 = now + i * 0.12;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(g);
    g.connect(master!);
    osc.start(t0);
    osc.stop(t0 + 0.6);
  });

  const dur = 2.8;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.min(1, i / (c.sampleRate * 0.15)) * Math.max(0, 1 - i / data.length);
    const clap = Math.random() < 0.08 ? (Math.random() * 2 - 1) : (Math.random() * 2 - 1) * 0.15;
    data[i] = clap * env * 0.35;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.7;
  const g = c.createGain();
  g.gain.value = 0.55;
  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(now);
  src.stop(now + dur);
  src.onended = () => {
    triumphPlaying = false;
  };
};

export const hushEngine = () => {
  setEngine(0, 0);
  setSteer(0, 0);
};
