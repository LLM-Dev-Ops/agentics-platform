/**
 * Intelligence (AI/ML) Types for Layer 4 Agentics Platform
 *
 * Types for AI model interactions including completions, embeddings,
 * and model management as defined in the SPARC specification.
 */

/**
 * Parameters for requesting a text completion
 */
export interface CompletionParams {
  /** Model identifier to use for completion */
  model: string;
  /** Input prompt or messages */
  prompt: string | Array<{ role: string; content: string }>;
  /** Maximum number of tokens to generate */
  max_tokens?: number;
  /** Sampling temperature (0-2, higher = more random) */
  temperature?: number;
  /** Nucleus sampling parameter (0-1) */
  top_p?: number;
  /** Number of completions to generate */
  n?: number;
  /** Stop sequences to end generation */
  stop?: string | string[];
  /** Presence penalty (-2 to 2) */
  presence_penalty?: number;
  /** Frequency penalty (-2 to 2) */
  frequency_penalty?: number;
  /** User identifier for abuse monitoring */
  user?: string;
  /** Whether to stream the response */
  stream?: boolean;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /** Number of tokens in the prompt */
  prompt_tokens: number;
  /** Number of tokens in the completion */
  completion_tokens: number;
  /** Total tokens used (prompt + completion) */
  total_tokens: number;
}

/**
 * Completion response from the model
 */
export interface Completion {
  /** Generated completion text */
  completion: string;
  /** Alternative completions if n > 1 */
  choices?: Array<{
    /** Generated text */
    text: string;
    /** Index of this choice */
    index: number;
    /** Reason completion stopped */
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  /** Token usage statistics */
  usage: TokenUsage;
  /** Model used for generation */
  model: string;
  /** Unique identifier for this completion */
  id?: string;
  /** ISO 8601 timestamp */
  created?: string;
}

/**
 * Parameters for requesting embeddings
 */
export interface EmbeddingParams {
  /** Model identifier to use for embeddings */
  model: string;
  /** Input text or array of texts to embed */
  input: string | string[];
  /** User identifier for abuse monitoring */
  user?: string;
  /** Embedding format (default: float) */
  encoding_format?: 'float' | 'base64';
}

/**
 * Single embedding vector
 */
export interface Embedding {
  /** The embedding vector */
  embedding: number[];
  /** Index of this embedding in the batch */
  index: number;
  /** Object type identifier */
  object: 'embedding';
}

/**
 * Embeddings response from the model
 */
export interface Embeddings {
  /** Array of embedding vectors */
  embeddings: Embedding[];
  /** Token usage statistics */
  usage: {
    /** Total tokens processed */
    total_tokens: number;
    /** Number of tokens in input */
    prompt_tokens?: number;
  };
  /** Model used for embeddings */
  model: string;
  /** Object type identifier */
  object?: 'list';
}

/**
 * Model capabilities and features
 */
export interface ModelCapabilities {
  /** Supports text completion */
  completion?: boolean;
  /** Supports chat/conversational format */
  chat?: boolean;
  /** Supports embedding generation */
  embeddings?: boolean;
  /** Supports function calling */
  function_calling?: boolean;
  /** Supports vision/image inputs */
  vision?: boolean;
  /** Maximum context length in tokens */
  max_tokens?: number;
  /** Supported input modalities */
  input_modalities?: string[];
  /** Supported output modalities */
  output_modalities?: string[];
}

/**
 * AI model information
 */
export interface Model {
  /** Unique model identifier */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Model capabilities and features */
  capabilities: ModelCapabilities;
  /** Model provider (e.g., 'openai', 'anthropic', 'custom') */
  provider?: string;
  /** Model version */
  version?: string;
  /** Model description */
  description?: string;
  /** Cost per 1K tokens (input) */
  cost_per_1k_input_tokens?: number;
  /** Cost per 1K tokens (output) */
  cost_per_1k_output_tokens?: number;
  /** Whether model is currently available */
  available?: boolean;
}

/**
 * List models response
 */
export interface ListModelsResponse {
  /** Array of available models */
  models: Model[];
  /** Object type identifier */
  object?: 'list';
}

/**
 * Fine-tuning job parameters
 */
export interface FineTuneParams {
  /** Base model to fine-tune */
  model: string;
  /** Training data file ID or URL */
  training_file: string;
  /** Validation data file ID or URL */
  validation_file?: string;
  /** Number of training epochs */
  n_epochs?: number;
  /** Batch size for training */
  batch_size?: number;
  /** Learning rate multiplier */
  learning_rate_multiplier?: number;
  /** Custom suffix for fine-tuned model name */
  suffix?: string;
}

/**
 * Fine-tuning job status
 */
export interface FineTuneJob {
  /** Unique job identifier */
  id: string;
  /** Job status */
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  /** Base model being fine-tuned */
  model: string;
  /** ID of fine-tuned model (when completed) */
  fine_tuned_model?: string;
  /** ISO 8601 timestamp of creation */
  created_at: string;
  /** ISO 8601 timestamp of completion */
  finished_at?: string;
  /** Training metrics */
  metrics?: Record<string, number>;
  /** Error message if failed */
  error?: string;
}
