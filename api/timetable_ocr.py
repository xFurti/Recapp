"""Reads a class timetable out of a screenshot.

The result is a draft. Nothing is written to the timetable until the same
confirmation used by manual editing. Teacher names and anything that is not
a lesson cell are dropped.
"""

import os
import re
from typing import Any, Optional

import httpx

from .school_data import is_lab_room
from .tasks import FEATHERLESS_URL, SUBJECT_KEYWORDS, WEEKDAYS, _json_from_text, _subject_code

# The fictional grid drawn in api/tests/fixtures/orario-finto.png.
# A real class photo is never stored here.
FIXTURE_LESSONS: list[dict] = [
    {"giorno": "lunedì", "ora": 1, "materia": "Matematica", "aula": "Rossi A215"},
    {"giorno": "lunedì", "ora": 1, "materia": "Storia", "aula": "A210", "docente": "Bianchi"},
    {"giorno": "lunedì", "ora": 2, "materia": "Informatica", "aula": "L145"},
    {"giorno": "martedì", "ora": 1, "materia": "Storia", "aula": "A210"},
    {"giorno": "mercoledì", "ora": 1, "materia": "Inglese", "aula": "A118"},
    {"giorno": "mercoledì", "ora": 2, "materia": "Italiano", "aula": "Laboratorio"},
    {"giorno": "venerdì", "ora": 1, "materia": "Scienze motorie", "aula": "Palestra"},
    {"giorno": "venerdì", "ora": 2, "materia": "Filosofia", "aula": "A12"},
    {"giorno": "giovedì", "ora": None, "materia": "Religione", "aula": "A161"},
]

ROOM_TOKEN = re.compile(
    r"\b(palestra|laboratorio|lab|[A-Za-z]{0,3}\d{2,4})\b",
    re.I,
)
NAME_ONLY = re.compile(r"^[A-Za-zÀ-ÿ' .\-]{2,40}$")


def _weekday(value: Any) -> Optional[int]:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int) or (isinstance(value, str) and value.strip().isdigit()):
        day = int(value)
        return day if 0 <= day <= 4 else None
    word = str(value).strip().lower().replace("ì", "i")
    if word in WEEKDAYS and WEEKDAYS[word] <= 4:
        return WEEKDAYS[word]
    for name, day in WEEKDAYS.items():
        if day <= 4 and len(word) >= 3 and (word.startswith(name) or name.startswith(word)):
            return day
    return None


def _hour(value: Any, hours: set[int]) -> Optional[int]:
    if isinstance(value, bool) or value is None or value == "":
        return None
    match = re.search(r"\d{1,2}", str(value))
    if not match:
        return None
    hour = int(match.group(0))
    return hour if hour in hours else None


def _room(value: Any) -> str:
    """Keep a room code. A person's name written beside it is not part of the timetable."""
    text = str(value or "").strip()
    if not text:
        return ""
    match = ROOM_TOKEN.search(text)
    if not match:
        return "" if NAME_ONLY.match(text) else ""
    token = match.group(1)
    low = token.lower()
    if low == "palestra":
        return "Palestra"
    if low in ("laboratorio", "lab"):
        return "Laboratorio"
    return token.upper()


def _lesson(value: Any) -> Optional[dict]:
    if not isinstance(value, dict):
        return None
    return {
        "giorno": value.get("giorno", value.get("weekday", value.get("day"))),
        "ora": value.get("ora", value.get("hour")),
        "materia": value.get("materia", value.get("subject")),
        "aula": value.get("aula", value.get("room")),
        "laboratorio": value.get("laboratorio", value.get("is_lab")),
    }


def validate_timetable(raw: Any, ctx: dict) -> dict:
    """Turns a model reading into cells the timetable already understands.

    Empty hours are omitted. An unknown subject or a second lesson in the same
    hour is flagged and never becomes a new subject. A lesson with no usable
    hour is listed as unplaced and is not written into the grid.
    """
    if isinstance(raw, dict):
        raw = raw.get("lezioni", raw.get("lessons", raw.get("slots", [])))
    if not isinstance(raw, list):
        raw = []
    hours = {int(h) for h in ctx.get("hours") or range(1, 8)}
    slots: list[dict] = []
    unplaced: list[dict] = []
    seen: dict[tuple[int, int], dict] = {}

    for item in raw[:40]:
        lesson = _lesson(item)
        if lesson is None:
            continue
        subject_text = str(lesson["materia"] or "").strip()
        if not subject_text and not lesson["aula"]:
            continue
        day = _weekday(lesson["giorno"])
        hour = _hour(lesson["ora"], hours)
        room = _room(lesson["aula"])
        lab_word = bool(lesson["laboratorio"]) or "laborator" in str(lesson["aula"] or "").lower()
        if day is None or hour is None:
            unplaced.append({
                "raw_subject": subject_text[:40],
                "reason": "unclear_hour",
                "detail": str(lesson["giorno"] or "")[:20],
            })
            continue
        code = _subject_code(subject_text, ctx)
        if code is None:
            # Abbreviations used by the homework reader, still only if the class has that subject.
            for known, words in SUBJECT_KEYWORDS.items():
                if subject_text.lower() in words and any(s["code"] == known for s in ctx.get("subjects", [])):
                    code = known
                    break
        key = (day, hour)
        if key in seen:
            current = seen[key]
            current["needs_check"] = True
            current["check_reason"] = "duplicate"
            continue
        cell = {
            "weekday": day,
            "hour": hour,
            "subject_code": code,
            "room": room,
            "is_lab": is_lab_room(room) or lab_word,
            "needs_check": code is None,
            "check_reason": "" if code else "unknown_subject",
            "raw_subject": "" if code else subject_text[:40],
        }
        seen[key] = cell
        slots.append(cell)

    slots.sort(key=lambda cell: (cell["weekday"], cell["hour"]))
    return {"slots": slots, "unplaced": unplaced[:8]}


TIMETABLE_PROMPT = """You read an Italian high-school weekly timetable from a photo.
Return ONLY JSON: {"lezioni": [{"giorno": "lunedì|martedì|mercoledì|giovedì|venerdì", "ora": 1, "materia": "<subject name or code or null>", "aula": "<room code or null>"}]}
Rules:
- Subjects of this class (code = name): @SUBJECTS@.
  Abbreviations: mate/mat = MAT, info/inf = INI, sistemi/sis/reti = SRI, tpsit = TPI,
  tele/tlc = TCI, ita = LIT, sto = STO, ing/eng = ING, motoria/ginnastica = SMS, religione = IRC.
- Hours that exist: @HOURS@. Use the printed hour number (1ª, 2ª, …), not the clock time.
- Monday to Friday only. An empty cell is omitted, not guessed.
- "aula" is only the room code (A215, L145, Palestra). Never include a teacher name.
- A room or label that says laboratorio means the room code if one is printed, otherwise "Laboratorio".
- If two lessons are printed in the same hour, return both.
- If a cell is unreadable, return materia null and still give giorno and ora.
- Do not return grades, absences, student names or notes. Max 35 lessons.
"""


def _prompt(ctx: dict) -> str:
    system = TIMETABLE_PROMPT
    system = system.replace("@SUBJECTS@", ", ".join(f'{s["code"]} = {s["name_it"]}' for s in ctx.get("subjects", [])))
    system = system.replace("@HOURS@", ", ".join(str(h) for h in ctx.get("hours") or range(1, 8)))
    return system


def featherless_timetable(payload: dict) -> Any:
    api_key = payload.get("api_key") or os.getenv("FEATHERLESS_API_KEY", "")
    model = payload.get("model") or os.getenv("FEATHERLESS_MODEL") or ""
    if not api_key or not model:
        raise RuntimeError("Featherless non configurato (FEATHERLESS_API_KEY / FEATHERLESS_MODEL)")
    resp = httpx.post(
        FEATHERLESS_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": _prompt(payload["context"])},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Leggi l'orario in questa immagine."},
                        {"type": "image_url", "image_url": {"url": f"data:{payload.get('mime', 'image/webp')};base64,{payload['image_b64']}"}},
                    ],
                },
            ],
            "temperature": 0.1,
            "max_tokens": 1200,
        },
        timeout=90,
    )
    resp.raise_for_status()
    return _json_from_text(resp.json()["choices"][0]["message"]["content"])


def extract_timetable(payload: dict) -> dict:
    """payload kind is timetable. Returns drafts shaped as {slots, unplaced}."""
    ctx = payload["context"]
    provider = payload.get("provider", "mock")
    warning = payload.get("notice") or ""
    if provider == "featherless":
        parsed = validate_timetable(featherless_timetable(payload), ctx)
        used = "featherless"
    else:
        parsed = validate_timetable(FIXTURE_LESSONS, ctx)
        used = "mock"
        warning = warning or "OCR simulato: orario di esempio"
    if not parsed["slots"] and not parsed["unplaced"]:
        warning = warning or "Non sembra un orario"
    return {"provider": used, "drafts": parsed, "warning": warning}
