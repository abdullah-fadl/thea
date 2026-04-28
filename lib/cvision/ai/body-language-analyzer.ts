import { logger } from '@/lib/monitoring/logger';
/**
 * Body Language Analyzer — Browser-side MediaPipe integration
 *
 * Runs entirely in the browser using MediaPipe Face Mesh (468 landmarks)
 * and MediaPipe Pose (33 landmarks). No server GPU needed.
 *
 * Usage:
 *   const analyzer = new BodyLanguageAnalyzer();
 *   await analyzer.initialize(videoElement);
 *   analyzer.startTracking(questionId);
 *   // ... during interview ...
 *   analyzer.stopTracking();
 *   const summary = analyzer.generateQuestionSummary(questionId);
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BodyLanguageFrame {
  timestamp: number;
  questionId: string;
  eyeContact: {
    lookingAtCamera: boolean;
    gazeDirection: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
    blinkRate: number;
  };
  expression: {
    smile: number;
    neutral: number;
    concerned: number;
    confused: number;
    dominant: 'SMILE' | 'NEUTRAL' | 'CONCERNED' | 'CONFUSED';
  };
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
    stable: boolean;
  };
  posture: {
    upright: boolean;
    leaning: 'CENTER' | 'LEFT' | 'RIGHT' | 'FORWARD' | 'BACK';
    shouldersLevel: boolean;
    handsVisible: boolean;
    fidgeting: boolean;
  };
}

export interface BodyLanguageSummary {
  questionId: string;
  totalFrames: number;
  duration: number;
  eyeContactPercentage: number;
  averageBlinkRate: number;
  expressionDistribution: {
    smile: number;
    neutral: number;
    concerned: number;
    confused: number;
  };
  dominantExpression: string;
  headMovementScore: number;
  postureScore: number;
  fidgetingLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  overallScore: number;
  observations: string[];
}

// ─── Analyzer Class ─────────────────────────────────────────────────────────

export class BodyLanguageAnalyzer {
  private frames: BodyLanguageFrame[] = [];
  private isTracking = false;
  private currentQuestionId = '';
  private trackingInterval: ReturnType<typeof setInterval> | null = null;

  // Face analysis state
  private currentFaceData: Partial<BodyLanguageFrame> | null = null;
  private currentPoseData: Partial<BodyLanguageFrame> | null = null;
  private lastBlinkTime = 0;
  private blinkCount = 0;
  private blinkStartTime = 0;

  // Pose history for fidgeting detection
  private wristHistory: { x: number; y: number; t: number }[] = [];

  // MediaPipe instances
  private faceMesh: any = null;
  private pose: any = null;
  private camera: any = null;

  /**
   * Initialize MediaPipe models and attach to video element.
   * Must be called from client-side code only.
   */
  async initialize(videoElement: HTMLVideoElement): Promise<boolean> {
    try {
      // Dynamic imports for browser-only MediaPipe
      const [fmModule, poseModule, camModule] = await Promise.all([
        import('@mediapipe/face_mesh'),
        import('@mediapipe/pose'),
        import('@mediapipe/camera_utils'),
      ]);

      const { FaceMesh } = fmModule;
      const { Pose } = poseModule;
      const { Camera } = camModule;

      // Face Mesh — 468 facial landmarks + iris refinement
      this.faceMesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.faceMesh.onResults(this.processFaceResults.bind(this));

      // Pose — 33 body landmarks
      this.pose = new Pose({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.pose.onResults(this.processPoseResults.bind(this));

      // Camera — feeds video frames to both models
      this.camera = new Camera(videoElement, {
        onFrame: async () => {
          if (!this.isTracking) return;
          try {
            await this.faceMesh.send({ image: videoElement });
            await this.pose.send({ image: videoElement });
          } catch {
            // Skip frame on error
          }
        },
        width: 640,
        height: 480,
      });

      return true;
    } catch (err) {
      logger.error('[BodyLanguageAnalyzer] Init failed:', err);
      return false;
    }
  }

  /** Start camera feed and tracking for a question. */
  startTracking(questionId: string) {
    this.currentQuestionId = questionId;
    this.isTracking = true;
    this.blinkCount = 0;
    this.blinkStartTime = Date.now();
    this.wristHistory = [];

    this.camera?.start();

    // Capture composed frames every 100ms
    this.trackingInterval = setInterval(() => {
      this.captureFrame();
    }, 100);
  }

  /** Stop tracking for current question. */
  stopTracking() {
    this.isTracking = false;
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  /** Fully destroy — call on component unmount. */
  destroy() {
    this.stopTracking();
    this.camera?.stop();
    this.faceMesh?.close();
    this.pose?.close();
  }

  // ─── MediaPipe result processors ──────────────────────────────────────────

  private processFaceResults(results: any) {
    if (!this.isTracking || !results.multiFaceLandmarks?.length) return;
    const lm = results.multiFaceLandmarks[0];

    // === Eye contact (iris landmarks from refineLandmarks) ===
    const leftIris = lm[468];
    const rightIris = lm[473];
    const leftEyeInner = lm[133];
    const leftEyeOuter = lm[33];
    const rightEyeInner = lm[362];
    const rightEyeOuter = lm[263];

    const leftGaze =
      (leftIris.x - leftEyeOuter.x) / (leftEyeInner.x - leftEyeOuter.x + 0.001);
    const rightGaze =
      (rightIris.x - rightEyeInner.x) / (rightEyeOuter.x - rightEyeInner.x + 0.001);
    const avgGaze = (leftGaze + rightGaze) / 2;

    const lookingAtCamera = avgGaze > 0.35 && avgGaze < 0.65;
    const gazeDirection: BodyLanguageFrame['eyeContact']['gazeDirection'] =
      avgGaze < 0.35 ? 'LEFT' : avgGaze > 0.65 ? 'RIGHT' : 'CENTER';

    // === Blink detection (Eye Aspect Ratio) ===
    const leftEAR = this.calculateEAR(lm, 'left');
    const rightEAR = this.calculateEAR(lm, 'right');
    const ear = (leftEAR + rightEAR) / 2;
    if (ear < 0.2 && Date.now() - this.lastBlinkTime > 200) {
      this.blinkCount++;
      this.lastBlinkTime = Date.now();
    }
    const elapsedMin = (Date.now() - this.blinkStartTime) / 60000;
    const blinkRate = elapsedMin > 0 ? Math.round(this.blinkCount / elapsedMin) : 0;

    // === Expression detection ===
    const mouthLeft = lm[61];
    const mouthRight = lm[291];
    const mouthTop = lm[13];
    const mouthBottom = lm[14];
    const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
    const mouthHeight = Math.abs(mouthBottom.y - mouthTop.y);
    const smileRatio = mouthWidth / (mouthHeight + 0.001);
    const smile = Math.min(1, Math.max(0, (smileRatio - 2) / 3));

    const leftBrow = lm[65];
    const rightBrow = lm[295];
    const leftEye = lm[159];
    const rightEye = lm[386];
    const browRaise = ((leftEye.y - leftBrow.y) + (rightEye.y - rightBrow.y)) / 2;
    const concerned = browRaise > 0.06 ? Math.min(1, (browRaise - 0.06) * 10) : 0;
    const confused = concerned > 0.5 ? concerned * 0.5 : 0;
    const neutral = Math.max(0, 1 - smile - concerned);

    const dominant: BodyLanguageFrame['expression']['dominant'] =
      smile > 0.4 ? 'SMILE' : concerned > 0.3 ? 'CONCERNED' : confused > 0.3 ? 'CONFUSED' : 'NEUTRAL';

    // === Head pose ===
    const noseTip = lm[1];
    const chin = lm[152];
    const forehead = lm[10];
    const leftCheek = lm[234];
    const rightCheek = lm[454];

    const pitch = (noseTip.y - (forehead.y + chin.y) / 2) * 100;
    const yaw = (noseTip.x - (leftCheek.x + rightCheek.x) / 2) * 100;
    const roll = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x) * 57.3;

    this.currentFaceData = {
      eyeContact: { lookingAtCamera, gazeDirection, blinkRate },
      expression: { smile, neutral, concerned, confused, dominant },
      headPose: {
        pitch,
        yaw,
        roll,
        stable: Math.abs(pitch) < 5 && Math.abs(yaw) < 5 && Math.abs(roll) < 5,
      },
    };
  }

  private processPoseResults(results: any) {
    if (!this.isTracking || !results.poseLandmarks) return;
    const lm = results.poseLandmarks;

    const leftShoulder = lm[11];
    const rightShoulder = lm[12];
    const nose = lm[0];
    const leftWrist = lm[15];
    const rightWrist = lm[16];

    const shouldersLevel = Math.abs(leftShoulder.y - rightShoulder.y) < 0.03;
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const leaning: BodyLanguageFrame['posture']['leaning'] =
      nose.x < shoulderMidX - 0.05 ? 'LEFT' :
      nose.x > shoulderMidX + 0.05 ? 'RIGHT' : 'CENTER';

    const handsVisible = (leftWrist.visibility ?? 0) > 0.5 || (rightWrist.visibility ?? 0) > 0.5;

    // Fidgeting — track wrist movement variance
    this.wristHistory.push({ x: leftWrist.x, y: leftWrist.y, t: Date.now() });
    if (this.wristHistory.length > 30) this.wristHistory.shift();
    const fidgeting = this.calculateFidgeting();

    this.currentPoseData = {
      posture: {
        upright: shouldersLevel && leaning === 'CENTER',
        leaning,
        shouldersLevel,
        handsVisible,
        fidgeting: fidgeting > 0.01,
      },
    };
  }

  // ─── Frame capture ────────────────────────────────────────────────────────

  private captureFrame() {
    if (!this.currentFaceData) return;

    const frame: BodyLanguageFrame = {
      timestamp: Date.now(),
      questionId: this.currentQuestionId,
      eyeContact: this.currentFaceData.eyeContact ?? {
        lookingAtCamera: false, gazeDirection: 'CENTER', blinkRate: 0,
      },
      expression: this.currentFaceData.expression ?? {
        smile: 0, neutral: 1, concerned: 0, confused: 0, dominant: 'NEUTRAL',
      },
      headPose: this.currentFaceData.headPose ?? {
        pitch: 0, yaw: 0, roll: 0, stable: true,
      },
      posture: this.currentPoseData?.posture ?? {
        upright: true, leaning: 'CENTER', shouldersLevel: true,
        handsVisible: true, fidgeting: false,
      },
    };

    this.frames.push(frame);
  }

  // ─── Summary generation ───────────────────────────────────────────────────

  generateQuestionSummary(questionId: string): BodyLanguageSummary | null {
    const qFrames = this.frames.filter(f => f.questionId === questionId);
    if (qFrames.length === 0) return null;
    const total = qFrames.length;

    const eyeContactFrames = qFrames.filter(f => f.eyeContact.lookingAtCamera).length;
    const smileFrames = qFrames.filter(f => f.expression.dominant === 'SMILE').length;
    const neutralFrames = qFrames.filter(f => f.expression.dominant === 'NEUTRAL').length;
    const concernedFrames = qFrames.filter(f => f.expression.dominant === 'CONCERNED').length;
    const confusedFrames = qFrames.filter(f => f.expression.dominant === 'CONFUSED').length;
    const stableFrames = qFrames.filter(f => f.headPose.stable).length;
    const uprightFrames = qFrames.filter(f => f.posture.upright).length;
    const fidgetFrames = qFrames.filter(f => f.posture.fidgeting).length;

    const eyeContactPct = (eyeContactFrames / total) * 100;
    const headStability = (stableFrames / total) * 100;
    const posturePct = (uprightFrames / total) * 100;
    const fidgetPct = (fidgetFrames / total) * 100;

    const overallScore = Math.round(
      eyeContactPct * 0.30 +
      headStability * 0.15 +
      posturePct * 0.20 +
      (100 - fidgetPct) * 0.15 +
      (smileFrames / total * 100) * 0.10 +
      (neutralFrames / total * 100) * 0.10
    );

    const observations: string[] = [];
    if (eyeContactPct > 80) observations.push(`Excellent eye contact (${Math.round(eyeContactPct)}%)`);
    else if (eyeContactPct > 60) observations.push(`Good eye contact (${Math.round(eyeContactPct)}%)`);
    else observations.push(`Low eye contact (${Math.round(eyeContactPct)}%) — frequently looked away`);

    if (smileFrames / total > 0.3) observations.push('Positive facial expressions — smiled naturally');
    if (fidgetPct > 40) observations.push('Notable fidgeting detected — may indicate nervousness');
    if (posturePct > 80) observations.push('Maintained good upright posture throughout');
    else if (posturePct < 50) observations.push('Posture needs improvement — frequent leaning');

    const lastBlink = qFrames[qFrames.length - 1]?.eyeContact.blinkRate ?? 0;
    const duration = total > 1 ? (qFrames[total - 1].timestamp - qFrames[0].timestamp) / 1000 : 0;

    return {
      questionId,
      totalFrames: total,
      duration,
      eyeContactPercentage: Math.round(eyeContactPct),
      averageBlinkRate: lastBlink,
      expressionDistribution: {
        smile: Math.round((smileFrames / total) * 100),
        neutral: Math.round((neutralFrames / total) * 100),
        concerned: Math.round((concernedFrames / total) * 100),
        confused: Math.round((confusedFrames / total) * 100),
      },
      dominantExpression: smileFrames > neutralFrames ? 'SMILE' : 'NEUTRAL',
      headMovementScore: Math.round(headStability),
      postureScore: Math.round(posturePct),
      fidgetingLevel: fidgetPct > 40 ? 'HIGH' : fidgetPct > 15 ? 'MEDIUM' : 'LOW',
      overallScore: Math.min(100, Math.max(0, overallScore)),
      observations,
    };
  }

  /** Get all summaries for all tracked questions. */
  generateAllSummaries(): BodyLanguageSummary[] {
    const questionIds = [...new Set(this.frames.map(f => f.questionId))];
    return questionIds
      .map(id => this.generateQuestionSummary(id))
      .filter((s): s is BodyLanguageSummary => s !== null);
  }

  /** Check if face is currently detected (for setup screen). */
  get isFaceDetected(): boolean {
    return this.currentFaceData !== null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private calculateEAR(landmarks: any[], side: 'left' | 'right'): number {
    const pts = side === 'left'
      ? [33, 160, 158, 133, 153, 144]
      : [362, 385, 387, 263, 373, 380];

    const p = pts.map(i => landmarks[i]);
    const v1 = Math.sqrt((p[1].x - p[5].x) ** 2 + (p[1].y - p[5].y) ** 2);
    const v2 = Math.sqrt((p[2].x - p[4].x) ** 2 + (p[2].y - p[4].y) ** 2);
    const h = Math.sqrt((p[0].x - p[3].x) ** 2 + (p[0].y - p[3].y) ** 2);
    return (v1 + v2) / (2 * h + 0.001);
  }

  private calculateFidgeting(): number {
    if (this.wristHistory.length < 10) return 0;
    let total = 0;
    for (let i = 1; i < this.wristHistory.length; i++) {
      total += Math.sqrt(
        (this.wristHistory[i].x - this.wristHistory[i - 1].x) ** 2 +
        (this.wristHistory[i].y - this.wristHistory[i - 1].y) ** 2,
      );
    }
    return total / this.wristHistory.length;
  }
}
