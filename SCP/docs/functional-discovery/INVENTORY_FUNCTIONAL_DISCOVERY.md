# Inventory Management – Functional Discovery (SCP Staging)

| Item | Value |
|---|---|
| Discovery date | 2026-11-02 |
| Environment | Staging only (`stg-supplychain-app.voyagecontrol.com/inventory-management`) |
| Account / role | The user's own SSO account, **Project Admin** |
| Project / site | `NRVC_Hall` / `Site T2 Pmr2-2611011614` (one location: `Loc X Pmr2-2611011614`, type Construction Area) |
| Method | Playwright MCP, single Chromium session. Writes approved by the user (create new records; nothing pre-existing deleted) |
| Test material | `43 Inches` (ID `0001`, category TV, UoM Pieces), fed by Procurement run records PLD1102-SUB-01 (12 delivered) and PLD1102-SUB-07 (4 delivered, partial) |
| Earlier work | [../INVENTORY_MANAGEMENT_COVERAGE.md](../INVENTORY_MANAGEMENT_COVERAGE.md), [../INVENTORY_PREREQUISITE_FLOW.md](../INVENTORY_PREREQUISITE_FLOW.md) (24 Oct automation). Items re-confirmed today are marked **[O]**; items taken from those docs are marked **[A]** |

Evidence tags: **[O]** observed today · **[A]** existing automation/docs · **[R]** product-owner rule · **[I]** inferred.

## 1. Landing page [O]
- Controls: location select (`All locations` + site locations), `Search inventory…`, count (`253 items`; with a location selected: `1 item · Loc X …`), buttons `Receive booking`, `Upload`, `Export`.
- Grid: `Category | Material ID | Material Name | Inventory | UOM` with a row menu icon (`Menu`). It lists every material of the project (253, most with 0 stock).
- **Search** updates as you type (no Enter needed) and matches name, Material ID (`0001`) and category, ignoring case (`tv` gave 10 items). No match gives `0 items` with an empty table.
- **Location filter** lists only materials with stock at that location.
- Row menu: `Actions`, `Location`, `Submittals`, `UOM`.
- **The grid's Inventory value does not refresh after a manual activity** (stayed 16 while the ledger showed 14 → 12). It is right after a reload, and it does refresh after an Upload (OBS-INV-4).

## 2. Row views [O]
| View | Content |
|---|---|
| **Actions** (ledger) | Header: Category, Material ID, Material Name, UOM, **Opening Balance**, **Closing Balance**; site select + `All Locations` filter; history date range (default last month); `Add Activity`. Table `Action | Submittal | Schedule | Item | Location | Date | QTY | Total QTY` |
| **Location** | `Name | Location Type | QTY` (e.g. Loc X / Construction Area / 13) |
| **Submittals** | `Spec section no. | Submittal No. | Spec description | QTY | Received QTY` for every submittal that has this material |
| **UOM** | `Stock Keeping Unit | QTY` (only SKUs with stock; `50 Inches` not listed) |

Ledger findings:
- The **Submittal column shows the Spec Section No** (`PLD1102-SPEC-07`), not the Submittal No (OBS-INV-1).
- Schedule is shown as `<ROJ date>-<PO number>`.
- **"Total QTY" is the signed movement of that row** (−2, −1, +4), not a running total (OBS-INV-2; rename or show the running balance).
- Completed Procurement deliveries appear automatically as `Incoming Load` (SUB-01 = 12, SUB-07 = **4, including the 1 damaged unit**; Q-INV-1).

## 3. Add Activity [O]
Fields: activity date (read-only input, default today), `Item*`, `Action*`, `From Location*`, `To Location*` (Internal Movement only), `QTY*`, `Comments*`, `Supplier*`, `Subcontractor*`, `Submittal*`, `Schedule*`, button `ADD`.
- Empty ADD: "Item is required", "Action is required", "From Location is required", "QTY is required", "Comments is required", "Supplier is required", "Subcontractor is required", "Submittal is required", "Schedule is required".
- **Item** = SKUs of the material (`43 Inches`, `50 Inches`). **Action** = `Incoming Load`, `Internal Movement`, `Issue To Construction`, `Loss`, `Return`.
- After picking From Location the form shows **"Available at <location>: N Pieces"**.
- **Supplier** lists only suppliers mapped to the material (LG, WeTwo Matches, Samsung India). **Subcontractor** lists **email addresses** (2). **Submittal** lists Submittal Nos that contain the material. **Schedule** shows `<ROJ>-<item>-<PO>` options for the chosen submittal.
- **The Schedule list reloads about 1 s after the Submittal changes.** Picking a schedule straight away selected the *previous* submittal's schedule, and **the server saved the mismatched pair** (Loss row: Submittal SPEC-07 + Schedule PO-01, OBS-INV-3).
- A saved activity closes the dialog **with no success toast** (OBS-INV-9). The ledger updates about 1–3 s later.

### 3.1 Quantity and stock rules [O]
| Case | Result |
|---|---|
| QTY 0 or −1 | toast "Quantity cannot be empty or zero or less" |
| QTY 1.555 | toast "Invalid data provided." (generic; the 2-decimal rule is not stated, OBS-INV-10) |
| Loss 20 with 14 available | "Not enough stock at Loc X Pmr2-2611011614: only 14 Pieces available, 20 requested." |
| Internal Movement From = To | "From Location and To Location must be different." |
| Incoming Load 1 on a **fully delivered** schedule (SUB-01) | "Cannot add this activity, scheduled_quantity required:0.00 and you are adding 1.00, quantity exceeds by 1.00 units" (raw field name, OBS-INV-5) |
| Incoming Load 1 on a **partial** schedule (SUB-07, 6 open) | Accepted (+1) |

### 3.2 Activities performed (all on 43 Inches @ Loc X)
| # | Action | Submittal / schedule | QTY | Closing |
|---|---|---|---|---|
| start | Incoming Load ×2 (from Procurement GRNs) | SUB-01 / SUB-07 | +12, +4 | 16 |
| 1 | Issue To Construction | SUB-01 / PO-01 | −2 | 14 |
| 2 | Loss | SUB-07 / **PO-01** (mismatch, OBS-INV-3) | −1 | 13 |
| 3 | Return | SUB-07 / PO-07 | −1 | 12 |
| 4 | Incoming Load (manual) | SUB-07 / PO-07 | +1 | 13 |
| 5 | Issue To Construction (upload) | SUB-07 / PO-07 | −1 | 12 |
| 6 | Loss (upload, blank comment) | SUB-07 / PO-07 | −1 | **11** |

**Return reduces stock** (as the 24 Oct rule says). The upload instructions call it "sends received stock back to the supplier".

### 3.3 Cross-module effects on Procurement [O]
- A manual **Incoming Load** creates a delivery row on the Procurement component labelled **"Via Inventory"** (QTY 1, Good 1).
- A **Return** creates a delivery row labelled **"Return"** with **Returned QTY 1**. This is where the Procurement "Returned QTY" column gets its value.
- **Issue To Construction and Loss are not written back** to Procurement.
- The Procurement component header (QTY Received 4, Remaining 6) and the Inventory "Submittals" view (Received 4) **do not include the manual Incoming of 1** (Q-INV-2).

## 4. Upload [O]
- Dialog "Upload inventory activities": `Site: <site>`. Steps: "Download the template. It is generated for this project and scope, with dropdowns for the allowed values." · "Fill in one row per record and upload the file (.xlsx)." · "Every row is checked. Nothing is saved unless all rows are valid; if any row fails, download the error file to see what to fix." Buttons `Download template`, `Choose file` ("No file selected."), `Cancel`, `Upload` (disabled until a file is chosen).
- `inventory_upload_template.xlsx`: sheets `_Lists` (named ranges for submittals, materials, actions, locations, suppliers, item-by-material), **`Inventory Template`** with columns `Submittal No, Material, Item, Date Required On Site, PO Number, Action, From Location, To Location, Quantity, UoM, Supplier, Comments` (dropdown validation; Item depends on Material), and `Instructions`.
- Instructions (summary): red header = required; whole file validated first; one site per file; rows applied top to bottom (a later row can use stock from an earlier one); Date Required On Site (DD/MM/YYYY) + Submittal No + Material identify the schedule line; PO Number only when several lines share a date; **Quantity is always positive, and the action decides the sign**; **UoM, Supplier and Comments are optional** (blank Supplier = the submittal's supplier).
- Differences from the manual form: **no Subcontractor column**; Comments optional (required in the manual form); **the UoM dropdown points at an empty list (`BlankItem`)** (OBS-INV-11).
- **Negative (atomic) upload:** a valid row plus an overdraw row gives "The upload failed. Nothing was saved." plus `Download error file` (`UploadErrors_<ts>_<id>.xlsx`, sheet `Failed Records`, columns `Row … Status, Errors`): row 2 `Valid (not saved)`, row 3 `Error` – "Quantity: Not enough stock at Loc X Pmr2-2611011614: **12.00** available, 500.00 requested (base units)." **The ledger showed 13 at that moment** (OBS-INV-7). Buttons `Upload another file`, `Close`.
- **Positive upload** (2 rows) gives the toast "Upload inventory activities uploaded successfully." (wording). Rows were added and the balance became 11; the grid refreshed.

## 5. Export [O]
`Inventory_Report_<yyyymmdd>.xlsx`, sheet `Inventory List`, but the content is the **activity list for the site** (8 rows: `Inventory Activity ID, Material Name, Item Name, Action (raw, e.g. incoming_load), Site Name, From/To Location, Action Quantity, Total Value, Supplier Name, Subcontractor ID, Comments, Added By, Created At (Excel serial)`). It is **not** the material balance list shown on screen, and has no submittal or schedule columns (OBS-INV-8).

## 6. Receive booking [O]
"Receive against booking": "No bookings ready to receive for this project." with `Cancel` and `Receive` (disabled). The request `new_bookings/receivable_bookings` returns **500** and a red toast "Invalid project_id, not found in ProjectMap" (OBS-INV-6). NRVC_Hall has no Booking System link (PM rule: manual entry only), so the empty list is expected but the error isn't.

## 7. Activity date picker – SCP-DEF-002 reproduced [O]
Clicking the Add Activity date input **froze the tab**: the click timed out, screenshots and navigation timed out, and the tab had to be replaced. This matches **SCP-DEF-002** (React "Maximum update depth exceeded"). Automation must never click this input.

## 8. Not explored / blocked
- Positive **Internal Movement** (the site has one location; needs a second location on the same site, created in PM Site Details).
- History date-range filter in the Actions panel and the site switch inside the panel ([A] covered 24 Oct).
- Receive booking with a real booking (blocked: no booking link).
- Edit or delete of an activity: no control exists ([A]).

## 9. Observations and defect candidates (none registered yet)
| # | Observation | Proposed |
|---|---|---|
| OBS-INV-1 | Ledger "Submittal" column shows Spec Section No, not Submittal No | Candidate |
| OBS-INV-2 | "Total QTY" is the signed row movement, not a running total | Candidate (label/logic) |
| **OBS-INV-3** | Activity saved with a Submittal and a Schedule that belong to different submittals (UI race + no server check) | **DEF-C candidate, high** (stock attributed to the wrong PO) |
| OBS-INV-4 | Landing grid Inventory value stale after a manual activity until reload | Candidate (stale UI) |
| OBS-INV-5 | Over-receipt message exposes the raw field `scheduled_quantity` | Low (wording) |
| OBS-INV-6 | Receive booking: 500 "Invalid project_id, not found in ProjectMap" on a project without a booking link | Candidate |
| OBS-INV-7 | Upload says 12 available while ledger/location show 13 (after a manual Incoming Load) | Candidate (needs root cause) |
| OBS-INV-8 | Export "Inventory List" contains activities, not the balance list; raw action codes and serial dates | Candidate / Q |
| OBS-INV-9 | No success toast after a manual activity | Low (UX) |
| OBS-INV-10 | QTY with 3 decimals gives the generic "Invalid data provided." | Low (validation message) |
| OBS-INV-11 | Upload template: no Subcontractor column; UoM dropdown empty; Comments optional unlike the manual form | Q |
| SCP-DEF-002 | Date picker freezes the page | **Already registered**, reproduced 2 Nov |

## 10. Product-owner answers (2026-11-02) – rules INV-R1…INV-R4
| # | Rule |
|---|---|
| INV-R1 (Q-INV-2) | A manual Incoming Load **must** count toward the Procurement component's Received QTY and Remaining QTY. Today it doesn't → defect candidate |
| INV-R2 (Q-INV-3) | Export must be the **balance list** (as on screen). Today it's the activity log → OBS-INV-8 is a defect candidate |
| INV-R3 (OBS-INV-7) | The 12 vs 13 difference is probably caused by other movements or incoming loads; keep it as a watch item, not a defect |
| INV-R4 (Q-INV-5) | A second location may be created for Internal Movement tests |
Q-INV-4 (Subcontractor in upload): product owner not sure, so it stays open. Q-INV-1 is answered by PL-R16 (damaged quantity counts as received).

## 10a. Questions
- **Q-INV-1** Should a damaged quantity (Procurement delivery condition) enter stock as Incoming Load? Today all 4 delivered units were added, including 1 damaged.
- **Q-INV-2** Should a manual Incoming Load ("Via Inventory") count toward the Procurement component's Received QTY and Remaining QTY?
- **Q-INV-3** Is Export meant to be the activity log or the balance list?
- **Q-INV-4** Should Subcontractor be part of the upload (it's required in the manual form)?
- **Q-INV-5** May a second location be created on `Site T2 Pmr2-2611011614` (PM Site Details) for Internal Movement tests?
