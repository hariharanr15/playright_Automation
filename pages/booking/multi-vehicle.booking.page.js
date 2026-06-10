const { DeliveryBookingPage } = require('./delivery.booking.page');

class MultiVehicleBookingPage extends DeliveryBookingPage {
  constructor(page, options = {}) {
    super(page, {
      bookingTypeIndex: 2,
      bookingTypeLabel: 'Multi-Vehicle',
      ...options
    });
  }

  async selectMultiVehicleBookingType() {
    await this.selectBookingType();
  }

  async createMultiVehicleBooking() {
    await this.createDeliveryBooking();
  }
}

module.exports = { MultiVehicleBookingPage };
