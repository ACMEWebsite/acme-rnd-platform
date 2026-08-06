import hashlib
import os
import re
import shutil
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageOps


MAX_DOCUMENTS = 10
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 100 * 1024 * 1024
MAX_TOTAL_PAGES = 300
MAX_CONTEXT_CHARACTERS = 300_000
MIN_NATIVE_TEXT_CHARACTERS = 40


def _ocr_dpi():
    try:
        configured = int(os.getenv("LITERATURE_OCR_DPI", "200"))
    except ValueError:
        configured = 200
    return max(100, min(configured, 300))


OCR_DPI = _ocr_dpi()
OCR_LANGUAGES = os.getenv("LITERATURE_OCR_LANGUAGES", "eng").strip() or "eng"


def _configure_tesseract():
    """Locate Tesseract consistently in Docker and local Windows installs."""
    configured = os.getenv("TESSERACT_CMD", "").strip()
    candidates = [
        configured,
        shutil.which("tesseract"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    executable = next(
        (candidate for candidate in candidates if candidate and Path(candidate).is_file()),
        None,
    )
    if executable:
        pytesseract.pytesseract.tesseract_cmd = str(executable)


_configure_tesseract()


class DocumentValidationError(ValueError):
    pass


def _safe_name(upload):
    name = Path(getattr(upload, "name", "document.pdf")).name
    return name[:240] or "document.pdf"


def _useful_character_count(text):
    """Count content characters while ignoring PDF/OCR layout whitespace."""
    return len(re.sub(r"[^\w]", "", text or "", flags=re.UNICODE))


def _ocr_page(page):
    """Render and OCR one page without retaining either the image or source PDF."""
    scale = OCR_DPI / 72
    pixmap = page.get_pixmap(
        matrix=fitz.Matrix(scale, scale),
        colorspace=fitz.csGRAY,
        alpha=False,
    )
    image = Image.frombytes("L", (pixmap.width, pixmap.height), pixmap.samples)
    image = ImageOps.autocontrast(image)
    return pytesseract.image_to_string(
        image,
        lang=OCR_LANGUAGES,
        config="--oem 3 --psm 3",
    ).strip()


def _extract_page_text(page):
    native_text = page.get_text("text").strip()
    if _useful_character_count(native_text) >= MIN_NATIVE_TEXT_CHARACTERS:
        return native_text, "native", None

    try:
        ocr_text = _ocr_page(page)
    except pytesseract.TesseractNotFoundError:
        return native_text, "native", "OCR engine is not installed or available."
    except pytesseract.TesseractError as exc:
        return native_text, "native", f"OCR could not process this page: {exc}"
    except Exception as exc:
        return native_text, "native", f"OCR could not process this page: {exc}"

    # Some scanned pages contain a selectable header/footer but an image body.
    # Retain whichever extraction produced the richer result.
    if _useful_character_count(ocr_text) > _useful_character_count(native_text):
        return ocr_text, "ocr", None
    return native_text, "native", None


def extract_pdf_collection(uploads):
    uploads = list(uploads)
    if not uploads:
        raise DocumentValidationError("Select at least one PDF document.")
    if len(uploads) > MAX_DOCUMENTS:
        raise DocumentValidationError(
            f"A workspace can contain at most {MAX_DOCUMENTS} documents."
        )

    total_bytes = sum(getattr(upload, "size", 0) for upload in uploads)
    if total_bytes > MAX_TOTAL_BYTES:
        raise DocumentValidationError("The combined upload exceeds 100 MB.")

    context_parts = []
    documents = []
    warnings = []
    total_pages = 0
    total_characters = 0

    for upload in uploads:
        name = _safe_name(upload)
        size = getattr(upload, "size", 0)
        if size > MAX_FILE_BYTES:
            raise DocumentValidationError(f"{name} exceeds the 25 MB file limit.")

        data = upload.read()
        if not data.startswith(b"%PDF-"):
            raise DocumentValidationError(f"{name} is not a valid PDF document.")

        try:
            document = fitz.open(stream=data, filetype="pdf")
        except Exception as exc:
            raise DocumentValidationError(f"{name} could not be opened as a PDF.") from exc

        try:
            if document.needs_pass:
                raise DocumentValidationError(
                    f"{name} is password protected and cannot be processed."
                )
            if total_pages + document.page_count > MAX_TOTAL_PAGES:
                raise DocumentValidationError(
                    f"The workspace exceeds the {MAX_TOTAL_PAGES}-page limit."
                )

            page_metadata = []
            document_characters = 0
            document_ocr_pages = 0
            ocr_warning_pages = {}
            context_parts.append(
                "\n"
                + "=" * 66
                + f"\nSTART OF DOCUMENT: {name}\n"
                + "=" * 66
            )
            for page_index, page in enumerate(document, start=1):
                page_text, extraction_method, ocr_warning = _extract_page_text(page)
                marker = f"--- [{name} | PAGE {page_index}] ---"
                context_parts.append(f"{marker}\n{page_text}")
                char_count = len(page_text)
                page_metadata.append(
                    {
                        "page_number": page_index,
                        "characters": char_count,
                        "extraction_method": extraction_method,
                    }
                )
                if extraction_method == "ocr":
                    document_ocr_pages += 1
                if ocr_warning:
                    ocr_warning_pages.setdefault(ocr_warning, []).append(page_index)
                document_characters += char_count
                total_characters += char_count
                if total_characters > MAX_CONTEXT_CHARACTERS:
                    raise DocumentValidationError(
                        "Extracted text exceeds the 300,000-character workspace limit."
                    )

            for warning, page_numbers in ocr_warning_pages.items():
                shown_pages = ", ".join(str(number) for number in page_numbers[:10])
                if len(page_numbers) > 10:
                    shown_pages += f", and {len(page_numbers) - 10} more"
                warnings.append(f"{name}, pages {shown_pages}: {warning}")

            if document_characters == 0:
                warnings.append(
                    f"{name} contained no readable text after native extraction and OCR."
                )
            documents.append(
                {
                    "name": name,
                    "size_bytes": len(data),
                    "page_count": document.page_count,
                    "characters": document_characters,
                    "ocr_pages": document_ocr_pages,
                    "pages": page_metadata,
                }
            )
            total_pages += document.page_count
        finally:
            document.close()

    if total_characters == 0:
        raise DocumentValidationError(
            "No readable text was found. OCR was attempted, but the document may "
            "be blank, damaged, or use an unavailable language."
        )

    context = "\n\n".join(context_parts).strip()
    return {
        "documents": documents,
        "context": context,
        "context_sha256": hashlib.sha256(context.encode("utf-8")).hexdigest(),
        "total_pages": total_pages,
        "total_characters": total_characters,
        "warnings": warnings,
    }
