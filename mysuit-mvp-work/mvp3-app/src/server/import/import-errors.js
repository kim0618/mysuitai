function importError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, details });
}

module.exports = { importError };
