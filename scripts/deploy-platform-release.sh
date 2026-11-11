#!/usr/bin/env bash
# Called by Cloud Build only after the source build/tests. This does not grant
# deployment authority or create IAM, databases, service accounts or secrets.
set -Eeuo pipefail
: "${PROJECT_ID:?Existing GCP project is required}"
: "${SOURCE_COMMIT:?Exact source commit is required}"
: "${STAGING_RUN_ID:?Successful Stack Staging Validation run is required}"
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid source commit'; exit 1; }
[[ "$STAGING_RUN_ID" =~ ^[0-9]+$ ]] || { echo 'Invalid staging run'; exit 1; }
SERVICE=agentics-platform
REGION=us-central1
TAG="candidate-${SOURCE_COMMIT:0:12}"
STATE=$(mktemp -d)
PROMOTED=false
PREVIOUS_TRAFFIC=''

cleanup() { rm -rf "$STATE"; }
trap cleanup EXIT
current_traffic() {
  gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format=json | python3 -c 'import json,sys; t={}; [(t.update({x["revisionName"]:t.get(x["revisionName"],0)+x["percent"]})) for x in json.load(sys.stdin)["status"].get("traffic",[]) if x.get("percent",0)]; print(",".join(f"{r}={p}" for r,p in sorted(t.items())))'
}
rollback() {
  local result=$?
  trap - ERR
  if [[ "$PROMOTED" == true && -n "$PREVIOUS_TRAFFIC" ]]; then
    local traffic
    traffic=$(current_traffic) || traffic='unknown'
    if [[ "$traffic" == "${CANDIDATE[1]}=100" ]]; then
      echo 'Release verification failed; restoring the captured traffic split.'
      gcloud run services update-traffic "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --to-revisions "$PREVIOUS_TRAFFIC" --quiet || {
        echo 'Automatic traffic restoration failed; manual incident response is required.'
      }
    elif [[ "$traffic" != "$PREVIOUS_TRAFFIC" ]]; then
      echo 'Traffic changed outside this release; manual incident response is required.'
    fi
  fi
  exit "$result"
}
trap rollback ERR

# A caller-supplied success string/file is insufficient. Check GitHub's run
# metadata for this exact trusted-main commit and the live-validation workflow.
curl --fail --silent --show-error --max-time 30 \
  "https://api.github.com/repos/LLM-Dev-Ops/agentics-platform/actions/runs/$STAGING_RUN_ID" > "$STATE/staging.json"
python3 - "$STATE/staging.json" "$SOURCE_COMMIT" <<'PY'
import datetime,json,sys
run=json.load(open(sys.argv[1]))
assert run['head_sha']==sys.argv[2] and run['head_branch']=='main'
assert run['head_repository']['full_name']=='LLM-Dev-Ops/agentics-platform'
assert run['path']=='.github/workflows/stack-staging.yml'
assert run['event']=='workflow_dispatch' and run['status']=='completed' and run['conclusion']=='success'
age=datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(run['updated_at'].replace('Z','+00:00'))
assert datetime.timedelta(0)<=age<=datetime.timedelta(hours=6), 'Staging evidence is stale'
PY

# Updating existing bindings must not erase the thirteen downstream URLs.
gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format=json > "$STATE/before.json"
python3 - "$STATE/before.json" config/stack/topology.json > "$STATE/traffic" <<'PY'
import json,sys
service=json.load(open(sys.argv[1])); topology=json.load(open(sys.argv[2]))
bindings={e['name']:e for e in service['spec']['template']['spec']['containers'][0].get('env',[])}
for name in topology['platform_runtime_dependencies']:
    assert name in bindings and (bindings[name].get('value') or bindings[name].get('valueFrom')), f'Missing binding: {name}'
traffic={}
for item in service['status'].get('traffic',[]):
    if item.get('percent',0):
        assert item.get('revisionName'), 'Unresolved previous revision'
        traffic[item['revisionName']]=traffic.get(item['revisionName'],0)+item['percent']
assert sum(traffic.values())==100, 'Previous traffic split is not rollback-ready'
print(','.join(f'{name}={percent}' for name,percent in sorted(traffic.items())))
PY
PREVIOUS_TRAFFIC=$(cat "$STATE/traffic")
SERVICE_URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')
DIGEST=$(gcloud container images describe "gcr.io/$PROJECT_ID/$SERVICE:$SOURCE_COMMIT" --format='value(image_summary.digest)')
[[ "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo 'Image digest not resolved'; exit 1; }

gcloud run deploy "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --platform managed \
  --image "gcr.io/$PROJECT_ID/$SERVICE@$DIGEST" --no-traffic --tag "$TAG" \
  --port 8080 --memory 1Gi --cpu 1 --min-instances 0 --max-instances 10 --timeout 300 --concurrency 80 \
  --update-env-vars "NODE_ENV=production,SERVICE_NAME=$SERVICE,SERVICE_VERSION=$SOURCE_COMMIT" \
  --quiet
gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format=json > "$STATE/candidate.json"
python3 - "$STATE/candidate.json" "$TAG" > "$STATE/candidate" <<'PY'
import json,sys
from urllib.parse import urlsplit
items=[x for x in json.load(open(sys.argv[1]))['status']['traffic'] if x.get('tag')==sys.argv[2]]
assert len(items)==1
item=items[0]; u=urlsplit(item['url'])
assert u.scheme=='https' and u.hostname.endswith('.run.app') and not u.username and not u.password
assert item.get('revisionName')
print(item['url']); print(item['revisionName'])
PY
mapfile -t CANDIDATE < "$STATE/candidate"
# Cloud Build executes as its existing service account. Never widen service IAM.
TOKEN=$(gcloud auth print-identity-token --audiences "$SERVICE_URL")
verify() {
  local target=$1
  curl --fail --silent --show-error --max-time 20 -H "Authorization: Bearer $TOKEN" "$target/health" > "$STATE/health.json"
  curl --fail --silent --show-error --max-time 20 -H "Authorization: Bearer $TOKEN" "$target/ready" > "$STATE/ready.json"
  python3 - "$STATE/health.json" "$STATE/ready.json" "$SOURCE_COMMIT" <<'PY'
import json,sys
health=json.load(open(sys.argv[1])); ready=json.load(open(sys.argv[2]))
assert health.get('status')=='healthy' and health.get('version')==sys.argv[3]
expected={'intelligence-core','security-core','automation-core','governance-core','data-core','ecosystem-core','research-core','interface-core','agentics-orchestration-engine','agentics-results-index','agentics-simulation-runner'}
services=ready.get('services',[])
assert ready.get('status')=='ready' and len(services)==len(expected)
assert {s.get('service') for s in services}==expected and all(s.get('status')=='healthy' for s in services)
PY
  local code
  code=$(curl --silent --show-error --max-time 20 -o /dev/null -w '%{http_code}' "$target/health")
  [[ "$code" == 403 ]] || { echo 'IAM boundary did not reject anonymous access'; return 1; }
}
verify "${CANDIDATE[0]}"
[[ "$(current_traffic)" == "$PREVIOUS_TRAFFIC" ]] || { echo 'Traffic changed during validation; promotion refused'; exit 1; }
PROMOTED=true
gcloud run services update-traffic "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --to-revisions "${CANDIDATE[1]}=100" --quiet
verify "$SERVICE_URL"
echo "Verified source $SOURCE_COMMIT, image $DIGEST, revision ${CANDIDATE[1]}. Previous traffic: $PREVIOUS_TRAFFIC"
