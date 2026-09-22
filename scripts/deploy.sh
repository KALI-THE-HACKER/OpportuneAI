#!/usr/bin/env bash

set -Eeuo pipefail

#############################################
# Configuration
#############################################

# Auto-detect project root directory (one level up from scripts/) or use APP_DIR env override
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

SERVICE_NAME="${SERVICE_NAME:-opportuneai.service}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/health}"
LOG_FILE="${LOG_FILE:-$HOME/deploy-opportuneai.log}"

#############################################
# Logging & Formatting
#############################################

mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[1;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "[$(date '+%F %T')] $1"
}

step() {
    echo
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${BLUE}=================================================${NC}"
}

success() {
    echo -e "${GREEN}✔ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

fail() {
    echo -e "${RED}✖ $1${NC}"
}

trap 'fail "Deployment failed at line $LINENO"; exit 1' ERR

log "========================================================"
log "🚀 OpportuneAI Manual Deployment Started"

#############################################
# Stage 1 - Navigate to Project Directory
#############################################

step "Checking project directory"

if [[ ! -d "$APP_DIR" ]]; then
    fail "Application directory not found: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"
success "Project directory located: $APP_DIR"

#############################################
# Stage 2 - Save Local Uncommitted Changes
#############################################

step "Stashing local changes"

git stash push -m "Auto-stash before manual deployment $(date '+%Y-%m-%d %H:%M:%S')" || true
success "Working directory clean"

#############################################
# Stage 3 - Fetch & Pull Latest Code
#############################################

step "Pulling latest code from origin/$BRANCH"

git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

success "Repository updated to latest $BRANCH commit"

#############################################
# Stage 4 - Verify Docker Environment
#############################################

step "Verifying Docker environment"

docker --version
docker compose version

if ! docker info >/dev/null 2>&1; then
    fail "Docker daemon is not running. Please start docker."
    exit 1
fi

success "Docker engine is operational"

#############################################
# Stage 5 - Build & Update Containers
#############################################

step "Building and updating Docker Compose stack"

docker compose up -d --build --remove-orphans

success "Containers built and running"

#############################################
# Stage 6 - Run Database Migrations (Alembic)
#############################################

step "Running database migrations"

docker compose exec -T backend alembic upgrade head

success "Database migrations applied successfully"

#############################################
# Stage 7 - Restart Systemd Service
#############################################

step "Syncing and restarting systemd service"

if systemctl list-unit-files "$SERVICE_NAME" &>/dev/null; then
    if [[ -n "${SUDO_PASSWORD:-}" ]]; then
        echo "$SUDO_PASSWORD" | sudo -S -p "" systemctl restart "$SERVICE_NAME"
    else
        sudo systemctl restart "$SERVICE_NAME"
    fi

    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        success "Systemd service '$SERVICE_NAME' is active"
    else
        warn "Service restart returned non-zero, checking container status directly..."
    fi
else
    warn "Systemd unit '$SERVICE_NAME' not installed. Containers managed via Docker Compose."
fi

#############################################
# Stage 8 - Verify Application Health
#############################################

step "Verifying application HTTP health endpoint"

HEALTHY=false
for i in {1..20}; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    echo "Waiting for health check... (attempt $i/20)"
    sleep 2
done

if [[ "$HEALTHY" == "true" ]]; then
    success "Application is healthy at $HEALTH_URL"
else
    fail "Health check failed at $HEALTH_URL! Inspecting backend logs:"
    docker compose logs --tail=40 backend
    exit 1
fi

#############################################
# Stage 9 - Deployment Information
#############################################

step "Deployment Information"

echo "Branch  : $(git branch --show-current)"
echo "Commit  : $(git rev-parse --short HEAD)"
echo "Author  : $(git log -1 --pretty='%an <%ae>')"
echo "Message : $(git log -1 --pretty=%s)"
echo "Active Containers:"
docker compose ps

#############################################
# Summary
#############################################

echo
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}       OPPORTUNEAI DEPLOYMENT SUCCESSFUL        ${NC}"
echo -e "${GREEN}=================================================${NC}"

log "OpportuneAI deployment completed successfully."
log "Finished at $(date)"
