from pydantic import BaseModel
from typing import Any


class RawJobData(BaseModel):
    source: str
    external_id: str | None = None
    title: str
    company: str
    date_posted: str | None = None
    location: str | None = None
    link: str
    content_hash: str
    raw_payload: Any
