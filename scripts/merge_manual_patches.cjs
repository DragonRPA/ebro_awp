const fs = require('fs');
const path = require('path');

const manualsPath = 'src/data/allMenuManuals.ts';
let manualsContent = fs.readFileSync(manualsPath, 'utf8');

const patchesDir = 'manual_patches';
if (fs.existsSync(patchesDir)) {
  const patchFiles = fs.readdirSync(patchesDir).filter(f => f.endsWith('.json'));
  for (const pf of patchFiles) {
    try {
      const patchData = JSON.parse(fs.readFileSync(path.join(patchesDir, pf), 'utf8'));
      const menuId = patchData.menuId;
      if (!menuId) continue;

      // Find the menu block in allMenuManuals.ts
      const regexStr = `(menuId:\\s*['"]${menuId}['"][\\s\\S]*?annotations:\\s*\\[)([\\s\\S]*?)(\\]\\s*(?:},\\s*\\n|},\\s*$))`;
      const regex = new RegExp(regexStr);
      
      const match = manualsContent.match(regex);
      if (match) {
        // Prepare the new annotations string
        const newAnnotationsStr = patchData.annotations.map((ann, i) => {
          let str = `\n      {\n        seq: ${ann.seq || i+1},\n        selector: '${ann.selector}',\n        type: '${ann.type}',\n        label: '${ann.label}',\n        description: '${ann.description}',\n        badgeColor: '${ann.badgeColor || '#1D4ED8'}',\n        positionHint: '${ann.positionHint || 'top'}',\n        spotlight: ${ann.spotlight || false}\n      }`;
          return str;
        }).join(',');

        manualsContent = manualsContent.replace(regex, `$1${newAnnotationsStr}\n    $3`);
        
        // Update version to 5
        const versionRegexStr = `(menuId:\\s*['"]${menuId}['"][\\s\\S]*?version:\\s*)[0-9]+`;
        const versionRegex = new RegExp(versionRegexStr);
        manualsContent = manualsContent.replace(versionRegex, `$1${patchData.version || 5}`);

        console.log(`Merged patch for ${menuId}`);
      } else {
        console.warn(`Could not find block for ${menuId}`);
      }
    } catch (e) {
      console.error(`Error processing ${pf}:`, e);
    }
  }

  fs.writeFileSync(manualsPath, manualsContent, 'utf8');
  console.log('Merge complete.');
}
