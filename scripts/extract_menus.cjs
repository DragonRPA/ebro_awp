const fs = require('fs');
const content = fs.readFileSync('src/data/allMenuManuals.ts', 'utf-8');
const ids = ['vehicle_log', 'depreciation_execution', 'regular_reports', 'organization'];
ids.forEach(id => {
    const idx = content.indexOf(`menuId: '${id}'`);
    if (idx !== -1) {
        const start = content.lastIndexOf('{', idx);
        let brackets = 1;
        let end = start + 1;
        while (brackets > 0 && end < content.length) {
            if (content[end] === '{') brackets++;
            if (content[end] === '}') brackets--;
            end++;
        }
        console.log(content.substring(start, end) + ',');
    } else {
        console.log(`${id} not found`);
    }
});
