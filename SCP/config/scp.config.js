const path = require('path');
const { loadJsonFile } = require('../utils/data-loader');

const DEFAULT_TAB_DATA_PATH = path.resolve(__dirname, '..', 'test-data', 'scp-tabs.json');

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildConfiguredTabs() {
  const configuredNames = splitCsv(process.env.SCP_TAB_NAMES);
  const fileTabs = loadJsonFile(DEFAULT_TAB_DATA_PATH, []);
  const tabNames = configuredNames.length > 0
    ? configuredNames
    : fileTabs.map((tab) => tab.name).filter(Boolean);

  return tabNames.map((name, index) => {
    const dataFromFile = fileTabs.find((tab) => tab.name === name) || fileTabs[index] || {};
    const ordinal = index === 0 ? 'ONE' : index === 1 ? 'TWO' : String(index + 1);

    return {
      name,
      description: dataFromFile.description || '',
      route: process.env[`SCP_TAB_${ordinal}_ROUTE`] || dataFromFile.route || '',
      expectedText: process.env[`SCP_TAB_${ordinal}_EXPECTED_TEXT`] || dataFromFile.expectedText || ''
    };
  });
}

function getScpConfig() {
  return {
    baseUrl: process.env.SCP_BASE_URL || 'https://stg-supplychain-app.voyagecontrol.com',
    loginUrl: process.env.SCP_LOGIN_URL || 'https://stg-login.voyagecontrol.com/api/sso/users/login/',
    managementDashboardUrl: process.env.SCP_MANAGEMENT_DASHBOARD_URL || 'https://stg-supplychain-app.voyagecontrol.com/management-dashboard',
    username: process.env.SCP_USERNAME || process.env.SCP_EMAIL || '',
    password: process.env.SCP_PASSWORD || '',
    platformName: process.env.SCP_PLATFORM_NAME || 'Supply Chain Planner',
    platformCardName: process.env.SCP_PLATFORM_CARD_NAME || 'Supply Chain Planner Supply',
    projectManagementName: process.env.SCP_PROJECT_MANAGEMENT_NAME || 'Project Management',
    firstDeliveryInspectionConfigName: process.env.SCP_FIRST_DELIVERY_INSPECTION_CONFIG_NAME || 'First Delivery Inspection Config',
    firstDeliveryInspectionConfigUrl: process.env.SCP_FIRST_DELIVERY_INSPECTION_CONFIG_URL ||
      'https://stg-supplychain-app.voyagecontrol.com/first-delivery-inspection-config',
    tabs: buildConfiguredTabs()
  };
}

module.exports = { getScpConfig };
