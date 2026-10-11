const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) results = results.concat(walk(full));
    else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css') || file.endsWith('.html')) results.push(full);
  });
  return results;
}

const files = walk('src');
const trueBgHits = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    let isWhiteBg = false;

    // 1. React style property: backgroundColor: '#fff', backgroundColor: 'white', backgroundColor: '#ffffff'
    if (/backgroundColor\s*:\s*['"](?:#(?:fff|ffffff)|white|rgb\(255,\s*255,\s*255\))['"]/i.test(line)) {
      isWhiteBg = true;
    }
    // 2. React style property with conditional: backgroundColor: ... ? '#fff' : ...
    else if (/backgroundColor\s*:[^,}]*['"](?:#(?:fff|ffffff)|white)['"]/i.test(line)) {
      isWhiteBg = true;
    }
    // 3. React style background: '#fff', background: 'white' (not linear-gradient or image)
    else if (/background\s*:\s*['"](?:#(?:fff|ffffff)|white|rgb\(255,\s*255,\s*255\))['"]/i.test(line)) {
      isWhiteBg = true;
    }
    // 4. CSS: background-color: #fff, background-color: #ffffff, background-color: white
    else if (/background-color\s*:\s*(?:#(?:fff|ffffff)\b|white\b|rgb\(255,\s*255,\s*255\))/i.test(line)) {
      isWhiteBg = true;
    }
    // 5. CSS: background: #fff, background: white
    else if (/background\s*:\s*(?:#(?:fff|ffffff)\b|white\b|rgb\(255,\s*255,\s*255\))/i.test(line) && !/background\s*:\s*[^;]*(?:url|linear-gradient)/i.test(line)) {
      // make sure it's background: #fff and not color: #fff
      if (!/color\s*:\s*#(?:fff|ffffff)/i.test(line.replace(/background\s*:[^;]*/i, ''))) {
        isWhiteBg = true;
      }
    }
    // 6. Tailwind: bg-white (but not bg-white/xx, and not CSS rules where value is already #fbf9f5)
    else if (/\bbg-white\b/.test(line) && !/\bbg-white\/\d+/.test(line)) {
      if (!/#fbf9f5/i.test(line) && !/rgba\(251,\s*249,\s*245/i.test(line) && !/\[data-theme/.test(line)) {
        isWhiteBg = true;
      }
    }
    // 7. Inline HTML: style="...background...: #ffffff..."
    else if (/style\s*=\s*["'][^"']*(?:background|background-color)\s*:\s*(?:#(?:fff|ffffff)\b|white\b|rgb\(255,\s*255,\s*255\))/i.test(line)) {
      isWhiteBg = true;
    }

    // Ignore guard selectors like [style*="background: #ffffff"] in CSS files
    if (isWhiteBg && (/\[style\*=/.test(line) || /rgba\(251,\s*249,\s*245/.test(line))) {
      isWhiteBg = false;
    }

    if (isWhiteBg) {
      trueBgHits.push({
        file,
        lineNum: idx + 1,
        line: line.trim()
      });
    }
  });
});

console.log(`True White Background Targets: ${trueBgHits.length}`);
fs.writeFileSync('scripts/true_white_targets.json', JSON.stringify(trueBgHits, null, 2));
trueBgHits.forEach((h, i) => {
  console.log(`[${i+1}] ${h.file}:${h.lineNum} -> ${h.line}`);
});
