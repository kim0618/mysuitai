const test = require('node:test');
const assert = require('node:assert/strict');
const { parseViewerObjectId } = require('../src/server/utils/viewer-id-parser');

test('verified sample ID', () => assert.deepEqual(parseViewerObjectId('LB6417_UPHB2584_ROW0'), { viewerObjectId:'LB6417_UPHB2584_ROW0', sourceObjectId:'LB6417', bandId:'UPHB2584', rowIndex:0, mappingConfidence:'verified-for-sample' }));
test('two digit row', () => assert.equal(parseViewerObjectId('LB6417_UPHB2584_ROW10').rowIndex, 10));
test('data band render instance ID',()=>assert.deepEqual(parseViewerObjectId('UB6131219_grp_1_UDB3195_ROW3'),{viewerObjectId:'UB6131219_grp_1_UDB3195_ROW3',sourceObjectId:'UB6131219',bandId:'grp_1_UDB3195',rowIndex:3,mappingConfidence:'render-instance-only'}));
test('group footer render instance ID',()=>assert.equal(parseViewerObjectId('UB6199723_UGHB7543grp_0_dataset_2_ROW0').mappingConfidence,'render-instance-only'));
for (const value of ['', 'bad', '../LB6417_UPHB2584_ROW0', 'LB6417_UPHB2584_ROW01', 'LB6417_bad/path_ROW0']) test(`reject ${JSON.stringify(value)}`, () => assert.equal(parseViewerObjectId(value), null));
