#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
  printf 'Created .env from .env.example. Set the required values, then run this script again.\n'
  exit 1
fi

for command_name in node npm docker python3; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Error: %s is required to run the ARA backend.\n' "$command_name" >&2
    exit 1
  fi
done

if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  printf 'Error: Node.js 20 or newer is required.\n' >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  printf 'Error: Docker Compose is required to start PostgreSQL.\n' >&2
  exit 1
fi

set -a
source .env
set +a

API_PORT="${PORT:-3000}"
CRM_PORT="${ARA_CRM_LOCAL_PORT:-3001}"
ADMIN_PORT="${ARA_ADMIN_LOCAL_PORT:-3002}"

for port in "$API_PORT" "$CRM_PORT" "$ADMIN_PORT"; do
  if [[ ! "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
    printf 'Error: ports must be integers between 1 and 65535.\n' >&2
    exit 1
  fi
done

if [[ "$API_PORT" == "$CRM_PORT" || "$API_PORT" == "$ADMIN_PORT" || "$CRM_PORT" == "$ADMIN_PORT" ]]; then
  printf 'Error: backend, Company CRM, and Super Admin must use different ports.\n' >&2
  exit 1
fi

export ARA_CRM_ORIGIN="${ARA_CRM_ORIGIN:+$ARA_CRM_ORIGIN,}http://localhost:$CRM_PORT,http://127.0.0.1:$CRM_PORT"
export ARA_ADMIN_ORIGIN="${ARA_ADMIN_ORIGIN:+$ARA_ADMIN_ORIGIN,}http://localhost:$ADMIN_PORT,http://127.0.0.1:$ADMIN_PORT"

docker compose up -d db

printf 'Waiting for PostgreSQL'
for _ in {1..30}; do
  if docker compose exec -T db pg_isready -U ara -d ara >/dev/null 2>&1; then
    printf ' ready\n'
    break
  fi
  printf '.'
  sleep 1
done

if ! docker compose exec -T db pg_isready -U ara -d ara >/dev/null 2>&1; then
  printf '\nError: PostgreSQL did not become ready. Check `docker compose logs db`.\n' >&2
  exit 1
fi

schema_status="$(docker compose exec -T db psql -U ara -d ara -v ON_ERROR_STOP=1 -At -c "SELECT concat((to_regclass('public.agency_users') IS NOT NULL)::int, '|', (to_regclass('public.platform_admin_users') IS NOT NULL)::int)")"
if [[ "$schema_status" != "1|1" ]]; then
  printf 'Error: ARA database tables are missing. Apply the migrations in migrations/ before starting the backend.\n' >&2
  exit 1
fi

admin_count="$(docker compose exec -T db psql -U ara -d ara -v ON_ERROR_STOP=1 -At -c 'SELECT count(*) FROM platform_admin_users')"
if [[ "$admin_count" == "0" ]]; then
  read -rp 'First Super Admin email: ' ARA_BOOTSTRAP_PLATFORM_ADMIN_EMAIL
  read -rp 'First Super Admin full name: ' ARA_BOOTSTRAP_PLATFORM_ADMIN_NAME
  if [[ ! "$ARA_BOOTSTRAP_PLATFORM_ADMIN_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ || ${#ARA_BOOTSTRAP_PLATFORM_ADMIN_NAME} -lt 2 ]]; then
    printf 'Error: enter a valid Super Admin email and a name of at least 2 characters.\n' >&2
    exit 1
  fi
  read -rsp 'Create Super Admin password (minimum 16 characters): ' admin_password
  printf '\n'
  read -rsp 'Confirm Super Admin password: ' admin_password_confirm
  printf '\n'
  if [[ ${#admin_password} -lt 16 || "$admin_password" != "$admin_password_confirm" ]]; then
    printf 'Error: Super Admin passwords must match and be at least 16 characters.\n' >&2
    exit 1
  fi
  export ARA_BOOTSTRAP_PLATFORM_ADMIN_EMAIL ARA_BOOTSTRAP_PLATFORM_ADMIN_NAME
  export ARA_BOOTSTRAP_PLATFORM_ADMIN_PASSWORD="$admin_password"
  unset admin_password admin_password_confirm
else
  printf 'A platform administrator already exists; skipping Super Admin bootstrap.\n'
  unset ARA_BOOTSTRAP_PLATFORM_ADMIN_PASSWORD
fi

read -rp 'Initial Company CRM owner email: ' ARA_BOOTSTRAP_OWNER_EMAIL
if [[ ! "$ARA_BOOTSTRAP_OWNER_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  printf 'Error: enter a valid company owner email.\n' >&2
  exit 1
fi
owner_exists="$(docker compose exec -T db psql -U ara -d ara -v ON_ERROR_STOP=1 -At -v email="$ARA_BOOTSTRAP_OWNER_EMAIL" -c "SELECT EXISTS (SELECT 1 FROM agency_users WHERE lower(email)=lower(:'email'))::int")"
if [[ "$owner_exists" == "0" ]]; then
  read -rp 'Initial company name: ' ARA_BOOTSTRAP_AGENCY_NAME
  read -rp 'Company owner full name: ' ARA_BOOTSTRAP_OWNER_FULL_NAME
  if [[ ${#ARA_BOOTSTRAP_AGENCY_NAME} -lt 2 || ${#ARA_BOOTSTRAP_OWNER_FULL_NAME} -lt 2 ]]; then
    printf 'Error: company and owner names must be at least 2 characters.\n' >&2
    exit 1
  fi
  read -rsp 'Create Company CRM password (minimum 12 characters): ' owner_password
  printf '\n'
  read -rsp 'Confirm Company CRM password: ' owner_password_confirm
  printf '\n'
  if [[ ${#owner_password} -lt 12 || "$owner_password" != "$owner_password_confirm" ]]; then
    printf 'Error: Company CRM passwords must match and be at least 12 characters.\n' >&2
    exit 1
  fi
  export ARA_BOOTSTRAP_OWNER_EMAIL ARA_BOOTSTRAP_AGENCY_NAME ARA_BOOTSTRAP_OWNER_FULL_NAME
  export ARA_BOOTSTRAP_OWNER_PASSWORD="$owner_password"
  unset owner_password owner_password_confirm
else
  printf 'A company account already exists for that email; skipping owner bootstrap.\n'
  unset ARA_BOOTSTRAP_OWNER_PASSWORD
fi

if [[ ! -d node_modules ]]; then
  npm install --no-package-lock
fi

backend_pid=''
crm_pid=''
admin_pid=''
shutdown() {
  for pid in "$crm_pid" "$admin_pid" "$backend_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  for pid in "$crm_pid" "$admin_pid" "$backend_pid"; do
    if [[ -n "$pid" ]]; then
      wait "$pid" 2>/dev/null || true
    fi
  done
}
trap shutdown EXIT INT TERM

npm run start:dev &
backend_pid=$!
unset ARA_BOOTSTRAP_PLATFORM_ADMIN_PASSWORD ARA_BOOTSTRAP_OWNER_PASSWORD
python3 -m http.server "$CRM_PORT" --directory "$ROOT_DIR/apps/company-crm" --bind 127.0.0.1 &
crm_pid=$!
python3 -m http.server "$ADMIN_PORT" --directory "$ROOT_DIR/apps/super-admin" --bind 127.0.0.1 &
admin_pid=$!

wait_for_http() {
  local url="$1"
  local pid="$2"
  for _ in {1..60}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      printf 'Error: service failed to start at %s.\n' "$url" >&2
      return 1
    fi
    if node -e 'fetch(process.argv[1]).then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))' "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  printf 'Error: service did not become ready at %s.\n' "$url" >&2
  return 1
}

if ! wait_for_http "http://127.0.0.1:$API_PORT/health" "$backend_pid" ||
   ! wait_for_http "http://127.0.0.1:$CRM_PORT/" "$crm_pid" ||
   ! wait_for_http "http://127.0.0.1:$ADMIN_PORT/" "$admin_pid"; then
  exit 1
fi

printf '\nARA is running:\n  Backend:     http://localhost:%s\n  Company CRM: http://localhost:%s/?araApiPort=%s\n  Super Admin: http://localhost:%s/?araApiPort=%s\n' "$API_PORT" "$CRM_PORT" "$API_PORT" "$ADMIN_PORT" "$API_PORT"
if [[ "${owner_exists:-0}" == "0" ]]; then
  owner_slug="$(docker compose exec -T db psql -U ara -d ara -v ON_ERROR_STOP=1 -At -v email="$ARA_BOOTSTRAP_OWNER_EMAIL" -c "SELECT a.slug FROM agencies a JOIN agency_users u ON u.agency_id=a.id WHERE lower(u.email)=lower(:'email') AND u.role='owner' LIMIT 1")"
  printf 'Company CRM login: email %s, company slug %s\n' "$ARA_BOOTSTRAP_OWNER_EMAIL" "$owner_slug"
fi
if [[ "${admin_count:-0}" == "0" ]]; then
  printf 'Super Admin login: email %s\n' "$ARA_BOOTSTRAP_PLATFORM_ADMIN_EMAIL"
fi
printf 'Press Ctrl+C to stop the backend and both local frontends. PostgreSQL remains running.\n'
wait "$backend_pid"
