# Layer 4 Platform Repository SPARC Specification

## Specification

### Purpose and Identity

Layer 4 is the final unified product layer of the Agentics.dev platform and serves as the only externally exposed control plane. Layer 4 provides a unified API, CLI, SDK, and minimal UI through which all external consumers interact with the platform. Layer 4 is a pure access, routing, entitlement, and user experience layer. Layer 4 explicitly forbids implementation of intelligence logic, simulation logic, analytics computation, security enforcement beyond authentication, governance evaluation, orchestration execution, schema ownership, vector storage, or data mutation beyond authentication metadata.

### Architectural Position

Layer 4 functions as a composition and policy gateway that routes all external requests to existing Layer 3 consolidation cores and never bypasses them to call Layer 1 or Layer 2 repositories directly. Layer 4 receives requests from external clients, validates authentication and entitlements, applies rate limiting and usage tracking, and forwards the request to the appropriate Layer 3 core for processing. Layer 4 receives responses from Layer 3 cores and returns them to the external client without modification of the response payload.

### Layer 1 and Layer 2 Preservation Statement

Layer 1 and Layer 2 repositories remain first-class components of the platform as standalone engines, developer tools, and internal subsystems whose logic is consumed exclusively through Layer 3. Layer 4 never invokes Layer 1 or Layer 2 directly. This structure preserves the long-term value of all previously built repositories while enforcing strict architectural layering that separates external access from internal implementation, ensures that specialized engines continue to evolve independently, and maintains clear ownership boundaries for each functional domain.

### Layer 3 Backend Services

Layer 4 explicitly incorporates all Layer 3 repositories as first-class backend services:

#### LLM-Intelligence-Core

**Responsibility Boundary**: LLM-Intelligence-Core owns all intelligence operations including model orchestration, prompt engineering, context management, embedding generation, retrieval augmented generation, chain-of-thought execution, and multi-model routing. LLM-Intelligence-Core manages model selection, token optimization, and response synthesis.

**API Surface Exposed Through Layer 4**:
- POST /v1/intelligence/completions
- POST /v1/intelligence/embeddings
- POST /v1/intelligence/chat
- GET /v1/intelligence/models
- POST /v1/intelligence/chains

**Routing Behavior**: Layer 4 receives intelligence requests, validates the API key and scope, records the request in usage tracking, and forwards the complete request body to LLM-Intelligence-Core. Layer 4 streams responses back to the client when streaming is enabled.

**Prohibited Duplication**: Layer 4 does not implement prompt construction, model selection logic, token counting, embedding computation, context window management, or any intelligence algorithms.

#### LLM-Security-Core

**Responsibility Boundary**: LLM-Security-Core owns all security operations including threat detection, vulnerability scanning, secret detection, access policy evaluation, audit logging, compliance checking, and security event correlation. LLM-Security-Core manages security rules, detection patterns, and remediation workflows.

**API Surface Exposed Through Layer 4**:
- POST /v1/security/scan
- GET /v1/security/threats
- POST /v1/security/audit
- GET /v1/security/policies
- POST /v1/security/evaluate

**Routing Behavior**: Layer 4 receives security requests, validates the API key and scope, records the request in usage tracking, and forwards the complete request body to LLM-Security-Core. Layer 4 returns security findings without interpretation or filtering.

**Prohibited Duplication**: Layer 4 does not implement threat detection algorithms, vulnerability analysis, secret pattern matching, policy evaluation logic, or any security computations.

#### LLM-Automation-Core

**Responsibility Boundary**: LLM-Automation-Core owns all automation operations including workflow execution, task scheduling, event-driven triggers, pipeline orchestration, job queuing, retry logic, and state machine management. LLM-Automation-Core manages workflow definitions, execution context, and completion callbacks.

**API Surface Exposed Through Layer 4**:
- POST /v1/automation/workflows
- GET /v1/automation/workflows/{id}
- POST /v1/automation/workflows/{id}/trigger
- GET /v1/automation/jobs
- POST /v1/automation/schedules

**Routing Behavior**: Layer 4 receives automation requests, validates the API key and scope, records the request in usage tracking, and forwards the complete request body to LLM-Automation-Core. Layer 4 returns workflow status and job results without execution.

**Prohibited Duplication**: Layer 4 does not implement workflow engines, job schedulers, state machines, retry policies, or any automation execution logic.

#### LLM-Governance-Core

**Responsibility Boundary**: LLM-Governance-Core owns all governance operations including policy definition, compliance validation, approval workflows, audit trails, risk assessment, and regulatory mapping. LLM-Governance-Core manages governance rules, compliance frameworks, and approval chains.

**API Surface Exposed Through Layer 4**:
- POST /v1/governance/validate
- GET /v1/governance/policies
- POST /v1/governance/approvals
- GET /v1/governance/compliance
- POST /v1/governance/assess

**Routing Behavior**: Layer 4 receives governance requests, validates the API key and scope, records the request in usage tracking, and forwards the complete request body to LLM-Governance-Core. Layer 4 returns governance decisions without evaluation.

**Prohibited Duplication**: Layer 4 does not implement policy engines, compliance checkers, approval logic, risk calculators, or any governance evaluation.

#### LLM-Data-Core

**Responsibility Boundary**: LLM-Data-Core owns all data operations including data ingestion, transformation, storage orchestration, query execution, schema management, data lineage, and catalog maintenance. LLM-Data-Core manages data pipelines, storage backends, and access patterns.

**API Surface Exposed Through Layer 4**:
- POST /v1/data/ingest
- GET /v1/data/query
- GET /v1/data/catalog
- POST /v1/data/transform
- GET /v1/data/lineage

**Routing Behavior**: Layer 4 receives data requests, validates the API key and scope, records the request in usage tracking, and forwards the complete request body to LLM-Data-Core. Layer 4 returns data results without transformation.

**Prohibited Duplication**: Layer 4 does not implement data ingestion pipelines, transformation engines, query processors, schema validators, or any data mutation beyond authentication metadata.

#### LLM-Ecosystem-Core

**Responsibility Boundary**: LLM-Ecosystem-Core owns all ecosystem operations including third-party integrations, marketplace management, plugin orchestration, webhook delivery, and partner API management. LLM-Ecosystem-Core manages integration adapters, marketplace listings, and extension points.

**API Surface Exposed Through Layer 4**:
- GET /v1/ecosystem/integrations
- POST /v1/ecosystem/connect
- GET /v1/ecosystem/marketplace
- POST /v1/ecosystem/webhooks
- GET /v1/ecosystem/plugins

**Routing Behavior**: Layer 4 receives ecosystem requests, validates the API key and scope, records the request in usage tracking, and forwards the complete request body to LLM-Ecosystem-Core. Layer 4 returns ecosystem responses without modification.

**Prohibited Duplication**: Layer 4 does not implement integration adapters, webhook processing, marketplace logic, or any ecosystem orchestration.

#### LLM-Research-Core

**Responsibility Boundary**: LLM-Research-Core owns all research and simulation operations including experiment management, A/B testing, simulation execution, hypothesis validation, and research artifact storage. LLM-Research-Core manages experiment configurations, simulation engines, and result analysis. RuvVector is treated as an upstream dependency of LLM-Research-Core rather than infrastructure owned by Layer 4.

**API Surface Exposed Through Layer 4**:
- POST /v1/research/simulations
- GET /v1/research/simulations/{id}
- POST /v1/research/experiments
- GET /v1/research/results
- POST /v1/research/hypotheses

**Routing Behavior**: Layer 4 receives research and simulation requests, validates the API key and scope, records the request in usage tracking, and compiles simulation specifications before forwarding to LLM-Research-Core. Layer 4 returns simulation results and experiment data without analysis.

**Prohibited Duplication**: Layer 4 does not implement simulation engines, experiment runners, statistical analysis, or any research computation. Layer 4 does not own or manage RuvVector infrastructure.

#### LLM-Interface-Core

**Responsibility Boundary**: LLM-Interface-Core owns all interface operations including conversation management, session handling, multi-turn context, response formatting, and interface adapters for different client types. LLM-Interface-Core manages conversation state, context windows, and output formatting.

**API Surface Exposed Through Layer 4**:
- POST /v1/interface/conversations
- GET /v1/interface/conversations/{id}
- POST /v1/interface/conversations/{id}/messages
- GET /v1/interface/sessions
- POST /v1/interface/format

**Routing Behavior**: Layer 4 receives interface requests, validates the API key and scope, records the request in usage tracking, and forwards the complete request body to LLM-Interface-Core. Layer 4 streams conversation responses when enabled.

**Prohibited Duplication**: Layer 4 does not implement conversation engines, context managers, response formatters, or any interface logic beyond routing.

### Canonical API Surface

Layer 4 exposes a canonical API surface with consistent patterns across all domains:

#### Identity Endpoints

**POST /v1/identity/authenticate**
- Request: `{ "email": string, "password": string }` or `{ "api_key": string }`
- Response: `{ "token": string, "expires_at": timestamp, "scopes": string[] }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, latency_ms metric, auth_attempts counter
- Layer 3 Core: None (handled by Layer 4)

**POST /v1/identity/api-keys**
- Request: `{ "name": string, "scopes": string[], "expires_at": timestamp }`
- Response: `{ "api_key": string, "id": string, "created_at": timestamp }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, api_key_created event
- Layer 3 Core: None (handled by Layer 4)

**GET /v1/identity/whoami**
- Request: Authorization header with Bearer token or API key
- Response: `{ "user_id": string, "email": string, "scopes": string[], "usage": object }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, identity_lookup counter
- Layer 3 Core: None (handled by Layer 4)

#### Usage Endpoints

**GET /v1/usage/current**
- Request: Authorization header, optional `{ "period": string }`
- Response: `{ "requests": number, "tokens": number, "compute_seconds": number, "period": string }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, usage_query counter
- Layer 3 Core: None (handled by Layer 4)

**GET /v1/usage/history**
- Request: Authorization header, `{ "start": timestamp, "end": timestamp, "granularity": string }`
- Response: `{ "buckets": [{ "timestamp": timestamp, "requests": number, "tokens": number }] }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, usage_history_query counter
- Layer 3 Core: None (handled by Layer 4)

#### Simulation Endpoints

**POST /v1/simulate**
- Request: `{ "specification": object }` or `{ "prompt": string }` or `{ "cli_flags": object }`
- Response: `{ "simulation_id": string, "status": string, "results": object }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, simulation_started event, simulation_duration_ms metric
- Layer 3 Core: LLM-Research-Core

**GET /v1/simulate/{id}**
- Request: Authorization header, simulation_id path parameter
- Response: `{ "simulation_id": string, "status": string, "progress": number, "results": object }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, simulation_status_query counter
- Layer 3 Core: LLM-Research-Core

#### Intelligence Endpoints

**POST /v1/intelligence/completions**
- Request: `{ "model": string, "prompt": string, "max_tokens": number, "temperature": number }`
- Response: `{ "completion": string, "usage": { "prompt_tokens": number, "completion_tokens": number } }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, completion_latency_ms metric, tokens_used counter
- Layer 3 Core: LLM-Intelligence-Core

**POST /v1/intelligence/embeddings**
- Request: `{ "model": string, "input": string | string[] }`
- Response: `{ "embeddings": number[][], "usage": { "total_tokens": number } }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, embedding_latency_ms metric, vectors_generated counter
- Layer 3 Core: LLM-Intelligence-Core

#### Security Endpoints

**POST /v1/security/scan**
- Request: `{ "target": string, "scan_type": string, "options": object }`
- Response: `{ "scan_id": string, "findings": object[], "severity_summary": object }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, scan_initiated event, scan_duration_ms metric
- Layer 3 Core: LLM-Security-Core

#### Automation Endpoints

**POST /v1/automation/workflows**
- Request: `{ "name": string, "definition": object, "triggers": object[] }`
- Response: `{ "workflow_id": string, "status": string, "created_at": timestamp }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, workflow_created event
- Layer 3 Core: LLM-Automation-Core

#### Governance Endpoints

**POST /v1/governance/validate**
- Request: `{ "resource": object, "policy_ids": string[] }`
- Response: `{ "valid": boolean, "violations": object[], "recommendations": string[] }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, validation_request counter, violations_found counter
- Layer 3 Core: LLM-Governance-Core

#### Data Endpoints

**POST /v1/data/query**
- Request: `{ "query": string, "parameters": object, "format": string }`
- Response: `{ "columns": string[], "rows": object[], "metadata": object }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, query_latency_ms metric, rows_returned counter
- Layer 3 Core: LLM-Data-Core

#### Ecosystem Endpoints

**GET /v1/ecosystem/integrations**
- Request: Authorization header, optional `{ "category": string, "status": string }`
- Response: `{ "integrations": [{ "id": string, "name": string, "status": string }] }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, integrations_listed counter
- Layer 3 Core: LLM-Ecosystem-Core

#### Research Endpoints

**POST /v1/research/experiments**
- Request: `{ "name": string, "hypothesis": string, "configuration": object }`
- Response: `{ "experiment_id": string, "status": string, "created_at": timestamp }`
- Error: `{ "error": string, "code": string, "request_id": string }`
- Observability: request_id header, experiment_created event
- Layer 3 Core: LLM-Research-Core

### Error Handling

All API endpoints return errors in a consistent format:
```
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "request_id": "uuid-for-correlation",
  "details": { "field": "additional context" }
}
```

Error codes include:
- AUTHENTICATION_REQUIRED: No valid authentication provided
- AUTHORIZATION_DENIED: Valid authentication but insufficient scope
- RATE_LIMIT_EXCEEDED: Request rate exceeds entitlement
- QUOTA_EXCEEDED: Usage quota exhausted
- INVALID_REQUEST: Malformed request body or parameters
- UPSTREAM_ERROR: Layer 3 core returned an error
- SERVICE_UNAVAILABLE: Layer 3 core is unreachable

### Unified Simulation Model

Layer 4 provides a unified simulation model in which all simulation requests, regardless of origin, are compiled into a structured simulation specification and executed exclusively by LLM-Research-Core:

**CLI Flag Input**:
```
agentics simulate --scenario production-load --duration 3600 --users 1000
```
Layer 4 compiles to: `{ "scenario": "production-load", "parameters": { "duration": 3600, "users": 1000 } }`

**Structured Input**:
```
{ "scenario": "production-load", "parameters": { "duration": 3600, "users": 1000 } }
```
Layer 4 forwards directly to LLM-Research-Core.

**Natural Language Prompt**:
```
"Simulate a production load test with 1000 users for one hour"
```
Layer 4 sends to LLM-Intelligence-Core for interpretation, receives structured specification, forwards to LLM-Research-Core.

**UI Interaction**:
User configures simulation via web form. Layer 4 constructs structured specification from form values.

**External LLM Tool (Claude Code, Codex)**:
Tool invokes `/v1/simulate` with structured specification or natural language prompt. Layer 4 applies the same compilation pipeline.

All simulation execution occurs within LLM-Research-Core. RuvVector is an upstream dependency consumed by LLM-Research-Core and is not owned, managed, or directly accessed by Layer 4.

---

## Pseudocode

### Request Lifecycle

```
FUNCTION handleRequest(request):
    correlationId = generateUUID()
    attachCorrelationId(request, correlationId)

    startTime = now()

    TRY:
        credentials = extractCredentials(request)
        identity = validateCredentials(credentials)

        IF identity IS NULL:
            RETURN errorResponse(401, "AUTHENTICATION_REQUIRED", correlationId)

        endpoint = parseEndpoint(request.path)
        requiredScope = getRequiredScope(endpoint)

        IF NOT hasScope(identity, requiredScope):
            RETURN errorResponse(403, "AUTHORIZATION_DENIED", correlationId)

        IF isRateLimited(identity, endpoint):
            RETURN errorResponse(429, "RATE_LIMIT_EXCEEDED", correlationId)

        recordUsageStart(identity, endpoint, correlationId)

        layer3Core = routeToCore(endpoint)
        response = forwardRequest(layer3Core, request, correlationId)

        recordUsageEnd(identity, endpoint, correlationId, response)

        emitMetrics(endpoint, startTime, response.status)

        RETURN response

    CATCH upstreamError:
        emitErrorMetric(endpoint, upstreamError)
        RETURN errorResponse(502, "UPSTREAM_ERROR", correlationId, upstreamError.message)

    CATCH error:
        emitErrorMetric(endpoint, error)
        RETURN errorResponse(500, "INTERNAL_ERROR", correlationId)
```

### Credential Validation

```
FUNCTION validateCredentials(credentials):
    IF credentials.type == "api_key":
        apiKey = lookupApiKey(credentials.value)
        IF apiKey IS NULL OR apiKey.revoked OR apiKey.expired:
            RETURN NULL
        RETURN {
            userId: apiKey.userId,
            scopes: apiKey.scopes,
            entitlements: lookupEntitlements(apiKey.userId)
        }

    IF credentials.type == "bearer_token":
        token = verifyJWT(credentials.value)
        IF token IS NULL OR token.expired:
            RETURN NULL
        RETURN {
            userId: token.sub,
            scopes: token.scopes,
            entitlements: lookupEntitlements(token.sub)
        }

    RETURN NULL
```

### Routing Logic

```
FUNCTION routeToCore(endpoint):
    routes = {
        "/v1/intelligence/*": "LLM-Intelligence-Core",
        "/v1/security/*": "LLM-Security-Core",
        "/v1/automation/*": "LLM-Automation-Core",
        "/v1/governance/*": "LLM-Governance-Core",
        "/v1/data/*": "LLM-Data-Core",
        "/v1/ecosystem/*": "LLM-Ecosystem-Core",
        "/v1/research/*": "LLM-Research-Core",
        "/v1/simulate*": "LLM-Research-Core",
        "/v1/interface/*": "LLM-Interface-Core"
    }

    FOR pattern, core IN routes:
        IF endpoint MATCHES pattern:
            RETURN core

    RETURN NULL
```

### Simulation Compilation

```
FUNCTION compileSimulation(input):
    IF input.specification IS NOT NULL:
        RETURN validateSpecification(input.specification)

    IF input.cli_flags IS NOT NULL:
        specification = {
            scenario: input.cli_flags.scenario,
            parameters: extractParameters(input.cli_flags)
        }
        RETURN validateSpecification(specification)

    IF input.prompt IS NOT NULL:
        interpretationRequest = {
            prompt: input.prompt,
            output_schema: SIMULATION_SPECIFICATION_SCHEMA
        }
        interpretation = forwardRequest("LLM-Intelligence-Core", interpretationRequest)
        RETURN validateSpecification(interpretation.specification)

    RETURN errorResponse(400, "INVALID_REQUEST", "No simulation input provided")
```

### API Key Lifecycle

```
FUNCTION createApiKey(userId, name, scopes, expiresAt):
    validateScopes(scopes, userId)

    keyId = generateUUID()
    keyValue = generateSecureToken(32)
    keyHash = hashToken(keyValue)

    apiKey = {
        id: keyId,
        userId: userId,
        name: name,
        scopes: scopes,
        keyHash: keyHash,
        createdAt: now(),
        expiresAt: expiresAt,
        revoked: false
    }

    storeApiKey(apiKey)
    emitEvent("api_key_created", { keyId: keyId, userId: userId })

    RETURN { id: keyId, api_key: keyValue, created_at: apiKey.createdAt }


FUNCTION revokeApiKey(userId, keyId):
    apiKey = lookupApiKeyById(keyId)

    IF apiKey IS NULL OR apiKey.userId != userId:
        RETURN errorResponse(404, "NOT_FOUND", "API key not found")

    apiKey.revoked = true
    apiKey.revokedAt = now()
    storeApiKey(apiKey)

    emitEvent("api_key_revoked", { keyId: keyId, userId: userId })

    RETURN { id: keyId, revoked: true }
```

### Usage Recording

```
FUNCTION recordUsageStart(identity, endpoint, correlationId):
    usageRecord = {
        correlationId: correlationId,
        userId: identity.userId,
        endpoint: endpoint,
        startTime: now(),
        status: "in_progress"
    }
    storeUsageRecord(usageRecord)


FUNCTION recordUsageEnd(identity, endpoint, correlationId, response):
    usageRecord = lookupUsageRecord(correlationId)
    usageRecord.endTime = now()
    usageRecord.durationMs = usageRecord.endTime - usageRecord.startTime
    usageRecord.status = "completed"
    usageRecord.responseStatus = response.status
    usageRecord.tokensUsed = extractTokenUsage(response)
    storeUsageRecord(usageRecord)

    incrementUsageCounters(identity.userId, endpoint, usageRecord)
```

### Rate Limiting

```
FUNCTION isRateLimited(identity, endpoint):
    window = getCurrentRateWindow()
    key = formatRateKey(identity.userId, endpoint, window)

    currentCount = getRateCount(key)
    limit = getEntitlementLimit(identity.entitlements, endpoint)

    IF currentCount >= limit:
        RETURN true

    incrementRateCount(key)
    RETURN false
```

### Handler Pattern

```
FUNCTION intelligenceCompletionsHandler(request, identity, correlationId):
    // Layer 4 performs NO business logic
    // Handler only validates structure and forwards

    IF NOT validateRequestSchema(request.body, COMPLETIONS_SCHEMA):
        RETURN errorResponse(400, "INVALID_REQUEST", correlationId)

    upstreamRequest = {
        headers: {
            "X-Correlation-Id": correlationId,
            "X-User-Id": identity.userId,
            "X-Scopes": identity.scopes
        },
        body: request.body
    }

    response = forwardRequest("LLM-Intelligence-Core", "/completions", upstreamRequest)

    RETURN response
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL CONSUMERS                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
│  │   CLI   │  │   SDK   │  │   UI    │  │  Tools  │  │  Partner APIs   │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘  │
│       │            │            │            │                 │           │
└───────┼────────────┼────────────┼────────────┼─────────────────┼───────────┘
        │            │            │            │                 │
        └────────────┴────────────┴────────────┴─────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LAYER 4                                         │
│                    (Access, Routing, Entitlement, UX)                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         API Gateway                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │  │
│  │  │   Auth      │  │   Rate      │  │   Usage     │  │   Router    │ │  │
│  │  │   Validator │  │   Limiter   │  │   Tracker   │  │             │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Identity Service                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │   API Key   │  │   Token     │  │   Scope     │                   │  │
│  │  │   Manager   │  │   Service   │  │   Validator │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Entitlement Service                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │   Plan      │  │   Quota     │  │   Billing   │                   │  │
│  │  │   Resolver  │  │   Checker   │  │   Scaffold  │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Observability Emission                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │   Metrics   │  │   Audit     │  │   Usage     │                   │  │
│  │  │   Emitter   │  │   Logger    │  │   Reporter  │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LAYER 3                                         │
│                        (Consolidation Cores)                                 │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │ Intelligence   │  │   Security     │  │  Automation    │                │
│  │    Core        │  │     Core       │  │     Core       │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  Governance    │  │     Data       │  │   Ecosystem    │                │
│  │    Core        │  │     Core       │  │     Core       │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐                                    │
│  │   Research     │  │   Interface    │                                    │
│  │    Core        │  │     Core       │                                    │
│  │  (RuvVector)   │  │                │                                    │
│  └────────────────┘  └────────────────┘                                    │
│                                                                              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LAYER 2 (via Layer 3 only)                          │
│                        (Developer Tools & Services)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LAYER 1 (via Layer 3 only)                          │
│                        (Standalone Engines & Subsystems)                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### API Gateway

**Responsibilities**:
- Receives all external HTTP requests
- Extracts and validates authentication credentials
- Enforces rate limits per identity and endpoint
- Records usage metrics for all requests
- Routes requests to appropriate Layer 3 cores
- Returns responses with correlation IDs

**Interfaces**:
- Input: HTTP/HTTPS requests from external consumers
- Output: HTTP responses with standard headers
- Downstream: Layer 3 core service endpoints

**Data Handled**:
- Request headers and bodies (passthrough)
- Authentication tokens and API keys
- Correlation IDs for request tracing
- Rate limit counters (transient)
- Usage event payloads

#### Identity Service

**Responsibilities**:
- Manages user authentication sessions
- Issues and validates JWT tokens
- Creates, rotates, and revokes API keys
- Maintains scope and permission mappings
- Stores authentication metadata

**Interfaces**:
- Input: Authentication requests, API key operations
- Output: Tokens, API keys, identity verification results
- Storage: Authentication metadata store

**Data Handled**:
- User credentials (hashed)
- API key hashes and metadata
- JWT signing keys
- Scope definitions
- Session state

#### Entitlement Service

**Responsibilities**:
- Resolves user subscription plans
- Evaluates quota availability
- Scaffolds billing integration with Stripe
- Enforces usage limits per entitlement tier

**Interfaces**:
- Input: Entitlement queries, quota checks
- Output: Entitlement status, quota availability
- External: Stripe API (billing scaffold)

**Data Handled**:
- Subscription plan definitions
- User entitlement mappings
- Quota usage counters
- Billing customer IDs (Stripe)

#### Observability Emission

**Responsibilities**:
- Emits request metrics to metrics backend
- Generates audit events for security-relevant actions
- Reports usage data for billing and analytics
- Attaches correlation IDs to all emissions

**Interfaces**:
- Input: Metric payloads, audit events, usage records
- Output: Metrics backend, audit log store, usage database

**Data Handled**:
- Request latency measurements
- Error counts and types
- Audit event payloads
- Usage aggregation data

### Data Flow Patterns

#### Authentication Flow

```
Client → API Gateway → Identity Service → API Gateway → Client
                            │
                            ▼
                    Auth Metadata Store
```

#### Request Routing Flow

```
Client → API Gateway → Auth Validator → Rate Limiter → Router → Layer 3 Core
                            │               │            │
                            ▼               ▼            ▼
                       Identity DB    Rate Counter   Usage Tracker
```

#### Usage Recording Flow

```
Request Start → Usage Start Event → Request Processing → Usage End Event
                      │                                        │
                      ▼                                        ▼
               Usage Database                           Usage Database
                      │
                      ▼
               Billing Scaffold
```

### Infrastructure Requirements

#### Layer 4 Components

- **API Gateway**: Stateless HTTP server with TLS termination
- **Identity Database**: Persistent store for authentication metadata
- **Rate Limit Cache**: In-memory or Redis-based counter store
- **Usage Database**: Append-only event store for usage records
- **Metrics Backend**: Time-series database for operational metrics
- **Audit Log Store**: Immutable log store for security events

#### Network Configuration

- Public internet ingress for API Gateway
- Private network connectivity to all Layer 3 cores
- No direct connectivity from Layer 4 to Layer 1 or Layer 2
- TLS required for all external connections
- mTLS available for Layer 3 communication

### Security Architecture

#### Authentication Boundaries

- Layer 4 validates all external authentication
- Layer 3 cores receive pre-validated identity context
- API keys and tokens never forwarded to Layer 3
- Identity context passed via trusted internal headers

#### Data Isolation

- Layer 4 stores only authentication metadata
- Business data passes through without persistence
- Usage data contains no business content
- Audit logs contain action metadata only

---

## Refinement

### Unified CLI Specification

The unified CLI is a thin remote control with a single binary named `agentics` that communicates exclusively with the Layer 4 API:

#### Binary Configuration

- Binary name: `agentics`
- Installation: npm global package, standalone binary, or container image
- Configuration directory: `~/.agentics/`
- API key storage: `~/.agentics/credentials`
- Default API endpoint: `https://api.agentics.dev/v1`

#### Core Commands

**agentics login**
- Authenticates user via OAuth flow or email/password
- Stores session token in credentials file
- Displays current identity after successful login

**agentics whoami**
- Displays current authenticated identity
- Shows active scopes and entitlements
- Reports current usage against quotas

**agentics simulate [options]**
- `--scenario <name>`: Named scenario to execute
- `--config <file>`: JSON or YAML specification file
- `--prompt "<text>"`: Natural language simulation description
- `--duration <seconds>`: Simulation duration
- `--users <count>`: Simulated user count
- `--output <format>`: Output format (json, table, summary)

**agentics intelligence completions [options]**
- `--model <name>`: Model to use for completion
- `--prompt "<text>"`: Prompt text
- `--max-tokens <count>`: Maximum tokens in response
- `--temperature <value>`: Sampling temperature
- `--stream`: Enable streaming output

**agentics security scan [options]**
- `--target <path>`: Target file or directory
- `--type <scan_type>`: Scan type (secrets, vulnerabilities, compliance)
- `--output <format>`: Output format (json, sarif, table)

**agentics automation workflows [subcommand]**
- `list`: List all workflows
- `create <file>`: Create workflow from definition
- `trigger <id>`: Trigger workflow execution
- `status <id>`: Check workflow status

**agentics api-keys [subcommand]**
- `list`: List all API keys
- `create <name>`: Create new API key
- `revoke <id>`: Revoke existing API key

**agentics usage [options]**
- `--period <range>`: Time period (today, week, month)
- `--format <type>`: Output format (json, table, chart)

#### Command Mapping

Commands map to capabilities rather than repositories:
- `agentics simulate` maps to research/simulation capability
- `agentics intelligence` maps to intelligence capability
- `agentics security` maps to security capability
- `agentics automation` maps to automation capability

#### Authentication Requirement

All commands except `login` and `--help` require valid authentication. The CLI reads API key from:
1. `AGENTICS_API_KEY` environment variable
2. `~/.agentics/credentials` file
3. Interactive prompt if neither available

### SDK Specification

The SDK is a thin, stateless, versioned JavaScript and TypeScript library that mirrors the Layer 4 API:

#### Package Configuration

- Package name: `@agentics/sdk`
- TypeScript: First-class support with full type definitions
- Module formats: ESM and CommonJS
- Minimum Node.js: 18.x
- Browser support: Modern browsers via bundler

#### Client Initialization

```typescript
import { AgenticsClient } from '@agentics/sdk';

const client = new AgenticsClient({
  apiKey: process.env.AGENTICS_API_KEY,
  baseUrl: 'https://api.agentics.dev/v1', // optional
  timeout: 30000, // optional
  retries: 3 // optional
});
```

#### API Methods

**Identity**
```typescript
client.identity.authenticate(credentials: AuthCredentials): Promise<AuthResult>
client.identity.whoami(): Promise<Identity>
client.identity.apiKeys.list(): Promise<ApiKey[]>
client.identity.apiKeys.create(params: CreateApiKeyParams): Promise<ApiKey>
client.identity.apiKeys.revoke(keyId: string): Promise<void>
```

**Simulation**
```typescript
client.simulate(params: SimulateParams): Promise<SimulationResult>
client.simulate.get(simulationId: string): Promise<SimulationStatus>
client.simulate.stream(params: SimulateParams): AsyncIterable<SimulationEvent>
```

**Intelligence**
```typescript
client.intelligence.completions(params: CompletionParams): Promise<Completion>
client.intelligence.completions.stream(params: CompletionParams): AsyncIterable<CompletionChunk>
client.intelligence.embeddings(params: EmbeddingParams): Promise<Embeddings>
client.intelligence.models(): Promise<Model[]>
```

**Security**
```typescript
client.security.scan(params: ScanParams): Promise<ScanResult>
client.security.threats(): Promise<Threat[]>
client.security.policies(): Promise<Policy[]>
```

**Automation**
```typescript
client.automation.workflows.list(): Promise<Workflow[]>
client.automation.workflows.create(params: WorkflowParams): Promise<Workflow>
client.automation.workflows.trigger(workflowId: string): Promise<WorkflowRun>
client.automation.workflows.status(workflowId: string): Promise<WorkflowStatus>
```

**Governance**
```typescript
client.governance.validate(params: ValidateParams): Promise<ValidationResult>
client.governance.policies(): Promise<GovernancePolicy[]>
```

**Data**
```typescript
client.data.query(params: QueryParams): Promise<QueryResult>
client.data.catalog(): Promise<CatalogEntry[]>
```

**Ecosystem**
```typescript
client.ecosystem.integrations(): Promise<Integration[]>
client.ecosystem.connect(params: ConnectParams): Promise<Connection>
client.ecosystem.marketplace(): Promise<MarketplaceItem[]>
```

**Research**
```typescript
client.research.experiments.create(params: ExperimentParams): Promise<Experiment>
client.research.experiments.get(experimentId: string): Promise<Experiment>
client.research.results(experimentId: string): Promise<Results>
```

**Usage**
```typescript
client.usage.current(params?: UsageParams): Promise<UsageSummary>
client.usage.history(params: HistoryParams): Promise<UsageHistory>
```

#### Error Handling

```typescript
import { AgenticsError, AuthenticationError, RateLimitError } from '@agentics/sdk';

try {
  await client.intelligence.completions(params);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Handle authentication failure
  } else if (error instanceof RateLimitError) {
    // Handle rate limiting with retry-after
  } else if (error instanceof AgenticsError) {
    // Handle other API errors
    console.error(error.code, error.requestId);
  }
}
```

#### Streaming Support

```typescript
for await (const chunk of client.intelligence.completions.stream(params)) {
  process.stdout.write(chunk.text);
}
```

### Minimal UI Specification

The minimal UI is limited to essential account management functions:

#### Login Page

- Email and password authentication
- OAuth provider buttons (Google, GitHub)
- Redirect to API key management after login

#### API Key Management Page

- Table of existing API keys with name, created date, last used, scopes
- Create new API key form with name and scope selection
- Revoke button for each key with confirmation
- Copy key button (shown once on creation)

#### Usage Dashboard Page

- Current period usage summary (requests, tokens, compute)
- Usage against quota visualization
- Historical usage chart (daily/weekly/monthly)
- Export usage data button

#### Account Settings Page

- Email and password management
- Subscription plan display
- Billing information (link to Stripe customer portal)
- Delete account button with confirmation

#### UI Constraints

- No simulation configuration interface (use CLI or SDK)
- No workflow builder (use CLI or SDK)
- No analytics dashboards beyond usage
- No governance policy editor
- No security scan viewer
- Stateless frontend with API-only data access

### Authentication Specification

#### Supported Authentication Methods

**API Key Authentication**
- Format: `agentics_<base64_random_32_bytes>`
- Header: `Authorization: Bearer agentics_...`
- Storage: Hashed with bcrypt in identity database
- Rotation: Supported via create-then-revoke pattern

**Session Token Authentication**
- Format: JWT with RS256 signature
- Header: `Authorization: Bearer eyJ...`
- Expiration: 24 hours, refresh supported
- Claims: sub, email, scopes, exp, iat

**OAuth Integration**
- Providers: Google, GitHub
- Flow: Authorization code with PKCE
- Token exchange handled by Layer 4

#### API Key Lifecycle

1. **Creation**: User requests new key via UI, CLI, or SDK
2. **Issuance**: Layer 4 generates key, stores hash, returns plaintext once
3. **Usage**: Key validated on each request, last_used updated
4. **Rotation**: User creates new key, updates applications, revokes old key
5. **Revocation**: Key marked revoked, immediately rejected on requests

#### Scope Definitions

- `identity:read`: Read own identity and usage
- `identity:write`: Manage API keys
- `intelligence:read`: Read model information
- `intelligence:write`: Execute completions and embeddings
- `security:read`: View security policies
- `security:write`: Execute scans
- `automation:read`: View workflows
- `automation:write`: Create and trigger workflows
- `governance:read`: View governance policies
- `governance:write`: Execute validations
- `data:read`: Execute queries
- `data:write`: Ingest data
- `ecosystem:read`: View integrations
- `ecosystem:write`: Manage connections
- `research:read`: View experiments
- `research:write`: Create and run simulations
- `admin:*`: Full administrative access

### Entitlement and Billing Specification

#### Entitlement Tiers

**Free Tier**
- 1,000 API requests per month
- 100,000 tokens per month
- 1 API key
- Community support

**Developer Tier**
- 50,000 API requests per month
- 5,000,000 tokens per month
- 10 API keys
- Email support

**Team Tier**
- 500,000 API requests per month
- 50,000,000 tokens per month
- 100 API keys
- Priority support
- Team member management

**Enterprise Tier**
- Unlimited API requests
- Unlimited tokens
- Unlimited API keys
- Dedicated support
- Custom SLA

#### Billing Scaffold

- Stripe integration present but not enforced for MVP
- Stripe Customer created on user registration
- Stripe Subscription created on tier upgrade
- Stripe Checkout session for payment method collection
- Stripe Billing Portal link for self-service management
- Usage-based billing metering infrastructure in place
- Actual billing enforcement deferred to post-MVP

#### Usage Tracking

- Every API request recorded with endpoint, tokens, duration
- Aggregated hourly, daily, monthly
- Real-time quota checking against entitlement limits
- Overage alerts at 80%, 90%, 100% of quota
- Usage data retained for 13 months

### Observability Specification

#### Request Metrics

- `api_request_total`: Counter of requests by endpoint, status
- `api_request_duration_seconds`: Histogram of request latency
- `api_request_size_bytes`: Histogram of request body size
- `api_response_size_bytes`: Histogram of response body size
- `api_error_total`: Counter of errors by endpoint, code

#### Correlation IDs

- Generated as UUIDv4 for each request
- Attached as `X-Request-Id` response header
- Included in all log entries for the request
- Passed to Layer 3 cores as `X-Correlation-Id`
- Included in error responses as `request_id`

#### Audit Events

- `user.login`: User authenticated successfully
- `user.logout`: User session terminated
- `api_key.created`: New API key generated
- `api_key.revoked`: API key revoked
- `api_key.used`: API key used for authentication
- `scope.elevated`: User granted additional scopes
- `quota.exceeded`: User exceeded usage quota
- `rate_limit.triggered`: Rate limit enforced

#### Usage Emission

- Every request generates usage event
- Events contain: user_id, endpoint, timestamp, tokens, duration
- Events written to append-only usage store
- No analysis performed in Layer 4
- Analysis delegated to downstream billing and analytics systems

---

## Completion

### Acceptance Criteria

Layer 4 is considered complete when all of the following conditions are met:

#### Layer 3 Core Reachability

1. All eight Layer 3 cores (Intelligence, Security, Automation, Governance, Data, Ecosystem, Research, Interface) are reachable exclusively through Layer 4 API endpoints
2. No external consumer can invoke any Layer 3 core directly
3. All Layer 3 endpoints are mapped to corresponding Layer 4 routes
4. Layer 4 successfully proxies requests to each Layer 3 core and returns responses

#### Authentication Enforcement

1. The CLI operates solely via API keys stored in local credentials file
2. The SDK operates solely via API keys provided at client initialization
3. The UI operates solely via session tokens obtained through authentication
4. No unauthenticated requests reach any Layer 3 core
5. API key creation, rotation, and revocation function correctly
6. Scope-based authorization enforces access to endpoints correctly

#### Simulation Capability

1. Simulations can be triggered through structured JSON specification via API
2. Simulations can be triggered through CLI flags that compile to specification
3. Simulations can be triggered through natural language prompts that compile to specification
4. Simulations can be triggered through UI form inputs that compile to specification
5. All simulation requests route to LLM-Research-Core for execution
6. Simulation status and results are retrievable through the API

#### Usage Recording

1. Every API request is recorded with endpoint, timestamp, and identity
2. Token usage is extracted from intelligence responses and recorded
3. Usage aggregation produces correct hourly, daily, and monthly totals
4. Usage queries return accurate current and historical data
5. Quota enforcement correctly blocks requests when limits are exceeded

#### Billing Primitives

1. Stripe Customer objects are created for new users
2. Stripe Subscription objects are created for paid tier users
3. Stripe Checkout sessions generate correctly for payment collection
4. Stripe Billing Portal links function for customer self-service
5. Usage metering infrastructure records events for future billing
6. Billing enforcement remains disabled until explicit enablement

#### Platform Sell-Readiness

1. External developers can sign up and obtain API keys
2. External developers can authenticate CLI and SDK with obtained keys
3. External developers can invoke all documented API endpoints
4. External developers can view their usage and manage their account
5. Documentation accurately describes all endpoints, parameters, and responses
6. Error messages provide actionable information for debugging

### Non-Goals

The following are explicitly out of scope for Layer 4:

#### Prohibited Duplications

1. Layer 4 does not implement any intelligence algorithms, model routing, prompt engineering, or token optimization
2. Layer 4 does not implement any security scanning, threat detection, vulnerability analysis, or policy evaluation
3. Layer 4 does not implement any workflow execution, job scheduling, state machines, or automation logic
4. Layer 4 does not implement any governance evaluation, compliance checking, or approval workflows
5. Layer 4 does not implement any data transformation, query execution, or schema management
6. Layer 4 does not implement any ecosystem adapters, webhook processing, or integration logic
7. Layer 4 does not implement any simulation execution, experiment running, or research computation
8. Layer 4 does not implement any conversation management, context handling, or interface formatting

#### Prohibited Executions

1. Layer 4 does not execute any intelligence operations locally
2. Layer 4 does not execute any simulations locally
3. Layer 4 does not perform any analytics computation on usage data
4. Layer 4 does not evaluate any business rules or policies
5. Layer 4 does not transform any business data passing through

#### Prohibited Expansions

1. Layer 4 does not expand into a full SaaS dashboard with analytics visualizations
2. Layer 4 does not expand into a workflow builder or automation designer
3. Layer 4 does not expand into a security operations center
4. Layer 4 does not expand into a governance policy editor
5. Layer 4 does not expand into a data catalog browser
6. Layer 4 does not expand into a marketplace administration interface

### Verification Checklist

#### Infrastructure Verification

- [ ] API Gateway accepts requests on public endpoint
- [ ] TLS certificates are valid and properly configured
- [ ] Layer 3 core connectivity is established via private network
- [ ] Rate limit cache is operational
- [ ] Usage database is accepting writes
- [ ] Metrics backend is receiving emissions
- [ ] Audit log store is capturing events

#### Functional Verification

- [ ] User registration creates account and Stripe customer
- [ ] User login returns valid session token
- [ ] API key creation returns working key
- [ ] API key authentication succeeds for all endpoints
- [ ] Rate limiting triggers at configured thresholds
- [ ] Usage recording captures all requests
- [ ] Quota enforcement blocks requests at limits

#### Integration Verification

- [ ] Intelligence endpoints proxy to LLM-Intelligence-Core
- [ ] Security endpoints proxy to LLM-Security-Core
- [ ] Automation endpoints proxy to LLM-Automation-Core
- [ ] Governance endpoints proxy to LLM-Governance-Core
- [ ] Data endpoints proxy to LLM-Data-Core
- [ ] Ecosystem endpoints proxy to LLM-Ecosystem-Core
- [ ] Research endpoints proxy to LLM-Research-Core
- [ ] Interface endpoints proxy to LLM-Interface-Core

#### Client Verification

- [ ] CLI login command authenticates successfully
- [ ] CLI whoami command displays correct identity
- [ ] CLI simulate command executes simulation
- [ ] SDK client initializes with API key
- [ ] SDK methods invoke corresponding endpoints
- [ ] SDK error handling catches and categorizes errors
- [ ] UI login flow authenticates user
- [ ] UI displays and manages API keys
- [ ] UI displays usage data correctly

#### Documentation Verification

- [ ] API reference documents all endpoints
- [ ] CLI reference documents all commands
- [ ] SDK reference documents all methods
- [ ] Authentication guide explains all methods
- [ ] Quickstart guide enables first API call
- [ ] Error reference explains all error codes
