const { execSync } = require('child_process');

try {
  console.log('Fetching Vercel deployments...');
  const output = execSync('vercel.cmd list --format json', { encoding: 'utf8' });
  
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Failed to parse Vercel CLI output');
    process.exit(1);
  }
  
  const data = JSON.parse(jsonMatch[0]);
  const deployments = data.deployments;
  
  const errorDeploys = deployments.filter(d => d.state === 'ERROR');
  for (const d of errorDeploys) {
    console.log('Purging ERROR deployment:', d.url);
    execSync('vercel.cmd rm ' + d.url + ' --yes', { stdio: 'inherit' });
  }
  
  const readyDeploys = deployments.filter(d => d.state === 'READY');
  readyDeploys.sort((a, b) => b.createdAt - a.createdAt);
  
  if (readyDeploys.length > 12) {
    const toDelete = readyDeploys.slice(12);
    for (const d of toDelete) {
      console.log('Purging excess READY deployment (older than 12):', d.url);
      execSync('vercel.cmd rm ' + d.url + ' --yes', { stdio: 'inherit' });
    }
  } else {
    console.log('Total READY deployments: ' + readyDeploys.length + '. No excess to purge.');
  }
  
  console.log('Auto-purge policy enforced successfully.');
} catch (e) {
  console.error('Error running purge script:', e);
  process.exit(1);
}
