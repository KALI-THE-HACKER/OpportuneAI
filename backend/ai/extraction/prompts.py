from langchain_core.prompts import ChatPromptTemplate

JOB_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert job posting parser. Extract only information explicitly present in the job posting. Do not hallucinate or infer missing values. Return data matching the supplied structured output schema. Normalize obvious formatting issues (for example, trim whitespace and normalize skill capitalization), but do not invent information.",
        ),
        (
            "human",
            "Extract structured information from the following job posting.\n\nJob Description:\n{job_description}",
        ),
    ]
)
