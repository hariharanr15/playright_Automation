const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');
const { clickHighlighted } = require('../../utils/highlight');

class FirstDeliveryInspectionConfigPage extends BasePage {
  constructor(page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'First Delivery Inspection Config', exact: true });
    this.inviteButton = page.getByRole('button', { name: 'Invite', exact: true });
    this.addQuestionButton = page.getByRole('button', { name: 'Add Question', exact: true });
    this.settings = [
      'Need Overall Notes to be captured',
      'Enable Uploading of Photos?',
      'Photos are mandatory?',
      'Provide Link to Submittal Spec Documents?'
    ];
  }

  async open(dashboard) {
    await dashboard.openProjectManagementModule(
      'First Delivery Inspection Config',
      'first-delivery-inspection-config',
      'First Delivery Inspection Config'
    );
    await expect(this.inviteButton).toBeVisible();
    const loadedToast = this.page.getByText('Project configuration loaded successfully', { exact: true });
    await loadedToast.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
    await loadedToast.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => null);
  }

  async changeAndSaveOneSetting() {
    await this.expectSettingsSection();
    const checkboxes = this.settings.map((name) => this.page.getByRole('checkbox', { name, exact: true }));
    for (const checkbox of checkboxes) {
      await expect(checkbox).toBeVisible();
    }

    const states = await Promise.all(checkboxes.map((checkbox) => checkbox.isChecked()));
    const indexToChange = states.every(Boolean) ? 0 : states.findIndex((checked) => !checked);
    const expectedChecked = !states[indexToChange];
    const checkbox = checkboxes[indexToChange];
    const label = this.page.getByText(this.settings[indexToChange], { exact: true });

    await clickHighlighted(label, this.settings[indexToChange]);
    if (expectedChecked) {
      await expect(checkbox).toBeChecked();
    } else {
      await expect(checkbox).not.toBeChecked();
    }
    // The save must complete before the reload, or the reload can cancel it.
    const saved = this.page.waitForResponse(response => !['GET', 'HEAD', 'OPTIONS'].includes(response.request().method()) &&
      new URL(response.url()).pathname.startsWith('/api/'), { timeout: 15000 });
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Save', exact: true }), label: 'Save FDI Settings' }
    ], 'Save FDI Settings', 10000);
    const response = await saved;
    expect(response.ok(), `Saving FDI Settings returned HTTP ${response.status()}`).toBe(true);

    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.waitForReady();
    // Checkboxes render unchecked until the saved settings load; read them only once the values stop changing.
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    const read = () => Promise.all(this.settings.map(name => this.page.getByRole('checkbox', { name, exact: true }).isChecked()));
    let previous = await read();
    for (let i = 0; i < 10; i += 1) {
      await this.page.waitForTimeout(1000);
      const current = await read();
      if (JSON.stringify(current) === JSON.stringify(previous) && current.some(Boolean)) break;
      previous = current;
    }
    const persisted = this.page.getByRole('checkbox', { name: this.settings[indexToChange], exact: true });
    if (expectedChecked) {
      await expect(persisted).toBeChecked();
    } else {
      await expect(persisted).not.toBeChecked();
    }

    const persistedStates = {};
    for (const settingName of this.settings) {
      persistedStates[settingName] = await this.page.getByRole('checkbox', {
        name: settingName,
        exact: true
      }).isChecked();
    }

    return {
      name: this.settings[indexToChange],
      checked: expectedChecked,
      states: persistedStates
    };
  }

  setting(name) {
    if (!this.settings.includes(name)) throw new Error(`Unknown FDI setting: ${name}`);
    return this.page.getByRole('checkbox', { name, exact: true });
  }

  async expectSettingsSection() {
    await expect(this.page.getByRole('heading', { name: 'FDI Settings', exact: true })).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Notification Settings', exact: true })).toHaveCount(0);
    for (const name of this.settings) await expect(this.setting(name)).toBeVisible();
  }

  async readSettings() {
    const states = {};
    for (const name of this.settings) states[name] = await this.setting(name).isChecked();
    return states;
  }

  async saveSettings(states) {
    for (const name of this.settings) {
      if (typeof states[name] !== 'boolean') throw new Error(`Missing boolean FDI setting: ${name}`);
    }
    if (states['Photos are mandatory?'] && !states['Enable Uploading of Photos?']) {
      throw new Error('Mandatory photos require photo uploads to be enabled.');
    }
    // Disable the dependent setting first; enable uploads before enabling mandatory photos.
    if (!states['Photos are mandatory?'] && await this.setting('Photos are mandatory?').isChecked()) {
      await this.setting('Photos are mandatory?').uncheck();
    }
    for (const name of this.settings) {
      const checkbox = this.setting(name);
      if (await checkbox.isChecked() !== states[name]) await checkbox.setChecked(states[name]);
    }
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(this.page.getByText(/configuration.*saved successfully|settings.*saved successfully/i).first())
      .toBeVisible({ timeout: 30000 });
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.waitForReady();
    await this.expectSettings(states);
  }

  async expectSettings(states) {
    for (const name of this.settings) await expect(this.setting(name)).toBeChecked({ checked: states[name] });
  }

  async expectPhotoDependency() {
    await this.setting('Enable Uploading of Photos?').uncheck();
    const mandatory = this.setting('Photos are mandatory?');
    // AC6 allows either an automatically corrected control or a validation error.
    await expect.poll(async () => (
      !(await mandatory.isChecked()) ||
      await this.page.getByRole('alert').filter({ hasText: /photo|upload/i }).isVisible()
    ), { message: 'Disabling uploads must clear mandatory photos or display a configuration error' }).toBe(true);
    if (await mandatory.isChecked()) {
      await this.page.getByRole('button', { name: 'Save', exact: true }).click();
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      const saved = await this.readSettings();
      expect(saved['Photos are mandatory?'] && !saved['Enable Uploading of Photos?'],
        'A contradictory photo configuration must not be persisted').toBe(false);
    }
  }

  async verifyBlankQuestionIsRejected() {
    await this.clickFirstVisible([{ locator: this.addQuestionButton, label: 'Add Question' }], 'Add Question', 10000);
    const modalHeading = this.page.getByRole('heading', { name: 'Add Question', exact: true });
    await expect(modalHeading).toBeVisible();
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add question' }
    ], 'Add question', 5000);
    await expect(modalHeading, 'Blank FDI question must not be submitted').toBeVisible();
  }

  async addQuestion(questionText, answerType = 'text') {
    const questionInput = this.fieldBesideLabel('Question Text');
    await this.fillVisible(questionInput, questionText, 'FDI question text');
    const answerTypeDropdown = this.page.getByRole('button', { name: 'Choose Answer Type', exact: true });
    await this.selectDropdownOption(answerTypeDropdown, answerType, 'FDI answer type');
    const selectedAnswerType = `${answerType.charAt(0).toUpperCase()}${answerType.slice(1)}`;
    await expect(this.page.getByRole('button', { name: selectedAnswerType, exact: true })).toBeVisible();
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add question' }
    ], 'Add question', 10000);
    await expect(this.page.getByRole('button', { name: questionText, exact: true })).toBeVisible({ timeout: 20000 });
  }

  async verifyBlankInvitationIsRejected() {
    await this.clickFirstVisible([{ locator: this.inviteButton, label: 'Invite' }], 'Invite', 10000);
    const sendInvites = this.page.getByRole('button', { name: 'Send Invites', exact: true });
    await expect(sendInvites, 'Blank invitation must remain disabled').toBeDisabled();
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Cancel', exact: true }), label: 'Cancel invitation' }
    ], 'Cancel invitation', 5000);
  }

  normalizeOption(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  async selectInviteOption(triggerName, requestedOptions, label) {
    await this.clickFirstVisible([{
      locator: this.page.getByRole('button', { name: triggerName, exact: true }),
      label
    }], label, 10000);

    const options = this.page.locator('[role="option"]:visible');
    await options.first().waitFor({ state: 'visible', timeout: 15000 });
    const desired = requestedOptions.map((option) => this.normalizeOption(option));
    const count = await options.count();

    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      const text = (await option.innerText()).replace(/\s+/g, ' ').trim();
      if (desired.includes(this.normalizeOption(text))) {
        await this.clickFirstVisible([{ locator: option, label: text }], `${label} option`, 5000);
        return text;
      }
    }

    throw new Error(`${label} did not contain any of: ${requestedOptions.join(', ')}`);
  }

  async inviteInspector(email, activeOrganization) {
    if (!activeOrganization) {
      throw new Error('The active project organization is required before inviting an FDI inspector.');
    }
    await this.clickFirstVisible([{ locator: this.inviteButton, label: 'Invite' }], 'Invite', 10000);
    await this.fillVisible(
      this.page.getByRole('textbox', { name: 'Enter email address' }),
      email,
      'Inspector email'
    );
    const organization = await this.selectInviteOption(
      'Choose Organization',
      [activeOrganization],
      'Inspector organization/project'
    );
    const role = await this.selectInviteOption(
      'Choose Role',
      ['Project Manager', 'Project Admin'],
      'Inspector role'
    );
    await expect(this.page.getByRole('button', { name: organization, exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: role, exact: true })).toBeVisible();

    const sendInvites = this.page.getByRole('button', { name: 'Send Invites', exact: true });
    await expect(sendInvites).toBeEnabled();
    const inviteCreated = this.page.waitForResponse((response) => (
      response.url().includes('/api/sso/users/invite') &&
      response.request().method() === 'POST'
    ), { timeout: 60000 });
    await this.clickFirstVisible([{ locator: sendInvites, label: 'Send Invites' }], 'Send Invites', 10000);
    const inviteResponse = await inviteCreated;
    expect(inviteResponse.status(), `Invitation API should create ${email}`).toBe(201);
    const invitedUsers = await inviteResponse.json();
    expect(
      invitedUsers.some((user) => String(user.email).toLowerCase() === email.toLowerCase()),
      `Invitation API response should contain ${email}`
    ).toBeTruthy();
    const row = this.page.locator('tr').filter({ hasText: email }).first();
    const sendFailure = this.page.getByText('Failed to send invite.', { exact: true });
    await expect.poll(async () => (
      (await row.isVisible().catch(() => false)) || (await sendFailure.isVisible().catch(() => false))
    ), { message: 'FDI invitation should either create a pending row or display its application error', timeout: 30000 })
      .toBeTruthy();
    if (await sendFailure.isVisible().catch(() => false)) {
      throw new Error(`The SCP application failed to send invitation ${email} for ${organization} / ${role}.`);
    }
    await this.expectPendingInvitation(email);
    await this.page.waitForTimeout(2000);
    return { organization, role };
  }

  async expectPendingInvitation(email) {
    const row = this.inspectorRow(email);
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row).toContainText('Invited - Pending Acceptance');
    await expect(row).toContainText('Disabled');
  }

  async resendPendingInvitation(email, projectReference) {
    if (!projectReference) {
      throw new Error('The active project reference is required to resend an FDI invitation.');
    }

    const membersResponsePromise = this.page.waitForResponse((response) => (
      response.status() === 200 &&
      response.url().includes(`/api/sso/projects/${projectReference}/members/`)
    ), { timeout: 30000 });
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.waitForReady();
    const membersResponse = await membersResponsePromise;
    const body = await membersResponse.json();
    const members = Array.isArray(body) ? body : body.results || [];
    const member = members.find((entry) => (
      String(entry?.user?.email || '').toLowerCase() === String(email).toLowerCase()
    ));
    const invitationId = member?.user?.invitation?.id;
    if (!invitationId) {
      throw new Error(`The pending invitation ID for ${email} was not available.`);
    }

    const sourceHeaders = await membersResponse.request().allHeaders();
    const forwardedHeaders = {};
    for (const name of ['authorization', 'cookie', 'origin', 'referer', 'x-csrftoken', 'x-csrf-token']) {
      if (sourceHeaders[name]) forwardedHeaders[name] = sourceHeaders[name];
    }
    const resendUrl = new URL(
      `/api/sso/users/invite/${invitationId}/resend/`,
      membersResponse.url()
    );
    resendUrl.searchParams.set('project', projectReference);
    const resendResponse = await this.page.request.put(resendUrl.toString(), {
      headers: forwardedHeaders
    });
    expect(
      [200, 201, 204],
      `Resend invitation API should accept ${email}; received ${resendResponse.status()}`
    ).toContain(resendResponse.status());
    return { invitationId, status: resendResponse.status() };
  }

  async ensureReusableAutomationInspector(excludedEmail) {
    const rows = this.page.locator('tr').filter({
      hasText: /fdiuser\d+@yopmail\.com/i
    });
    const candidates = [];
    const count = await rows.count();
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const text = (await row.innerText()).replace(/\s+/g, ' ').trim();
      const email = text.match(/fdiuser(\d+)@yopmail\.com/i)?.[0];
      const sequence = Number(text.match(/fdiuser(\d+)@yopmail\.com/i)?.[1]);
      if (
        email &&
        email.toLowerCase() !== String(excludedEmail || '').toLowerCase() &&
        /\bActive\b/i.test(text)
      ) {
        candidates.push({ email, sequence, row, disabled: /\bDisabled\b/i.test(text) });
      }
    }

    candidates.sort((left, right) => left.sequence - right.sequence);
    const selected = candidates[0];
    if (!selected) {
      throw new Error('No active automation-created FDI user was available as an email-delivery fallback.');
    }

    if (selected.disabled) {
      const enableButton = selected.row.getByRole('button', { name: 'Enable', exact: true });
      await expect(enableButton).toBeEnabled();
      await this.clickFirstVisible([{
        locator: enableButton,
        label: `Enable fallback inspector ${selected.email}`
      }], `Enable fallback inspector ${selected.email}`, 10000);
      await expect(selected.row).toContainText('Enabled', { timeout: 30000 });
    }

    return {
      email: selected.email,
      firstName: 'FDI',
      lastName: `User${selected.sequence}`,
      sequence: selected.sequence
    };
  }

  inspectorRow(identity) {
    return this.page.locator('tr').filter({ hasText: identity }).first();
  }

  selectForLabel(labelText) {
    return this.page.locator('label')
      .filter({ hasText: new RegExp(`^\\s*${labelText}\\s*\\*?\\s*$`, 'i') })
      .first()
      .locator('..')
      .locator('select')
      .first();
  }

  async addExistingInspector() {
    await this.clickFirstVisible([{
      locator: this.page.getByRole('button', { name: 'Add Inspector', exact: true }),
      label: 'Add Inspector'
    }], 'Add Inspector', 10000);
    const modalHeading = this.page.getByRole('heading', { name: 'Add Inspector', exact: true });
    await expect(modalHeading).toBeVisible();

    const memberSelect = this.selectForLabel('Project Member');
    const roleSelect = this.selectForLabel('Project Role');
    await expect(memberSelect).toBeVisible();
    await expect(roleSelect).toBeVisible();

    const existingRows = (await this.page.locator('tr').allInnerTexts())
      .join('\n')
      .toLowerCase();
    const members = await memberSelect.locator('option').evaluateAll((options) => options.map((option) => ({
      value: option.value.trim(),
      text: option.textContent.replace(/\s+/g, ' ').trim()
    })));
    const selectedMember = members.find((member) => (
      member.value &&
      /@/.test(member.value) &&
      !existingRows.includes(member.value.toLowerCase())
    ));
    if (!selectedMember) {
      const configuredInspector = await this.existingAllMaterialsInspector();
      if (!configuredInspector) {
        throw new Error(
          'Add Inspector did not contain a new eligible project member, and no existing active ' +
          'Project Admin/Manager was configured for All Materials.'
        );
      }
      const closeButton = modalHeading.locator('xpath=following-sibling::button[1]');
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
      } else {
        await this.page.keyboard.press('Escape');
      }
      await expect(modalHeading).toBeHidden({ timeout: 10000 });
      return { ...configuredInspector, reused: true };
    }

    await memberSelect.selectOption(selectedMember.value);
    await expect(memberSelect).toHaveValue(selectedMember.value);
    await this.pauseAfterOperation();

    const roles = await roleSelect.locator('option').evaluateAll((options) => options.map((option) => ({
      value: option.value,
      text: option.textContent.replace(/\s+/g, ' ').trim()
    })));
    const selectedRole = roles.find((role) => /^Project Admin$/i.test(role.text)) ||
      roles.find((role) => /^Project Manager$/i.test(role.text));
    if (!selectedRole) {
      throw new Error('Add Inspector did not contain Project Admin or Project Manager.');
    }
    await roleSelect.selectOption(selectedRole.value);
    await expect(roleSelect).toHaveValue(selectedRole.value);
    await this.pauseAfterOperation();

    const allMaterials = this.page.getByRole('radio', { name: 'All Materials', exact: true });
    if (!(await allMaterials.isChecked())) {
      await allMaterials.check();
      await this.pauseAfterOperation();
    }
    await expect(allMaterials).toBeChecked();

    await this.clickFirstVisible([{
      locator: this.page.getByRole('button', { name: 'Add', exact: true }),
      label: 'Add inspector'
    }], 'Add inspector', 10000);
    await expect(modalHeading).toBeHidden({ timeout: 30000 });
    await this.expectInspectorListed(selectedMember.value);
    return {
      email: selectedMember.value,
      member: selectedMember.text,
      role: selectedRole.text,
      materialScope: 'All Materials',
      reused: false
    };
  }

  async existingAllMaterialsInspector() {
    const rows = this.page.locator('tr').filter({ hasText: 'All Materials' });
    const count = await rows.count();
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const text = (await row.innerText()).replace(/\s+/g, ' ').trim();
      const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
      const role = text.match(/Project Admin|Project Manager/i)?.[0];
      if (email && role && /\bActive\b/i.test(text) && /\bEnabled\b/i.test(text)) {
        return {
          email,
          member: text.split(role)[0].trim(),
          role,
          materialScope: 'All Materials'
        };
      }
    }
    return null;
  }

  async expectInspectorListed(identity) {
    const row = this.inspectorRow(identity);
    await expect(row).toBeVisible({ timeout: 30000 });
    return row;
  }

  async expectInspectorConfigured(inspector) {
    const row = await this.expectInspectorListed(inspector.email);
    await expect(row).toContainText(inspector.role);
    await expect(row).toContainText(inspector.materialScope);
    return row;
  }

  async expectInspectorState(email, status, enabledState) {
    const row = await this.expectInspectorListed(email);
    await expect(row).toContainText(status, { timeout: 30000 });
    await expect(row).toContainText(enabledState, { timeout: 30000 });
  }

  async expectActiveAndEnabled(email) {
    await this.expectInspectorState(email, 'Active', 'Enabled');
  }

  async disableInspector(email) {
    const row = await this.expectInspectorListed(email);
    const disableButton = row.getByRole('button', { name: 'Disable', exact: true });
    await expect(disableButton).toBeEnabled();
    await this.clickFirstVisible([{
      locator: disableButton,
      label: `Disable inspector ${email}`
    }], `Disable inspector ${email}`, 10000);

    const dialog = this.page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      const confirm = dialog.getByRole('button', { name: /^(?:Disable|Confirm|Yes)$/i }).last();
      if (await confirm.isVisible().catch(() => false)) {
        await this.clickFirstVisible([{
          locator: confirm,
          label: 'Confirm disable inspector'
        }], 'Confirm disable inspector', 5000);
      }
    }

    await expect(row).toContainText('Disabled', { timeout: 30000 });
    await expect(row.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
  }
}

module.exports = { FirstDeliveryInspectionConfigPage };
