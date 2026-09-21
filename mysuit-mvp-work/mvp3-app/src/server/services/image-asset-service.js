const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

// Content-addressed store for replacement images. Source patches carry only `asset:<sha256>` references, so
// History snapshots stay small; the Unified Materializer inlines the bytes into UBImage.data at save time.
const ROOT = path.join(config.appRoot, 'data/image-assets');
const MAX_BYTES = 1024 * 1024;
const TYPES = [{ ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] }, { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] }, { ext: 'gif', mime: 'image/gif', magic: [0x47, 0x49, 0x46, 0x38] }];
const REF = /^asset:([a-f0-9]{64})$/, INLINE = /^inline:([a-f0-9]{64})$/;

function fail(code, message, status = 400) { throw Object.assign(new Error(message), { code, status }); }
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const typeOf = (bytes) => TYPES.find((type) => type.magic.every((byte, index) => bytes[index] === byte)) || null;
function fileOf(hash) { for (const type of TYPES) { const file = path.join(ROOT, `${hash}.${type.ext}`); if (fs.existsSync(file)) return { file, type }; } return null; }
function store({ base64 }) {
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) fail('INVALID_IMAGE', '이미지 파일을 읽을 수 없습니다.');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES) fail('INVALID_IMAGE', '이미지는 1MB 이하 PNG, JPG, GIF만 사용할 수 있습니다.');
  const type = typeOf(bytes); if (!type) fail('INVALID_IMAGE', '이미지는 1MB 이하 PNG, JPG, GIF만 사용할 수 있습니다.');
  const hash = sha256(bytes), existing = fileOf(hash);
  if (!existing) { fs.mkdirSync(ROOT, { recursive: true }); const file = path.join(ROOT, `${hash}.${type.ext}`), temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, bytes); fs.renameSync(temp, file); }
  return { ref: `asset:${hash}`, url: `/api/image-assets/${hash}`, mime: type.mime, bytes: bytes.length };
}
function read(hash) { const found = /^[a-f0-9]{64}$/.test(hash || '') && fileOf(hash); if (!found) fail('IMAGE_ASSET_NOT_FOUND', '이미지를 찾을 수 없습니다.', 404); const bytes = fs.readFileSync(found.file); if (sha256(bytes) !== hash) fail('IMAGE_ASSET_CORRUPTED', '이미지 무결성 검증에 실패했습니다.', 409); return { bytes, mime: found.type.mime }; }
// The source value of UBImage.data is exposed as a digest reference, never as the payload itself.
const inlineRef = (data) => `inline:${sha256(String(data ?? ''))}`;
function isRef(value) { return REF.test(value || '') || INLINE.test(value || ''); }
function assertUsable(value) { const m = REF.exec(value || ''); if (m) { read(m[1]); return value; } if (INLINE.test(value || '')) return value; fail('INVALID_PROPERTY_VALUE', '이미지 참조가 올바르지 않습니다.'); }
// Resolve a reference to the UBJF representation (url-encoded base64, the same encoding the importer writes).
function resolve(value, current) { const m = REF.exec(value || ''); if (m) return encodeURIComponent(read(m[1]).bytes.toString('base64')); if (INLINE.test(value || '')) { if (inlineRef(current) !== value) fail('FINAL_SOURCE_INVALID', '원본 이미지가 변경되어 복원할 수 없습니다.'); return current; } fail('FINAL_SOURCE_INVALID', '이미지 참조가 올바르지 않습니다.'); }
module.exports = { ROOT, MAX_BYTES, store, read, inlineRef, isRef, assertUsable, resolve };
