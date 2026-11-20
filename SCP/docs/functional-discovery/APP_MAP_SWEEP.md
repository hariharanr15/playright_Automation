# SCP Application Map – Read-only Sweep (2026-11-02)

NRVC_Hall, Project Admin, staging. Each page was opened from the menu and only its headings, buttons, columns and inputs were read; no forms were opened. Modules already covered in detail: Project Management, Procurement Log, Inventory Management (see their discovery docs).

| Menu | Route | Main content (headings / buttons / columns) | Rows seen |
|---|---|---|---|
| Management Dashboard | `/management-dashboard` | "Your watched materials"; tabs Dashboard / Alerts / Notifications / Tasks; buttons `View in Procurement Log →`, `Manage assignments`; tables by Material Category and Supplier (Open, On-time, LT Var, Avg Lead Time, Delta vs Platform, Confirmed %, Spend, Alerts) | 61 |
| Enterprise > Enterprise View | `/enterprise-view` | Date range; `Download CSV`; Supplier / Spend / % of total | 61 |
| Enterprise > Supplier Inbox | `/supplier-inbox` | Sections Unconfirmed Lead Times, Overdue Items, Deliveries to Schedule, Pending Pre-Shipping Checklists; filters (submittal e.g. SUB-3307, From/To dates) | – |
| Enterprise > Supplier Performance | `/supplier-performance` | Deliveries by month (6/12 months); Project-wise and Supplier-wise summaries (On-time, Active, Overdue, LT confirmed, Avg LT, Deliveries 90d) | 63 |
| Enterprise > Lead Time Benchmarks | `/lead-time-benchmarks` | Your Delivery Performance; Lead Time Comparison by Category (Your / Client / Platform / Industry avg, Δ vs Platform, Status, ranges, Projects, Active Alerts) | 18 |
| Enterprise > Enterprise Shipments | `/enterprise-shipments` | Active Delay Alerts; `+ Log Shipment`, `Edit`, `Open`; search; Project, Submittal, Manufacturer, Origin, Destination, Shipping Line, Status, ETA, Risk | 21 |
| First Delivery Inspections | `/first-delivery-inspections` | Filters (3 selects, Inspector email, date range); #, Material, Supplier, Submittal, Delivery Date, Assigned To, Status, Procore, Actions | 1 |
| International Shipments | `/international-shipments` | `+ Log Shipment`; tabs Risk Dashboard / Delay Alerts / Flag & Review / Shipments; KPI tiles; Submittal, Material, Manufacturer, Country, Transit Est., Required Date, Status, Risk (seen in Procurement discovery) | – (loads slowly) |
| User Management > User Management | `/user-management` | User Profile / Roles; `Filter`, `Invite Users`, `Save`, `Remove From Project`; Status, Name, Email, Associated Organization, Platform Role | 1 |
| User Management > Supplier List | `/supplier-list` | `Add Supplier`, `Bulk Map Material to Supplier`, `Upload`, `Export`; Supplier ID, Name, Type, Source, Contact Person/Email/Phone, Map Material | 25 |
| Document Management > All Documents | `/all-documents` | Search, category filter; Filename, Category, Material, Submittal, Size, Uploaded By, Date, Actions (View / Download); pagination | 25 |
| Document Management > Spec Documents | `/spec-documents` | File upload; Filename, Size, Status, Uploaded by, Uploaded, Spec Section No; `Edit Spec Section No`, `Download`, `Send to TheLink`, `Delete` | 1 |
| Document Management > PO Validation | `/po-validation` | File upload + `Back` (related to Q-PL-13 PO PDF line items) | – |
| Document Management > BOM Validation | `/bom-validation` | File upload + `Back` | – |
| Document Management > EPD Report | `/epd-report` | Upload EPD (submittal select + file); `Scan Procore for EPDs`; Submittal, Product, Manufacturer, GWP A1-A3, GWP Total, Status, Actions | 2 |
| Analytics > Aggregate Stats | `/aggregate-stats` | Date range; Changes per week, Most-changed schedules, Top editors; `Export`; Project, Submittals, Materials, Locations, Suppliers, Users | 1 |
| Analytics > Lead Time Analysis | `/lead-time-analysis` | **Same content as Enterprise > Lead Time Benchmarks** | 18 |
| Analytics > Supply Chain Intelligence | `/supply-chain-intelligence` | Supply chain tracker; Active disruptions (149), Project risk profiles, Risk heatmap, All active disruptions (246); 7d/30d/90d, Refresh, category filters, Dismiss / Dismiss all | – |
| Analytics > Emissions Report | `/emissions-report` | Emissions Summary; Export CSV / PDF, Auto-Generate Emissions; By Submittal / Subcontractor / Trade; Submittal, Material, Route, CO2 (kg), Legs | 21 |
| Analytics > Inventory Reports | `/inventory-reports` | 7d/30d/60d/90d, Filter materials (no headings rendered) | – |
| Analytics > Status Report | `/status-report` | Date range; Supplier, Generate; Submittal count by status, component quantities by status, lead-time changes | 61 |
| Analytics > SubContractor Issues | `/subcontractor-issues` | Date range, search, Export; Subcontractor, Project, Delays in Raising/Confirming PO, PO Schedule Impact, Delays in Booking, Delivery Impacted, Over-Deliveries | 31 |
| Analytics > Supplier Issues | `/supplier-issues` | Supplier Delay Summary, Project-wise distribution, Delivery Performance, Top 5 projects, Issue Heatmap; Export | 30 |
| Analytics > TOV Analytics | **`/supplier-issues`** | **Opens Supplier Issues, not a TOV page** (OBS-APP-1) | 30 |

## Rule APP-R1 (product owner, 2026-11-02)
Analytics reports have no detailed data requirement. Test them **as they are**: the page loads, its filters, exports and tables work, and values stay consistent within the page and with their source module where an obvious link exists (e.g. counts from the Procurement Log). Observed behaviour is the baseline; no business-rule oracle is invented. OBS-APP-1…3 stay as questions, not defects.

## Observations
- **OBS-APP-1:** the TOV Analytics menu item opens `/supplier-issues` (the same page as Supplier Issues).
- **OBS-APP-2:** Analytics > Lead Time Analysis shows exactly the same content as Enterprise > Lead Time Benchmarks (intended?).
- **OBS-APP-3:** Supplier Issues uses "Subcontractor" as its first column header (same columns as SubContractor Issues).
- Collapsible menu groups close after each navigation, so automation must re-expand the parent before clicking a child.
- The sweep logged 8 console errors on the Analytics pages (not analysed).

## Suggested order for the next detailed discovery
First Delivery Inspections → Document Management (PO/BOM/EPD/Spec) → User Management & Supplier List → International / Enterprise Shipments → Management Dashboard (alerts/tasks) → Enterprise → Analytics.
