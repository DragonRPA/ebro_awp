const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

const target = `onChange={e => setSelectedRefSiteId(e.target.value)}`;
const replacement = `onChange={e => {
                      const val = e.target.value;
                      setSelectedRefSiteId(val);
                      if (val) {
                        const refSite = optionReferenceSites.find(s => s.id === val);
                        if (refSite) {
                          setEditingSite(prev => ({
                            ...prev,
                            name: prev.name || refSite.name,
                            address: prev.address || refSite.address,
                            paidOptions: refSite.paidOptions || '',
                            protection: refSite.protection || '',
                            checkedSpecs: refSite.checkedSpecs ? { ...refSite.checkedSpecs } : {}
                          }));
                        }
                      }
                    }}`;

c = c.replace(target, replacement);

fs.writeFileSync('src/pages/Customers.tsx', c);
console.log('Replaced onChange in Customers.tsx');
