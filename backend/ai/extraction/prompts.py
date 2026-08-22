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
