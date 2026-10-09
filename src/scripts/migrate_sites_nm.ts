import { db } from '../services/db';

export async function migrateSitesToNM() {
  console.log('Starting N:M Site Migration...');
  await db.pullFromSupabase(); // Ensure latest data

  const sites = db.sites;
  const siteMasters = db.siteMasters;

  let mastersCreated = 0;
  let linksUpdated = 0;

  for (const site of sites) {
    if (site.siteMasterId) continue; // Already migrated

    const rawName = (site.name || '').trim();
    const normalizedName = rawName.replace(/\s+/g, '');

    // Find if a master already exists with this normalized name
    let master = siteMasters.find(m => (m.name || '').replace(/\s+/g, '') === normalizedName);
    
    if (!master) {
      master = {
        id: `sitemaster-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: rawName,
        address: site.address || '',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      siteMasters.push(master);
      db.insertRow('siteMasters', master);
      mastersCreated++;
    }

    // Link it
    site.siteMasterId = master.id;
    db.updateRow('sites', site.id, site);
    linksUpdated++;
  }

  // Wait for all writes
  if (db.pendingWrites.length > 0) {
    await Promise.all(db.pendingWrites);
    db.pendingWrites = [];
  }

  console.log(`Migration Complete. Created ${mastersCreated} masters, linked ${linksUpdated} sites.`);
}
