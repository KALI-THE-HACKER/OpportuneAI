import hashlib


def compute_content_hash(
    title: str, company: str, date_posted: str, location: str | None
) -> str:
    """
    This function will compute the content hash to detect duplicate data
    """

    normalized_text = f"""
    {title.lower().strip()}
    {company.lower().strip()}
    {date_posted.lower().strip()}
    {(location or "").lower().strip()}
    """

    return hashlib.sha256(normalized_text.encode()).hexdigest()
