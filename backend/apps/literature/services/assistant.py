import re

from django.conf import settings


DEFAULT_SUGGESTIONS = [
    "Give me a short summary of what this document is all about",
    "What are the main key findings and conclusions of this document?",
    "What is the background problem or main objective being addressed?",
    "What are the most important key takeaways from this paper?",
    "Explain the main results in simple, easy-to-understand terms",
    "Which methods and experimental techniques were used?",
]


class ExternalAIUnavailable(RuntimeError):
    pass


def external_ai_status(api_key=None):
    key = api_key or getattr(settings, "GEMINI_API_KEY", "")
    configured = bool(key)
    return {
        "available": configured,
        "provider": "Gemini",
        "model": settings.GEMINI_MODELS[0] if getattr(settings, "GEMINI_MODELS", None) else "gemini-2.0-flash",
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


def gemini_answer(context, question, api_key=None):
    active_key = api_key or getattr(settings, "GEMINI_API_KEY", "")
    if not active_key:
        raise ExternalAIUnavailable(
            "External AI is disabled or no Gemini API key was provided."
        )

    import time
    from google import genai
    from google.genai import types

    prompt = (
        "Answer only from the supplied research-paper context. Cite every material "
        "claim using the existing [filename | PAGE N] labels. If the evidence is "
        "insufficient, say so. Do not invent values, methods, or conclusions.\n\n"
        f"DOCUMENT CONTEXT:\n{context}\n\nUSER QUESTION:\n{question}"
    )
    errors = []
    configured_models = getattr(
        settings,
        "GEMINI_MODELS",
        ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
    )
    # Exclude deprecated / unavailable model identifiers
    models = [m for m in configured_models if "flash-lite" not in m]
    if not models:
        models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]

    client = genai.Client(api_key=active_key)
    for model in models:
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
            err_str = str(exc)
            errors.append(f"{model}: {err_str[:200]}")
            if "503" in err_str or "429" in err_str or "UNAVAILABLE" in err_str:
                time.sleep(0.8)

    raise ExternalAIUnavailable(
        "Gemini could not complete the review. " + " | ".join(errors)
    )
