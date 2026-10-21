// d:\Kiyeun_Lift\src\services\excel.ts
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

/**
 * 정산 사용기간 계산 헬퍼 (시작일~종료일 YYYY-MM-DD ~ YYYY-MM-DD)
 */
export function calcServicePeriod(d: any, billing: any, contract: any): string {
  if (d?.servicePeriod) return d.servicePeriod;
  if (d?.startDate && d?.endDate) return `${d.startDate} ~ ${d.endDate}`;
  if (billing?.periodStart && billing?.periodEnd) return `${billing.periodStart} ~ ${billing.periodEnd}`;
  if (billing?.startDate && billing?.endDate) return `${billing.startDate} ~ ${billing.endDate}`;

  const ym = billing?.billingYm;
  if (ym && ym.length === 7) {
    const [yStr, mStr] = ym.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const closingDay = contract?.closingDay || contract?.defaultStatementClosingDay || 30;

    if (closingDay >= 28 || closingDay === 31 || closingDay === 30) {
      const lastDay = new Date(year, month, 0).getDate();
      return `${ym}-01 ~ ${ym}-${String(lastDay).padStart(2, '0')}`;
    } else {
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevStartDay = closingDay + 1;
      const s = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevStartDay).padStart(2, '0')}`;
      const e = `${ym}-${String(closingDay).padStart(2, '0')}`;
      return `${s} ~ ${e}`;
    }
  }

  if (contract?.startDate) {
    const endStr = !contract.endDate || contract.endDate === '미정' || contract.endDate.startsWith('9999') ? '미정' : contract.endDate;
    return `${contract.startDate} ~ ${endStr}`;
  }

  return billing?.billingYm ? `${billing.billingYm}-01 ~ ${billing.billingYm}-31` : '';
}

/**
 * 💡 [새 서식 표준] 품목 포맷 헬퍼: {모델명}_{관리번호}_{청구시작일}~{청구종료일}
 * 예: JCPT1012AC_K10304_2026-08-01~2026-08-31
 */
export function formatStatementItemName(d: any, billing: any, contract: any): string {
  const period = calcServicePeriod(d, billing, contract);
  const compactPeriod = period.replace(/\s*~\s*/, '~');

  const modelName = d.modelName || d.itemName || '장비';
  const assetNo = d.assetNo ? String(d.assetNo).trim() : '';

  if (assetNo) {
    return `${modelName}_${assetNo}_${compactPeriod}`;
  } else {
    return `${modelName}_${compactPeriod}`;
  }
}

import { db } from './db';
import { generateTransactionStatementExcel, TransactionStatementItem } from './excelTemplateEngine';

/**
 * 청구 상세 1건을 00.거래명세서양식.xlsx 신규 27열 규격의 TransactionStatementItem 으로 변환
 */
export function buildStatementItemFromDetail(
  d: any,
  billing: any,
  contract: any,
  dateM: number | string,
  dateD: number | string
): TransactionStatementItem {
  const ca = d?.contractAssetId ? db.contractAssets?.find((c: any) => c.id === d.contractAssetId) : undefined;
  const asset = ca?.assetId
    ? db.assets?.find((a: any) => a.id === ca.assetId)
    : (d?.assetId ? db.assets?.find((a: any) => a.id === d.assetId) : undefined);

  const rawModel = (d?.modelName || asset?.modelName || ca?.expectedModel || d?.itemName || d?.description || '장비')
    .replace(/\(관리번호:[^)]+\)/g, '')
    .replace(/렌탈료|임대료/g, '')
    .trim();

  const prod = db.products?.find((p: any) =>
    p.modelName && rawModel && (
      p.modelName.replace(/\s+/g, '').toUpperCase() === rawModel.replace(/\s+/g, '').toUpperCase() ||
      rawModel.replace(/\s+/g, '').toUpperCase().includes(p.modelName.replace(/\s+/g, '').toUpperCase())
    )
  );
  const workingHeight = d?.workingHeight || prod?.workingHeight || '';
  const assetNo = d?.assetNo || asset?.assetNo || '';
  const siteEntryDate = d?.siteEntryDate || ca?.startDate || contract?.startDate || '';

  const periodStr = calcServicePeriod(d, billing, contract);
  const [pStart, pEnd] = periodStr.includes('~')
    ? periodStr.split('~').map((s: string) => s.trim())
    : [periodStr.trim(), ''];

  let unitPrice = Number(d?.unitPrice || 0);
  let quantity = Number(d?.quantity || 1);
  const supplyAmount = Number(d?.amount || (unitPrice * quantity));
  const isRental = Boolean(d?.contractAssetId || d?.assetId || assetNo);
  if (isRental && quantity >= 28 && supplyAmount > 0) {
    quantity = 1;
    unitPrice = supplyAmount;
  }
  const vatAmount = d?.vatAmount !== undefined ? Number(d.vatAmount) : Math.round(supplyAmount * 0.1);

  let billingCategory = d?.billingCategory || '';
  if (!billingCategory) {
    const checkText = `${d?.itemName || ''} ${d?.description || ''} ${d?.internalDescription || ''} ${billing?.billingType || ''}`;
    if (billing?.billingType === 'TRANSPORT' || d?.itemCategory === 'TRANSPORT' || /운반|운송|배차|회수|상하차/.test(checkText)) {
      billingCategory = '운반비';
    } else if (billing?.billingType === 'REPAIR' || d?.itemCategory === 'REPAIR' || /수리|파손|정비|부품|AS/i.test(checkText)) {
      billingCategory = '수리비';
    } else if (/\[유상옵션\]|\[OPT:/.test(checkText)) {
      billingCategory = '유상옵션';
    } else if (billing?.billingType === 'ASSET_SALE' || contract?.contractType === 'SALE' || /매각|양도|판매/.test(checkText)) {
      billingCategory = '매각';
    } else if (isRental || billing?.billingType === 'RENTAL' || /렌탈|임대/.test(checkText)) {
      billingCategory = '임대료';
    } else {
      billingCategory = '기타';
    }
  }

  return {
    month: dateM,
    day: dateD,
    modelName: rawModel,
    workingHeight,
    assetNo,
    siteEntryDate,
    periodStart: pStart || '-',
    periodEnd: pEnd || '-',
    billingCategory,
    itemDescription: formatStatementItemName({ ...d, modelName: rawModel, assetNo }, billing, contract),
    quantity,
    unitPrice,
    supplyAmount,
    vatAmount,
    notes: d?.memo || d?.notes || ''
  };
}

/**
 * 거래명세서 양식에 데이터를 채운 Excel 워크북 Buffer 반환
 */
export const exportTransactionStatementExcelBuffer = async (
  billing: any,
  details: any[],
  customer: any,
  contract: any,
  site: any,
  salesperson?: any,
  _templateUrl?: string
): Promise<ArrayBuffer> => {
  const curTenant = db.currentTenant;
  const billingDate: string = billing?.billingDate || new Date().toISOString().split('T')[0];
  const parts = billingDate.split('-');
  const dateM = parts[1] ? Number(parts[1]) : '';
  const dateD = parts[2] ? Number(parts[2]) : '';

  const hasCustom = Boolean(billing?.hasCustomStatement && billing.customStatementItems && billing.customStatementItems.length > 0);
  let totalSupply = 0;
  let totalVat = 0;

  const items: TransactionStatementItem[] = hasCustom
    ? billing.customStatementItems.map((ci: any) => {
        const supply = Number(ci.supplyAmount || ((ci.unitPrice || 0) * (ci.quantity || 1)));
        const vat = ci.vatAmount !== undefined ? Number(ci.vatAmount) : Math.round(supply * 0.1);
        totalSupply += supply;
        totalVat += vat;
        return {
          month: dateM,
          day: dateD,
          modelName: ci.itemDescription || '',
          workingHeight: ci.specification || '',
          assetNo: '-',
          siteEntryDate: contract?.startDate || '-',
          periodStart: '-',
          periodEnd: '-',
          billingCategory: '임대료',
          itemDescription: ci.specification ? `${ci.itemDescription} (${ci.specification})` : ci.itemDescription,
          quantity: Number(ci.quantity || 1),
          unitPrice: Number(ci.unitPrice || supply),
          supplyAmount: supply,
          vatAmount: vat,
          notes: ci.notes || ''
        };
      })
    : [...(details || [])]
        .sort((a, b) => {
          const aIsAsset = Boolean(a.contractAssetId);
          const bIsAsset = Boolean(b.contractAssetId);
          if (aIsAsset && !bIsAsset) return -1;
          if (!aIsAsset && bIsAsset) return 1;
          return 0;
        })
        .map((d: any) => {
          const item = buildStatementItemFromDetail(d, billing, contract, dateM, dateD);
          totalSupply += item.supplyAmount;
          totalVat += item.vatAmount;
          return item;
        });

  const primaryAccount = curTenant?.bankAccounts?.[0];
  const bankAccountStr = primaryAccount
    ? `${primaryAccount.bankName} ${primaryAccount.accountNumber} (${primaryAccount.accountHolder || (primaryAccount as any).holder || curTenant?.tradeName || curTenant?.corporateName || ''})`
    : '';

  return generateTransactionStatementExcel({
    billingDate,
    billingYm: billing?.billingYm || billingDate.slice(0, 7),
    contractNo: contract?.contractNo,
    lessorBizNo: curTenant?.businessNumber || '138-81-83251',
    lessorName: curTenant?.tradeName || curTenant?.corporateName || '(주)기연리프트',
    lessorCeo: curTenant?.representativeName || '이수용',
    lessorAddress: curTenant?.businessAddress || '',
    lessorBizType: curTenant?.businessCategory || '사업지원및임대서비스업',
    lessorBizItem: curTenant?.businessItem || '고소장비임대업',
    lessorTel: curTenant?.tel || '031-334-5295',
    salespersonName: salesperson?.name || contract?.salespersonName || '-',
    salespersonPhone: salesperson?.mobile || salesperson?.phone || curTenant?.salesPhone || curTenant?.tel || '-',
    billingManagerName: curTenant?.workplaces?.[0]?.managerName || '정수아',
    billingManagerPhone: curTenant?.tel || '031-334-5295',
    lessorEmail: curTenant?.taxEmail || curTenant?.email || 'giyeonlift@naver.com',
    customerBizNo: customer?.bizRegNo || customer?.businessNumber || '-',
    customerName: customer?.name || '-',
    customerCeo: customer?.representative || customer?.representativeName || '-',
    customerAddress: customer?.address || '-',
    customerBizType: customer?.bizType || '-',
    customerBizItem: customer?.bizItem || '-',
    siteManagerName: site?.managerName || site?.contactName || site?.contactPerson || customer?.managerName || '-',
    siteManagerPhone: site?.managerPhone || site?.contactPhone || customer?.phone || '-',
    custBillingManagerName: customer?.billingManagerName || customer?.managerName || '-',
    custBillingManagerPhone: customer?.billingManagerPhone || customer?.phone || '-',
    custBillingEmail: customer?.billingEmail || customer?.email || '-',
    siteName: site?.name || (typeof site === 'string' ? site : '-') || '-',
    bankAccount: bankAccountStr,
    items,
    totalSupply,
    totalVat,
    totalGrand: totalSupply + totalVat
  });
};

export const exportTransactionStatementExcel = async (
  billing: any,
  details: any[],
  customer: any,
  contract: any,
  site: any,
  salesperson?: any,
  fileName?: string,
  templateUrl?: string
) => {
  const buffer = await exportTransactionStatementExcelBuffer(
    billing,
    details,
    customer,
    contract,
    site,
    salesperson,
    templateUrl
  );
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName || '거래명세서'}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

