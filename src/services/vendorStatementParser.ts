export interface VendorStatementRow { id: string; [key: string]: any; }
export interface ParseVendorStatementResult { headerRowIndex: number; rows: VendorStatementRow[]; totalParsedCount: number; totalParsedAmount: number; detectedVendor: string; }
export const parseVendorStatementExcel = (worksheet: any, selectedYm: string, fileName: string): ParseVendorStatementResult => { return { headerRowIndex: -1, rows: [], totalParsedCount: 0, totalParsedAmount: 0, detectedVendor: '?뚯닔?놁쓬' }; };
