const fs = require('fs');
let c = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

const saveSiteNewImpl = `
  const saveSite = async (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => {
    // 1. SiteMaster (독립 현장 마스터) 저장/업데이트
    let masterId = site.siteMasterId;
    const rawName = site.name.trim();
    const normalizedName = rawName.replace(/\\s+/g, '');
    
    let existingMaster = db.siteMasters.find(m => m.name.replace(/\\s+/g, '') === normalizedName);
    
    if (existingMaster) {
      masterId = existingMaster.id;
      // 주소가 변경되었으면 마스터 업데이트
      if (site.address && site.address !== existingMaster.address) {
        existingMaster = { ...existingMaster, address: site.address, updatedAt: new Date().toISOString() };
        db.updateRow('siteMasters', masterId, existingMaster);
      }
    } else {
      // 신규 마스터 생성
      const newMaster = db.insertRow('siteMasters', {
        name: rawName,
        address: site.address || '',
        isActive: true,
        createdAt: new Date().toISOString()
      });
      masterId = newMaster.id;
    }

    // 2. CustomerSiteLink (고객-현장 조인 테이블) 저장/업데이트
    const linkPayload = {
      ...site,
      siteMasterId: masterId,
      // name, address는 link 테이블에서 제외할 수도 있지만 하위 호환성을 위해 유지하거나 그대로 덮어씀
    };

    if (site.id) {
      db.updateRow<CustomerSite>('sites', site.id, linkPayload as CustomerSite);
    } else {
      db.insertRow<CustomerSite>('sites', {
        ...linkPayload,
        isActive: site.isActive !== undefined ? site.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<CustomerSite, 'id'>);
    }

    if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
      try {
        await Promise.all(db.pendingWrites);
        db.pendingWrites = [];
      } catch (err) {
        console.error("Supabase write await error:", err);
        throw err;
      }
    }

    refreshAllData();
  };
`;

const startIndex = c.indexOf("const saveSite = async (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => {");
const endIndex = c.indexOf("const deleteSite = async (id: string) => {", startIndex);

c = c.slice(0, startIndex) + saveSiteNewImpl + '\n  ' + c.slice(endIndex);

fs.writeFileSync('src/context/AppContext.tsx', c);
console.log('Updated AppContext saveSite');
