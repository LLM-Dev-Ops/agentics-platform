/**
 * Decision Event Store
 *
 * Persistence operations for DecisionEvents via ruvector-service.
 */

import type { DecisionEvent } from '@agentics/contracts';
import { RuvectorClient } from '../client.js';
import { RuvectorNotFoundError } from '../errors.js';
import type {
  DecisionEventQuery,
  QueryResult,
  WriteResult,
  BatchWriteResult,
} from '../types.js';

/**
 * Decision Event Store
 */
export class DecisionEventStore {
  private readonly client: RuvectorClient;
  private readonly collection: string;

  constructor(client: RuvectorClient, collection: string = 'decision_events') {
    this.client = client;
    this.collection = collection;
  }

  /**
   * Write a decision event
   */
  async write(event: DecisionEvent): Promise<WriteResult> {
    return this.client.request<WriteResult>(
      'POST',
      `/v1/collections/${this.collection}/events`,
      event
    );
  }

  /**
   * Write multiple decision events
   */
  async writeBatch(events: DecisionEvent[]): Promise<BatchWriteResult> {
    if (events.length === 0) {
      return {
        success: true,
        total: 0,
        written: 0,
        failed: 0,
      };
    }

    return this.client.request<BatchWriteResult>(
      'POST',
      `/v1/collections/${this.collection}/events/batch`,
      { events }
    );
  }

  /**
   * Get a decision event by ID
   */
  async get(eventId: string): Promise<DecisionEvent> {
    try {
      return await this.client.request<DecisionEvent>(
        'GET',
        `/v1/collections/${this.collection}/events/${eventId}`
      );
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        throw new RuvectorNotFoundError('DecisionEvent', eventId);
      }
      throw error;
    }
  }

  /**
   * Query decision events
   */
  async query(query: DecisionEventQuery): Promise<QueryResult<DecisionEvent>> {
    const params = new URLSearchParams();

    if (query.agent_ids?.length) {
      params.set('agent_ids', query.agent_ids.join(','));
    }
    if (query.decision_types?.length) {
      params.set('decision_types', query.decision_types.join(','));
    }
    if (query.time_range) {
      params.set('start_time', query.time_range.start);
      params.set('end_time', query.time_range.end);
    }
    if (query.min_confidence !== undefined) {
      params.set('min_confidence', query.min_confidence.toString());
    }
    if (query.limit !== undefined) {
      params.set('limit', query.limit.toString());
    }
    if (query.offset !== undefined) {
      params.set('offset', query.offset.toString());
    }
    if (query.order_by) {
      params.set('order_by', query.order_by);
    }
    if (query.order_direction) {
      params.set('order_direction', query.order_direction);
    }

    const queryString = params.toString();
    const path = `/v1/collections/${this.collection}/events${queryString ? `?${queryString}` : ''}`;

    return this.client.request<QueryResult<DecisionEvent>>('GET', path);
  }

  /**
   * Get latest decision events by agent
   */
  async getLatestByAgent(
    agentId: string,
    limit: number = 10
  ): Promise<DecisionEvent[]> {
    const result = await this.query({
      agent_ids: [agentId],
      limit,
      order_by: 'timestamp',
      order_direction: 'desc',
    });
    return result.data;
  }

  /**
   * Aggregate decision events for synthesis
   */
  async aggregateForSynthesis(
    query: DecisionEventQuery
  ): Promise<{
    events: DecisionEvent[];
    summary: {
      total_events: number;
      by_type: Record<string, number>;
      by_agent: Record<string, number>;
      confidence_stats: {
        min: number;
        max: number;
        avg: number;
      };
    };
  }> {
    return this.client.request(
      'POST',
      `/v1/collections/${this.collection}/aggregate`,
      query
    );
  }
}
