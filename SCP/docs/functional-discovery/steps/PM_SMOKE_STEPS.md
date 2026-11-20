# Project Management Smoke – step-by-step flows

- Spec: `tests/pm-flow/pm-smoke.spec.js`
- Command: `npm run pm:smoke`
- Run tag: none in this spec. It is read-only, so no data is created and no unique names are used.
- Environment: SCP staging, project NRVC_Hall, signed in as Project Admin.
- Preconditions: PM-SMK-001 signs in once and selects the project. All other scenarios reuse that tab and follow the left-menu order. If PM-SMK-001 fails, the run aborts.
- Shared data: none. Forms are opened and closed with their own Cancel/X control; nothing is saved.

### PM-SMK-001 – Login and open Supply Chain Planner on NRVC_Hall (login)
| # | Action | Expected |
|---|---|---|
| 1 | Open the login URL | Heading "Welcome To Voyage Control" is shown |
| 2 | Enter the Project Admin username and password; sign in | Platform page shows the user name heading and a "Logout" link |
| 3 | Choose "Supply Chain Planner" | URL ends with /management-dashboard |
| 4 | In the header project selector choose NRVC_Hall | Project is in the list and selected; the site selector shows a site name |

### PM-SMK-002 – Project Management menu structure (menu)
| # | Action | Expected |
|---|---|---|
| 1 | Left menu: click "Project Management" if collapsed | "Configuration Options" and the other entries are visible |
| 2 | Expand "Integrations" and "Reference Data" | "XER Import" and "Common UoM" are visible |
| 3 | Read the entry list under Project Management | Order: Integrations, Reference Data, Configuration Options, First Delivery Inspection Config, Inventory Control, Material Master, PreShipping Checklist, Bulk Upload Status, Procurement Log Configuration, Site Details, Submittal Manager, System Messages, Watched Materials. Integrations: Booking Integration, TheLink Integration, XER Import. Reference Data: Common Utilities, Common UoM, Material Category. No "Setup Wizard" |

### PM-SMK-003 – Booking Integration page loads (page load)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › Integrations › "Booking Integration" | Page opens |
| 2 | Look at heading, first input, "Booking System Project ID", "Submit" | Heading shown; SCP Project ID pre-filled; label and Submit button visible |

### PM-SMK-004 – TheLink Integration page loads (skipped)
Not automated – Deferred: no TheLink access, out of scope for now (R7)

### PM-SMK-005 – XER Import page loads (page load)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › Integrations › "XER Import" | Page opens |
| 2 | Look at the page | "XER Plan Import" heading, "Plans" list, "Import Plan" button, prompt "Select a plan or import a new .xer / .xml file" |

### PM-SMK-006 – Common Utilities list, search and Add form (list and form)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › Reference Data › "Common Utilities" | Page opens |
| 2 | Read table headers and the item count | Columns NAME, Type, Created At; count text "N items" (remembered) |
| 3 | Type "currency" in "Search utils…" | A row containing "currency_type" is shown |
| 4 | Clear the search box | Item count returns to the original |
| 5 | Click "Add Common Util"; open the "Choose CommonUtil Type" list; press Escape | Form "Add Common Utils" with "CommonUtil Name *" and "CommonUtil Type *"; options include "currency_type" and "fdi_status" |
| 6 | Close the form with Cancel/X without saving | Form closes; item count unchanged |

### PM-SMK-007 – Common UoM list and Add form (list and form)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › Reference Data › "Common UoM" | Page opens |
| 2 | Read table headers and search box | Columns "UOM Name", "Created At"; "Search UOM…" visible |
| 3 | Click "Add UOM"; check; close with Cancel/X | Form "Add UOM" shows "UOM Name *" and an "Add" button; nothing saved |

### PM-SMK-008 – Material Category list and Add form (list and form)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › Reference Data › "Material Category" | Page opens |
| 2 | Read table headers and buttons | Column "Material Category Name"; "Load Defaults" visible (do not click) |
| 3 | Click "Add Material Category"; check; close with Cancel/X | Form shows "Name *"; nothing saved |

### PM-SMK-009 – Configuration Options renders current settings (page load)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "Configuration Options" | Page opens |
| 2 | Look at the week settings | "Lead time confirmation (weeks)", "Not ordered alert (weeks)", "Not booked alert (weeks)" with 3 non-empty values |
| 3 | Look at the other settings | Labels "Archive Read Items After", "Currency Type", "GRN", "Integration Provider", "Estimate Subcontractor Freight Emissions", "LLM Material Categorization", "Pre-Shipping Checklist"; an "N days" button |
| 4 | Look at the footer | "Cancel" and "Save" visible (do not click Save) |

### PM-SMK-010 – FDI Config sections render (page load)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "First Delivery Inspection Config" | Page opens |
| 2 | Look at "FDI Settings" | "Need Overall Notes to be captured", "Enable Uploading of Photos?", "Photos are mandatory?", "Provide Link to Submittal Spec Documents?" visible |
| 3 | Look at the Inspectors table and buttons | Columns Name / Email, Role, Materials Scope, Status, Enabled, Actions; "Invite" and "Add Inspector" visible |
| 4 | Look at Question Sets | "Unassigned questions", "New Question Set", "Manage Groups", "Add Question" visible |

### PM-SMK-011 – FDI Invite form gating (no send) (form)
Precondition: stays on the First Delivery Inspection Config page from PM-SMK-010.

| # | Action | Expected |
|---|---|---|
| 1 | Click "Invite" | "Invite Users" form opens |
| 2 | Look at the form | "Manual entry", "From Procore directory", "Email *", "Organization", "Role *" visible |
| 3 | Leave all fields empty; look at "Send Invites" | Button is disabled |
| 4 | Close with Cancel | Form closes; nothing sent |

### PM-SMK-012 – Inventory Control page loads (page load and form)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "Inventory Control" | Page opens |
| 2 | Look at the rules area | "Inventory control rules" shown, with a rules table or "No rules configured" |
| 3 | Click "Add Rule"; check; close with Cancel/X | Form shows "Inventory Item *", "Min balance at location *", "Max balance at location *", "Notify on min balance breach", "Notify on max balance breach"; nothing saved |

### PM-SMK-013 – Material Master list, paging and Add form (list and form)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "Material Master" | Page opens |
| 2 | Look at buttons, headers and rows | "Add Material", "Upload", "Export" visible; columns Category, Material ID, Name, Parent Material, UOM, Items; at most 25 rows |
| 3 | Note the first row; click "Next page", then "Previous page" | First row changes after Next; returns to the original after Previous |
| 4 | Click "Add Material"; check; close with Cancel/X | Form shows "Category *", "Material Name *", "UOM *", "Parent Material", "Supplier"; nothing saved |

### PM-SMK-014 – PreShipping Checklist page loads (page load)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "PreShipping Checklist" | Page opens |
| 2 | Read table headers and the first row | Columns #, Question, Enabled; an "Enabled" checkbox is visible (do not toggle) |

### PM-SMK-015 – Bulk Upload Status filters render (page load)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "Bulk Upload Status" | Page opens |
| 2 | Read the two date fields | Start date is dd/mm/yyyy; end date equals today |
| 3 | Open the "All Upload Types" dropdown; press Escape | Options include Submittals, Suppliers, Materials, Sites, Supplier Map, Components, Inventory |
| 4 | Look at search and table headers | "Search by uploader…" visible; columns Date, Added By, Bulk Upload Type, Status, Uploaded File, Success File, Failure File |

### PM-SMK-016 – Procurement Log Configuration page loads (page load and form)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "Procurement Log Configuration" | Page opens |
| 2 | Look at help texts and locked rows | "Drag rows to reorder" and "always required and can't be disabled" texts; "Material Name(Locked)", "Submittal No(Locked)", "Supplier Name(Locked)" are ticked and disabled; "Save Changes" visible (do not click) |
| 3 | Click "Add Log Fields"; check; close with Cancel/X | "Add Procurement Log Fields" form shows "Field Name *", "Field Type *"; nothing saved |

### PM-SMK-017 – Site Details list and Add form (list and form)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "Site Details" | Page opens |
| 2 | Look at buttons and table headers | "Add Site", "Upload", "Export" visible; columns Site Type, Name, City, Country, Locations |
| 3 | Click "Add Site"; check; close with Cancel/X | Form shows "Site Type *", "Name *", "Address", "City", "Country"; nothing saved |

### PM-SMK-018 – Submittal Manager notice (page load)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "Submittal Manager" | Page opens |
| 2 | Look at heading and notice | "Submittal Manager" heading and "This page is being repurposed." notice visible |

### PM-SMK-019 – System Messages list and New form (no create) (list and form)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "System Messages" | Page opens |
| 2 | Read table headers | Scope, Severity, Title / Body, Window, Status, Actions |
| 3 | Click "New message" | Form shows Scope, Severity, Title (optional), Body (markdown), 0/2000, Preview, Starts at, Ends at, Active, "Create" (do not click); Severity has Info and Warning; Scope has "Project (this project only)" |
| 4 | Click "Cancel" | Form closes ("Create" hidden); nothing created |

### PM-SMK-020 – Watched Materials user view (page load)
| # | Action | Expected |
|---|---|---|
| 1 | Project Management › "Watched Materials" | Page opens |
| 2 | Look at the page before choosing a user | "Pick a user to view or assign watches." shown |
| 3 | In the user dropdown pick the signed-in user (name from browser user info; otherwise the first real option) | Table headers Type, Value, Notifications, Assigned by, Created; "Add watch" visible (do not click) |
