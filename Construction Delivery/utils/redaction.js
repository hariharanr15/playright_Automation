function redactSensitiveCodes(value) {
  return String(value ?? '')
    .replace(/(\/dashboard\/projects\/)[^/?#\s"'<>\\]+/gi, '$1[PROJECT-CODE-HIDDEN]')
    .replace(/(stg-app\.voyagecontrol\.com\/)[A-Z0-9]{6,}(?=\/)/gi, '$1[PROJECT-CODE-HIDDEN]')
    .replace(/\/([A-Z]{1,4}\d{6,})(?=\/(?:home|booking|calendar|equipment|dashboard|site-details|availability|settings|country|vehicle-emission)\b)/gi, '/[PROJECT-CODE-HIDDEN]')
    .replace(/\bBK[A-Z0-9]{8,}\b/g, '[BOOKING-REF-HIDDEN]')
    .replace(/\bWonderla[_-]?[A-Za-z0-9_-]*\b/gi, '[SUPERADMIN-PROJECT-HIDDEN]')
    .replace(/\buser\d+_[A-Za-z0-9._%+-]+@yopmail\.com\b/gi, '[SUPERADMIN-INVITE-HIDDEN]')
    .replace(/\bUser\d+@yopmail\.com\b/g, '[GENERATED-USER-HIDDEN]');
}

module.exports = { redactSensitiveCodes };
