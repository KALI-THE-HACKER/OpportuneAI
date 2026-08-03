from typing import Any

from pydantic import BaseModel


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
