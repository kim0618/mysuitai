const path = require('path');

const projectRoot = '/home/tjd618/mysuit-ai-viewer';
const appRoot = path.join(projectRoot, 'mysuit-mvp-work/mvp3-app');
const projectsRoot = path.join(projectRoot, 'apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project');

module.exports = Object.freeze({
  host: '127.0.0.1',
  port: Number(process.env.MVP3_PORT || 3100),
  tomcatHost: '127.0.0.1',
  tomcatPort: 9990,
  projectRoot,
  appRoot,
  projectsRoot,
  clientRoot: path.join(appRoot, 'src/client'),
  dataFile: path.join(appRoot, 'data/candidates.json'),
  auditFile: path.join(appRoot, 'data/audit/candidate-events.jsonl'),
  allowedOrigins: new Set([
    'http://localhost:3100', 'http://127.0.0.1:3100',
    'http://localhost:9990', 'http://127.0.0.1:9990'
  ]),
  allowedSources: new Set(['sample/sample']),
  maxTextLength: 200
});
