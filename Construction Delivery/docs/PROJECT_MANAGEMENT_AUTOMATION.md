# Project Management Chrome Automation Guide

## Overview

This automation suite provides comprehensive testing and automation of the **Project Management tab** in the Voyage Control Chrome application. It tests environment settings, resource management, availability configurations, and emission settings.

## What Gets Automated

The Project Management automation covers the following workflows:

### 1. **Project Information** ✅
- Update project name and address
- Modify home screen messages
- Verify project context

### 2. **Access Points** ✅
- Create new access points
- Set maximum unit limits
- Configure vehicle restrictions with date ranges
- Activate/deactivate access points

### 3. **Resources** ✅
- Create resources with unlimited availability
- Assign resources to access points
- Associate vehicles with resources
- Toggle resource availability

### 4. **Availability & Booking Limits** ✅
- Configure daily availability (hours of operation)
- Enable/disable specific days (e.g., Sunday)
- Set booking advance limits (days allowed to book ahead)
- Validate booking date restrictions in the booking flow

### 5. **Project Settings** ✅
- Enable/disable automatic booking approval
- Verify automatic approval in new bookings
- Manage emission settings
- Control menu visibility based on settings

### 6. **Emissions & Equipment** ✅
- Add a vehicle emission record for the newly added vehicle/name
- Select a fuel type and enter miles/Km between 5 and 15
- Set vehicle emission factor between 0.1 and 5
- Create equipment master records with equipment name, category, brand, model, and fuel type
- Set equipment emission factor between 0.1 and 5
- Clean up test records

### 7. **Global Settings** ✅
- Manage common utilities
- Configure units of measurement
- Add country-specific UOMs

## Usage

### Run Project Management Automation

**Headed mode** (see the Chrome browser window):
```bash
npm run automate:project-management-chrome
```

**Headless mode** (no UI, faster):
```bash
npm run automate:project-management-chrome:headless
```

### Run Individual Flow

Run just the core project management test:
```bash
npm run automate:project-management-flow
```

### Run Project Setting Tab Only

Use this focused flow when you only need the Construction Delivery or
Construction FM Project Setting tab automation:

```bash
npm run automate:project-settings-chrome
```

Headless mode:

```bash
npm run automate:project-settings-chrome:headless
```

The focused flow opens the configured project, navigates to
`/<PROJECT_ID>/settings`, verifies the Project Setting tab content, and applies
these configurable settings:

```bash
PROJECT_SETTINGS_AUTOMATIC_APPROVAL_ENABLED=true
PROJECT_SETTINGS_EMISSION_SETTINGS_ENABLED=true
CONSTRUCTION_PLATFORM_NAME_PATTERN="V3 Construction deliveries|Construction Delivery|Construction FM"
```

## Test Flow Steps

The automation executes the following sequential steps:

For full regression, continue the Project Management setup by adding Vehicle
Emission for the newly added vehicle/name, adding Equipment master data, and
creating the new booking only after those setup records are saved.

1. 🔐 Login and open Project Management
2. 📝 Update Project Information (name, address, home screen message)
3. 🚪 Create Access Point with Vehicle Restrictions
4. 🏗️ Create Resource and assign Vehicle
5. ⏰ Validate Availability and Booking Advance Limit
6. 📅 Validate Resource Availability in Booking
7. ⚙️ Validate Project Settings, Automatic Approval, and Emission Menus

## Configuration

### Environment Variables

Control the automation behavior with these environment variables:

```bash
# Authentication
VC_EMAIL=your-email@example.com
VC_PASSWORD=your-password

# URLs
BASE_URL=https://stg-login.voyagecontrol.com
APP_URL=https://stg-app.voyagecontrol.com

# Project Configuration
BUCKINGHAM_PALACE_PROJECT_ID=5ET10000010
BUCKINGHAM_PALACE_PROJECT_NAME=Buckingham Palace

# Timing
PROJECT_MANAGEMENT_ACTION_GAP_MS=2000          # Delay between actions
CHROME_PROJECT_MANAGEMENT_TIMEOUT_MS=1800000   # 30 minutes total timeout
```

### .env File Example

Create a `.env` file in the project root:

```env
VC_EMAIL=hariharan.r@neuralrays.ai
VC_PASSWORD=Master@15
BASE_URL=https://stg-login.voyagecontrol.com
APP_URL=https://stg-app.voyagecontrol.com
BUCKINGHAM_PALACE_PROJECT_ID=5ET10000010
PROJECT_MANAGEMENT_ACTION_GAP_MS=2000
```

## Test Reports

After the automation completes, view the generated reports:

### Dashboard Report
- **Latest**: `reports/automation-dashboard-latest.html`
- **Summary**: `reports/automation-dashboard-summary.json`

### Detailed Test Results
- **JSON Report**: `test-results/project-management-report-*.json`
- **JSON Data**: `test-results/project-management-json/`
- **Playwright HTML**: `test-results/playwright-html/index.html`
- **Artifacts**: `test-results/playwright-artifacts/`

## Browser Permissions & Setup

The automation script automatically:
- ✅ Grants notification permissions
- ✅ Sets viewport to maximized
- ✅ Configures application locale
- ✅ Handles authentication
- ✅ Navigates to the Project Management tab

## Troubleshooting

### Login Issues
**Error**: "Login page is visible and VC_EMAIL/VC_PASSWORD are not configured"

**Solution**: Set environment variables:
```bash
set VC_EMAIL=your-email@example.com
set VC_PASSWORD=your-password
```

### Project Context Issues
**Error**: "Cannot find Buckingham Palace project"

**Solution**: Verify project configuration:
```bash
set BUCKINGHAM_PALACE_PROJECT_ID=5ET10000010
set BUCKINGHAM_PALACE_PROJECT_NAME=Buckingham Palace
```

### Navigation Timeouts
**Error**: "Element not found or timed out"

**Solution**: Increase action delays:
```bash
set PROJECT_MANAGEMENT_ACTION_GAP_MS=3000
```

### Application Not Loading
**Error**: "App connectivity verification failed"

**Solution**: Verify URLs and network:
```bash
set BASE_URL=https://stg-login.voyagecontrol.com
set APP_URL=https://stg-app.voyagecontrol.com
```

## Test Artifacts

The automation captures:
- ✅ Screenshots of each major step
- ✅ Page traces for debugging
- ✅ Test failure evidence
- ✅ JSON test reports
- ✅ Execution timeline

Located in: `test-results/playwright-artifacts/`

## Integration with CI/CD

Run in your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Run Project Management Automation
  env:
    VC_EMAIL: ${{ secrets.VC_EMAIL }}
    VC_PASSWORD: ${{ secrets.VC_PASSWORD }}
  run: npm run automate:project-management-chrome:headless
```

## Test Status

✅ **PASSING CRITERIA**:
- All project information updates succeed
- Access points and resources are created
- Availability settings are applied correctly
- Booking restrictions are enforced
- Automatic approval works as expected
- Emission menus toggle visibility correctly

## Support

For issues or questions:
1. Check the test reports in `reports/`
2. Review artifacts in `test-results/playwright-artifacts/`
3. Check logs in console output
4. Verify environment variables are set correctly

## Related Automation

- 📱 [Notification Automation](../docs/NOTIFICATION_AUTOMATION.md)
- 📊 [Analytics Automation](../scripts/run-analytics-flow.js)
- 🏢 [Organization Management](../scripts/run-my-organization-flow.js)
- 👤 [User Management](../scripts/run-user-management-functional-flow.js)
