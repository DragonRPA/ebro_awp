const fs = require('fs');
let c = fs.readFileSync('src/services/db.ts', 'utf8');

// 1. Add interface SiteMaster
const siteMasterInterface = `
export interface SiteMaster {
  id: string;
  name: string;
  address: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}
`;

c = c.replace(
  'export interface CustomerSite {',
  siteMasterInterface + '\nexport interface CustomerSite {'
);

// 2. Add siteMasterId to CustomerSite
c = c.replace(
  'customerId?: string;',
  'siteMasterId?: string;\n  customerId?: string;'
);

// 3. Add to ALL_DB_KEYS
c = c.replace(
  "'customers', 'contacts', 'sites',",
  "'customers', 'contacts', 'siteMasters', 'sites',"
);

// 4. Update mapToSupabaseTable
c = c.replace(
  "sites: 'customer_sites',",
  "siteMasters: 'site_masters',\n      sites: 'customer_sites',"
);

// 5. Add siteMasters getter/setter to LocalDB
c = c.replace(
  "get sites() {",
  `get siteMasters() { return this.get<SiteMaster>('siteMasters', []); }
  set siteMasters(val: SiteMaster[]) { this.set('siteMasters', val); }

  get sites() {`
);

// 6. Update get sites() to join with siteMasters
const getSitesImpl = `
  get sites() {
    const raw = this.get<CustomerSite>('sites', SEED_SITES);
    const masters = this.siteMasters;
    
    return raw.map(s => {
      if (!s) return s;
      
      let changed = false;
      let masterName = s.name;
      let masterAddress = s.address;
      
      if (s.siteMasterId) {
        const master = masters.find(m => m.id === s.siteMasterId);
        if (master) {
          masterName = master.name;
          masterAddress = master.address;
        }
      }
      
      let paid = s.paidOptions;
      if (Array.isArray(paid)) {
        paid = (paid as any[]).flat().map(v => String(v).trim()).filter(Boolean).join(', ');
        changed = true;
      } else if (paid !== undefined && paid !== null && typeof paid !== 'string') {
        paid = String(paid);
        changed = true;
      }

      if (changed || masterName !== s.name || masterAddress !== s.address) {
        return { ...s, name: masterName, address: masterAddress, paidOptions: paid };
      }
      return s;
    });
  }
`;

// Find and replace the existing get sites() block
const startIndex = c.indexOf('get sites() {');
const endIndex = c.indexOf('set sites(val:', startIndex);
c = c.slice(0, startIndex) + getSitesImpl + '\n  ' + c.slice(endIndex);

fs.writeFileSync('src/services/db.ts', c);
console.log('Updated db.ts for siteMasters');
