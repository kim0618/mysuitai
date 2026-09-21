const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { readForm, writeForm } = require('../services/form-patch-service');
const { sha256File, assertHash } = require('../services/integrity-service');
const { validateDim } = require('./dim-validator');
const { importError } = require('./import-errors');
const { collectIds, createIdContext, createImportedLabel } = require('./import-label-generator');
const { createImportedTable, validateImportedTable, signature: tableSignature } = require('./import-table-generator');
const { createImportedImage, validateAssetBytes, signature: imageSignature } = require('./import-image-generator');

const TEMPLATE = Object.freeze({ projectName: 'sample', formName: 'SampleReport_FreeForm' });
const TABLE_PROTOTYPE = Object.freeze({ projectName: 'sample', formName: 'Sales/SL_Report_01', tableId: 'TB7451' });
const IMPORT_NAME = /^(?:import_mvp(?:1[013]|2[0-2])|import_user_test)_\d{8}_\d{6}_[a-f0-9]{6}$/;

function templatePaths() {
  const root = path.join(config.projectsRoot, TEMPLATE.projectName, TEMPLATE.formName);
  return { root, form: path.join(root, 'form.ubjf'), info: path.join(root, 'info.xml') };
}

function tablePrototypePaths() {
  const root = path.join(config.projectsRoot, TABLE_PROTOTYPE.projectName, TABLE_PROTOTYPE.formName);
  return { root, form: path.join(root, 'form.ubjf'), info: path.join(root, 'info.xml') };
}

function makeImportProjectName(date = new Date(), version = '1.1') {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const suffix = version === '1.0' ? '10' : version === '1.3' ? '13' : version === '2.0' ? '20' : version === '2.1' ? '21' : version === '2.2' ? '22' : '11';
  return `import_mvp${suffix}_${stamp}_${crypto.randomBytes(3).toString('hex')}`;
}

function safeProjectPath(projectName) {
  if (!IMPORT_NAME.test(projectName)) throw importError('IMPORT_TEMPLATE_INVALID', 'Import project name이 안전 규칙과 일치하지 않습니다.');
  const target = path.resolve(config.projectsRoot, projectName);
  const relative = path.relative(path.resolve(config.projectsRoot), target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw importError('IMPORT_TEMPLATE_INVALID', 'Import project 경로가 허용 범위를 벗어났습니다.');
  return target;
}

function analyzeTemplate(parsed) {
  if (parsed.pages.length !== 1 || parsed.root.datasets?.length || parsed.pages[0].width !== 794 || parsed.pages[0].height !== 1123) {
    throw importError('IMPORT_TEMPLATE_INVALID', '선택된 Template은 794×1123 단일 page, dataset 0이어야 합니다.');
  }
  const labels = parsed.pages[0].items.filter((item) => item?.className === 'UBLabel');
  const prototype = labels.find((item) => item.id === 'LB8872') || labels.find((item) => !item.dataSet && !item.column && !item.systemFunction);
  if (!prototype) throw importError('IMPORT_TEMPLATE_INVALID', 'Static UBLabel prototype을 찾을 수 없습니다.');
  return { page: parsed.pages[0], labels, prototype };
}

function analyzeTablePrototype(parsed) {
  const tables = parsed.pages.flatMap((page) => page.items.filter((item) => item?.className === 'UBTable'));
  const prototype = tables.find((table) => table.id === TABLE_PROTOTYPE.tableId);
  if (!prototype || prototype.rowCount < 1 || prototype.columnCount < 1 || !prototype.table?.[0]?.[0]?.cell) {
    throw importError('IMPORT_TABLE_PROTOTYPE_NOT_FOUND', '검증된 Static UBTable prototype을 찾을 수 없습니다.');
  }
  return prototype;
}

function materializeDim(parsed, dim, tablePrototype = null, assetBytes = new Map()) {
  const template = analyzeTemplate(parsed);
  if (dim.page.width !== template.page.width || dim.page.height !== template.page.height) {
    throw importError('IMPORT_TEMPLATE_INVALID', 'MVP 1.0 DIM page 크기는 Template page 크기와 같아야 합니다.', { expected: { width: template.page.width, height: template.page.height }, actual: dim.page });
  }
  const idContext = createIdContext(collectIds(parsed.pages));
  const mappings = [];
  const items = dim.elements.map((element) => {
    if (element.type === 'text') {
      const label = createImportedLabel({ prototype: template.prototype, element, targetBand: '', idContext });
      mappings.push({ dimElementId: element.id, type: 'text', sourceObjectId: label.id, sourceBandId: '', expectedViewerObjectId: label.id, renderInstanceKeyPattern: `p0|c0|src:${label.id}|band:FREEFORM|row:0|idx:{renderIndex}` });
      return label;
    }
    if (element.type === 'image') {
      const asset=dim.assets.find((entry)=>entry.id===element.source.ref),bytes=assetBytes.get(asset.id);
      if(!bytes)throw importError('DIM_IMAGE_ASSET_NOT_FOUND','Image asset binary가 없습니다.',{assetId:asset.id});
      const image=createImportedImage({element,asset,bytes,idContext,targetBand:''});
      mappings.push({dimElementId:element.id,type:'image',sourceObjectId:image.id,sourceBandId:'',expectedViewerObjectId:image.id,assetId:asset.id,signature:imageSignature(image,asset)});
      return image;
    }
    if (!tablePrototype) throw importError('IMPORT_TABLE_PROTOTYPE_NOT_FOUND', 'Table element에 사용할 prototype이 없습니다.');
    const table = createImportedTable({ prototype: tablePrototype, element, targetBand: '', idContext, dimVersion: dim.version });
    mappings.push({ dimElementId: element.id, type: 'table', sourceObjectId: table.id, sourceBandId: '', expectedViewerCellIds: table.table.flat().filter((wrapper) => wrapper.cell).map((wrapper) => wrapper.cell.id), signature: tableSignature(table) });
    return table;
  });
  parsed.root.datasets = [];
  parsed.pages[0].items = items;
  return { items, mappings, prototypeId: template.prototype.id, tablePrototypeId: tablePrototype?.id || null, existingTemplateObjectPolicy: 'REMOVE_ALL_AND_INSERT_CLONES' };
}

function createImportedProject(input, options = {}) {
  const dim = validateDim(input);
  const template = templatePaths();
  const prototypePaths = tablePrototypePaths();
  const needsTable = dim.elements.some((element) => element.type === 'table');
  if (!fs.existsSync(template.form) || !fs.existsSync(template.info)) throw importError('IMPORT_TEMPLATE_NOT_FOUND', 'Static Template 파일을 찾을 수 없습니다.');
  if (needsTable && (!fs.existsSync(prototypePaths.form) || !fs.existsSync(prototypePaths.info))) throw importError('IMPORT_TABLE_PROTOTYPE_NOT_FOUND', 'Static UBTable prototype 파일을 찾을 수 없습니다.');
  const templateFormSha256 = sha256File(template.form), templateInfoSha256 = sha256File(template.info);
  const prototypeFormSha256 = needsTable ? sha256File(prototypePaths.form) : null;
  const prototypeInfoSha256 = needsTable ? sha256File(prototypePaths.info) : null;
  const assetBytes=new Map();
  if(dim.assets?.length){if(typeof options.assetRoot!=='string')throw importError('DIM_IMAGE_ASSET_NOT_FOUND','DIM image import에는 assetRoot가 필요합니다.');const root=path.resolve(options.assetRoot);for(const asset of dim.assets){const source=path.resolve(root,asset.relativePath),relative=path.relative(root,source);if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(source)||!fs.statSync(source).isFile())throw importError('DIM_IMAGE_ASSET_NOT_FOUND','Asset file을 찾을 수 없습니다.',{assetId:asset.id});const bytes=fs.readFileSync(source);validateAssetBytes(asset,bytes);assetBytes.set(asset.id,bytes)}}
  const projectName = options.projectName || makeImportProjectName(new Date(), dim.version);
  const finalRoot = safeProjectPath(projectName), temporaryRoot = `${finalRoot}.creating`;
  if (fs.existsSync(finalRoot) || fs.existsSync(temporaryRoot)) throw importError('IMPORT_TEMPLATE_INVALID', 'Import project 경로가 이미 존재합니다.');
  try {
    const formRoot = path.join(temporaryRoot, TEMPLATE.formName);
    fs.mkdirSync(temporaryRoot);
    fs.cpSync(template.root, formRoot, { recursive: true, errorOnExist: true });
    const formPath = path.join(formRoot, 'form.ubjf');
    const parsed = readForm(formPath);
    const tablePrototype = needsTable ? analyzeTablePrototype(readForm(prototypePaths.form)) : null;
    const generated = materializeDim(parsed, dim, tablePrototype, assetBytes);
    const publishedAssets=[];if(dim.assets?.length){const assetDir=path.join(formRoot,'assets');fs.mkdirSync(assetDir);for(const asset of dim.assets){const ext=path.extname(asset.fileName).toLowerCase()||({ 'image/png':'.png','image/jpeg':'.jpg','image/gif':'.gif'}[asset.mimeType]),storedName=`${asset.id}-${asset.sha256.slice(0,12)}${ext}`,target=path.join(assetDir,storedName);if(options.forceFailureAt==='asset-publish')throw importError('DIM_IMAGE_PUBLISH_FAILED','강제 asset publish 실패');fs.writeFileSync(target,assetBytes.get(asset.id),{flag:'wx'});publishedAssets.push({...asset,storedPath:`assets/${storedName}`})}}
    try { writeForm(formPath, parsed); } catch (error) { throw importError('IMPORT_SERIALIZATION_FAILED', 'Imported form.ubjf 직렬화에 실패했습니다.', { cause: error.message }); }
    const reparsed = readForm(formPath), validation = {labels:reparsed.pages[0].items.filter((item)=>item?.className==='UBLabel')};
    const expectedLabels = dim.elements.filter((element) => element.type === 'text').length;
    const expectedTables = dim.elements.filter((element) => element.type === 'table').length;
    const expectedImages = dim.elements.filter((element) => element.type === 'image').length;
    const actualTables = reparsed.pages[0].items.filter((item) => item.className === 'UBTable');
    const actualImages = reparsed.pages[0].items.filter((item) => item.className === 'UBImage');
    if (validation.labels.length !== expectedLabels || actualTables.length !== expectedTables || actualImages.length!==expectedImages || reparsed.pages[0].items.some((item) => !['UBLabel', 'UBTable','UBImage'].includes(item.className))) {
      throw importError('IMPORT_SERIALIZATION_FAILED', '저장 후 Imported object 수/구조 검증에 실패했습니다.');
    }
    actualTables.forEach(validateImportedTable);
    const metadata = {
      origin: 'IMPORTED', importVersion: options.importVersion || `MVP-${dim.version}`, sourceType: options.sourceType || 'MANUAL_DIM',
      ...(options.provider ? { provider: options.provider } : {}),
      ...(typeof options.api === 'boolean' ? { api: options.api } : {}),
      projectName, formName: TEMPLATE.formName, template: TEMPLATE, dimVersion: dim.version,
      elementTypes: [...new Set(dim.elements.map((element) => element.type.toUpperCase()))],
      page: dim.page, prototypeId: generated.prototypeId, tablePrototype: needsTable ? TABLE_PROTOTYPE : null, tablePrototypeId: generated.tablePrototypeId, existingTemplateObjectPolicy: generated.existingTemplateObjectPolicy,
      elements: generated.mappings, createdAt: new Date().toISOString(),
      assets: publishedAssets,
    };
    fs.writeFileSync(path.join(temporaryRoot, 'import-meta.json'), JSON.stringify(metadata, null, 2) + '\n');
    fs.renameSync(temporaryRoot, finalRoot);
    assertHash(template.form, templateFormSha256); assertHash(template.info, templateInfoSha256);
    if (needsTable) { assertHash(prototypePaths.form, prototypeFormSha256); assertHash(prototypePaths.info, prototypeInfoSha256); }
    return { ...metadata, root: finalRoot, formPath: path.join(finalRoot, TEMPLATE.formName, 'form.ubjf'), infoPath: path.join(finalRoot, TEMPLATE.formName, 'info.xml'), formSha256: sha256File(path.join(finalRoot, TEMPLATE.formName, 'form.ubjf')), previewUrl: `/mysuit/UView5/index.jsp?projectName=${projectName}&formName=${TEMPLATE.formName}`, templateIntegrity: true };
  } catch (error) {
    if (fs.existsSync(temporaryRoot)) fs.rmSync(temporaryRoot, { recursive: true, force: false });
    if (fs.existsSync(finalRoot)) fs.rmSync(finalRoot, { recursive: true, force: false });
    assertHash(template.form, templateFormSha256); assertHash(template.info, templateInfoSha256);
    if (needsTable) { assertHash(prototypePaths.form, prototypeFormSha256); assertHash(prototypePaths.info, prototypeInfoSha256); }
    throw error.code ? error : importError('IMPORT_LABEL_CREATION_FAILED', 'Imported Project 생성에 실패했습니다.', { cause: error.message });
  }
}

function removeImportedProject(projectName) {
  const target = safeProjectPath(projectName);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: false });
  return target;
}

module.exports = { TEMPLATE, TABLE_PROTOTYPE, IMPORT_NAME, templatePaths, tablePrototypePaths, makeImportProjectName, safeProjectPath, analyzeTemplate, analyzeTablePrototype, materializeDim, createImportedProject, removeImportedProject };
