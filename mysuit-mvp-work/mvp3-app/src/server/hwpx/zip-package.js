const fs = require('fs');
const zlib = require('zlib');
const { hwpxError } = require('./hwpx-errors');

function readUInt(buffer, offset, size) { return size === 2 ? buffer.readUInt16LE(offset) : buffer.readUInt32LE(offset); }
function safeName(name) { return !name.startsWith('/') && !name.split('/').some((part) => part === '..'); }

function readZip(input) {
  let data; try { data = Buffer.isBuffer(input) ? input : fs.readFileSync(input); } catch (error) { throw hwpxError('HWPX_PACKAGE_INVALID', 'HWPX package를 읽을 수 없습니다.', { cause: error.message }); }
  try {
    let eocd = -1; for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) if (data.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('ZIP end record not found');
    const count = readUInt(data, eocd + 10, 2), centralOffset = readUInt(data, eocd + 16, 4), entries = new Map(); let cursor = centralOffset;
    for (let i = 0; i < count; i++) {
      if (data.readUInt32LE(cursor) !== 0x02014b50) throw new Error('invalid central directory');
      const method = readUInt(data, cursor + 10, 2), compressedSize = readUInt(data, cursor + 20, 4), size = readUInt(data, cursor + 24, 4);
      const nameLength = readUInt(data, cursor + 28, 2), extraLength = readUInt(data, cursor + 30, 2), commentLength = readUInt(data, cursor + 32, 2), localOffset = readUInt(data, cursor + 42, 4);
      const name = data.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
      if (!safeName(name) || entries.has(name)) throw new Error(`unsafe or duplicate ZIP entry: ${name}`);
      if (!name.endsWith('/')) {
        if (data.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`invalid local entry: ${name}`);
        const localNameLength = readUInt(data, localOffset + 26, 2), localExtraLength = readUInt(data, localOffset + 28, 2), start = localOffset + 30 + localNameLength + localExtraLength;
        const packed = data.subarray(start, start + compressedSize); let bytes;
        if (method === 0) bytes = Buffer.from(packed); else if (method === 8) bytes = zlib.inflateRawSync(packed); else throw new Error(`unsupported ZIP compression: ${method}`);
        if (bytes.length !== size) throw new Error(`ZIP size mismatch: ${name}`); entries.set(name, bytes);
      }
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  } catch (error) { if (error.code?.startsWith('HWPX_')) throw error; throw hwpxError('HWPX_PACKAGE_INVALID', '유효한 ZIP package가 아닙니다.', { cause: error.message }); }
}

module.exports = { readZip };
