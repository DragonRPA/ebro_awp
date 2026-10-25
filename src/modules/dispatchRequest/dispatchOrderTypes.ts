// src/modules/dispatchRequest/dispatchOrderTypes.ts
// 출고 요청(PC smart_dispatch4 & 모바일 MobileDispatchOrderCreate) 공통 타입 및 상수 모듈

export type CallContext = 'ADDITIONAL' | 'NEW_CUSTOMER' | 'EXCHANGE';
export type PaidBy = 'CUSTOMER' | 'OURS' | 'SPLIT';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'MISSING';

export interface ScoredField<T = string> {
  value: T;
  confidence: ConfidenceLevel;
  source: 'DB' | 'PARSED' | 'MANUAL';
  confirmed: boolean;
}

export interface EquipmentItem {
  modelName: string;
  qty: number;
  monthlyRate?: number;
  dailyRate?: number;
}

export interface DraftOrder {
  id: string;
  ownerId?: string;
  sourceCallIds?: string[];
  context: CallContext[];
  customerName: ScoredField;
  siteName: ScoredField;
  siteAddress?: string;
  equipments: EquipmentItem[];
  loadingDate: ScoredField;
  loadingTime: ScoredField;
  unloadingDate?: string;
  unloadingTimeType?: 'ASAP' | 'MORNING' | 'AFTERNOON' | 'EXACT' | null;
  unloadingTimeVal?: string;
  contactPerson: ScoredField;
  contactPhone: ScoredField | string;
  note: string;
  status: 'DRAFT' | 'SUBMITTED' | 'DISCARDED';
  isNewCustomer: boolean;
  customerRegistered: boolean;
  createdAt: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  retrievalAssetIds?: string[];
  paidBy?: PaidBy | null;
  safetyOptions?: string[];
  staggeredMemo?: string;
  vehicleType?: string;
  closingDay?: number;
  statementClosingDay?: number;
  paymentDueDay?: number;
  freightBillingStandard?: '3/5' | '2/4';
}

export interface OutboundHistoryEquipmentItem {
  contractAssetIds: string[];
  modelName: string;
  qty: number;
  monthlyRate: number;
  dailyRate: number;
  assignedAssets: string[];
  unassignedCount: number;
}

export interface OutboundHistoryPaidOptionItem {
  name: string;
  price: number;
  isCustomPrice: boolean;
  isCustomUnit: boolean;
  unitLabel: '월' | '대' | '건' | '수량';
  perUnitQty: number;
}

export interface OutboundHistoryRow {
  id: string;
  delivery: any;
  contractNo: string;
  contractId: string;
  createdAt: string;
  requesterName: string;
  reqTypeLabel: string;
  freightBillingStandard: '2/4' | '3/5';
  customerName: string;
  siteName: string;
  siteAddress: string;
  siteContactName: string;
  siteContactPhone: string;
  siteContactEmail: string;
  equipmentItems: OutboundHistoryEquipmentItem[];
  totalQty: number;
  totalAssignedCount: number;
  totalUnassignedCount: number;
  paidOptionItems: OutboundHistoryPaidOptionItem[];
  protectionStr: string;
  attachmentsStr: string;
  specsStr: string;
  checkedSpecsObj: Record<string, boolean>;
  loadingDateVal: string;
  loadingTimeSlotVal: string;
  unloadingDateVal: string;
  unloadingTimeSlotVal: string;
  loadingSchedule: string;
  unloadingSchedule: string;
  vehicleType: string;
  driverName: string;
  driverContact: string;
  vehicleNo: string;
  transportCompany: string;
  billableToCustomer: boolean;
  dispatchStatus: string;
  isLoadedWaitingUnload: boolean;
  approvedInspCount: number;
  isInspectionCompleted: boolean;
  canEditPreInspection: boolean;
  canCancelRequest: boolean;
  cancelBlockBadge: string;
  cancelBlockTooltip: string;
  cancelReason: string;
  cancelledAt: string;
  cancelledBy: string;
  userNote: string;
  staggeredText: string;
  closingMemo: string;
  rawMemo: string;
}

export const CONTEXT_OPTIONS: { id: CallContext; label: string }[] = [
  { id: 'ADDITIONAL', label: '기존현장 출고' },
  { id: 'NEW_CUSTOMER', label: '신규고객 출고' },
  { id: 'EXCHANGE', label: '교환' },
];

export const EXCHANGE_SYMPTOM_CHIPS: string[] = [
  '[고장증상: 상승불량]',
  '[고장증상: 주행불량]',
  '[고장증상: 배터리방전/충전불량]',
  '[고장증상: 유압누유]',
  '[고장증상: 조이스틱/컨트롤박스 불량]',
  '[요청사유: 작업높이/규격 변경]',
];

export function makeScoredField<T = string>(
  value: T,
  confidence: ConfidenceLevel = 'HIGH',
  source: 'DB' | 'PARSED' | 'MANUAL' = 'MANUAL',
  confirmed = true
): ScoredField<T> {
  return { value, confidence, source, confirmed };
}

export function getLocalTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function calcUrgency(dateStr: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (!dateStr) return 'LOW';
  const today = getLocalTodayDateStr();
  const tomorrowDate = new Date(Date.now() + 86400000);
  const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
  if (dateStr <= today) return 'HIGH';
  if (dateStr <= tomorrow) return 'MEDIUM';
  return 'LOW';
}
