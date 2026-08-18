const { ScpTabPage } = require('./scp-tab.page');

class SecondTabPage extends ScpTabPage {
  constructor(page, tab) {
    super(page, tab);
  }

  async validateDefaultState() {
    await this.expectLoaded();
  }
}

module.exports = { SecondTabPage };
