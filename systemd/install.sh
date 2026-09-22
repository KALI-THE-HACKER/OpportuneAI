#!/usr/bin/env bash
# ==============================================================================
# OpportuneAI Systemd Service Installer
# Installs and enables opportuneai.service to manage Docker Compose on system boot.
# ==============================================================================

set -euo pipefail

# Ensure running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (e.g. sudo ./systemd/install.sh)" >&2
  exit 1
fi

# Detect repository root directory (one level up from script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVICE_DEST="/etc/systemd/system/opportuneai.service"

echo "Installing OpportuneAI systemd service..."
echo "-> Application Directory: ${REPO_DIR}"
echo "-> Target Service Unit:  ${SERVICE_DEST}"

# Copy service unit and replace WorkingDirectory with the actual repository location
sed "s|WorkingDirectory=/opt/opportuneai|WorkingDirectory=${REPO_DIR}|g" "${SCRIPT_DIR}/opportuneai.service" > "${SERVICE_DEST}"
chmod 0644 "${SERVICE_DEST}"

# Reload systemd daemon
echo "-> Reloading systemd daemon..."
systemctl daemon-reload

# Enable service on boot
echo "-> Enabling opportuneai.service on system boot..."
systemctl enable opportuneai.service

echo ""
echo "Successfully installed and enabled opportuneai.service!"
echo "Useful commands:"
echo "  sudo systemctl start opportuneai    # Start stack"
echo "  sudo systemctl stop opportuneai     # Stop stack"
echo "  sudo systemctl restart opportuneai  # Restart stack"
echo "  sudo systemctl status opportuneai   # Check status"
echo "  journalctl -u opportuneai -f       # View systemd logs"
