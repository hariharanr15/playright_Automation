const fs = require('fs');
const path = require('path');

const SEQUENCE_PATH = path.resolve(__dirname, '..', 'test-results', 'scp-data-sequence.json');

function readSequenceState() {
  if (fs.existsSync(SEQUENCE_PATH)) {
    const stored = JSON.parse(fs.readFileSync(SEQUENCE_PATH, 'utf8'));
    return {
      current: Number(stored.current) || 0,
      runs: Number(stored.runs) || 0
    };
  }

  return { current: 0, runs: 0 };
}

function nextUniqueSequence(counter = 'current') {
  const state = readSequenceState();
  state[counter] = (Number(state[counter]) || 0) + 1;
  fs.mkdirSync(path.dirname(SEQUENCE_PATH), { recursive: true });
  fs.writeFileSync(SEQUENCE_PATH, JSON.stringify(state, null, 2), 'utf8');
  return state[counter];
}

function createRunData(domain = process.env.SCP_TEST_EMAIL_DOMAIN || 'yopmail.com', saved, changed = () => {}) {
  const runId = saved?.runId || String(nextUniqueSequence('runs'));
  const invitationEmail = `fdiuser${runId}@${domain}`;
  const automationData = saved?.automationData || {};
  const dataUsage = saved?.dataUsage || [];
  const createdRecords = saved?.createdRecords || [];
  const sequences = saved?.sequences || []; let sequenceIndex = 0;
  const runData = {
    runId,
    sequences,
    nextSequence: () => {
      if (sequences[sequenceIndex] === undefined) sequences[sequenceIndex] = nextUniqueSequence('current');
      const value = sequences[sequenceIndex++]; changed(); return value;
    },
    automationData,
    dataUsage,
    captureData(key, value, source) {
      automationData[key] = { value, source };
      createdRecords.push({ key, value, source });
      dataUsage.push({ key, action: 'captured', module: source });
      changed();
      return value;
    },
    useData(key, consumer) {
      const entry = automationData[key];
      if (!entry) return undefined;
      dataUsage.push({ key, action: 'reused', module: consumer, source: entry.source });
      return entry.value;
    },
    recordFallback(key, value, consumer) {
      if (!automationData[key]) {
        automationData[key] = {
          value,
          source: `Fallback captured by ${consumer}`,
          fallback: true
        };
      }
      dataUsage.push({ key, action: 'fallback', module: consumer, value });
      return value;
    },
    invitationEmail,
    invitedUser: {
      email: invitationEmail,
      password: process.env.SCP_INVITED_USER_PASSWORD || null,
      firstName: 'FDI',
      lastName: `User${runId}`,
      phoneNumber: '9988778899',
      addressLine1: 'First Main Road',
      addressLine2: 'Second Lane',
      state: 'Tamil Nadu',
      city: 'Chennai',
      country: 'India',
      postalCode: '600001'
    },
    fdiQuestion: `FDI Question ${runId}`,
    createdRecords
  };
  runData.captureData('invitationEmail', invitationEmail, 'Run initialization');
  runData.captureData('fdiQuestion', runData.fdiQuestion, 'Run initialization');
  return runData;
}

// variant > 1 gives the next identity for the same run when the server reports the number already exists.
function createProcurementLogData(runId, variant = 1) {
  const base = String(runId).padStart(3, '0');
  const sequence = variant > 1 ? `${base}-${String(variant).padStart(2, '0')}` : base;
  const year = new Date().getFullYear();

  return {
    specificationNumber: `SPEC-${year}-${sequence}`,
    description: `Structural Steel Material Specification ${sequence}`,
    scheduleNumber: `${year}${sequence.replace('-', '')}`,
    submittalNumber: `SUB-${year}-${sequence}`,
    procurementRunId: String(runId),
    procurementVariant: variant
  };
}

function createInventoryData() {
  const { randomUUID, randomInt } = require('crypto');
  const id = randomUUID().replace(/-/g, '').slice(0, 16);
  const quantity = randomInt(20, 100);
  return {
    material: `Inventory QA ${id}`,
    supplier: `Inventory Supplier ${id}`,
    supplierDetails: {
      name: `Inventory Supplier ${id}`, contact: `QA ${id.slice(0, 8)}`,
      email: `inventory-${id}@example.com`, phone: `9${randomInt(100000000, 1000000000)}`
    },
    specificationNumber: `INV-SPEC-${id}`,
    description: `Inventory manual entry ${id}`,
    scheduleNumber: BigInt(`0x${id}`).toString(),
    submittalNumber: `INV-SUB-${id}`,
    purchaseOrderNumber: `INV-PO-${id}`,
    comments: `Inventory QA activity ${id}`,
    quantity,
    movementQuantity: Math.floor(quantity / 4),
    componentQuantity: String(quantity * 4),
    componentValue: String(quantity * randomInt(2, 20)),
    lotQuantity: String(quantity * 4),
    leadTime: String(randomInt(1, 5))
  };
}

module.exports = { createProcurementLogData, createRunData, nextUniqueSequence, createInventoryData };
