/**
 * Simulation clock with speed control.
 * speed=1 means real-time, speed=60 means 1 real minute = 1 second, speed=1000 = max speed
 */
export class SimulationClock {
  constructor(private speed: number = 60) {}

  /** Wait for a scaled duration. At speed=60, 60s real = 1s wall clock */
  async wait(realMs: number): Promise<void> {
    const scaledMs = Math.max(0, realMs / this.speed);
    if (scaledMs > 10) {
      await new Promise((r) => setTimeout(r, scaledMs));
    }
  }

  /** Simulate patient waiting (5-15 min real time) */
  async patientWait(): Promise<void> {
    const minutes = 5 + Math.random() * 10;
    await this.wait(minutes * 60_000);
  }

  /** Simulate nursing assessment (5-10 min) */
  async nursingDelay(): Promise<void> {
    const minutes = 5 + Math.random() * 5;
    await this.wait(minutes * 60_000);
  }

  /** Simulate doctor consultation (10-20 min) */
  async doctorDelay(): Promise<void> {
    const minutes = 10 + Math.random() * 10;
    await this.wait(minutes * 60_000);
  }

  /** Simulate lab processing (30-60 min) */
  async labDelay(): Promise<void> {
    const minutes = 30 + Math.random() * 30;
    await this.wait(minutes * 60_000);
  }

  /** Simulate short transition (1-3 min) */
  async shortDelay(): Promise<void> {
    const minutes = 1 + Math.random() * 2;
    await this.wait(minutes * 60_000);
  }
}
