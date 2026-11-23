# Shipments (International + Enterprise) – Discovery and Scenarios (SCP Staging)

> **Step-by-step flows (Action → Expected, matching the automated steps):** [MODULES_SMOKE_STEPS.md](steps/MODULES_SMOKE_STEPS.md), [MODULES_REGRESSION_STEPS.md](steps/MODULES_REGRESSION_STEPS.md)

| Item | Value |
|---|---|
| Date / project / role | 2026-11-02 · `NRVC_Hall` · Project Admin |
| Run records | Shipment for `PLD1102-SUB-07` (LG · South Korea, Busan → Chennai, Maersk); PLD1102-SUB-01 flagged from Procurement |

## 1. Discovery [O]
**International Shipments (`/international-shipments`)** – loads slowly ("Loading international shipments...", up to ~60 s). `+ Log Shipment`; tabs Risk Dashboard / Delay Alerts / Flag & Review / Shipments; tiles Total International, At Risk, Not Yet Ordered, In Transit, Delivered, Delay Alerts. Table Submittal, Material, Manufacturer, Country, Transit Est., Required Date, Status (select: Pending Order, Ordered, In Production, Ready to Ship, Shipped, In Transit, At Port, Customs, Delivered), Risk (On Track …).
- Changing Status to `In Transit` saves **with no message** (OBS-SHP-2), stays after reload, updates the In Transit tile, and shows in Enterprise Shipments.
- Required Date shows `-` for submittals whose component has a date (OBS-PL-19).

**Enterprise Shipments (`/enterprise-shipments`)** – Active Delay Alerts cards (e.g. "Port congestion at Shanghai causing 7-14 day delays", HIGH, 17 affected); search, destination filter, At-risk only; table Project, Submittal, Manufacturer, Origin, Destination, Shipping Line, Status, ETA, Risk; `Edit`, `Open`.
- **Log new shipment**: Project (`— Choose a project —`, cross-project), Submittal* ("Pick a project first"; options `<submittal no> — <description>`), Manufacturer name*, Manufacturer country*, Container #, Bill of lading, Shipping line, Vessel, Port of origin, Port of destination; Cancel / Log shipment. Empty submit → "Pick a project first". Valid → "Shipment logged."; new row with Status `Pending Order` although the submittal is already Partial Delivery (OBS-SHP-1), ETA `—`.
- **Edit** = "Edit shipping details: Update the container, bill of lading, or shipping line for this shipment." (Container #, Bill of lading, Shipping line, Vessel, Port of origin, Port of destination) → "Shipping details updated." Status/ETA are not editable here.
- **Open** → International Shipments page (not a shipment detail).

Observations: **OBS-SHP-1** new shipment status starts at `Pending Order` regardless of the procurement status · **OBS-SHP-2** status change gives no confirmation · **OBS-SHP-3** Open goes to the list page, not the shipment · OBS-PL-19 Required Date `-`.
Questions: **Q-SHP-1** Should the shipment status follow the Procurement component status? **Q-SHP-2** Where is ETA set?

## 2. Smoke (read-only)
| ID | Title | Expected | Ev. |
|---|---|---|---|
| SHP-SMK-01 | International Shipments loads | Tabs, 6 tiles, table columns (allow ~60 s load) | O |
| SHP-SMK-02 | Enterprise Shipments loads | Delay alert cards, filters, 9 columns, Edit/Open | O |
| SHP-SMK-03 | Log shipment form | Fields as above; Cancel / Log shipment | O |

## 3. Regression
| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| SHP-REG-01 | Log shipment validation | NEG | C | Empty → "Pick a project first" | O |
| SHP-REG-02 | Log shipment | POS | M | Project + run submittal + manufacturer/country → "Shipment logged."; row listed | O |
| SHP-REG-03 | Initial status follows procurement | INT | M | Status reflects the component (Q-SHP-1) | O – Pending Order (OBS-SHP-1) |
| SHP-REG-04 | Edit shipping details | POS | M | Change line/ports → "Shipping details updated."; row updated | O |
| SHP-REG-05 | Status change persists | POS | M | Risk Dashboard select → In Transit → kept after reload; tile count +1; Enterprise row In Transit | O |
| SHP-REG-06 | Status change confirmation | POS | M | Message shown | O – none (OBS-SHP-2) |
| SHP-REG-07 | Flag from Procurement listed once | INT | M | Flag twice → one row (PL-REG-INT-02) | O |
| SHP-REG-08 | Required Date from procurement | INT | M | Required Date = component date | O – `-` (OBS-PL-19) |
| SHP-REG-09 | Open shipment | POS | R | Opens the shipment detail | O – opens list (OBS-SHP-3) |
| SHP-REG-10 | Search / filters | POS | R | Search by submittal; destination filter; At-risk only | I |
| SHP-REG-11 | Tabs | POS | R | Delay Alerts / Flag & Review / Shipments render | I |

Totals: 3 smoke · 11 regression.
