const fs = require('fs');

let text = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');

// The file has multiple basicGuide: [...] and processes: [...] blocks added next to each other.
// We can just find each menu block and strip out all but the LAST occurrence.
// Since it's valid JS (well, duplicate keys are syntax errors in TS), we can split the file by "menuId: "
const parts = text.split(/(menuId:\s*['"][^'"]+['"]\s*,[\s\S]*?menuName:\s*['"][^'"]+['"]\s*,)/);

// parts[0] is everything before the first menuId.
// parts[1] is the captured menuId...menuName
// parts[2] is the rest until the next menuId, which contains the duplicate basicGuides and processes.

let newText = parts[0];
for (let i = 1; i < parts.length; i += 2) {
  let header = parts[i];
  let body = parts[i+1];
  
  // extract all basicGuide: [...] blocks
  const basicGuideRegex = /basicGuide:\s*\[[\s\S]*?\]\s*,/g;
  let basicMatches = [...body.matchAll(basicGuideRegex)];
  
  // extract all processes: [...] blocks
  const processesRegex = /processes:\s*\[[\s\S]*?\]\s*,/g;
  let processMatches = [...body.matchAll(processesRegex)];
  
  let cleanBody = body.replace(basicGuideRegex, '').replace(processesRegex, '');
  
  let lastBasic = basicMatches.length > 0 ? basicMatches[basicMatches.length - 1][0] : '';
  let lastProcess = processMatches.length > 0 ? processMatches[processMatches.length - 1][0] : '';
  
  newText += header + '\n  ' + lastBasic + '\n  ' + lastProcess + cleanBody;
}

fs.writeFileSync('src/data/allMenuManuals.ts', newText);
console.log('Deduplication complete.');
