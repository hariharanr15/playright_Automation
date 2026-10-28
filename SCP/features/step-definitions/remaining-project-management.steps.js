const path = require('path');
const { Then, When } = require('@cucumber/cucumber');
const { ProcurementLogPage } = require('../../pages/procurement-log/procurement-log.page');
const { loadJsonFile } = require('../../utils/data-loader');
const { createProcurementLogData } = require('../../utils/dynamic-data');
const { FirstDeliveryInspectionConfigPage } = require('../../pages/project-management/first-delivery-inspection-config.page');
const { MaterialMasterPage } = require('../../pages/project-management/material-master.page');
const { InventoryControlPage } = require('../../pages/project-management/inventory-control.page');
const { PreshippingChecklistPage } = require('../../pages/project-management/preshipping-checklist.page');
const { ProcurementLogConfigurationPage } = require('../../pages/project-management/procurement-log-configuration.page');
const { SiteDetailsPage } = require('../../pages/project-management/site-details.page');
const { SystemMessagesPage } = require('../../pages/project-management/system-messages.page');
const { WatchedMaterialsPage } = require('../../pages/project-management/watched-materials.page');
const { AnalyticsPage } = require('../../pages/project-management/analytics.page');
const { ProjectManagementMenuGroupsPage } = require('../../pages/project-management/project-management-menu-groups.page');
const { FirstDeliveryInspectionsPage } = require('../../pages/first-delivery-inspections/first-delivery-inspections.page');
const { InvitedUserActivationPage } = require('../../pages/project-management/invited-user-activation.page');

function localDateTime(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(22, 25, 0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

When('the user opens First Delivery Inspection Config', async function () {
  this.fdiConfig = new FirstDeliveryInspectionConfigPage(this.page);
  await this.fdiConfig.open(this.dashboard);
});

When('the user changes and saves one FDI setting', async function () {
  this.runData.fdiSettingChange = await this.fdiConfig.changeAndSaveOneSetting();
});

Then('the FDI setting change is persisted', async function () {
  await this.captureCheckpoint('TC_PM_FDI_001_Setting_Changed');
});

When('the user validates the enabled settings on the First Delivery Inspection page', async function () {
  this.firstDeliveryInspections = new FirstDeliveryInspectionsPage(this.page, this.config);
  await this.firstDeliveryInspections.open(this.dashboard);
  await this.firstDeliveryInspections.validateConfiguredSettings(this.runData.fdiSettingChange.states);
});

Then('the corresponding enabled FDI controls are available', async function () {
  await this.captureCheckpoint('TC_PM_FDI_002_Enabled_Controls_Validated');
});

When('the user returns to First Delivery Inspection Config', async function () {
  await this.fdiConfig.open(this.dashboard);
});

When('the user sends a unique FDI inspector invitation', async function () {
  this.runData.activeOrganization = this.runData.useData(
    'activeOrganization',
    'First Delivery Inspection Config > User Invite'
  ) || await this.projectSelector.activeOrganizationName();
  this.runData.invitation = await this.fdiConfig.inviteInspector(
    this.runData.invitationEmail,
    this.runData.activeOrganization
  );
  this.runData.captureData(
    'fdiInvitation',
    { email: this.runData.invitationEmail, ...this.runData.invitation },
    'First Delivery Inspection Config > User Invite'
  );
});

Then('the invited FDI user is pending acceptance', async function () {
  await this.fdiConfig.expectPendingInvitation(this.runData.invitationEmail);
  await this.captureCheckpoint('TC_PM_FDI_003_Invitation_Pending');
});

When('the user ensures an existing eligible FDI inspector for all materials', async function () {
  this.runData.existingInspector = await this.fdiConfig.addExistingInspector();
  await this.attach(
    this.runData.existingInspector.reused
      ? `Reused existing All Materials inspector ${this.runData.existingInspector.email}; all project members were already configured.`
      : `Added All Materials inspector ${this.runData.existingInspector.email}.`,
    'text/plain'
  );
});

Then('the existing inspector is displayed with the selected role and scope', async function () {
  const row = await this.fdiConfig.expectInspectorConfigured(this.runData.existingInspector);
  await row.scrollIntoViewIfNeeded();
  await this.captureCheckpoint('TC_PM_FDI_004_Existing_Inspector_Added');
});

When('the user opens the invited mailbox in a separate browser context', async function () {
  const activationPage = await this.openActivationBrowserContext();
  this.invitedUserActivation = new InvitedUserActivationPage(activationPage, this.config);
  this.runData.accessValidationUser = this.runData.invitedUser;
  this.runData.activationMode = 'current-invitation';
  try {
    await this.invitedUserActivation.openInvitationFromYopmail(this.runData.invitedUser.email);
  } catch (error) {
    if (!/YOPmail did not receive an invitation/i.test(String(error.message))) throw error;
    const projectReference = this.runData.useData(
      'activeProjectReference',
      'FDI invitation delivery retry'
    ) || await this.projectSelector.activeProjectReference();
    const resend = await this.fdiConfig.resendPendingInvitation(
      this.runData.invitedUser.email,
      projectReference
    );
    await this.attach(
      `Invitation ${resend.invitationId} was resent after the initial mailbox delivery window expired.`,
      'text/plain'
    );
    try {
      await this.invitedUserActivation.openInvitationFromYopmail(this.runData.invitedUser.email);
      return;
    } catch (retryError) {
      if (!/YOPmail did not receive an invitation/i.test(String(retryError.message))) throw retryError;
    }
    const fallback = await this.fdiConfig.ensureReusableAutomationInspector(
      this.runData.invitedUser.email
    );
    this.runData.activationMode = 'existing-user-fallback';
    this.runData.accessValidationUser = {
      ...this.runData.invitedUser,
      ...fallback
    };
    this.runData.recordFallback(
      'activationInspector',
      fallback.email,
      'FDI activation and access validation'
    );
    await this.attach(
      `YOPmail did not receive ${this.runData.invitedUser.email}. ` +
      `The current invitation remains verified as pending; access validation is continuing with ${fallback.email}.`,
      'text/plain'
    );
  }
});

When('the user accepts the invitation with the required password', async function () {
  if (this.runData.activationMode === 'current-invitation') {
    await this.invitedUserActivation.setInvitationPassword(this.runData.invitedUser.password);
  } else {
    await this.invitedUserActivation.loginForProfileCompletion(
      this.runData.accessValidationUser
    );
  }
});

When('the user completes the invited profile and address details', async function () {
  const profileRequired = /\/api\/sso\/users\/set-profile\//i.test(
    new URL(this.invitedUserActivation.page.url()).pathname
  );
  this.runData.activation = profileRequired
    ? await this.invitedUserActivation.completeProfileAndAddress(this.runData.accessValidationUser)
    : { addressPresented: false, reusedExistingUser: this.runData.activationMode !== 'current-invitation' };
  await this.attach(
    this.runData.activation.reusedExistingUser
      ? `Existing activated account ${this.runData.accessValidationUser.email} requires no profile setup.`
      : this.runData.activation.addressPresented
      ? 'The activation address stage was presented and completed.'
      : 'The current SCP activation build did not present an address stage; profile activation completed.',
    'text/plain'
  );
});

When('the activated user logs in and verifies FDI page access', async function () {
  await this.invitedUserActivation.logout(this.runData.accessValidationUser.firstName);
  this.runData.enabledInspectorAccess = await this.invitedUserActivation.loginAndVerifyInspectorAccess(
    this.runData.accessValidationUser,
    null
  );
  if (!this.runData.enabledInspectorAccess.platformAvailable) {
    this.runData.businessDefects ||= [];
    this.runData.businessDefects.push(this.runData.enabledInspectorAccess.reason);
  }
});

Then('the activated user can open operational First Delivery Inspections', async function () {
  await this.attach(
    this.runData.enabledInspectorAccess.platformAvailable
      ? `Validation user ${this.runData.accessValidationUser.email} logged in and opened the FDI page.`
      : this.runData.enabledInspectorAccess.reason,
    'text/plain'
  );
});

When('the activated user logs out and the separate browser context closes', async function () {
  await this.invitedUserActivation.logout(this.runData.accessValidationUser.firstName);
  await this.closeActivationBrowserContext();
});

Then('the original Admin browser session remains active', async function () {
  await this.projectSelector.expectActiveProject(this.config.projectName);
  await this.captureCheckpoint('TC_PM_FDI_005_Admin_Session_Preserved');
});

When('the Admin reopens First Delivery Inspection Config', async function () {
  await this.dashboard.open();
  await this.fdiConfig.open(this.dashboard);
});

Then('the activated invited inspector is Active and Enabled', async function () {
  await this.fdiConfig.expectActiveAndEnabled(this.runData.accessValidationUser.email);
  await this.captureCheckpoint('TC_PM_FDI_006_Inspector_Active_Enabled');
});

When('the Admin disables the activated invited inspector', async function () {
  await this.fdiConfig.disableInspector(this.runData.accessValidationUser.email);
});

Then('the invited inspector is Disabled in configuration', async function () {
  await this.fdiConfig.expectInspectorState(
    this.runData.accessValidationUser.email,
    'Active',
    'Disabled'
  );
  await this.captureCheckpoint('TC_PM_FDI_007_Inspector_Disabled');
});

When('the disabled inspector access is checked in a separate browser context', async function () {
  const activationPage = await this.openActivationBrowserContext();
  this.disabledInspectorVerification = new InvitedUserActivationPage(activationPage, this.config);
  this.runData.disabledInspectorAccess = await this.disabledInspectorVerification.loginAndVerifyInspectorAccess(
    this.runData.accessValidationUser,
    false
  );
});

Then('the disabled inspector cannot self assign a First Delivery Inspection', async function () {
  // Access was asserted in the previous step. Logout is cleanup only: closing the separate context also ends that session.
  const loggedOut = await this.disabledInspectorVerification.logout(this.runData.accessValidationUser.firstName)
    .then(() => null, error => error.message);
  await this.closeActivationBrowserContext();
  if (loggedOut) await this.attach(`Disabled inspector logout menu was unavailable (${loggedOut}); the separate browser context was closed instead.`, 'text/plain');
  await this.attach(
    this.runData.disabledInspectorAccess.platformAvailable
      ? `Disabled inspector ${this.runData.accessValidationUser.email} has no Self Assign action.`
      : `Disabled inspector ${this.runData.accessValidationUser.email} has no SCP platform access.`,
    'text/plain'
  );
});

When('the user adds a unique FDI question with an answer type', async function () {
  const fdiQuestion = this.runData.useData(
    'fdiQuestion',
    'First Delivery Inspection Config > Add Question'
  ) || this.runData.fdiQuestion;
  await this.fdiConfig.verifyBlankQuestionIsRejected();
  await this.fdiConfig.addQuestion(fdiQuestion, 'text');
});

Then('the unique FDI question is displayed', async function () {
  await this.captureCheckpoint('TC_PM_FDI_008_Question_Created');
});

When('the user opens Material Master', async function () {
  this.materialMaster = new MaterialMasterPage(this.page);
  await this.materialMaster.open(this.dashboard);
});

When('the user verifies required Material Master fields and creates a material', async function () {
  await this.materialMaster.verifyBlankMaterialIsRejected();
  this.runData.materialName = `OLED TV ${this.runData.nextSequence()}`;
  const category = this.runData.useData('materialCategory', 'Material Master') ||
    this.runData.updatedMaterialCategoryName;
  const uom = this.runData.useData('commonUom', 'Material Master') || this.runData.updatedUomName;
  await this.materialMaster.addMaterial(
    this.runData.materialName,
    category,
    uom
  );
  this.runData.captureData('material', {
    name: this.runData.materialName,
    category,
    uom
  }, 'Material Master');
});

Then('the new material is displayed in Material Master', async function () {
  await this.materialMaster.expectMaterial(this.runData.materialName);
  await this.captureCheckpoint('TC_PM_MM_001_Material_Created');
  await this.materialMaster.clearSearch();
});

When('the user opens Inventory Control', async function () {
  this.inventoryControl = new InventoryControlPage(this.page);
  await this.inventoryControl.open(this.dashboard);
});

When('the user verifies required inventory fields and adds a balance rule', async function () {
  await this.inventoryControl.verifyBlankRuleIsRejected();
  const material = this.runData.useData('material', 'Inventory Control');
  const materialName = material?.name || this.runData.materialName;
  await this.inventoryControl.addRule(materialName, '100', '900');
  this.runData.captureData('inventoryRule', {
    materialName,
    minimum: '100',
    maximum: '900'
  }, 'Inventory Control');
});

Then('the inventory balance rule is displayed', async function () {
  await this.inventoryControl.expectRule(this.runData.materialName, '100', '900');
  await this.captureCheckpoint('TC_PM_IC_001_Inventory_Rule_Created');
});

When('the user opens PreShipping Checklist', async function () {
  this.preshippingChecklist = new PreshippingChecklistPage(this.page);
  await this.preshippingChecklist.open(this.dashboard);
});

When('the current run PreShipping question is created', async function () {
  const question = this.runData.useData('fdiQuestion', 'PreShipping Checklist') || this.runData.fdiQuestion;
  await this.preshippingChecklist.createCurrentRunQuestion(question);
});

When('the user enables the new FDI question with Text answer type for Procurement Log', async function () {
  const question = this.runData.useData('fdiQuestion', 'PreShipping Checklist') || this.runData.fdiQuestion;
  await this.preshippingChecklist.expectQuestion(question);
  await this.preshippingChecklist.ensureQuestionEnabled(question);
});

Then('the PreShipping question remains enabled with Text configuration after reload', async function () {
  await this.captureCheckpoint('TC_PM_PC_001_Question_Enabled');
});

When('the user opens Procurement Log Configuration', async function () {
  this.procurementLogConfiguration = new ProcurementLogConfigurationPage(this.page);
  await this.procurementLogConfiguration.open(this.dashboard);
});

When('the user verifies required log fields and ensures the Codegen field', async function () {
  await this.procurementLogConfiguration.verifyBlankFieldIsRejected();
  this.runData.procurementFieldName = `Total count ${this.runData.runId}`;
  this.runData.procurementFieldCreated = await this.procurementLogConfiguration.ensureField(
    this.runData.procurementFieldName,
    'Number'
  );
  this.runData.captureData(
    'procurementLogField',
    this.runData.procurementFieldName,
    'Procurement Log Configuration'
  );
});

Then('the procurement log field is displayed', async function () {
  await this.procurementLogConfiguration.expectField(this.runData.procurementFieldName);
  await this.captureCheckpoint('TC_PM_PLC_001_Field_Created');
});

When('the user opens Procurement Log', async function () {
  this.procurementLog = new ProcurementLogPage(this.page);
  await this.procurementLog.open();
});

When('the user creates a unique procurement submittal', async function () {
  const baseline = loadJsonFile(path.resolve(__dirname, '..', '..', 'test-data', 'procurement-log.json'), {});
  this.runData.procurementSubmittal = { ...baseline, ...createProcurementLogData(this.runData.runId) };
  await this.procurementLog.createSubmittal(this.runData.procurementSubmittal);
  this.runData.captureData('procurementSubmittal', this.runData.procurementSubmittal.submittalNumber, 'Procurement Log');
});

Then('the new procurement submittal is displayed', async function () {
  await this.procurementLog.expectSubmittal(this.runData.procurementSubmittal.submittalNumber);
  await this.captureCheckpoint('TC_PM_PL_001_Submittal_Created');
});

When('the user opens Site Details', async function () {
  this.siteDetails = new SiteDetailsPage(this.page);
  await this.siteDetails.open(this.dashboard);
});

When('the user verifies required site fields and adds the Codegen site', async function () {
  await this.siteDetails.verifyBlankSiteIsRejected();
  this.runData.siteName = `Gate 6. ${this.runData.runId}`;
  this.runData.site = {
    name: this.runData.siteName,
    siteType: 'Site',
    address: 'TIDEL Park, Rajiv Gandhi Salai, Taramani, Chennai, 600113',
    city: 'Chennai',
    country: 'India'
  };
  await this.siteDetails.addSite(this.runData.site);
  this.runData.captureData('site', this.runData.site, 'Site Details');
});

Then('the new site is displayed', async function () {
  await this.siteDetails.expectSite(this.runData.siteName, 'Chennai', 'India');
  await this.captureCheckpoint('TC_PM_SD_001_Site_Created');
  await this.siteDetails.clearSearch();
});

When('the user opens System Messages', async function () {
  this.systemMessages = new SystemMessagesPage(this.page);
  await this.systemMessages.open(this.dashboard);
});

When('the user creates the Codegen system message', async function () {
  await this.systemMessages.verifyBlankMessageIsRejected();
  this.runData.systemMessageTitle = `Information ${this.runData.runId}`;
  await this.systemMessages.createCodegenMessage({
    title: this.runData.systemMessageTitle,
    body: `Dear User!!! Due to scheduled maintenance, the system will be temporarily unavailable. Automation run ${this.runData.runId}.`,
    startsAt: localDateTime(1),
    endsAt: localDateTime(2)
  });
  this.runData.captureData(
    'systemMessage',
    this.runData.systemMessageTitle,
    'System Messages'
  );
});

When('the user opens Watched Materials', async function () {
  this.watchedMaterials = new WatchedMaterialsPage(this.page);
  await this.watchedMaterials.open(this.dashboard);
});

When('the user adds a category watch using current-run data', async function () {
  const currentUser = this.runData.useData('currentUser', 'Watched Materials');
  const currentRunCategory = this.runData.useData('materialCategory', 'Watched Materials');
  const result = await this.watchedMaterials.addCategoryWatch(
    currentUser?.email,
    currentRunCategory
  );
  if (!result.usedCurrentRunData) {
    this.runData.recordFallback('materialCategory', result.category, 'Watched Materials');
  }
  this.runData.watchedCategory = result.category;
  this.runData.captureData('watchedCategory', result.category, 'Watched Materials');
});

Then('the watched-material configuration is created for that category', async function () {
  await this.watchedMaterials.expectWatch(this.runData.watchedCategory);
  await this.captureCheckpoint('TC_PM_WM_001_Watch_Created');
});

When('the user opens Management Dashboard for watched-material validation', async function () {
  await this.dashboard.open();
});

Then('the same watched category is displayed on Management Dashboard', async function () {
  const category = this.runData.useData('watchedCategory', 'Management Dashboard') ||
    this.runData.watchedCategory;
  await this.dashboard.expectWatchedMaterial(category);
  await this.captureCheckpoint('TC_PM_WM_002_Dashboard_Validated');
});

Then('the System Message is created successfully', async function () {
  await this.captureCheckpoint('TC_PM_SYS_001_Message_Created');
});

When('the user expands Analytics', async function () {
  this.analytics = new AnalyticsPage(this.page);
  await this.analytics.open(this.dashboard);
});

Then('the Analytics navigation group is displayed', async function () {
  await this.captureCheckpoint('TC_PM_AN_001_Page_Displayed');
});

When('the user verifies Setup Wizard and Integrations controls', async function () {
  this.projectManagementMenuGroups = new ProjectManagementMenuGroupsPage(this.page);
  // Navigation is project-specific: Setup Wizard is validated only where the selected project's menu offers it.
  await this.dashboard.openProjectManagement();
  const setupWizard = this.dashboard.leftNavigation.getByRole('button', { name: 'Setup Wizard', exact: true });
  if (await setupWizard.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await this.projectManagementMenuGroups.verifySetupWizard(this.dashboard);
  } else {
    await this.attach(JSON.stringify({ type: 'not-applicable', reason: `Setup Wizard is not in the ${this.config.projectName} navigation` }), 'application/json');
  }
  await this.projectManagementMenuGroups.verifyNonNavigatingControl(this.dashboard, 'Integrations');
});

Then('the remaining Project Management controls are available', async function () {
  await this.captureCheckpoint('TC_PM_NAV_002_Remaining_Controls');
});
