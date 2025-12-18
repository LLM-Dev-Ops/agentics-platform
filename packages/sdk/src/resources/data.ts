import type { AgenticsClient } from '../client';

/**
 * Query parameters
 */
export interface QueryParams {
  query: string;
  parameters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  format?: 'json' | 'csv' | 'parquet';
}

/**
 * Query result
 */
export interface QueryResult {
  columns: Array<{
    name: string;
    type: string;
  }>;
  rows: Array<Record<string, unknown>>;
  metadata: {
    rowCount: number;
    executionTime: number;
    bytesProcessed: number;
  };
  nextToken?: string;
}

/**
 * Catalog entry
 */
export interface CatalogEntry {
  id: string;
  name: string;
  type: 'table' | 'view' | 'dataset' | 'stream';
  schema: {
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      description?: string;
    }>;
  };
  location: string;
  description?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Data resource
 */
export class Data {
  constructor(private client: AgenticsClient) {}

  /**
   * Execute a data query
   */
  async query(params: QueryParams): Promise<QueryResult> {
    return this.client.request<QueryResult>('POST', '/data/query', params);
  }

  /**
   * Get data catalog
   */
  async catalog(): Promise<CatalogEntry[]> {
    return this.client.request<CatalogEntry[]>('GET', '/data/catalog');
  }
}
