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

function credentialsFor(env = process.env) {
  const username = env.SCP_USERNAME || env.SCP_EMAIL || '';
  const password = env.SCP_PASSWORD || '';
  const defaultRole = (env.SCP_DEFAULT_ROLE || 'admin').toLowerCase();
  const accounts = {
    admin: { username: env.SCP_ADMIN_USERNAME || username, password: env.SCP_ADMIN_PASSWORD || password },
    subcontractor: { username: env.SCP_SUBCONTRACTOR_USERNAME || '', password: env.SCP_SUBCONTRACTOR_PASSWORD || '' },
    supplier: { username: env.SCP_SUPPLIER_USERNAME || '', password: env.SCP_SUPPLIER_PASSWORD || '' }
  };
  const selected = accounts[defaultRole]?.username ? accounts[defaultRole] : { username, password };
  return { username: selected.username, password: selected.password, defaultRole, accounts };
}

function getScpConfig() {
  const { username, password, defaultRole, accounts } = credentialsFor();

  return {
    baseUrl: process.env.SCP_BASE_URL || 'https://stg-supplychain-app.voyagecontrol.com',
    loginUrl: process.env.SCP_LOGIN_URL || 'https://stg-login.voyagecontrol.com/api/sso/users/login/',
    managementDashboardUrl: process.env.SCP_MANAGEMENT_DASHBOARD_URL || 'https://stg-supplychain-app.voyagecontrol.com/management-dashboard',
    username,
    password,
    defaultRole,
    accounts,
    platformName: process.env.SCP_PLATFORM_NAME || 'Supply Chain Planner',
    platformCardName: process.env.SCP_PLATFORM_CARD_NAME || 'Supply Chain Planner Supply',
    projectName: process.env.SCP_PROJECT_NAME || 'NRVC_Hall',
    projectManagementName: process.env.SCP_PROJECT_MANAGEMENT_NAME || 'Project Management',
    firstDeliveryInspectionConfigName: process.env.SCP_FIRST_DELIVERY_INSPECTION_CONFIG_NAME || 'First Delivery Inspection Config',
    firstDeliveryInspectionConfigUrl: process.env.SCP_FIRST_DELIVERY_INSPECTION_CONFIG_URL ||
      'https://stg-supplychain-app.voyagecontrol.com/first-delivery-inspection-config',
    firstDeliveryInspectionsUrl: process.env.SCP_FIRST_DELIVERY_INSPECTIONS_URL ||
      'https://stg-supplychain-app.voyagecontrol.com/first-delivery-inspections',
    yopmailUrl: process.env.SCP_YOPMAIL_URL || 'https://yopmail.com/en/',
    tabs: buildConfiguredTabs()
  };
}

module.exports = { getScpConfig, credentialsFor };
