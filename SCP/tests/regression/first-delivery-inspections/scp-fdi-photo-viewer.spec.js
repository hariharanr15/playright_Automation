const { test, expect } = require('../../support/test-base');
const { FirstDeliveryInspectionsPage } = require('../../../pages/first-delivery-inspections/first-delivery-inspections.page');

test('FDI photos: upload PNG/JPG and browse thumbnails in draft and completed report', async ({ scpProject }, testInfo) => {
  const submittal = process.env.SCP_FDI_PHOTO_SUBMITTAL;
  test.skip(!submittal, 'Set SCP_FDI_PHOTO_SUBMITTAL to a dedicated draft assigned to the current inspector with photo uploads enabled');
  const { page, dashboard, config } = scpProject;
  const inspections = new FirstDeliveryInspectionsPage(page, config);
  await inspections.open(dashboard);
  const row = inspections.rows().filter({ hasText: submittal }).first();
  await inspections.openReport(row);
  await expect(page.getByRole('button', { name: 'Add photo', exact: true })).toBeVisible();
  const png = testInfo.outputPath('inspection.png');
  const jpg = testInfo.outputPath('inspection.jpg');
  await page.screenshot({ path: png });
  await inspections.uploadPhoto(png);
  await page.screenshot({ path: jpg });
  await inspections.uploadPhoto(jpg);
  await inspections.expectPhotoViewer(inspections.photoThumbnails());
  await inspections.saveProgress();
  if (process.env.SCP_FDI_PHOTO_COMPLETE === 'true') {
    await inspections.fillReport(`photo-${Date.now()}`);
    await inspections.submit();
    await inspections.expectPhotoViewer(inspections.photoThumbnails());
  } else {
    testInfo.annotations.push({ type: 'coverage-gap', description: 'Completed photo view requires SCP_FDI_PHOTO_COMPLETE=true; it completes this dedicated record' });
  }
});
