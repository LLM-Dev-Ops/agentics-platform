# Decision Agent Verification Checklist

## PROMPT 3 Implementation: Wiring & Verification

This document provides the verification checklist for the Decision Agent implementation.

---

## Agent Registration

### Platform Service Registration
- [x] Agent registered in `packages/agents/src/server/routes.ts`
- [x] Agent endpoints available at `/decision/*`
- [x] Agent listed in `/agents` registry endpoint
- [x] Contract available at `/decision/registration`

### CLI Commands
- [x] `agentics-agent decide` - Synthesize DecisionEvents
- [x] `agentics-agent summarize` - Generate summary
- [x] `agentics-agent score` - Calculate risk/confidence scores
- [x] `agentics-agent inspect` - Inspect agent configuration

---

## DecisionEvent Persistence

### Verification
- [x] Events persist correctly to ruvector-service
- [x] Collection: `decision_events`
- [x] Event ID returned after persistence
- [x] Dry-run mode prevents persistence

### Required Fields
- [x] `event_id` - UUID
- [x] `agent_id` - "decision-agent"
- [x] `agent_version` - Semantic version
- [x] `decision_type` - "decision_synthesis"
- [x] `inputs_hash` - SHA-256 of inputs
- [x] `outputs` - Decision payload
- [x] `confidence` - 0.0 to 1.0
- [x] `constraints_applied` - Assumptions and limits
- [x] `execution_ref` - Correlation ID
- [x] `timestamp` - ISO 8601 UTC
- [x] `processing_time_ms` - Execution duration

---

## Telemetry Visibility

### Events Emitted
- [x] `agent.invocation.start`
- [x] `agent.invocation.end`
- [x] `agent.decision.emit`
- [x] `agent.error` (on failure)
- [x] `persistence.write`

### LLM-Observatory Compatibility
- [x] Events include `correlation_id`
- [x] Events include `trace_id` (optional)
- [x] Events include `span_id`
- [x] Events compatible with Prometheus metrics

---

## Consumer Access

### Systems That MAY Consume Output
- [x] Governance Dashboard
- [x] Audit System
- [x] Executive Reporting
- [x] Human Decision Workflow
- [x] Compliance Monitoring

### Access Verification
- [x] API endpoint accessible: `POST /v1/agents/invoke`
- [x] Agent registry accessible: `GET /v1/agents`
- [x] Contract accessible: `GET /v1/agents/decision-agent/contract`

---

## Boundary Verification

### Agent MUST NOT
- [x] ❌ Execute inference
- [x] ❌ Modify prompts or responses
- [x] ❌ Route requests
- [x] ❌ Trigger orchestration
- [x] ❌ Apply optimizations
- [x] ❌ Enforce governance actions automatically
- [x] ❌ Connect directly to Google SQL
- [x] ❌ Execute SQL

### Agent MUST NEVER
- [x] ❌ Execute code in production environments
- [x] ❌ Access secrets or credentials directly
- [x] ❌ Bypass authentication or authorization
- [x] ❌ Delete or modify historical DecisionEvents
- [x] ❌ Emit more than ONE DecisionEvent per invocation
- [x] ❌ Persist data outside of ruvector-service

---

## Smoke-Test CLI Commands

```bash
# 1. Check agent is registered
agentics-agent inspect

# 2. Test with mock source events (dry run)
agentics-agent decide \
  --dry-run \
  --input-file tests/fixtures/sample-events.json \
  --output json

# 3. Test summarize
agentics-agent summarize \
  --ruvector-url http://localhost:8080 \
  --time-start "2025-01-01T00:00:00Z" \
  --time-end "2025-01-21T23:59:59Z"

# 4. Test score
agentics-agent score \
  --ruvector-url http://localhost:8080 \
  --source-events event-1 event-2 event-3

# 5. Health check (via API)
curl http://localhost:3000/v1/agents

# 6. Invoke via API
curl -X POST http://localhost:3000/v1/agents/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "agent_id": "decision-agent",
    "command": "decide",
    "input": {
      "source_event_ids": ["event-1", "event-2"],
      "mode": "aggregate"
    },
    "options": { "dry_run": true }
  }'
```

---

## Platform Registration Metadata

```json
{
  "agent_id": "decision-agent",
  "agent_version": "0.1.0",
  "name": "Decision Agent",
  "classification": "DECISION_SYNTHESIS",
  "decision_types": [
    "decision_synthesis",
    "conflict_resolution",
    "consensus_building"
  ],
  "invocation_modes": ["cli", "cloud_run", "cloud_job"],
  "endpoints": [
    {
      "mode": "cli",
      "uri": "agentics-agent decide"
    },
    {
      "mode": "cloud_run",
      "uri": "/decision/decide",
      "health_check": "/decision/inspect"
    }
  ],
  "status": "active",
  "registered_at": "2025-01-21T00:00:00.000Z"
}
```

---

## Test Commands

```bash
# Run unit tests
npm run test --workspace=@agentics/agents

# Run with coverage
npm run test:coverage --workspace=@agentics/agents

# Type check
npm run typecheck --workspace=@agentics/agents

# Build
npm run build --workspace=@agentics/agents
```

---

## Deployment Verification

### Cloud Run Deployment
1. Build Docker image
2. Deploy to Cloud Run
3. Verify `/health` returns 200
4. Verify `/ready` returns 200 (requires ruvector-service)
5. Test `/decide` endpoint

### Environment Variables Required
- `RUVECTOR_SERVICE_URL` - RuVector service endpoint
- `RUVECTOR_API_KEY` - API key for authentication
- `TELEMETRY_ENDPOINT` - (Optional) Telemetry collector

---

## Compliance Summary

| Requirement | Status |
|------------|--------|
| Import schemas from agentics-contracts | ✅ |
| Validate inputs/outputs against contracts | ✅ |
| Emit LLM-Observatory compatible telemetry | ✅ |
| Emit exactly ONE DecisionEvent per invocation | ✅ |
| Expose CLI-invokable endpoint | ✅ |
| Deployable as Cloud Run service | ✅ |
| Return deterministic, machine-readable output | ✅ |
| Persist only via ruvector-service | ✅ |

**COMPLIANCE STATUS: PASSED ✅**
