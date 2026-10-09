const fs = require('fs');
let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');

// 1. Fix getContactName
const targetGetContact = "const getContactName = (id?: string) => contacts.find(c => c.id === id)?.name || '-';";
const replaceGetContact = `const getContactName = (id?: string) => {
    if (!id) return '-';
    const custContact = contacts.find(c => c.id === id);
    if (custContact) return custContact.name;
    for (const site of sites) {
      if (site.contacts) {
        const siteContact = site.contacts.find(sc => sc.id === id);
        if (siteContact) return siteContact.name;
      }
    }
    return '-';
  };`;
c = c.replace(targetGetContact, replaceGetContact);

// 2. Fix the succession contact dropdown
const targetDropdown = `{db.contacts
                      .filter(c => c.customerId === succCustId)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.position || '직책미상'})</option>
                      ))
                    }`;

const replaceDropdown = `{succSiteId && (() => {
                      const selectedSite = db.sites.find(s => s.id === succSiteId);
                      if (selectedSite && selectedSite.contacts && selectedSite.contacts.length > 0) {
                        return (
                          <optgroup label="[현장 소속 담당자]">
                            {selectedSite.contacts.filter(c => c.isActive !== false).map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.contactType === 'EQUIPMENT' ? '장비' : c.contactType === 'CLOSING' ? '마감' : c.contactType === 'SAFETY' ? '안전' : '현장담당'})</option>
                            ))}
                          </optgroup>
                        );
                      }
                      return null;
                    })()}
                    {succCustId && db.contacts.filter(c => c.customerId === succCustId).length > 0 && (
                      <optgroup label="[고객사 공통 담당자]">
                        {db.contacts
                          .filter(c => c.customerId === succCustId)
                          .map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.position || '직책미상'})</option>
                          ))
                        }
                      </optgroup>
                    )}`;

c = c.replace(targetDropdown, replaceDropdown);

fs.writeFileSync('src/pages/Contracts.tsx', c);
console.log("Fixed getContactName and dropdown!");
