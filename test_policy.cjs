const { updateAgentPolicy, startTelegramBot } = require('./agent/studioEngine');
console.log('Testing policy update...');
updateAgentPolicy({ agentAiEnabled: false, tenantCode: 'TEST' });
console.log('Done.');
