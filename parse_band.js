const fs = require('fs');
const text = fs.readFileSync('D:\\OneDrive\\Desktop\\기연리프트자료_\\자동업로드\\밴드\\(출고요청)band_as_history_all.txt', 'utf16le');
const lines = text.split(/\\r?\\n/);

const results = {};
lines.forEach(line => {
    if (line.includes('모델')) {
        const words = line.split(/[\\s,/*/]+/);
        words.forEach(w => {
            const m = w.toUpperCase().trim();
            if (/[0-9]{3,4}/.test(m)) {
                results[m] = (results[m] || 0) + 1;
            }
        });
    }
});

console.log(Object.entries(results).sort((a,b) => b[1] - a[1]).slice(0, 30));
