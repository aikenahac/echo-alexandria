/**
 * Progress tracking and logging for import jobs
 */

export class ProgressLogger {
  private startTime: number;
  private lastLogTime: number;
  private recordsAtLastLog: number;

  constructor(
    private type: string,
    private logInterval: number = 10000
  ) {
    this.startTime = Date.now();
    this.lastLogTime = this.startTime;
    this.recordsAtLastLog = 0;
  }

  /**
   * Log progress with detailed metrics
   */
  log(recordsProcessed: number, force: boolean = false): void {
    if (!force && recordsProcessed % this.logInterval !== 0) {
      return;
    }

    const now = Date.now();
    const totalElapsed = now - this.startTime;
    const intervalElapsed = now - this.lastLogTime;
    const recordsSinceLastLog = recordsProcessed - this.recordsAtLastLog;

    // Calculate rates
    const overallRate = recordsProcessed / (totalElapsed / 1000);
    const recentRate = recordsSinceLastLog / (intervalElapsed / 1000);

    // Format times
    const elapsed = this.formatDuration(totalElapsed);

    // Build progress message
    const parts = [
      `[${this.type}]`,
      `Processed: ${recordsProcessed.toLocaleString()}`,
      `Elapsed: ${elapsed}`,
      `Rate: ${Math.round(overallRate).toLocaleString()}/s`,
      `Recent: ${Math.round(recentRate).toLocaleString()}/s`,
    ];

    console.log(parts.join(" | "));

    this.lastLogTime = now;
    this.recordsAtLastLog = recordsProcessed;
  }

  /**
   * Log final summary
   */
  logComplete(recordsProcessed: number, recordsInserted: number): void {
    const totalElapsed = Date.now() - this.startTime;
    const elapsed = this.formatDuration(totalElapsed);
    const overallRate = recordsProcessed / (totalElapsed / 1000);

    console.log("");
    console.log("=".repeat(70));
    console.log(`${this.type} import complete!`);
    console.log("=".repeat(70));
    console.log(`Total processed:      ${recordsProcessed.toLocaleString()}`);
    console.log(
      `Total inserted/updated: ${recordsInserted.toLocaleString()}`
    );
    console.log(`Total time:           ${elapsed}`);
    console.log(
      `Average rate:         ${Math.round(overallRate).toLocaleString()} records/s`
    );
    console.log("=".repeat(70));
    console.log("");
  }

  /**
   * Log phase start
   */
  logPhase(phase: string): void {
    console.log("");
    console.log(`>>> ${phase}`);
  }

  /**
   * Format milliseconds into human-readable duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      const remainingSeconds = seconds % 60;
      return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
