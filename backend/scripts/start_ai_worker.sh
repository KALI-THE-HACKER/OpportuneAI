#!/usr/bin/env bash
# Launch ai-processing RQ worker with macOS fork-safety env-var set at OS
# level (before Python/libobjc start) AND via the Python launcher script
# (which imports workers.fork_safety in the parent before any fork()).
set -euo pipefail
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES   # must reach _objc_init()
export NO_PROXY="*"
cd "$BACKEND_DIR"
exec python3 -m workers.launch_ai_worker "$@"
