import { CONFIG } from '../config.js';

const BLADE_LANDMARKS = CONFIG.handTracking.bladeLandmarks || [8, 12];

/**
 * Real-time hand tracking using MediaPipe Hand Landmarker.
 * Tracks index + middle fingertip per hand (up to 4 blade trails).
 * Blade is inactive while the hand is in a fist (curled index + middle).
 */
export class HandTracker {
  constructor() {
    this.video = null;
    this.landmarker = null;
    this.running = false;
    this.hands = [];
    this.trails = new Map();
    this.velocityHistory = new Map();
    this.lastFrameTime = 0;
    this.mirror = true;
    this.calibrated = false;
    this.calibrationStart = 0;
    this.handsDetectedDuringCalibration = false;
    this.modelComplexity = CONFIG.handTracking.modelComplexity;
    this._cameraProfileKey = null;
    this.lastBBoxRatio = 0;
    this.enablePointerFallback = false;
    this.pointerActive = false;
    this.pointerTrail = [];
    this._pointerCanvas = null;
    this._onPointerDown = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
    this.detectMinIntervalMs = 0;
    this._lastDetectTime = 0;
    this.maxHands = CONFIG.handTracking.maxHands;
  }

  bindPointerFallback(canvas) {
    if (!canvas || this._pointerCanvas) return;
    this._pointerCanvas = canvas;

    this._onPointerDown = (e) => {
      if (!this.enablePointerFallback) return;
      this.pointerActive = true;
      this.pointerTrail = [];
      this._addPointerPoint(e);
    };
    this._onPointerMove = (e) => {
      if (!this.enablePointerFallback || !this.pointerActive) return;
      this._addPointerPoint(e);
    };
    this._onPointerUp = () => {
      this.pointerActive = false;
    };

    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerUp);
  }

  _addPointerPoint(e) {
    const rect = this._pointerCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();
    const prev = this.pointerTrail[this.pointerTrail.length - 1];
    let velocity = 0;
    if (prev) {
      const dt = Math.max((now - prev.time) / 1000, 0.001);
      const dx = x - prev.x;
      const dy = y - prev.y;
      velocity = Math.sqrt(dx * dx + dy * dy) / dt;
    }
    this.pointerTrail.push({ x, y, velocity, time: now });
    const maxAge = CONFIG.handTracking.trailMaxAge;
    while (this.pointerTrail.length > 0 && now - this.pointerTrail[0].time > maxAge) {
      this.pointerTrail.shift();
    }
    while (this.pointerTrail.length > CONFIG.handTracking.trailLength) {
      this.pointerTrail.shift();
    }

    const maxV = this.pointerTrail.reduce((m, p) => Math.max(m, p.velocity || 0), 0);
    this.hands = [{
      index: 0,
      x,
      y,
      wristX: x,
      wristY: y,
      velocity: maxV,
      bladeActive: true,
      landmarks: null,
      bboxRatio: 0.2,
    }];
    this.trails.set('pointer-8', [...this.pointerTrail]);
    this.handsDetectedDuringCalibration = true;
  }

  getDetectionProfile() {
    const lite = this.modelComplexity === 0;
    return {
      minHandDetectionConfidence: lite
        ? 0.5
        : CONFIG.handTracking.minDetectionConfidence,
      minHandPresenceConfidence: lite
        ? 0.45
        : CONFIG.handTracking.minTrackingConfidence,
      minTrackingConfidence: lite
        ? 0.45
        : CONFIG.handTracking.minTrackingConfidence,
    };
  }

  getCameraConstraints() {
    const cfg = CONFIG.handTracking;
    return {
      facingMode: 'user',
      width: { ideal: cfg.cameraIdealWidth, min: cfg.cameraMinWidth },
      height: { ideal: cfg.cameraIdealHeight, min: cfg.cameraMinHeight },
    };
  }

  setModelComplexity(complexity) {
    this.modelComplexity = complexity ?? CONFIG.handTracking.modelComplexity;
  }

  profileKeyForComplexity(complexity) {
    return `model-${complexity ?? CONFIG.handTracking.modelComplexity}`;
  }

  async syncPerformanceProfile(modelComplexity) {
    const next = modelComplexity ?? CONFIG.handTracking.modelComplexity;
    const prevComplexity = this.modelComplexity;
    const prevKey = this._cameraProfileKey;
    const profileKey = this.profileKeyForComplexity(next);

    if (prevComplexity === next && this.landmarker && prevKey === profileKey) {
      this.setModelComplexity(next);
      return this.getDetectionProfile();
    }

    this.setModelComplexity(next);
    const updated = this.getDetectionProfile();

    if (this.landmarker) {
      try {
        this.landmarker.close?.();
      } catch { /* ignore */ }
      this.landmarker = null;
      await this.loadModel();
    }

    this._cameraProfileKey = this.profileKeyForComplexity(next);
    return updated;
  }

  trailKey(handIndex, landmarkId) {
    return `${handIndex}-${landmarkId}`;
  }

  landmarkDist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  isFingerCurled(landmarks, tipIdx, pipIdx) {
    const wrist = landmarks[0];
    const ratio = CONFIG.handTracking.fistCurledRatio ?? 0.92;
    const tipDist = this.landmarkDist(landmarks[tipIdx], wrist);
    const pipDist = this.landmarkDist(landmarks[pipIdx], wrist);
    return tipDist < pipDist * ratio;
  }

  isBladeActive(landmarks) {
    const indexCurled = this.isFingerCurled(landmarks, 8, 6);
    const middleCurled = this.isFingerCurled(landmarks, 12, 10);
    return !(indexCurled && middleCurled);
  }

  clearHandTrails(handIndex) {
    for (const landmarkId of BLADE_LANDMARKS) {
      const key = this.trailKey(handIndex, landmarkId);
      const trail = this.trails.get(key);
      if (trail) trail.length = 0;
      this.velocityHistory.delete(key);
    }
  }

  /** Hand bounding box area as fraction of normalized frame (0–1). */
  getHandBBoxRatio(landmarks) {
    if (!landmarks?.length) return 0;
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    for (const lm of landmarks) {
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }
    return (maxX - minX) * (maxY - minY);
  }

  getDistanceHint(bboxRatio) {
    const cfg = CONFIG.handTracking;
    if (bboxRatio < (cfg.calibrationBBoxTooSmall ?? 0.08)) {
      return 'Move a little closer';
    }
    if (bboxRatio > (cfg.calibrationBBoxTooLarge ?? 0.38)) {
      return 'Move back slightly';
    }
    return '';
  }

  async startCamera(videoElement) {
    this.video = videoElement;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: this.getCameraConstraints(),
      audio: false,
    });

    this.video.srcObject = stream;
    await this.video.play();
    this.running = true;
    this.lastFrameTime = performance.now();
    this._cameraProfileKey = this.profileKeyForComplexity(this.modelComplexity);
  }

  async loadModel() {
    const vision = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm'
    );
    const { HandLandmarker, FilesetResolver } = vision;

    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    const profile = this.getDetectionProfile();
    const options = {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      },
      runningMode: 'VIDEO',
      numHands: this.maxHands,
      minHandDetectionConfidence: profile.minHandDetectionConfidence,
      minHandPresenceConfidence: profile.minHandPresenceConfidence,
      minTrackingConfidence: profile.minTrackingConfidence,
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: 'GPU' },
      });
    } catch (gpuError) {
      console.warn('GPU delegate failed, falling back to CPU:', gpuError);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: 'CPU' },
      });
    }
  }

  stop() {
    this.running = false;
    if (this.video?.srcObject) {
      this.video.srcObject.getTracks().forEach((t) => t.stop());
      this.video.srcObject = null;
    }
  }

  toCanvas(lm, canvasWidth, canvasHeight) {
    return {
      x: this.mirror ? (1 - lm.x) * canvasWidth : lm.x * canvasWidth,
      y: lm.y * canvasHeight,
    };
  }

  smoothVelocity(key, rawVelocity) {
    const window = CONFIG.handTracking.velocitySmoothWindow || 3;
    let hist = this.velocityHistory.get(key);
    if (!hist) {
      hist = [];
      this.velocityHistory.set(key, hist);
    }
    hist.push(rawVelocity);
    while (hist.length > window) hist.shift();
    return hist.reduce((a, b) => a + b, 0) / hist.length;
  }

  update(canvasWidth, canvasHeight) {
    if (this.enablePointerFallback && this.pointerActive) return;
    if (!this.running || !this.landmarker || this.video.readyState < 2) return;

    const now = performance.now();
    if (this.detectMinIntervalMs > 0 && now - this._lastDetectTime < this.detectMinIntervalMs) {
      return;
    }
    this._lastDetectTime = now;

    const dt = Math.max((now - this.lastFrameTime) / 1000, 0.001);
    this.lastFrameTime = now;

    const results = this.landmarker.detectForVideo(this.video, now);
    const activeKeys = new Set();

    this.hands = [];
    if (results.landmarks && results.landmarks.length > 0) {
      for (let h = 0; h < results.landmarks.length; h++) {
        const landmarks = results.landmarks[h];
        const wrist = this.toCanvas(landmarks[0], canvasWidth, canvasHeight);
        const bladeActive = this.isBladeActive(landmarks);
        let maxVelocity = 0;

        if (!bladeActive) {
          this.clearHandTrails(h);
        } else {
          for (const landmarkId of BLADE_LANDMARKS) {
            const key = this.trailKey(h, landmarkId);
            activeKeys.add(key);
            const tip = landmarks[landmarkId];
            const { x, y } = this.toCanvas(tip, canvasWidth, canvasHeight);

            let trail = this.trails.get(key);
            if (!trail) {
              trail = [];
              this.trails.set(key, trail);
            }

            const prev = trail[trail.length - 1];
            let rawVelocity = 0;
            if (prev) {
              const dx = x - prev.x;
              const dy = y - prev.y;
              rawVelocity = Math.sqrt(dx * dx + dy * dy) / dt;
            }
            const velocity = this.smoothVelocity(key, rawVelocity);
            maxVelocity = Math.max(maxVelocity, velocity);

            trail.push({ x, y, velocity, time: now, landmarkId });

            const maxAge = CONFIG.handTracking.trailMaxAge;
            while (trail.length > 0 && now - trail[0].time > maxAge) trail.shift();
            while (trail.length > CONFIG.handTracking.trailLength) trail.shift();
          }
        }

        const indexTip = this.toCanvas(landmarks[8], canvasWidth, canvasHeight);
        const bboxRatio = this.getHandBBoxRatio(landmarks);
        this.lastBBoxRatio = Math.max(this.lastBBoxRatio * 0.85, bboxRatio);

        this.hands.push({
          index: h,
          x: indexTip.x,
          y: indexTip.y,
          wristX: wrist.x,
          wristY: wrist.y,
          velocity: bladeActive ? maxVelocity : 0,
          bladeActive,
          landmarks,
          bboxRatio,
        });
        this.handsDetectedDuringCalibration = true;
      }
    } else {
      this.lastBBoxRatio *= 0.92;
    }

    for (const key of this.trails.keys()) {
      if (!activeKeys.has(key)) {
        this.trails.get(key).length = 0;
      }
    }
  }

  updateCalibration() {
    const now = performance.now();
    if (!this.calibrationStart) this.calibrationStart = now;

    if (this.hands.length > 0) {
      this.handsDetectedDuringCalibration = true;
    }

    const elapsed = now - this.calibrationStart;
    const timeProgress = Math.min(1, elapsed / CONFIG.handTracking.calibrationDuration);
    const bboxRatio = Math.max(
      ...this.hands.map((h) => h.bboxRatio || 0),
      this.lastBBoxRatio
    );
    const bboxProgress = Math.min(1, bboxRatio / (CONFIG.handTracking.calibrationBBoxMinRatio || 0.15));
    const progress = Math.max(timeProgress, bboxProgress);

    const bboxReady = bboxRatio >= (CONFIG.handTracking.calibrationBBoxMinRatio || 0.15);
    const timeReady =
      this.handsDetectedDuringCalibration &&
      elapsed >= CONFIG.handTracking.calibrationDuration;
    const complete = this.hands.length > 0 && (bboxReady || timeReady);

    const distanceHint = this.hands.length > 0 ? this.getDistanceHint(bboxRatio) : '';

    return {
      progress,
      complete,
      handCount: this.hands.length,
      bboxRatio,
      distanceHint,
    };
  }

  resetCalibration() {
    this.calibrationStart = 0;
    this.handsDetectedDuringCalibration = false;
    this.calibrated = false;
    this.lastBBoxRatio = 0;
  }

  getAllTrails() {
    const trails = [];
    for (const trail of this.trails.values()) {
      if (trail.length >= 2) trails.push(trail);
    }
    return trails;
  }

  isSlicing(threshold = CONFIG.handTracking.sliceVelocityThreshold) {
    return this.hands.some(
      (h) => h.bladeActive !== false && h.velocity >= threshold
    );
  }
}
