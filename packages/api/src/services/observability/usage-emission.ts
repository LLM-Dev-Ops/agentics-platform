/**
 * UsageEmitter - Emits usage events for billing and analytics
 *
 * Records usage events in append-only fashion.
 * NO analysis or aggregation - just raw event emission.
 * Analysis is performed by downstream systems.
 *
 * In-memory storage for MVP (later: persistent append-only log)
 */

export interface UsageEvent {
  userId: string;
  endpoint: string;
  timestamp: string;
  tokens?: number;
  duration: number; // milliseconds
  correlationId?: string;
  metadata?: {
    [key: string]: any;
  };
}

export class UsageEmitter {
  private events: UsageEvent[] = [];
  private readonly maxEvents: number = 100000; // Prevent unbounded growth in MVP

  /**
   * Emit a usage event
   *
   * @param userId - User ID (from identity service)
   * @param endpoint - API endpoint called
   * @param timestamp - Event timestamp (ISO 8601)
   * @param tokens - Optional token count (for LLM operations)
   * @param duration - Request duration in milliseconds
   * @param correlationId - Optional correlation ID for tracing
   * @param metadata - Additional metadata (status, model, etc.)
   */
  emitUsageEvent(
    userId: string,
    endpoint: string,
    timestamp: string,
    tokens: number | undefined,
    duration: number,
    correlationId?: string,
    metadata?: { [key: string]: any }
  ): void {
    const event: UsageEvent = {
      userId,
      endpoint,
      timestamp,
      tokens,
      duration,
      correlationId,
      metadata,
    };

    // Append to event store
    this.events.push(event);

    // Trim old events to prevent memory overflow (simple FIFO)
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // In production, this would emit to persistent storage
    this.emitToStorage(event);
  }

  /**
   * Get raw usage events (for inspection/debugging)
   * NO aggregation or analysis
   */
  getEvents(filter?: {
    userId?: string;
    endpoint?: string;
    since?: Date;
    until?: Date;
    limit?: number;
  }): UsageEvent[] {
    let filtered = [...this.events];

    if (filter?.userId) {
      filtered = filtered.filter(e => e.userId === filter.userId);
    }

    if (filter?.endpoint) {
      filtered = filtered.filter(e => e.endpoint === filter.endpoint);
    }

    if (filter?.since) {
      const sinceIso = filter.since.toISOString();
      filtered = filtered.filter(e => e.timestamp >= sinceIso);
    }

    if (filter?.until) {
      const untilIso = filter.until.toISOString();
      filtered = filtered.filter(e => e.timestamp <= untilIso);
    }

    // Return most recent first
    filtered.reverse();

    if (filter?.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Get events by correlation ID (for request tracing)
   */
  getEventsByCorrelationId(correlationId: string): UsageEvent[] {
    return this.events
      .filter(e => e.correlationId === correlationId)
      .reverse();
  }

  /**
   * Get total event count
   */
  getTotalEvents(): number {
    return this.events.length;
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Emit to external storage (placeholder for production implementation)
   */
  private emitToStorage(event: UsageEvent): void {
    // In production, this would:
    // - Write to S3 (append-only)
    // - Send to Kinesis Data Streams
    // - Write to DynamoDB (time-series)
    // - Emit to Kafka

    // For MVP: just store in memory (already done above)
    // console.log('[USAGE]', JSON.stringify(event));
  }

  /**
   * Export events for batch processing (CSV format)
   * Useful for offline analysis or data export
   */
  exportToCsv(): string {
    const headers = [
      'userId',
      'endpoint',
      'timestamp',
      'tokens',
      'duration',
      'correlationId',
    ];
    const rows = this.events.map(e => [
      e.userId,
      e.endpoint,
      e.timestamp,
      e.tokens?.toString() || '',
      e.duration.toString(),
      e.correlationId || '',
    ]);

    const csv = [headers.join(',')];
    for (const row of rows) {
      csv.push(row.join(','));
    }

    return csv.join('\n');
  }

  /**
   * Export events as JSON Lines (JSONL)
   * One JSON object per line - standard for log streaming
   */
  exportToJsonLines(): string {
    return this.events.map(e => JSON.stringify(e)).join('\n');
  }
}
