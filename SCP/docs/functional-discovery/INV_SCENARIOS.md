# Inventory Management – Smoke and Regression Scenarios (Draft for Review)

> **Step-by-step flows (Action → Expected, matching the automated steps):** [MODULES_SMOKE_STEPS.md](steps/MODULES_SMOKE_STEPS.md), [INV_REGRESSION_STEPS.md](steps/INV_REGRESSION_STEPS.md)

Source: [INVENTORY_FUNCTIONAL_DISCOVERY.md](INVENTORY_FUNCTIONAL_DISCOVERY.md). Impact: **R** read-only · **M** mutates (approved on NRVC_Hall). Ev.: **O** observed 2026-11-02 · **A** 24 Oct automation · **I** inferred · **KD** known defect.

**Prerequisites:** Project Admin on NRVC_Hall. A run material with stock is created through the Procurement delivery → GRN flow ([PL_REGRESSION_SCENARIOS.md](PL_REGRESSION_SCENARIOS.md) §5). **Never click the Add Activity date input** (SCP-DEF-002 freezes the tab). After choosing a Submittal, wait for the Schedule list to reload before picking a schedule.

## Smoke (read-only)
| ID | Title | Expected | Ev. |
|---|---|---|---|
| INV-SMK-01 | Page loads | `/inventory-management`; location select, `Search inventory…`, `N items`, Receive booking / Upload / Export; columns Category, Material ID, Material Name, Inventory, UOM | O |
| INV-SMK-02 | Search by name, ID, category (case ignored); no match | Live results; `0 items` on no match; clearing restores the list | O |
| INV-SMK-03 | Location filter | Only materials with stock at that location; label `N item · <location>` | O |
| INV-SMK-04 | Row menu views | Actions (opening/closing balance + ledger), Location, Submittals, UOM render with their columns | O |
| INV-SMK-05 | Add Activity validation | Empty ADD gives 9 "… is required" messages; To Location appears only for Internal Movement | O |
| INV-SMK-06 | Upload dialog and template | Instructions text; template has sheets `_Lists`, `Inventory Template` (12 columns), `Instructions` | O |
| INV-SMK-07 | Export | `Inventory_Report_<date>.xlsx` downloads | O |
| INV-SMK-08 | Receive booking dialog | "No bookings ready to receive for this project."; Receive disabled; no error toast (today: 500 toast, OBS-INV-6) | O |

## Regression
| ID | Title | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|
| INV-REG-01 | GRN creates Incoming Load | M | After the Procurement GRN → ledger `Incoming Load` = delivered QTY; closing balance updated | O |
| INV-REG-02 | Issue To Construction | M | QTY 2 → closing −2; row signed −2 | O |
| INV-REG-03 | Loss | M | QTY 1 → closing −1 | O |
| INV-REG-04 | Return reduces stock and writes back to Procurement | M | QTY 1 → closing −1; Procurement component gets a "Return" row with Returned QTY 1 | O |
| INV-REG-05 | Manual Incoming on a partial schedule | M | QTY 1 accepted; Procurement gets a "Via Inventory" delivery row | O |
| INV-REG-06 | Incoming on a fully delivered schedule rejected | M | "Cannot add this activity, scheduled_quantity required:0.00 …"; stock unchanged | O |
| INV-REG-07 | Overdraw rejected | M | "Not enough stock at <loc>: only N … available, M requested." | O |
| INV-REG-08 | QTY 0 / negative | M | "Quantity cannot be empty or zero or less" | O |
| INV-REG-09 | QTY with 3 decimals | M | Rejected with a clear 2-decimal message (today "Invalid data provided.") | O |
| INV-REG-10 | Internal Movement same location | M | "From Location and To Location must be different." | O |
| INV-REG-11 | Internal Movement between two locations | M | Source −Q, destination +Q, total unchanged (needs a 2nd location, Q-INV-5) | A/I |
| INV-REG-12 | Available stock hint | R | "Available at <loc>: N <uom>" equals the closing balance | O |
| INV-REG-13 | Pickers filtered by material | R | Supplier = suppliers mapped to the material; Submittal = submittals containing it; Schedule = lines of that submittal | O |
| INV-REG-14 | Schedule must match the submittal | M | Activity saved with the selected submittal's schedule only | **KD SCP-DEF-045** |
| INV-REG-15 | Grid refreshes after an activity | M | Landing Inventory value updates without reload (today stale, OBS-INV-4) | O |
| INV-REG-16 | Upload all-or-nothing | M | Valid + overdraw rows → "The upload failed. Nothing was saved."; error file rows `Valid (not saved)` / `Error` with reason; stock unchanged | O |
| INV-REG-17 | Upload valid file | M | Rows applied top to bottom; toast; ledger rows added; grid refreshed | O |
| INV-REG-18 | Upload available stock matches the ledger | M | The error file's "available" equals the ledger closing (today 12 vs 13, OBS-INV-7) | O |
| INV-REG-19 | Upload optional columns | M | Blank Comments / Supplier / UoM accepted; supplier defaults to the submittal's | O |
| INV-REG-20 | Ledger columns | R | Submittal column shows Submittal No (today Spec No, OBS-INV-1); Total QTY meaning confirmed (OBS-INV-2) | O |
| INV-REG-21 | Damaged units counted as received | M | Incoming Load = delivered QTY incl. damaged (PL-R16) | O |
| INV-REG-22 | Export content | R | Matches the agreed content (activities vs balances, Q-INV-3); readable action and date | O |
| INV-REG-23 | Site isolation | R | Switching site shows that site's stock only | A |
| INV-REG-24 | History date filter inclusive | R | Same-day range lists that day's activities | A |
| INV-REG-25 | Date picker | R | Selecting a date works without freezing | **KD SCP-DEF-002** |

Totals: 8 smoke + 25 regression. Known defects: SCP-DEF-002, SCP-DEF-045.
