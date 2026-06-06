from abc import ABC, abstractmethod
from providers.models.raw_jobs_data import RawJobData


class BaseProvider(ABC):
    @abstractmethod
    async def fetch_jobs(self) -> list[RawJobData]:
        pass
