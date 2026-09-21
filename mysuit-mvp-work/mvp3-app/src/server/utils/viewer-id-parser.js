const SUPPORTED = /^([A-Za-z][A-Za-z0-9]*)_([A-Za-z][A-Za-z0-9_]{0,119})_ROW(0|[1-9][0-9]*)$/;

function parseViewerObjectId(viewerObjectId) {
  if (typeof viewerObjectId !== 'string' || !viewerObjectId) return null;
  const match = SUPPORTED.exec(viewerObjectId);
  if (!match) return null;
  return {
    viewerObjectId,
    sourceObjectId: match[1],
    bandId: match[2],
    rowIndex: Number(match[3]),
    mappingConfidence: match[2].includes('_') ? 'render-instance-only' : 'verified-for-sample'
  };
}

module.exports = { parseViewerObjectId };
