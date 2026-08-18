const assert = require('assert');
const { Given, Then, When } = require('@cucumber/cucumber');

function generatedInviteEmail() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  return `cucumber-${timestamp}@yopmail.com`;
}

Given('I log in to the Construction Delivery application', async function () {
  await this.userManagement.login();
});

Given('I select the configured Construction Delivery project', async function () {
  await this.userManagement.navigateToProjectLocation();
});

Given('I open the User Management page from the left navigation', async function () {
  await this.userManagement.navigateToUserManagement();
  await this.page.getByRole('button', { name: /Invite Users/i }).waitFor({ state: 'visible', timeout: 30000 });
});

When('I open the Invite Users popup', async function () {
  this.inviteModal = await this.userManagement.openInviteUsersModal();
  await this.inviteModal.locator('#email').waitFor({ state: 'visible', timeout: 15000 });
});

When('I enter the following invite details:', async function (dataTable) {
  assert(this.inviteModal, 'Invite Users form must be open before filling user details.');

  const users = dataTable.hashes().map((row) => ({
    email: /^generated$/i.test(row.email || '') ? generatedInviteEmail() : row.email,
    organization: row.organization || this.userManagement.options.organization,
    role: row.role || this.userManagement.options.role
  }));

  this.userManagement.validateInviteUserDataset(users);
  this.preparedUsers = await this.userManagement.prepareUsersForCreation(users);

  for (let index = 0; index < this.preparedUsers.length; index += 1) {
    if (index > 0) {
      await this.userManagement.addInviteUserRow(this.inviteModal, index + 1);
    }
    await this.userManagement.fillInviteUserRow(this.inviteModal, this.preparedUsers[index], index);
  }

  await this.userManagement.captureUserManagementScreenshot(
    'cucumber-user-management-invite-form',
    this.preparedUsers.map((user) => user.email).join('-')
  );
});

Then('the Invite Users popup should show the prepared user email', async function () {
  assert(this.preparedUsers.length > 0, 'Expected at least one prepared invite user.');

  for (let index = 0; index < this.preparedUsers.length; index += 1) {
    const user = this.preparedUsers[index];
    const emailInput = index === 0
      ? this.inviteModal.locator('#email').first()
      : this.inviteModal.locator(`input[name="email:${index + 1}"]`).first();
    const actualEmail = await emailInput.inputValue();
    assert(
      actualEmail === user.email,
      `Expected invite email field to contain ${user.email}; actual value was ${actualEmail || 'blank'}`
    );
  }
});

Then('the automation must stop before clicking Send Invites', async function () {
  assert.strictEqual(this.inviteSubmitted, false, 'The scenario should not submit an invite.');
  const sendInvitesButton = this.userManagement.getSendInvitesButton(this.inviteModal);
  await sendInvitesButton.waitFor({ state: 'visible', timeout: 15000 });
});

When('I send the invite', async function () {
  if (!/^(1|true|yes)$/i.test(process.env.CUCUMBER_SEND_INVITES || '')) {
    throw new Error('Set CUCUMBER_SEND_INVITES=1 to allow this step to click Send Invites.');
  }

  await this.userManagement.clickSendInvites(this.inviteModal);
  await this.userManagement.waitForInviteSuccessNotification();
  this.inviteSubmitted = true;
});
