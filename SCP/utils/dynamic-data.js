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

function createRunData(domain = process.env.SCP_TEST_EMAIL_DOMAIN || 'yopmail.com') {
  const runId = String(nextUniqueSequence('runs'));
  const invitationEmail = `fdiuser${runId}@${domain}`;
  const automationData = {};
  const dataUsage = [];
  const createdRecords = [];
  const runData = {
    runId,
    nextSequence: () => nextUniqueSequence('current'),
    automationData,
    dataUsage,
    captureData(key, value, source) {
      automationData[key] = { value, source };
      createdRecords.push({ key, value, source });
      dataUsage.push({ key, action: 'captured', module: source });
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
      password: process.env.SCP_INVITED_USER_PASSWORD || 'Master@15',
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

function createProcurementLogData(runId) {
  const sequence = String(runId).padStart(3, '0');
  const year = new Date().getFullYear();

  return {
    specificationNumber: `SPEC-${year}-${sequence}`,
    description: `Structural Steel Material Specification ${sequence}`,
    scheduleNumber: `${year}${sequence}`,
    submittalNumber: `SUB-${year}-${sequence}`
  };
}

module.exports = { createProcurementLogData, createRunData, nextUniqueSequence };
