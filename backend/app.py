from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.admin import router as admin_router
from routes.applications import router as applications_router
from routes.auth import router as auth_router
from routes.events import router as events_router
from routes.feed import router as feed_router
from routes.notifications import router as notifications_router
from routes.outreach import router as outreach_router
from routes.resume import router as resume_router
from services.log_stream_service import LogStreamService
from services.scheduler import SchedulerService
from utils.logging_config import configure_logging, get_feature_logger

configure_logging()
LogStreamService.attach_root_logger()
logger = get_feature_logger("api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start Daily 2 AM Cron Scheduler & in-memory log attach
    SchedulerService.start()
    logger.info("Daily 2 AM Scheduler initialized on FastAPI startup.")

    # Clean up any dangling running runs from prior killed/restarted processes
    try:
        from services.pipeline_orchestrator import PipelineOrchestrator

        await PipelineOrchestrator.cleanup_orphaned_runs()
    except Exception as e:
        logger.warning("Failed to clean up orphaned scraper runs on startup: %s", e)

    yield
    # Shutdown
    SchedulerService.stop()
    logger.info("Scheduler stopped on FastAPI shutdown.")


# Create FastAPI instance with lifespan
app = FastAPI(
    title="OpportuneAI API",
    description="Backend API for OpportuneAI with Admin Control Plane",
    version="0.2.0",
    lifespan=lifespan,
)

# Add CORS middleware
allow_origin_regex = r"https?://(localhost|127\.0\.0\.1|opportuneai\.luckylinux\.dev|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(admin_router)
app.include_router(events_router)
app.include_router(feed_router)
app.include_router(notifications_router)
app.include_router(outreach_router)
app.include_router(applications_router)
logger.info("OpportuneAI API configured with Admin Control Plane")


# Health check endpoint
@app.get("/")
def read_root():
    return {"message": "OpportuneAI API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        ssl_certfile="certs/cert.pem",
        ssl_keyfile="certs/key.pem",
    )
