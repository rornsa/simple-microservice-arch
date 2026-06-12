#!/usr/bin/env bash
# =================================================================
#  cleanup.sh  —  Reset ALL test data in the micro-service stack
#
#  What this does:
#    1. Purge RabbitMQ queues  (payment_request_queue, payment_queue, notification_success_queue)
#    2. Clear ALL rows in payments.db
#    3. Remove load-test students from users.db
#    4. Print a final summary row-count
#
#  Support:
#    - Detects if running in a containerized environment (Docker / Swarm)
#      and executes cleanups/queries directly inside the container namespace.
#    - Otherwise, falls back to local host CLI and APIs.
#
#  Usage:
#    chmod +x api/tests/cleanup.sh
#    ./api/tests/cleanup.sh
# =================================================================

set -euo pipefail

# ── Resolve paths ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# ── RabbitMQ management API ─────────────────────────────────────
RABBITMQ_HOST="${RABBITMQ_HOST:-localhost}"
RABBITMQ_PORT="${RABBITMQ_PORT:-15672}"
RABBITMQ_USER="${RABBITMQ_USER:-user}"
RABBITMQ_PASS="${RABBITMQ_PASS:-password}"
RABBITMQ_API="http://${RABBITMQ_HOST}:${RABBITMQ_PORT}/api"

# ── Database paths (local fallback) ──────────────────────────────
PAYMENT_DB="${PROJECT_DIR}/api/services/payment/payments.db"
STUDENT_DB="${PROJECT_DIR}/api/services/student/users.db"

# ── Options ─────────────────────────────────────────────────────
# Set to "true" to also delete ALL students (not just loadtest ones)
CLEAR_ALL_STUDENTS="${CLEAR_ALL_STUDENTS:-false}"

# ── Colour helpers ───────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Colour

ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "  ${RED}✗${NC}  $*"; }
info() { echo -e "  ${CYAN}→${NC}  $*"; }

# ── Docker/Swarm detection ───────────────────────────────────────
DOCKER_ACTIVE=false
RABBITMQ_CONTAINER=""
PAYMENT_CONTAINER=""
STUDENT_CONTAINER=""

if command -v docker &>/dev/null; then
  # Try to find running containers for rabbitmq, payment, and student services
  RABBITMQ_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "rabbitmq" | head -n 1 || true)
  PAYMENT_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "payment|payment_service" | head -n 1 || true)
  STUDENT_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "student|student_service" | head -n 1 || true)

  if [ -n "$RABBITMQ_CONTAINER" ] || [ -n "$PAYMENT_CONTAINER" ] || [ -n "$STUDENT_CONTAINER" ]; then
    DOCKER_ACTIVE=true
  fi
fi

# ── Banner ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     🗑   Micro-Service  Cleanup Script       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
info "Project root : ${PROJECT_DIR}"

if [ "$DOCKER_ACTIVE" = "true" ]; then
  info "Environment  : 🐳 Docker / Swarm containerized"
  [ -n "$RABBITMQ_CONTAINER" ] && info "RabbitMQ container: ${RABBITMQ_CONTAINER}"
  [ -n "$PAYMENT_CONTAINER" ] && info "Payment container : ${PAYMENT_CONTAINER}"
  [ -n "$STUDENT_CONTAINER" ] && info "Student container : ${STUDENT_CONTAINER}"
else
  info "Environment  : 💻 Local host machine"
  info "Payment DB   : ${PAYMENT_DB}"
  info "Student DB   : ${STUDENT_DB}"
  info "RabbitMQ API : ${RABBITMQ_API}"
fi
echo ""

ERRORS=0

# ════════════════════════════════════════════════════════════════
# STEP 1 — Purge RabbitMQ queues
# ════════════════════════════════════════════════════════════════
echo -e "${BOLD}[1/4] Purging RabbitMQ queues...${NC}"

QUEUES=("payment_request_queue" "payment_queue" "notification_success_queue")

if [ "$DOCKER_ACTIVE" = "true" ] && [ -n "$RABBITMQ_CONTAINER" ]; then
  for QUEUE in "${QUEUES[@]}"; do
    if docker exec "$RABBITMQ_CONTAINER" rabbitmqctl list_queues name 2>/dev/null | grep -q "^${QUEUE}$" 2>/dev/null; then
      docker exec "$RABBITMQ_CONTAINER" rabbitmqctl purge_queue "$QUEUE" &>/dev/null && \
        ok "Purged queue in container: ${QUEUE}" || \
        { warn "Failed to purge queue in container: ${QUEUE}"; ((ERRORS++)); }
    else
      warn "Queue not found inside container (may not have been created yet): ${QUEUE}"
    fi
  done
else
  for QUEUE in "${QUEUES[@]}"; do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time 5 \
      -u "${RABBITMQ_USER}:${RABBITMQ_PASS}" \
      -X DELETE \
      "${RABBITMQ_API}/queues/%2F/${QUEUE}/contents" 2>/dev/null || echo "000")

    case "$HTTP_STATUS" in
      204) ok "Purged queue: ${QUEUE}" ;;
      404) warn "Queue not found (may not have been created yet): ${QUEUE}" ;;
      000) warn "RabbitMQ unreachable — is it running? Skipping ${QUEUE}" ; ((ERRORS++)) ;;
      *)   warn "Unexpected status ${HTTP_STATUS} for queue: ${QUEUE}" ;;
    esac
  done
fi

echo ""

# ════════════════════════════════════════════════════════════════
# STEP 2 — Clear payment database
# ════════════════════════════════════════════════════════════════
echo -e "${BOLD}[2/4] Clearing payment database...${NC}"

if [ "$DOCKER_ACTIVE" = "true" ] && [ -n "$PAYMENT_CONTAINER" ]; then
  BEFORE=$(docker exec "$PAYMENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/payments.db'); c=conn.cursor(); print(c.execute('SELECT COUNT(*) FROM payments').fetchone()[0])" 2>/dev/null || echo "?")
  docker exec "$PAYMENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/payments.db'); c=conn.cursor(); c.execute('DELETE FROM payments'); conn.commit(); c.execute('VACUUM'); conn.close()" 2>/dev/null && \
    ok "Deleted ${BEFORE} payment record(s) from running container ($PAYMENT_CONTAINER) — DB vacuumed" || \
    { err "Failed to clear payments table in container"; ((ERRORS++)); }
else
  if command -v sqlite3 &>/dev/null; then
    if [ -f "$PAYMENT_DB" ]; then
      BEFORE=$(sqlite3 "$PAYMENT_DB" "SELECT COUNT(*) FROM payments;" 2>/dev/null || echo "?")
      sqlite3 "$PAYMENT_DB" \
        "DELETE FROM payments; VACUUM;" 2>/dev/null && \
        ok "Deleted ${BEFORE} payment record(s) — DB vacuumed" || \
        { err "Failed to clear payments table"; ((ERRORS++)); }
    else
      warn "payments.db not found — payment service may not have started yet"
      warn "Expected: ${PAYMENT_DB}"
    fi
  else
    warn "sqlite3 not installed — skipping DB cleanup"
    warn "Install with: brew install sqlite"
    ((ERRORS++))
  fi
fi

echo ""

# ════════════════════════════════════════════════════════════════
# STEP 3 — Remove load-test students from student database
# ════════════════════════════════════════════════════════════════
echo -e "${BOLD}[3/4] Cleaning student database...${NC}"

if [ "$DOCKER_ACTIVE" = "true" ] && [ -n "$STUDENT_CONTAINER" ]; then
  if [ "$CLEAR_ALL_STUDENTS" = "true" ]; then
    BEFORE=$(docker exec "$STUDENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/users.db'); c=conn.cursor(); print(c.execute('SELECT COUNT(*) FROM students').fetchone()[0])" 2>/dev/null || echo "?")
    docker exec "$STUDENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/users.db'); c=conn.cursor(); c.execute('DELETE FROM students'); conn.commit(); c.execute('VACUUM'); conn.close()" 2>/dev/null && \
      ok "Deleted ALL ${BEFORE} student(s) from running container ($STUDENT_CONTAINER) — DB vacuumed" || \
      { err "Failed to clear students table in container"; ((ERRORS++)); }
  else
    BEFORE=$(docker exec "$STUDENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/users.db'); c=conn.cursor(); print(c.execute(\"SELECT COUNT(*) FROM students WHERE email LIKE 'loadtest%@test.com'\").fetchone()[0])" 2>/dev/null || echo "?")
    docker exec "$STUDENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/users.db'); c=conn.cursor(); c.execute(\"DELETE FROM students WHERE email LIKE 'loadtest%@test.com'\"); conn.commit(); c.execute('VACUUM'); conn.close()" 2>/dev/null && \
      ok "Removed ${BEFORE} load-test student(s) from running container ($STUDENT_CONTAINER) (email: loadtest*@test.com)" || \
      { err "Failed to remove load-test students in container"; ((ERRORS++)); }

    REMAINING=$(docker exec "$STUDENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/users.db'); c=conn.cursor(); print(c.execute('SELECT COUNT(*) FROM students').fetchone()[0])" 2>/dev/null || echo "?")
    info "Real students remaining in container ($STUDENT_CONTAINER): ${REMAINING}"
  fi
else
  if command -v sqlite3 &>/dev/null; then
    if [ -f "$STUDENT_DB" ]; then
      if [ "$CLEAR_ALL_STUDENTS" = "true" ]; then
        BEFORE=$(sqlite3 "$STUDENT_DB" "SELECT COUNT(*) FROM students;" 2>/dev/null || echo "?")
        sqlite3 "$STUDENT_DB" "DELETE FROM students; VACUUM;" 2>/dev/null && \
          ok "Deleted ALL ${BEFORE} student(s) — DB vacuumed" || \
          { err "Failed to clear students table"; ((ERRORS++)); }
      else
        BEFORE=$(sqlite3 "$STUDENT_DB" \
          "SELECT COUNT(*) FROM students WHERE email LIKE 'loadtest%@test.com';" 2>/dev/null || echo "?")
        sqlite3 "$STUDENT_DB" \
          "DELETE FROM students WHERE email LIKE 'loadtest%@test.com'; VACUUM;" 2>/dev/null && \
          ok "Removed ${BEFORE} load-test student(s) (email: loadtest*@test.com)" || \
          { err "Failed to remove load-test students"; ((ERRORS++)); }

        REMAINING=$(sqlite3 "$STUDENT_DB" "SELECT COUNT(*) FROM students;" 2>/dev/null || echo "?")
        info "Real students remaining: ${REMAINING}"
      fi
    else
      warn "users.db not found — student service may not have started yet"
      warn "Expected: ${STUDENT_DB}"
    fi
  else
    warn "sqlite3 not installed — skipping student DB cleanup"
  fi
fi

echo ""

# ════════════════════════════════════════════════════════════════
# STEP 4 — Summary
# ════════════════════════════════════════════════════════════════
echo -e "${BOLD}[4/4] Final state summary...${NC}"

if [ "$DOCKER_ACTIVE" = "true" ]; then
  if [ -n "$PAYMENT_CONTAINER" ]; then
    P_COUNT=$(docker exec "$PAYMENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/payments.db'); c=conn.cursor(); print(c.execute('SELECT COUNT(*) FROM payments').fetchone()[0])" 2>/dev/null || echo "N/A")
    P_PEND=$(docker exec "$PAYMENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/payments.db'); c=conn.cursor(); print(c.execute(\"SELECT COUNT(*) FROM payments WHERE status='PENDING'\").fetchone()[0])" 2>/dev/null || echo "N/A")
    P_SUCC=$(docker exec "$PAYMENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/payments.db'); c=conn.cursor(); print(c.execute(\"SELECT COUNT(*) FROM payments WHERE status='SUCCESS'\").fetchone()[0])" 2>/dev/null || echo "N/A")
    P_FAIL=$(docker exec "$PAYMENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/payments.db'); c=conn.cursor(); print(c.execute(\"SELECT COUNT(*) FROM payments WHERE status='FAILED'\").fetchone()[0])" 2>/dev/null || echo "N/A")
    echo ""
    echo -e "  ${BOLD}payments.db (in container: $PAYMENT_CONTAINER)${NC}"
    echo    "  ┌────────────────────┬──────────┐"
    printf  "  │ %-18s │ %8s │\n" "Total payments" "$P_COUNT"
    printf  "  │ %-18s │ %8s │\n" "PENDING" "$P_PEND"
    printf  "  │ %-18s │ %8s │\n" "SUCCESS" "$P_SUCC"
    printf  "  │ %-18s │ %8s │\n" "FAILED" "$P_FAIL"
    echo    "  └────────────────────┴──────────┘"
  fi

  if [ -n "$STUDENT_CONTAINER" ]; then
    S_COUNT=$(docker exec "$STUDENT_CONTAINER" uv run python -c "import sqlite3; conn=sqlite3.connect('/app/users.db'); c=conn.cursor(); print(c.execute('SELECT COUNT(*) FROM students').fetchone()[0])" 2>/dev/null || echo "N/A")
    echo ""
    echo -e "  ${BOLD}users.db (in container: $STUDENT_CONTAINER)${NC}"
    echo    "  ┌────────────────────┬──────────┐"
    printf  "  │ %-18s │ %8s │\n" "Total students" "$S_COUNT"
    echo    "  └────────────────────┴──────────┘"
  fi

  echo ""
  echo -e "  ${BOLD}RabbitMQ queue depths (in container: $RABBITMQ_CONTAINER)${NC}"
  if [ -n "$RABBITMQ_CONTAINER" ]; then
    for QUEUE in "${QUEUES[@]}"; do
      DEPTH=$(docker exec "$RABBITMQ_CONTAINER" rabbitmqctl list_queues name messages 2>/dev/null | grep -E "^${QUEUE}[[:space:]]" | awk '{print $2}' || echo "N/A")
      printf "  │ %-30s │ %8s │\n" "$QUEUE" "$DEPTH msgs"
    done
  else
    for QUEUE in "${QUEUES[@]}"; do
      printf "  │ %-30s │ %8s │\n" "$QUEUE" "N/A msgs"
    done
  fi
else
  if command -v sqlite3 &>/dev/null; then
    if [ -f "$PAYMENT_DB" ]; then
      P_COUNT=$(sqlite3 "$PAYMENT_DB" "SELECT COUNT(*) FROM payments;" 2>/dev/null || echo "N/A")
      P_PEND=$(sqlite3 "$PAYMENT_DB" "SELECT COUNT(*) FROM payments WHERE status='PENDING';" 2>/dev/null || echo "N/A")
      P_SUCC=$(sqlite3 "$PAYMENT_DB" "SELECT COUNT(*) FROM payments WHERE status='SUCCESS';" 2>/dev/null || echo "N/A")
      P_FAIL=$(sqlite3 "$PAYMENT_DB" "SELECT COUNT(*) FROM payments WHERE status='FAILED';" 2>/dev/null || echo "N/A")
      echo ""
      echo -e "  ${BOLD}payments.db${NC}"
      echo    "  ┌────────────────────┬──────────┐"
      printf  "  │ %-18s │ %8s │\n" "Total payments" "$P_COUNT"
      printf  "  │ %-18s │ %8s │\n" "PENDING" "$P_PEND"
      printf  "  │ %-18s │ %8s │\n" "SUCCESS" "$P_SUCC"
      printf  "  │ %-18s │ %8s │\n" "FAILED" "$P_FAIL"
      echo    "  └────────────────────┴──────────┘"
    fi

    if [ -f "$STUDENT_DB" ]; then
      S_COUNT=$(sqlite3 "$STUDENT_DB" "SELECT COUNT(*) FROM students;" 2>/dev/null || echo "N/A")
      echo ""
      echo -e "  ${BOLD}users.db${NC}"
      echo    "  ┌────────────────────┬──────────┐"
      printf  "  │ %-18s │ %8s │\n" "Total students" "$S_COUNT"
      echo    "  └────────────────────┴──────────┘"
    fi
  fi

  echo ""
  echo -e "  ${BOLD}RabbitMQ queue depths${NC}"
  for QUEUE in "${QUEUES[@]}"; do
    DEPTH=$(curl -s --max-time 3 \
      -u "${RABBITMQ_USER}:${RABBITMQ_PASS}" \
      "${RABBITMQ_API}/queues/%2F/${QUEUE}" 2>/dev/null | \
      python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('messages',0))" 2>/dev/null || echo "N/A")
    printf "  │ %-30s │ %8s │\n" "$QUEUE" "$DEPTH msgs"
  done
fi

echo ""

# ── Final exit ───────────────────────────────────────────────────
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✅  Cleanup complete with no errors!${NC}"
else
  echo -e "${YELLOW}${BOLD}⚠   Cleanup finished with ${ERRORS} warning(s). See above for details.${NC}"
fi

echo ""
echo -e "  💡 To run the load test:   ${CYAN}k6 run api/tests/load-test.js${NC}"
echo -e "  💡 Install k6 (macOS):     ${CYAN}brew install k6${NC}"
echo ""
