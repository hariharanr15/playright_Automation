const fs = require('fs');
const path = require('path');

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1;
      row.push(field);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = String(row[index] || '').trim();
    });
    return record;
  });
}

function getFirst(record, keys) {
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    if (record[normalizedKey]) return record[normalizedKey];
  }
  return '';
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ')
  };
}

function normalizeAccount(record, index, defaults = {}) {
  const fullName = getFirst(record, ['name', 'full name', 'user name', 'username']);
  const split = splitName(fullName);
  const firstName = getFirst(record, ['first name', 'firstname', 'first']) || split.firstName;
  const lastName = getFirst(record, ['last name', 'lastname', 'surname', 'last']) || split.lastName;
  const name = fullName || [firstName, lastName].filter(Boolean).join(' ');
  const email = getFirst(record, ['email', 'email id', 'email address', 'mail']);
  const mobile = getFirst(record, ['mobile', 'mobile number', 'phone', 'phone number', 'contact number']);
  const address = getFirst(record, ['address', 'street address']);
  const organization = getFirst(record, ['organization', 'organisation', 'associated organization']) || defaults.organization;
  const role = getFirst(record, ['role', 'user role', 'project role']) || defaults.role;
  const password = getFirst(record, ['password', 'new password', 'account password']) || defaults.password;
  const changeOrganization = getFirst(record, [
    'new organization',
    'new organisation',
    'change organization',
    'change organisation',
    'target organization',
    'target organisation'
  ]) || defaults.changeOrganization || '';

  const missingFields = [];
  if (!email) missingFields.push('email');
  if (!organization) missingFields.push('organization');
  if (!role) missingFields.push('role');

  if (missingFields.length) {
    throw new Error(`User account row ${index + 2} is missing: ${missingFields.join(', ')}.`);
  }

  const setupMissingFields = [];
  if (!name && !firstName) setupMissingFields.push('name or firstName');
  if (!mobile) setupMissingFields.push('mobile');
  if (!address) setupMissingFields.push('address');

  return {
    name: name || firstName || email.split('@')[0],
    firstName,
    lastName,
    email,
    mobile,
    address,
    organization,
    changeOrganization,
    role,
    password,
    setupMissingFields
  };
}

function incrementEmailAddress(email, incrementBy = 1) {
  const match = String(email || '').trim().match(/^([^@]+)@(.+)$/);
  if (!match) return email;

  const [, localPart, domain] = match;
  const numericSuffix = localPart.match(/^(.*?)(\d+)$/);
  const nextLocalPart = numericSuffix
    ? `${numericSuffix[1]}${Number(numericSuffix[2]) + incrementBy}`
    : `${localPart}${incrementBy}`;

  return `${nextLocalPart}@${domain}`;
}

function readXlsx(filePath) {
  let xlsx;
  try {
    xlsx = require('xlsx');
  } catch {
    throw new Error(
      'Excel .xlsx files require the xlsx package. Install it with "npm install xlsx", or provide a CSV/JSON file with the same columns.'
    );
  }

  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
    .map((record) => Object.fromEntries(
      Object.entries(record).map(([key, value]) => [normalizeHeader(key), String(value || '').trim()])
    ));
}

function readRecords(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.xlsx' || extension === '.xls') {
    return readXlsx(filePath);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (extension === '.json') {
    const parsed = JSON.parse(content);
    const records = Array.isArray(parsed) ? parsed : parsed.users;
    if (!Array.isArray(records)) {
      throw new Error('JSON user accounts file must be an array or an object with a users array.');
    }
    return records.map((record) => Object.fromEntries(
      Object.entries(record).map(([key, value]) => [normalizeHeader(key), String(value || '').trim()])
    ));
  }

  return rowsToObjects(parseCsv(content));
}

function loadUserAccountsFromFile(filePath, defaults = {}) {
  if (!filePath) {
    throw new Error('Set USER_ACCOUNTS_FILE to the Excel/CSV/JSON file containing valid user account details.');
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`User accounts file does not exist: ${resolvedPath}`);
  }

  const accounts = readRecords(resolvedPath)
    .filter((record) => Object.values(record).some((value) => String(value).trim()))
    .map((record, index) => normalizeAccount(record, index, defaults));

  if (!accounts.length) {
    throw new Error(`User accounts file has no user rows: ${resolvedPath}`);
  }

  const seenEmails = new Set();
  for (const account of accounts) {
    let normalizedEmail = account.email.toLowerCase();
    let counter = 1;
    if (seenEmails.has(normalizedEmail)) {
      const originalEmail = account.email;
      do {
        account.email = incrementEmailAddress(originalEmail, counter);
        normalizedEmail = account.email.toLowerCase();
        counter += 1;
      } while (seenEmails.has(normalizedEmail));
      console.log(`Duplicate email found in user accounts file; using ${account.email} instead of ${originalEmail}.`);
    }
    seenEmails.add(normalizedEmail);
  }

  return accounts;
}

module.exports = { loadUserAccountsFromFile };
