const fs = require('fs');
let lines = fs.readFileSync('src/services/migrationEngine.ts', 'utf8').split(/\r?\n/);

let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('siteMap.set(siteKey, {') && lines[i+1].includes('id: `SITE-')) {
    startIdx = i;
    let j = i;
    while (!lines[j].includes('});')) {
      j++;
    }
    endIdx = j;
    break;
  }
}

if (startIdx !== -1) {
  const replaceStr = `        const siteContactName = getCol(r, custHeaderMap, ['현장담당자'], 9) ? String(getCol(r, custHeaderMap, ['현장담당자'], 9)).trim() : '';
        const siteBillingContact = getCol(r, custHeaderMap, ['청구담당자', '마감담당자'], 10) ? String(getCol(r, custHeaderMap, ['청구담당자', '마감담당자'], 10)).trim() : '';
        const siteEmail = getCol(r, custHeaderMap, ['이메일', 'email'], 11) ? String(getCol(r, custHeaderMap, ['이메일', 'email'], 11)).trim() : '';
        
        const contactsArr = [];
        if (siteContactName) {
          contactsArr.push({
            id: 'SC-' + Math.random().toString(36).substring(2, 9),
            name: siteContactName,
            contactType: 'EQUIPMENT',
            contact: siteContactName.includes('010') ? siteContactName : '',
            isActive: true
          });
        }
        if (siteBillingContact) {
          contactsArr.push({
            id: 'SC-' + Math.random().toString(36).substring(2, 9),
            name: siteBillingContact,
            contactType: 'CLOSING',
            contact: siteBillingContact.includes('010') ? siteBillingContact : '',
            email: siteEmail,
            isActive: true
          });
        }

        siteMap.set(siteKey, {
          id: \`SITE-\${String(siteSeq++).padStart(7, '0')}\`,
          customerId: custEntity.id,
          name: cleanSiteName,
          address: getCol(r, custHeaderMap, ['연락처', '현장주소', '비고'], 8) ? String(getCol(r, custHeaderMap, ['연락처', '현장주소', '비고'], 8)).trim() : '',
          contactName: siteContactName,
          contact: siteBillingContact,
          email: siteEmail,
          contacts: contactsArr,
          createdAt: nowIso,
          updatedAt: nowIso
        });`;
  
  lines.splice(startIdx, endIdx - startIdx + 1, replaceStr);
  fs.writeFileSync('src/services/migrationEngine.ts', lines.join('\n'));
  console.log('Fixed migrationEngine.ts site mapping!');
} else {
  console.log('Not found');
}
