const fs = require('fs');
const manualsPath = 'src/data/allMenuManuals.ts';
let manualsContent = fs.readFileSync(manualsPath, 'utf8');

const devUploaderRegex = /(menuId:\s*['"]dev_uploader['"][\s\S]*?annotations:\s*\[)([\s\S]*?)(\]\s*})$/;
const patchData = JSON.parse(fs.readFileSync('manual_patches/dev_uploader.json', 'utf8'));

const match = manualsContent.match(devUploaderRegex);
if (match) {
    const newAnnotationsStr = patchData.annotations.map((ann, i) => {
        let str = `\n      {\n        seq: ${ann.seq || i+1},\n        selector: '${ann.selector}',\n        type: '${ann.type}',\n        label: '${ann.label}',\n        description: '${ann.description}',\n        badgeColor: '${ann.badgeColor || '#1D4ED8'}',\n        positionHint: '${ann.positionHint || 'top'}',\n        spotlight: ${ann.spotlight || false}\n      }`;
        return str;
    }).join(',');

    manualsContent = manualsContent.replace(devUploaderRegex, `$1${newAnnotationsStr}\n    $3`);
    
    // Update version to 5
    const versionRegex = /(menuId:\s*['"]dev_uploader['"][\s\S]*?version:\s*)[0-9]+/;
    manualsContent = manualsContent.replace(versionRegex, `$1${5}`);
    fs.writeFileSync(manualsPath, manualsContent, 'utf8');
    console.log('dev_uploader merged.');
} else {
    console.log('dev_uploader regex failed.');
}
