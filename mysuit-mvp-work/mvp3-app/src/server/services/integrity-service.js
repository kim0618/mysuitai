const fs = require('fs');
const crypto = require('crypto');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function assertHash(file, expected) {
  const actual = sha256File(file);
  if (actual !== expected) {
    const error = new Error('원본 폼 해시가 변경되었습니다.');
    error.code = 'ORIGINAL_HASH_CHANGED';
    throw error;
  }
  return actual;
}

module.exports = { sha256File, assertHash };
