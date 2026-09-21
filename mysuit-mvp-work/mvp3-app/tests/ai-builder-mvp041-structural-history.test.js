const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const config = require('../src/server/config');
const history = require('../src/server/services/history-service');
const structural = require('../src/server/services/structural-history-service');
const changes = require('../src/server/services/changeset-service');
const { readForm, writeForm } = require('../src/server/services/form-patch-service');

const scope = { layoutDraftId: `mvp041_structural_${process.pid}`, projectName: 'sample', formName: 'sample' };
const candidateProject = `ai_builder_mvp041_history_${process.pid}`;
const candidateRoot = path.join(config.projectsRoot, candidateProject);
const sourceRoot = path.join(config.projectsRoot, 'sample');
let files;

test.before(() => {
  files = ['history.json', 'changesets.json', 'structure-operations.json', 'render-patches.json', 'binding-operations.json', 'structural-history.json']
    .map(name => path.join(config.appRoot, 'data', name))
    .map(file => [file, fs.existsSync(file) ? fs.readFileSync(file) : null]);
  fs.cpSync(sourceRoot, candidateRoot, { recursive: true, errorOnExist: true });
  const formPath = path.join(candidateRoot, 'sample', 'form.ubjf');
  const parsed = readForm(formPath);
  parsed.pages[0].items[0].x = Number(parsed.pages[0].items[0].x || 0) + 7;
  writeForm(formPath, parsed);
  changes.create(scope);
  history.clear(scope);
});

test.after(() => {
  try { history.clear(scope); } catch (_) {}
  fs.rmSync(candidateRoot, { recursive: true, force: true });
  for (const [file, value] of files) value === null ? fs.rmSync(file, { force: true }) : fs.writeFileSync(file, value);
});

test('captures canonical static/dynamic states and restores exact undo/redo signatures', () => {
  const base = structural.get(scope);
  const result = { candidateProject, candidateForm: 'sample' };
  const dynamic = structural.createDynamic(scope, result);
  assert.notEqual(base.semanticSignature, dynamic.semanticSignature);
  const tx = history.transact(scope, {
    scope: 'STRUCTURE', operation: 'ARRAY_BINDING_APPLY', forceRecord: true,
    before: { dynamic: false }, after: { dynamic: true },
  }, () => structural.replace(scope, dynamic));
  assert.equal(tx.history.events.length, 1);
  assert.equal(structural.get(scope).semanticSignature, dynamic.semanticSignature);
  const undo = history.undo(scope);
  assert.equal(undo.structuralState.semanticSignature, base.semanticSignature);
  assert.equal(structural.get(scope).semanticSignature, base.semanticSignature);
  const redo = history.redo(scope);
  assert.equal(redo.structuralState.semanticSignature, dynamic.semanticSignature);
  assert.equal(structural.get(scope).semanticSignature, dynamic.semanticSignature);
});

test('persists snapshot references and removes the redo branch after a new action', () => {
  const persisted = history.get(scope);
  assert.equal(persisted.structuralState.projectName, candidateProject);
  history.undo(scope);
  history.transact(scope, { scope: 'SOURCE_PATCH', operation: 'test', forceRecord: true }, () => undefined);
  const branched = history.get(scope);
  assert.equal(branched.canRedo, false);
  assert.equal(branched.events.length, 1);
  assert.equal(branched.structuralState.kind, 'STATIC_SOURCE');
});

test('forced undo/redo failures are atomic', () => {
  history.clear(scope);
  changes.create(scope);
  const dynamic = structural.createDynamic(scope, { candidateProject, candidateForm: 'sample' });
  history.transact(scope, { scope: 'STRUCTURE', operation: 'ARRAY_BINDING_APPLY', forceRecord: true }, () => structural.replace(scope, dynamic));
  const beforeUndo = history.get(scope);
  assert.throws(() => history.undo(scope, { forceFailure: true }), error => error.code === 'HISTORY_REBUILD_FAILED');
  assert.equal(history.get(scope).cursor, beforeUndo.cursor);
  assert.equal(structural.get(scope).semanticSignature, dynamic.semanticSignature);
  history.undo(scope);
  const staticSignature = structural.get(scope).semanticSignature;
  assert.throws(() => history.redo(scope, { forceFailure: true }), error => error.code === 'HISTORY_REBUILD_FAILED');
  assert.equal(history.get(scope).cursor, 0);
  assert.equal(structural.get(scope).semanticSignature, staticSignature);
});

test('invalid referenced snapshot fails closed without moving the cursor', () => {
  history.redo(scope);
  const root = JSON.parse(fs.readFileSync(structural.file, 'utf8'));
  const key = Object.keys(root.states).find(value => value.startsWith(`${scope.layoutDraftId}|`));
  root.states[key].formSha256 = '0'.repeat(64);
  fs.writeFileSync(structural.file, JSON.stringify(root, null, 2) + '\n');
  assert.throws(() => structural.get(scope), error => error.code === 'STRUCTURAL_HISTORY_SIGNATURE_MISMATCH');
  assert.throws(() => history.undo(scope), error => error.code === 'STRUCTURAL_HISTORY_SIGNATURE_MISMATCH');
  assert.equal(history.get(scope).cursor, 1);
});
