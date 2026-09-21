const fs=require('fs'),path=require('path');const service=require('../src/server/dynamic/dynamic-project-service');
const model=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../samples/import/manual-dynamic-report.semantic.json')));process.stdout.write(JSON.stringify(service.createDynamicProject(model))+'\n');
