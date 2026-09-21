const { importError } = require('../import/import-errors');

function hwpxError(code, message, details = {}) {
  return importError(code, message, details);
}

module.exports = { hwpxError };
