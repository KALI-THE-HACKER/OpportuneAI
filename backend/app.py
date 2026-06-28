from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.auth import router as auth_router

# Create FastAPI instance
app = FastAPI(
    title="OpportuneAI API", description="Backend API for OpportuneAI", version="0.1.0"
)

# Add CORS middleware
# Since allow_credentials=True is set, allow_origins=["*"] is rejected by browsers.
# We use a regex to securely allow localhost, local private IPs, and the production domain.
allow_origin_regex = r"https?://(localhost|127\.0\.0\.1|opportuneai\.luckylinux\.dev|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


# Health check endpoint
@app.get("/")
def read_root():
    return {"message": "OpportuneAI API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Example endpoint
@app.get("/api/items")
def get_items():
    return {"items": []}


@app.post("/api/items")
def create_item(item: dict):
    return {"created": item}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
