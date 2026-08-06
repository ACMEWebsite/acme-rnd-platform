import re

from django.conf import settings


DEFAULT_SUGGESTIONS = [
    "What are the principal findings?",
    "Which methods were used?",
    "What limitations are reported?",
]


class ExternalAIUnavailable(RuntimeError):
    pass


def external_ai_status():
    configured = bool(
        settings.LITERATURE_EXTERNAL_AI_ENABLED and settings.GEMINI_API_KEY
    )
    return {
        "available": configured,
        "provider": "Gemini",
        "model": settings.GEMINI_MODELS[0] if settings.GEMINI_MODELS else "",
        "privacy_notice": (
            "Gemini mode sends extracted document text and the question outside "
            "the office network. Local evidence mode never does."
        ),
    }


def _query_terms(question):
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9][a-zA-Z0-9-]{2,}", question.lower())
        if token
        not in {
            "the",
            "and",
            "are",
            "for",
            "from",
            "that",
            "this",
            "what",
            "which",
            "with",
            "were",
            "was",
            "have",
            "has",
            "about",
            "into",
        }
    }


def local_evidence_answer(context, question):
    terms = _query_terms(question)
    sections = re.split(r"(?=--- \[.+? \| PAGE \d+\] ---)", context)
    candidates = []
    for section in sections:
        marker_match = re.match(r"(--- \[.+? \| PAGE \d+\] ---)", section)
        if not marker_match:
            continue
        citation = marker_match.group(1).strip("- ")
        body = section[marker_match.end() :].strip()
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", body):
            clean = " ".join(sentence.split())
            if len(clean) < 35:
                continue
            lowered = clean.lower()
            score = sum(2 if term in lowered else 0 for term in terms)
            score += min(len(set(re.findall(r"\w+", lowered)) & terms), 4)
            candidates.append((score, citation, clean[:500]))

    candidates.sort(key=lambda item: (item[0], len(item[2])), reverse=True)
    selected = []
    seen = set()
    for score, citation, excerpt in candidates:
        key = excerpt[:120].lower()
        if key in seen:
            continue
        if terms and score == 0:
            continue
        seen.add(key)
        selected.append((citation, excerpt))
        if len(selected) == 5:
            break

    if not selected:
        return (
            "I could not find a strong text match in the extracted pages. "
            "Try using a compound name, method, endpoint, or exact technical term."
        )

    evidence = "\n\n".join(
        f"- **[{citation}]** {excerpt}" for citation, excerpt in selected
    )
    return (
        "The closest locally extracted evidence is:\n\n"
        f"{evidence}\n\n"
        "_This is evidence retrieval, not a generated scientific conclusion._"
    )


def gemini_answer(context, question):
    status = external_ai_status()
    if not status["available"]:
        raise ExternalAIUnavailable(
            "External AI is disabled or no server-side Gemini key is configured."
        )

    from google import genai
    from google.genai import types

    prompt = (
        "Answer only from the supplied research-paper context. Cite every material "
        "claim using the existing [filename | PAGE N] labels. If the evidence is "
        "insufficient, say so. Do not invent values, methods, or conclusions.\n\n"
        f"DOCUMENT CONTEXT:\n{context}\n\nUSER QUESTION:\n{question}"
    )
    errors = []
    with genai.Client(api_key=settings.GEMINI_API_KEY) as client:
        for model in settings.GEMINI_MODELS:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.15,
                        system_instruction=(
                            "You are a precise pharmaceutical literature reviewer. "
                            "Preserve uncertainty and provide page-level evidence."
                        ),
                    ),
                )
                if response.text:
                    return response.text, model
            except Exception as exc:
                errors.append(f"{model}: {exc}")
    raise ExternalAIUnavailable(
        "Gemini could not complete the review. " + " | ".join(errors)
    )
