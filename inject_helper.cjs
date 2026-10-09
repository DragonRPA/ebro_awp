const fs = require('fs');
let lines = fs.readFileSync('src/context/AppContext.tsx', 'utf8').split('\n');

const helperCode = `  const ensureCustomerContactExists = (customerId: string, contactId: string | undefined) => {
    if (contactId && contactId.startsWith('SC-')) {
      const existing = db.customerContacts.find(c => c.id === contactId);
      if (!existing) {
        let siteContact;
        for (const s of db.sites) {
          if (s.contacts) {
            siteContact = s.contacts.find(c => c.id === contactId);
            if (siteContact) break;
          }
        }
        if (siteContact) {
          db.insertRow('customer_contacts', {
            id: siteContact.id,
            customerId: customerId,
            name: siteContact.name,
            contact: siteContact.contact,
            email: siteContact.email,
            position: siteContact.contactType,
            isPrimary: false,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
  };`;

// Find where to insert (before createContract)
let insertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const createContract = async')) {
    insertIdx = i;
    break;
  }
}

if (insertIdx !== -1) {
  lines.splice(insertIdx, 0, helperCode);
  fs.writeFileSync('src/context/AppContext.tsx', lines.join('\n'));
  console.log('Injected helper before createContract');
}

// Now replace within createContract and succeedContract
let c = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

c = c.replace(/const contractNo = generateNextContractNo\(contractData\.startDate\);/, `const contractNo = generateNextContractNo(contractData.startDate);\n    ensureCustomerContactExists(contractData.customerId, contractData.contactId);`);

c = c.replace(/const newContractNo = generateNextContractNo\(nextDay\);/, `const newContractNo = generateNextContractNo(nextDay);\n      ensureCustomerContactExists(successorCustomerId, successorContactId);`);

fs.writeFileSync('src/context/AppContext.tsx', c);
console.log('Added calls to ensureCustomerContactExists');
