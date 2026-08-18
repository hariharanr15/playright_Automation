class ToastComponent {
  constructor(page) {
    this.page = page;
    this.toast = page.locator(
      '.MuiAlert-root, [role="alert"], .Toastify__toast, [class*="toast" i], [class*="snackbar" i]'
    );
  }

  async waitForMessage(pattern, timeout = 15000) {
    const matcher = pattern instanceof RegExp ? pattern : new RegExp(String(pattern), 'i');
    await this.toast.filter({ hasText: matcher }).first().waitFor({ state: 'visible', timeout });
    return this.latestMessages();
  }

  async latestMessages() {
    return this.toast.evaluateAll((elements) =>
      elements
        .map((element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    ).catch(() => []);
  }
}

module.exports = { ToastComponent };
