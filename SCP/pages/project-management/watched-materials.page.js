const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class WatchedMaterialsPage extends BasePage {
  constructor(page) {
    super(page);
    this.main = page.locator('main');
    this.userFilter = this.main.locator('select').first();
    this.addWatchButton = page.getByRole('button', { name: /Add watch/i });
    this.projectUsers = [];
  }

  async open(dashboard) {
    const projectUsersResponse = this.page.waitForResponse((response) =>
      response.status() === 200 &&
      response.url().includes('/api/project_user/get_users_by_project/'),
    { timeout: 30000 });
    await dashboard.openProjectManagementModule('Watched Materials', 'watched-materials', 'Watched Materials');
    await expect(this.userFilter).toBeVisible();
    const usersPayload = await (await projectUsersResponse).json();
    this.projectUsers = Array.isArray(usersPayload?.data) ? usersPayload.data : [];
  }

  async selectCurrentUser(email) {
    if (!email) throw new Error('The currently logged-in user email is required for Watched Materials.');
    await expect.poll(
      () => this.userFilter.locator('option').evaluateAll((nodes) => nodes.filter((node) => node.value).length),
      { message: 'Watched Materials should load at least one selectable user', timeout: 30000 }
    ).toBeGreaterThan(0);
    const currentUser = this.projectUsers.find((user) =>
      String(user.user_email_id || '').toLowerCase() === String(email).toLowerCase());
    if (!currentUser?.project_user_id) {
      throw new Error(`Watched Materials did not contain the logged-in user ${email}.`);
    }
    await this.userFilter.selectOption(currentUser.project_user_id);
    await expect(this.userFilter).toHaveValue(currentUser.project_user_id);
    await this.pauseAfterOperation();
    return {
      email: currentUser.user_email_id,
      name: currentUser.user_name,
      projectUserId: currentUser.project_user_id
    };
  }

  watchRow(category) {
    return this.page.locator('tr').filter({ hasText: category }).first();
  }

  async addCategoryWatch(currentUserEmail, preferredCategory) {
    const user = await this.selectCurrentUser(currentUserEmail);
    if (preferredCategory && await this.watchRow(preferredCategory).isVisible().catch(() => false)) {
      return { user, category: preferredCategory, created: false, usedCurrentRunData: true };
    }

    const selects = this.main.locator('select');
    const typeSelect = selects.nth(1);
    const categorySelect = selects.nth(2);
    await expect(typeSelect).toBeVisible({ timeout: 30000 });
    await typeSelect.selectOption('category');
    await expect(typeSelect).toHaveValue('category');
    await expect(categorySelect).toBeVisible({ timeout: 30000 });
    await expect.poll(
      () => categorySelect.locator('option').evaluateAll((options) => options.filter((option) => option.value).length),
      { message: 'Watched Materials should load at least one selectable category', timeout: 30000 }
    ).toBeGreaterThan(0);

    const categories = await categorySelect.locator('option').evaluateAll((options) => options
      .map((option) => ({ value: option.value, label: option.textContent.trim() }))
      .filter((option) => option.value));
    const currentRunCategory = preferredCategory
      ? categories.find((option) => option.label === preferredCategory || option.value === preferredCategory)
      : null;
    let selectedCategory = currentRunCategory;
    if (!selectedCategory) {
      for (const category of categories) {
        if (!(await this.watchRow(category.label).isVisible().catch(() => false))) {
          selectedCategory = category;
          break;
        }
      }
    }
    if (!selectedCategory) throw new Error('Watched Materials did not contain a selectable category.');

    await categorySelect.selectOption(selectedCategory.value);
    await expect(categorySelect).toHaveValue(selectedCategory.value);
    await this.pauseAfterOperation();

    const addResponsePromise = this.page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      /\/api\/user_material_watch\/?(?:\?|$)/i.test(response.url()),
    { timeout: 30000 });
    await this.clickFirstVisible([
      { locator: this.addWatchButton, label: 'Add watch' }
    ], 'Add watch', 10000);
    const addResponse = await addResponsePromise;
    expect(addResponse.ok(), `Adding watched category ${selectedCategory.label} failed with HTTP ${addResponse.status()}`)
      .toBeTruthy();
    await this.expectWatch(selectedCategory.label);
    return {
      user,
      category: selectedCategory.label,
      created: true,
      usedCurrentRunData: Boolean(currentRunCategory)
    };
  }

  async expectWatch(category) {
    const row = this.watchRow(category);
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row).toContainText(/category/i);
    await expect(row).toContainText(category);
  }
}

module.exports = { WatchedMaterialsPage };
