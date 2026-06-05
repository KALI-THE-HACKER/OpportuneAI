from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create FastAPI instance
app = FastAPI(
    title="OpportuneAI API", description="Backend API for OpportuneAI", version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

    uvicorn.run(app, host="0.0.0.0", port=8000)
