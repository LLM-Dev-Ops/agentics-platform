/**
 * AuditLogger - Emits security and compliance audit events
 *
 * Records critical security events for compliance and forensics.
 * All events include correlation IDs for request tracing.
 *
 * In-memory storage for MVP (later: immutable log store like AWS CloudWatch Logs)
 */

export type AuditEventType =
  | 'user.login'
  | 'user.logout'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'api_key.used'
  | 'scope.elevated'
  | 'quota.exceeded'
  | 'rate_limit.triggered';

export interface AuditEvent {
  eventType: AuditEventType;
  userId: string | null;
  timestamp: string;
  correlationId?: string;
  metadata?: {
    [key: string]: any;
  };
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private readonly maxEvents: number = 10000; // Prevent unbounded growth in MVP

  /**
   * Log an audit event
   */
  logAuditEvent(
    eventType: AuditEventType,
    userId: string | null,
    metadata?: { [key: string]: any },
    correlationId?: string
  ): void {
    const event: AuditEvent = {
      eventType,
      userId,
      timestamp: new Date().toISOString(),
      correlationId,
      metadata,
    };

    this.events.push(event);

    // Trim old events to prevent memory overflow (simple FIFO)
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // In production, this would emit to immutable storage
    this.emitToStorage(event);
  }

  /**
   * Log user login event
   */
  logUserLogin(
    userId: string,
    metadata?: { [key: string]: any },
    correlationId?: string
  ): void {
    this.logAuditEvent('user.login', userId, metadata, correlationId);
  }

  /**
   * Log user logout event
   */
  logUserLogout(
    userId: string,
    metadata?: { [key: string]: any },
    correlationId?: string
  ): void {
    this.logAuditEvent('user.logout', userId, metadata, correlationId);
  }

  /**
   * Log API key creation
   */
  logApiKeyCreated(
    userId: string,
    metadata?: { [key: string]: any },
    correlationId?: string
  ): void {
    this.logAuditEvent('api_key.created', userId, metadata, correlationId);
  }

  /**
   * Log API key revocation
   */
  logApiKeyRevoked(
    userId: string,
    metadata?: { [key: string]: any },
    correlationId?: string
  ): void {
    this.logAuditEvent('api_key.revoked', userId, metadata, correlationId);
  }

  /**
   * Log API key usage
   */
  logApiKeyUsed(
    userId: string,
    metadata?: { [key: string]: any },
    correlationId?: string
  ): void {
    this.logAuditEvent('api_key.used', userId, metadata, correlationId);
  }

  /**
   * Log scope elevation
   */
  logScopeElevated(
    userId: string,
    metadata?: { [key: string]: any },
    correlationId?: string
  ): void {
    this.logAuditEvent('scope.elevated', userId, metadata, correlationId);
  }

  /**
   * Log quota exceeded event
   */
  logQuotaExceeded(
    userId: string,
    metadata?: { [key: string]: any },
    correlationId?: string
  ): void {
    this.logAuditEvent('quota.exceeded', userId, metadata, correlationId);
  }

  /**
   * Log rate limit triggered event
   */
  logRateLimitTriggered(
    userId: string | null,
    metadata?: { [key: string]: any },
    correlationId?: string
  ): void {
    this.logAuditEvent('rate_limit.triggered', userId, metadata, correlationId);
  }

  /**
   * Get all audit events (for inspection/debugging)
   */
  getEvents(filter?: {
    eventType?: AuditEventType;
    userId?: string;
    since?: Date;
    limit?: number;
  }): AuditEvent[] {
    let filtered = [...this.events];

    if (filter?.eventType) {
      filtered = filtered.filter(e => e.eventType === filter.eventType);
    }

    if (filter?.userId) {
      filtered = filtered.filter(e => e.userId === filter.userId);
    }

    if (filter?.since) {
      const sinceIso = filter.since.toISOString();
      filtered = filtered.filter(e => e.timestamp >= sinceIso);
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
  getEventsByCorrelationId(correlationId: string): AuditEvent[] {
    return this.events
      .filter(e => e.correlationId === correlationId)
      .reverse();
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
  private emitToStorage(event: AuditEvent): void {
    // In production, this would:
    // - Send to CloudWatch Logs
    // - Write to S3 (immutable)
    // - Send to SIEM system
    // - Emit to Kafka/Kinesis

    // For MVP: just store in memory (already done above)
    // console.log('[AUDIT]', JSON.stringify(event));
  }

  /**
   * Get event count statistics
   */
  getStatistics(): {
    totalEvents: number;
    eventsByType: { [key: string]: number };
    uniqueUsers: number;
  } {
    const eventsByType: { [key: string]: number } = {};
    const uniqueUsers = new Set<string>();

    for (const event of this.events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      if (event.userId) {
        uniqueUsers.add(event.userId);
      }
    }

    return {
      totalEvents: this.events.length,
      eventsByType,
      uniqueUsers: uniqueUsers.size,
    };
  }
}
