"""
Python launcher for the ai-processing RQ worker.

Run as:  python3 -m workers.launch_ai_worker
Or via:  backend/scripts/start_ai_worker.sh
Or via:  rq worker ai-processing
"""

import os
import sys

# On macOS, ensure libobjc fork safety is disabled before any library loads
if (
    sys.platform == "darwin"
    and os.environ.get("OBJC_DISABLE_INITIALIZE_FORK_SAFETY") != "YES"
):
    os.environ["OBJC_DISABLE_INITIALIZE_FORK_SAFETY"] = "YES"
    os.environ.setdefault("NO_PROXY", "*")
    os.execv(sys.executable, [sys.executable] + sys.argv)

from rq import SimpleWorker, Worker

import workers.fork_safety  # noqa: F401
from workers.queue import redis_connection

if __name__ == "__main__":
    queues = ["ai-processing"]
    WorkerClass = SimpleWorker if sys.platform == "darwin" else Worker
    w = WorkerClass(queues, connection=redis_connection)
    w.work(with_scheduler=False)
