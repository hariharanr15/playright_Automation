class PaginationComponent {
  constructor(page) {
    this.page = page;
    this.nextButton = page
      .getByRole('button', { name: /next|go to next page/i })
      .or(page.locator('[aria-label*="next" i], button:has-text(">")'))
      .first();
    this.previousButton = page
      .getByRole('button', { name: /previous|go to previous page/i })
      .or(page.locator('[aria-label*="previous" i], button:has-text("<")'))
      .first();
  }

  async canGoNext() {
    return this.nextButton.isVisible({ timeout: 2000 })
      .then(() => this.nextButton.isEnabled())
      .catch(() => false);
  }

  async goNext() {
    if (!(await this.canGoNext())) return false;
    await this.nextButton.click();
    return true;
  }

  async canGoPrevious() {
    return this.previousButton.isVisible({ timeout: 2000 })
      .then(() => this.previousButton.isEnabled())
      .catch(() => false);
  }
}

module.exports = { PaginationComponent };
