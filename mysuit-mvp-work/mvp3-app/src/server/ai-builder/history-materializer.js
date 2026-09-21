const history = require("../services/history-service");
const { materializeUnifiedCandidate } = require("./unified-materializer");

function materializeHistoryCursor({ scope, cursor, datasets = [], destinationProject }) {
  const state = history.rebuildEditorStateFromHistory(scope, cursor);
  const structural = state.structuralState;
  const dynamic = structural?.kind === 'DYNAMIC_CANDIDATE';
  return materializeUnifiedCandidate({
    baseProject: structural?.projectName || scope.projectName,
    baseForm: structural?.formName || scope.formName,
    destinationProject,
    datasets: dynamic ? [] : datasets,
    sourcePatches: state.sourcePatches || [],
    structureOperations: state.structureOperations || [],
    bindingOperations: state.bindingOperations || [],
  });
}

module.exports = { materializeHistoryCursor };
