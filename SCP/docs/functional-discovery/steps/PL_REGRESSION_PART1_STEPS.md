# Procurement Log Regression (part 1) – step-by-step flows

- Spec: `tests/pm-flow/pl-regression.spec.js`
- Command: `npm run procurement:regression`
- Run tag: `PLR` + yymmddhhmm of the run start (for example PLR2611061030). Records: submittal A `<tag>-SUB-A` (description "<tag> submittal A", spec `<tag>-SPEC-A`), C (same number in lower case, other material), D1 and D2 (descriptions "<tag> delete 1/2"). Schedule Ids are digit-only timestamps.
- Common preconditions (PL-REG-SETUP): open the login page, sign in as Project Admin, open Supply Chain Planner, select project NRVC_Hall, select site "Warehoust _NR" (env `SCP_PL_SITE`), open Procurement Log.
- Shared data: default supplier "LG" and material "43 Inches" (env `SCP_PL_SUPPLIER`, `SCP_PL_MATERIAL`); second material "1.2L Kappa Engine" (`SCP_PL_MATERIAL_2`). The suite creates run-tagged records only and deletes only records it created (D1, D2). Scenarios run in order and later ones reuse submittal A. Known defects are reported through the signatures in `config/scp-known-defects.js`. Catalogue: `PL_REGRESSION_SCENARIOS.md`.

### PL-REG-SETUP – Sign in on NRVC_Hall (Setup)
| # | Action | Expected |
|---|---|---|
| 1 | Open the login page | Heading "Welcome To Voyage Control" |
| 2 | Sign in with the Project Admin user | User name heading is shown |
| 3 | Open Supply Chain Planner | URL ends with /management-dashboard |
| 4 | Select project NRVC_Hall, then site "Warehoust _NR" | Project and site selected |
| 5 | Menu › "Procurement Log" | List opens with more than 0 items (the run tag is noted in the report) |

### PL-REG-LST-01 – Default date range is today − 1 month → today (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Look at the "Start date" and "End date" boxes | End date is today; Start date is one month earlier (dd/mm/yyyy) |

### PL-REG-LST-13 – Sorting by Submittal No is ascending on first click (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click the "Submittal No" column header once | Rows are sorted ascending by Submittal No |

### PL-REG-ADD-03 – Schedule Id accepts digits only (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Submittal"; fill spec, description, Schedule Id "ABC-1", number, supplier LG, material; click "Add" | Message "Only numbers are allowed"; then close the dialog |

### PL-REG-ADD-01 – Create a submittal (supplier + material) (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Submittal"; fill submittal A with a digit Schedule Id, supplier LG, material "43 Inches"; click "Add" | Toast "Submittal added successfully" |
| 2 | Note the item count, then search the submittal number | Count rises by 1; the row is listed with Source "Manual" |

If this scenario does not pass, the rest of the suite is aborted.

### PL-REG-ADD-08 – Duplicate Submittal No + Material rejected (case and spaces ignored) (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Submittal" with A's number in lower case with surrounding spaces, same material, other spec and Schedule Id; click "Add" | Toast "A submittal already exists for Submittal No…"; close the dialog |

### PL-REG-ADD-09 – Same Submittal No with a different material is allowed (PL-R3) (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Submittal" C: A's number in lower case, material "1.2L Kappa Engine"; click "Add" | Toast "Submittal added successfully" |

### PL-REG-EDT-02 – Edit cannot create a duplicate Submittal No + Material (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Search submittal C; row actions › "Edit"; deselect its material, select "43 Inches" (A's material); click "Update" | No "Submittal updated successfully" toast appears; close the dialog |

Note: if the update is accepted, the step fails with "Edit Submittal accepted a duplicate Submittal No and Material" (known-defect signature in `config/scp-known-defects.js`).

### PL-REG-CMP-01 – Add Component requires date and quantity (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Search A's number and click its Spec Description cell | Drawer opens (URL has ?submittal=, "Add Component" visible) |
| 2 | Click "Add Component", then "ADD" with empty fields | Messages "Date Req. on Site is required" and "Quantity is required"; close the dialog |

### PL-REG-CMP-02 – Component with PO is Ordered; Expected = PO date + lead time (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Component": Date Req. on Site today + 28 days, QTY 10, Value 1000, PO no. `<tag>-PO-A`, PO Date today (choose a Sub Material if the form asks); click "ADD" | Toast "Schedule added successfully!" |
| 2 | Look at the component row | Status "Ordered"; Expected Delivery = today + 7 days (lead time 1) |

If this scenario does not pass, the suite stops before the delivery scenarios.

### PL-REG-CMP-06 – Lead Time update moves Expected Delivery (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Component row › "Lead Time": enter 3, tick the checkbox, click "Submit" | Expected Delivery = today + 21 days and the row shows "Confirmed" |

### PL-REG-CMP-08 – Update Status to Delivered shows on component and submittal (PL-R13) (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Component row › "Other Actions ▾" › "Update Status": choose "Delivered", note `<tag> status`, click "ADD" | Component Status becomes "Delivered" |

Note: if it does not change, the step fails with "Update Status to Delivered did not change the component status" (known-defect signature).

### PL-REG-CMP-10 – Trigger Alert sends the notification (PL-R1/PL-R14) (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Component row › "Other Actions ▾" › "Trigger Alert"; "Send Notification" opens; click "Send" | Toast "Notification sent successfully" |

### PL-REG-DLV-13 – Partial delivery 4 of 10 → Partial Delivery (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Open the component view; "+ Log Delivery": today, first location, item "43 Inches", QTY 4. On the delivery row: pre-shipping checklist (fill answers, every Y/N = YES, note, "Confirm Checklist"); approve the checklist; reload; edit the delivery to set the Actual Date; shipping info (mode "Other"); delivery conditions Good 3, Damage 1; "Generate GRN" | Toasts "Shipping Details updated successfully!", "Checklist Generated Successfully!", "Delivery Conditions updated successfully!", "GRN Generated Successfully!" |
| 2 | Reload the drawer without ?schedule= | Component Status is "Partial Delivery" |
| 3 | Check the Shortage QTY shown in Delivery Conditions (PL-REG-DLV-14) | Shortage is 0 (calculated from the delivered quantity) |

Note: PL-REG-DLV-14 – error "Shortage QTY was calculated from the component quantity (… instead of 0)" is a known-defect signature. The report also records the shortage value shown.

### PL-REG-DLV-11 – Remaining 6 delivered → Delivered (Positive)
Precondition: PL-REG-DLV-13 Passed or Known Defect; otherwise skipped ("Partial delivery did not complete").
| # | Action | Expected |
|---|---|---|
| 1 | Component view › "+ Log Delivery" QTY 6, then the same checklist → approve → reload → actual date → shipping → conditions (Good 6, Damage 0) → "Generate GRN" chain | GRN generated |
| 2 | Reload the drawer without ?schedule= | Component Status is "Delivered" |

### PL-REG-DLV-12 – Delivered row shows its Actual Delivery Date (PL-R6) (Positive)
Precondition: PL-REG-DLV-11 passed. Otherwise skipped ("Submittal was not fully delivered", or "No delivered submittal" when the partial delivery failed).
| # | Action | Expected |
|---|---|---|
| 1 | Menu › "Procurement Log"; search A's number; read the "Actual Delivery Date" cell of A's row | Cell holds a date (not empty or "-") |

Note: error "Delivered submittal has no Actual Delivery Date in the Procurement Log" is a known-defect signature.

### PL-REG-EDT-03 – Assign Responsible on a row (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Actions cell of A's row › "Assign Responsible" › "Choose user": pick the signed-in user; click "Assign" | Toast "Responsible user assigned." |

### PL-REG-EDT-10 – Bulk Delete removes two run-created submittals (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Submittal" for D1, then D2 | Each shows toast "Submittal added successfully" |
| 2 | Search "<tag> delete"; tick both rows; click "Bulk Delete"; click "Delete" | Count is 2; prompt "2 submittal(s) will be deleted. Are you sure you want to proceed?"; toast "2 record(s) deleted."; 0 items remain |
