# Procurement Log Smoke – step-by-step flows

- Spec: `tests/pm-flow/pl-smoke.spec.js`
- Command: `npm run procurement:smoke`
- Run tag: none (read-only suite, no records are created). Catalogue: `PL_SMOKE_SCENARIOS.md`.
- Common preconditions (PL-SMK-001): open the login page, sign in as Project Admin, open Supply Chain Planner (lands on the management dashboard), select project NRVC_Hall, select site "Warehoust _NR" (env `SCP_PL_SITE` / `SCP_DEMO_SITE` can override), then open Procurement Log from the menu.
- Shared data: the suite uses whatever submittals already exist on the project. Forms and panels are only opened and closed; the empty "Add" is used only to show validation; downloads do not change data.

### PL-SMK-001 – Open Procurement Log on NRVC_Hall (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Open the login page | Heading "Welcome To Voyage Control" is shown |
| 2 | Sign in with the Project Admin user | The user's name heading is shown |
| 3 | Open Supply Chain Planner from the platform chooser | URL ends with /management-dashboard |
| 4 | Select project NRVC_Hall | Project is selected |
| 5 | Select site "Warehoust _NR" | Site is selected |
| 6 | Menu › "Procurement Log" | URL contains /procurement-log and the grid shows more than 0 items |

### PL-SMK-002 – Toolbar controls render (smoke)
Precondition: PL-SMK-001 passed.
| # | Action | Expected |
|---|---|---|
| 1 | Look at the toolbar of Procurement Log | Buttons "Add Submittal", "Filters", "Status", "Assign Responsible", "Bulk Delete", "Import", "Export", "Columns" are visible; "Start date" and "End date" boxes hold dd/mm/yyyy values; checkbox "Only my watched" is visible |

### PL-SMK-003 – Grid columns and pagination render (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Read the grid header row | Columns Spec Description, Schedule Id, Material Name, Submittal No, Supplier Name, EPD Exists, Date Required On Site, Status, Source, Actual Delivery Date, Responsible are present |
| 2 | Look below the grid | "Rows per page" text and the "Pagination" navigation are visible |

### PL-SMK-004 – Status filter options (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Status"; read the options; press Escape | Options include Delivered, Not Ordered, Partial Delivery, Ordered, Not Ordered At Risk, Partial Delivery At Risk, Ordered At Risk |

### PL-SMK-005 – Advanced Filter panel opens and clears (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Filters"; click "Add Condition" | "Advanced Filter" panel opens; a "Value" box and a "Remove" button appear |
| 2 | Click "Clear Filter" | The "Advanced Filter" panel closes |

### PL-SMK-006 – Columns panel opens and closes (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Columns"; check the panel; click "Columns" again (Escape does not close it) | "Show / hide columns" panel with "Show all" opens, then closes |

### PL-SMK-007 – Add Submittal form and validation (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Submittal"; click "Add" with all fields empty | Messages: Spec selection no. is required; Spec description is required; Schedule Id is required; Submittal no. is required; Suppliers is required; At least one material is required |
| 2 | Close the "Add Submittal" dialog | Item count is unchanged (nothing created) |

### PL-SMK-008 – Bulk actions need a selection (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Assign Responsible" with no row selected | Toast "Select one or more rows before assigning a Responsible user." |
| 2 | Click "Bulk Delete" with no row selected | Toast "Select one or more rows before deleting." |

### PL-SMK-009 – Row menu actions (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click the last (actions) cell of the first row; read the menu; press Escape | Menu items: Edit, Assign Responsible, Delete, Alert, Flag International |

### PL-SMK-010 – Submittal detail drawer (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click the Spec Description cell of the first row | URL contains ?submittal= (drawer opens) |
| 2 | Look at the drawer; wait for the component table | Labels Spec section no., Spec Description, Material, Submittal no., Required QTY, Received QTY and button "Add Component" are visible; "Other Actions" appears once the table has loaded |

### PL-SMK-011 – Component actions and Audit Trail (smoke)
Precondition: drawer from PL-SMK-010 still open.
| # | Action | Expected |
|---|---|---|
| 1 | Click "Other Actions ▾" on the first component | Menu: Trigger Alert, Update Status, Audit Trail, Delete |
| 2 | Choose "Audit Trail"; then close the panel | Panel "Audit Trail" with columns Date, Edited By, Action, Field, Old Value, New Value |

### PL-SMK-012 – Component view (deliveries) (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click the item cell of the first component row | URL contains ?schedule=; buttons "+ Log Delivery" and "QR Label" visible; columns Location, Item name, Good QTY, Damage QTY, Shortage QTY, Base UOM QTY, Actual Date of Delivery visible |

### PL-SMK-013 – Add Delivery form opens (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click "+ Log Delivery"; check the fields; close the dialog | "Add Delivery" shows Expected Date Of Delivery*, Actual Date Of Delivery, Location*, Item Name*, Required Remaining Qty, QTY* |

### PL-SMK-014 – QR Label dialog (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click "QR Label"; check the dialog; close it | "Submittal QR" dialog with "PNG sticker" and "PDF sheet" buttons and a link of the form /s/<uuid> |

### PL-SMK-015 – Import menu and template downloads (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Menu › "Procurement Log" | Back on the list with items shown |
| 2 | Click "Import" › "Download Template" | A file containing "submittal_upload_template" is downloaded |
| 3 | Click "Import" › "Download Component Template" | A file containing "component_upload_template" is downloaded |

### PL-SMK-016 – Export downloads the report (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Export" | File Submittal_Report_<yyyymmdd>.xlsx is downloaded |

### PL-SMK-017 – Row Alert panel opens (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Press Escape; open /procurement-log directly; click the actions cell of the first row › "Alert"; then Menu › "Procurement Log" | "Add Alert" button and columns Field Type, Condition, Value, Message, Users, Status are visible |

### PL-SMK-018 – Flag International dialog opens (smoke)
| # | Action | Expected |
|---|---|---|
| 1 | Click the actions cell of the first row › "Flag International"; check the dialog; close it | Dialog "Flag as International Shipment" shows Manufacturer Name, Manufacturer Country *, Manufacturer City |
