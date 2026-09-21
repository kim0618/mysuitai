const { importError } = require('./import-errors');
const { applyTextStyle } = require('./import-style-mapper');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectIds(value, ids = new Set()) {
  if (!value || typeof value !== 'object') return ids;
  if (!Array.isArray(value) && typeof value.id === 'string') ids.add(value.id);
  if (Array.isArray(value)) value.forEach((entry) => collectIds(entry, ids));
  else Object.values(value).forEach((entry) => collectIds(entry, ids));
  return ids;
}

function createIdContext(existingIds = new Set()) {
  const used = new Set(existingIds);
  let sequence = 0;
  let tableSequence = 0, cellSequence = 0, imageSequence = 0;
  return {
    nextLabelId() {
      let id;
      do { sequence += 1; id = `IMPLB${String(sequence).padStart(4, '0')}`; } while (used.has(id));
      used.add(id);
      return id;
    },
    nextTableId() { let id; do { tableSequence += 1; id=`IMPTB${String(tableSequence).padStart(4,'0')}` } while(used.has(id)); used.add(id); return id; },
    nextCellId() { let id; do { cellSequence += 1; id=`IMPCL${String(cellSequence).padStart(4,'0')}` } while(used.has(id)); used.add(id); return id; },
    nextImageId() { let id; do { imageSequence += 1; id=`IMPIMG${String(imageSequence).padStart(4,'0')}` } while(used.has(id)); used.add(id); return id; },
    get used() { return new Set(used); },
  };
}

function assertPrototype(prototype) {
  if (!prototype || prototype.className !== 'UBLabel' || prototype.dataSet || prototype.column || prototype.systemFunction || prototype.formula) {
    throw importError('IMPORT_TEMPLATE_INVALID', 'Prototype은 binding/formula가 없는 static UBLabel이어야 합니다.');
  }
}

function createImportedLabel({ prototype, element, targetBand = '', idContext }) {
  try {
    assertPrototype(prototype);
    if (!idContext?.nextLabelId) throw new Error('idContext missing');
    const label = deepClone(prototype);
    label.id = idContext.nextLabelId();
    label.className = 'UBLabel';
    label.band = targetBand;
    label.x = element.x;
    label.y = element.y;
    label.width = element.width;
    label.height = element.height;
    if (Object.prototype.hasOwnProperty.call(label, 'band_x')) label.band_x = element.x;
    if (Object.prototype.hasOwnProperty.call(label, 'band_y')) label.band_y = element.y;
    label.text = encodeURIComponent(element.text);
    applyTextStyle(label, element.style);
    if (Object.prototype.hasOwnProperty.call(label, 'dataSet')) label.dataSet = '';
    if (Object.prototype.hasOwnProperty.call(label, 'column')) label.column = '';
    if (Object.prototype.hasOwnProperty.call(label, 'systemFunction')) label.systemFunction = '';
    if (Object.prototype.hasOwnProperty.call(label, 'formula')) delete label.formula;
    return label;
  } catch (error) {
    if (error.code) throw error;
    throw importError('IMPORT_LABEL_CREATION_FAILED', 'Imported UBLabel 생성에 실패했습니다.', { cause: error.message });
  }
}

module.exports = { deepClone, collectIds, createIdContext, assertPrototype, createImportedLabel };
