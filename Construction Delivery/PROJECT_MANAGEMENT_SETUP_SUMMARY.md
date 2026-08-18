# Project Management Chrome Automation - Setup Summary

## ✅ What Was Created

### 1. **Chrome Automation Script**
📄 File: `scripts/run-project-management-chrome-automation.js`

This script:
- Verifies Project Management automation setup
- Configures Chrome browser with proper permissions
- Validates application connectivity
- Runs the full Project Management test suite
- Generates test reports and artifacts

### 2. **NPM Scripts (Added to package.json)**

```json
"automate:project-management-chrome": "node scripts/run-project-management-chrome-automation.js",
"automate:project-management-chrome:headless": "node scripts/run-project-management-chrome-automation.js --headless",
"automate:project-management-flow": "node scripts/run-project-management-flow.js"
```

### 3. **Documentation**
📄 File: `docs/PROJECT_MANAGEMENT_AUTOMATION.md`

Comprehensive guide covering:
- What gets automated (7 major workflows)
- Usage instructions
- Configuration options
- Test flow steps
- Troubleshooting guide
- CI/CD integration

### 4. **Updated Main Guide**
📄 File: `docs/AUTOMATION_GUIDE.md`

Added references to:
- `npm run automate:project-management-chrome`
- `npm run automate:notification-chrome`

## 🎯 What Gets Automated

The Project Management tab automation tests and validates:

1. **Project Information** - Update project name, address, home screen messages
2. **Access Points** - Create access points with vehicle restrictions
3. **Resources** - Create resources and assign to access points
4. **Availability** - Configure hours of operation and booking advance limits
5. **Project Settings** - Enable automatic approval, manage emissions
6. **Emissions & Equipment** - Add vehicle emissions and equipment records
7. **Global Settings** - Manage utilities and country UOMs

## 🚀 Quick Start

### Run Headed (See the Browser)
```bash
npm run automate:project-management-chrome
```

### Run Headless (Faster, No UI)
```bash
npm run automate:project-management-chrome:headless
```

### Just the Core Flow
```bash
npm run automate:project-management-flow
```

## 📋 Test Flow Steps (Automated)

The automation executes these sequential steps:

```
1. 🔐 Login and open Project Management
2. 📝 Update Project Information
3. 🚪 Create Access Point with Vehicle Restrictions
4. 🏗️ Create Resource and assign Vehicle
5. ⏰ Validate Availability and Booking Advance Limit
6. 📅 Validate Resource Availability in Booking
7. ⚙️ Validate Project Settings, Automatic Approval, and Emission Menus
```

## ⚙️ Configuration

### Required Environment Variables

Set these before running the automation:

```bash
# Authentication
set VC_EMAIL=your-email@example.com
set VC_PASSWORD=your-password

# URLs (optional - defaults shown)
set BASE_URL=https://stg-login.voyagecontrol.com
set APP_URL=https://stg-app.voyagecontrol.com

# Project Configuration
set BUCKINGHAM_PALACE_PROJECT_ID=5ET10000010
```

### Optional Settings

```bash
# Timing
set PROJECT_MANAGEMENT_ACTION_GAP_MS=2000           # Delay between actions
set CHROME_PROJECT_MANAGEMENT_TIMEOUT_MS=1800000    # 30 min total timeout

# Project Details
set BUCKINGHAM_PALACE_PROJECT_NAME=Buckingham Palace
```

### Create .env File (Recommended)

```env
VC_EMAIL=hariharan.r@neuralrays.ai
VC_PASSWORD=Master@15
BASE_URL=https://stg-login.voyagecontrol.com
APP_URL=https://stg-app.voyagecontrol.com
BUCKINGHAM_PALACE_PROJECT_ID=5ET10000010
PROJECT_MANAGEMENT_ACTION_GAP_MS=2000
```

## 📊 Test Reports

After automation completes, view reports here:

- **Live Dashboard**: `reports/automation-dashboard-latest.html`
- **Summary JSON**: `reports/automation-dashboard-summary.json`
- **Detailed Report**: `test-results/project-management-report-*.json`
- **Test Artifacts**: `test-results/playwright-artifacts/`
- **HTML Report**: `test-results/playwright-html/index.html`

## ✨ Features

✅ **Automatic Browser Setup**
- Grants notification permissions automatically
- Configures viewport and locale
- Handles authentication flow

✅ **Comprehensive Testing**
- Tests all 7 project management areas
- Validates functionality end-to-end
- Creates and cleans up test data

✅ **Detailed Reporting**
- Screenshot evidence on each step
- Page traces for debugging
- JSON reports for CI/CD integration
- HTML dashboard for visualization

✅ **Flexible Execution**
- Headed mode for interactive debugging
- Headless mode for CI/CD pipelines
- Configurable timeouts and delays

✅ **Detailed Documentation**
- Step-by-step guide
- Troubleshooting section
- Integration examples
- Environment configuration

## 🔧 Troubleshooting

### Login Fails
```bash
set VC_EMAIL=your-email@example.com
set VC_PASSWORD=your-password
```

### Timeouts or Slow Performance
```bash
set PROJECT_MANAGEMENT_ACTION_GAP_MS=3000
set CHROME_PROJECT_MANAGEMENT_TIMEOUT_MS=2400000
```

### Network/Connectivity Issues
```bash
set BASE_URL=https://stg-login.voyagecontrol.com
set APP_URL=https://stg-app.voyagecontrol.com
```

## 🔄 Related Automation

This setup follows the same pattern as:
- 📱 **Notification Chrome Automation** - `npm run automate:notification-chrome`
- 📊 **Analytics Automation** - `npm run automate:analytics`
- 🏢 **Organization Management** - `npm run automate:my-organization`
- 👤 **User Management** - `npm run automate:user-management`

All support both headed and headless modes with `:headless` suffix.

## 📖 Full Documentation

See `docs/PROJECT_MANAGEMENT_AUTOMATION.md` for:
- Detailed workflow descriptions
- Complete configuration reference
- CI/CD integration examples
- Advanced troubleshooting
- Test artifacts explanation

## 🎬 Example: Run in CI/CD

```yaml
# GitHub Actions
- name: Project Management Automation
  env:
    VC_EMAIL: ${{ secrets.VC_EMAIL }}
    VC_PASSWORD: ${{ secrets.VC_PASSWORD }}
  run: npm run automate:project-management-chrome:headless
```

## ✅ Verification

Test that the setup is working:

```bash
# List all new automation commands
npm run | Select-String -Pattern "project-management|notification"

# Run a quick headed test
npm run automate:project-management-chrome
```

Expected output:
```
✅ Application origin verified
✅ Login origin verified
✅ Project Management automation setup verified!
Running Project Management automation suite in Chrome...
```

---

**Project Management automation is now ready to use!** 🎉

For more details, see `docs/PROJECT_MANAGEMENT_AUTOMATION.md`
