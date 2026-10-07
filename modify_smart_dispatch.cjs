const fs = require('fs');

function removeTabGroup(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Use regex to remove dispatch4-tab-group
  // It starts with <div className="dispatch4-tab-group"> and ends with the matching </div>
  // Because regex for nested tags is hard, we can just replace everything between <div className="dispatch4-tab-group"> and the next </div>\n        </div>
  const regex = /<div className="dispatch4-tab-group">[\s\S]*?<\/div>\n\s*<\/div>/;
  if (regex.test(content)) {
    content = content.replace(regex, '</div>');
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Replaced in ${filePath}`);
  } else {
    console.log(`Regex not matched in ${filePath}`);
  }
}

removeTabGroup('D:/01.AntiGravity/eBro/src/pages/smart_dispatch4.tsx');
