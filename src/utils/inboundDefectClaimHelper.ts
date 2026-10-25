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
} from '../services/db';

const LOCAL_CLAIM_META_STORAGE_KEY = 'ebro_inbound_defect_claim_meta_v1';

export interface RecentInboundLookupResult {
  asset: Asset;
  assetId: string;
  assetNo: string;
  modelName: string;
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  inboundDate: string;
  contractId: string;
  contractNo: string;
  salespersonId: string;
  salespersonName: string;
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
 * 역추적하여 고객명, 현장명, 입고일자, 계약/영업담당자 정보를 자동 완성한다.
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
  } = context;

  // 1. 정확히 일치하는 자산번호 또는 ID 우선 검색, 없으면 부분 일치 검색
  const asset =
    assets.find(
      (a) =>
        (a.assetNo || '').trim().toUpperCase() === normalizedQuery ||
        (a.id || '').trim().toUpperCase() === normalizedQuery
    ) ||
    assets.find((a) => (a.assetNo || '').trim().toUpperCase().includes(normalizedQuery));

  if (!asset) return null;

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
  let inboundDate = '';
  let contractId = '';
  let contractNo = '';
  let salespersonId = '';
  let salespersonName = '';
  let recentRepairId: string | undefined;
  let sourceLabel = '자산 기본 정보';

  // 후보 1: 입출고 로그(assetInOutLogs) 중 최근 INBOUND 기록
  const inboundLogs = assetInOutLogs
    .filter((log) => matchAsset(log.assetId, log.assetNo) && log.eventType === 'INBOUND')
    .sort((a, b) => (b.eventDate || b.createdAt || '').localeCompare(a.eventDate || a.createdAt || ''));

  if (inboundLogs.length > 0) {
    const latestLog = inboundLogs[0];
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
      (d) =>
        matchAsset(d.assetId, d.assetNo) &&
        (d.type === 'INBOUND' ||
          d.type === 'RETURN' ||
          d.dispatchCategory === '입고' ||
          d.dispatchCategory === '반납' ||
          d.dispatchCategory === '교환') &&
        d.status !== 'CANCELLED'
    )
    .sort((a, b) =>
      (b.completedAt || b.date || b.createdAt || '').localeCompare(
        a.completedAt || a.date || a.createdAt || ''
      )
    );

  if (inboundDeliveries.length > 0) {
    const latestDel = inboundDeliveries[0];
    const delDate = (latestDel.completedAt || latestDel.date || latestDel.createdAt || '').slice(0, 10);
    if (!inboundDate || (delDate && delDate > inboundDate)) {
      inboundDate = delDate;
      sourceLabel = '최근 입고·회수 배차';
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
    .filter((ca) => matchAsset(ca.assetId, ca.assetNo))
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
    const caReturnDate = (latestCa.actualReturnDate || latestCa.endDate || '').slice(0, 10);
    if (!inboundDate && caReturnDate) {
      inboundDate = caReturnDate;
    }
  }

  // 후보 5: 자산 자체의 현재/직전 계약 참조 보완
  if (!contractId && asset.currentContractId) {
    contractId = asset.currentContractId;
  }
  if (!customerId && asset.currentCustomerId) {
    customerId = asset.currentCustomerId;
  }
  if (!siteName && asset.currentSiteName) {
    siteName = asset.currentSiteName;
  }

  // 계약(Contract)에서 고객/현장/영업사원 상세 보완
  if (contractId) {
    const contract = contracts.find((c) => c.id === contractId);
    if (contract) {
      contractNo = contract.contractNo || contract.id;
      if (!customerId && contract.customerId) customerId = contract.customerId;
      if (!customerName && contract.customerName) customerName = contract.customerName;
      if (!siteId && contract.siteId) siteId = contract.siteId;
      if (!siteName && contract.siteName) siteName = contract.siteName;
      if (!siteAddress && contract.siteAddress) siteAddress = contract.siteAddress;
      if (!salespersonId && contract.salespersonId) salespersonId = contract.salespersonId;
    }
  }

  // 고객 마스터(Customer) 보완
  const customerObj =
    (customerId ? customers.find((c) => c.id === customerId) : undefined) ||
    (customerName ? customers.find((c) => c.name === customerName) : undefined);

  if (customerObj) {
    customerId = customerObj.id;
    customerName = customerObj.name;
    if (!salespersonId && customerObj.assignedSalespersonId) {
      salespersonId = customerObj.assignedSalespersonId;
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

  // 고객 이메일/연락처 추출
  let customerEmail = '';
  let customerPhone = '';
  if (siteObj) {
    customerEmail =
      siteObj.billingContactEmail ||
      siteObj.safetyContactEmail ||
      (siteObj.contacts && siteObj.contacts.find((c) => c.email)?.email) ||
      '';
    customerPhone =
      siteObj.billingContactPhone ||
      siteObj.contactPhone ||
      (siteObj.contacts && siteObj.contacts.find((c) => c.phone)?.phone) ||
      '';
  }
  if (!customerEmail && customerObj) {
    customerEmail =
      customerObj.taxEmail ||
      customerObj.email ||
      (customerObj.contacts && customerObj.contacts.find((c) => c.email)?.email) ||
      '';
  }
  if (!customerPhone && customerObj) {
    customerPhone =
      customerObj.phone ||
      customerObj.contactPhone ||
      (customerObj.contacts && customerObj.contacts.find((c) => c.phone)?.phone) ||
      '';
  }

  if (!inboundDate) {
    inboundDate = new Date().toISOString().slice(0, 10);
  }

  return {
    asset,
    assetId: asset.id,
    assetNo: asset.assetNo,
    modelName: asset.modelName || '',
    customerId,
    customerName: customerName || '미지정 고객',
    siteId,
    siteName: siteName || '미지정 현장',
    siteAddress,
    inboundDate,
    contractId,
    contractNo,
    salespersonId,
    salespersonName,
    customerEmail,
    customerPhone,
    recentRepairId,
    sourceLabel,
  };
}

/**
 * 외상미수금(Receivable) 레코드와 연결된 정비(Repair)의 defectsJson 또는 로컬 캐시로부터
 * 입고 불량 청구 상세 메타데이터(InboundDefectClaimMeta)를 복원한다.
 */
export function resolveReceivableClaimMeta(
  receivable: Receivable,
  context: {
    repairs: Repair[];
    assets?: Asset[];
    customers?: Customer[];
    sites?: CustomerSite[];
    contracts?: Contract[];
  }
): InboundDefectClaimMeta | null {
  if (!receivable) return null;

  // 1. 런타임 객체에 이미 claimMeta가 있는 경우
  if (receivable.claimMeta && receivable.claimMeta.kind === 'INBOUND_DEFECT_CLAIM_V1') {
    return {
      ...receivable.claimMeta,
      receivableId: receivable.id,
      agreedAmount: receivable.totalAmount,
    };
  }

  const { repairs = [], assets = [], customers = [], sites = [], contracts = [] } = context;
  const linkedRepair = receivable.repairId
    ? repairs.find((r) => r.id === receivable.repairId)
    : undefined;

  // 2. 연결된 Repair의 defectsJson 파싱
  if (linkedRepair?.defectsJson) {
    try {
      const parsed = JSON.parse(linkedRepair.defectsJson);
      if (parsed && parsed.kind === 'INBOUND_DEFECT_CLAIM_V1') {
        const meta: InboundDefectClaimMeta = {
          ...parsed,
          receivableId: receivable.id,
          repairId: linkedRepair.id,
          agreedAmount: receivable.totalAmount,
        };
        return meta;
      }
      // 입고등록(MobileInboundRegister)에서 배열 형태로 저장한 defectsJson 호환 변환
      if (Array.isArray(parsed) && parsed.length > 0) {
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
            symptomName: d.symptomName || d.itemName || `불량 증상 ${idx + 1}`,
            estimatedCost: Number(d.estimatedCost ?? perItemCost) || 0,
            agreedCost: Number(d.agreedCost ?? d.estimatedCost ?? perItemCost) || 0,
            photos,
            memo: d.memo || d.comment || '',
          };
        });
        const customerObj = receivable.customerId
          ? customers.find((c) => c.id === receivable.customerId)
          : undefined;
        const contractObj = receivable.contractId
          ? contracts.find((c) => c.id === receivable.contractId)
          : undefined;
        const siteObj =
          linkedRepair.siteId
            ? sites.find((s) => s.id === linkedRepair.siteId)
            : contractObj?.siteId
              ? sites.find((s) => s.id === contractObj.siteId)
              : undefined;

        return {
          kind: 'INBOUND_DEFECT_CLAIM_V1',
          receivableId: receivable.id,
          repairId: linkedRepair.id,
          assetId: linkedRepair.assetId,
          assetNo: receivable.assetNo || linkedRepair.assetNo || '',
          modelName: linkedRepair.modelName || '',
          customerId: receivable.customerId || linkedRepair.customerId,
          customerName:
            linkedRepair.customerName ||
            customerObj?.name ||
            contractObj?.customerName ||
            '미지정 고객',
          siteId: linkedRepair.siteId || contractObj?.siteId,
          siteName:
            linkedRepair.siteName || siteObj?.name || contractObj?.siteName || '미지정 현장',
          contractId: receivable.contractId || linkedRepair.contractId,
          contractNo: contractObj?.contractNo,
          inboundDate: (linkedRepair.requestDate || receivable.occurredDate || '').slice(0, 10),
          salespersonId: contractObj?.salespersonId || customerObj?.assignedSalespersonId,
          registeredAt: receivable.createdAt || new Date().toISOString(),
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
  const cached = getLocalClaimMetaCache(receivable.id);
  if (cached) {
    return {
      ...cached,
      receivableId: receivable.id,
      agreedAmount: receivable.totalAmount,
    };
  }

  // 4. 일반 REPAIR 외상미수금 레코드에 대한 기본 메타 생성 (연결된 Repair가 있거나 REPAIR 타입인 경우)
  if (receivable.type === 'REPAIR') {
    const customerObj = receivable.customerId
      ? customers.find((c) => c.id === receivable.customerId)
      : undefined;
    const contractObj = receivable.contractId
      ? contracts.find((c) => c.id === receivable.contractId)
      : undefined;
    const assetObj = receivable.assetNo
      ? assets.find((a) => a.assetNo === receivable.assetNo)
      : linkedRepair?.assetId
        ? assets.find((a) => a.id === linkedRepair.assetId)
        : undefined;
    const photos = (linkedRepair?.evidenceImages || []).slice(0, 2);

    return {
      kind: 'INBOUND_DEFECT_CLAIM_V1',
      receivableId: receivable.id,
      repairId: linkedRepair?.id,
      assetId: assetObj?.id || linkedRepair?.assetId,
      assetNo: receivable.assetNo || linkedRepair?.assetNo || assetObj?.assetNo || '',
      modelName: linkedRepair?.modelName || assetObj?.modelName || '',
      customerId: receivable.customerId || linkedRepair?.customerId,
      customerName:
        linkedRepair?.customerName ||
        customerObj?.name ||
        contractObj?.customerName ||
        '미지정 고객',
      siteId: linkedRepair?.siteId || contractObj?.siteId,
      siteName: linkedRepair?.siteName || contractObj?.siteName || '미지정 현장',
      contractId: receivable.contractId || linkedRepair?.contractId,
      contractNo: contractObj?.contractNo,
      inboundDate: (linkedRepair?.requestDate || receivable.occurredDate || '').slice(0, 10),
      salespersonId: contractObj?.salespersonId || customerObj?.assignedSalespersonId,
      registeredAt: receivable.createdAt || new Date().toISOString(),
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

  return null;
}

export function getNegotiationStatusBadgeInfo(status?: ClaimNegotiationStatus): {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (status) {
    case 'AGREED':
      return {
        label: '합의완료',
        bgClass: 'bg-emerald-500/15',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-500/40',
      };
    case 'SENT_TO_CUSTOMER':
      return {
        label: '고객전달',
        bgClass: 'bg-sky-500/15',
        textClass: 'text-sky-400',
        borderClass: 'border-sky-500/40',
      };
    case 'PENDING_NEGOTIATION':
    default:
      return {
        label: '협상대기',
        bgClass: 'bg-amber-500/15',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/40',
      };
  }
}
