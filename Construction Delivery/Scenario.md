# Page Wise Scenario Matrix

This document segregates the automation scenarios page-wise. Each table keeps only the scenario ID, page/area, and scenario name for quick tracking.

## Chrome Functional Automation Flows

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| CHROME-ALL-01 | Full smoke suite | Full smoke suite |
| CHROME-ALL-02 | Full regression suite | Full regression suite starts from project setup |
| CHROME-BK-01 | Booking creation functional flow | Booking creation functional flow |
| CHROME-BL-01 | Booking List export functional flow | Booking List export functional flow |
| CHROME-UM-01 | User Management functional flow | User Management functional flow |
| CHROME-EM-01 | Equipment Management functional flow | Equipment Management functional flow |
| CHROME-EM-02 | Updated Equipment List upload flow | Updated Equipment List upload flow |
| CHROME-AN-01 | Analytics functional flow | Analytics functional flow |
| CHROME-ER-01 | Environment Reports functional flow | Environment Reports functional flow |
| CHROME-MA-01 | My Account functional flow | My Account functional flow |
| CHROME-MO-01 | My Organization functional flow | My Organization functional flow |
| CHROME-NP-01 | Notification Preferences functional flow | Notification Preferences functional flow |
| CHROME-NP-02 | Delivery Booking Push Notification flow | Delivery Booking Push Notification flow |
| CHROME-NP-03 | Resource Booking Push Notification flow | Resource Booking Push Notification flow |
| CHROME-NP-04 | Push Notification Toggle flow | Push Notification Toggle flow |
| CHROME-FULL-01 | Full application functional flow | Full application functional flow |
| CHROME-CAL-01 | Calendar functional flow | Calendar functional flow |

## Full Regression Required Flow

Full regression must start from Project Details setup and must not skip directly
to booking creation. Existing smoke, safe navigation, and standalone catalog flows
remain unchanged.

| Sequence | Page / Area | Requirement |
|---|---|---|
| 1 | Project Details | Create or verify a new access point, resource, and vehicle assignment. |
| 2 | New Booking prerequisites | New bookings must use the newly created access point, resource, and vehicle. |
| 3 | Vehicle Emissions | Open Vehicle Emissions, click Add Vehicle Emission, select the newly added vehicle/name and fuel type, enter miles/Km between 5 and 15, enter emission factor between 0.1 and 5, and submit. |
| 4 | Equipment Master | Click Add Equipment, enter any equipment name, select one category, enter any brand and model, select a fuel type, enter emission factor between 0.1 and 5, and submit. |
| 5 | New Booking | Create the new booking only after Project Details setup, vehicle emission, and equipment master records are saved. |

## Positive Scenarios

### Dashboard / Login / Project Context

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| DASH-01 | Login | Login from SSO page |
| DASH-02 | Dashboard | Select Buckingham Palace project |
| DASH-03 | Dashboard | Open authenticated dashboard |
| DASH-04 | Dashboard | Select project and location |

### Booking List

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| BL-01 | Booking List | Open Booking List |
| BL-02 | Booking List | Booking List status counts |
| BL-03 | Booking List | Scheduled booking check-in/check-out hover actions |
| BL-04 | Booking List | Refused row cannot be modified |
| BL-05 | Booking List | Sort by Booking Ref |
| BL-06 | Booking List | Apply default filters |
| BL-07 | Booking List | Complete non-mutating Booking List flow |

### Booking Creation / Booking Details

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| BK-01 | New Booking | Create resource-only booking |
| BK-02 | New Booking | Create recurring booking |
| BK-03 | New Booking | Multi-vehicle booking reaches details |
| BK-04 | Booking Details | Scheduled booking lifecycle actions |
| BK-05 | New Booking | Delivery booking smoke |

### User Management

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| UM-01 | User Management | Open User Management page |
| UM-02 | Invite Users | Mandatory field and invalid email validation |
| UM-03 | Invite Users | Duplicate role validation |
| UM-04 | Invite Users | Send configured user invite |
| UM-05 | User List | Verify invited user status |
| UM-06 | User List | Re-send invite |
| UM-07 | Account Activation | Activate invited account through Yopmail |
| UM-08 | User List | Verify activated status |
| UM-09 | User List Filters | Filter by Project Admin and Neuralrays |
| UM-10 | User Organization | Change associated organization |
| UM-11 | User Login | Verify own login for changed user |
| UM-12 | User Cleanup | Remove created users from project |

### Equipment Management

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| EM-01 | Equipment Management | Open Equipment Management and Equipment List |
| EM-02 | Equipment List | Upload Equipment List workbook |
| EM-03 | Equipment List | Apply one-year date range |
| EM-04 | Equipment List | Select dropdown filters |
| EM-05 | Equipment List | Download export and PDF action |
| EM-06 | Equipment Usage | Validate fuel efficiency unit |
| EM-07 | Equipment Usage | Create Equipment Usage record |
| EM-08 | Equipment Usage | Search and filter created usage |
| EM-09 | Equipment Usage | Edit created usage year |
| EM-10 | Equipment Usage Attachments | Upload usage attachment workbook |
| EM-11 | Equipment Usage Cleanup | Delete automation-created usage |

### Analytics

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| AN-01 | Analytics | Verify project details and Country UOM |
| AN-02 | Summary Emission | Validate date range and download |
| AN-03 | Vehicle Emissions | Validate units, records, search, and download |
| AN-04 | Equipment Emissions | Validate units, records, search, and download |
| AN-05 | Environment Reports Analytics | Validate date range |

### Environment Reports

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| ER-01 | Environment Reports | Open and apply recorded date range |
| ER-02 | Environment Reports | Validate no-data after three-year limit |

### My Account

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| MA-01 | My Account | Open My Account from Account Settings |
| MA-02 | My Details | Update editable details |
| MA-03 | My Preferences | Validate dropdown values and persistence |
| MA-04 | Application Preferences | Verify preferences in Booking List |
| MA-05 | Account Access | Verify company and read-only roles |

### My Organization

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| MO-01 | My Organization | Open My Organization from Account Settings |
| MO-02 | Organization Details | Validate detail fields |
| MO-03 | Organization Details | Update trade type |
| MO-04 | Users Tab | Validate users list |
| MO-05 | Users Tab | Search users and This project only |

### Notification Preferences / Browser Push

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| NP-01 | Notification Preferences | Open preferences from Account Settings |
| NP-02 | Notification Preferences | Enable browser push permission |
| NP-03 | My Bookings Notifications | Enable email, mobile, and push switches |
| NP-04 | Delivery Booking Push | Delivery booking triggers browser push |
| NP-05 | Resource Booking Push | Resource booking triggers browser push |
| NP-06 | Push Toggle Disabled | Disabled push suppresses notification |
| NP-07 | Push Toggle Enabled | Enabled push shows notification |

### Dedicated Utility Flows

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| UF-01 | Equipment List Upload | Updated Equipment List upload workbook |
| UF-02 | Booking List Exports | Download Booking List exports |
| UF-03 | Full Application | Full application automation |

## Negative Scenarios

### Dashboard / Login / Project Context

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| DASH-N01 | Login | Invalid email format |
| DASH-N02 | Login | Invalid password |
| DASH-N03 | Login | Empty credentials |
| DASH-N04 | Login | Expired session redirect |
| DASH-N05 | Project Context | Direct module access without selected project |
| DASH-N06 | Project Context | Unavailable project card |

### Booking List

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| BL-N01 | Booking List Filters | Invalid date range |
| BL-N02 | Booking List Filters | Future-only range with no records |
| BL-N03 | Booking List Search | Search with unknown booking reference |
| BL-N04 | Booking List Search | Search with special characters |
| BL-N05 | Booking List Pagination | Navigate next page when disabled |
| BL-N06 | Booking List Status | Check-in unavailable status |
| BL-N07 | Booking List Status | Check-out unavailable status |
| BL-N08 | Booking List Status | Refuse unavailable status |
| BL-N09 | Booking List Sorting | Sort empty result set |
| BL-N10 | Booking List Export | Export empty result set |

### Booking Creation / Booking Details

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| BK-N01 | New Booking | Submit without booking type |
| BK-N02 | Scheduling | Missing access point |
| BK-N03 | Scheduling | Missing supplier/company |
| BK-N04 | Booking Date | No date selected |
| BK-N05 | Booking Time | No slot selected |
| BK-N06 | Resource Booking | Missing resource |
| BK-N07 | Recurring Booking | Missing end date |
| BK-N08 | Recurring Booking | End date before start date |
| BK-N09 | Recurring Booking | No repeat day selected |
| BK-N10 | Multi-Vehicle Booking | Missing vehicle count/details |
| BK-N11 | Booking Details | Missing required contact detail |
| BK-N12 | Booking Details | Invalid phone number |
| BK-N13 | Booking Details | Invalid email address |
| BK-N14 | Booking Details | Cancel submit confirmation |
| BK-N15 | Booking Details | Duplicate submission protection |

### User Management

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| UM-N01 | Invite Users | Empty invite form |
| UM-N02 | Invite Users | Invalid email format |
| UM-N03 | Invite Users | Duplicate role selection |
| UM-N04 | Invite Users | Missing organization |
| UM-N05 | Invite Users | Missing role |
| UM-N06 | Invite Users | Existing active user invite |
| UM-N07 | User List Search | Search non-existing user |
| UM-N08 | User List Filters | Filter combination with no users |
| UM-N09 | Row Actions | Resend invite for activated user |
| UM-N10 | Row Actions | Cancel invite for activated user |
| UM-N11 | Change Organization | Submit without selecting new organization |
| UM-N12 | Change Organization | Select same organization |
| UM-N13 | Own Login | Login before activation |
| UM-N14 | Cleanup | Remove user already removed from project |

### Equipment Management

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| EM-N01 | Equipment List Upload | Missing upload file |
| EM-N02 | Equipment List Upload | Unsupported file type |
| EM-N03 | Equipment List Upload | Missing scheduled_arrival column |
| EM-N04 | Equipment List Upload | Invalid scheduled_arrival value |
| EM-N05 | Equipment List Upload | Duplicate date-only workbook |
| EM-N06 | Equipment List Filters | Company with no records |
| EM-N07 | Equipment List Filters | Equipment Type with no records |
| EM-N08 | Equipment List Filters | Contact Name with no records |
| EM-N09 | Equipment List Search | Unknown equipment search |
| EM-N10 | Equipment List Export | Export with no rows |
| EM-N11 | Equipment Usage | Submit Add Usage empty |
| EM-N12 | Equipment Usage | Missing registered equipment |
| EM-N13 | Equipment Usage | Invalid hours |
| EM-N14 | Equipment Usage | Invalid litres/gallons |
| EM-N15 | Equipment Usage | Duplicate usage month/year |
| EM-N16 | Equipment Usage Attachment | Missing attachment file |
| EM-N17 | Equipment Usage Attachment | Unsupported attachment file type |
| EM-N18 | Equipment Usage Cleanup | Delete already deleted usage |

### Analytics

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| AN-N01 | Summary Emission | Invalid date range |
| AN-N02 | Summary Emission | Date range with no records |
| AN-N03 | Summary Emission | Download with no records |
| AN-N04 | Vehicle Emissions | Search unknown text |
| AN-N05 | Vehicle Emissions | Unit mismatch detection |
| AN-N06 | Equipment Emissions | No records within lookback |
| AN-N07 | Equipment Emissions | Search special characters |
| AN-N08 | Analytics Navigation | Direct analytics URL without auth |

### Environment Reports

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| ER-N01 | Environment Reports | Date range beyond three-year limit |
| ER-N02 | Environment Reports | Invalid date order |
| ER-N03 | Environment Reports | Empty report download |
| ER-N04 | Environment Reports | Search/filter unknown value |
| ER-N05 | Environment Reports | Scroll empty report |

### My Account

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| MA-N01 | My Details | Blank first name |
| MA-N02 | My Details | Blank last name |
| MA-N03 | My Details | Invalid phone |
| MA-N04 | My Details | Overlong name |
| MA-N05 | My Preferences | Save without language |
| MA-N06 | My Preferences | Invalid persisted preference recovery |
| MA-N07 | Account Access | Attempt to edit read-only role |
| MA-N08 | Password Redirect | Password screen blocks account page |

### My Organization

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| MO-N01 | Organization Details | Attempt to edit organization name |
| MO-N02 | Organization Details | Blank address line 1 |
| MO-N03 | Organization Details | Blank city |
| MO-N04 | Organization Details | Invalid country value |
| MO-N05 | Organization Details | Save without trade type |
| MO-N06 | Users Tab | Search unknown user |
| MO-N07 | Users Tab | This project only returns no users |
| MO-N08 | Users Tab | Invalid role change |

### Notification Preferences / Browser Push

| Scenario ID | Page / Area | Scenario |
|---|---|---|
| NP-N01 | Notification Preferences | Browser permission denied |
| NP-N02 | Notification Preferences | Disable Push suppresses browser notification |
| NP-N03 | Notification Preferences | My Bookings push disabled |
| NP-N04 | Notification Preferences | Email toggle disabled |
| NP-N05 | Notification Preferences | Mobile toggle disabled |
| NP-N06 | Notification Center | No new notification for disabled push |
| NP-N07 | Notification Observer | Notification timeout |
| NP-N08 | Notification Preferences | Reload after toggle change |
