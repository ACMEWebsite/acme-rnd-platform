import os
import re
import time
from datetime import date
from urllib.parse import urlencode

import requests
from django.db import transaction
from django.utils import timezone

from ..models import PsgGuidance, PsgSyncEvent


REGULATIONS_BASE = "https://api.regulations.gov/v4"
PSG_DOCKET_ID = "FDA-2007-D-0369"
PAGE_SIZE = 250
REQUEST_TIMEOUT = 30
TITLE_PATTERN = re.compile(
    r"^PSG_(\S+?)\s*-\s*(?:(Draft|Revised Draft|Final)\s+)?"
    r"Guidance on\s+(.+?)(?:\s+re\s+Product-Specific.*)?$",
    re.IGNORECASE,
)


class PsgSyncError(RuntimeError):
    pass


def parse_document_title(title):
    match = TITLE_PATTERN.match(title or "")
    if not match:
        return None
    return {
        "psg_number": match.group(1).strip(),
        "guidance_type": (match.group(2) or "Unknown").strip(),
        "active_ingredient": re.sub(r";\s*", "; ", match.group(3).strip()),
    }


def construct_pdf_url(psg_number):
    return (
        "https://www.accessdata.fda.gov/drugsatfda_docs/psg/"
        f"PSG_{psg_number}.pdf"
    )


def _fetch_json(url, max_retries=4):
    delay = 2
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as exc:
            raise PsgSyncError(f"Regulations.gov network error: {exc}") from exc
        if response.status_code == 429 and attempt < max_retries - 1:
            time.sleep(delay)
            delay *= 2
            continue
        if not response.ok:
            raise PsgSyncError(
                f"Regulations.gov returned HTTP {response.status_code}."
            )
        return response.json()
    raise PsgSyncError("Regulations.gov retry limit exceeded.")


def _parse_date(raw_value):
    if not raw_value:
        return None
    try:
        return date.fromisoformat(raw_value[:10])
    except ValueError:
        return None


def fetch_psg_records():
    api_key = os.getenv("REGULATIONS_GOV_API_KEY", "DEMO_KEY")
    records = []
    page = 1
    total_pages = 1
    while page <= total_pages:
        query = urlencode(
            {
                "filter[docketId]": PSG_DOCKET_ID,
                "page[size]": PAGE_SIZE,
                "page[number]": page,
                "sort": "-postedDate",
                "api_key": api_key,
            }
        )
        payload = _fetch_json(f"{REGULATIONS_BASE}/documents?{query}")
        total_pages = payload.get("meta", {}).get("totalPages", 1)
        for item in payload.get("data", []):
            attributes = item.get("attributes", {})
            parsed = parse_document_title(attributes.get("title", ""))
            document_id = item.get("id") or attributes.get("documentId")
            if not parsed or not document_id:
                continue
            records.append(
                {
                    **parsed,
                    "posted_date": _parse_date(attributes.get("postedDate")),
                    "regulations_document_id": document_id,
                    "pdf_url": construct_pdf_url(parsed["psg_number"]),
                }
            )
        page += 1
        if page <= total_pages:
            time.sleep(0.5)
    return records


def sync_psg_dataset():
    event = PsgSyncEvent.objects.create(status="running")
    try:
        records = fetch_psg_records()
        with transaction.atomic():
            for record in records:
                PsgGuidance.objects.update_or_create(
                    regulations_document_id=record["regulations_document_id"],
                    defaults=record,
                )
        event.status = "success"
        event.records_received = len(records)
        event.message = f"Synchronized {len(records)} Product-Specific Guidances."
        return event
    except Exception as exc:
        event.status = "failed"
        event.message = str(exc)
        raise
    finally:
        event.completed_at = timezone.now()
        event.save()


def last_sync_event():
    return PsgSyncEvent.objects.filter(status="success").first()


def search_local(query):
    return PsgGuidance.objects.filter(active_ingredient__icontains=query)[:100]


def serialize_guidance(guidance):
    return {
        "id": guidance.pk,
        "active_ingredient": guidance.active_ingredient,
        "psg_number": guidance.psg_number,
        "guidance_type": guidance.guidance_type,
        "posted_date": guidance.posted_date,
        "pdf_url": guidance.pdf_url,
    }

