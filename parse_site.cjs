const fs = require('fs');
const tsCode = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
// remove the export const ALL_MENU_MANUALS: MenuManual[] = [
const jsonStr = tsCode.replace(/export const ALL_MENU_MANUALS: MenuManual\[\] = /, '').replace(/;$/, '');
try {
  const manuals = eval('(' + jsonStr + ')');
  const siteOpt = manuals.find(m => m.menuId === 'site_options');
  console.log(JSON.stringify(siteOpt.annotations, null, 2));
} catch(e) {
  console.error(e.message);
}
