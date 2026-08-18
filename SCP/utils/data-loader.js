const fs = require('fs');

function loadJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse JSON file ${filePath}: ${error.message}`);
  }
}

module.exports = { loadJsonFile };
