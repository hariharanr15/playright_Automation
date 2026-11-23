# Procurement Log Regression 2 – step-by-step flows

- Spec file: `tests/pm-flow/pl-regression-2.spec.js`
- Command: `npm run procurement:regression2`
- Scenario catalogue: `docs/functional-discovery/PL_REGRESSION_SCENARIOS.md` (observed "O" scenarios not covered by part 1)
- Run tag: `PLS` + `yyMMddHHmm` of the run start (for example `PLS2611061030`). All data below is named with this tag, shown as `<RUN>`.
- Setup (scenario PL-REG2-SETUP): open the login page, sign in as Project Admin, open Supply Chain Planner, select project NRVC_Hall and the configured site (default "Warehoust _NR"), open Procurement Log and create three run submittals.
- Shared data: supplier "LG" and material "43 Inches" (overridable by environment variables); second material "1.2L Kappa Engine". Run submittals: E (edit / flag / alert), N (components / new material), X (row delete), I (import) and M (multi material). Scenarios run in order and several rely on the previous one. Only records created by this run are deleted.

### PL-REG2-SETUP – Sign in on NRVC_Hall (Setup)
| # | Action | Expected |
|---|---|---|
| 1 | Open the login page | Heading "Welcome To Voyage Control" is shown |
| 2 | Enter the Project Admin user name and password and sign in | The user name heading is shown |
| 3 | Open Supply Chain Planner from the platform chooser | URL ends with /management-dashboard |
| 4 | Select project NRVC_Hall | Project selected |
| 5 | Select the site (default "Warehoust _NR") | Site selected |
| 6 | Left menu › "Procurement Log" | Procurement Log opens and shows items |
| 7 | "Add Submittal" three times for E, N and X (Spec `<RUN>-SPEC-E/N/X`, description, schedule id, submittal no `<RUN>-SUB-E/N/X`, supplier LG, material 43 Inches), click "Add" | Toast "Submittal added successfully" each time |

Note: the run tag is recorded as an observation.

### PL-REG-LST-04 – Search runs on Enter and ignores case (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | In "Search submittals…" type the run tag in lower case, press Enter | Exactly 3 items are listed |

### PL-REG-LST-05 – Clearing the search restores the list (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Clear the search box, press Enter | More than 3 items are listed |

### PL-REG-LST-06 – Status filter shows only the ticked status (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Status", tick "Delivered", close the list | At least one row; every row has Status "Delivered"; button reads "Status1" |
| 2 | Click "Status1", untick "Delivered", close the list | Filter removed |

### PL-REG-LST-07 – Advanced Filter Contains ignores case (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Filters" › "Add Condition": field "Supplier Name", operator "Contains", value "LG" in upper case, "Apply Filter" | At least one item listed; note the count |
| 2 | "Clear Filter"; repeat the same condition with the value in lower case, "Apply Filter" | Same item count as step 1 |

### PL-REG-LST-08 – Clear Filter closes the panel and restores the list (Positive)
Precondition: the filter from PL-REG-LST-07 is applied.

| # | Action | Expected |
|---|---|---|
| 1 | Click "Clear Filter" | "Advanced Filter" panel closes; more than 3 items listed |

### PL-REG-LST-12 – Hide and show a column (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Columns"; untick "Source"; check the grid; click "Show all"; close "Columns" | Column "Source" disappears, then reappears after "Show all" |

### PL-REG-LST-15 – Rows per page 100 shows all rows on one page (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Open the rows-per-page selector at the bottom and choose "100" | Rows shown equal the item count (up to 100) |

### PL-REG-LST-16 – Filters reset on reload; project kept (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Search the run tag; reload the browser page | List is unfiltered (more than 3 items); search box is empty; project button still shows the project name |

### PL-REG-ADD-04 – Materials need a supplier first (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Submittal"; click "Choose Materials" without a supplier; press Escape | Dropdown shows "No options." |

### PL-REG-ADD-05 – Supplier filters materials (searchable) (Positive)
Precondition: the "Add Submittal" dialog from PL-REG-ADD-04 is still open.

| # | Action | Expected |
|---|---|---|
| 1 | "Choose Suppliers" › "LG"; click "Choose Materials"; press Escape; close the dialog | "Search options" box shown and material "43 Inches" is offered |

### PL-REG-ADD-07 – Skip for Now stores "Pending" (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Submittal"; click the first "Skip for Now" (Spec selection no.); close the dialog | The field shows "Pending" |

### PL-REG-ADD-06 – Multiple materials, first picked is primary (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Submittal": run submittal M (`<RUN>-SUB-M`), supplier LG, materials "43 Inches" and "1.2L Kappa Engine", click "Add" | Toast "Submittal added successfully" |
| 2 | Search `<RUN>-SUB-M`; open the submittal; return to Procurement Log | Row shows "43 Inches +1"; "(primary)" is next to "43 Inches" |

### PL-REG-EDT-01 – Edit submittal description (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Search `<RUN>-SUB-E`; row action menu (last cell) › "Edit"; change the description to the old text plus " edited"; click "Update"; reopen Procurement Log and search again | Edited description is shown in the row (messages after Update are recorded) |

### PL-REG-EDT-06 – Flag International requires a country (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Row action menu › "Flag International"; leave country empty; click "Flag" | Toast "Manufacturer country is required." |

### PL-REG-EDT-05 – Flag International (Positive)
Precondition: the Flag International dialog from PL-REG-EDT-06 is open.

| # | Action | Expected |
|---|---|---|
| 1 | Enter country "South Korea" and city "Seoul"; click "Flag" | Toast "Submittal flagged as international shipment." |

### PL-REG-EDT-08 – Row Delete removes a run-created submittal (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Search `<RUN>-SUB-X` (1 item); row action menu › "Delete"; read the confirmation; click "Delete" | Confirmation "1 submittal(s) will be deleted. Are you sure you want to proceed?"; toast "1 record(s) deleted."; 0 items listed |

### PL-REG-ALR-01 – Create an alert rule (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Search `<RUN>-SUB-E`; row action menu › "Alert" › "Add Alert"; "Choose Field" first option; condition ">="; value 5; message `<RUN> alert`; click "Submit" | Toast "Alert created successfully!"; alert message appears in the table |
| 2 | Left menu › "Procurement Log" | Back on the list |

### PL-REG-CMP-03 – Component without PO is Not Ordered (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Search `<RUN>-SUB-N`; click its description cell | Submittal drawer opens with "Add Component" |
| 2 | "Add Component": Date Req. on Site in 28 days, QTY 10, Value 500, no PO; click "ADD" | Toast "Schedule added successfully!" |
| 3 | Read the component status cell | Status is "Not Ordered" |

Note: the next seven scenarios run only if this one passes; otherwise they are skipped with "No Not Ordered component".

### PL-REG-CMP-15 – Shift ROJ: Apply disabled until Preview (Negative)
Precondition: the drawer of submittal N with its component is open.

| # | Action | Expected |
|---|---|---|
| 1 | Click "Select not-confirmed" | "1 component selected" |
| 2 | Click "Shift ROJ Dates"; enter Offset (days) 7; do not preview | "Apply" button is disabled |

### PL-REG-CMP-13 – Shift ROJ +7 calendar days with preview (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Basis "Calendar days"; click "Preview"; click "Apply (1)" | "1 will move · 0 skipped"; toast "Required-on-site date updated on 1 component."; row shows the date 35 days from today |

### PL-REG-CMP-12 – Bulk Set Lead Time with confirmation (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Select not-confirmed"; "Set Lead Time"; Lead time (weeks) 2; tick "Mark lead time as confirmed"; click "Apply" | Toast "Lead time updated on 1 component."; row shows "Confirmed" |

### PL-REG-CMP-17 – Upload PO File without a file (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Expand the component row; click "Upload PO File"; click "Upload" with no file | Toast "Missing file." |

### PL-REG-CMP-16 – Upload PO File (PDF) (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Upload PO File"; select a small generated PDF (`<RUN>-po.pdf`) through "Click here to select the file"; click "Upload" | Toast "File uploaded successfully!"; the file name is shown |

### PL-REG-DLV-02 – Over-delivery is blocked (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Click the component material cell; "+ Log Delivery": date today, first location, item "43 Inches", QTY 20 (component QTY is 10); click "Add"; close the dialog | Error "Quantity exceeds available quantity" |

### PL-REG-CMP-18 – Delete component (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Close any dialog; reload the submittal page without the schedule parameter; component row "Other Actions ▾" › "Delete"; confirm "Delete" | No component rows remain |

### PL-REG-MAT-01 – Create a new material from the drawer (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Open Procurement Log; search `<RUN>-SUB-N`; open it; click "New material"; Category first option; name `<RUN> Material`; Unit "Pieces"; Lead Time (Weeks) 1; click "Add" | Toast "Material added to submittal." |

### PL-REG-MAT-04 – Remove a non-primary material (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | In the "Materials:" list click "×" on the last material chip | Toast "Material removed from submittal" |

### PL-REG-IMP-02 – Import with Source empty fails as a whole (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Open Procurement Log; "Import" › "Import Submittal"; choose an xlsx with the full template header and one row with empty Source; click "Upload" | Toast "All rows failed validation, missing fields, or invalid data types." |

### PL-REG-IMP-01 – Import a submittal (Source = Manual) (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Open Procurement Log; "Import" › "Import Submittal"; choose an xlsx with one row (`<RUN>-SUB-I`, Source "Manual"); click "Upload"; search `<RUN>-SUB-I` | Exactly 1 imported item is listed (messages after upload are recorded) |

### PL-REG-IMP-08 – Export follows the current filter (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Export" while the list is searched | A file downloads and is not empty |

### Skipped scenarios
PL-REG-CMP-15, 13, 12, 17, 16, PL-REG-DLV-02 and PL-REG-CMP-18 are not run when PL-REG-CMP-03 fails ("No Not Ordered component").
