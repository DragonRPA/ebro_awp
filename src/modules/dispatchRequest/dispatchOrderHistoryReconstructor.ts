// src/modules/dispatchRequest/dispatchOrderHistoryReconstructor.ts
// 출고 요청 내역(OUTBOUND / EXCHANGE) 통합 재구성 SSOT 엔진

import { StandardOption } from '../../services/db';
import {
  splitMasterAwareOptions,
  extractAppliedPricesFromSpecs
} from '../../types/siteOption';
import { OutboundHistoryRow } from './dispatchOrderTypes';
import { classifyOptionCategory } from './dispatchOrderParser';

export interface ReconstructOutboundHistoryParams {
  deliveries: any[];
  contracts: any[];
  contractAssets: any[];
  assets: any[];
  customers: any[];
  sites: any[];
  siteMasters: any[];
  contacts: any[];
  users: any[];
  todos: any[];
  standardOptions: StandardOption[];
  outboundInspections: any[];
}

export function reconstructOutboundHistoryRows(
  params: ReconstructOutboundHistoryParams
): OutboundHistoryRow[] {
  const {
    deliveries = [],
    contracts = [],
    contractAssets = [],
    assets = [],
    customers = [],
    sites = [],
    siteMasters = [],
    contacts = [],
    users = [],
    todos = [],
    standardOptions = [],
    outboundInspections = []
  } = params;

  const isProtectionOption = (label: string) => classifyOptionCategory(label, standardOptions) === 'FREE';
  const isAttachmentOption = (label: string) => classifyOptionCategory(label, standardOptions) === 'ATTACHMENT';
  const isSpecOption = (label: string) => classifyOptionCategory(label, standardOptions) === 'SPEC';

  const outboundList = (deliveries || [])
    .filter(
      d =>
        d.type === 'OUTBOUND' ||
        d.type === 'EXCHANGE' ||
        d.dispatchCategory === '출고' ||
        d.dispatchCategory === '교환' ||
        (d as any).originalDispatchCategory === '출고' ||
        (d as any).originalDispatchCategory === '교환'
    )
    .sort((a, b) => {
      const da = a.createdAt || a.requestDate || '';
      const dbStr = b.createdAt || b.requestDate || '';
      return dbStr.localeCompare(da);
    });

  return outboundList.map(d => {
    const contract = d.contractId ? contracts.find(c => c.id === d.contractId) : undefined;
    const customer = contract?.customerId ? customers.find(c => c.id === contract.customerId) : undefined;
    const site = contract?.siteId ? sites.find(s => s.id === contract.siteId) : undefined;
    const sm = site?.siteMasterId ? (siteMasters || []).find(m => m.id === site.siteMasterId) : undefined;

    let parsedCargo: any[] = [];
    try {
      if (d.cargoItems) {
        const raw = typeof d.cargoItems === 'string' ? JSON.parse(d.cargoItems) : d.cargoItems;
        if (Array.isArray(raw)) parsedCargo = raw;
      }
    } catch {
      parsedCargo = [];
    }

    const snapMeta = parsedCargo.find(c => c?.requestMeta)?.requestMeta;

    // 요청자 복원
    const matchedTodo = todos.find(t => {
      const tAny = t as any;
      return (
        (t.entityId === d.id || t.relatedEntityId === d.id) &&
        (tAny.category === 'DISPATCH_REQUEST' || String(t.title || '').includes('출고'))
      );
    });
    const contractSalesperson = contract?.salespersonId ? users.find(u => u.id === contract.salespersonId) : undefined;
    const requesterName = snapMeta?.requesterName || matchedTodo?.senderName || contractSalesperson?.name || '-';

    // 고객사명 / 현장명 / 상세주소 복원
    let customerName = customer?.name || snapMeta?.customerName || '';
    let siteName = snapMeta?.siteName || site?.name || '';
    let siteAddress = snapMeta?.siteAddress || site?.address || '';
    if ((!customerName || !siteName) && d.destinationAddress) {
      const destMatch = d.destinationAddress.match(/^(.+?)\s*\((.+?)(?:\s*-\s*(.*))?\)$/);
      if (destMatch) {
        if (!customerName) customerName = destMatch[1].trim();
        if (!siteName) siteName = destMatch[2].trim();
        if (!siteAddress && destMatch[3]) siteAddress = destMatch[3].trim();
      } else if (!customerName) {
        customerName = d.destinationAddress;
      }
    }

    // 현장담당자 / 연락처 / 이메일 복원
    let siteContactName = snapMeta?.siteContactName || '';
    let siteContactPhone = snapMeta?.siteContactPhone || '';
    let siteContactEmail =
      snapMeta?.siteContactEmail && snapMeta.siteContactEmail !== '미상' && snapMeta.siteContactEmail !== '-'
        ? snapMeta.siteContactEmail
        : '';
    if (!siteContactName && d.memo) {
      const mContact = d.memo.match(/현장담당:\s*([^\(|]+?)(?:\s*\(([^)]+)\))?(?:\s*\||$)/);
      if (mContact) {
        const n = (mContact[1] || '').trim();
        const p = (mContact[2] || '').trim();
        if (n && n !== '-') siteContactName = n;
        if (p && p !== '-') siteContactPhone = p;
      }
    }
    if (site) {
      const actContacts = ((site as any).contacts || []).filter(
        (c: any) => c.isActive !== false && c.name && c.name !== '미상'
      );
      if (!siteContactName) {
        if (actContacts.length > 0) {
          siteContactName = actContacts[0].name;
          siteContactPhone = actContacts[0].contact || '';
          if (!siteContactEmail && actContacts[0].email && actContacts[0].email !== '미상') {
            siteContactEmail = actContacts[0].email;
          }
        } else if (site.contactName && site.contactName !== '미상') {
          siteContactName = site.contactName;
          siteContactPhone = site.contact || '';
        }
      }
      if (!siteContactEmail) {
        const cleanPhone = (siteContactPhone || '').replace(/[^0-9]/g, '');
        const matchedSiteContact =
          actContacts.find((c: any) => {
            if (!c.email || c.email === '미상') return false;
            const cPhone = (c.contact || '').replace(/[^0-9]/g, '');
            if (cleanPhone && cPhone && cleanPhone === cPhone) return true;
            if (siteContactName && c.name && (siteContactName === c.name || siteContactName.startsWith(c.name))) {
              return true;
            }
            return false;
          }) || actContacts.find((c: any) => c.email && c.email !== '미상');
        if (matchedSiteContact?.email) {
          siteContactEmail = matchedSiteContact.email;
        } else if ((site as any).email && (site as any).email !== '미상') {
          siteContactEmail = (site as any).email;
        }
      }
    }
    if (!siteContactEmail && customer) {
      const custContacts = (contacts || []).filter(
        c => c.customerId === customer.id && c.isActive !== false && c.email && c.email !== '미상'
      );
      const cleanPhone = (siteContactPhone || '').replace(/[^0-9]/g, '');
      const matchedCustContact =
        custContacts.find(c => {
          const cPhone = (c.contact || '').replace(/[^0-9]/g, '');
          if (cleanPhone && cPhone && cleanPhone === cPhone) return true;
          if (siteContactName && c.name && (siteContactName === c.name || siteContactName.startsWith(c.name))) {
            return true;
          }
          return false;
        }) || custContacts[0];
      if (matchedCustContact?.email) {
        siteContactEmail = matchedCustContact.email;
      } else if ((customer as any).email && (customer as any).email !== '미상') {
        siteContactEmail = (customer as any).email;
      }
    }

    // 장비 목록 및 단가 / 할당 현황 복원
    const allCaIds: string[] = [];
    const equipmentItems: OutboundHistoryRow['equipmentItems'] = [];
    const deliveryDirectInspections = outboundInspections.filter(ins => ins.deliveryId === d.id);

    if (parsedCargo.length > 0) {
      parsedCargo.forEach(ci => {
        const caIds: string[] = Array.isArray(ci.contractAssetIds) ? [...ci.contractAssetIds] : [];
        if (caIds.length === 0 && deliveryDirectInspections.length > 0) {
          deliveryDirectInspections.forEach(ins => {
            const caId = (ins as any).contractAssetId;
            if (caId && !caIds.includes(caId)) {
              const caObj = contractAssets.find(ca => ca.id === caId);
              if (!caObj || !ci.modelName || caObj.expectedModel === ci.modelName) {
                caIds.push(caId);
              }
            }
          });
        }
        allCaIds.push(...caIds);
        const matchedCas =
          d.status === 'CANCELLED'
            ? []
            : caIds
                .map(id => contractAssets.find(ca => ca.id === id && (!d.contractId || ca.contractId === d.contractId)))
                .filter(Boolean);
        const firstCa = matchedCas[0];
        const monthlyRate = Number(ci.monthlyRentalFee || firstCa?.monthlyRentalFee || 0);
        const dailyRate = Number(ci.dailyRentalFee || firstCa?.dailyRentalFee || (monthlyRate ? Math.round(monthlyRate / 30) : 0));
        const assignedAssets: string[] = [];
        let unassignedCount = 0;

        if (matchedCas.length > 0) {
          matchedCas.forEach(ca => {
            if (ca?.assetId) {
              const a = assets.find(as => as.id === ca.assetId);
              assignedAssets.push(a?.assetNo || (a as any)?.managementNo || ca.assetId);
            } else {
              unassignedCount++;
            }
          });
          const requestedQty = Number(ci.count) || 1;
          if (assignedAssets.length + unassignedCount < requestedQty) {
            unassignedCount = Math.max(0, requestedQty - assignedAssets.length);
          }
        } else {
          unassignedCount = Number(ci.count) || 1;
        }

        equipmentItems.push({
          contractAssetIds: caIds,
          modelName: ci.modelName || '-',
          qty: Number(ci.count) || 1,
          monthlyRate,
          dailyRate,
          assignedAssets,
          unassignedCount
        });
      });
    } else if (d.contractId) {
      const allContractCas = contractAssets.filter(
        ca => ca.contractId === d.contractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD'
      );
      const pendingOrAssignedCas = allContractCas.filter(ca => {
        if (!ca.assetId) return true;
        const a = assets.find(as => as.id === ca.assetId);
        return ca.status === 'ASSIGNED' || a?.status === 'ASSIGNED';
      });
      const fallbackCas = pendingOrAssignedCas.length > 0 ? pendingOrAssignedCas : allContractCas;
      const groupedMap = new Map<string, typeof fallbackCas>();
      fallbackCas.forEach(ca => {
        const modelKey = (ca.expectedModel || '미지정').trim();
        const arr = groupedMap.get(modelKey) || [];
        arr.push(ca);
        groupedMap.set(modelKey, arr);
      });
      groupedMap.forEach((casForModel, modelName) => {
        const caIds = casForModel.map(c => c.id);
        allCaIds.push(...caIds);
        const firstCa = casForModel[0];
        const monthlyRate = Number(firstCa?.monthlyRentalFee || 0);
        const dailyRate = Number(firstCa?.dailyRentalFee || (monthlyRate ? Math.round(monthlyRate / 30) : 0));
        const assignedAssets: string[] = [];
        let unassignedCount = 0;
        casForModel.forEach(ca => {
          if (ca.assetId) {
            const a = assets.find(as => as.id === ca.assetId);
            assignedAssets.push(a?.assetNo || (a as any)?.managementNo || ca.assetId);
          } else {
            unassignedCount++;
          }
        });
        equipmentItems.push({
          contractAssetIds: caIds,
          modelName: modelName || '-',
          qty: casForModel.length,
          monthlyRate,
          dailyRate,
          assignedAssets,
          unassignedCount
        });
      });
    }

    const totalQty = equipmentItems.reduce((sum, eq) => sum + eq.qty, 0);
    const totalAssignedCount = equipmentItems.reduce((sum, eq) => sum + eq.assignedAssets.length, 0);
    const totalUnassignedCount = equipmentItems.reduce((sum, eq) => sum + eq.unassignedCount, 0);

    // 유상옵션 및 적용 단가·청구조건·1대당수량 복원
    let paidOptionsStr = parsedCargo[0]?.paidOptions || '';
    const paidOptionPricesMap: Record<string, number> = parsedCargo[0]?.paidOptionPrices || snapMeta?.paidOptionPrices || {};
    const fallbackSpecsPricesMap = extractAppliedPricesFromSpecs(
      standardOptions || [],
      snapMeta?.checkedSpecs,
      site?.checkedSpecs,
      sm?.checkedSpecs,
      (customer as any)?.defaultCheckedSpecs
    );
    const paidOptionUnitsMap: Record<string, '월' | '대' | '건' | '수량'> =
      parsedCargo[0]?.paidOptionUnits || snapMeta?.paidOptionUnits || {};
    const paidOptionQtysMap: Record<string, number> =
      parsedCargo[0]?.paidOptionQtys || snapMeta?.paidOptionQtys || {};
    if (!paidOptionsStr && d.closingMemo) {
      const mOpt = d.closingMemo.match(/유상옵션:\s*([^|]+)/);
      if (mOpt && mOpt[1].trim() !== '없음') paidOptionsStr = mOpt[1].trim();
    }
    const paidOptionItems = splitMasterAwareOptions(paidOptionsStr, standardOptions, {
      onlyMasterOptions: false,
      stripPrice: true
    })
      .filter(o => o && o !== '없음' && o !== 'NONE' && !isProtectionOption(o) && !isAttachmentOption(o) && !isSpecOption(o))
      .map(optName => {
        const customPrice =
          paidOptionPricesMap[optName] !== undefined
            ? paidOptionPricesMap[optName]
            : fallbackSpecsPricesMap[optName];
        const customUnit = paidOptionUnitsMap[optName];
        const customPerUnitQty = paidOptionQtysMap[optName];
        const masterOpt = (standardOptions || []).find(so => so.name === optName);
        const unitPrice = customPrice !== undefined ? Number(customPrice) : (masterOpt?.defaultPrice || 0);
        const rawDefUnit = (masterOpt?.unit || '월').trim();
        const defUnit: '월' | '대' | '건' | '수량' =
          rawDefUnit === '건' ? '건' : rawDefUnit === '수량' ? '수량' : rawDefUnit === '대' ? '대' : '월';
        const unitLabel: '월' | '대' | '건' | '수량' =
          customUnit === '건' || customUnit === '대' || customUnit === '월' || customUnit === '수량'
            ? customUnit
            : defUnit;
        const defQtyPerUnit = Math.max(1, Number((masterOpt as any)?.defaultQtyPerUnit) || 1);
        const perUnitQty =
          customPerUnitQty !== undefined && Number(customPerUnitQty) >= 1 ? Number(customPerUnitQty) : defQtyPerUnit;
        return {
          name: optName,
          price: unitPrice,
          isCustomPrice:
            customPrice !== undefined &&
            masterOpt?.defaultPrice !== undefined &&
            Number(customPrice) !== Number(masterOpt.defaultPrice),
          isCustomUnit: customUnit !== undefined && customUnit !== defUnit,
          unitLabel,
          perUnitQty
        };
      });

    // 무상옵션 / 부착물 / 현장요구사양 복원
    let protectionStr = snapMeta?.protection || '';
    if (!protectionStr && d.closingMemo) {
      const mProt = d.closingMemo.match(/보양:\s*([^|]+)/);
      if (mProt && mProt[1].trim() !== '없음' && mProt[1].trim() !== 'NONE') protectionStr = mProt[1].trim();
    }
    if (!protectionStr && site?.protection && site.protection !== 'NONE') {
      protectionStr = site.protection;
    }
    const attachmentsStr = snapMeta?.attachments || site?.attachments || sm?.attachments || '';
    const checkedSpecsObj: Record<string, boolean> = snapMeta?.checkedSpecs || site?.checkedSpecs || sm?.checkedSpecs || {};
    const specOptionNames = (standardOptions || [])
      .filter(so => so && so.category === 'SPEC' && checkedSpecsObj[so.id])
      .map(so => so.name);
    const specsStr = specOptionNames.length > 0 ? specOptionNames.join(', ') : '';

    // 특이사항 / 메모 복원
    let userNote = snapMeta?.userNote || '';
    let staggeredText = snapMeta?.staggeredMemo || '';
    if (!userNote && d.memo && !d.memo.startsWith('[마감조건]')) {
      const mNote = d.memo.match(/특이사항:\s*(.+)$/);
      if (mNote) {
        const rawTail = mNote[1].trim();
        const tailParts = rawTail
          .split(' | ')
          .filter(
            (p: string) =>
              !p.startsWith('[하차일정]') &&
              !p.startsWith('[옵션]') &&
              !p.startsWith('[현장상세주소]') &&
              !p.startsWith('[차종]') &&
              !p.startsWith('[정산일정]') &&
              !p.startsWith('[운송료청구기준]')
          );
        userNote = tailParts.join(' | ');
      }
      const mStag = d.memo.match(/\[시차출고\]\s*([^|]+)/);
      if (mStag) staggeredText = mStag[1].trim();
    }

    const reqTypeLabel =
      d.type === 'EXCHANGE' || d.dispatchCategory === '교환'
        ? '교환'
        : snapMeta?.context === 'NEW_CUSTOMER' || d.rawText?.includes('NEW_CUSTOMER')
          ? '신규고객 출고'
          : '기존현장 출고';

    const freightBillingStandardVal: '2/4' | '3/5' =
      snapMeta?.freightBillingStandard === '2/4' || (d.memo || '').includes('2/4') || (d.rawText || '').includes('2/4')
        ? '2/4'
        : '3/5';

    // 출고검수 상태 확인
    const matchedInspections = outboundInspections.filter(
      ins =>
        ins.deliveryId === d.id ||
        (ins.contractId === d.contractId && allCaIds.some(caId => (ins as any).contractAssetId === caId))
    );
    const approvedInspCount = matchedInspections.filter(
      i => (i.status as string) === 'APPROVED' || i.status === 'COMPLETED'
    ).length;
    const hasRentedAsset =
      totalAssignedCount > 0 &&
      allCaIds.some(caId => {
        const ca = contractAssets.find(c => c.id === caId);
        if (!ca || !ca.assetId) return false;
        const a = assets.find(as => as.id === ca.assetId);
        return a?.status === 'RENTED';
      });
    const isInspectionCompleted = totalAssignedCount > 0 && (approvedInspCount > 0 || hasRentedAsset);
    const canEditPreInspection =
      d.status !== 'CANCELLED' &&
      d.status !== 'DELIVERED' &&
      d.status !== 'COMPLETED' &&
      !isInspectionCompleted;
    const canCancelRequest = canEditPreInspection && d.status !== 'DISPATCHED' && totalAssignedCount === 0;

    let cancelBlockBadge = '취소불가';
    let cancelBlockTooltip = '출고 검수가 완료되어 취소할 수 없습니다';
    if (d.status === 'DELIVERED' || d.status === 'COMPLETED') {
      cancelBlockBadge = '취소/수정 불가';
      cancelBlockTooltip = '운송이 완료된 건은 더이상 취소하거나 수정할 수 없습니다';
    } else if (isInspectionCompleted) {
      cancelBlockBadge = '검수취소 필요';
      cancelBlockTooltip = '[출고 검수]에서 출고 승인 취소(검수 롤백)를 먼저 수행해야 합니다';
    } else if (d.status === 'DISPATCHED' && totalAssignedCount > 0) {
      cancelBlockBadge = '배차·할당취소 필요';
      cancelBlockTooltip = '[배차/운송 관리]에서 배차 취소 및 [장비 할당]에서 장비 할당 취소를 먼저 수행해야 합니다';
    } else if (d.status === 'DISPATCHED') {
      cancelBlockBadge = '배차취소 필요';
      cancelBlockTooltip = '[배차/운송 관리]에서 배차 취소를 먼저 수행하여 배차대기 상태로 전환해야 합니다';
    } else if (totalAssignedCount > 0) {
      cancelBlockBadge = '할당취소 필요';
      cancelBlockTooltip = `[장비 할당]에서 할당된 장비(${totalAssignedCount}대)의 할당 취소를 먼저 수행해야 합니다`;
    }

    return {
      id: d.id,
      delivery: d,
      contractNo: contract?.contractNo || '-',
      contractId: d.contractId || '',
      createdAt: d.createdAt || d.requestDate || '',
      requesterName,
      reqTypeLabel,
      freightBillingStandard: freightBillingStandardVal,
      customerName: customerName || '-',
      siteName: siteName || '-',
      siteAddress: siteAddress || '-',
      siteContactName: siteContactName || '-',
      siteContactPhone: siteContactPhone || '-',
      siteContactEmail: siteContactEmail || '-',
      equipmentItems,
      totalQty,
      totalAssignedCount,
      totalUnassignedCount,
      paidOptionItems,
      protectionStr: protectionStr && protectionStr !== 'NONE' ? protectionStr : '없음',
      attachmentsStr: attachmentsStr && attachmentsStr !== 'NONE' ? attachmentsStr : '없음',
      specsStr: specsStr || '없음',
      checkedSpecsObj,
      loadingDateVal: d.loadingDate || '',
      loadingTimeSlotVal: (d.loadingTimeSlot || '오전').replace(/ASAP/g, '최우선'),
      unloadingDateVal: d.unloadingDate || d.loadingDate || '',
      unloadingTimeSlotVal: (d.unloadingTimeSlot || d.loadingTimeSlot || '오전').replace(/ASAP/g, '최우선'),
      loadingSchedule: `${d.loadingDate || '-'} ${(d.loadingTimeSlot || '').replace(/ASAP/g, '최우선')}`.trim(),
      unloadingSchedule: `${d.unloadingDate || d.loadingDate || '-'} ${(d.unloadingTimeSlot || d.loadingTimeSlot || '').replace(/ASAP/g, '최우선')}`.trim(),
      vehicleType: d.vehicleType || '5T',
      driverName: d.driverName || '',
      driverContact: d.driverContact || '',
      vehicleNo: d.vehicleNo || '',
      transportCompany: d.transportCompany || '',
      billableToCustomer: !!d.billableToCustomer,
      dispatchStatus: (() => {
        if (d.status === 'DISPATCHED' && d.loadingCompletedAt) {
          const nowObj = new Date();
          const todayLocalStr = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-${String(nowObj.getDate()).padStart(2, '0')}`;
          const effUnload = (d.unloadingDate || d.loadingDate || d.scheduledDate || '').slice(0, 10);
          if (!effUnload || effUnload <= todayLocalStr) {
            return 'DELIVERED';
          }
        }
        return d.status;
      })(),
      isLoadedWaitingUnload: Boolean(d.status === 'DISPATCHED' && d.loadingCompletedAt),
      approvedInspCount,
      isInspectionCompleted,
      canEditPreInspection,
      canCancelRequest,
      cancelBlockBadge,
      cancelBlockTooltip,
      cancelReason: snapMeta?.cancelReason || '',
      cancelledAt: snapMeta?.cancelledAt || '',
      cancelledBy: snapMeta?.cancelledBy || '',
      userNote: userNote && userNote !== '없음' ? userNote : '',
      staggeredText,
      closingMemo: d.closingMemo || '',
      rawMemo: d.memo || ''
    };
  });
}
