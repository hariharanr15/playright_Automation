class DropdownComponent {
  constructor(page) {
    this.page = page;
  }

  async selectByLabel(label, optionText) {
    const control = this.page
      .getByLabel(new RegExp(label, 'i'))
      .or(this.page.getByRole('combobox', { name: new RegExp(label, 'i') }))
      .first();

    await control.waitFor({ state: 'visible', timeout: 15000 });
    await control.click();

    const option = this.page
      .getByRole('option', { name: new RegExp(optionText, 'i') })
      .or(this.page.getByText(new RegExp(`^${optionText}$`, 'i')))
      .first();

    await option.waitFor({ state: 'visible', timeout: 15000 });
    await option.click();
  }
}

module.exports = { DropdownComponent };
