const fs = require('fs');
const path = require('path');

function findUploadFixture() {
  const candidates = [
    process.env.VC_UPLOAD_FIXTURE,
    path.resolve('fixtures', 'sample-upload.pdf'),
    path.resolve('PDF download', 'booking-list-filtered-1779881664763.pdf'),
    path.resolve('PDF download', 'booking-list-filtered-1779883715286.pdf'),
    path.resolve('screenshots', 'full_app_TC-01_2026-05-26T04-55-24-223Z.png')
  ].filter(Boolean);

  const fixture = candidates.find((candidate) => fs.existsSync(candidate));
  if (!fixture) {
    throw new Error('No upload fixture was found. Set VC_UPLOAD_FIXTURE to a valid PDF or image file.');
  }

  return fixture;
}

async function uploadRequiredFiles(page, label = 'Required file upload') {
  const fileInputs = page.locator('input[type="file"]');
  const count = await fileInputs.count();
  if (count === 0) {
    return 0;
  }

  const fixture = findUploadFixture();
  for (let index = 0; index < count; index += 1) {
    await fileInputs.nth(index).setInputFiles(fixture);
  }

  await page.waitForTimeout(1000);
  console.log(`${label}: uploaded ${path.basename(fixture)} to ${count} file input(s).`);
  return count;
}

module.exports = { uploadRequiredFiles };
