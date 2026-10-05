const fs = require('fs');
let code = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');

code = code.replace(/export interface MenuManualDetail {[\s\S]*?}/, 
`export interface MenuManualDetail {
  menuId: string;
  version: number;
  menuName: string;
  items?: ManualAnnotationItem[];
  tabs?: MenuSubTabDetail[];
  basicGuide?: any;
  processes?: any;
}`);

code = code.replace(/export interface MenuSubTabDetail {[\s\S]*?}/,
`export interface MenuSubTabDetail {
  tabId: string;
  tabName: string;
  items: ManualAnnotationItem[];
  basicGuide?: any;
  processes?: any;
}`);

fs.writeFileSync('src/data/allMenuManuals.ts', code);
