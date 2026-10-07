const fs = require('fs');
let code = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');

const siteOptionsIdx = code.indexOf('"menuId": "site_options"');
if (siteOptionsIdx !== -1) {
    let startAnn = code.indexOf('"annotations":', siteOptionsIdx);
    let endAnn = code.indexOf('"basicGuide":', startAnn);
    let annotationsBlock = code.substring(startAnn, endAnn);

    annotationsBlock = annotationsBlock.replace(/\{\s*"seq": 3,\s*"selector": "\[data-mid=\\"btn-option-master-manage\\"\]"[\s\S]*?\},/g, '');

    let match;
    let newSeq = 1;
    let newBlock = '';
    let lastIndex = 0;
    const regex = /"seq": (\d+)/g;
    while ((match = regex.exec(annotationsBlock)) !== null) {
        newBlock += annotationsBlock.substring(lastIndex, match.index);
        newBlock += '"seq": ' + newSeq;
        newSeq++;
        lastIndex = regex.lastIndex;
    }
    newBlock += annotationsBlock.substring(lastIndex);

    code = code.substring(0, startAnn) + newBlock + code.substring(endAnn);
}

fs.writeFileSync('src/data/allMenuManuals.ts', code, 'utf8');
