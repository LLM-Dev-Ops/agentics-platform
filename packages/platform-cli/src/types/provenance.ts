/**
 * Provenance and audit types
 */

/** Provenance stamp for generated artifacts */
export interface ProvenanceStamp {
  /** Unique stamp identifier */
  stampId: string;
  /** CLI version that generated the artifact */
  cliVersion: string;
  /** Timestamp of generation */
  generatedAt: string;
  /** Correlation ID for tracing */
  correlationId: string;
  /** Organization context */
  orgId: string;
  /** Environment context */
  envId: string;
  /** Hash of the artifact content */
  contentHash: string;
  /** Signature for verification (optional) */
  signature?: string;
}

/** Audit event for CLI operations */
export interface AuditEvent {
  eventId: string;
  timestamp: string;
  correlationId: string;
  command: string;
  args: string[];
  orgId: string;
  envId: string;
  userId?: string;
  outcome: 'success' | 'failure' | 'dry-run';
  durationMs: number;
  errorMessage?: string;
}

/** Artifact metadata */
export interface ArtifactMetadata {
  artifactId: string;
  artifactType: 'plan' | 'config' | 'manifest' | 'export';
  createdAt: string;
  provenance: ProvenanceStamp;
  sourceFiles?: string[];
  dependencies?: string[];
}
