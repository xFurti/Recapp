"""Static data for ITI G. Marconi Verona, school year 2026/27.

Sources: https://www.marconiverona.edu.it/pagine/calendario-eventi and
https://orario.marconivr.it/ (timetables of 4AI and 4BI as of September 2026).
"""

from datetime import date, timedelta

SCHOOL_YEAR_START = date(2026, 9, 10)
SCHOOL_YEAR_END = date(2027, 6, 8)

HOURS = [
    {"hour": 1, "start": "08:00", "end": "08:50"},
    {"hour": 2, "start": "08:50", "end": "09:40"},
    {"hour": 3, "start": "09:50", "end": "10:40"},
    {"hour": 4, "start": "10:50", "end": "11:40"},
    {"hour": 5, "start": "11:50", "end": "12:40"},
    {"hour": 6, "start": "12:50", "end": "13:40"},
    {"hour": 7, "start": "13:40", "end": "14:30"},
]


def bell_hours(stored: object) -> list[dict]:
    if isinstance(stored, list) and stored:
        return stored
    return HOURS

SUBJECTS = [
    ("INI", "Informatica", "Computer Science", "#1898C8"),
    ("SRI", "Sistemi e reti", "Networks", "#8038B8"),
    ("TPI", "TPSIT", "Systems Design", "#80B830"),
    ("TCI", "Telecomunicazioni", "Telecom", "#D99A00"),
    ("MAT", "Matematica", "Math", "#E01058"),
    ("LIT", "Italiano", "Italian", "#A02848"),
    ("STO", "Storia", "History", "#8A5A2B"),
    ("ING", "Inglese", "English", "#0E7490"),
    ("SMS", "Scienze motorie", "PE", "#4D7C0F"),
    ("IRC", "Religione", "Religion", "#6B7280"),
]

# weekday -> list of (subject, room) for hours 1..n. Rooms starting with "L" are labs.
TIMETABLES = {
    "4BI": {
        0: [("LIT", "A215"), ("LIT", "A215"), ("SRI", "A105"), ("SMS", "Palestra"), ("IRC", "A161"), ("INI", "A122")],
        1: [("MAT", "A064"), ("MAT", "A064"), ("SRI", "A105"), ("LIT", "A215"), ("INI", "A120"), ("INI", "A120")],
        2: [("TPI", "L143"), ("TPI", "L143"), ("ING", "A315"), ("SMS", "Palestra"), ("INI", "L143"), ("INI", "L143"), ("INI", "L143")],
        3: [("TCI", "L348"), ("TCI", "L348"), ("STO", "A215"), ("STO", "A215"), ("TPI", "A121"), ("ING", "A315")],
        4: [("ING", "A316"), ("TCI", "A323"), ("LIT", "A216"), ("SRI", "L143"), ("SRI", "L143"), ("MAT", "A263"), ("MAT", "A263")],
    },
    "4AI": {
        0: [("INI", "A121"), ("SMS", "Palestra"), ("MAT", "A062"), ("IRC", "A161"), ("LIT", "A209"), ("LIT", "A209")],
        1: [("SMS", "Palestra"), ("TPI", "A105"), ("TCI", "L348"), ("TCI", "L348"), ("ING", "A309"), ("MAT", "A062")],
        2: [("TPI", "L145"), ("TPI", "L145"), ("ING", "A309"), ("LIT", "A222"), ("MAT", "A063"), ("SRI", "A121")],
        3: [("LIT", "A205"), ("INI", "A121"), ("INI", "A121"), ("TCI", "A323"), ("MAT", "A264"), ("SRI", "L145"), ("SRI", "L145")],
        4: [("SRI", "A121"), ("INI", "L145"), ("INI", "L145"), ("INI", "L145"), ("ING", "A315"), ("STO", "A215"), ("STO", "A215")],
    },
}

CLASS_LABELS = {
    "4AI": "4ª AI · Informatica",
    "4BI": "4ª BI · Informatica",
}


def is_lab_room(room: str) -> bool:
    return room.strip().upper().startswith("L")


def _range(start: date, end: date, label: str) -> list[tuple[date, str, str]]:
    out = []
    d = start
    while d <= end:
        out.append((d, label, "sospensione"))
        d += timedelta(days=1)
    return out


HOLIDAYS: list[tuple[date, str, str]] = [
    (date(2026, 10, 4), "San Francesco d'Assisi", "festivita"),
    (date(2026, 11, 1), "Tutti i Santi", "festivita"),
    (date(2026, 12, 8), "Immacolata Concezione", "festivita"),
    (date(2026, 12, 25), "Natale", "festivita"),
    (date(2026, 12, 26), "Santo Stefano", "festivita"),
    (date(2027, 1, 1), "Capodanno", "festivita"),
    (date(2027, 1, 6), "Epifania", "festivita"),
    (date(2027, 3, 29), "Lunedì dell'Angelo", "festivita"),
    (date(2027, 4, 25), "Festa della Liberazione", "festivita"),
    (date(2027, 5, 1), "Festa del Lavoro", "festivita"),
    (date(2027, 5, 21), "Patrono di Verona (San Zeno) - da verificare", "festivita"),
    (date(2027, 6, 2), "Festa della Repubblica", "festivita"),
    (date(2026, 12, 7), "Ponte dell'Immacolata", "sospensione"),
    *_range(date(2026, 12, 24), date(2027, 1, 5), "Vacanze di Natale"),
    *_range(date(2027, 2, 8), date(2027, 2, 10), "Carnevale e Ceneri"),
    *_range(date(2027, 3, 25), date(2027, 3, 30), "Vacanze di Pasqua"),
    *_range(date(2027, 4, 29), date(2027, 4, 30), "Ponte del 1° maggio"),
]


def holidays_dedup() -> list[tuple[date, str, str]]:
    seen: dict[date, tuple[date, str, str]] = {}
    for d, label, kind in HOLIDAYS:
        if d not in seen or kind == "festivita":
            seen[d] = (d, label, kind)
    return sorted(seen.values())
