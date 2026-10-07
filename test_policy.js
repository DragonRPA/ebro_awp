const { updateAgentPolicy } = require('./agent/studioEngine');
console.log('Testing policy update...');
updateAgentPolicy({ agentAiEnabled: false, tenantCode: 'TEST' });
