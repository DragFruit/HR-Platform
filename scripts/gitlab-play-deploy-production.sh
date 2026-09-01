#!/usr/bin/env bash
# Запуск job deploy:production в последнем pipeline ветки main через GitLab API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GITLAB_HOST="ilnizumak.beget.app"
PROJECT_PATH="vbi/hrplatform"
PROJECT_ENC="vbi%2Fhrplatform"
API_BASE="https://${GITLAB_HOST}/api/v4"
REF="${GITLAB_DEPLOY_REF:-main}"
JOB_NAME="deploy:production"
POLL_INTERVAL="${GITLAB_DEPLOY_POLL_SEC:-15}"
POLL_MAX="${GITLAB_DEPLOY_POLL_MAX:-120}"

load_gitlab_token() {
  if [[ -n "${GITLAB_TOKEN:-}" ]]; then
    return 0
  fi
  local env_file="${ROOT}/frontend/.env"
  if [[ ! -f "${env_file}" ]]; then
    return 1
  fi
  local line
  line="$(grep -E '^[[:space:]]*GITLAB_TOKEN=' "${env_file}" | tail -1 || true)"
  [[ -n "${line}" ]] || return 1
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line#GITLAB_TOKEN=}"
  line="${line#"${line%%[![:space:]]*}"}"
  if [[ "${line}" =~ ^\"(.*)\"$ ]]; then
    line="${BASH_REMATCH[1]}"
  elif [[ "${line}" =~ ^\'(.*)\'$ ]]; then
    line="${BASH_REMATCH[1]}"
  fi
  GITLAB_TOKEN="${line}"
  export GITLAB_TOKEN
}

api_get() {
  curl -fsS --header "PRIVATE-TOKEN: ${GITLAB_TOKEN}" "${API_BASE}$1"
}

api_post() {
  curl -fsS --request POST --header "PRIVATE-TOKEN: ${GITLAB_TOKEN}" "${API_BASE}$1"
}

if ! load_gitlab_token || [[ -z "${GITLAB_TOKEN:-}" ]]; then
  echo "Нет GITLAB_TOKEN." >&2
  echo "Задайте переменную окружения или добавьте в frontend/.env строку GITLAB_TOKEN=glpat-… (scope api)." >&2
  echo "Создать токен: https://${GITLAB_HOST}/-/user_settings/personal_access_tokens" >&2
  exit 1
fi

echo "→ GitLab: последний pipeline «${REF}», job «${JOB_NAME}»"

pipeline_json="$(api_get "/projects/${PROJECT_ENC}/pipelines?ref=${REF}&order_by=id&sort=desc&per_page=1")"
pipeline_id="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"] if d else "")' <<< "${pipeline_json}")"

if [[ -z "${pipeline_id}" ]]; then
  echo "Pipeline для ref «${REF}» не найден." >&2
  exit 1
fi

pipeline_web="https://${GITLAB_HOST}/${PROJECT_PATH}/-/pipelines/${pipeline_id}"
echo "  Pipeline #${pipeline_id}: ${pipeline_web}"

jobs_json="$(api_get "/projects/${PROJECT_ENC}/pipelines/${pipeline_id}/jobs?per_page=100")"
job_id="$(JOB_NAME="${JOB_NAME}" python3 << 'PY'
import json, os, sys
jobs = json.load(sys.stdin)
name = os.environ["JOB_NAME"]
ok = {"manual", "created", "scheduled"}
candidates = [j for j in jobs if j.get("name") == name and j.get("status") in ok]
if not candidates:
    candidates = [j for j in jobs if j.get("name") == name]
if not candidates:
    sys.exit(0)

def rank(j):
    st = j.get("status", "")
    return (0 if st in ok else 1, -int(j.get("id", 0)))

candidates.sort(key=rank)
print(candidates[0]["id"])
PY
<<< "${jobs_json}")"

if [[ -z "${job_id}" ]]; then
  echo "Job «${JOB_NAME}» не найден или не в статусе manual/created в pipeline #${pipeline_id}." >&2
  echo "Откройте pipeline и проверьте, что build:production успешен и deploy:production ждёт ▶." >&2
  exit 1
fi

job_web="https://${GITLAB_HOST}/${PROJECT_PATH}/-/jobs/${job_id}"
echo "→ Play job #${job_id}"
api_post "/projects/${PROJECT_ENC}/jobs/${job_id}/play" >/dev/null
echo "  ${job_web}"

echo "→ Ожидание завершения (опрос каждые ${POLL_INTERVAL} с)…"
for ((i = 1; i <= POLL_MAX; i++)); do
  job_json="$(api_get "/projects/${PROJECT_ENC}/jobs/${job_id}")"
  status="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<< "${job_json}")"
  case "${status}" in
    success)
      echo "✓ deploy:production успешен."
      echo "  ${job_web}"
      exit 0
      ;;
    failed|canceled|skipped)
      echo "✗ deploy:production завершился со статусом «${status}»." >&2
      echo "  ${job_web}" >&2
      exit 1
      ;;
    *)
      printf "  … %s (%s/%s)\n" "${status}" "${i}" "${POLL_MAX}"
      sleep "${POLL_INTERVAL}"
      ;;
  esac
done

echo "Таймаут ожидания job. Проверьте вручную: ${job_web}" >&2
exit 1
