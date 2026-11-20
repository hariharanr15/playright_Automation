# SCP requirement register

| File | What it is |
|---|---|
| `requirements-register.json` | **Source of truth.** One object per requirement (ID, module, feature, scenario, observed, expected, category A–E, status, question, approval, priority, test IDs, automation status, Playwright script, source). |
| `SCP_Requirement_Gap_Analysis.xlsx` | For the client: Summary, All requirements, one sheet per category, Traceability (requirement → test case → script). Generated. |
| `SCP_REQUIREMENT_GAP_ANALYSIS.md` | Human-readable gap analysis. Generated. |

Regenerate both after any change to the register (from `SCP`):

```powershell
python scripts/build-requirement-gap-analysis.py
```

## Categories

- **A Confirmed** – a rule recorded as decided by the product owner, the client (ticket/story) or, where noted, the user. Only A is an approved requirement.
- **B Observed** – what the application does today; no confirmed expected result.
- **C AI-suggested** – a plausible scenario nobody has confirmed. Never automate it as pass/fail without approval.
- **D Pending client confirmation** – an open question, contradiction or defect without a confirmed expected result.
- **E Blocked** – cannot be automated yet (missing account/data, external system, captcha, daily batch). `approval` reads "Rule approved – … (automation blocked)" when the rule itself is confirmed.

The build refuses duplicate IDs and any B/C/D row marked approved.

## When the client answers

1. Copy the answer into `clientAnswer` and set `approval` to `Approved – client <name>, <date>` (or record the rejection).
2. Move the row to **A** (or close it), rewrite `expected` from the answer, and clear `question`.
3. Update or add the Playwright test, put its ID in `testIds`, and set `automation` from the next run.
4. Rebuild the outputs.
