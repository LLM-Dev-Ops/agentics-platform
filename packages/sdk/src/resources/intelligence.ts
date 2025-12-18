import type { AgenticsClient } from '../client';

/**
 * Completion parameters
 */
export interface CompletionParams {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  stream?: boolean;
}

/**
 * Completion result
 */
export interface Completion {
  id: string;
  model: string;
  message: {
    role: 'assistant';
    content: string;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'tool_use' | 'error';
  createdAt: string;
}

/**
 * Completion chunk for streaming
 */
export interface CompletionChunk {
  id: string;
  type: 'content_delta' | 'usage' | 'complete';
  delta?: {
    content?: string;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'length' | 'tool_use' | 'error';
}

/**
 * Embedding parameters
 */
export interface EmbeddingParams {
  model: string;
  input: string | string[];
}

/**
 * Embeddings result
 */
export interface Embeddings {
  embeddings: number[][];
  model: string;
  usage: {
    tokens: number;
  };
}

/**
 * Model information
 */
export interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: string[];
  pricing: {
    input: number;
    output: number;
  };
}

/**
 * Completions sub-resource
 */
export class Completions {
  constructor(private client: AgenticsClient) {}

  /**
   * Create a completion
   */
  async create(params: CompletionParams): Promise<Completion> {
    return this.client.request<Completion>('POST', '/intelligence/completions', params);
  }

  /**
   * Stream a completion
   */
  async *stream(params: CompletionParams): AsyncIterable<CompletionChunk> {
    const stream = this.client.stream<CompletionChunk>(
      'POST',
      '/intelligence/completions/stream',
      { ...params, stream: true }
    );
    yield* stream;
  }
}

/**
 * Intelligence resource
 */
export class Intelligence {
  public readonly completions: Completions;

  constructor(private client: AgenticsClient) {
    this.completions = new Completions(client);
  }

  /**
   * Create embeddings
   */
  async embeddings(params: EmbeddingParams): Promise<Embeddings> {
    return this.client.request<Embeddings>('POST', '/intelligence/embeddings', params);
  }

  /**
   * List available models
   */
  async models(): Promise<Model[]> {
    return this.client.request<Model[]>('GET', '/intelligence/models');
  }
}
