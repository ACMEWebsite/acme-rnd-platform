"""Live Product-Specific Guidance lookup using FDA's official search table."""

import re
from html.parser import HTMLParser
from urllib.parse import urljoin

import requests


SEARCH_URL = (
    "https://www.accessdata.fda.gov/scripts/cder/psg/"
    "index.cfm?event=Home.Search"
)
HOME_URL = "https://www.accessdata.fda.gov/scripts/cder/psg/index.cfm"
REQUEST_TIMEOUT = 30


def _clean(value):
    return " ".join((value or "").split())


def _psg_number(pdf_url, rld_or_rs):
    match = re.search(r"/PSG_(\d+)\.pdf", pdf_url, re.IGNORECASE)
    if match:
        return match.group(1)
    match = re.search(r"(?:_|\b)(\d{5,6})(?:_|\b)", pdf_url)
    if match:
        return match.group(1)
    match = re.search(r"\b(\d{5,6})\b", rld_or_rs or "")
    return match.group(1) if match else ""


class _GuidanceTableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_results_table = False
        self.in_row = False
        self.in_cell = False
        self.cell_parts = []
        self.cells = []
        self.pdf_url = ""
        self.results = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "table" and attributes.get("id") == "drugTable":
            self.in_results_table = True
        elif self.in_results_table and tag == "tr":
            self.in_row = "drugData" in attributes.get("class", "").split()
            if self.in_row:
                self.cells = []
                self.pdf_url = ""
        elif self.in_row and tag == "td":
            self.in_cell = True
            self.cell_parts = []
        elif self.in_row and tag == "a":
            href = attributes.get("href", "")
            if "/drugsatfda_docs/psg/" in href.lower() and href.lower().endswith(".pdf"):
                self.pdf_url = urljoin(HOME_URL, href)

    def handle_data(self, data):
        if self.in_cell:
            self.cell_parts.append(data)

    def handle_endtag(self, tag):
        if self.in_results_table and self.in_cell and tag == "td":
            self.cells.append(_clean(" ".join(self.cell_parts)))
            self.in_cell = False
        elif self.in_results_table and self.in_row and tag == "tr":
            if self.cells and self.pdf_url:
                rld_or_rs = self.cells[5] if len(self.cells) > 5 else ""
                self.results.append(
                    {
                        "id": None,
                        "active_ingredient": self.cells[0],
                        "guidance_type": self.cells[2] if len(self.cells) > 2 else "",
                        "route": self.cells[3] if len(self.cells) > 3 else "",
                        "dosage_form": self.cells[4] if len(self.cells) > 4 else "",
                        "rld_or_rs_number": rld_or_rs,
                        "psg_number": _psg_number(self.pdf_url, rld_or_rs),
                        "posted_date": self.cells[6] if len(self.cells) > 6 else None,
                        "pdf_url": self.pdf_url,
                    }
                )
            self.in_row = False
        elif self.in_results_table and tag == "table":
            self.in_results_table = False


def live_search(query):
    """Return the FDA table results, or ``None`` when FDA is unavailable."""
    try:
        response = requests.post(
            SEARCH_URL,
            data={"searchField": query, "submit": "Search"},
            headers={
                "User-Agent": "ACME-RnD-Platform/1.0",
                "Referer": HOME_URL,
            },
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
    except requests.RequestException:
        return None

    parser = _GuidanceTableParser()
    parser.feed(response.text)
    return list({item["pdf_url"]: item for item in parser.results}.values())
