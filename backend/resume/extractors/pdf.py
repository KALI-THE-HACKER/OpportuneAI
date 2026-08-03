"""PDF text extraction using PyMuPDF (pymupdf).

Extracts raw page text plus hyperlink anchor text and URLs so the LLM
has access to portfolio, GitHub, and LinkedIn links embedded in the PDF.
"""

import pymupdf


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract plain text and hyperlinks from a PDF supplied as raw bytes.

    Args:
        file_bytes: Raw bytes of the PDF file (e.g. from an uploaded UploadFile).

    Returns:
        A single string containing all page text followed by a links section.
    """
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    output_parts: list[str] = []
    all_links: list[dict] = []

    for page in doc:
        output_parts.append(page.get_text())

        word_list = page.get_text("words")
        for link in page.get_links():
            if "uri" not in link:
                continue
            url = link["uri"]
            link_rect = pymupdf.Rect(link["from"])
            matched_words = [
                w[4] for w in word_list if link_rect.intersects(pymupdf.Rect(w[:4]))
            ]
            all_links.append({"words": matched_words, "url": url})

    doc.close()

    text = "\n".join(output_parts)
    if all_links:
        text += f"\n\nLinks:\n{all_links}"
    return text
