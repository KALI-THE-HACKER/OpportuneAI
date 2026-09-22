from langchain_core.prompts import ChatPromptTemplate

JOB_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are an expert job posting parser. "
                "Extract structured information explicitly present in the provided job posting text (including headers and description). "
                "Do not hallucinate or invent missing values. "
                "Normalize obvious formatting issues (trim whitespace, normalize skill capitalization), but do not fabricate information.\n\n"
                "Extraction Guidelines:\n"
                "- `job_title`: Extract the position title from the 'Job Title' header or description.\n"
                "- `company`: Extract the employer / company name from the 'Company Name' header or description.\n"
                "- `location`: Extract the job location or 'Remote'.\n"
                "- `skills`: Extract technical skills, technologies, frameworks, and programming languages mentioned.\n"
                "- `salary`: Extract salary/compensation range if explicitly mentioned, otherwise null.\n"
                "- `experience_years`: Extract numeric minimum years of experience if mentioned (integer), otherwise null.\n"
                "- `employment_type`: E.g. 'Full-time', 'Internship', 'Contract', 'Part-time', or null.\n"
                "- `last_date_to_apply`: If an application deadline is explicitly mentioned, extract it as ISO date (YYYY-MM-DD), otherwise null.\n"
                "- `apply_url`: If a direct application link (Greenhouse, Lever, Ashby, careers page, form) is mentioned in the text, extract it, otherwise null.\n"
                "- `job_description`: Provide a clean, comprehensive summary or full text of the job responsibilities and requirements.\n\n"
                "CRITICAL SUFFICIENCY CHECK:\n"
                "- Set `data_sufficient` to true if the input provides at least a discernable job title and company name.\n"
                "- Only set `data_sufficient` to false if the input is completely empty, corrupted, or missing BOTH job title and company name. If false, populate `failure_reason` with a brief explanation."
            ),
        ),
        (
            "human",
            "Extract structured information from the following job posting.\n\nJob Posting Data:\n{job_description}",
        ),
    ]
)
