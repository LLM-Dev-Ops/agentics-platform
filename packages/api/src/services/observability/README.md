# Observability Service

The Observability Service provides comprehensive observability for the Layer 4 Agentics Platform API Gateway.

## Architecture

The observability system is designed around **emission-only** principles:
- **Layer 4 ONLY EMITS** observability data
- **NO analysis, aggregation, or insights** at this layer
- Analysis is performed by downstream systems (e.g., Prometheus, Grafana, ELK)

## Components

### 1. MetricsEmitter (`metrics.ts`)

Collects and stores metrics in Prometheus-compatible format.

**Metrics:**
- `api_request_total` (counter) - Total requests by endpoint and status
- `api_request_duration_seconds` (histogram) - Request duration
- `api_request_size_bytes` (histogram) - Request payload size
- `api_response_size_bytes` (histogram) - Response payload size
- `api_error_total` (counter) - Errors by endpoint and code

**Storage:** In-memory for MVP (later: Prometheus push gateway or StatsD)

### 2. AuditLogger (`audit.ts`)

Records security and compliance audit events.

**Event Types:**
- `user.login` - User authentication
- `user.logout` - User session end
- `api_key.created` - API key generation
- `api_key.revoked` - API key revocation
- `api_key.used` - API key usage
- `scope.elevated` - Privilege escalation
- `quota.exceeded` - Usage limit reached
- `rate_limit.triggered` - Rate limit hit

**Storage:** In-memory for MVP (later: immutable log store like AWS CloudWatch Logs)

### 3. UsageEmitter (`usage-emission.ts`)

Emits raw usage events for billing and analytics.

**Event Data:**
- User ID
- Endpoint called
- Timestamp
- Token count (for LLM operations)
- Duration
- Correlation ID
- Metadata (status, model, etc.)

**Storage:** Append-only in-memory store (later: S3, Kinesis, Kafka)

### 4. Correlation (`correlation.ts`)

Manages correlation IDs for distributed tracing.

**Features:**
- Generate UUIDv4 correlation IDs
- Attach to requests/responses via `X-Request-Id` header
- Propagate to Layer 3 via `X-Correlation-Id` header
- Link all observability events by correlation ID

### 5. ObservabilityService (`index.ts`)

Singleton coordinator that provides unified access to all components.

**Usage:**
```typescript
import { getObservabilityService } from './services/observability';

const observability = getObservabilityService();

// Record a request
observability.recordRequest({
  userId: 'user_123',
  endpoint: '/api/v1/completions',
  status: 200,
  duration: 150,
  requestSize: 1024,
  responseSize: 2048,
  tokens: 500,
  correlationId: 'req-123',
});

// Record an audit event
observability.recordAudit({
  eventType: 'api_key.created',
  userId: 'user_123',
  metadata: { keyId: 'key_abc' },
  correlationId: 'req-123',
});
```

## Middleware

### Observability Middleware (`middleware/observability.ts`)

Automatically instruments all requests with:
- Correlation ID generation/propagation
- Request metrics (duration, size, status)
- Usage event emission
- Error tracking

**Fastify Hooks:**
- `onRequest` - Generate correlation ID, record start time
- `onResponse` - Emit metrics and usage events
- `onError` - Record error metrics

**Registration:**
```typescript
import { registerObservabilityMiddleware } from './middleware/observability';

registerObservabilityMiddleware(app);
```

## Endpoints

All observability endpoints are **internal only** and should be protected by admin scope or IP whitelist.

### Metrics Endpoints

- `GET /metrics` - Prometheus text format
- `GET /metrics/json` - JSON format (debugging)

### Health Endpoint

- `GET /health/observability` - Component health status

### Audit Endpoints

- `GET /audit/events` - Query audit events
  - Query params: `eventType`, `userId`, `since`, `limit`
- `GET /audit/statistics` - Aggregate statistics

### Usage Endpoints

- `GET /usage/events` - Query usage events
  - Query params: `userId`, `endpoint`, `since`, `until`, `limit`
- `GET /usage/export` - Export usage data
  - Query params: `format` (csv or jsonl)

## Integration Guide

### 1. Automatic (via Middleware)

Most observability is automatic when middleware is registered:

```typescript
import { createServer } from './server';

const app = await createServer();
// Observability middleware is already registered
```

### 2. Manual Audit Events

For security events, call the audit logger directly:

```typescript
import { getObservabilityService, getCorrelationId } from './services/observability';

// In your authentication handler
observability.recordAudit({
  eventType: 'user.login',
  userId: user.id,
  metadata: { ip: request.ip, userAgent: request.headers['user-agent'] },
  correlationId: getCorrelationId(request),
});
```

### 3. Attach User Context

To enable usage tracking, attach user ID to request:

```typescript
import { attachUserContext } from './middleware/observability';

// In your authentication middleware
attachUserContext(request, user.id);
```

### 4. Attach Token Count

For LLM operations, attach token count after Layer 3 response:

```typescript
import { attachTokenCount } from './middleware/observability';

// After calling Layer 3
const response = await layer3Client.complete(...);
attachTokenCount(request, response.usage.total_tokens);
```

## Production Considerations

### 1. Storage

Current implementation uses **in-memory storage** for MVP. In production:

- **Metrics**: Push to Prometheus push gateway or StatsD
- **Audit**: Write to AWS CloudWatch Logs or immutable S3 bucket
- **Usage**: Stream to Kinesis, Kafka, or write to S3

### 2. Performance

- Metrics and usage emission are **non-blocking**
- Events are stored in memory with bounded queues
- No external API calls in request path

### 3. Security

- All observability endpoints require admin scope
- Consider IP whitelist for `/metrics` endpoint
- Audit events contain sensitive data - encrypt at rest

### 4. Retention

Current limits (prevent memory overflow):
- Metrics: Unbounded (histograms only store samples)
- Audit: 10,000 events (FIFO)
- Usage: 100,000 events (FIFO)

In production, implement proper retention policies.

## Testing

Reset observability state between tests:

```typescript
import { ObservabilityService } from './services/observability';

beforeEach(() => {
  ObservabilityService.resetInstance();
});
```

## Monitoring the Monitoring

Check observability system health:

```bash
curl http://localhost:3000/health/observability
```

Expected response:
```json
{
  "status": "healthy",
  "components": {
    "metrics": { "status": "operational", "count": 42 },
    "audit": { "status": "operational", "count": 15 },
    "usage": { "status": "operational", "count": 128 }
  }
}
```
