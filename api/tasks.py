"""Turns a pasted line or a cropped screenshot into draft "In arrivo" items.

`extract_items(payload)` is a pure function (no database access) so the same
code runs inside the web service (TASK_RUNNER=inline) and on Render Workflows
(TASK_RUNNER=render, see api/workflow.py). Drafts are never published
automatically: the scribe accepts or corrects each one.
"""

import json
import os
import re
from datetime import date, timedelta
from typing import Any, Optional

import httpx

TYPES = ("compito", "verifica", "evento", "lab")
SOURCES = ("detto in classe", "ClasseViva", "Classroom", "Campus", "altro")
FEATHERLESS_URL = "https://api.featherless.ai/v1/chat/completions"
MAX_DAYS_AHEAD = 90

SUBJECT_KEYWORDS = {
    "MAT": ["matematica", "mate", "mat", "math", "complementi"],
    "INI": ["informatica", "info", "ini", "inf"],
    "SRI": ["sistemi e reti", "sistemi", "reti", "sri", "sis"],
    "TPI": ["tpsit", "tpi"],
    "TCI": ["telecomunicazioni", "telecom", "tele", "tlc", "tci"],
    "LIT": ["italiano", "letteratura", "ita", "lit"],
    "STO": ["storia", "sto"],
    "ING": ["inglese", "english", "ing", "eng"],
    "SMS": ["scienze motorie", "motoria", "ginnastica", "sms"],
    "IRC": ["religione", "irc"],
}
TYPE_KEYWORDS = {
    "verifica": ["verifica", "verifiche", "test", "compito in classe", "interrogazione", "interrogazioni", "prova scritta", "prova"],
    "evento": ["assemblea", "uscita", "gita", "evento", "sciopero", "incontro", "conferenza", "colloqui", "open day", "orientamento"],
    "lab": ["laboratorio", "in lab"],
}
WEEKDAYS = {
    "lunedì": 0, "lunedi": 0, "lun": 0,
    "martedì": 1, "martedi": 1, "mar": 1,
    "mercoledì": 2, "mercoledi": 2, "mer": 2,
    "giovedì": 3, "giovedi": 3, "gio": 3,
    "venerdì": 4, "venerdi": 4, "ven": 4,
    "sabato": 5, "sab": 5,
}
MONTHS = {
    "gennaio": 1, "gen": 1, "febbraio": 2, "feb": 2, "marzo": 3, "aprile": 4, "apr": 4,
    "maggio": 5, "mag": 5, "giugno": 6, "giu": 6, "luglio": 7, "lug": 7, "settembre": 9,
    "set": 9, "ottobre": 10, "ott": 10, "novembre": 11, "nov": 11, "dicembre": 12, "dic": 12,
}


# ---- validation (shared by every provider) -------------------------------------
def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _subject_code(value: Any, ctx: dict) -> Optional[str]:
    if not value:
        return None
    v = str(value).strip().lower()
    for s in ctx.get("subjects", []):
        if v in (s["code"].lower(), s["name_it"].lower(), s["name_en"].lower()):
            return s["code"]
    for code, words in SUBJECT_KEYWORDS.items():
        if v in words or any(v.startswith(w) for w in words if len(w) > 3):
            if any(s["code"] == code for s in ctx.get("subjects", [])):
                return code
    return None


def validate_drafts(raw: Any, ctx: dict, default_source: str) -> list[dict]:
    if isinstance(raw, dict):
        raw = raw.get("items", raw.get("drafts", [raw]))
    if not isinstance(raw, list):
        return []
    today = date.fromisoformat(ctx["today"])
    school_days = set(ctx.get("school_days", []))
    last_known = max(school_days) if school_days else None
    out = []
    for r in raw[:10]:
        if not isinstance(r, dict):
            continue
        title = str(r.get("titolo") or r.get("title") or "").strip()[:200]
        if not title:
            continue
        tipo = str(r.get("tipo") or r.get("type") or "compito").strip().lower()
        if tipo not in TYPES:
            tipo = "compito"
        fonte = str(r.get("fonte") or r.get("source") or default_source).strip()
        fonte = next((s for s in SOURCES if s.lower() == fonte.lower()), default_source)
        due = _parse_date(r.get("quando") or r.get("due_date"))
        due_time = r.get("ora") or r.get("due_time")
        if due_time and not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", str(due_time)):
            due_time = None
        reasons = []
        if due is None:
            reasons.append("data mancante")
            due = today + timedelta(days=1)
        elif due < today or due > today + timedelta(days=MAX_DAYS_AHEAD):
            reasons.append("data fuori intervallo")
        elif last_known and due.isoformat() <= last_known and due.isoformat() not in school_days:
            reasons.append("non è un giorno di scuola")
        if r.get("_guessed_date"):
            reasons.append("data dedotta")
        subject = _subject_code(r.get("materia") or r.get("subject"), ctx)
        if title.lower() in (tipo, *TYPE_KEYWORDS.get(tipo, [])):
            name = next((s["name_it"] for s in ctx.get("subjects", []) if s["code"] == subject), "")
            title = f"{tipo} {name}".strip()
        title = title[0].upper() + title[1:]
        out.append(
            {
                "type": tipo,
                "subject_code": subject,
                "title": title,
                "due_date": due.isoformat(),
                "due_time": due_time,
                "source": fonte,
                "needs_check": bool(reasons),
                "check_reason": ", ".join(reasons),
            }
        )
    return out


# ---- rule-based parser (OCR_PROVIDER=mock and fallback) ------------------------
def _find_subject(text: str) -> Optional[str]:
    low = text.lower()
    best: Optional[tuple[int, str]] = None
    for code, words in SUBJECT_KEYWORDS.items():
        for w in words:
            m = re.search(rf"(?<![\w]){re.escape(w)}(?![\w])", low)
            if m and (best is None or m.start() < best[0]):
                best = (m.start(), code)
    return best[1] if best else None


def _find_type(text: str) -> Optional[str]:
    low = text.lower()
    for tipo, words in TYPE_KEYWORDS.items():
        for w in words:
            if re.search(rf"(?<![\w]){re.escape(w)}(?![\w])", low):
                return tipo
    return None


def _next_weekday(today: date, wd: int) -> date:
    delta = (wd - today.weekday()) % 7
    return today + timedelta(days=delta or 7)


# "3-7" or "12.15" are exercise ranges, not dates: without a year only "/" counts.
DATE_PATTERNS = [
    re.compile(r"(?<!\d)(\d{1,2})(?:/(\d{1,2})(?:/(\d{2,4}))?|[.\-](\d{1,2})[.\-](\d{4}))(?![\d\-])"),
    re.compile(r"(?<!\d)(\d{1,2})\s+(" + "|".join(sorted(MONTHS, key=len, reverse=True)) + r")\b", re.I),
]


def _find_date(text: str, today: date, subject: Optional[str], ctx: dict) -> tuple[Optional[date], str]:
    low = text.lower()
    m = DATE_PATTERNS[0].search(low)
    if m and (m.group(2) or m.group(4)):
        d = int(m.group(1))
        mo = int(m.group(2) or m.group(4))
        year_text = m.group(3) or m.group(5)
        y = int(year_text) if year_text else today.year
        if y < 100:
            y += 2000
        try:
            found = date(y, mo, d)
            if not year_text and found < today - timedelta(days=30):
                found = date(y + 1, mo, d)
            return found, m.group(0)
        except ValueError:
            pass
    m = DATE_PATTERNS[1].search(low)
    if m:
        d, mo = int(m.group(1)), MONTHS[m.group(2).lower()]
        y = today.year if mo >= today.month - 1 else today.year + 1
        try:
            return date(y, mo, d), m.group(0)
        except ValueError:
            pass
    if re.search(r"\bdopodomani\b", low):
        return today + timedelta(days=2), "dopodomani"
    if re.search(r"\bdomani\b", low):
        nd = [d for d in ctx.get("school_days", []) if d > today.isoformat()]
        return (date.fromisoformat(nd[0]) if nd else today + timedelta(days=1)), "domani"
    m = re.search(r"\btra\s+(una|1|due|2)\s+settiman[ae]\b", low)
    if m:
        weeks = 2 if m.group(1) in ("due", "2") else 1
        return today + timedelta(days=7 * weeks), m.group(0)
    for word in sorted(WEEKDAYS, key=len, reverse=True):
        m = re.search(rf"(?<![\w]){re.escape(word)}(?![\w])", low)
        if m:
            if word in ("mar",) and re.search(r"\bmar(zo)?\b\s*\d", low):
                continue
            return _next_weekday(today, WEEKDAYS[word]), m.group(0)
    m = re.search(r"\b(per\s+la\s+)?prossima(\s+lezione)?\b", low)
    if m and subject and subject in ctx.get("next_lessons", {}):
        return date.fromisoformat(ctx["next_lessons"][subject]), m.group(0)
    return None, ""


def _clean_title(text: str, removed: list[str]) -> str:
    t = text
    for r in removed:
        if r:
            t = re.sub(re.escape(r), " ", t, count=1, flags=re.I)
    t = re.sub(r"\b(per|entro|il|la|di)\s*$", "", t.strip(), flags=re.I)
    t = re.sub(r"\s+", " ", t).strip(" ,;:-–·")
    return t


def parse_text(text: str, ctx: dict, default_source: str = "detto in classe") -> list[dict]:
    today = date.fromisoformat(ctx["today"])
    subjects = {s["code"]: s for s in ctx.get("subjects", [])}
    drafts: list[dict] = []
    for line in re.split(r"[\n\r]+", text):
        line = line.strip(" -•*\t")
        if not line:
            continue
        line_subject = None
        prefix = re.match(r"^([^:]{2,25}):\s*(.*)$", line)
        body = line
        if prefix:
            line_subject = _find_subject(prefix.group(1))
            if line_subject:
                body = prefix.group(2)
        clauses: list[str] = []
        for part in re.split(r"[;,]\s*", body):
            if not part.strip():
                continue
            starts_new = not clauses or _find_type(part) or _find_date(part, today, None, ctx)[0]
            if starts_new:
                clauses.append(part.strip())
            else:
                clauses[-1] += ", " + part.strip()
        for clause in clauses:
            subject = _find_subject(clause) or line_subject
            if subject not in subjects:
                subject = line_subject if line_subject in subjects else None
            tipo = _find_type(clause) or "compito"
            due, date_text = _find_date(clause, today, subject, ctx)
            guessed = False
            if due is None and subject and subject in ctx.get("next_lessons", {}):
                due = date.fromisoformat(ctx["next_lessons"][subject])
                guessed = True
            title = _clean_title(clause, [date_text])
            if not title or title.lower() in TYPE_KEYWORDS.get(tipo, []) or title.lower() == tipo:
                name = subjects[subject]["name_it"] if subject else ""
                title = f"{tipo.capitalize()} {name}".strip()
            drafts.append(
                {
                    "tipo": tipo,
                    "materia": subject,
                    "titolo": title[0].upper() + title[1:] if title else title,
                    "quando": due.isoformat() if due else None,
                    "fonte": default_source,
                    "_guessed_date": guessed,
                }
            )
    return validate_drafts(drafts, ctx, default_source)


def mock_image(ctx: dict) -> list[dict]:
    school_days = [d for d in ctx.get("school_days") or [] if d > ctx["today"]]
    first = school_days[1] if len(school_days) > 1 else ctx["today"]
    later = school_days[3] if len(school_days) > 3 else first
    return validate_drafts(
        [
            {"tipo": "compito", "materia": "MAT", "titolo": "Esempio OCR simulato: esercizi 12-15 pag. 112", "quando": first, "fonte": "ClasseViva"},
            {"tipo": "verifica", "materia": "INI", "titolo": "Esempio OCR simulato: verifica su API REST", "quando": later, "fonte": "Classroom"},
        ],
        ctx,
        "altro",
    )


# ---- Featherless ----------------------------------------------------------------
SYSTEM_PROMPT = """You extract school deadlines for an Italian high-school class.
Return ONLY JSON: {"items": [{"tipo": "compito|verifica|evento|lab", "materia": "<subject code or null>",
"titolo": "<short Italian title, max 80 chars>", "quando": "YYYY-MM-DD or null", "ora": "HH:MM or null",
"fonte": "ClasseViva|Classroom|Campus|detto in classe|altro"}]}
Rules:
- Today is @TODAY@ (@WEEKDAY@). Resolve relative dates ("ven", "domani", "prossima lezione") to real dates.
- Subjects of this class (code = name): @SUBJECTS@.
- Next lesson date for each subject: @NEXT_LESSONS@. Use it for "per la prossima lezione".
- Upcoming school days: @SCHOOL_DAYS@.
- "verifica", "test", "interrogazione" => tipo "verifica". Assemblies, trips, meetings => "evento".
- Ignore grades, student names, absences and anything that is not a task, test or event.
- If a date is unclear use null. Never invent items. Max 8 items."""

WEEKDAY_NAMES = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]


def _json_from_text(content: str) -> Any:
    content = content.strip()
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content)
    for opener, closer in (("{", "}"), ("[", "]")):
        start, end = content.find(opener), content.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(content[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise ValueError("Risposta AI non in formato JSON")


def build_system_prompt(ctx: dict) -> str:
    today = date.fromisoformat(ctx["today"])
    fields = {
        "@TODAY@": ctx["today"],
        "@WEEKDAY@": WEEKDAY_NAMES[today.weekday()],
        "@SUBJECTS@": ", ".join(f'{s["code"]} = {s["name_it"]}' for s in ctx.get("subjects", [])),
        "@NEXT_LESSONS@": json.dumps(ctx.get("next_lessons", {})),
        "@SCHOOL_DAYS@": ", ".join(ctx.get("school_days", [])[:10]),
    }
    system = SYSTEM_PROMPT
    for token, value in fields.items():
        system = system.replace(token, value)
    return system


def featherless_extract(payload: dict) -> list[dict]:
    ctx = payload["context"]
    api_key = payload.get("api_key") or os.getenv("FEATHERLESS_API_KEY", "")
    is_image = payload["kind"] == "image"
    model = (
        payload.get("model")
        or (os.getenv("FEATHERLESS_MODEL") if is_image else (os.getenv("FEATHERLESS_TEXT_MODEL") or os.getenv("FEATHERLESS_MODEL")))
        or ""
    )
    if not api_key or not model:
        raise RuntimeError("Featherless non configurato (FEATHERLESS_API_KEY / FEATHERLESS_MODEL)")
    system = build_system_prompt(ctx)
    if is_image:
        user_content: Any = [
            {"type": "text", "text": "Estrai compiti, verifiche ed eventi da questo ritaglio."},
            {"type": "image_url", "image_url": {"url": f"data:{payload.get('mime', 'image/webp')};base64,{payload['image_b64']}"}},
        ]
    else:
        user_content = payload["text"]
    resp = httpx.post(
        FEATHERLESS_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user_content}],
            "temperature": 0.1,
            "max_tokens": 900,
        },
        timeout=90,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    default_source = "altro" if is_image else "detto in classe"
    return validate_drafts(_json_from_text(content), ctx, default_source)


def extract_items(payload: dict) -> dict:
    """payload: {kind: text|image, text?, image_b64?, mime?, context, provider}"""
    provider = payload.get("provider", "mock")
    ctx = payload["context"]
    if provider == "featherless":
        try:
            return {"provider": "featherless", "drafts": featherless_extract(payload)}
        except Exception as exc:  # noqa: BLE001
            if payload["kind"] == "text":
                return {
                    "provider": "mock",
                    "drafts": parse_text(payload["text"], ctx),
                    "warning": f"AI non disponibile, uso il parser semplice ({type(exc).__name__})",
                }
            raise
    if payload["kind"] == "image":
        return {"provider": "mock", "drafts": mock_image(ctx), "warning": "OCR simulato: dati di esempio"}
    return {"provider": "mock", "drafts": parse_text(payload["text"], ctx)}
