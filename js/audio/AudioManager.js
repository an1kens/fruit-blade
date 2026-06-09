import { CONFIG } from '../config.js';

/** Per-fruit slice signatures — one tone + optional noise crunch. */
const FRUIT_SLICE_PROFILES = {
  apple: { osc: { type: 'square', start: 920, end: 280, decay: 0.06 }, noise: { dur: 0.04, vol: 0.14 } },
  banana: { osc: { type: 'sine', start: 320, end: 140, decay: 0.1 }, noise: null },
  orange: { osc: { type: 'triangle', start: 480, end: 190, decay: 0.08 }, noise: { dur: 0.05, vol: 0.16 } },
  watermelon: { osc: { type: 'sawtooth', start: 260, end: 90, decay: 0.11 }, noise: { dur: 0.07, vol: 0.18 } },
  pineapple: { osc: { type: 'square', start: 780, end: 320, decay: 0.05 }, noise: { dur: 0.04, vol: 0.12 } },
  strawberry: { osc: { type: 'sine', start: 680, end: 420, decay: 0.07 }, noise: { dur: 0.025, vol: 0.1 } },
  mango: { osc: { type: 'triangle', start: 420, end: 160, decay: 0.1 }, noise: { dur: 0.05, vol: 0.14 } },
  kiwi: { osc: { type: 'sine', start: 540, end: 260, decay: 0.08 }, noise: { dur: 0.04, vol: 0.11 } },
  coconut: { osc: { type: 'square', start: 620, end: 180, decay: 0.045 }, noise: { dur: 0.03, vol: 0.1 } },
  peach: { osc: { type: 'triangle', start: 390, end: 150, decay: 0.09 }, noise: { dur: 0.05, vol: 0.15 } },
};

const LEGACY_SLICE_PROFILES = {
  crisp: { freq: 800, type: 'square', decay: 0.07 },
  soft: { freq: 400, type: 'sine', decay: 0.1 },
  squish: { freq: 200, type: 'sawtooth', decay: 0.12 },
  wet: { freq: 300, type: 'triangle', decay: 0.14 },
};

const PENTATONIC = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25];
const MELODY = [0, 2, 4, 2, 1, 2, 4, 5, 4, 2, 1, 0, 2, 4, 5, 4, 2, 1];

const SLICE_MIN_INTERVAL_MS = 55;
const COMBO_MIN_INTERVAL_MS = 320;
const MAX_SLICE_VOICES = 6;

/**
 * Procedural audio via Web Audio API — throttled per-fruit SFX and Japanese-style BGM.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicNodes = [];
    this.musicPlaying = false;
    this.melodyTimer = null;
    this.melodyStep = 0;
    this.noiseBuffer = null;
    this.sliceVoiceCount = 0;
    this.lastSliceAt = 0;
    this.lastComboAt = 0;
    this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG.audio.storageKey) || '{}');
      this.musicVolume = saved.musicVolume ?? CONFIG.audio.defaultMusicVolume;
      this.sfxVolume = saved.sfxVolume ?? CONFIG.audio.defaultSfxVolume;
    } catch {
      this.musicVolume = CONFIG.audio.defaultMusicVolume;
      this.sfxVolume = CONFIG.audio.defaultSfxVolume;
    }
  }

  saveSettings() {
    localStorage.setItem(
      CONFIG.audio.storageKey,
      JSON.stringify({ musicVolume: this.musicVolume, sfxVolume: this.sfxVolume })
    );
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain.gain.value = this.musicVolume;
    this.sfxGain.gain.value = this.sfxVolume;
    this.noiseBuffer = this.createNoiseBuffer(0.12);
  }

  createNoiseBuffer(durationSec) {
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = Math.ceil(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  async resume() {
    await this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  ensureRunning() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
    this.saveSettings();
  }

  setSfxVolume(v) {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
    this.saveSettings();
  }

  canPlaySlice() {
    const now = performance.now();
    if (this.sliceVoiceCount >= MAX_SLICE_VOICES) return false;
    if (now - this.lastSliceAt < SLICE_MIN_INTERVAL_MS) return false;
    this.lastSliceAt = now;
    return true;
  }

  canPlayCombo() {
    const now = performance.now();
    if (now - this.lastComboAt < COMBO_MIN_INTERVAL_MS) return false;
    this.lastComboAt = now;
    return true;
  }

  trackSliceVoice(durationSec) {
    this.sliceVoiceCount += 1;
    window.setTimeout(() => {
      this.sliceVoiceCount = Math.max(0, this.sliceVoiceCount - 1);
    }, Math.ceil(durationSec * 1000) + 20);
  }

  scheduleGainDecay(gainParam, startTime, peak, durationSec) {
    gainParam.setValueAtTime(peak, startTime);
    gainParam.linearRampToValueAtTime(0.0001, startTime + durationSec);
  }

  /**
   * @param {string} fruitTypeOrLegacy - fruit id (apple, mango…) or legacy profile (crisp, soft…)
   */
  playSlice(fruitTypeOrLegacy = 'apple') {
    if (!this.ctx || !this.canPlaySlice()) return;
    this.ensureRunning();

    const fruitProfile = FRUIT_SLICE_PROFILES[fruitTypeOrLegacy];
    if (fruitProfile) {
      this.playFruitSlice(fruitProfile);
      return;
    }

    const legacy = LEGACY_SLICE_PROFILES[fruitTypeOrLegacy] || LEGACY_SLICE_PROFILES.crisp;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = legacy.type;
    osc.frequency.setValueAtTime(legacy.freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, legacy.freq * 0.3), t + legacy.decay);
    filter.type = 'bandpass';
    filter.frequency.value = legacy.freq;
    this.scheduleGainDecay(gain.gain, t, 0.22, legacy.decay);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + legacy.decay + 0.05);
    this.playNoiseBurst(0.05, 0.1);
    this.trackSliceVoice(legacy.decay);
  }

  playFruitSlice(profile) {
    const t = this.ctx.currentTime;
    const { osc: o, noise } = profile;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.start, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.end), t + o.decay);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(o.start, t);
    filter.Q.value = 1.1;
    this.scheduleGainDecay(gain.gain, t, 0.24, o.decay);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + o.decay + 0.05);

    if (noise) this.playNoiseBurst(noise.dur, noise.vol);
    this.trackSliceVoice(o.decay);
  }

  playNoiseBurst(duration = 0.06, volume = 0.12) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    this.scheduleGainDecay(gain.gain, t, volume, duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t, 0, duration);
  }

  playCombo(level) {
    if (!this.ctx || !this.canPlayCombo()) return;
    this.ensureRunning();
    const t = this.ctx.currentTime;
    const noteCount = Math.min(3, 1 + Math.floor(level / 4));
    const notes = [493.88, 587.33, 659.25].slice(0, noteCount);
    notes.forEach((freq, i) => {
      const start = t + i * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.015);
      gain.gain.linearRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  playCritical() {
    if (!this.ctx) return;
    this.ensureRunning();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
    this.scheduleGainDecay(gain.gain, t, 0.2, 0.22);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  playBombSlice() {
    if (!this.ctx) return;
    this.ensureRunning();
    const t = this.ctx.currentTime;
    this.playNoiseBurst(0.14, 0.12);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    this.scheduleGainDecay(gain.gain, t, 0.22, 0.12);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playBomb() {
    if (!this.ctx) return;
    this.ensureRunning();
    const t = this.ctx.currentTime;
    this.playNoiseBurst(0.35, 0.35);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    this.scheduleGainDecay(gain.gain, t, 0.38, 0.55);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  playPowerUp(type = 'freeze') {
    if (!this.ctx) return;
    this.ensureRunning();
    const t = this.ctx.currentTime;
    const profiles = {
      freeze: { start: 520, end: 220, type: 'sine', dur: 0.28 },
      frenzy: { start: 180, end: 420, type: 'sawtooth', dur: 0.35 },
      double: { start: 660, end: 990, type: 'triangle', dur: 0.25 },
    };
    const p = profiles[type] || profiles.freeze;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.start, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, p.end), t + p.dur);
    this.scheduleGainDecay(gain.gain, t, 0.22, p.dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + p.dur + 0.08);
  }

  playMilestone(level = 3) {
    if (!this.ctx || !this.canPlayCombo()) return;
    this.ensureRunning();
    const t = this.ctx.currentTime;
    PENTATONIC.slice(2, 5).forEach((freq, i) => {
      const start = t + i * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.015);
      gain.gain.linearRampToValueAtTime(0.0001, start + 0.14);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  playMiss() {
    if (!this.ctx) return;
    this.ensureRunning();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.18);
    this.scheduleGainDecay(gain.gain, t, 0.12, 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  pluckKoto(freq, time, volume = 0.09) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + 0.35);
    this.scheduleGainDecay(gain.gain, time, volume, 0.4);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.45);
  }

  tickMelody() {
    if (!this.ctx || !this.musicPlaying) return;
    const t = this.ctx.currentTime;
    const idx = MELODY[this.melodyStep % MELODY.length];
    this.pluckKoto(PENTATONIC[idx], t, 0.075 + (idx % 2) * 0.01);
    if (this.melodyStep % 4 === 0) {
      this.pluckKoto(PENTATONIC[(idx + 2) % PENTATONIC.length] * 0.5, t, 0.028);
    }
    this.melodyStep += 1;
  }

  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    this.ensureRunning();
    this.musicPlaying = true;
    this.melodyStep = 0;
    const t = this.ctx.currentTime;

    const padFreqs = [146.83, 220, 293.66];
    for (const freq of padFreqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.024;
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      lfoGain.gain.value = 0.01;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      lfo.start(t);
      this.musicNodes.push(osc, lfo);
    }

    const pulse = this.ctx.createOscillator();
    const pulseGain = this.ctx.createGain();
    pulse.type = 'sine';
    pulse.frequency.value = 73.42;
    pulseGain.gain.value = 0.018;
    pulse.connect(pulseGain);
    pulseGain.connect(this.musicGain);
    pulse.start(t);
    this.musicNodes.push(pulse);

    this.tickMelody();
    this.melodyTimer = setInterval(() => this.tickMelody(), 480);
  }

  stopMusic() {
    if (this.melodyTimer) {
      clearInterval(this.melodyTimer);
      this.melodyTimer = null;
    }
    for (const node of this.musicNodes) {
      try { node.stop(); } catch { /* already stopped */ }
    }
    this.musicNodes = [];
    this.musicPlaying = false;
  }
}
