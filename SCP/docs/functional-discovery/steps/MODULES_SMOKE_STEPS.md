# All Modules Smoke – step-by-step flows

- Spec: `tests/pm-flow/app-smoke.spec.js` (suite "All Modules Smoke")
- Command: `npm run modules:smoke`
- Run tag: none (the suite is read-only and creates no data)
- Catalogues: INV_SCENARIOS, UM_SCENARIOS, OTHER_MODULES_SCENARIOS (FDI), DOC_SCENARIOS, SHP_DISCOVERY_AND_SCENARIOS, DSH_ENT_ANA_DISCOVERY_AND_SCENARIOS
- Preconditions: Project Admin credentials, project NRVC_Hall, a site with at least one Inventory item for the standard test material (the Procurement regression delivers it).
- Shared data: none created. Forms are opened and closed, empty submits only show validation, downloads do not change data. The Inventory Add Activity date input is never clicked (SCP-DEF-002 freezes the tab).
- Navigation: every "open" step uses the left menu first (a menu group is expanded when the page sits under one); if the menu click fails, the page route is opened directly.

## Login

### APP-SMK-00 – Sign in (setup)

| # | Action | Expected |
|---|---|---|
| 1 | Open the login page | Heading "Welcome To Voyage Control" |
| 2 | Enter user name and password, sign in | User name shown as a heading |
| 3 | Platform chooser: open Supply Chain Planner | URL ends with /management-dashboard |
| 4 | Select the project NRVC_Hall | Project selected |
| 5 | Select the test site | Site selected |

If sign-in fails the whole run is aborted.

## Inventory Management

### INV-SMK-01 – Page loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Inventory Management" | Page opens (critical step) |
| 2 | Check toolbar and grid | Search box "Search inventory…", buttons "Receive booking", "Upload", "Export" visible; "N items" greater than 0; columns Category, Material ID, Material Name, Inventory, UOM |

INV-SMK-02 to 08 run only if INV-SMK-01 passed; otherwise they are skipped ("INV-SMK-01 failed").

### INV-SMK-02 – Search by name, ID, category; no match (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Type the test material name in lower case in "Search inventory…" | At least one item; the row with the exact material name is listed |
| 2 | Search "0001" | At least one item |
| 3 | Search "tv" | At least one item |
| 4 | Search "zz-no-such-material-zz" | Item count 0 |
| 5 | Clear the search | Item count returns to the original total |

### INV-SMK-03 – Location filter (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | In the location dropdown choose the first location (not "All locations") | Count line reads "N items · <location>"; then "All locations" is reselected. If the site has no locations this is only noted |

### INV-SMK-04 – Row menu views (smoke)

Search the test material first. For each view below: row "⋮" menu, choose the view, check column headers, press Escape, reopen /inventory-management and search again.

| # | Action | Expected |
|---|---|---|
| 1 | "⋮" › "Actions" | Columns Action, Submittal, Schedule, Item, Location, Date, QTY, Total QTY; texts "Opening Balance" and "Closing Balance" |
| 2 | "⋮" › "Location" | Columns Name, Location Type, QTY |
| 3 | "⋮" › "Submittals" | Columns Spec section no., Submittal No., Spec description, QTY, Received QTY |
| 4 | "⋮" › "UOM" | Columns Stock Keeping Unit, QTY |

### INV-SMK-05 – Add Activity validation (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Row "⋮" › "Actions" › "Add Activity"; click "ADD" with nothing filled | "is required" under Item, Action, From Location, QTY, Comments, Supplier, Subcontractor, Submittal, Schedule (9 messages) |
| 2 | Check "To Location*" is hidden; "Choose Action" › "Internal Movement" | "To Location" field appears |
| 3 | Escape, open /inventory-management | List shows items again (nothing saved) |

### INV-SMK-06 – Upload dialog and template (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Upload" | Dialog "Upload inventory activities"; text "Nothing is saved unless all rows are valid"; dialog "Upload" button disabled |
| 2 | Click "Download template" | File inventory_upload_template….xlsx downloads |
| 3 | Click "Cancel" | Dialog closes |

### INV-SMK-07 – Export (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Export" | File Inventory_Report_<yyyymmdd>.xlsx downloads |

### INV-SMK-08 – Receive booking dialog (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Receive booking" | Text "No bookings ready to receive for this project."; "Receive" disabled |
| 2 | Wait 1.5 s, click "Cancel" | No message "Invalid project_id, not found in ProjectMap" |

Note: OBS-INV-6 (error toast on this dialog).

## User Management and Supplier List

### UM-SMK-01 – User Management loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "User Management" › "User Management" | Page opens (critical step) |
| 2 | Check toolbar and grid | Search box "Search users", buttons "Filter", "Invite Users"; columns Status, Name, Email Address, Associated Organization, Platform Role; at least one user row |

### UM-SMK-02 – User profile panel (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Click the Name cell of the first user row; then Escape | Panel shows "User Profile", Roles, First Name, Last Name, Email, Project Role, Organization Role and buttons "Save", "Remove From Project" |

### UM-SMK-03 – Invite dialog (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Reopen User Management; click "Invite Users" | Options "Manual entry", "From Procore directory"; buttons "Choose Role", "Add Another User", "Cancel"; "Send Invites" disabled. Then click "Cancel" |

### SL-SMK-01 – Supplier List loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "User Management" › "Supplier List" | Page opens (critical step) |
| 2 | Check toolbar, count and columns | Buttons "Add Supplier", "Bulk Map Material to Supplier", "Upload", "Export"; "N suppliers"; columns Supplier ID, Supplier Name, Type, Source, Contact Person, Contact Email, Contact Phone no, Map Material |

### SL-SMK-02 – Add Supplier form (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Supplier"; then "Cancel" | Fields Supplier Name, Line 1, Line 2, Town/City, State/Region, Zipcode, Country, Contact Person, Contact Email, Default Lead Time |

### SL-SMK-03 – Upload menu (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Upload"; then Escape | Menu lists "Supplier List Upload", "Supplier List Download Template", "Supplier Map Upload", "Supplier Map Download Template" |

### SL-SMK-04 – Row menu (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Reopen Supplier List; first row "⋮" menu; then Escape | Items "Edit", "Delete", "Map Material", "Promote to SSO Organisation" |

## First Delivery Inspections

### FDI-SMK-01 – Page loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "First Delivery Inspections" | Page opens (critical step) |
| 2 | Check filters and columns | Columns Material, Supplier, Submittal, Delivery Date, Assigned To, Status, Procore, Actions; at least 4 filter inputs/selects |

## Document Management

Each of DOC-SMK-01 to 05 has an "open" step (menu "Document Management" › page name, critical) and a content step.

### DOC-SMK-01 – All Documents loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Document Management" › "All Documents" | Page opens |
| 2 | Check content | Text "document(s) across this project"; columns Filename, Category, Material, Submittal, Size, Uploaded By, Date, Actions |
| 3 | Check row actions | A "View" action is visible on the rows |

### DOC-SMK-02 – Spec Documents loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Document Management" › "Spec Documents" | Page opens |
| 2 | Check content | Text "up to 60 MB"; columns Filename, Size, Status, Uploaded by, Uploaded, Spec Section No |

### DOC-SMK-03 – PO Validation loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Document Management" › "PO Validation" | Page opens |
| 2 | Check content | Texts "Upload a Purchase Order file", "Supports .xlsx, .xls, .pdf"; file input present; "Back" button visible |

### DOC-SMK-04 – BOM Validation loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Document Management" › "BOM Validation" | Page opens |
| 2 | Check content | File input present; "Back" button visible |

### DOC-SMK-05 – EPD Report loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Document Management" › "EPD Report" | Page opens |
| 2 | Check content | Text "Scan Procore for EPDs"; columns Submittal, Product, Manufacturer, GWP A1-A3, GWP Total, Status, Actions |

## Shipments

### SHP-SMK-01 – International Shipments loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "International Shipments" | Page opens (critical step) |
| 2 | Wait for the "Total International" tile to show the data (up to 90 s); note if a "Loading international shipments..." text is still shown | Tabs Risk Dashboard, Delay Alerts, Flag & Review, Shipments; tiles Total International, At Risk, Not Yet Ordered, In Transit, Delivered; columns Submittal, Material, Manufacturer, Country, Required Date, Status, Risk |

### SHP-SMK-02 – Enterprise Shipments loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Enterprise" › "Enterprise Shipments" | Page opens (critical step) |
| 2 | Check content | "Active Delay Alerts"; columns Project, Submittal, Manufacturer, Origin, Destination, Shipping Line, Status, ETA, Risk; "At-risk only" filter |

### SHP-SMK-03 – Log shipment form (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Log Shipment"; then "Cancel" | Fields Project, Submittal, Manufacturer name, Manufacturer country, Container #, Bill of lading, Shipping line, Vessel, Port of origin, Port of destination; button "Log shipment" |

## Management Dashboard

### DSH-SMK-01 – Dashboard loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Management Dashboard" | Page opens (critical step) |
| 2 | Check content | "Your watched materials", "View in Procurement Log →", "Manage assignments"; tabs Alerts, Notifications, Tasks each followed by a count |

### DSH-SMK-02 – Each tab lists rows (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Click tab "Alerts" | Columns Description, Created At; at least one row |
| 2 | Click tab "Notifications" | Columns Description, Created At; at least one row |
| 3 | Click tab "Tasks" | Columns Description, Created At, Status; at least one row |

## Enterprise

Each scenario: menu "Enterprise" › page (critical), then check the texts.

### ENT-SMK-01 – Enterprise View loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Enterprise" › "Enterprise View" | Page opens |
| 2 | Check sections | "Download CSV", "Supplier", "Spend" |

### ENT-SMK-02 – Supplier Inbox loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Enterprise" › "Supplier Inbox" | Page opens |
| 2 | Check sections | "Unconfirmed Lead Times", "Overdue Items", "Deliveries to Schedule", "Pending Pre-Shipping Checklists" |

### ENT-SMK-03 – Supplier Performance loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Enterprise" › "Supplier Performance" | Page opens |
| 2 | Check sections | "Deliveries by month", "Project", "Supplier" |

### ENT-SMK-04 – Lead Time Benchmarks loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Enterprise" › "Lead Time Benchmarks" | Page opens |
| 2 | Check sections | "Your Delivery Performance", "Lead Time Comparison by Category" |

## Analytics

Each scenario: menu "Analytics" › page (critical; the URL path is recorded), then check the content. The URL is asserted except for TOV Analytics.

### ANA-SMK-01 – Aggregate Stats loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Analytics" › "Aggregate Stats" | URL /aggregate-stats |
| 2 | Check content | "Changes per week", "Top editors" |

### ANA-SMK-02 – Lead Time Analysis loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Analytics" › "Lead Time Analysis" | URL /lead-time-analysis |
| 2 | Check content | "Lead Time Comparison by Category" |

### ANA-SMK-03 – Supply Chain Intelligence loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Analytics" › "Supply Chain Intelligence" | URL /supply-chain-intelligence |
| 2 | Check content | "Active disruptions", "Risk heatmap" |

### ANA-SMK-04 – Emissions Report loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Analytics" › "Emissions Report" | URL /emissions-report |
| 2 | Check content | "Emissions Summary", "Export CSV" |

### ANA-SMK-05 – Inventory Reports loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Analytics" › "Inventory Reports" | URL /inventory-reports |
| 2 | Check content | Text "30d" |

### ANA-SMK-06 – Status Report loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Analytics" › "Status Report" | URL /status-report |
| 2 | Check content | Text "Generate" |

### ANA-SMK-07 – SubContractor Issues loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Analytics" › "SubContractor Issues" | URL /subcontractor-issues |
| 2 | Check content | "Delivery Impacted" |

### ANA-SMK-08 – Supplier Issues loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Analytics" › "Supplier Issues" | URL /supplier-issues |
| 2 | Check content | "Supplier Delay Summary" |

### ANA-SMK-09 – TOV Analytics loads (smoke)

| # | Action | Expected |
|---|---|---|
| 1 | Menu "Analytics" › "TOV Analytics" | Page opens; the URL path is only recorded (as observed it shows the Supplier Issues page) |
| 2 | Check content | "Supplier Delay Summary" |
