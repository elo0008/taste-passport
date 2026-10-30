interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

export class MemoryRateLimiter {
  private readonly ipLimits = new Map<string, RateLimitRecord>();
  private readonly globalRuns: number[] = [];

  private readonly maxPerHourPerIp: number;
  private readonly maxPerDayGlobal: number;

  constructor(maxPerHourPerIp = 6, maxPerDayGlobal = 200) {
    this.maxPerHourPerIp = maxPerHourPerIp;
    this.maxPerDayGlobal = maxPerDayGlobal;
  }

  public check(ip: string): RateLimitResult {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Clean global runs older than 24 hours
    while (this.globalRuns.length > 0 && this.globalRuns[0] < oneDayAgo) {
      this.globalRuns.shift();
    }

    // Check global daily cap
    if (this.globalRuns.length >= this.maxPerDayGlobal) {
      const oldestRun = this.globalRuns[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestRun + 24 * 60 * 60 * 1000 - now) / 1000));
      return {
        allowed: false,
        reason: 'Daily global quota reached (200 runs/day). Please try again later.',
        retryAfterSeconds,
      };
    }

    // Clean IP runs older than 1 hour
    let ipRecord = this.ipLimits.get(ip);
    if (!ipRecord) {
      ipRecord = { timestamps: [] };
      this.ipLimits.set(ip, ipRecord);
    }

    ipRecord.timestamps = ipRecord.timestamps.filter((ts) => ts >= oneHourAgo);

    // Check IP hourly limit
    if (ipRecord.timestamps.length >= this.maxPerHourPerIp) {
      const oldestIpRun = ipRecord.timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestIpRun + 60 * 60 * 1000 - now) / 1000));
      return {
        allowed: false,
        reason: `Rate limit exceeded. Maximum ${this.maxPerHourPerIp} requests per hour allowed per client.`,
        retryAfterSeconds,
      };
    }

    return { allowed: true };
  }

  public record(ip: string): void {
    const now = Date.now();
    this.globalRuns.push(now);

    let ipRecord = this.ipLimits.get(ip);
    if (!ipRecord) {
      ipRecord = { timestamps: [] };
      this.ipLimits.set(ip, ipRecord);
    }
    ipRecord.timestamps.push(now);
  }

  public reset(): void {
    this.ipLimits.clear();
    this.globalRuns.length = 0;
  }
}

export const rateLimiter = new MemoryRateLimiter(6, 200);

