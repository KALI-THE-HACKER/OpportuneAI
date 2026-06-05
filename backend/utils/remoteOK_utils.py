def extract_remoteok_job_id(item: dict) -> str:
    if item.get("id"):
        return str(item["id"])
    return str(item.get("url") or "")
