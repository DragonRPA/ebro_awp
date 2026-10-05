const fs = require('fs');
const path = require('path');

const ebroDir = 'd:\\01.AntiGravity\\eBro';
const allMenuManualsPath = path.join(ebroDir, 'src/data/allMenuManuals.ts');
let allManualsContent = fs.readFileSync(allMenuManualsPath, 'utf8');

const possiblePaths = fs.readdirSync(path.join(ebroDir, 'scratch')).filter(f => f.startsWith('manual_') && f.endsWith('.json')).map(f => path.join(ebroDir, 'scratch', f));

const brainDir = 'C:\\Users\\이정용\\.gemini\\antigravity\\brain';
if (fs.existsSync(brainDir)) {
  const subDirs = fs.readdirSync(brainDir);
  for (const dir of subDirs) {
    const scratchDir = path.join(brainDir, dir, 'scratch');
    if (fs.existsSync(scratchDir)) {
      const files = fs.readdirSync(scratchDir);
      for (const file of files) {
        if (file.endsWith('.json') && file.startsWith('manual_')) {
           possiblePaths.push(path.join(scratchDir, file));
        }
      }
    }
  }
}

const injected = new Set();

for (const p of possiblePaths) {
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const menuId = data.pageId || data.menuId; 
    
    if (!menuId || injected.has(menuId)) continue;
    
    const basicGuideStr = JSON.stringify(data.basicGuide || [], null, 2);
    const processesStr = JSON.stringify(data.processes || [], null, 2);
    
    // Remove emojis
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;
    const cleanBasic = basicGuideStr.replace(emojiRegex, '');
    const cleanProcesses = processesStr.replace(emojiRegex, '');
    
    // Replace items: [...] with basicGuide and processes. 
    // In 75d3ea1, the structure has `items: [` or `items: []`.
    // Let's just find `menuId: 'xxx',` and insert after `menuName: 'yyy',`
    
    const targetRegex = new RegExp(`(menuId:\\s*['"]${menuId}['"][^}]*?menuName:\\s*['"][^'"]*['"]\\s*,)`);
    if (targetRegex.test(allManualsContent)) {
      allManualsContent = allManualsContent.replace(targetRegex, `$1\n  basicGuide: ${cleanBasic},\n  processes: ${cleanProcesses},`);
      console.log(`Injected data for menuId: ${menuId}`);
      injected.add(menuId);
    }
  } catch (e) {
    console.error(`Error parsing ${p}:`, e.message);
  }
}

fs.writeFileSync(allMenuManualsPath, allManualsContent);
console.log('All Manuals Injected cleanly.');
