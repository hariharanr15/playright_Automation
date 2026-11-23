# Document Management – Functional Discovery (SCP Staging)

| Item | Value |
|---|---|
| Date / project / role | 2026-11-02 · `NRVC_Hall` · Project Admin |
| Method | Playwright MCP; run files uploaded (approved: create new records) |
| Test file | `pld1102-po.pdf` (small generated PDF) |

## 1. All Documents (`/all-documents`) [O]
- "N document(s) across this project" (402); search box ("Search by filename, material, or category...") + `Search`; category filter (All Categories, Components, Delivery Photo, EPD, Inventory, Materials, Pdf, PO File, Sites, Submittals, Supplier Material Mapping).
- Columns Filename, Category, Material, Submittal, Size, Uploaded By, Date, Actions (`View`, `Download`); pagination.
- **Every file produced by the other modules appears here**: GRN PDF and pre-shipping checklist PDF (category Pdf), FDI photo (Delivery Photo), Inventory upload files (Inventory), the PO file (PO File) – each linked to its material and submittal.
- **PO file "Uploaded By" = `Unknown`** (OBS-DOC-1); checklist PDF "Uploaded By" = `test` (OBS-DOC-2).

## 2. Spec Documents (`/spec-documents`) [O]
- Text: "Upload spec / submittal documents (PDF, DOC, ZIP) up to 60 MB … Once uploaded you can push the document through TheLink to auto-generate submittal records." Drop zone "Max 60 MB · PDF, DOC, ZIP, and most other formats".
- Columns Filename, Size, Status, Uploaded by, Uploaded, Spec Section No; actions `Add` (spec section no.), `Download`, `Send to TheLink`, `Delete`.
- Upload of a PDF → listed with status `uploaded`, uploader and timestamp. (TheLink is out of scope, R7.)

## 3. PO Validation (`/po-validation`) [O]
- "Upload a Purchase Order file to validate against existing data."; drop zone "Supports .xlsx, .xls, .pdf — multiple files OK"; `Back`.
- Uploading a PDF without a line-item table → toast **"The uploaded file contains no line items."** (Q-PL-13 parked: PO format unclear).

## 4. BOM Validation (`/bom-validation`) [O]
- File upload + `Back` (not exercised: no BOM sample).

## 5. EPD Report (`/epd-report`) [O]
- Upload EPD: submittal select (127 options, text `<material> - <submittal no> - <spec> - <description>`) + file; `Scan Procore for EPDs`.
- EPD Records columns Submittal, Product, Manufacturer, GWP A1-A3, GWP Total, Status, Actions.
- Uploading the run PDF for PLD1102-SUB-08 → record `Completed` with Product/Manufacturer/GWP `--` (the file is not a real EPD; no warning).
- **Procurement "EPD Exists" for PLD1102-SUB-08 then shows `02/11/2026` (a date) instead of Yes/No** (OBS-DOC-3).
- EPD Records also lists non-EPD files (QR label PNG/PDF, pre-shipping checklist PDF) with submittal `Pending` (OBS-DOC-4).

## 6. Observations (candidates, none registered)
| # | Observation |
|---|---|
| OBS-DOC-1 | All Documents: PO file uploaded via Procurement shows Uploaded By `Unknown` |
| OBS-DOC-2 | Pre-shipping checklist PDF shows Uploaded By `test` |
| OBS-DOC-3 | Procurement "EPD Exists" shows a date after an EPD upload (column elsewhere shows Yes/No) |
| OBS-DOC-4 | EPD Records lists non-EPD files (QR labels, checklist PDFs) as `Completed` |
| OBS-DOC-5 | A non-EPD PDF is accepted as EPD `Completed` with empty values, no warning |

## 7. Questions
- **Q-DOC-1** Should EPD upload reject files without EPD data? Which values must be extracted?
- **Q-DOC-2** "EPD Exists": Yes/No or the upload date?
- **Q-DOC-3** Sample PO and BOM files for validation testing (ties to Q-PL-13).
