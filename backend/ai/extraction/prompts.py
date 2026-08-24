from langchain_core.prompts import ChatPromptTemplate

JOB_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are an expert job posting parser. "
                "Extract only information explicitly present in the job posting. "
                "Do not hallucinate or infer missing values. "
                "Normalize obvious formatting issues (trim whitespace, normalize skill capitalization), but do not invent information.\n\n"
                "If the job posting explicitly mentions an application deadline or last date to apply, extract it as `last_date_to_apply` (preferred ISO format YYYY-MM-DD or standard date format). "
                "If no explicit deadline or expiry date is mentioned, `last_date_to_apply` MUST be null.\n\n"
                "If the posting explicitly contains a direct application URL (e.g. a Greenhouse, Lever, Ashby, Workday, company careers page, or Google Form link), extract it as `apply_url`. "
                "If no explicit application link is present, `apply_url` MUST be null.\n\n"
                "CRITICAL: If the input does not contain enough information to determine at least a job title, "
                "company name, AND a meaningful job description, you MUST set `data_sufficient` to false "
                "and populate `failure_reason` with a short explanation of what is missing. "
                "In that case, leave all other fields as empty defaults. "
                "Do NOT attempt to fabricate or guess missing critical fields."
            ),
        ),
        (
            "human",
            "Extract structured information from the following job posting.\n\nJob Posting Data:\n{job_description}",
        ),
    ]
)
