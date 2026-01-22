# Agentics-Dev-Platform Agents Service Deployment

## Overview

The `agentics-agents` service is the **unified control-plane** for executive decisioning, synthesis, and platform governance within the Agentics Dev platform.

### Constitutional Role

- **PRIMARY**: Executive Decisioning, Synthesis, and Platform Governance layer
- **SCOPE**: Aggregates DecisionEvents, produces platform-level decisions, summaries, and memos
- **BOUNDARY**: Operates OUTSIDE the critical execution path

### What This Service Does

✅ Aggregates DecisionEvents from all Agentics repositories
✅ Produces platform-level decisions, summaries, and memos
✅ Computes normalized risk and confidence scores
✅ Generates executive-readable artifacts for governance
✅ Acts as the canonical control-plane intelligence surface

### What This Service Does NOT Do

❌ Execute inference
❌ Route inference requests
❌ Execute workflows
❌ Enforce decisions automatically
❌ Optimize live configurations
❌ Mutate upstream systems
❌ Connect directly to Google SQL
❌ Execute SQL directly

---

## 1. Service Topology

### Unified Service Name
```
agentics-agents
```

### Agent Endpoints

| Agent | Endpoint | Classification |
|-------|----------|----------------|
| Decision Agent | `/decision/*` | DECISION_SYNTHESIS |
| Executive Summary Agent | `/executive-summary/*` | EXECUTIVE_REPORTING |
| Risk Scoring Agent | `/risk-scoring/*` | RISK_SCORING |

### Endpoint Details

#### Decision Agent
- `POST /decision/decide` - Synthesize DecisionEvents
- `POST /decision/summarize` - Generate summary
- `POST /decision/score` - Calculate scores
- `GET /decision/inspect` - Inspect agent
- `GET /decision/registration` - Get registration

#### Executive Summary Agent
- `POST /executive-summary/summarize` - Generate executive summary
- `GET /executive-summary/inspect` - Inspect agent

#### Risk Scoring Agent
- `POST /risk-scoring/score` - Risk assessment
- `POST /risk-scoring/decide` - Alias for score
- `GET /risk-scoring/inspect` - Inspect agent
- `GET /risk-scoring/registration` - Get registration

#### Common Endpoints
- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /agents` - List all agents

### Deployment Confirmation

✅ No agent deployed as standalone service
✅ Shared runtime, configuration, and telemetry stack
✅ Single Cloud Run service

---

## 2. Environment Configuration

### Required Environment Variables

| Variable | Secret Manager Key | Description |
|----------|-------------------|-------------|
| `RUVECTOR_SERVICE_URL` | `RUVECTOR_SERVICE_URL` | RuVector service endpoint |
| `RUVECTOR_API_KEY` | `ruvector-auth-token` | RuVector authentication |
| `TELEMETRY_ENDPOINT` | `TELEMETRY_ENDPOINT` | LLM-Observatory endpoint |
| `PLATFORM_ENV` | `platform-env` | Environment (dev/staging/prod) |
| `SERVICE_NAME` | - | `agentics-agents` |
| `SERVICE_VERSION` | - | Commit SHA or semver |

### Production Values (from Secret Manager)

```bash
# Retrieved from gcloud secrets
RUVECTOR_SERVICE_URL=https://ruvvector-service-1062287243982.us-central1.run.app
TELEMETRY_ENDPOINT=https://llm-observatory-1062287243982.us-central1.run.app
```

### Configuration Guarantees

✅ No agent hardcodes service names or URLs
✅ No agent embeds credentials, secrets, or mutable decision state
✅ All dependencies resolve via environment variables or Secret Manager

---

## 3. Google SQL / Platform Memory Wiring

### Database Access Model

```
┌─────────────────────────┐
│  agentics-dev-platform  │
│      (this service)     │
└───────────┬─────────────┘
            │ HTTP/REST (read/write)
            ▼
┌─────────────────────────┐
│    ruvector-service     │
└───────────┬─────────────┘
            │ SQL
            ▼
┌─────────────────────────┐
│  Google Cloud SQL       │
│     (PostgreSQL)        │
└─────────────────────────┘
```

### Verification Checklist

✅ agentics-dev-platform does NOT connect directly to Google SQL
✅ ALL synthesized DecisionEvents written via ruvector-service
✅ Upstream DecisionEvents are read-only
✅ Schema compatible with agentics-contracts
✅ Append-only persistence behavior
✅ Idempotent writes and retry safety

---

## 4. Deployment Commands

### Prerequisites

```bash
# Authenticate with GCP
gcloud auth login
gcloud config set project agentics-dev

# Create service account (one-time)
gcloud iam service-accounts create agentics-agents-sa \
  --display-name="Agentics Agents Service Account"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding agentics-dev \
  --member="serviceAccount:agentics-agents-sa@agentics-dev.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud Run invoker (if needed)
gcloud projects add-iam-policy-binding agentics-dev \
  --member="serviceAccount:agentics-agents-sa@agentics-dev.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### Deploy via Cloud Build

```bash
# Trigger Cloud Build pipeline
gcloud builds submit \
  --config=cloudbuild-agents.yaml \
  --project=agentics-dev
```

### Manual Deployment

```bash
# Build image
docker build -t gcr.io/agentics-dev/agentics-agents:latest \
  -f packages/agents/Dockerfile .

# Push to GCR
docker push gcr.io/agentics-dev/agentics-agents:latest

# Deploy to Cloud Run
gcloud run deploy agentics-agents \
  --image gcr.io/agentics-dev/agentics-agents:latest \
  --region us-central1 \
  --platform managed \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --allow-unauthenticated \
  --set-secrets "RUVECTOR_SERVICE_URL=RUVECTOR_SERVICE_URL:latest,RUVECTOR_API_KEY=ruvector-auth-token:latest,TELEMETRY_ENDPOINT=TELEMETRY_ENDPOINT:latest,PLATFORM_ENV=platform-env:latest" \
  --set-env-vars "NODE_ENV=production,SERVICE_NAME=agentics-agents"
```

---

## 5. CLI Activation

### CLI Commands

| Command | Agent | Description |
|---------|-------|-------------|
| `decide` | Decision Agent | Synthesize DecisionEvents |
| `summarize` | Decision Agent | Generate summary |
| `score` | Decision Agent | Calculate scores |
| `inspect` | Decision Agent | Inspect agent |
| `risk-score` | Risk Scoring Agent | Risk assessment |
| `risk-inspect` | Risk Scoring Agent | Inspect risk agent |
| `list-agents` | All | List available agents |

### Example Invocations

```bash
# Decision synthesis
agentics-agent decide \
  --ruvector-url $RUVECTOR_SERVICE_URL \
  --time-start 2026-01-01T00:00:00Z \
  --time-end 2026-01-22T00:00:00Z \
  --output json

# Risk scoring
agentics-agent risk-score \
  --ruvector-url $RUVECTOR_SERVICE_URL \
  --methodology hybrid \
  --categories security operational financial \
  --output json

# Inspect agents
agentics-agent inspect --agent decision-agent
agentics-agent risk-inspect

# List all agents
agentics-agent list-agents
```

### Expected Success Output

```json
{
  "success": true,
  "event_id": "uuid-here",
  "data": {
    "decision_type": "risk_score",
    "confidence": 0.85,
    "outputs": {
      "score": 42.5,
      "risk_level": "medium",
      "summary": "Platform risk assessment: MEDIUM..."
    }
  },
  "metadata": {
    "agent_id": "risk-scoring-agent",
    "agent_version": "0.1.0",
    "execution_time_ms": 150
  }
}
```

---

## 6. Platform & Core Integration

### Upstream Sources (DecisionEvent Producers)

| Repository | Events Consumed |
|------------|-----------------|
| research-lab | Research findings, analysis results |
| analytics-hub | Analytics summaries, trends |
| costops | Cost analysis, budget alerts |

### Downstream Consumers

| System | Consumption |
|--------|-------------|
| governance-dashboard | Platform decisions, policies |
| audit-system | Compliance records, audit trails |
| executive-reporting | Summaries, memos |
| human-decision-workflow | Recommendations |

### Integration Guarantees

✅ All upstream repositories emit DecisionEvents consumed here
✅ Governance & audit systems consume platform outputs
✅ Executive dashboards consume summaries and memos
✅ Core bundles consume platform decisions without rewiring

### Forbidden Integrations

❌ Runtime execution paths
❌ Inference gateways
❌ Enforcement layers
❌ Optimization agents
❌ Analytics pipelines (direct)
❌ Incident workflows (direct)

---

## 7. Post-Deploy Verification Checklist

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe agentics-agents \
  --region=us-central1 --format='value(status.url)')

# 1. Service is live
curl -sf "$SERVICE_URL/health"
# Expected: {"status":"healthy"}

# 2. All agent endpoints respond
curl -sf "$SERVICE_URL/agents"
# Expected: List of registered agents

curl -sf "$SERVICE_URL/decision/inspect"
curl -sf "$SERVICE_URL/risk-scoring/inspect"

# 3. Decision synthesis is deterministic
# (Same inputs should produce same outputs)

# 4. Risk scores normalize correctly
curl -X POST "$SERVICE_URL/risk-scoring/score" \
  -H "Content-Type: application/json" \
  -d '{"time_range":{"start":"2026-01-01","end":"2026-01-22"}}'

# 5. DecisionEvents appear in ruvector-service
# (Check via ruvector-service API)

# 6. Telemetry appears in LLM-Observatory
# (Check observatory dashboard)

# 7. CLI commands function
agentics-agent list-agents
agentics-agent inspect
```

### Verification Matrix

| Check | Command | Expected |
|-------|---------|----------|
| Service live | `curl /health` | `{"status":"healthy"}` |
| Agents registered | `curl /agents` | Agent list |
| Decision endpoint | `curl /decision/inspect` | Agent metadata |
| Risk endpoint | `curl /risk-scoring/inspect` | Agent metadata |
| No direct SQL | Check logs | No SQL queries |
| Contract compliance | Check outputs | Valid DecisionEvent schema |

---

## 8. Failure Modes & Rollback

### Common Deployment Failures

| Failure | Detection | Resolution |
|---------|-----------|------------|
| Image build fails | Cloud Build error | Fix build errors, retry |
| Secret access denied | 403 in logs | Check IAM permissions |
| Port binding fails | Container crash | Verify PORT env var |
| Health check fails | 502 errors | Check application logs |
| Memory exceeded | OOM killed | Increase memory allocation |

### Detection Signals

- Missing DecisionEvents in ruvector-service
- Confidence scores outside valid range (0-1)
- Telemetry gaps in LLM-Observatory
- HTTP 5xx errors on agent endpoints
- Increased latency (>5s response times)

### Rollback Procedure

```bash
# 1. Get previous revision
gcloud run revisions list --service=agentics-agents --region=us-central1

# 2. Route traffic to previous revision
gcloud run services update-traffic agentics-agents \
  --region=us-central1 \
  --to-revisions=agentics-agents-PREVIOUS:100

# 3. Verify rollback
curl -sf "$SERVICE_URL/health"
```

### Safe Redeploy Strategy

1. Deploy to new revision (default: no traffic)
2. Route 10% traffic to new revision
3. Monitor for 5 minutes
4. If healthy, route 100% traffic
5. If errors, rollback to previous revision

```bash
# Gradual rollout
gcloud run services update-traffic agentics-agents \
  --region=us-central1 \
  --to-revisions=NEW_REVISION:10,PREVIOUS:90

# Full rollout after verification
gcloud run services update-traffic agentics-agents \
  --region=us-central1 \
  --to-latest
```

---

## Quick Reference

### URLs

| Service | URL |
|---------|-----|
| Agents Service | `https://agentics-agents-*.run.app` |
| RuVector | `https://ruvvector-service-1062287243982.us-central1.run.app` |
| Observatory | `https://llm-observatory-1062287243982.us-central1.run.app` |

### Deploy Command

```bash
gcloud builds submit --config=cloudbuild-agents.yaml --project=agentics-dev
```

### Verify Command

```bash
curl -sf "$(gcloud run services describe agentics-agents --region=us-central1 --format='value(status.url)')/health"
```
