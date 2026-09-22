const { execSync } = require('child_process');

try {
  console.log('Fetching Vercel projects...');
  const projectOutput = execSync('vercel.cmd project ls --format json', { encoding: 'utf8' });
  const projMatch = projectOutput.match(/\{[\s\S]*\}/);
  if (!projMatch) {
    console.error('Failed to parse Vercel CLI project output');
    process.exit(1);
  }
  const projectData = JSON.parse(projMatch[0]);
  const projects = projectData.projects;
  
  if (!projects || projects.length === 0) {
    console.log('No projects found.');
    process.exit(0);
  }
  
  console.log(`Found ${projects.length} projects. Starting global cleanup...`);
  
  for (const proj of projects) {
    const projName = proj.name;
    console.log(`\n======================================================`);
    console.log(`Checking deployments for project: ${projName}`);
    console.log(`======================================================`);
    
    // We can fetch up to 100 deployments at a time
    const output = execSync(`vercel.cmd ls ${projName} --limit 100 --format json`, { encoding: 'utf8' });
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error(`Failed to parse deployments for ${projName}`);
      continue;
    }
    
    const data = JSON.parse(jsonMatch[0]);
    const deployments = data.deployments;
    
    if (!deployments) {
      console.log(`No deployments found for ${projName}.`);
      continue;
    }
    
    const errorDeploys = deployments.filter(d => d.state === 'ERROR' || d.state === 'CANCELED');
    for (const d of errorDeploys) {
      console.log(`Purging ERROR/CANCELED deployment: ${d.url}`);
      execSync(`vercel.cmd rm ${d.url} --yes`, { stdio: 'inherit' });
    }
    
    const readyDeploys = deployments.filter(d => d.state === 'READY' || d.state === 'BUILDING' || d.state === 'INITIALIZING');
    readyDeploys.sort((a, b) => b.createdAt - a.createdAt);
    
    const KEEP_LATEST = 3; // Keep only the latest 3 to reclaim maximum space quickly
    
    if (readyDeploys.length > KEEP_LATEST) {
      const toDelete = readyDeploys.slice(KEEP_LATEST);
      for (const d of toDelete) {
        console.log(`Purging excess READY deployment (keeping only ${KEEP_LATEST}): ${d.url}`);
        execSync(`vercel.cmd rm ${d.url} --yes`, { stdio: 'inherit' });
      }
    } else {
      console.log(`Total READY deployments for ${projName}: ${readyDeploys.length}. No excess to purge.`);
    }
  }
  
  console.log('\nGlobal Vercel storage purge completed successfully!');
} catch (e) {
  console.error('Error running global purge script:', e);
  process.exit(1);
}
