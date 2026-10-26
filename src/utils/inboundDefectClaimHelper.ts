// @ts-nocheck
import {
  Asset,
  AssetInOutLog,
  ClaimNegotiationStatus,
  Contract,
  ContractAsset,
  Customer,
  CustomerSite,
  Delivery,
  InboundClaimDefectItem,
  InboundDefectClaimMeta,
  Receivable,
  Repair,
  User,
  Vendor,
} from '../services/db';

const LOCAL_CLAIM_META_STORAGE_KEY = 'ebro_inbound_defect_claim_meta_v1';

export interface RecentInboundLookupResult {
  asset: Asset;
  assetId: string;
  assetNo: string;
  modelName: string;
  ownerType: 'OWN' | 'RENTED';
  vendorName: string;
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  outboundDate: string;
  inboundDate: string;
  billingDay?: number;
  contractId: string;
  contractNo: string;
  salespersonId: string;
  salespersonName: string;
  customerContactName: string;
  customerEmail: string;
  customerPhone: string;
  recentRepairId?: string;
  sourceLabel: string;
}

export function saveLocalClaimMetaCache(receivableId: string, meta: InboundDefectClaimMeta): void {
  try {
    const raw = localStorage.getItem(LOCAL_CLAIM_META_STORAGE_KEY);
    const map: Record<string, InboundDefectClaimMeta> = raw ? JSON.parse(raw) : {};
    map[receivableId] = meta;
    localStorage.setItem(LOCAL_CLAIM_META_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage 용량 초과 등 예외 무시 (DB repairs.defectsJson이 주 저장소)
  }
}

export function getLocalClaimMetaCache(receivableId: string): InboundDefectClaimMeta | null {
  try {
    const raw = localStorage.getItem(LOCAL_CLAIM_META_STORAGE_KEY);
    if (!raw) return null;
    const map: Record<string, InboundDefectClaimMeta> = JSON.parse(raw);
    return map[receivableId] || null;
  } catch {
    return null;
  }
}

/**
 * 관리번호(자산번호)를 기준으로 최근 입고된 이력(입출고로그, 배차/입고, 입고정비, 체결자산, 계약)을
 * 역추적하여 고객명, 현장명, 현장주소, 대여출고일~입고일, 마감일, 계약/영업담당자, 고객 연락처, 임차처 정보를 자동 완성한다.
 */
export function lookupRecentInboundInfoByAsset(
  assetQuery: string,
  context: {
    assets: Asset[];
    assetInOutLogs: AssetInOutLog[];
    contractAssets: ContractAsset[];
    contracts: Contract[];
    deliveries: Delivery[];
    repairs: Repair[];
    customers: Customer[];
    sites: CustomerSite[];
    users?: User[];
    vendors?: Vendor[];
  }
): RecentInboundLookupResult | null {
  const normalizedQuery = (assetQuery || '').trim().toUpperCase();
  if (!normalizedQuery) return null;

  const {
    assets = [],
    assetInOutLogs = [],
    contractAssets = [],
    contracts = [],
    deliveries = [],
    repairs = [],
    customers = [],
    sites = [],
    users = [],
    vendors = [],
  } = context;

  // 1. 정확히 일치하는 자산번호, 타사장비번호, 또는 ID 우선 검색, 없으면 부분 일치 검색
  const asset =
    assets.find(
      (a) =>
        (a.assetNo || '').trim().toUpperCase() === normalizedQuery ||
        ((a as any).vendorAssetNo || '').trim().toUpperCase() === normalizedQuery ||
        (a.id || '').trim().toUpperCase() === normalizedQuery
    ) ||
    assets.find((a) => (a.assetNo || '').trim().toUpperCase().includes(normalizedQuery));

  if (!asset) return null;

  const isRented =
    asset.ownerType === 'RENTED' ||
    (asset as any).ownership === 'SUBLEASE' ||
    (asset as any).ownership === 'RENTED';
  const ownerType: 'OWN' | 'RENTED' = isRented ? 'RENTED' : 'OWN';
  let vendorName = '';
  if (isRented) {
    if (asset.vendorId) {
      const vnd = vendors.find((v) => v && v.id === asset.vendorId);
      if (vnd?.name?.trim()) vendorName = vnd.name.trim();
    }
    if (!vendorName && asset.renter?.trim()) vendorName = asset.renter.trim();
    if (!vendorName && asset.supplier?.trim()) vendorName = asset.supplier.trim();
    if (!vendorName) vendorName = '외부임차';
  }

  const matchAsset = (targetAssetId?: string, targetAssetNo?: string) => {
    if (targetAssetId && targetAssetId === asset.id) return true;
    if (
      targetAssetNo &&
      targetAssetNo.trim().toUpperCase() === (asset.assetNo || '').trim().toUpperCase()
    ) {
      return true;
    }
    return false;
  };

  let customerId = '';
  let customerName = '';
  let siteId = '';
  let siteName = '';
  let siteAddress = '';
  let outboundDate = '';
  let inboundDate = '';
  let billingDay: number | undefined;
  let contractId = '';
  let contractNo = '';
  let salespersonId = '';
  let salespersonName = '';
  let recentRepairId: string | undefined;
  let sourceLabel = '자산 기본 정보';

  // 후보 1: 입출고 로그(assetInOutLogs) 중 최근 INBOUND 기록
  const inboundLogs = assetInOutLogs
    .filter((log) => matchAsset(log.assetId, log.assetNo) && ((log as any).eventType === 'INBOUND' || (log as any).type === 'INBOUND'))
    .sort((a, b) => (b.eventDate || b.createdAt || '').localeCompare(a.eventDate || a.createdAt || ''));

  if (inboundLogs.length > 0) {
    const latestLog = inboundLogs[0] as any;
    customerId = latestLog.customerId || '';
    customerName = latestLog.customerName || '';
    siteId = latestLog.siteId || '';
    siteName = latestLog.siteName || '';
    inboundDate = (latestLog.eventDate || latestLog.createdAt || '').slice(0, 10);
    contractId = latestLog.contractId || '';
    sourceLabel = '최근 입고 이력';
  }

  // 후보 2: 입고/반납 배차(deliveries) 중 최근 기록 보완
  const inboundDeliveries = deliveries
    .filter(
      (d) => {
        const dAny = d as any;
        const matched =
          matchAsset(dAny.assetId, dAny.assetNo) ||
          (Array.isArray(d.assetIds) && !!asset.id && d.assetIds.includes(asset.id));
        return (
          matched &&
          (d.type === 'INBOUND' ||
            d.type === 'RETURN' ||
            dAny.dispatchCategory === '입고' ||
            dAny.dispatchCategory === '반납' ||
            dAny.dispatchCategory === '교환') &&
          d.status !== 'CANCELLED'
        );
      }
    )
    .sort((a, b) => {
      const aAny = a as any;
      const bAny = b as any;
      return (bAny.completedAt || bAny.date || b.expectedDate || b.createdAt || '').localeCompare(
        aAny.completedAt || aAny.date || a.expectedDate || a.createdAt || ''
      );
    });

  if (inboundDeliveries.length > 0) {
    const latestDel = inboundDeliveries[0] as any;
    const delDate = (latestDel.completedAt || latestDel.date || latestDel.expectedDate || latestDel.createdAt || '').slice(0, 10);
    if (!inboundDate || (delDate && delDate > inboundDate)) {
      inboundDate = delDate;
      sourceLabel = '최근 회수·입고 배차';
    }
    if (!customerId && latestDel.customerId) customerId = latestDel.customerId;
    if (!customerName && latestDel.customerName) customerName = latestDel.customerName;
    if (!siteId && latestDel.siteId) siteId = latestDel.siteId;
    if (!siteName && latestDel.siteName) siteName = latestDel.siteName;
    if (!siteAddress && latestDel.siteAddress) siteAddress = latestDel.siteAddress;
    if (!contractId && latestDel.contractId) contractId = latestDel.contractId;
  }

  // 후보 3: 입고 검수/정비(repairs) 최근 기록 보완
  const assetRepairs = repairs
    .filter((r) => matchAsset(r.assetId, r.assetNo))
    .sort((a, b) =>
      (b.requestDate || b.createdAt || '').localeCompare(a.requestDate || a.createdAt || '')
    );

  if (assetRepairs.length > 0) {
    const latestRep = assetRepairs[0];
    recentRepairId = latestRep.id;
    const repDate = (latestRep.requestDate || latestRep.createdAt || '').slice(0, 10);
    if (!inboundDate && repDate) {
      inboundDate = repDate;
      sourceLabel = '최근 입고 점검 기록';
    }
    if (!customerId && latestRep.customerId) customerId = latestRep.customerId;
    if (!customerName && latestRep.customerName) customerName = latestRep.customerName;
    if (!siteId && latestRep.siteId) siteId = latestRep.siteId;
    if (!siteName && latestRep.siteName) siteName = latestRep.siteName;
    if (!siteAddress && latestRep.siteAddress) siteAddress = latestRep.siteAddress;
    if (!contractId && latestRep.contractId) contractId = latestRep.contractId;
  }

  // 후보 4: 체결 자산(contractAssets) 중 최근 반납/체결 기록 보완
  const matchedContractAssets = contractAssets
    .filter((ca) => matchAsset(ca.assetId, (ca as any).assetNo))
    .sort((a, b) =>
      (b.actualReturnDate || b.endDate || b.startDate || '').localeCompare(
        a.actualReturnDate || a.endDate || a.startDate || ''
      )
    );

  if (matchedContractAssets.length > 0) {
    const latestCa = matchedContractAssets[0];
    if (!contractId && latestCa.contractId) {
      contractId = latestCa.contractId;
      if (sourceLabel === '자산 기본 정보') sourceLabel = '최근 계약 체결 자산';
    }
    if (latestCa.startDate) {
      outboundDate = latestCa.startDate.slice(0, 10);
    }
    const caReturnDate = (latestCa.actualReturnDate || latestCa.endDate || '').slice(0, 10);
    if (!inboundDate && caReturnDate) {
      inboundDate = caReturnDate;
    }
  }

  // 후보 5: 자산 자체의 현재/직전 계약 참조 보완
  if (!contractId && (asset as any).currentContractId) {
    contractId = (asset as any).currentContractId;
  }
  if (!customerId && (asset as any).currentCustomerId) {
    customerId = (asset as any).currentCustomerId;
  }
  if (!siteName && (asset as any).currentSiteName) {
    siteName = (asset as any).currentSiteName;
  }

  // 계약(Contract)에서 고객/현장/영업사원/마감일 상세 보완
  if (contractId) {
    const contract = contracts.find((c) => c.id === contractId);
    if (contract) {
      contractNo = contract.contractNo || contract.id;
      if (!customerId && contract.customerId) customerId = contract.customerId;
      if (!customerName && (contract as any).customerName) customerName = (contract as any).customerName;
      if (!siteId && contract.siteId) siteId = contract.siteId;
      if (!siteName && (contract as any).siteName) siteName = (contract as any).siteName;
      if (!siteAddress && (contract as any).siteAddress) siteAddress = (contract as any).siteAddress;
      if (!salespersonId && contract.salespersonId) salespersonId = contract.salespersonId;
      if (!outboundDate && contract.startDate) outboundDate = contract.startDate.slice(0, 10);
      if (contract.billingDay) billingDay = contract.billingDay;
    }
  }

  // 고객 마스터(Customer) 보완
  const customerObj =
    (customerId ? customers.find((c) => c.id === customerId) : undefined) ||
    (customerName ? customers.find((c) => c.name === customerName) : undefined);

  if (customerObj) {
    const custAny = customerObj as any;
    customerId = customerObj.id;
    customerName = customerObj.name;
    if (!salespersonId && custAny.assignedSalespersonId) {
      salespersonId = custAny.assignedSalespersonId;
    }
    if (!salespersonId && custAny.salespersonId) {
      salespersonId = custAny.salespersonId;
    }
    if (!billingDay && custAny.billingDay) {
      billingDay = custAny.billingDay;
    }
  }

  // 현장 마스터(CustomerSite) 보완
  const siteObj =
    (siteId ? sites.find((s) => s.id === siteId) : undefined) ||
    (siteName && customerId
      ? sites.find((s) => s.customerId === customerId && s.name === siteName)
      : undefined) ||
    (siteName ? sites.find((s) => s.name === siteName) : undefined);

  if (siteObj) {
    siteId = siteObj.id;
    siteName = siteObj.name;
    if (!siteAddress && siteObj.address) siteAddress = siteObj.address;
  }

  // 영업담당자 이름 보완
  if (salespersonId && users.length > 0) {
    const spUser = users.find((u) => u.id === salespersonId);
    if (spUser) salespersonName = spUser.name;
  }

  // 고객 담당자 성함 / 이메일 / 연락처 추출
  let customerContactName = '';
  let customerEmail = '';
  let customerPhone = '';
  if (siteObj) {
    const siteAny = siteObj as any;
    const primaryContact = Array.isArray(siteAny.contacts) && siteAny.contacts.length > 0 ? siteAny.contacts[0] : undefined;
    customerContactName =
      siteAny.contactName ||
      siteAny.managerName ||
      primaryContact?.name ||
      '';
    customerEmail =
      siteAny.billingContactEmail ||
      siteAny.safetyContactEmail ||
      (Array.isArray(siteAny.contacts) && siteAny.contacts.find((c: any) => c.email)?.email) ||
      '';
    customerPhone =
      siteAny.billingContactPhone ||
      siteAny.contactPhone ||
      siteAny.managerPhone ||
      (Array.isArray(siteAny.contacts) && siteAny.contacts.find((c: any) => c.phone)?.phone) ||
      '';
  }
  if (customerObj) {
    const custAny = customerObj as any;
    if (!customerContactName) {
      customerContactName =
        custAny.contactName ||
        (Array.isArray(custAny.contacts) && custAny.contacts[0]?.name) ||
        customerObj.representative ||
        '';
    }
    if (!customerEmail) {
      customerEmail =
        custAny.taxEmail ||
        custAny.taxInvoiceEmail ||
        custAny.email ||
        (Array.isArray(custAny.contacts) && custAny.contacts.find((c: any) => c.email)?.email) ||
        '';
    }
    if (!customerPhone) {
      customerPhone =
        custAny.phone ||
        custAny.contactPhone ||
        customerObj.repContact ||
        (Array.isArray(custAny.contacts) && custAny.contacts.find((c: any) => c.phone)?.phone) ||
        '';
    }
  }

  if (!inboundDate) {
    inboundDate = new Date().toISOString().slice(0, 10);
  }

  return {
    asset,
    assetId: asset.id,
    assetNo: asset.assetNo,
    modelName: asset.modelName || '',
    ownerType,
    vendorName,
    customerId,
    customerName: customerName || '미지정 고객',
    siteId,
    siteName: siteName || '미지정 현장',
    siteAddress,
    outboundDate,
    inboundDate,
    billingDay,
    contractId,
    contractNo,
    salespersonId,
    salespersonName,
    customerContactName,
    customerEmail,
    customerPhone,
    recentRepairId,
    sourceLabel,
  };
}

/**
 * 외상미수금(Receivable) 레코드와 연결된 정비(Repair)의 defectsJson 또는 로컬 캐시로부터
 * 입고 불량 청구 상세 메타데이터(InboundDefectClaimMeta)를 복원하고,
 * PC 모드에서 영업사원이 외상미수금 메뉴에서 처리할 때 필요한 계약/현장/고객연락처/임차처/검수자 정보를 보강한다.
 */
export function resolveReceivableClaimMeta(
  receivable: Receivable,
  context: {
    repairs: Repair[];
    assets?: Asset[];
    customers?: Customer[];
    sites?: CustomerSite[];
    contracts?: Contract[];
    contractAssets?: ContractAsset[];
    users?: User[];
    vendors?: Vendor[];
  }
): InboundDefectClaimMeta | null {
  if (!receivable) return null;

  const {
    repairs = [],
    assets = [],
    customers = [],
    sites = [],
    contracts = [],
    contractAssets = [],
    users = [],
    vendors = [],
  } = context;

  const linkedRepair = receivable.repairId
    ? repairs.find((r) => r.id === receivable.repairId)
    : undefined;

  let baseMeta: InboundDefectClaimMeta | null = null;

  // 1. 런타임 객체에 이미 claimMeta가 있는 경우
  if (receivable.claimMeta && receivable.claimMeta.kind === 'INBOUND_DEFECT_CLAIM_V1') {
    baseMeta = {
      ...receivable.claimMeta,
      receivableId: receivable.id,
      agreedAmount: receivable.totalAmount,
    };
  }

  // 2. 연결된 Repair의 defectsJson 파싱
  if (!baseMeta && linkedRepair?.defectsJson) {
    try {
      const parsed = JSON.parse(linkedRepair.defectsJson);
      if (parsed && parsed.kind === 'INBOUND_DEFECT_CLAIM_V1') {
        baseMeta = {
          ...parsed,
          receivableId: receivable.id,
          repairId: linkedRepair.id,
          agreedAmount: receivable.totalAmount,
        };
      } else if (Array.isArray(parsed) && parsed.length > 0) {
        const perItemCost =
          parsed.length > 0 ? Math.round((receivable.totalAmount || 0) / parsed.length) : 0;
        const defectItems: InboundClaimDefectItem[] = parsed.map((d: any, idx: number) => {
          const photos: string[] = Array.isArray(d.photos)
            ? d.photos.slice(0, 2)
            : d.photoUrl
              ? [d.photoUrl]
              : [];
          return {
            id: d.id || `DEF-${idx + 1}`,
            checkitemId: d.checkitemId || undefined,
            category: d.category || '입고불량',
            symptomName: d.symptomName || d.itemName || d.checkitemName || `불량 증상 ${idx + 1}`,
            estimatedCost: Number(d.estimatedCost ?? perItemCost) || 0,
            agreedCost: Number(d.agreedCost ?? d.estimatedCost ?? perItemCost) || 0,
            photos,
            memo: d.memo || d.comment || '',
          };
        });

        baseMeta = {
          kind: 'INBOUND_DEFECT_CLAIM_V1',
          receivableId: receivable.id,
          repairId: linkedRepair.id,
          assetId: linkedRepair.assetId,
          assetNo: receivable.assetNo || linkedRepair.assetNo || '',
          modelName: linkedRepair.modelName || '',
          customerId: receivable.customerId || linkedRepair.customerId,
          customerName: linkedRepair.customerName || '미지정 고객',
          siteId: linkedRepair.siteId,
          siteName: linkedRepair.siteName || '미지정 현장',
          contractId: receivable.contractId || linkedRepair.contractId,
          inboundDate: (linkedRepair.requestDate || receivable.occurredDate || '').slice(0, 10),
          registeredByName: linkedRepair.reporterName || '출고팀',
          registeredAt: receivable.createdAt || new Date().toISOString(),
          inspectorMemo: linkedRepair.memo || '',
          initialEstimatedAmount:
            defectItems.reduce((sum, item) => sum + (item.estimatedCost || 0), 0) ||
            receivable.totalAmount,
          agreedAmount: receivable.totalAmount,
          negotiationStatus: 'PENDING_NEGOTIATION',
          defectItems,
        };
      }
    } catch {
      // JSON 파싱 실패 시 폴백 진행
    }
  }

  // 3. 로컬 스토리지 캐시 조회
  if (!baseMeta) {
    const cached = getLocalClaimMetaCache(receivable.id);
    if (cached) {
      baseMeta = {
        ...cached,
        receivableId: receivable.id,
        agreedAmount: receivable.totalAmount,
      };
    }
  }

  // 4. 일반 REPAIR 외상미수금 레코드에 대한 기본 메타 생성
  if (!baseMeta && receivable.type === 'REPAIR') {
    const photos = (linkedRepair?.evidenceImages || []).slice(0, 2);
    baseMeta = {
      kind: 'INBOUND_DEFECT_CLAIM_V1',
      receivableId: receivable.id,
      repairId: linkedRepair?.id,
      assetId: linkedRepair?.assetId,
      assetNo: receivable.assetNo || linkedRepair?.assetNo || '',
      modelName: linkedRepair?.modelName || '',
      customerId: receivable.customerId || linkedRepair?.customerId,
      customerName: linkedRepair?.customerName || '미지정 고객',
      siteId: linkedRepair?.siteId,
      siteName: linkedRepair?.siteName || '미지정 현장',
      contractId: receivable.contractId || linkedRepair?.contractId,
      inboundDate: (linkedRepair?.requestDate || receivable.occurredDate || '').slice(0, 10),
      registeredByName: linkedRepair?.reporterName || '출고팀',
      registeredAt: receivable.createdAt || new Date().toISOString(),
      inspectorMemo: linkedRepair?.memo || '',
      initialEstimatedAmount: linkedRepair?.billableAmount || receivable.totalAmount,
      agreedAmount: receivable.totalAmount,
      negotiationStatus:
        receivable.status === 'CLEARED' || receivable.status === 'PARTIAL'
          ? 'AGREED'
          : 'PENDING_NEGOTIATION',
      defectItems: [
        {
          id: 'DEF-1',
          category: linkedRepair?.issueCategory || '수리/파손',
          symptomName:
            receivable.displayName ||
            receivable.internalDescription ||
            linkedRepair?.issueDescription ||
            '입고 파손 수리비',
          estimatedCost: linkedRepair?.billableAmount || receivable.totalAmount,
          agreedCost: receivable.totalAmount,
          photos,
          memo: linkedRepair?.memo || '',
        },
      ],
    };
  }

  if (!baseMeta) return null;

  // 5. PC 모드 영업사원 처리를 위한 컨텍스트 자동 보강 (계약/현장/고객연락처/임차처/담당자)
  const assetObj =
    (baseMeta.assetId ? assets.find((a) => a.id === baseMeta!.assetId) : undefined) ||
    (baseMeta.assetNo ? assets.find((a) => a.assetNo === baseMeta!.assetNo) : undefined);

  const contractObj =
    (baseMeta.contractId ? contracts.find((c) => c.id === baseMeta!.contractId) : undefined) ||
    (receivable.contractId ? contracts.find((c) => c.id === receivable.contractId) : undefined);

  const resolvedCustId = baseMeta.customerId || receivable.customerId || contractObj?.customerId;
  const customerObj = resolvedCustId
    ? customers.find((c) => c.id === resolvedCustId)
    : baseMeta.customerName
      ? customers.find((c) => c.name === baseMeta!.customerName)
      : undefined;

  const resolvedSiteId = baseMeta.siteId || contractObj?.siteId || linkedRepair?.siteId;
  const siteObj = resolvedSiteId
    ? sites.find((s) => s.id === resolvedSiteId)
    : baseMeta.siteName
      ? sites.find((s) => s.name === baseMeta!.siteName)
      : undefined;

  const isRented = Boolean(
    assetObj &&
      (assetObj.ownerType === 'RENTED' ||
        (assetObj as any).ownership === 'SUBLEASE' ||
        (assetObj as any).ownership === 'RENTED')
  );
  const resolvedOwnerType: 'OWN' | 'RENTED' =
    baseMeta.ownerType || (isRented ? 'RENTED' : 'OWN');

  let resolvedVendorName = baseMeta.vendorName || '';
  if (!resolvedVendorName && isRented && assetObj) {
    if (assetObj.vendorId) {
      const vnd = vendors.find((v) => v && v.id === assetObj.vendorId);
      if (vnd?.name?.trim()) resolvedVendorName = vnd.name.trim();
    }
    if (!resolvedVendorName && assetObj.renter?.trim()) resolvedVendorName = assetObj.renter.trim();
    if (!resolvedVendorName && assetObj.supplier?.trim()) resolvedVendorName = assetObj.supplier.trim();
    if (!resolvedVendorName) resolvedVendorName = '외부임차';
  }

  let resolvedOutboundDate = baseMeta.outboundDate || '';
  if (!resolvedOutboundDate) {
    const ca = contractAssets.find(
      (c) =>
        (contractObj && c.contractId === contractObj.id && assetObj && c.assetId === assetObj.id) ||
        (assetObj && c.assetId === assetObj.id)
    );
    resolvedOutboundDate = (ca?.startDate || contractObj?.startDate || '').slice(0, 10);
  }

  const siteAny = siteObj as any;
  const custAny = customerObj as any;

  const resolvedSalespersonId =
    baseMeta.salespersonId ||
    contractObj?.salespersonId ||
    custAny?.assignedSalespersonId ||
    custAny?.salespersonId ||
    '';
  let resolvedSalespersonName = baseMeta.salespersonName || '';
  if (!resolvedSalespersonName && resolvedSalespersonId && users.length > 0) {
    const sp = users.find((u) => u.id === resolvedSalespersonId);
    if (sp?.name) resolvedSalespersonName = sp.name;
  }

  const sitePrimaryContact =
    Array.isArray(siteAny?.contacts) && siteAny.contacts.length > 0 ? siteAny.contacts[0] : undefined;

  const resolvedContactName =
    baseMeta.customerContactName ||
    siteAny?.contactName ||
    siteAny?.managerName ||
    sitePrimaryContact?.name ||
    custAny?.contactName ||
    customerObj?.representative ||
    '';

  const resolvedPhone =
    baseMeta.customerPhone ||
    siteAny?.billingContactPhone ||
    siteAny?.contactPhone ||
    siteAny?.managerPhone ||
    sitePrimaryContact?.phone ||
    custAny?.phone ||
    customerObj?.repContact ||
    '';

  const resolvedEmail =
    baseMeta.customerEmail ||
    baseMeta.sentToEmail ||
    siteAny?.billingContactEmail ||
    siteAny?.safetyContactEmail ||
    sitePrimaryContact?.email ||
    custAny?.taxEmail ||
    custAny?.taxInvoiceEmail ||
    custAny?.email ||
    '';

  return {
    ...baseMeta,
    assetId: baseMeta.assetId || assetObj?.id,
    assetNo: baseMeta.assetNo || receivable.assetNo || assetObj?.assetNo || '',
    modelName: baseMeta.modelName || assetObj?.modelName || linkedRepair?.modelName || '',
    ownerType: resolvedOwnerType,
    vendorName: resolvedVendorName || undefined,
    customerId: resolvedCustId,
    customerName:
      (baseMeta.customerName && baseMeta.customerName !== '미지정 고객'
        ? baseMeta.customerName
        : customerObj?.name || (contractObj as any)?.customerName) || '미지정 고객',
    siteId: resolvedSiteId,
    siteName:
      (baseMeta.siteName && baseMeta.siteName !== '미지정 현장'
        ? baseMeta.siteName
        : siteObj?.name || (contractObj as any)?.siteName) || '미지정 현장',
    siteAddress: baseMeta.siteAddress || siteObj?.address || (contractObj as any)?.siteAddress || '',
    contractId: baseMeta.contractId || contractObj?.id,
    contractNo: baseMeta.contractNo || contractObj?.contractNo,
    outboundDate: resolvedOutboundDate || undefined,
    billingDay: baseMeta.billingDay || contractObj?.billingDay || custAny?.billingDay,
    salespersonId: resolvedSalespersonId || undefined,
    salespersonName: resolvedSalespersonName || undefined,
    customerContactName: resolvedContactName || undefined,
    customerPhone: resolvedPhone || undefined,
    customerEmail: resolvedEmail || undefined,
    inspectorMemo: baseMeta.inspectorMemo ?? baseMeta.negotiationMemo ?? linkedRepair?.memo ?? '',
    displayName: receivable.displayName || baseMeta.displayName || '',
  };
}

export function getNegotiationStatusBadgeInfo(
  status?: ClaimNegotiationStatus,
  agreedAmount?: number
): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (status) {
    case 'AGREED':
      if (agreedAmount !== undefined && agreedAmount <= 0) {
        return {
          label: '무상면제',
          bgClass: 'bg-slate-500/20',
          textClass: 'text-slate-300',
          borderClass: 'border-slate-500/40',
        };
      }
      return {
        label: '청구확정',
        bgClass: 'bg-emerald-500/15',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-500/40',
      };
    case 'SENT_TO_CUSTOMER':
      return {
        label: '협상중',
        bgClass: 'bg-sky-500/15',
        textClass: 'text-sky-400',
        borderClass: 'border-sky-500/40',
      };
    case 'PENDING_NEGOTIATION':
    default:
      return {
        label: '견적전달전',
        bgClass: 'bg-amber-500/15',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/40',
      };
  }
}
