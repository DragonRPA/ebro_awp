const fs = require('fs');
let c = fs.readFileSync('src/services/migrationEngine.ts', 'utf8');

const targetSiteMapSet = `        siteMap.set(siteKey, {
          id: \`SITE-\${String(siteSeq++).padStart(7, '0')}\`,
          customerId: custEntity.id,
          name: cleanSiteName,
          address: getCol(r, custHeaderMap, ['연락처', '현장주소', '비고'], 8) ? String(getCol(r, custHeaderMap, ['연락처', '현장주소', '비고'], 8)).trim() : '',
          contactName: getCol(r, custHeaderMap, ['현장담당자'], 9) ? String(getCol(r, custHeaderMap, ['현장담당자'], 9)).trim() : '',
          contact: getCol(r, custHeaderMap, ['청구담당자'], 10) ? String(getCol(r, custHeaderMap, ['청구담당자'], 10)).trim() : '',
          email: getCol(r, custHeaderMap, ['이메일', 'email'], 11) ? String(getCol(r, custHeaderMap, ['이메일', 'email'], 11)).trim() : '',
          createdAt: nowIso,
          updatedAt: nowIso
        });`;

const replaceSiteMapSet = `        const siteContactName = getCol(r, custHeaderMap, ['현장담당자'], 9) ? String(getCol(r, custHeaderMap, ['현장담당자'], 9)).trim() : '';
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

if (c.includes(targetSiteMapSet)) {
  c = c.replace(targetSiteMapSet, replaceSiteMapSet);
  fs.writeFileSync('src/services/migrationEngine.ts', c);
  console.log('Fixed migrationEngine.ts site parsing to use contacts array.');
} else {
  console.log('Target string not found in migrationEngine.ts');
}
