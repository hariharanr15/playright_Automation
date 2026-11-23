"""Build the SCP requirement gap analysis from the requirement register.

Input : docs/requirements/requirements-register.json  (one object per requirement, see docs/requirements/README.md)
Output: docs/requirements/SCP_Requirement_Gap_Analysis.xlsx
        docs/requirements/SCP_REQUIREMENT_GAP_ANALYSIS.md

Usage (from SCP):  python scripts/build-requirement-gap-analysis.py
Re-run it after editing the register (e.g. when the client answers a question) so both outputs stay in step.
"""
import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
REQ_DIR = ROOT / "docs" / "requirements"
REGISTER = REQ_DIR / "requirements-register.json"
XLSX = REQ_DIR / "SCP_Requirement_Gap_Analysis.xlsx"
MD = REQ_DIR / "SCP_REQUIREMENT_GAP_ANALYSIS.md"

CATS = {
    "A": "Confirmed Requirements",
    "B": "Observed Application Behaviour",
    "C": "AI-Suggested Business Scenarios",
    "D": "Requirements Pending Client Confirmation",
    "E": "Blocked Automation Scenarios",
}
MODULE_ORDER = ["Management Dashboard", "Alerts / Notifications / Tasks", "Project Management", "Procurement Log",
                "Inventory Management", "First Delivery Inspections", "Document Management", "User Management",
                "Supplier List", "Enterprise", "Analytics", "International Shipments", "Cross-module"]
PRIO = {"High": 0, "Medium": 1, "Low": 2}
COLUMNS = [  # (header, key, width)
    ("Requirement ID", "id", 15), ("Module", "module", 20), ("Feature", "feature", 26),
    ("Business scenario", "scenario", 42), ("Observed behaviour", "observed", 42), ("Expected behaviour", "expected", 42),
    ("Category", "categoryName", 24), ("Requirement status", "status", 18), ("Priority", "priority", 9),
    ("Priority reason", "priorityReason", 26), ("Clarification question", "question", 46),
    ("Client approval status", "approval", 26), ("Client answer", "clientAnswer", 30),
    ("Related test case ID", "tests", 24), ("Automation status", "automation", 26),
    ("Playwright script", "script", 32), ("Source", "source", 30),
]
FILL = {"A": "E2F0D9", "B": "DDEBF7", "C": "FFF2CC", "D": "FCE4D6", "E": "EDEDED"}
HEAD = PatternFill("solid", fgColor="1F4E78")


def load():
    rows = json.loads(REGISTER.read_text(encoding="utf-8"))
    for r in rows:
        r["categoryName"] = f'{r["category"]} – {CATS[r["category"]]}'
        r["tests"] = ", ".join(r.get("testIds") or [])
        r.setdefault("clientAnswer", "")
    key = lambda r: (MODULE_ORDER.index(r["module"]) if r["module"] in MODULE_ORDER else 99,
                     PRIO.get(r.get("priority"), 3), r["id"])
    return sorted(rows, key=key)


def sheet(wb, title, rows, note=None):
    ws = wb.create_sheet(title[:31])
    start = 1
    if note:
        ws.cell(1, 1, note).font = Font(italic=True, color="595959")
        start = 3
    for c, (h, _, w) in enumerate(COLUMNS, 1):
        cell = ws.cell(start, c, h)
        cell.font = Font(bold=True, color="FFFFFF"); cell.fill = HEAD
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(c)].width = w
    for i, r in enumerate(rows, start + 1):
        for c, (_, k, _) in enumerate(COLUMNS, 1):
            cell = ws.cell(i, c, r.get(k, ""))
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            if k == "categoryName":
                cell.fill = PatternFill("solid", fgColor=FILL[r["category"]])
    ws.freeze_panes = ws.cell(start + 1, 2)
    if rows:
        ws.auto_filter.ref = f"A{start}:{get_column_letter(len(COLUMNS))}{start + len(rows)}"
        # The client records the decision here; the register is updated from it, never the other way round.
        dv = DataValidation(type="list", formula1='"Pending,Approved,Rejected,Changed – see answer"', allow_blank=True)
        col = get_column_letter([k for _, k, _ in COLUMNS].index("approval") + 1)
        dv.add(f"{col}{start + 1}:{col}{start + len(rows)}"); ws.add_data_validation(dv)
    return ws


def summary(wb, rows):
    ws = wb.active; ws.title = "Summary"
    ws["A1"] = "SCP – Requirement Gap Analysis"; ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = (f"Generated {date.today():%d %b %Y} from docs/requirements/requirements-register.json. "
                "Only category A rows are approved requirements; everything else is observation, suggestion or an open question.")
    ws["A2"].alignment = Alignment(wrap_text=True); ws.merge_cells("A2:I2"); ws.row_dimensions[2].height = 32
    heads = ["Module"] + [f"{k} {v.split()[0]}" for k, v in CATS.items()] + ["Total", "High priority open", "Automated"]
    for c, h in enumerate(heads, 1):
        cell = ws.cell(4, c, h); cell.font = Font(bold=True, color="FFFFFF"); cell.fill = HEAD
        ws.column_dimensions[get_column_letter(c)].width = 26 if c == 1 else 14
    by = defaultdict(list)
    for r in rows: by[r["module"]].append(r)
    mods = [m for m in MODULE_ORDER if m in by] + sorted(m for m in by if m not in MODULE_ORDER)
    line = 5
    for m in mods + ["Total"]:
        rs = rows if m == "Total" else by[m]
        cnt = Counter(r["category"] for r in rs)
        open_high = sum(1 for r in rs if r["priority"] == "High" and r["category"] in "DE")
        auto = sum(1 for r in rs if r["automation"].startswith("Automated"))
        vals = [m] + [cnt.get(k, 0) for k in CATS] + [len(rs), open_high, auto]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(line, c, v)
            if m == "Total": cell.font = Font(bold=True)
        line += 1


THIN = ["Project Management › Inventory Rebuild (new on 20 Nov 2026)",
        "Configuration Options › Estimate Subcontractor Freight Emissions and LLM Material Categorization (new settings)",
        "Construction Delivery", "Enterprise › Enterprise Shipments", "Project Setup Wizard", "Integrations › TheLink"]


def approval_sources(rows):
    """Who approved the category A rows: product owner, client story/ticket, project team, user (automation owner)."""
    c = Counter()
    for r in rows:
        if r["category"] != "A": continue
        a = r["approval"].lower()
        c["client ticket/story" if re.search(r"bugs-|story|\bac\b", a) else "product owner" if "product owner" in a
          else "project team" if "project team" in a else "user (automation owner)" if re.search(r"\buser\b", a) else "other"] += 1
    return c.most_common()


def markdown(rows):
    cnt = Counter(r["category"] for r in rows)
    by_mod = defaultdict(list)
    for r in rows: by_mod[r["module"]].append(r)
    mods = [m for m in MODULE_ORDER if m in by_mod] + sorted(m for m in by_mod if m not in MODULE_ORDER)
    esc = lambda s: re.sub(r"\s+", " ", str(s or "")).replace("|", "\\|")
    out = [
        "# SCP – Requirement Gap Analysis",
        "",
        f"_Generated {date.today():%d %B %Y} from `requirements-register.json` by `scripts/build-requirement-gap-analysis.py`. "
        "Edit the register, not this file._",
        "",
        "## How to read this",
        "",
        "- **Only category A is an approved requirement.** B, C and D are observations, suggestions and open questions. "
        "A test that passes against a B/C/D expectation does not make it a requirement.",
        "- Discovery is based on the read-only sweeps and functional discovery in `docs/functional-discovery` "
        "(Oct–Nov 2026) and on automated runs up to 20 Nov 2026. Screens with little or no discovery yet: "
        + ", ".join(THIN) + ".",
        "- Approval sources of category A: " + ", ".join(f"{k} {v}" for k, v in approval_sources(rows)) + ". "
        "Rows confirmed only by the automation owner (\"user\") or the project team should be re-confirmed by the client.",
        "- The client answers in the Excel register (columns *Client approval status* and *Client answer*). "
        "An answered question moves the row to A (approved) or is closed as rejected; the automation is then updated.",
        "",
        "| Category | Meaning | Count |",
        "|---|---|---|",
    ]
    for k, v in CATS.items():
        out.append(f"| {k} | {v} | {cnt.get(k, 0)} |")
    out += [f"| | **Total** | **{len(rows)}** |", "", "## Summary by module", "",
            "| Module | A | B | C | D | E | High-priority open (D+E) | Automated |", "|---|---|---|---|---|---|---|---|"]
    for m in mods:
        rs = by_mod[m]; c = Counter(r["category"] for r in rs)
        oh = sum(1 for r in rs if r["priority"] == "High" and r["category"] in "DE")
        au = sum(1 for r in rs if r["automation"].startswith("Automated"))
        out.append(f"| {m} | {c.get('A',0)} | {c.get('B',0)} | {c.get('C',0)} | {c.get('D',0)} | {c.get('E',0)} | {oh} | {au}/{len(rs)} |")

    top = [r for r in rows if r["category"] == "D" and r["priority"] == "High"]
    out += ["", "## Highest-impact questions for the client", "",
            "Answering these first unblocks the most important automation.", "",
            "| # | ID | Module | Question | Related tests |", "|---|---|---|---|---|"]
    for i, r in enumerate(top, 1):
        out.append(f"| {i} | {r['id']} | {r['module']} | {esc(r['question'])} | {esc(r['tests'])} |")

    blocked = [r for r in rows if r["category"] == "E"]
    out += ["", "## Blocked automation", "", "| ID | Module | Scenario | What unblocks it |", "|---|---|---|---|"]
    for r in blocked:
        out.append(f"| {r['id']} | {r['module']} | {esc(r['scenario'])} | {esc(r['question'] or r['observed'])} |")

    for m in mods:
        out += ["", f"## {m}", ""]
        for k in CATS:
            rs = [r for r in by_mod[m] if r["category"] == k]
            if not rs: continue
            out += [f"### {k}. {CATS[k]}", "",
                    "| ID | Feature | Scenario | Observed | Expected | Priority | Question | Approval | Tests | Automation |",
                    "|---|---|---|---|---|---|---|---|---|---|"]
            for r in rs:
                out.append("| " + " | ".join(esc(x) for x in [r["id"], r["feature"], r["scenario"], r["observed"], r["expected"],
                           r["priority"], r["question"], r["approval"], r["tests"], r["automation"]]) + " |")
            out.append("")
    MD.write_text("\n".join(out) + "\n", encoding="utf-8")


def main():
    rows = load()
    ids = Counter(r["id"] for r in rows)
    dup = [i for i, n in ids.items() if n > 1]
    if dup: raise SystemExit(f"Duplicate requirement IDs: {', '.join(dup)}")
    bad = [r["id"] for r in rows if r["category"] in "BCD" and str(r.get("approval", "")).lower().startswith("approved")]
    if bad: raise SystemExit(f"Only category A may be approved (category E may say 'Rule approved'): {', '.join(bad)}")
    wb = Workbook()
    summary(wb, rows)
    sheet(wb, "All requirements", rows)
    for k, v in CATS.items():
        sheet(wb, f"{k} {v}", [r for r in rows if r["category"] == k])
    trace = wb.create_sheet("Traceability")
    for c, (h, w) in enumerate([("Requirement ID", 15), ("Category", 8), ("Test case ID", 18), ("Automation status", 28), ("Playwright script", 40)], 1):
        cell = trace.cell(1, c, h); cell.font = Font(bold=True, color="FFFFFF"); cell.fill = HEAD
        trace.column_dimensions[get_column_letter(c)].width = w
    line = 2
    for r in rows:
        for t in (r.get("testIds") or ["—"]):
            for c, v in enumerate([r["id"], r["category"], t, r["automation"], r.get("script", "")], 1):
                trace.cell(line, c, v)
            line += 1
    trace.freeze_panes = "A2"; trace.auto_filter.ref = f"A1:E{line - 1}"
    wb.save(XLSX)
    markdown(rows)
    print(f"{len(rows)} requirements -> {XLSX.name}, {MD.name}")


if __name__ == "__main__":
    main()
