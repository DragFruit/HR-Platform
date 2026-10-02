/**
 * Звуки заезда Pit Stop — синтез Web Audio (бесплатно, без внешних файлов).
 * Движок (многослойный), визг в повороте, удар о бортик, триумф + аплодисменты.
 */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let engineBus: GainNode | null = null;
let engOscLow: OscillatorNode | null = null;
let engOscMid: OscillatorNode | null = null;
let engOscHigh: OscillatorNode | null = null;
let engMixGain: GainNode | null = null;
let engFilter: BiquadFilterNode | null = null;
let engShaper: WaveShaperNode | null = null;
let exhaustNoise: AudioBufferSourceNode | null = null;
let exhaustGain: GainNode | null = null;
let exhaustFilter: BiquadFilterNode | null = null;
let tireOsc: OscillatorNode | null = null;
let tireGain: GainNode | null = null;
let unlocked = false;
let bumpCooldown = 0;
let triumphPlaying = false;

const makeSaturationCurve = (drive: number) => {
  const n = 256;
  const curve = new Float32Array(n);
  const k = Math.max(0.5, drive);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
};

const loopNoiseBuffer = (c: Ctx, seconds = 0.25) => {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
};

const ensure = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.52;
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
  if (!c || !master || engOscMid) return;

  engineBus = c.createGain();
  engineBus.gain.value = 0;
  engMixGain = c.createGain();
  engMixGain.gain.value = 0.85;

  engFilter = c.createBiquadFilter();
  engFilter.type = 'lowpass';
  engFilter.frequency.value = 520;
  engFilter.Q.value = 0.65;

  engShaper = c.createWaveShaper();
  engShaper.curve = makeSaturationCurve(2.2);
  engShaper.oversample = '2x';

  engOscLow = c.createOscillator();
  engOscLow.type = 'sine';
  engOscLow.frequency.value = 38;

  engOscMid = c.createOscillator();
  engOscMid.type = 'sawtooth';
  engOscMid.frequency.value = 76;

  engOscHigh = c.createOscillator();
  engOscHigh.type = 'triangle';
  engOscHigh.frequency.value = 152;

  const lowG = c.createGain();
  lowG.gain.value = 0.55;
  const midG = c.createGain();
  midG.gain.value = 0.32;
  const highG = c.createGain();
  highG.gain.value = 0.12;

  exhaustFilter = c.createBiquadFilter();
  exhaustFilter.type = 'bandpass';
  exhaustFilter.frequency.value = 420;
  exhaustFilter.Q.value = 1.1;

  exhaustGain = c.createGain();
  exhaustGain.gain.value = 0;

  exhaustNoise = c.createBufferSource();
  exhaustNoise.buffer = loopNoiseBuffer(c);
  exhaustNoise.loop = true;

  engOscLow.connect(lowG);
  engOscMid.connect(midG);
  engOscHigh.connect(highG);
  lowG.connect(engMixGain);
  midG.connect(engMixGain);
  highG.connect(engMixGain);

  exhaustNoise.connect(exhaustFilter);
  exhaustFilter.connect(exhaustGain);
  exhaustGain.connect(engMixGain);

  engMixGain.connect(engFilter);
  engFilter.connect(engShaper);
  engShaper.connect(engineBus);
  engineBus.connect(master);

  engOscLow.start();
  engOscMid.start();
  engOscHigh.start();
  exhaustNoise.start();

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

/** 0…1 throttle/speed — громкость и обороты. */
export const setEngine = (speedNorm: number, throttle: number) => {
  if (!unlocked || !ctx || !engOscMid || !engineBus || !engFilter) return;
  const t = ctx.currentTime;
  const th = Math.max(0, Math.min(1, throttle));
  const sp = Math.max(0, Math.min(1, speedNorm));
  const load = Math.min(1, sp * 0.85 + th * 0.55);
  const going = sp > 0.02 || th > 0.05;

  const rpmHz = going ? 28 + load * 118 + th * 22 : 22;
  const f0 = rpmHz;
  const f1 = rpmHz * 2.01;
  const f2 = rpmHz * 3.08;

  engOscLow!.frequency.setTargetAtTime(f0 * 0.5, t, 0.07);
  engOscMid!.frequency.setTargetAtTime(f1, t, 0.06);
  engOscHigh!.frequency.setTargetAtTime(f2, t, 0.05);
  const cutoff = going ? 380 + load * 4200 + th * 600 : 280;
  engFilter.frequency.setTargetAtTime(cutoff, t, 0.09);
  engFilter.Q.setTargetAtTime(going ? 0.55 + load * 0.35 : 0.4, t, 0.12);

  if (exhaustFilter) {
    exhaustFilter.frequency.setTargetAtTime(280 + load * 2200, t, 0.08);
  }

  const vol = going ? 0.035 + load * 0.11 + th * 0.045 : 0;
  engineBus.gain.setTargetAtTime(vol, t, 0.07);

  if (exhaustGain) {
    const exh = going ? 0.012 + load * 0.055 + th * 0.02 : 0;
    exhaustGain.gain.setTargetAtTime(exh, t, 0.06);
  }
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
