import { logger } from '@/lib/monitoring/logger';
/**
 * Voice Analyzer — Browser-side Web Audio API analysis
 *
 * Analyzes candidate voice during interview: volume, pitch, pace,
 * pauses, hesitation. All processing in the browser.
 *
 * Usage:
 *   const analyzer = new VoiceAnalyzer();
 *   analyzer.initialize(mediaStream);
 *   analyzer.startTracking(questionId);
 *   // ... during recording ...
 *   analyzer.stopTracking();
 *   const summary = analyzer.generateQuestionSummary(questionId);
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VoiceFrame {
  timestamp: number;
  questionId: string;
  pitch: number;
  volume: number;
  isSpeaking: boolean;
}

export interface VoiceSummary {
  questionId: string;
  duration: number;
  totalSpeakingTime: number;
  silencePercentage: number;
  pauseCount: number;
  longestPause: number;
  averagePauseLength: number;
  averagePitch: number;
  pitchVariation: number;
  averageVolume: number;
  volumeConsistency: number;
  estimatedWordsPerMinute: number;
  paceCategory: 'SLOW' | 'NORMAL' | 'FAST';
  fillerWordEstimate: number;
  hesitationScore: number;
  confidenceScore: number;
  observations: string[];
}

// ─── Analyzer Class ─────────────────────────────────────────────────────────

export class VoiceAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frames: VoiceFrame[] = [];
  private isTracking = false;
  private currentQuestionId = '';
  private trackingInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize with a MediaStream that has audio tracks.
   */
  initialize(stream: MediaStream): boolean {
    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);

      return true;
    } catch (err) {
      logger.error('[VoiceAnalyzer] Init failed:', err);
      return false;
    }
  }

  /** Start capturing voice data for a question. */
  startTracking(questionId: string) {
    this.currentQuestionId = questionId;
    this.isTracking = true;

    // Capture voice data every 50ms
    this.trackingInterval = setInterval(() => {
      this.captureFrame();
    }, 50);
  }

  /** Stop tracking. */
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
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.analyser = null;
  }

  /**
   * Get current audio level (0-100) for UI display (audio meter).
   */
  getCurrentLevel(): number {
    if (!this.analyser) return 0;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    return Math.min(100, Math.max(0, rms * 300));
  }

  // ─── Frame capture ────────────────────────────────────────────────────────

  private captureFrame() {
    if (!this.analyser || !this.isTracking) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(dataArray);

    // Volume (RMS)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const volume = Math.min(100, Math.max(0, rms * 300));

    // Voice Activity Detection
    const isSpeaking = volume > 5;

    // Pitch detection (autocorrelation)
    const pitch = this.detectPitch(dataArray, this.audioContext?.sampleRate ?? 44100);

    this.frames.push({
      timestamp: Date.now(),
      questionId: this.currentQuestionId,
      pitch: pitch ?? 0,
      volume,
      isSpeaking,
    });
  }

  /**
   * Autocorrelation pitch detection.
   * Returns fundamental frequency in Hz, or null if not detected.
   */
  private detectPitch(buffer: Float32Array, sampleRate: number): number | null {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let foundGoodCorrelation = false;

    // Only check frequency range 80-500Hz (human voice)
    const minOffset = Math.floor(sampleRate / 500);
    const maxOffset = Math.min(MAX_SAMPLES, Math.floor(sampleRate / 80));

    for (let offset = minOffset; offset < maxOffset; offset++) {
      let correlation = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset]);
      }
      correlation = 1 - correlation / MAX_SAMPLES;

      if (correlation > 0.9 && correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
        foundGoodCorrelation = true;
      }
    }

    if (!foundGoodCorrelation || bestOffset <= 0) return null;
    return sampleRate / bestOffset;
  }

  // ─── Summary generation ───────────────────────────────────────────────────

  generateQuestionSummary(questionId: string): VoiceSummary | null {
    const qFrames = this.frames.filter(f => f.questionId === questionId);
    if (qFrames.length === 0) return null;

    const total = qFrames.length;
    const duration =
      total > 1 ? (qFrames[total - 1].timestamp - qFrames[0].timestamp) / 1000 : 0;
    const speakingFrames = qFrames.filter(f => f.isSpeaking);
    const speakingTime = (speakingFrames.length / total) * duration;
    const silencePct = ((total - speakingFrames.length) / total) * 100;

    // Pause detection (consecutive silent frames > 1 second)
    let pauseCount = 0;
    let longestPause = 0;
    let totalPauseTime = 0;
    let currentPauseStart: number | null = null;

    for (const frame of qFrames) {
      if (!frame.isSpeaking) {
        if (currentPauseStart === null) currentPauseStart = frame.timestamp;
      } else {
        if (currentPauseStart !== null) {
          const pauseLen = (frame.timestamp - currentPauseStart) / 1000;
          if (pauseLen > 1) {
            pauseCount++;
            totalPauseTime += pauseLen;
            longestPause = Math.max(longestPause, pauseLen);
          }
          currentPauseStart = null;
        }
      }
    }

    // Pitch analysis
    const pitchValues = speakingFrames.map(f => f.pitch).filter(p => p > 0);
    const avgPitch =
      pitchValues.length > 0
        ? pitchValues.reduce((a, b) => a + b, 0) / pitchValues.length
        : 0;
    const pitchStdDev =
      pitchValues.length > 0
        ? Math.sqrt(
            pitchValues.reduce((sum, p) => sum + (p - avgPitch) ** 2, 0) /
              pitchValues.length,
          )
        : 0;

    // Volume analysis
    const volumes = speakingFrames.map(f => f.volume);
    const avgVolume =
      volumes.length > 0
        ? volumes.reduce((a, b) => a + b, 0) / volumes.length
        : 0;
    const volStdDev =
      volumes.length > 0
        ? Math.sqrt(
            volumes.reduce((sum, v) => sum + (v - avgVolume) ** 2, 0) /
              volumes.length,
          )
        : 0;
    const volConsistency = Math.max(0, 100 - volStdDev * 5);

    // Pace estimation
    const estimatedWPM =
      speakingTime > 0 ? (speakingTime / Math.max(duration, 1)) * 140 : 0;
    const paceCategory: VoiceSummary['paceCategory'] =
      estimatedWPM < 100 ? 'SLOW' : estimatedWPM > 170 ? 'FAST' : 'NORMAL';

    // Hesitation score
    const hesitationScore = Math.max(0, 100 - pauseCount * 10 - silencePct * 0.5);

    // Confidence composite
    const confidenceScore = Math.round(
      hesitationScore * 0.30 +
      avgVolume * 0.25 +
      volConsistency * 0.20 +
      Math.min(100, pitchStdDev * 2) * 0.15 +
      (speakingTime / Math.max(duration, 1)) * 100 * 0.10,
    );

    // Observations
    const observations: string[] = [];
    if (silencePct > 40)
      observations.push(`High silence (${Math.round(silencePct)}%) — may indicate uncertainty`);
    if (pauseCount > 5) observations.push(`Frequent pauses (${pauseCount}) detected`);
    if (longestPause > 5)
      observations.push(`Long pause of ${Math.round(longestPause)} seconds`);
    if (paceCategory === 'FAST')
      observations.push('Speaking pace is fast — may indicate nervousness');
    if (paceCategory === 'SLOW')
      observations.push('Speaking pace is slow — may be thinking carefully');
    if (pitchStdDev < 10 && pitchValues.length > 10)
      observations.push('Monotone delivery — low pitch variation');
    if (pitchStdDev > 40) observations.push('Very expressive vocal delivery');
    if (avgVolume > 70) observations.push('Strong, clear voice projection');
    if (avgVolume < 30 && avgVolume > 0)
      observations.push('Speaking softly — low volume');

    return {
      questionId,
      duration,
      totalSpeakingTime: Math.round(speakingTime * 10) / 10,
      silencePercentage: Math.round(silencePct),
      pauseCount,
      longestPause: Math.round(longestPause * 10) / 10,
      averagePauseLength:
        pauseCount > 0
          ? Math.round((totalPauseTime / pauseCount) * 10) / 10
          : 0,
      averagePitch: Math.round(avgPitch),
      pitchVariation: Math.round(pitchStdDev),
      averageVolume: Math.round(avgVolume),
      volumeConsistency: Math.round(volConsistency),
      estimatedWordsPerMinute: Math.round(estimatedWPM),
      paceCategory,
      fillerWordEstimate: pauseCount,
      hesitationScore: Math.round(hesitationScore),
      confidenceScore: Math.min(100, Math.max(0, confidenceScore)),
      observations,
    };
  }

  /** Get all summaries for all tracked questions. */
  generateAllSummaries(): VoiceSummary[] {
    const questionIds = [...new Set(this.frames.map(f => f.questionId))];
    return questionIds
      .map(id => this.generateQuestionSummary(id))
      .filter((s): s is VoiceSummary => s !== null);
  }
}
