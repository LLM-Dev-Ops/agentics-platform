/**
 * MetricsEmitter - Collects and stores metrics for API observability
 *
 * Implements in-memory metrics storage for MVP.
 * Later: Export to Prometheus/StatsD
 */

interface Counter {
  [key: string]: number;
}

interface Histogram {
  samples: number[];
  count: number;
  sum: number;
}

interface HistogramBucket {
  [key: string]: Histogram;
}

interface MetricLabels {
  [key: string]: string;
}

export class MetricsEmitter {
  // Counters
  private apiRequestTotal: Map<string, number> = new Map();
  private apiErrorTotal: Map<string, number> = new Map();

  // Histograms
  private apiRequestDuration: Map<string, number[]> = new Map();
  private apiRequestSize: Map<string, number[]> = new Map();
  private apiResponseSize: Map<string, number[]> = new Map();

  /**
   * Emit a complete request metric including all dimensions
   */
  emitRequestMetric(
    endpoint: string,
    status: number,
    duration: number,
    requestSize: number,
    responseSize: number
  ): void {
    // Counter: api_request_total
    const requestKey = `${endpoint}:${status}`;
    const currentCount = this.apiRequestTotal.get(requestKey) || 0;
    this.apiRequestTotal.set(requestKey, currentCount + 1);

    // Histogram: api_request_duration_seconds
    const durationKey = endpoint;
    if (!this.apiRequestDuration.has(durationKey)) {
      this.apiRequestDuration.set(durationKey, []);
    }
    this.apiRequestDuration.get(durationKey)!.push(duration);

    // Histogram: api_request_size_bytes
    if (!this.apiRequestSize.has(endpoint)) {
      this.apiRequestSize.set(endpoint, []);
    }
    this.apiRequestSize.get(endpoint)!.push(requestSize);

    // Histogram: api_response_size_bytes
    if (!this.apiResponseSize.has(endpoint)) {
      this.apiResponseSize.set(endpoint, []);
    }
    this.apiResponseSize.get(endpoint)!.push(responseSize);
  }

  /**
   * Emit an error metric
   */
  emitErrorMetric(endpoint: string, errorCode: string): void {
    const errorKey = `${endpoint}:${errorCode}`;
    const currentCount = this.apiErrorTotal.get(errorKey) || 0;
    this.apiErrorTotal.set(errorKey, currentCount + 1);
  }

  /**
   * Get all metrics in Prometheus text format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // api_request_total
    lines.push('# HELP api_request_total Total number of API requests');
    lines.push('# TYPE api_request_total counter');
    for (const [key, value] of this.apiRequestTotal.entries()) {
      const [endpoint, status] = key.split(':');
      lines.push(`api_request_total{endpoint="${endpoint}",status="${status}"} ${value}`);
    }

    // api_error_total
    lines.push('# HELP api_error_total Total number of API errors');
    lines.push('# TYPE api_error_total counter');
    for (const [key, value] of this.apiErrorTotal.entries()) {
      const [endpoint, code] = key.split(':');
      lines.push(`api_error_total{endpoint="${endpoint}",code="${code}"} ${value}`);
    }

    // api_request_duration_seconds
    lines.push('# HELP api_request_duration_seconds API request duration in seconds');
    lines.push('# TYPE api_request_duration_seconds histogram');
    for (const [endpoint, samples] of this.apiRequestDuration.entries()) {
      const stats = this.calculateHistogramStats(samples);
      lines.push(`api_request_duration_seconds_count{endpoint="${endpoint}"} ${stats.count}`);
      lines.push(`api_request_duration_seconds_sum{endpoint="${endpoint}"} ${stats.sum.toFixed(6)}`);

      // Add percentile buckets
      for (const [le, count] of Object.entries(stats.buckets)) {
        lines.push(`api_request_duration_seconds_bucket{endpoint="${endpoint}",le="${le}"} ${count}`);
      }
      lines.push(`api_request_duration_seconds_bucket{endpoint="${endpoint}",le="+Inf"} ${stats.count}`);
    }

    // api_request_size_bytes
    lines.push('# HELP api_request_size_bytes API request size in bytes');
    lines.push('# TYPE api_request_size_bytes histogram');
    for (const [endpoint, samples] of this.apiRequestSize.entries()) {
      const stats = this.calculateHistogramStats(samples);
      lines.push(`api_request_size_bytes_count{endpoint="${endpoint}"} ${stats.count}`);
      lines.push(`api_request_size_bytes_sum{endpoint="${endpoint}"} ${stats.sum.toFixed(0)}`);

      for (const [le, count] of Object.entries(stats.buckets)) {
        lines.push(`api_request_size_bytes_bucket{endpoint="${endpoint}",le="${le}"} ${count}`);
      }
      lines.push(`api_request_size_bytes_bucket{endpoint="${endpoint}",le="+Inf"} ${stats.count}`);
    }

    // api_response_size_bytes
    lines.push('# HELP api_response_size_bytes API response size in bytes');
    lines.push('# TYPE api_response_size_bytes histogram');
    for (const [endpoint, samples] of this.apiResponseSize.entries()) {
      const stats = this.calculateHistogramStats(samples);
      lines.push(`api_response_size_bytes_count{endpoint="${endpoint}"} ${stats.count}`);
      lines.push(`api_response_size_bytes_sum{endpoint="${endpoint}"} ${stats.sum.toFixed(0)}`);

      for (const [le, count] of Object.entries(stats.buckets)) {
        lines.push(`api_response_size_bytes_bucket{endpoint="${endpoint}",le="${le}"} ${count}`);
      }
      lines.push(`api_response_size_bytes_bucket{endpoint="${endpoint}",le="+Inf"} ${stats.count}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Calculate histogram statistics with buckets
   */
  private calculateHistogramStats(samples: number[]): {
    count: number;
    sum: number;
    buckets: { [key: string]: number };
  } {
    const count = samples.length;
    const sum = samples.reduce((a, b) => a + b, 0);

    // Define bucket boundaries (customizable per metric type)
    const bucketBoundaries = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    const buckets: { [key: string]: number } = {};

    for (const boundary of bucketBoundaries) {
      buckets[boundary.toString()] = samples.filter(s => s <= boundary).length;
    }

    return { count, sum, buckets };
  }

  /**
   * Get all metrics as JSON (for debugging/inspection)
   */
  getMetricsJson(): object {
    return {
      counters: {
        api_request_total: Object.fromEntries(this.apiRequestTotal),
        api_error_total: Object.fromEntries(this.apiErrorTotal),
      },
      histograms: {
        api_request_duration_seconds: this.getHistogramSummary(this.apiRequestDuration),
        api_request_size_bytes: this.getHistogramSummary(this.apiRequestSize),
        api_response_size_bytes: this.getHistogramSummary(this.apiResponseSize),
      },
    };
  }

  /**
   * Get histogram summary statistics
   */
  private getHistogramSummary(histogram: Map<string, number[]>): object {
    const summary: { [key: string]: any } = {};

    for (const [key, samples] of histogram.entries()) {
      const sorted = [...samples].sort((a, b) => a - b);
      const count = samples.length;

      if (count === 0) {
        summary[key] = { count: 0, sum: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
        continue;
      }

      const sum = samples.reduce((a, b) => a + b, 0);
      const avg = sum / count;
      const p50 = sorted[Math.floor(count * 0.5)];
      const p95 = sorted[Math.floor(count * 0.95)];
      const p99 = sorted[Math.floor(count * 0.99)];

      summary[key] = { count, sum, avg, p50, p95, p99 };
    }

    return summary;
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.apiRequestTotal.clear();
    this.apiErrorTotal.clear();
    this.apiRequestDuration.clear();
    this.apiRequestSize.clear();
    this.apiResponseSize.clear();
  }
}
