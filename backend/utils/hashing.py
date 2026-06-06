import hashlib


def compute_content_hash(
    title: str | None,
    company: str | None,
    date_posted: str | None,
    location: str | None,
) -> str:
    """
    This function will compute the content hash to detect duplicate data
    """

    normalized_text = f"""
    {str(title or "").lower().strip()}
    {str(company or "").lower().strip()}
    {str(date_posted or "").lower().strip()}
    {str(location or "").lower().strip()}
    """

    return hashlib.sha256(normalized_text.encode()).hexdigest()
