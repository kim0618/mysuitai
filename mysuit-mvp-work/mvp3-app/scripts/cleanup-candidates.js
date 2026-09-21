const service=require('../src/server/services/candidate-service');
let failed=false;
for(const item of service.listCandidates().filter(value=>value.status==='ACTIVE')){try{service.deleteCandidate(item.candidateId);console.log(`deleted ${item.candidateId}`)}catch(error){failed=true;console.error(`${item.candidateId}: ${error.code||'ERROR'} ${error.message}`)}}
process.exitCode=failed?1:0;
