const { execSync } = require('child_process');
try {
  console.log('Fetching Vercel deployments...');
  const output = execSync('vercel.cmd list --format json', { encoding: 'utf8' });
  // Wait, vercel list --format json does not exist? Wait, it does! (vercel list --format json)
  // Let's check
} catch(e) {}
