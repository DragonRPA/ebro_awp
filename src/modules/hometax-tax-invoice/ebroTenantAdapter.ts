// src/modules/hometax-tax-invoice/ebroTenantAdapter.ts
/**
 * ebro.run 멀티 테넌트 & 외부 프로젝트(dragonrpa 등) 호환 어댑터
 * - 테넌트 설정(Tenant)에서 공급자 정보를 동적 추출
 * - 청구(Billing) 및 청구상세(BillingDetail)를 홈택스 표준 레코드(HometaxInvoiceRecord)로 변환
 * - 청구건별 1장 발행(PER_BILLING) 및 사업자등록번호 기준 합산 1장 발행(PER_CUSTOMER) 지원
 */

import {
  HometaxSupplierInfo,
  HometaxInvoiceRecord,
  HometaxLineItem,
  HometaxConsolidationMode
} from './types';
import { cleanBizRegNo, formatDay2, formatWriteDate8 } from './hometaxExcelEngine';

export function extractSupplierFromTenant(tenant?: any): HometaxSupplierInfo {
  const firstWorkplace = Array.isArray(tenant?.workplaces) && tenant.workplaces.length > 0 ? tenant.workplaces[0] : null;

  return {
    bizRegNo: cleanBizRegNo(
      tenant?.businessNumber ||
      tenant?.bizRegNo ||
      firstWorkplace?.businessNumber ||
      ''
    ),
    subBizNo: tenant?.subBusinessNumber || firstWorkplace?.subBusinessNumber || '',
    corpName: (
      tenant?.corporateName ||
      tenant?.tradeName ||
      tenant?.displayName ||
      tenant?.name ||
      ''
    ).trim(),
    ceoName: (
      tenant?.representativeName ||
      tenant?.ceoName ||
      firstWorkplace?.representativeName ||
      ''
    ).trim(),
    address: (
      tenant?.businessAddress ||
      tenant?.address ||
      firstWorkplace?.address ||
      ''
    ).trim(),
    bizType: (
      tenant?.businessCategory ||
      tenant?.bizType ||
      firstWorkplace?.businessCategory ||
      '서비스, 건설기계임대'
    ).trim(),
    bizItem: (
      tenant?.businessItem ||
      tenant?.bizItem ||
      firstWorkplace?.businessItem ||
      '고소작업대임대'
    ).trim(),
    email: (
      tenant?.taxEmail ||
      tenant?.officialEmail ||
      tenant?.email ||
      firstWorkplace?.email ||
      ''
    ).trim()
  };
}

export interface EbroAdapterContext {
  billings: any[];
  billingDetails: any[];
  customers: any[];
  contracts?: any[];
  sites?: any[];
  consolidationMode?: HometaxConsolidationMode;
  defaultWriteDate?: string;
}

export function convertEbroBillingsToHometaxRecords(ctx: EbroAdapterContext): HometaxInvoiceRecord[] {
  const {
    billings,
    billingDetails,
    customers,
    contracts = [],
    sites = [],
    consolidationMode = 'PER_BILLING',
    defaultWriteDate
  } = ctx;

  const customerMap = new Map<string, any>();
  customers.forEach(c => {
    if (c?.id) customerMap.set(c.id, c);
  });

  const contractMap = new Map<string, any>();
  contracts.forEach(ct => {
    if (ct?.id) contractMap.set(ct.id, ct);
  });

  const siteMap = new Map<string, any>();
  sites.forEach(s => {
    if (s?.id) siteMap.set(s.id, s);
  });

  const detailsByBillingId = new Map<string, any[]>();
  billingDetails.forEach(d => {
    if (!d?.billingId) return;
    let list = detailsByBillingId.get(d.billingId);
    if (!list) {
      list = [];
      detailsByBillingId.set(d.billingId, list);
    }
    list.push(d);
  });

  // 1. 개별 청구건별 HometaxInvoiceRecord 생성
  const individualRecords: HometaxInvoiceRecord[] = billings.map(b => {
    const cust = customerMap.get(b.customerId) || {};
    const contract = b.contractId ? contractMap.get(b.contractId) : undefined;
    const siteId = b.siteId || contract?.siteId;
    const site = siteId ? siteMap.get(siteId) : undefined;
    const siteName = (site?.name || b.siteName || contract?.siteName || '').trim();

    const rawWriteDate = defaultWriteDate || b.billingDate || new Date().toISOString().slice(0, 10);
    const writeDate8 = formatWriteDate8(rawWriteDate);
    const defaultDay = formatDay2(undefined, writeDate8);

    const supplyAmount = Math.round(Number(b.totalAmount || 0));
    const taxAmount = Math.round(supplyAmount * 0.1);
    const grandTotal = supplyAmount + taxAmount;
    const isPaid = b.status === 'PAID' || (Number(b.paidAmount || 0) >= grandTotal && grandTotal > 0);
    const unpaidAmount = isPaid ? 0 : Math.max(0, grandTotal - Number(b.paidAmount || 0));

    // 이메일 추출 (최대 2개)
    const rawEmailStr = (cust.billingEmail || cust.taxEmail || cust.email || '').trim();
    const emailTokens = rawEmailStr
      .split(/[,;\s]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.includes('@'));

    // 품목 추출
    const bDetails = detailsByBillingId.get(b.id) || [];
    const customItems = Array.isArray(b.customStatementItems) && b.customStatementItems.length > 0
      ? b.customStatementItems
      : null;

    let items: HometaxLineItem[] = [];

    if (customItems) {
      items = customItems.map((ci: any) => {
        const sAmt = Math.round(Number(ci.supplyAmount ?? ci.amount ?? 0));
        const tAmt = Math.round(Number(ci.vatAmount ?? sAmt * 0.1));
        return {
          day: formatDay2(ci.day, writeDate8),
          itemName: (ci.modelName || ci.itemDescription || '장비 임대료').trim(),
          spec: (ci.workingHeight || ci.spec || '').trim(),
          quantity: ci.quantity ?? 1,
          unitPrice: Math.round(Number(ci.unitPrice ?? sAmt)),
          supplyAmount: sAmt,
          taxAmount: tAmt,
          memo: (ci.notes || siteName || '').trim()
        };
      });
    } else if (bDetails.length > 0) {
      items = bDetails.map((d: any) => {
        const sAmt = Math.round(Number(d.amount || 0));
        const tAmt = Math.round(sAmt * 0.1);
        const rawName = (d.displayName || d.itemName || '장비 임대료').replace(/\(가상\)/g, '').trim();
        return {
          day: defaultDay,
          itemName: rawName,
          spec: '',
          quantity: d.quantity ?? 1,
          unitPrice: Math.round(Number(d.unitPrice ?? sAmt)),
          supplyAmount: sAmt,
          taxAmount: tAmt,
          memo: (d.description || siteName || '').trim()
        };
      });
    } else {
      const defaultTitle = siteName ? `장비 임대료 (${siteName})` : `장비 임대료 (${b.billingYm || ''})`;
      items = [
        {
          day: defaultDay,
          itemName: defaultTitle.trim(),
          spec: '',
          quantity: 1,
          unitPrice: supplyAmount,
          supplyAmount: supplyAmount,
          taxAmount: taxAmount,
          memo: (b.memo || '').trim()
        }
      ];
    }

    const buyerBizNo = cleanBizRegNo(cust.bizRegNo || cust.businessNumber || '');

    return {
      id: b.id,
      sourceIds: [b.id],
      taxType: '01',
      writeDate: rawWriteDate,
      buyer: {
        customerId: cust.id || b.customerId,
        bizRegNo: buyerBizNo,
        subBizNo: cust.subBizNo || cust.subBusinessNumber || '',
        corpName: (cust.name || b.customerName || '').trim(),
        ceoName: (cust.representative || cust.representativeName || cust.ceoName || '').trim(),
        address: (cust.address || cust.businessAddress || '').trim(),
        bizType: (cust.bizType || cust.businessCategory || '').trim(),
        bizItem: (cust.bizItem || cust.businessItem || '').trim(),
        email1: emailTokens[0] || '',
        email2: emailTokens[1] || ''
      },
      totalSupplyAmount: supplyAmount,
      totalTaxAmount: taxAmount,
      remark: siteName || (b.memo || '').trim(),
      items,
      creditAmount: unpaidAmount > 0 ? unpaidAmount : undefined,
      receiptOrClaim: isPaid ? '01' : '02',
      siteName,
      billingYm: b.billingYm || '',
      isPaid
    };
  });

  if (consolidationMode !== 'PER_CUSTOMER') {
    return individualRecords;
  }

  // 2. 고객사(사업자등록번호 10자리 우선, 미등록 시 customerId) 기준 합산 1장 발행 (헌장 1.6 준수)
  const groupedMap = new Map<string, HometaxInvoiceRecord>();

  individualRecords.forEach(rec => {
    const groupKey = rec.buyer.bizRegNo && rec.buyer.bizRegNo.length >= 10
      ? `BIZ:${rec.buyer.bizRegNo}`
      : `CUST:${rec.buyer.customerId || rec.buyer.corpName || rec.id}`;

    const existing = groupedMap.get(groupKey);
    if (!existing) {
      groupedMap.set(groupKey, {
        ...rec,
        sourceIds: [...(rec.sourceIds || [rec.id])],
        items: [...rec.items]
      });
    } else {
      existing.sourceIds = [...(existing.sourceIds || []), ...(rec.sourceIds || [rec.id])];
      existing.totalSupplyAmount += rec.totalSupplyAmount;
      existing.totalTaxAmount += rec.totalTaxAmount;
      existing.creditAmount = (existing.creditAmount || 0) + (rec.creditAmount || 0);
      existing.items.push(...rec.items);
      if (rec.writeDate > existing.writeDate) {
        existing.writeDate = rec.writeDate;
      }
      if (!rec.isPaid) {
        existing.isPaid = false;
        existing.receiptOrClaim = '02';
      }
      if (rec.siteName && existing.siteName && !existing.siteName.includes(rec.siteName)) {
        existing.siteName = `${existing.siteName}, ${rec.siteName}`;
        existing.remark = existing.siteName;
      }
    }
  });

  return Array.from(groupedMap.values());
}
