const fs = require('fs');
const lines = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8').split('\n');

// Find customer filter block
let filterStart = -1;
let filterEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* 고객사 선택 */}')) {
    filterStart = i;
  }
  if (filterStart !== -1 && i > filterStart && lines[i].includes('</select>')) {
    filterEnd = i + 1; // including the div closing? 
    // wait, next line is '</div>'
    if (lines[i+1].includes('</div>')) {
      filterEnd = i + 2;
    }
    break;
  }
}

let c = lines.slice(0, filterStart).join('\n') + '\n' + lines.slice(filterEnd).join('\n');

// Find filteredSites return block
c = c.replace(/return true;\s*\}\);\s*\}, \[sites, searchSiteKeyword\]\);/, `return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [sites, searchSiteKeyword]);`);

fs.writeFileSync('src/pages/SiteOptionManage.tsx', c);
console.log('Fixed using array slice for SiteOptionManage.tsx');
