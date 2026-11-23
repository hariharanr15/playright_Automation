# Document Management – Smoke and Regression Scenarios (Draft for Review)

> **Step-by-step flows (Action → Expected, matching the automated steps):** [MODULES_SMOKE_STEPS.md](steps/MODULES_SMOKE_STEPS.md), [MODULES_REGRESSION_STEPS.md](steps/MODULES_REGRESSION_STEPS.md)

Source: [DOC_FUNCTIONAL_DISCOVERY.md](DOC_FUNCTIONAL_DISCOVERY.md). Legend as in PM regression. Run files are named `<RUN>-*.pdf`; delete only run files.

## Smoke (read-only)
| ID | Title | Expected | Ev. |
|---|---|---|---|
| DOC-SMK-01 | All Documents loads | Count text, search, category filter, 8 columns, View/Download, pagination | O |
| DOC-SMK-02 | Spec Documents loads | Upload area, 6 columns, Add/Download/Send to TheLink/Delete actions | O |
| DOC-SMK-03 | PO Validation loads | Text, drop zone "Supports .xlsx, .xls, .pdf", Back | O |
| DOC-SMK-04 | BOM Validation loads | Upload + Back | O |
| DOC-SMK-05 | EPD Report loads | Upload EPD (submittal + file), Scan Procore for EPDs, 7 columns | O |

## Regression
| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| DOC-REG-01 | Search by filename | POS | R | Search `<RUN>` → only run files | O |
| DOC-REG-02 | Category filter | POS | R | `PO File` → only PO files | I |
| DOC-REG-03 | Module files appear | INT | M | After Procurement GRN / checklist / PO upload / FDI photo / Inventory upload → each listed with material + submittal | O |
| DOC-REG-04 | Uploaded By is the real user | POS | R | PO file and checklist PDF show the uploader's email | O – `Unknown` / `test` (OBS-DOC-1/2) |
| DOC-REG-05 | View / Download | POS | R | File opens / downloads, size > 0 | I |
| DOC-REG-06 | Spec document upload | POS | M | Listed `uploaded` with user and time | O |
| DOC-REG-07 | Spec Section No add/edit | POS | M | `Add` → value saved | I |
| DOC-REG-08 | Spec document delete (run file) | POS | M | Removed | I |
| DOC-REG-09 | Spec upload > 60 MB | BND | C | Rejected with a size message | I |
| DOC-REG-10 | PO validation without line items | NEG | M | "The uploaded file contains no line items." | O |
| DOC-REG-11 | PO validation with a valid PO | POS | M | Line items compared with Procurement (needs sample, Q-DOC-3) | I |
| DOC-REG-12 | BOM validation | POS | M | Needs sample (Q-DOC-3) | I |
| DOC-REG-13 | EPD upload for a submittal | POS/INT | M | Record listed; Procurement "EPD Exists" = Yes | O – shows a date (OBS-DOC-3) |
| DOC-REG-14 | Non-EPD file rejected | NEG | M | Warning / not Completed (Q-DOC-1) | O – accepted (OBS-DOC-5) |
| DOC-REG-15 | EPD records list only EPDs | POS | R | No QR/checklist files listed | O – listed (OBS-DOC-4) |
| DOC-REG-16 | Scan Procore for EPDs | INT | M | Not executed (Procore link) | I |

Totals: 5 smoke · 16 regression.
