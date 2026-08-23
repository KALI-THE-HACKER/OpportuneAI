import asyncio
import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from database.models.processed_job import ProcessedJob
from database.models.raw_job import ProcessingStatus, RawJob
from database.session import AsyncSessionLocal

SAMPLE_JOBS = [
    {
        "source": "wellfound",
        "external_id": "seed-job-001",
        "title": "Senior Backend Engineer",
        "company": "Linear Operations",
        "date_posted": "2026-08-20T10:00:00Z",
        "location": "Remote",
        "link": "https://linear.app/careers/senior-backend-engineer",
        "skills": [
            "Python",
            "FastAPI",
            "PostgreSQL",
            "Redis",
            "Docker",
            "System Design",
        ],
        "salary": "$140,000 - $185,000",
        "experience_years": 5,
        "employment_type": "full-time",
        "days_until_expiry": 45,
        "description": "Architect and scale core microservices, background task pipelines, and distributed APIs for mission-critical developer tooling.",
    },
    {
        "source": "linkedin",
        "external_id": "seed-job-002",
        "title": "Staff Software Engineer - Distributed Systems",
        "company": "Orbit Logic",
        "date_posted": "2026-08-21T12:00:00Z",
        "location": "San Francisco, CA",
        "link": "https://orbitlogic.io/jobs/staff-engineer",
        "skills": [
            "Python",
            "Go",
            "Distributed Systems",
            "Kubernetes",
            "Kafka",
            "PostgreSQL",
        ],
        "salary": "$190,000 - $240,000",
        "experience_years": 8,
        "employment_type": "full-time",
        "days_until_expiry": 60,
        "description": "Lead design and reliability engineering for high-throughput cloud streaming engines processing billions of daily events.",
    },
    {
        "source": "remoteok",
        "external_id": "seed-job-003",
        "title": "Senior Frontend Engineer",
        "company": "Vercel Systems",
        "date_posted": "2026-08-22T08:30:00Z",
        "location": "Remote",
        "link": "https://vercel.com/careers/senior-frontend",
        "skills": [
            "React",
            "TypeScript",
            "Next.js",
            "Tailwind CSS",
            "Design Systems",
            "GraphQL",
        ],
        "salary": "$130,000 - $170,000",
        "experience_years": 4,
        "employment_type": "full-time",
        "days_until_expiry": 30,
        "description": "Build high-performance web interfaces, complex design systems, and rich interactive developer consoles with pixel-perfect attention to detail.",
    },
    {
        "source": "naukri",
        "external_id": "seed-job-004",
        "title": "AI / ML Research Engineer",
        "company": "Neural Dynamics",
        "date_posted": "2026-08-19T14:15:00Z",
        "location": "New York, NY",
        "link": "https://neuraldynamics.ai/jobs/ml-research-engineer",
        "skills": [
            "Python",
            "PyTorch",
            "LLMs",
            "Machine Learning",
            "Transformers",
            "LangChain",
        ],
        "salary": "$160,000 - $210,000",
        "experience_years": 4,
        "employment_type": "full-time",
        "days_until_expiry": 40,
        "description": "Fine-tune foundation models, optimize inference pipelines, and implement agentic workflows for generative AI copilots.",
    },
    {
        "source": "wellfound",
        "external_id": "seed-job-005",
        "title": "Full Stack Developer",
        "company": "Framework Labs",
        "date_posted": "2026-08-20T16:00:00Z",
        "location": "Austin, TX",
        "link": "https://frameworklabs.io/careers/fullstack-developer",
        "skills": ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "REST APIs"],
        "salary": "$115,000 - $150,000",
        "experience_years": 3,
        "employment_type": "full-time",
        "days_until_expiry": 35,
        "description": "Ship full-stack feature sets across responsive React frontends and robust Node/Postgres backend services.",
    },
    {
        "source": "remoteok",
        "external_id": "seed-job-006",
        "title": "Lead Cloud & DevOps Engineer",
        "company": "Quantum Infrastructure",
        "date_posted": "2026-08-18T09:00:00Z",
        "location": "Remote",
        "link": "https://quantuminfra.com/jobs/lead-devops",
        "skills": ["Kubernetes", "Terraform", "AWS", "CI/CD", "Docker", "Linux", "Go"],
        "salary": "$150,000 - $195,000",
        "experience_years": 7,
        "employment_type": "full-time",
        "days_until_expiry": 50,
        "description": "Scale zero-trust multi-region cloud infrastructure, automate deployment pipelines, and maintain 99.99% uptime across Kubernetes clusters.",
    },
    {
        "source": "linkedin",
        "external_id": "seed-job-007",
        "title": "Junior Python Developer",
        "company": "Argon Labs",
        "date_posted": "2026-08-22T11:00:00Z",
        "location": "Remote",
        "link": "https://argonlabs.dev/careers/junior-python",
        "skills": ["Python", "FastAPI", "SQL", "Git", "REST APIs"],
        "salary": "$80,000 - $105,000",
        "experience_years": 1,
        "employment_type": "full-time",
        "days_until_expiry": 30,
        "description": "Join our fast-growing engineering team building data processing pipelines and API integrations using modern Python and FastAPI.",
    },
    {
        "source": "wellfound",
        "external_id": "seed-job-008",
        "title": "Principal Platform Architect",
        "company": "Helix AI",
        "date_posted": "2026-08-17T15:30:00Z",
        "location": "San Francisco, CA",
        "link": "https://helixai.io/jobs/principal-platform-architect",
        "skills": [
            "Python",
            "Go",
            "System Design",
            "Distributed Systems",
            "PostgreSQL",
            "Redis",
            "GCP",
        ],
        "salary": "$210,000 - $275,000",
        "experience_years": 10,
        "employment_type": "full-time",
        "days_until_expiry": 90,
        "description": "Set technical vision and architectural standards for next-generation enterprise AI orchestration platforms.",
    },
    {
        "source": "naukri",
        "external_id": "seed-job-009",
        "title": "Senior Product Designer",
        "company": "Lumina Systems",
        "date_posted": "2026-08-21T13:45:00Z",
        "location": "Berlin, DE",
        "link": "https://luminasystems.de/jobs/product-designer",
        "skills": ["Figma", "Design Systems", "UI/UX", "User Research", "Prototyping"],
        "salary": "$95,000 - $130,000",
        "experience_years": 5,
        "employment_type": "full-time",
        "days_until_expiry": 45,
        "description": "Create intuitive, elegant user interfaces and design systems for complex enterprise workflows and developer platforms.",
    },
    {
        "source": "linkedin",
        "external_id": "seed-job-010",
        "title": "Lead Product Manager - Developer Platform",
        "company": "Vector Foundry",
        "date_posted": "2026-08-19T10:20:00Z",
        "location": "New York, NY",
        "link": "https://vectorfoundry.com/jobs/lead-pm",
        "skills": [
            "Product Strategy",
            "Stakeholder Management",
            "Agile",
            "SQL",
            "Technical Roadmaps",
        ],
        "salary": "$165,000 - $210,000",
        "experience_years": 6,
        "employment_type": "full-time",
        "days_until_expiry": 40,
        "description": "Drive product strategy and execution for developer API products, partnering closely with engineering and growth teams.",
    },
    {
        "source": "remoteok",
        "external_id": "seed-job-011",
        "title": "Backend Python / Django Specialist",
        "company": "Synthetix Cloud",
        "date_posted": "2026-08-20T17:10:00Z",
        "location": "Remote",
        "link": "https://synthetixcloud.com/jobs/backend-django",
        "skills": ["Python", "Django", "PostgreSQL", "Celery", "Redis", "Docker"],
        "salary": "$125,000 - $160,000",
        "experience_years": 4,
        "employment_type": "full-time",
        "days_until_expiry": 30,
        "description": "Develop scalable SaaS backends, asynchronous worker tasks, and payment integration microservices.",
    },
    {
        "source": "wellfound",
        "external_id": "seed-job-012",
        "title": "Frontend React / Next.js Engineer",
        "company": "Northwind Cloud",
        "date_posted": "2026-08-22T09:15:00Z",
        "location": "London, UK",
        "link": "https://northwindcloud.co.uk/careers/frontend",
        "skills": [
            "React",
            "TypeScript",
            "Next.js",
            "Tailwind CSS",
            "Redux",
            "REST APIs",
        ],
        "salary": "$110,000 - $145,000",
        "experience_years": 3,
        "employment_type": "full-time",
        "days_until_expiry": 50,
        "description": "Build responsive client-side dashboards, data visualizers, and interactive onboarding flows using modern React.",
    },
]


def generate_content_hash(
    title: str, company: str, date_posted: str | None, location: str | None
) -> str:
    sig = f"{title}|{company}|{date_posted or ''}|{location or ''}"
    return hashlib.sha256(sig.encode("utf-8")).hexdigest()[:16]


async def seed_jobs() -> int:
    """Idempotently seed development jobs into raw_jobs and processed_jobs."""
    now = datetime.now(timezone.utc)
    inserted_count = 0

    async with AsyncSessionLocal() as db:
        for item in SAMPLE_JOBS:
            content_hash = generate_content_hash(
                title=item["title"],
                company=item["company"],
                date_posted=item["date_posted"],
                location=item["location"],
            )

            # Check if already exists by content_hash
            existing = await db.execute(
                select(RawJob).where(RawJob.content_hash == content_hash)
            )
            raw_job = existing.scalar_one_or_none()

            if not raw_job:
                raw_job = RawJob(
                    source=item["source"],
                    external_id=item["external_id"],
                    title=item["title"],
                    company=item["company"],
                    date_posted=item["date_posted"],
                    location=item["location"],
                    link=item["link"],
                    content_hash=content_hash,
                    raw_payload={"description": item["description"], "seed": True},
                    scraped_at=now.replace(tzinfo=None),
                    processing_status=ProcessingStatus.PROCESSED,
                )
                db.add(raw_job)
                await db.flush()

            # Check if processed job exists
            pj_existing = await db.execute(
                select(ProcessedJob).where(ProcessedJob.raw_job_id == raw_job.id)
            )
            processed_job = pj_existing.scalar_one_or_none()

            if not processed_job:
                expiry = now.replace(tzinfo=None) + timedelta(
                    days=item["days_until_expiry"]
                )
                processed_job = ProcessedJob(
                    raw_job_id=raw_job.id,
                    job_title=item["title"],
                    company=item["company"],
                    skills=item["skills"],
                    location=item["location"],
                    salary=item["salary"],
                    experience_years=item["experience_years"],
                    employment_type=item["employment_type"],
                    last_date_to_apply=expiry,
                    job_description=item["description"],
                    processed_at=now.replace(tzinfo=None),
                )
                db.add(processed_job)
                inserted_count += 1

        await db.commit()

    print(
        f"Seed completed: {inserted_count} new processed jobs inserted (total catalog: {len(SAMPLE_JOBS)})."
    )
    return inserted_count


if __name__ == "__main__":
    asyncio.run(seed_jobs())
