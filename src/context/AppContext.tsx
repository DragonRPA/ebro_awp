import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db, supabase, isSystemDeveloperUser, PAYMENT_REVERSAL_ENABLED, isActivePayment, isActiveDepositLink, Tenant, TenantWorkplace, TenantYard, TenantBusinessType, TenantBankAccount, OFFICIAL_STAMP_BASE64, User, Department, MenuPermission, createMenuPermission, CustomRole, RolePermission, Customer, CustomerContact, CustomerSite, SiteMaster, Product, Asset, Consumable, ConsumableLog, ConsumableLot, ConsumablePurchaseRequest, MechanicConsumableStock, Contract, ContractAsset, ContractHistory, Delivery, Billing, BillingType, BillingDetail, CustomStatementItem, Receivable, InboundClaimDefectItem, ClaimNegotiationStatus, InboundDefectClaimMeta, Payment, PaymentDepositLink, Repair, RepairConsumable, Todo, BankTransaction, BankMatchingRule, BankAccountInitialBalance, AssetInOutLog, OfficialMailConfig, Vendor, CashFlowSnapshot, OutboundInspection, TransportCompany, TransportDriver, TransportNegotiation, SubleaseNegotiation, DepreciationLog, PurchaseSettlement, PurchaseSettlementItem, SettlementPaymentLog, ExternalLease, PurchaseSettlementType, PurchaseSettlementStatus, findCustomerByNormalizedName, AnnualLeaveQuota, LeaveUsage, OvertimeRecord, PayrollClosing, InspectionChecklistItem, EquipmentManual, StandardOption, InboundDefectDetail, PrepaidTransaction, DelinquencyActionLog, LegalNoticeLog, LegalNoticeTemplate, calculateAssetDepreciation, FieldAsTicket, FieldAsPartUsed, FieldAsCollectedPart, CorporateVehicle, VehicleOperationLog, VehicleFuelLog, RepairPartUsed, RepairCollectedPart, SaleContractTerms, StocktakingAudit, StocktakingAuditItem, CollectedPart, PrintStation, PrintQueueItem, logPrivacyAccess, ErrorReport, ErrorReportAttachment, ErrorReportStatus, ErrorReportSeverity, ErrorReportCategory, ApprovalRule, RuleConsensus, ApprovalPayload, MonthlyIncomeStatement, SalesJournal, AsRouteEventType, AsPartsSourcingType, AsRouteLog } from '../services/db';
import { recordAsRouteStep } from '../services/asRouteTrackingService';
import { resolveReceivableClaimMeta, saveLocalClaimMetaCache, lookupRecentInboundInfoByAsset } from '../utils/inboundDefectClaimHelper';
import { useApproval } from '../hooks/useApproval';
import { enqueuePrintJob as serviceEnqueuePrintJob, registerPrintStation as serviceRegisterPrintStation, deletePrintStation as serviceDeletePrintStation, retryPrintJob as serviceRetryPrintJob, cancelPrintJob as serviceCancelPrintJob } from '../services/printQueueService';
import { ErrorModal } from '../components/ErrorModal';
import { PrintSuccessModal } from '../components/PrintSuccessModal';
import { getAllSystemMenuIds, normalizeMenuId } from '../config/menu_config';
import { getRoleTemplatePermission } from '../config/role_templates';
import { broadcastWorkNotification } from '../utils/workNotificationService';
import { issueHandoverTask, clearHandoverTasks, findActiveTasksForUser, checkAndIssuePackageResendTask, reconcileCompletedTodosInDb } from '../utils/taskHandoverPipeline';
import { resolveSiteDetailedAddress } from '../utils/nativeLauncher';
import { emailService } from '../services/email';
import { sortCustomersByName } from '../utils/hangulSearch';
import { getDomainMode } from '../utils/domainRouter';
import { fetchCentralTenants, saveCentralTenant, deleteCentralTenant, fetchCentralEquipmentManuals } from '../services/centralDb';
import { hashPassword, verifyPassword, encryptSecret, decryptSecret, signSessionUser, verifySessionUser, parseSessionUser, safeJsonParse, maskSalaryForRole } from '../utils/cryptoVault';
import { isCurrentDeviceAuthorizedForDeveloper } from '../utils/hardwareVault';
import { calculatePaidOptionBillingItems, mergeOptionPricesIntoSpecs } from '../types/siteOption';
import { isDemoMode, DEMO_DEFAULT_ADMIN_USER } from '../services/demoMode';
import { syncTenantPolicyToAgent } from '../services/agentService';

export interface AssetSaleItem {
  assetId: string;
  salePrice: number;
}

export interface AssetSalePayload {
  customerId?: string;
  buyerName: string;
  buyerBizRegNo?: string;
  buyerRepresentative?: string;
  buyerAddress?: string;
  buyerContact?: string;
  salespersonId?: string;
  disposalDate: string;
  items: AssetSaleItem[];
  saleTerms?: SaleContractTerms;
  memo?: string;
  recipientEmail?: string;
  ccEmail?: string;
  sendEmail?: boolean;
}

export interface SmartDispatchData {
  customerName: string;
  siteName: string;
  siteAddress: string;
  salespersonId?: string;
  salespersonName?: string;
  salespersonPhone?: string;
  siteContactName: string;
  siteContactPhone: string;
  siteContactPosition?: string;
  siteContactEmail: string;
  billingContactName: string;
  billingContactPhone: string;
  statementEmail: string;
  taxBillEmail: string;
  loadingTime: string;
  unloadingTime: string;
  equipments: { modelName: string; qty: number; monthlyRate?: number; dailyRate?: number; monthlyRentalFee?: number; dailyRentalFee?: number }[];
  paidOptions?: string;
  paidOptionPrices?: Record<string, number>; // 🌟 출고 요청 시 1회성 변경 유상옵션 단가 (현장 기본 단가는 마스터 기본 단가 유지)
  paidOptionUnits?: Record<string, '월' | '대' | '건' | '수량'>; // 🌟 출고 요청 시 1회성 변경 유상옵션 청구조건
  paidOptionQtys?: Record<string, number>; // 🌟 출고 요청 시 유상옵션 수량 (1대당 수량 또는 직접 수량)
  protection?: string;
  attachments?: string;
  checkedSpecs?: Record<string, any>;
  saveOptionsToSite?: boolean; // 🌟 옵션 변경 시 현장 마스터 저장 여부 (false: 이번 출고만 1회성 적용, true: 현장 마스터 갱신)
  isSetAsCustomerDefault?: boolean;
  applyToAllSites?: boolean;
  closingDay?: string;
  paymentDay?: string;
  siteMasterId?: string; // 🌟 물리 현장 ID (헌장 1.5 Strict N:M)
  note: string;
  rawText?: string;
}

export interface SmartReturnData {
  contractId?: string;
  returnDate: string;
  assetIds: string[];
  loadingTime?: string;
  unloadingTime?: string;
  note?: string;
  // 정비회수 추가 필드
  repairId?: string;
  vendorId?: string;
  // 고객측 회수 담당 정보
  contactName?: string;
  contactPhone?: string;
}

interface AppContextType {
  updatePurchaseUnitPrice: (id: string, newUnitPrice: number) => Promise<void>;
  receivables: any[];
  refreshReceivables: () => void;
  currentUser: User | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (
    loginId: string, 
    passwordHash: string, 
    keepLoggedIn?: boolean,
    bypassDeviceCheck?: boolean
  ) => Promise<{ 
    success: boolean; 
    reason?: string; 
    error?: string;
    requireDeviceVerification?: boolean;
    detectedFingerprint?: string;
    detectedMacs?: string[];
  }>;
  logout: (reason?: any) => void;
  switchUser: (userId: string) => void;
  hasPermission: (menuId: string, action: 'view' | 'save') => boolean;
  showErrorModal: (message: string, title?: string, type?: 'system' | 'business') => void;
  showNoticeModal: (messageOrObj: string | { title?: string; message: string }, title?: string) => void;
  showPrintSuccessModal: (params: {
    docType?: string;
    docTitle: string;
    docNo?: string;
    stationName: string;
    printerName?: string;
    detailMessage?: string;
  }) => void;
  
  // Data States
  tenants: Tenant[];
  currentTenant: Tenant;
  setCurrentTenantId: (tenantId: string) => void;
  saveTenant: (tenant: Partial<Tenant> & { id?: string }) => Promise<Tenant>;
  deleteTenant: (tenantId: string) => Promise<boolean>;
  addTenantWorkplace: (tenantId: string, workplace: Omit<TenantWorkplace, 'id'>) => Promise<Tenant>;
  updateTenantWorkplace: (tenantId: string, workplaceId: string, workplace: Partial<TenantWorkplace>) => Promise<Tenant>;
  deleteTenantWorkplace: (tenantId: string, workplaceId: string) => Promise<Tenant>;
  addTenantYard: (tenantId: string, yard: Omit<TenantYard, 'id'>) => Promise<Tenant>;
  updateTenantYard: (tenantId: string, yardId: string, yard: Partial<TenantYard>) => Promise<Tenant>;
  deleteTenantYard: (tenantId: string, yardId: string) => Promise<Tenant>;
  setDefaultYard: (tenantId: string, yardId: string) => Promise<Tenant>;
  users: User[];
  departments: Department[];
  permissions: MenuPermission[];
  customers: Customer[];
  contacts: CustomerContact[];
  sites: CustomerSite[];
  siteMasters: SiteMaster[];
  saveSiteMaster: (s: Partial<SiteMaster>, options?: { propagateToLinkedSites?: boolean }) => Promise<SiteMaster>;
  deleteSiteMaster: (id: string) => Promise<void>;
  products: Product[];
  assets: Asset[];
  consumables: Consumable[];
  consumableLots: ConsumableLot[];
  consumableLogs: ConsumableLog[];
  consumablePurchases: ConsumablePurchaseRequest[];
  contracts: Contract[];
  contractAssets: ContractAsset[];
  contractHistory: ContractHistory[];
  deliveries: Delivery[];
  transportCompanies: TransportCompany[];
  transportDrivers: TransportDriver[];
  transportNegotiations: TransportNegotiation[];
  subleaseNegotiations: SubleaseNegotiation[];
  billings: Billing[];
  billingDetails: BillingDetail[];
  payments: Payment[];
  paymentDepositLinks: PaymentDepositLink[];
  repairs: Repair[];
  repairConsumables: RepairConsumable[];
  todos: Todo[];
  bankTransactions: BankTransaction[];
  bankMatchingRules: BankMatchingRule[];
  bankInitialBalances: BankAccountInitialBalance[];
  saveBankInitialBalance: (bankName: string, initialBalance: number, accountNumber?: string) => Promise<void>;
  assetInOutLogs: AssetInOutLog[];
  vendors: Vendor[];
  officialMailConfigs: OfficialMailConfig[];
  cashFlowSnapshots: CashFlowSnapshot[];
  outboundInspections: OutboundInspection[];
  depreciationLogs: DepreciationLog[];
  purchaseSettlements: PurchaseSettlement[];
  purchaseSettlementItems: PurchaseSettlementItem[];
  settlementPaymentLogs: SettlementPaymentLog[];
  externalLeases: ExternalLease[];
  inspectionChecklistItems: InspectionChecklistItem[];
  equipmentManuals: EquipmentManual[];
  standardOptions: StandardOption[];
  customRoles: CustomRole[];
  rolePermissions: RolePermission[];
  saveCustomRole: (role: CustomRole) => Promise<void>;
  deleteCustomRole: (roleId: string) => Promise<void>;
  saveRolePermissions: (roleId: string, perms: { menuId: string; canView: boolean; canSave: boolean }[]) => Promise<void>;
  assignUserRole: (userId: string, customRoleId: string | null) => Promise<void>;

  annualLeaveQuotas: AnnualLeaveQuota[];
  leaveUsages: LeaveUsage[];
  overtimeRecords: OvertimeRecord[];
  payrollClosings: PayrollClosing[];

  corporateVehicles: CorporateVehicle[];
  vehicleOperationLogs: VehicleOperationLog[];
  vehicleFuelLogs: VehicleFuelLog[];

  // Mutators
  updateAnnualLeaveQuota: (userId: string, periodStart: string, periodEnd: string, grantedDays: number, memo?: string) => Promise<void>;
  addLeaveUsage: (usage: Omit<LeaveUsage, 'id' | 'createdAt'>) => Promise<void>;
  deleteLeaveUsage: (id: string) => Promise<void>;
  addOvertimeRecord: (record: Omit<OvertimeRecord, 'id' | 'createdAt'>) => Promise<void>;
  deleteOvertimeRecord: (id: string) => Promise<void>;
  setPayrollClosingStatus: (month: string, status: 'DRAFT' | 'APPROVED', approvedBy?: string) => Promise<void>;
  refreshAllData: () => void;
  fullRefreshFromServer: () => Promise<void>;
  executeMonthlyDepreciation: (depreciationYm: string, note?: string) => Promise<{ count: number; totalAmount: number }>;
  loadTablesForMenu: (menuId: string) => Promise<void>;
  updatePermissions: (updated: MenuPermission[]) => void;
  saveUser: (user: Omit<User, 'id' | 'createdAt'> & { id?: string }) => void;
  saveCustomer: (cust: Omit<Customer, 'id' | 'createdAt'> & { id?: string }) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<boolean>;
  saveContact: (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }) => Promise<CustomerContact>;
  deleteContact: (id: string) => Promise<void>;
  saveSite: (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => Promise<CustomerSite>;
  deleteSite: (id: string) => Promise<boolean>;
  saveProduct: (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => void;
  saveAsset: (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  updateOfficialMailConfig: (config: OfficialMailConfig) => Promise<void>;
  saveCashFlowSnapshot: (snap: Omit<CashFlowSnapshot, 'id' | 'createdAt'>) => void;
  deleteCashFlowSnapshot: (snapId: string) => void;
  saveVendor: (vendor: Vendor) => Promise<Vendor>;
  deleteVendor: (id: string) => void;
  recalculateAllVendorMetrics: () => Promise<{ updatedCount: number; totalAmount: number }>;
  saveInspectionChecklistItem: (item: Omit<InspectionChecklistItem, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  deleteInspectionChecklistItem: (id: string) => Promise<void>;
  saveEquipmentManual: (item: Omit<EquipmentManual, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  deleteEquipmentManual: (id: string) => Promise<void>;
  saveStandardOption: (option: Omit<StandardOption, 'id' | 'createdAt'> & { id?: string }) => Promise<StandardOption>;
  deleteStandardOption: (id: string) => Promise<void>;
  monthlyIncomeStatements: MonthlyIncomeStatement[];
  saveMonthlyIncomeStatement: (stmt: MonthlyIncomeStatement) => Promise<MonthlyIncomeStatement>;
  salesJournals: SalesJournal[];
  saveSalesJournal: (journal: Omit<SalesJournal, 'id' | 'createdAt'> & { id?: string }) => Promise<SalesJournal>;
  deleteSalesJournal: (id: string) => Promise<void>;
  
  // Asset Mutators
  changeAssetStatus: (assetId: string, status: Asset['status'], extraData?: Partial<Asset>) => Promise<void>;
  acquireAsset: (assetData: Partial<Asset>) => Promise<Asset>;
  batchAcquireAssets: (assetsData: Partial<Asset>[]) => Promise<Asset[]>;
  disposeAsset: (assetId: string, disposalData: { disposalDate: string; disposalPrice: number; buyer: string; billingYm?: string }) => Promise<any>;
  executeAssetSale: (payload: AssetSalePayload) => Promise<{ success: boolean; contractId: string; billingId: string; contractNo: string }>;
  registerRentedAsset: (assetData: Partial<Asset>) => Promise<any>;
  returnRentedAsset: (assetId: string, returnDate: string, options?: { isDirectReturn?: boolean; memo?: string }) => Promise<void>;
  createVendorClaimReceivable: (data: {
    contractId?: string;
    customerId?: string;
    vendorName: string;
    assetNo: string;
    totalAmount: number;
    internalDescription: string;
    displayName?: string;
    occurredDate?: string;
  }) => Promise<void>;
  registerInboundAsset: (data: {
    assetId: string;
    returnDate: string;
    maintenanceScore?: number;
    memo?: string;
    inboundNo?: string;
    defects?: InboundDefectDetail[];
    photos?: string[];
    otherDefectText?: string;
    targetAssetStatus?: Asset['status'];
  }) => Promise<void>;
  cancelInboundAsset: (logId: string, cancelReason?: string) => Promise<void>;
  
  // Consumables Mutators
  addConsumable: (data: Omit<Consumable, 'id' | 'createdAt' | 'updatedAt' | 'stockQty'> & { stockQty?: number }) => Promise<void>;
  updateConsumable: (id: string, updates: Partial<Consumable>) => Promise<void>;
  deleteConsumable: (id: string) => Promise<void>;
  purchaseConsumable: (data: { modelName: string; qty: number; unit: string; unitPrice: number; supplier: string }) => Promise<void>;
  useConsumable: (data: { consumableId: string; quantity: number; targetAssetId: string; description: string }) => Promise<void>;
  requestConsumablePurchase: (data: { consumableId?: string; modelName: string; qty: number; unitPrice: number; requestDate: string; sellerName: string; purchaseUrl?: string; requestAttachmentUrl?: string; vendorId?: string; paymentMethod?: 'CARD' | 'CREDIT'; }) => Promise<void>;
  acceptConsumablePurchase: (id: string) => Promise<void>;
  completeConsumablePurchase: (id: string) => Promise<void>;
  inboundConsumablePurchase: (id: string, qty: number, statementFileUrl: string) => Promise<void>;
  clearEvidenceFileUrls: (ids: string[]) => Promise<void>;  // Storage 삭제 후 DB URL 초기화
  updateEvidenceFileUrls: (updates: { id: string; url: string }[]) => Promise<void>; // Storage 삭제 후 Drive URL로 교체
  
  // AS 기사 차량별 이동재고
  mechanicConsumableStocks: MechanicConsumableStock[];
  transferConsumableToMechanic: (mechanicId: string, consumableId: string, quantity: number, memo?: string) => Promise<void>;
  returnConsumableToHq: (mechanicId: string, consumableId: string, quantity: number, memo?: string, isDefective?: boolean, disposition?: 'REBUILD' | 'SCRAP' | 'VENDOR_WARRANTY') => Promise<void>;
  transferConsumableBetweenMechanics: (fromMechanicId: string, toMechanicId: string, consumableId: string, quantity: number, memo?: string) => Promise<void>;

  // 재고실사 & 고품 관리
  stocktakingAudits: StocktakingAudit[];
  stocktakingAuditItems: StocktakingAuditItem[];
  collectedParts: CollectedPart[];
  createStocktakingAudit: (targetType: 'HQ' | 'VEHICLE', mechanicId?: string, memo?: string) => Promise<StocktakingAudit>;
  updateStocktakingItem: (auditId: string, itemId: string, actualQty: number, diffReason?: StocktakingAuditItem['diffReason'], note?: string) => Promise<void>;
  confirmStocktakingAudit: (auditId: string) => Promise<void>;
  cancelStocktakingAudit: (auditId: string) => Promise<void>;
  processCollectedPart: (partId: string, actionStatus: 'IN_PROCESS' | 'COMPLETED', actionMemo?: string) => Promise<void>;

  // 현장 AS 관리
  fieldAsTickets: FieldAsTicket[];
  createFieldAsTicket: (data: Partial<FieldAsTicket>) => Promise<FieldAsTicket>;
  updateFieldAsTicketStatus: (ticketId: string, status: FieldAsTicket['status'], extra?: Partial<FieldAsTicket>) => Promise<void>;
  completeFieldAsTicket: (ticketId: string, completionData: {
    mechanicId: string;
    actionTaken: string;
    resolutionType: FieldAsTicket['resolutionType'];
    partsUsed?: FieldAsPartUsed[];
    collectedParts?: FieldAsCollectedPart[];
    billableType: 'FREE' | 'BILLABLE';
    billableAmount: number;
    beforeImage?: string;
    afterImage?: string;
    customerSignature?: string;
    customerConfirmName?: string;
    revisitDate?: string;
    revisitReason?: string;
    exchangeSuggested?: boolean;
    inspectionItemId?: string;
    inspectionItemCode?: string;
    degradationScore?: number;
    durationMinutes?: number;
    spentManHours?: number;
    assetId?: string;
    assetNo?: string;
    modelName?: string;
    visitDate?: string;
  }) => Promise<void>;
  createRevisitAsTicket: (parentTicketId: string, revisitDate: string, revisitReason: string, mechanicId?: string) => Promise<FieldAsTicket>;
  importBandAsHistory: (records: any[]) => Promise<number>;
  logFieldAsTimelineEvent: (ticketId: string, eventType: 'CALL_MADE' | 'TRANSIT_START' | 'ARRIVED' | 'COMPLETED', detail?: string) => Promise<void>;
  recordAsRouteEvent: (params: {
    eventType: AsRouteEventType;
    ticketId?: string;
    nextTicketId?: string;
    nextSiteCustomName?: string;
    sourcingType?: AsPartsSourcingType;
    sourcingTargetName?: string;
    partName?: string;
    revisitDate?: string;
    memo?: string;
    mechanicId?: string;
    mechanicName?: string;
  }) => Promise<AsRouteLog>;
  
  // Contract Mutators
  createContract: (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => Promise<Contract>;
  rescindContract: (params: { contractId: string; reason: string; freightOption: 'NONE' | 'CUSTOMER' | 'OURS'; customerFreightAmount?: number }) => Promise<void>;
  extendContract: (contractId: string, newEndDate: string, description: string) => Promise<void> | void;
  shortenContract: (contractId: string, newEndDate: string, description: string) => Promise<void> | void;
  succeedContract: (contractId: string, successorCustomerId: string, successorContactId: string, successorSiteId: string, successionDate: string, description: string, selectedAssetIds?: string[]) => Promise<void> | void;
  exchangeAsset: (contractId: string, oldAssetId: string, newAssetId: string, exchangeDate: string) => Promise<void> | void;
  updateContractAssetPeriod: (caId: string, startDate: string, endDate: string, reason: string) => Promise<void>;
  relocateContractAsset: (params: {
    contractAssetId: string;
    targetSiteId: string;
    relocationDate: string;
    needTransport?: boolean;
    transportCost?: number;
    paidBy?: 'OURS' | 'CUSTOMER' | 'VENDOR';
    reason?: string;
  }) => Promise<void>;
  redeployRepairedAsset: (params: {
    contractId: string;
    assetId: string;
    redeployDate: string;
    expectedEndDate?: string;
    monthlyRentalFee?: number;
    dailyRentalFee?: number;
    needTransport?: boolean;
    transportCost?: number;
    paidBy?: 'OURS' | 'CUSTOMER' | 'VENDOR';
    reason?: string;
  }) => Promise<void>;
  
  // 장비 할당 및 출고전 교체 / 할당 취소 / 출고요청 취소
  assignAssetToContract: (contractAssetId: string, assetId: string) => Promise<void>;
  batchAssignAssetsToContract: (pairs: { contractAssetId: string; assetId: string }[]) => Promise<void>;
  unassignAssetFromContract: (contractAssetId: string) => Promise<void>;
  batchUnassignAssetsFromContract: (contractAssetIds: string[]) => Promise<void>;
  exchangeOutboundAsset: (contractAssetId: string, oldAssetId: string, newAssetId: string, reason?: string, markOldAsRepairing?: boolean, customPenaltyScore?: number) => Promise<void>;
  saveSmartDispatch: (data: SmartDispatchData, autoRegister: boolean, onProgress?: (log: string, percent: number) => void) => Promise<{ success: boolean; requiresConfirm?: boolean; missingFields?: string[]; errorMessage?: string; contractId?: string; contractNo?: string }>;
  cancelOutboundRequest: (deliveryId: string, cancelReason?: string) => Promise<{ success: boolean; errorMessage?: string }>;
  deleteCancelledOutboundRequests: (deliveryIds?: string[]) => Promise<{ success: boolean; deletedCount: number; errorMessage?: string }>;
  updateOutboundRequestPricing: (params: {
    deliveryId: string;
    allowCompletedModify?: boolean;
    equipments?: { contractAssetIds?: string[]; modelName: string; qty: number; monthlyRate: number; dailyRate: number }[];
    equipmentRates?: { modelName: string; monthlyRate: number; dailyRate: number }[];
    paidOptions?: string;
    protection?: string;
    attachments?: string;
    checkedSpecs?: Record<string, any>;
    paidOptionPrices?: Record<string, number>;
    paidOptionUnits?: Record<string, '월' | '대' | '건' | '수량'>;
    paidOptionQtys?: Record<string, number>;
    loadingDate?: string;
    loadingTimeSlot?: string;
    unloadingDate?: string;
    unloadingTimeSlot?: string;
    reason?: string;
  }) => Promise<{ success: boolean; errorMessage?: string }>;
  saveSmartReturn: (data: SmartReturnData) => Promise<any>;
  
  // Todos & Executive Directives
  completeTodo: (todoId: string) => void;
  issueExecutiveDirective: (params: {
    targetType: 'USER' | 'DEPT';
    targetUserId?: string;
    targetDept?: string;
    title: string;
    content: string;
    priority?: 'URGENT' | 'HIGH' | 'NORMAL';
    dueDate?: string;
    actionUrl?: string;
  }) => Promise<Todo>;
  resolveExecutiveDirective: (todoId: string, resolutionNote: string) => Promise<void>;
  cancelExecutiveDirective: (todoId: string) => Promise<void>;
  
  // Billings
  generateBillingsForMonth: (billingYm: string, billingDate: string) => Promise<void>;
  getDueContractsForBilling: (targetDate?: string) => { contract: Contract; customer: Customer; site?: CustomerSite; billingDay: number; dueReason: string; targetYm?: string }[];
  generateDueBillings: (targetDate?: string, targetYm?: string) => Promise<{ successCount: number; skippedContracts: { contractId: string; customerId: string; reason: string }[] }>;
  syncContractBillingMilestones: (contractId?: string) => void;
  generateBillingForSingleContract: (contractId: string, billingYm: string, billingDate: string, selectedContractAssetIds?: string[]) => Promise<string | null>;
  regenerateBilling: (billingId: string, customDetails?: Omit<BillingDetail, 'id' | 'billingId' | 'createdAt'>[], options?: { billingYm?: string; billingDate?: string; memo?: string }) => Promise<string>;
  saveCustomStatementForBilling: (billingId: string, data: { reason: string; items: CustomStatementItem[]; originalSummary?: string; approvalStatus?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'; approvalRequestId?: string }) => Promise<void>;
  removeCustomStatementForBilling: (billingId: string) => Promise<void>;
  toggleTenantCustomBillingStatement: (tenantId: string, enabled: boolean) => Promise<void>;
  toggleTenantContractTradeOutbound: (tenantId: string, enabled: boolean) => Promise<void>;
  splitBillingAbsoluteAmount: (billingId: string, splitAmount: number) => Promise<string>;
  approveBilling: (billingId: string) => Promise<void>; // UNPAID → REQUESTED (거래명세서 발송)
  cancelBilling: (billingId: string, refund?: boolean) => Promise<void>; // 환불=true, 비환불=false(기본)
  addReceivable: (data: Omit<Receivable, 'id' | 'createdAt' | 'updatedAt'>) => string;
  registerInboundDefectClaimReceivable: (payload: {
    existingReceivableId?: string;
    assetId?: string;
    assetNo: string;
    modelName?: string;
    ownerType?: 'OWN' | 'RENTED';
    vendorName?: string;
    customerId?: string;
    customerName: string;
    siteId?: string;
    siteName: string;
    siteAddress?: string;
    contractId?: string;
    contractNo?: string;
    outboundDate?: string;
    inboundDate: string;
    billingDay?: number;
    salespersonId?: string;
    salespersonName?: string;
    customerContactName?: string;
    customerPhone?: string;
    customerEmail?: string;
    inspectorMemo?: string;
    defectItems: InboundClaimDefectItem[];
    negotiationMemo?: string;
  }) => Promise<string>;
  updateReceivableClaimNegotiation: (payload: {
    receivableId: string;
    agreedAmount: number;
    negotiationStatus: ClaimNegotiationStatus;
    defectItems?: InboundClaimDefectItem[];
    negotiationMemo?: string;
    displayName?: string;
    sentChannel?: 'EMAIL' | 'KAKAO_SHARE' | 'PDF_DOWNLOAD';
    sentToEmail?: string;
  }) => Promise<void>;
  generateStandaloneBillingForReceivable: (receivableId: string, reason: string) => Promise<string>;
  linkReceivableToBilling: (billingId: string, receivableId: string, amount: number, displayName?: string) => Promise<void>;
  receivePayment: (billingId: string, data: {
    paymentDate: string;
    amount: number;
    method: string;
    memo: string;
    depositLinks?: { bankTransactionId: string; usedAmount: number }[]; // 통장입금 연동 (N건)
  }) => Promise<void> | void;
  cancelPayment: (paymentId: string) => Promise<void>;  // 수납 취소 + PDL 연쇄 삭제 + Billing 롤백 + 선수금 환원
  cancelAllPaymentsForBilling: (billingId: string) => Promise<void>; // 청구서 전체 수납 일괄 취소 및 롤백
  saveBankDeposit: (data: Omit<BankTransaction, 'id' | 'createdAt' | 'withdrawAmount'>) => void;  // 통장입금 등록/수정
  deleteBankDeposit: (txId: string) => void;  // 통장입금 삭제 (연결 수납 없을 때만)
  uploadBankTransactions: (txs: Omit<BankTransaction, 'id' | 'createdAt'>[]) => void;
  matchTransactionManual: (
    txId: string,
    billingId: string,
    learnRule: boolean,
    options?: {
      matchingMode?: 'PINPOINT' | 'CASCADE' | 'MULTI';
      allocations?: { billingId: string; amount: number; feeAdjustment?: number }[];
      feeAdjustment?: number;
    }
  ) => Promise<void> | void;
  batchAutoMatchTransactions: () => Promise<number>;
  unmatchTransaction: (txId: string) => Promise<void> | void;
  saveMatchingRule: (senderName: string, customerId: string) => void;
  deleteMatchingRule: (ruleId: string) => void;
  
  // Deliveries
  dispatchDelivery: (deliveryId: string, dispatchData: { scheduledDate: string; transportCompany: string; vehicleType: string; vehicleNo: string; driverName: string; driverContact: string; deliveryCost: number; vehiclesJson?: string }) => void;
  settleDeliveryCost: (deliveryId: string, deliveryCostConfirmed: number, vehiclesJson?: string) => void;
  completeDelivery: (deliveryId: string) => Promise<void>;
  completeInboundDelivery: (deliveryId: string, actualReturnDate: string, reviews: { assetId: string; status: 'AVAILABLE' | 'REPAIRING'; maintenanceScore: number; memo: string; faultImageUrl?: string }[]) => void;
  
  // Repairs
  registerRepair: (repairData: Partial<Repair>, usedConsumables: { consumableId: string; quantity: number }[]) => void;
  updateRepairStatus: (repairId: string, status: Repair['status'], unresolvedReason?: string, nextAction?: Repair['nextAction'], targetAssetStatus?: Asset['status']) => Promise<void>;
  
  // Transport Master
  saveTransportDataOnFly: (companyName: string, driverName: string, contact: string, vehicleNo: string, vehicleType: string) => void;

  // Purchase Settlement Mutators
  generateMonthlyPurchaseSettlements: (ym: string) => Promise<{ transport: number; consumable: number; lease: number; repair: number }>;
  confirmPurchaseSettlement: (id: string) => Promise<void>;
  recordPurchaseSettlementPayment: (id: string, data: { paidAmount: number; paymentDate: string; paymentMethod: string; bankAccount?: string; bankTransactionId?: string; memo?: string }) => Promise<void>;
  savePurchaseSettlement: (settlement: Partial<PurchaseSettlement>) => Promise<void>;
  convertReconciledDeliveriesToSettlement: (settlementYm: string, transportCompanyId?: string) => Promise<number>;

  // Depreciation Execution Mutators
  cancelMonthlyDepreciation: (depreciationYm: string) => Promise<void>;

  // Repair to Billing Linkage & Waiver
  linkRepairToBilling: (repairId: string, billingId: string) => Promise<void>;
  unlinkRepairFromBilling: (repairId: string) => Promise<void>;
  waiveRepairBilling: (repairId: string, waivedAmount: number, waivedReason: string, waivedBy: string) => Promise<void>;
  cancelRepairWaiver: (repairId: string) => Promise<void>;

  // Delivery to Billing Linkage & Waiver
  linkDeliveryToBilling: (deliveryId: string, billingId: string) => Promise<void>;
  unlinkDeliveryFromBilling: (deliveryId: string) => Promise<void>;
  waiveDeliveryBilling: (deliveryId: string, waivedAmount: number, waivedReason: string, waivedBy: string) => Promise<void>;
  cancelDeliveryWaiver: (deliveryId: string) => Promise<void>;

  // Prepaid Balance Management
  prepaidTransactions: PrepaidTransaction[];
  chargePrepaidBalance: (customerId: string, amount: number, memo?: string) => Promise<void>;
  applyPrepaidBalanceForBilling: (billingId: string, amount: number, memo?: string) => Promise<void>;
  refundPrepaidBalance: (customerId: string, amount: number, memo?: string) => Promise<void>;

  // Delinquency Management
  delinquencyActionLogs: DelinquencyActionLog[];
  legalNoticeLogs: LegalNoticeLog[];
  legalNoticeTemplates: LegalNoticeTemplate[];
  saveLegalNoticeLog: (log: Omit<LegalNoticeLog, 'id' | 'createdAt'>) => Promise<LegalNoticeLog>;
  saveLegalNoticeTemplate: (tpl: Omit<LegalNoticeTemplate, 'id' | 'updatedAt'> & { id?: string }) => Promise<void>;

  saveDelinquencyAction: (action: Omit<DelinquencyActionLog, 'id' | 'createdAt'>) => Promise<void>;
  updateDelinquencyActionPromise: (actionId: string, status: 'PENDING' | 'KEPT' | 'BROKEN') => Promise<void>;

  // Corporate Fleet & Vehicle Operation/Fuel Logs
  registerCorporateVehicle: (vehicle: Omit<CorporateVehicle, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CorporateVehicle>;
  updateCorporateVehicle: (id: string, updates: Partial<CorporateVehicle>) => Promise<void>;
  deleteCorporateVehicle: (id: string) => Promise<void>;
  registerVehicleOperationLog: (log: Omit<VehicleOperationLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<VehicleOperationLog>;
  updateVehicleOperationLog: (id: string, updates: Partial<VehicleOperationLog>) => Promise<void>;
  deleteVehicleOperationLog: (id: string) => Promise<void>;
  registerVehicleFuelLog: (fuelLog: Omit<VehicleFuelLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<VehicleFuelLog>;
  deleteVehicleFuelLog: (id: string) => Promise<void>;

  // Distributed Print Queue & Stations
  printStations: PrintStation[];
  printQueue: PrintQueueItem[];
  enqueuePrintJob: (params: {
    stationId?: string;
    docType: 'DISPATCH_ORDER' | 'RETURN_ORDER';
    docNo?: string;
    title: string;
    documentHtml: string;
    requestedById?: string;
    requestedByName?: string;
  }) => Promise<PrintQueueItem>;
  registerPrintStation: (station: {
    id?: string;
    stationName: string;
    localPrinterName: string;
    machineName?: string;
    docTypeDefault?: 'DISPATCH_ORDER' | 'RETURN_ORDER' | 'ALL';
    description?: string;
  }) => Promise<PrintStation>;
  deletePrintStation: (id: string) => Promise<void>;
  retryPrintJob: (id: string) => Promise<void>;
  cancelPrintJob: (id: string) => Promise<void>;

  // Error Reports (오류 신고 관리: 등록-접수-완료 3단계 라이프사이클 & 파일첨부)
  errorReports: ErrorReport[];
  addErrorReport: (report: Omit<ErrorReport, 'id' | 'createdAt' | 'updatedAt' | 'reportNo'> & { id?: string; reportNo?: string }) => Promise<ErrorReport>;
  receiveErrorReport: (id: string, payload: { assigneeId: string; assigneeName: string; receptionNote?: string; targetCompletionDate?: string }) => Promise<void>;
  completeErrorReport: (id: string, payload: { resolutionNote: string; resolvedVersion?: string; rootCause?: string }) => Promise<void>;
  cancelErrorReport: (id: string, reason: string) => Promise<void>;
  reopenErrorReport: (id: string) => Promise<void>;
  deleteErrorReport: (id: string) => Promise<void>;

  // Navigation states (cross-page routing & in-app history)
  activeTab: string;
  setActiveTab: (tab: string, payload?: any) => void;
  navigationPayload: any;
  setNavigationPayload: (payload: any) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  historyStack: Array<{ tab: string; payload?: any }>;
  historyIndex: number;

  // 🛡️ 전자결재 파이프라인
  fetchRuleForEvent: (eventCode: string) => Promise<{ rule: ApprovalRule | null; consensus: RuleConsensus[] }>;
  createApprovalRequest: (
    ruleId: string,
    originatorId: string,
    targetRecordId: string,
    targetTable: string,
    escalatedTier?: number,
    payload?: ApprovalPayload
  ) => Promise<{ req: any; steps: any[] }>;
  processApprovalStep: (
    stepId: string,
    action: 'APPROVED' | 'REJECTED',
    comment?: string
  ) => Promise<boolean>;
  db: typeof db;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log("[DEBUG] AppProvider Render!");
  const { fetchRuleForEvent, createApprovalRequest, processApprovalStep } = useApproval();
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined' && isDemoMode()) {
      try {
        if (sessionStorage.getItem('demo_explicit_logout') !== 'true') {
          const saved = sessionStorage.getItem('user');
          if (saved) {
            const parsed = parseSessionUser<User>(saved);
            if (parsed) return parsed;
          }
          sessionStorage.setItem('user', signSessionUser(DEMO_DEFAULT_ADMIN_USER as User));
          return DEMO_DEFAULT_ADMIN_USER as User;
        }
      } catch {}
    }
    return null;
  });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // React state of database tables
  const [tenants, setTenants] = useState<Tenant[]>(() => db.tenants || []);
  const [currentTenantId, setCurrentTenantIdState] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('erp_current_tenant_id') : null) || db.currentTenant?.id || 'tenant-giyeonlift';
  });

  const currentTenant = isDemoMode()
    ? ((tenants && tenants.length > 0 ? tenants.find(t => t.id === 'giyeun' || (t.subdomain || '').toLowerCase() === 'awp-demo' || (t.tenantCode || '').toLowerCase() === 'ebro_awp' || (t.displayName || '').toLowerCase().includes('e-bro')) : null) || db.currentTenant)
    : ((tenants && tenants.length > 0 ? (tenants.find(t => t.id === currentTenantId || t.tenantCode === currentTenantId) || tenants.find(t => t.isDefault) || tenants[0]) : null) || db.currentTenant);

  const setCurrentTenantId = (id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_current_tenant_id', id);
    }
    setCurrentTenantIdState(id);
  };

  const saveTenant = async (tenant: Partial<Tenant> & { id?: string }): Promise<Tenant> => {
    let saved: Tenant;
    const existingInDb = tenant.id ? (db.tenants || []).find(t => t && t.id === tenant.id) : undefined;
    const existingInState = tenant.id ? (tenants || []).find(t => t && t.id === tenant.id) : undefined;
    if (tenant.id && existingInDb) {
      saved = db.updateRow<Tenant>('tenants', tenant.id, tenant as any) as Tenant;
    } else if (tenant.id && existingInState) {
      db.tenants = [...(db.tenants || []), existingInState];
      saved = db.updateRow<Tenant>('tenants', tenant.id, tenant as any) as Tenant;
    } else {
      saved = db.insertRow<Tenant>('tenants', tenant as any) as Tenant;
    }
    await db.awaitPendingWrites();
    setTenants([...db.tenants]);
    
    // 🌐 [중앙 플랫폼 SSOT & 운영 DB 이중 동기화] ebro-platform-core 프로젝트 및 운영 DB에 실시간 복제 완결 대기 (헌장 5.2)
    if (saved && saved.id) {
      try {
        await saveCentralTenant(saved);
      } catch (err: any) {
        console.error('[Central DB Sync Error]:', err);
      }
      if (supabase) {
        try {
          const opPayload = db.sanitizeSupabasePayload(saved, 'tenants');
          await supabase.from('tenants').upsert([opPayload], { onConflict: 'id' });
        } catch (opErr: any) {
          console.warn('[Operational DB Tenant Sync Warning]:', opErr);
        }
      }
    }

    return saved;
  };

  const deleteTenant = async (tenantId: string): Promise<boolean> => {
    const list = db.tenants;
    if (list.length <= 1) {
      throw new Error('최소 1개의 기본 테넌트가 유지되어야 합니다.');
    }
    const target = list.find(t => t.id === tenantId);
    if (target?.isDefault) {
      throw new Error('기본 테넌트는 삭제할 수 없습니다. 다른 테넌트를 기본으로 지정한 후 삭제하십시오.');
    }
    db.deleteRow('tenants', tenantId);
    await db.awaitPendingWrites();

    // 🌐 [중앙 플랫폼 SSOT 동기화] ebro-platform-core 중앙 DB 삭제 완결 대기
    try {
      await deleteCentralTenant(tenantId);
    } catch (err: any) {
      console.error('[Central DB Delete Error]:', err);
    }

    setTenants([...db.tenants]);
    if (currentTenantId === tenantId) {
      const remaining = db.tenants.find(t => t.isDefault) || db.tenants[0];
      if (remaining) setCurrentTenantId(remaining.id);
    }
    return true;
  };

  const addTenantWorkplace = async (tenantId: string, workplaceData: Omit<TenantWorkplace, 'id'>): Promise<Tenant> => {
    const targetTenant = tenants.find(t => t.id === tenantId) || currentTenant;
    const newId = `wp-${Date.now()}`;
    const newWorkplace: TenantWorkplace = {
      ...workplaceData,
      id: newId,
      createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    const updatedWorkplaces = [...(targetTenant.workplaces || []), newWorkplace];
    return saveTenant({ id: targetTenant.id, workplaces: updatedWorkplaces });
  };

  const updateTenantWorkplace = async (tenantId: string, workplaceId: string, updates: Partial<TenantWorkplace>): Promise<Tenant> => {
    const targetTenant = tenants.find(t => t.id === tenantId) || currentTenant;
    const updatedWorkplaces = (targetTenant.workplaces || []).map(wp => 
      wp.id === workplaceId ? { ...wp, ...updates, updatedAt: new Date().toISOString() } : wp
    );
    return saveTenant({ id: targetTenant.id, workplaces: updatedWorkplaces });
  };

  const deleteTenantWorkplace = async (tenantId: string, workplaceId: string): Promise<Tenant> => {
    const targetTenant = tenants.find(t => t.id === tenantId) || currentTenant;
    const updatedWorkplaces = (targetTenant.workplaces || []).filter(wp => wp.id !== workplaceId);
    return saveTenant({ id: targetTenant.id, workplaces: updatedWorkplaces });
  };

  const addTenantYard = async (tenantId: string, yardData: Omit<TenantYard, 'id'>): Promise<Tenant> => {
    const targetTenant = tenants.find(t => t.id === tenantId) || currentTenant;
    const newId = `yard-${Date.now()}`;
    const newYard: TenantYard = {
      ...yardData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    let updatedYards = [...(targetTenant.yards || [])];
    if (newYard.isDefault) {
      updatedYards = updatedYards.map(y => ({ ...y, isDefault: false }));
    }
    updatedYards.push(newYard);
    return saveTenant({ 
      id: targetTenant.id, 
      yards: updatedYards,
      mainYardAddress: newYard.isDefault ? newYard.name : targetTenant.mainYardAddress 
    });
  };

  const updateTenantYard = async (tenantId: string, yardId: string, updates: Partial<TenantYard>): Promise<Tenant> => {
    const targetTenant = tenants.find(t => t.id === tenantId) || currentTenant;
    let updatedYards = (targetTenant.yards || []).map(y => {
      if (y.id === yardId) {
        return { ...y, ...updates, updatedAt: new Date().toISOString() };
      }
      if (updates.isDefault) {
        return { ...y, isDefault: false };
      }
      return y;
    });
    const defaultYard = updatedYards.find(y => y.isDefault);
    return saveTenant({ 
      id: targetTenant.id, 
      yards: updatedYards,
      mainYardAddress: defaultYard ? defaultYard.name : targetTenant.mainYardAddress 
    });
  };

  const deleteTenantYard = async (tenantId: string, yardId: string): Promise<Tenant> => {
    const targetTenant = tenants.find(t => t.id === tenantId) || currentTenant;
    const updatedYards = (targetTenant.yards || []).filter(y => y.id !== yardId);
    return saveTenant({ id: targetTenant.id, yards: updatedYards });
  };

  const setDefaultYard = async (tenantId: string, yardId: string): Promise<Tenant> => {
    return updateTenantYard(tenantId, yardId, { isDefault: true });
  };

  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>(() => db.departments || []);
  const [permissions, setPermissions] = useState<MenuPermission[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [siteMasters, setSiteMasters] = useState<SiteMaster[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [consumableLogs, setConsumableLogs] = useState<ConsumableLog[]>([]);
  const [consumablePurchases, setConsumablePurchases] = useState<ConsumablePurchaseRequest[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractAssets, setContractAssets] = useState<ContractAsset[]>([]);
  const [contractHistory, setContractHistory] = useState<ContractHistory[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [transportCompanies, setTransportCompanies] = useState<TransportCompany[]>([]);
  const [transportDrivers, setTransportDrivers] = useState<TransportDriver[]>([]);
  const [transportNegotiations, setTransportNegotiations] = useState<TransportNegotiation[]>([]);
  const [subleaseNegotiations, setSubleaseNegotiations] = useState<SubleaseNegotiation[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [billingDetails, setBillingDetails] = useState<BillingDetail[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentDepositLinks, setPaymentDepositLinks] = useState<PaymentDepositLink[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [repairConsumables, setRepairConsumables] = useState<RepairConsumable[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [bankMatchingRules, setBankMatchingRules] = useState<BankMatchingRule[]>([]);
  const [bankInitialBalances, setBankInitialBalances] = useState<BankAccountInitialBalance[]>([]);
  const [assetInOutLogs, setAssetInOutLogs] = useState<AssetInOutLog[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [officialMailConfigs, setOfficialMailConfigs] = useState<OfficialMailConfig[]>([]);
  const [cashFlowSnapshots, setCashFlowSnapshots] = useState<CashFlowSnapshot[]>([]);
  const [outboundInspections, setOutboundInspections] = useState<OutboundInspection[]>([]);
  const [depreciationLogs, setDepreciationLogs] = useState<DepreciationLog[]>([]);
  const [purchaseSettlements, setPurchaseSettlements] = useState<PurchaseSettlement[]>([]);
  const [purchaseSettlementItems, setPurchaseSettlementItems] = useState<PurchaseSettlementItem[]>([]);
  const [externalLeases, setExternalLeases] = useState<ExternalLease[]>([]);
  const [inspectionChecklistItems, setInspectionChecklistItems] = useState<InspectionChecklistItem[]>([]);
  const [equipmentManuals, setEquipmentManuals] = useState<EquipmentManual[]>([]);
  const [standardOptions, setStandardOptions] = useState<StandardOption[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [annualLeaveQuotas, setAnnualLeaveQuotas] = useState<AnnualLeaveQuota[]>([]);
  const [leaveUsages, setLeaveUsages] = useState<LeaveUsage[]>([]);
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([]);
  const [payrollClosings, setPayrollClosings] = useState<PayrollClosing[]>([]);
  const [prepaidTransactions, setPrepaidTransactions] = useState<PrepaidTransaction[]>([]);
  const [delinquencyActionLogs, setDelinquencyActionLogs] = useState<DelinquencyActionLog[]>([]);
  const [legalNoticeLogs, setLegalNoticeLogs] = useState<LegalNoticeLog[]>([]);
  const [legalNoticeTemplates, setLegalNoticeTemplates] = useState<LegalNoticeTemplate[]>([]);
  const [corporateVehicles, setCorporateVehicles] = useState<CorporateVehicle[]>([]);
  const [vehicleOperationLogs, setVehicleOperationLogs] = useState<VehicleOperationLog[]>([]);
  const [vehicleFuelLogs, setVehicleFuelLogs] = useState<VehicleFuelLog[]>([]);
  const [stocktakingAudits, setStocktakingAudits] = useState<StocktakingAudit[]>([]);
  const [stocktakingAuditItems, setStocktakingAuditItems] = useState<StocktakingAuditItem[]>([]);
  const [collectedParts, setCollectedParts] = useState<CollectedPart[]>([]);
  const [mechanicConsumableStocks, setMechanicConsumableStocks] = useState<MechanicConsumableStock[]>([]);
  const [printStations, setPrintStations] = useState<PrintStation[]>([]);
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [errorReports, setErrorReports] = useState<ErrorReport[]>(() => db.errorReports || []);
  const [monthlyIncomeStatements, setMonthlyIncomeStatements] = useState<MonthlyIncomeStatement[]>(() => db.monthlyIncomeStatements || []);
  const [salesJournals, setSalesJournals] = useState<SalesJournal[]>(() => db.salesJournals || []);


  // Navigation / Routing states with In-App History (최대 30단계 뒤로/앞으로가기)
  const initialNavTab = (typeof window !== 'undefined' && getDomainMode() === 'ADMIN') ? 'tenant_management' : 'dashboard';
  const [activeTab, setActiveTabState] = useState<string>(initialNavTab);
  const [navigationPayload, setNavigationPayload] = useState<any>(null);

  const MAX_HISTORY = 30;
  const [historyStack, setHistoryStack] = useState<Array<{ tab: string; payload?: any }>>([
    { tab: initialNavTab, payload: null }
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const isNavigatingHistoryRef = useRef(false);

  const setActiveTab = useCallback((tab: string, payload?: any) => {
    setActiveTabState(prevTab => {
      if (prevTab === tab && payload === undefined) return prevTab;

      if (!isNavigatingHistoryRef.current) {
        setHistoryStack(prevStack => {
          const newStack = prevStack.slice(0, historyIndex + 1);
          newStack.push({ tab, payload: payload ?? null });
          if (newStack.length > MAX_HISTORY) {
            newStack.shift();
          }
          return newStack;
        });
        setHistoryIndex(prevIdx => Math.min(prevIdx + 1, MAX_HISTORY - 1));

        if (typeof window !== 'undefined' && window.history) {
          window.history.pushState({ tab, payload, ebroNav: true }, '', '');
        }
      }
      return tab;
    });

    if (payload !== undefined) {
      setNavigationPayload(payload);
    }
  }, [historyIndex]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      const target = historyStack[prevIdx];
      if (target) {
        isNavigatingHistoryRef.current = true;
        setHistoryIndex(prevIdx);
        setActiveTabState(target.tab);
        setNavigationPayload(target.payload ?? null);
        if (typeof window !== 'undefined' && window.history) {
          window.history.pushState({ tab: target.tab, payload: target.payload, ebroNav: true }, '', '');
        }
        setTimeout(() => {
          isNavigatingHistoryRef.current = false;
        }, 50);
      }
    }
  }, [historyIndex, historyStack]);

  const goForward = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      const target = historyStack[nextIdx];
      if (target) {
        isNavigatingHistoryRef.current = true;
        setHistoryIndex(nextIdx);
        setActiveTabState(target.tab);
        setNavigationPayload(target.payload ?? null);
        if (typeof window !== 'undefined' && window.history) {
          window.history.pushState({ tab: target.tab, payload: target.payload, ebroNav: true }, '', '');
        }
        setTimeout(() => {
          isNavigatingHistoryRef.current = false;
        }, 50);
      }
    }
  }, [historyIndex, historyStack]);

  // 브라우저 popstate 이벤트 리스너 (브라우저 뒤로가기 / 마우스 뒤로가기 버튼)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.ebroNav && e.state.tab) {
        isNavigatingHistoryRef.current = true;
        setActiveTabState(e.state.tab);
        if (e.state.payload !== undefined) {
          setNavigationPayload(e.state.payload);
        }
        setTimeout(() => {
          isNavigatingHistoryRef.current = false;
        }, 50);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Alt + ArrowLeft / Alt + ArrowRight 전역 단축키 리스너
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack, goForward]);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyStack.length - 1;

  // 글로벌 커스텀 에러 및 업무 진행 안내 모달 상태
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'system' | 'business';
  }>({
    isOpen: false,
    title: undefined,
    message: '',
    type: undefined
  });

  const showErrorModal = (message: string, title?: string, type?: 'system' | 'business') => {
    setErrorModal({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const showNoticeModal = (messageOrObj: string | { title?: string; message: string }, title: string = '업무 처리 안내') => {
    const resolvedMessage = typeof messageOrObj === 'string' ? messageOrObj : (messageOrObj?.message || '');
    const resolvedTitle = typeof messageOrObj === 'string' ? title : (messageOrObj?.title || title);
    setErrorModal({
      isOpen: true,
      title: resolvedTitle,
      message: resolvedMessage,
      type: 'business'
    });
  };

  // E2E 및 테스트 환경을 위한 글로벌 모달 테스트 이벤트 리스너
  useEffect(() => {
    const handleTestModal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (detail.type === 'business') {
        showNoticeModal(detail.message || '', detail.title || '업무 처리 안내');
      } else if (detail.type === 'system') {
        showErrorModal(detail.message || '', detail.title, 'system');
      } else {
        showErrorModal(detail.message || '', detail.title);
      }
    };
    window.addEventListener('erp:test-error-modal', handleTestModal);
    return () => window.removeEventListener('erp:test-error-modal', handleTestModal);
  }, []);

  // 글로벌 프린터 큐 출력 성공 안내 모달 상태
  const [printSuccessModal, setPrintSuccessModal] = useState<{
    isOpen: boolean;
    docType: string;
    docTitle: string;
    docNo?: string;
    stationName: string;
    printerName?: string;
    detailMessage?: string;
  }>({
    isOpen: false,
    docType: '',
    docTitle: '',
    docNo: '',
    stationName: '',
    printerName: '',
    detailMessage: ''
  });

  const showPrintSuccessModal = (params: {
    docType?: string;
    docTitle: string;
    docNo?: string;
    stationName: string;
    printerName?: string;
    detailMessage?: string;
  }) => {
    setPrintSuccessModal({
      isOpen: true,
      docType: params.docType || '문서',
      docTitle: params.docTitle,
      docNo: params.docNo || '',
      stationName: params.stationName,
      printerName: params.printerName || '',
      detailMessage: params.detailMessage || ''
    });
  };

  // ─────────────────────────────────────────────────────────
  // 로컬 db 인메모리 스토어 → React state 즉시 동기화 (Supabase pull 없음 — 저장 후 즉각 화면 반영용)
  const refreshAllData = () => {
    // 💡 헌장 1.2 & 5.2 준수: DB 상에 존재하는 물리적 중복 청구 상세 레코드 완벽 소탕 & 원격 DB(Supabase) 동기 삭제
    const seen = new Set<string>();
    const duplicateIds: string[] = [];
    db.billingDetails.forEach(bd => {
      const key = `${bd.billingId}_${bd.contractAssetId || ''}_${bd.itemName}_${bd.amount}_${bd.description || ''}`;
      if (seen.has(key)) {
        duplicateIds.push(bd.id);
      } else {
        seen.add(key);
      }
    });
    if (duplicateIds.length > 0) {
      duplicateIds.forEach(id => db.deleteRow('billingDetails', id));
      // 원격 DB에서도 중복 행 물리 삭제 대기
      db.awaitPendingWrites().catch(err => console.error("BillingDetails cleanup error:", err));
    }

    // 💡 헌장 1.2 & 5.2 준수: 계약/배차가 존재하지 않는 고아 출고검수의뢰 자동 소탕 & DB 동기 삭제
    if (db.contracts.length > 0) {
      const validContractIds = new Set(db.contracts.map(c => c.id));
      const validDeliveryIds = new Set(db.deliveries.map(d => d.id));
      const orphanInspections = db.outboundInspections.filter(
        i => (!i.contractId || !validContractIds.has(i.contractId)) &&
             (!i.deliveryId || !validDeliveryIds.has(i.deliveryId))
      );
      if (orphanInspections.length > 0) {
        orphanInspections.forEach(i => db.deleteRow('outboundInspections', i.id));
        db.awaitPendingWrites().catch(err => console.error("Orphan inspections cleanup error:", err));
      }

      // 💡 헌장 1.1 & 1.2 준수: 취소된 출고 요청(status === 'CANCELLED')에 묶여 잔류하던 검수/체결슬롯 자동 정리 및 자산 임대가능(AVAILABLE) 원복
      const activeCaIdsFromActiveDeliveries = new Set<string>();
      db.deliveries.forEach(d => {
        if (d.status === 'CANCELLED') return;
        if (!d.cargoItems) return;
        try {
          const parsed = JSON.parse(d.cargoItems);
          if (Array.isArray(parsed)) {
            parsed.forEach((ci: any) => {
              if (Array.isArray(ci?.contractAssetIds)) {
                ci.contractAssetIds.forEach((id: string) => {
                  if (id) activeCaIdsFromActiveDeliveries.add(id);
                });
              }
            });
          }
        } catch {}
      });

      const cancelledOutbounds = db.deliveries.filter(
        d => d.status === 'CANCELLED' && (d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환')
      );
      let cancelledCleanupTriggered = false;
      const candidateRevertAssetIds = new Set<string>();
      const nowCleanupIso = new Date().toISOString();

      cancelledOutbounds.forEach(deliv => {
        // 1) 취소된 배차에 직접 연결된 출고검수 레코드 제거
        const linkedInsps = db.outboundInspections.filter(ins => ins.deliveryId === deliv.id);
        linkedInsps.forEach(ins => {
          if (ins.assetId) candidateRevertAssetIds.add(ins.assetId);
          if (ins.contractAssetId && !activeCaIdsFromActiveDeliveries.has(ins.contractAssetId)) {
            const caObj = db.contractAssets.find(c => c.id === ins.contractAssetId && (!deliv.contractId || c.contractId === deliv.contractId));
            if (caObj) {
              if (caObj.assetId) candidateRevertAssetIds.add(caObj.assetId);
              db.deleteRow('contractAssets', caObj.id);
            }
          }
          db.deleteRow('outboundInspections', ins.id);
          cancelledCleanupTriggered = true;
        });

        // 2) 취소된 배차 cargoItems 내 잔류 contractAssetIds 정리
        if (deliv.cargoItems) {
          try {
            const parsed = JSON.parse(deliv.cargoItems);
            if (Array.isArray(parsed)) {
              let hasResidualCaIds = false;
              parsed.forEach((ci: any) => {
                if (Array.isArray(ci?.contractAssetIds) && ci.contractAssetIds.length > 0) {
                  hasResidualCaIds = true;
                  ci.contractAssetIds.forEach((caId: string) => {
                    if (!caId || activeCaIdsFromActiveDeliveries.has(caId)) return;
                    const caObj = db.contractAssets.find(c => c.id === caId && (!deliv.contractId || c.contractId === deliv.contractId));
                    if (caObj) {
                      if (caObj.assetId) candidateRevertAssetIds.add(caObj.assetId);
                      db.deleteRow('contractAssets', caObj.id);
                      cancelledCleanupTriggered = true;
                    }
                  });
                }
              });
              if (hasResidualCaIds) {
                const cleanedCargo = parsed.map((ci: any) => ({ ...ci, contractAssetIds: [] }));
                db.updateRow<Delivery>('deliveries', deliv.id, {
                  cargoItems: JSON.stringify(cleanedCargo),
                  updatedAt: nowCleanupIso
                });
                cancelledCleanupTriggered = true;
              }
            }
          } catch {}
        }
      });

      // 3) 취소 슬롯에서 해제된 장비(또는 활성 체결자산이 전혀 없는데 대여중/할당중으로 남은 장비 G14015, G14019 등)를 임대가능(AVAILABLE)으로 복원
      ['ASSET-0000077', 'ASSET-0000081'].forEach(id => candidateRevertAssetIds.add(id));
      candidateRevertAssetIds.forEach(assetId => {
        const stillActiveCa = db.contractAssets.some(
          ca => ca.assetId === assetId && ca.status !== 'RETURNED' && ca.status !== 'SOLD'
        );
        if (!stillActiveCa) {
          const targetAsset = db.assets.find(a => a.id === assetId);
          if (targetAsset && (targetAsset.status === 'RENTED' || targetAsset.status === 'ASSIGNED' || targetAsset.status === 'OUTBOUND_INSPECTION' || targetAsset.status === 'AWAITING_TRANSPORT')) {
            db.updateRow<Asset>('assets', targetAsset.id, {
              status: 'AVAILABLE',
              currentCustomerId: null as any,
              currentSiteId: null as any,
              contractStart: null as any,
              contractEnd: null as any,
              updatedAt: nowCleanupIso
            });
            cancelledCleanupTriggered = true;
          }
        }
      });

      if (cancelledCleanupTriggered) {
        db.awaitPendingWrites().catch(err => console.error("Cancelled outbound cleanup sync error:", err));
      }

      // 💡 [상차완료 ➔ 하차 예정일 자동 운송완료 및 계약/청구 개시일 동기화]
      const nowLocal = new Date();
      const todayLocalStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
      let autoDeliverySyncTriggered = false;

      db.deliveries.forEach(deliv => {
        if (deliv.status === 'CANCELLED') return;
        const isLoadedOrDelivered = Boolean(deliv.loadingCompletedAt) || deliv.status === 'DELIVERED' || (deliv.status as string) === 'COMPLETED';
        if (!isLoadedOrDelivered) return;

        const effUnload = (deliv.unloadingDate || deliv.loadingDate || deliv.scheduledDate || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(effUnload)) return;

        // 1) 상차완료 상태에서 하차 예정일이 도래(오늘 이하)한 경우 자동으로 운송완료(DELIVERED) 전환
        if (deliv.status === 'DISPATCHED' && deliv.loadingCompletedAt && effUnload <= todayLocalStr) {
          db.updateRow<Delivery>('deliveries', deliv.id, {
            status: 'DELIVERED',
            unloadingCompletedAt: effUnload,
            updatedAt: nowCleanupIso
          });
          autoDeliverySyncTriggered = true;
        } else if (deliv.loadingCompletedAt && deliv.unloadingCompletedAt !== effUnload) {
          db.updateRow<Delivery>('deliveries', deliv.id, {
            unloadingCompletedAt: effUnload,
            updatedAt: nowCleanupIso
          });
          autoDeliverySyncTriggered = true;
        }

        // 2) 출고/교환 배차의 경우 하차 예정일 = 운송 완료일 = 계약 개시일 = 청구 개시일 100% 일치 보장
        const isOutboundLike =
          deliv.type === 'OUTBOUND' ||
          deliv.type === 'EXCHANGE' ||
          deliv.dispatchCategory === '출고' ||
          deliv.dispatchCategory === '교환';

        if (isOutboundLike && deliv.contractId) {
          const targetCaIds = new Set<string>();
          if (deliv.cargoItems) {
            try {
              const parsed = typeof deliv.cargoItems === 'string' ? JSON.parse(deliv.cargoItems) : deliv.cargoItems;
              if (Array.isArray(parsed)) {
                parsed.forEach((ci: any) => {
                  if (Array.isArray(ci?.contractAssetIds)) {
                    ci.contractAssetIds.forEach((id: string) => {
                      if (id) targetCaIds.add(id);
                    });
                  }
                });
              }
            } catch {}
          }
          db.outboundInspections
            .filter(ins => ins.deliveryId === deliv.id && ins.contractAssetId)
            .forEach(ins => {
              if (ins.contractAssetId) targetCaIds.add(ins.contractAssetId);
            });

          if (targetCaIds.size === 0) {
            const siblingOutbounds = db.deliveries.filter(
              d => d.contractId === deliv.contractId && d.status !== 'CANCELLED' && (d.type === 'OUTBOUND' || d.type === 'EXCHANGE')
            );
            if (siblingOutbounds.length === 1) {
              db.contractAssets
                .filter(ca => ca.contractId === deliv.contractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD')
                .forEach(ca => targetCaIds.add(ca.id));
            }
          }

          targetCaIds.forEach(caId => {
            const caObj = db.contractAssets.find(c => c.id === caId && c.contractId === deliv.contractId);
            if (!caObj) return;
            const loadStr = (deliv.loadingDate || deliv.scheduledDate || '').slice(0, 10);
            const shouldSyncFirstStart =
              !caObj.firstStartDate ||
              caObj.firstStartDate === caObj.startDate ||
              caObj.firstStartDate === loadStr;
            if (caObj.startDate !== effUnload || caObj.status === 'AWAITING_TRANSPORT' || (shouldSyncFirstStart && caObj.firstStartDate !== effUnload)) {
              db.updateRow<ContractAsset>('contractAssets', caObj.id, {
                status: 'RENTED',
                startDate: effUnload,
                ...(shouldSyncFirstStart ? { firstStartDate: effUnload } : {})
              });
              autoDeliverySyncTriggered = true;
            }
            if (caObj.assetId) {
              const assetObj = db.assets.find(a => a.id === caObj.assetId);
              if (assetObj && (assetObj.status === 'RENTED' || assetObj.status === 'AWAITING_TRANSPORT') && assetObj.currentCustomerId && (assetObj.contractStart !== effUnload || assetObj.status !== 'RENTED')) {
                db.updateRow<Asset>('assets', assetObj.id, {
                  status: 'RENTED',
                  contractStart: effUnload
                });
                autoDeliverySyncTriggered = true;
              }
            }
          });

          db.assetInOutLogs
            .filter(l => l.deliveryId === deliv.id && l.type === 'OUTBOUND' && l.eventDate !== effUnload)
            .forEach(l => {
              db.updateRow<AssetInOutLog>('asset_inout_logs', l.id, {
                eventDate: effUnload
              });
              autoDeliverySyncTriggered = true;
            });

          const parentContract = db.contracts.find(c => c.id === deliv.contractId);
          if (parentContract) {
            const activeCas = db.contractAssets.filter(
              c => c.contractId === parentContract.id && c.status !== 'RETURNED' && c.status !== 'SOLD' && c.startDate
            );
            const earliestStart = activeCas.map(c => c.startDate).filter(Boolean).sort()[0] || effUnload;
            const needStatusActive = parentContract.status !== 'COMPLETED' && parentContract.status !== 'ACTIVE' && parentContract.status !== 'EXTENDED';
            if (parentContract.startDate !== earliestStart || needStatusActive) {
              db.updateRow<Contract>('contracts', parentContract.id, {
                startDate: earliestStart,
                ...(needStatusActive ? { status: 'ACTIVE' } : {}),
                updatedAt: nowCleanupIso
              });
              autoDeliverySyncTriggered = true;
            }
          }
        }
      });

      if (autoDeliverySyncTriggered) {
        db.awaitPendingWrites().catch(err => console.error("Auto delivery unloading sync error:", err));
      }
    }

    // 진짜 개발자 계정만 '개발자'로 정규화 (사장/부사장 등 최고관리자 성명 보존)
    db.users.forEach(u => {
      if (u.loginId === 'admin' || u.id === 'sys-admin') {
        u.name = '개발자';
      }
    });

    setTenants([...db.tenants]);
    setUsers([...db.users]);
    setDepartments([...(db.departments || [])]);
    setPermissions([...db.permissions]);
    setCustomers(sortCustomersByName([...db.customers]));
    setContacts([...db.contacts]);
    setSites([...db.sites]);
    setSiteMasters([...db.siteMasters]);
    setProducts([...db.products]);
    setAssets([...db.assets]);
    setConsumables([...db.consumables]);
    setConsumableLogs([...db.consumableLogs]);
    setConsumablePurchases([...db.consumablePurchases]);
    setContracts([...db.contracts]);
    setContractAssets([...db.contractAssets]);
    setContractHistory([...db.contractHistory]);
    setDeliveries([...db.deliveries]);
    setTransportCompanies([...db.transportCompanies]);
    setTransportDrivers([...db.transportDrivers]);
    setTransportNegotiations([...db.transportNegotiations]);
    setSubleaseNegotiations([...db.subleaseNegotiations]);
    // 🧹 원장 상태와 교차 검증하여 이미 처리 완료된 ToDo 자동 상계 정리
    try {
      const cleanedTodos = reconcileCompletedTodosInDb();
      if (cleanedTodos > 0) {
        db.awaitPendingWrites().catch(() => {});
      }
    } catch {}

    setBillings([...db.billings]);
    setBillingDetails([...db.billingDetails]);
    setPayments([...db.payments]);
    setPaymentDepositLinks([...db.paymentDepositLinks]);
    setRepairs([...db.repairs]);
    setRepairConsumables([...db.repairConsumables]);
    setTodos([...db.todos]);
    setBankTransactions([...db.bankTransactions]);
    setBankMatchingRules([...db.bankMatchingRules]);
    setBankInitialBalances([...db.bankInitialBalances]);
    setAssetInOutLogs([...db.assetInOutLogs]);
    setVendors([...db.vendors]);
    setOfficialMailConfigs([...db.officialMailConfigs]);
    setCashFlowSnapshots([...db.cashFlowSnapshots]);
    setOutboundInspections([...db.outboundInspections]);
    setDepreciationLogs([...db.depreciationLogs]);
    setPurchaseSettlements([...db.purchaseSettlements]);
    setPurchaseSettlementItems([...db.purchaseSettlementItems]);
    setExternalLeases([...db.externalLeases]);
    setInspectionChecklistItems([...db.inspectionChecklistItems]);
    setEquipmentManuals([...db.equipmentManuals]);
    setStandardOptions([...db.standardOptions]);
    setCustomRoles([...db.customRoles]);
    setRolePermissions([...db.rolePermissions]);
    setAnnualLeaveQuotas([...db.annualLeaveQuotas]);
    setLeaveUsages([...db.leaveUsages]);
    setOvertimeRecords([...db.overtimeRecords]);
    setPayrollClosings([...db.payrollClosings]);
    setPrepaidTransactions([...db.prepaidTransactions]);
    setDelinquencyActionLogs([...db.delinquencyActionLogs]);
    setLegalNoticeLogs([...db.legalNoticeLogs]);
    setLegalNoticeTemplates([...db.legalNoticeTemplates]);
    setCorporateVehicles([...db.corporateVehicles]);
    setVehicleOperationLogs([...db.vehicleOperationLogs]);
    setVehicleFuelLogs([...db.vehicleFuelLogs]);
    setStocktakingAudits([...db.stocktakingAudits]);
    setStocktakingAuditItems([...db.stocktakingAuditItems]);
    setCollectedParts([...db.collectedParts]);
    setMechanicConsumableStocks([...db.mechanicConsumableStocks]);
    setPrintStations([...db.printStations]);
    setPrintQueue([...db.printQueue]);
    setErrorReports([...(db.errorReports || [])]);
    setMonthlyIncomeStatements([...(db.monthlyIncomeStatements || [])]);
    setSalesJournals([...(db.salesJournals || [])]);

    setCurrentUser(prev => {
      if (prev && (prev.loginId === 'admin' || prev.id === 'sys-admin')) {
        return { ...prev, name: '개발자' };
      }
      return prev;
    });
  };

  // 전체 테이블 Supabase pull 후 state 동기화 (초기 로딩 전용)
  const fullRefreshFromServer = async () => {
    if (db.isSupabaseConnected()) {
      try {
        await db.pullFromSupabase();
      } catch (err: any) {
        console.error("Failed to sync from Supabase:", err);
        showErrorModal(err?.message || String(err), 'DB 전체 동기화 오류');
      }
    }

    // 🌐 [중앙 DB SSOT 동기화] 테넌트 원장 동기화 (중앙 DB가 SSOT이므로 중앙 데이터로 100% 동기화하여 로컬 가짜 시드 소탕)
    try {
      const centralTenants = await fetchCentralTenants();
      if (centralTenants && centralTenants.length > 0) {
        db.tenants = centralTenants;
        setTenants([...centralTenants]);
        setOfficialMailConfigs([...db.officialMailConfigs]);

        const currentValid = centralTenants.find(t => t.id === currentTenantId || t.tenantCode === currentTenantId);
        if (!currentValid) {
          const def = centralTenants.find(t => t.isDefault) || centralTenants[0];
          if (def) setCurrentTenantId(def.id);
        }
      }
    } catch (err) {
      console.warn('[Central DB Sync] Failed to fetch central tenants:', err);
    }

    try {
      const centralManuals = await fetchCentralEquipmentManuals('AWP');
      if (centralManuals && centralManuals.length > 0) {
        centralManuals.forEach(cm => {
          const exists = db.equipmentManuals.find(m => m.id === cm.id);
          const mapped: EquipmentManual = {
            id: cm.id,
            modelName: cm.modelName || '공통',
            manufacturer: cm.manufacturer || '기타',
            category: (cm.category as any) || 'PARTS_BOOK',
            title: cm.title || `${cm.modelName || ''} 매뉴얼`,
            fileUrl: cm.manualUrl || cm.fileUrl || cm.circuitDiagramUrl || cm.partsCatalogUrl || '',
            fileName: cm.fileName || `${cm.modelName || 'manual'}.pdf`,
            fileSize: (cm as any).fileSize || 0,
            version: (cm as any).version || '1.0',
            uploadDate: (cm as any).uploadDate || new Date().toISOString().slice(0, 10),
            uploadedBy: (cm as any).uploadedBy || 'CENTRAL_SSOT',
            memo: (cm as any).memo || cm.aiSummary || '',
            inspectionItemCodes: (cm as any).inspectionItemCodes,
            mediaType: (cm as any).mediaType || (cm as any).media_type || 'PDF',
            aiProcessed: Boolean(cm.aiProcessed),
            createdAt: (cm as any).created_at || (cm as any).createdAt || new Date().toISOString(),
            updatedAt: (cm as any).updated_at || (cm as any).updatedAt || new Date().toISOString()
          };
          if (exists) {
            db.updateRow('equipmentManuals', cm.id, mapped);
          } else {
            db.insertRow('equipmentManuals', mapped);
          }
        });
        setEquipmentManuals([...db.equipmentManuals]);
      }
    } catch (err) {
      console.warn('[Central DB Sync] Failed to fetch central equipment manuals:', err);
    }

    refreshAllData();
  };

  // 메뉴별 관련 테이블만 Supabase pull (메뉴 전환 시 호출 — 최신 데이터 보장)
  const MENU_TABLE_MAP: Record<string, string[]> = {
    'dashboard':            ['deliveries', 'contracts', 'contractAssets', 'outboundInspections', 'repairs', 'customers', 'sites', 'vendors', 'contractHistory', 'billings', 'todos', 'assets', 'consumablePurchases', 'purchaseSettlements', 'leaveUsages', 'users', 'departments', 'permissions', 'customRoles', 'rolePermissions'],
    'delivery':             ['deliveries', 'transportCompanies', 'transportDrivers', 'contracts', 'assets', 'sites', 'siteMasters', 'standardOptions', 'printStations', 'printQueue'],
    'transport_master':     ['transportCompanies', 'transportDrivers'],
    'field_as':             ['repairs', 'assets', 'products', 'users', 'consumables', 'mechanicConsumableStocks', 'customers', 'sites', 'siteMasters', 'contracts', 'contractAssets', 'vendors'],
    'as_route_tracking':    ['repairs', 'assets', 'products', 'users', 'customers', 'sites', 'siteMasters', 'contracts', 'contractAssets', 'vendors', 'departments'],
    'smart_as_request':     ['repairs', 'customers', 'sites', 'siteMasters', 'contracts', 'contractAssets', 'assets', 'products', 'vendors'],
    'repair':               ['repairs', 'assets', 'consumables', 'repairConsumables', 'mechanicConsumableStocks', 'vendors'],
    'contract':             ['contracts', 'contractAssets', 'contractHistory', 'customers', 'sites', 'siteMasters', 'standardOptions', 'assets', 'products', 'deliveries'],
    'billing':              ['billings', 'billingDetails', 'payments', 'paymentDepositLinks', 'bankTransactions', 'contracts', 'customers'],
    'customer':             ['customers', 'contacts', 'sites', 'siteMasters', 'standardOptions'],
    'sales_journal':        ['salesJournals', 'customers', 'users', 'departments'],
    'site_options':         ['siteMasters', 'sites', 'standardOptions', 'customers', 'contracts', 'assets'],
    'available_inventory':  ['products', 'assets', 'contracts', 'contractAssets', 'deliveries', 'outboundInspections', 'customers', 'sites', 'contractHistory'],
    'product':              ['products'],
    'asset':                ['assets', 'products', 'vendors', 'assetInOutLogs'],
    'acquisition_disposal': ['assets', 'products', 'vendors', 'assetInOutLogs'],
    'rent_asset':           ['assets', 'products', 'vendors', 'assetInOutLogs', 'deliveries'],
    'consumable':           ['consumables', 'consumableLogs', 'consumablePurchases', 'vendors', 'mechanicConsumableStocks', 'stocktakingAudits', 'stocktakingAuditItems', 'collectedParts'],
    'consumable_purchase':  ['consumables', 'consumablePurchases', 'vendors'],
    'consumable_inout':     ['consumables', 'consumableLogs', 'consumablePurchases', 'assets', 'mechanicConsumableStocks'],
    'consumable_stock':     ['consumables', 'consumableLogs', 'mechanicConsumableStocks', 'stocktakingAudits', 'stocktakingAuditItems', 'collectedParts'],
    'smart_dispatch':       ['deliveries', 'contracts', 'assets', 'sites', 'siteMasters', 'standardOptions', 'transportCompanies', 'transportDrivers', 'printStations', 'printQueue', 'assetInOutLogs'],
    'smart_dispatch4':      ['customers', 'sites', 'siteMasters', 'standardOptions', 'contacts', 'contracts', 'contractAssets', 'contractHistory', 'deliveries', 'todos', 'outboundInspections', 'assets', 'products', 'assetInOutLogs'],
    'voice_dispatch':       ['customers', 'sites', 'siteMasters', 'standardOptions', 'contacts', 'contracts', 'deliveries', 'assets', 'products'],
    'smart_return':         ['deliveries', 'contracts', 'assets', 'sites', 'siteMasters', 'standardOptions', 'transportCompanies', 'transportDrivers', 'printStations', 'printQueue', 'assetInOutLogs'],
    'asset_inout_history':  ['assetInOutLogs', 'assets', 'customers', 'sites', 'contracts', 'contractAssets', 'deliveries', 'outboundInspections'],
    'daily_inout':          ['assetInOutLogs', 'assets', 'deliveries', 'contracts', 'contractAssets', 'outboundInspections', 'customers', 'sites'],
    'dispatch_assign':      ['contracts', 'contractAssets', 'assets', 'outboundInspections', 'deliveries', 'customers', 'sites', 'siteMasters', 'standardOptions', 'contractHistory', 'assetInOutLogs'],
    'outbound_inspections': ['outboundInspections', 'contracts', 'contractAssets', 'assets', 'customers', 'sites', 'siteMasters', 'standardOptions', 'deliveries', 'assetInOutLogs'],
    'bank_matching':        ['bankTransactions', 'bankMatchingRules', 'bankInitialBalances', 'paymentDepositLinks', 'payments', 'billings', 'customers', 'purchaseSettlements'],
    'vendors':              ['vendors'],
    'organization':         ['users', 'departments'],
    'permission':           ['users', 'permissions', 'departments', 'customRoles', 'rolePermissions'],
    'tenant_management':    ['tenants', 'users'],
    'payroll':              ['users', 'departments'],
    'corporate_card':       ['vendors', 'billings'],
    'cash_flow':            ['billings', 'payments', 'contracts', 'assets'],
    'delinquency':          ['billings', 'customers', 'contracts'],
    'official_mail':        ['tenants', 'customers', 'contacts', 'sites', 'siteMasters', 'products'],
    'depreciation_execution': ['depreciationLogs', 'assets'],
    'leave_application':    ['users', 'annualLeaveQuotas', 'leaveUsages'],
    'leave_management':     ['users', 'annualLeaveQuotas', 'leaveUsages', 'overtimeRecords', 'departments'],
    'ot_management':        ['users', 'overtimeRecords', 'departments'],
    'leave_ot':             ['users', 'annualLeaveQuotas', 'leaveUsages', 'overtimeRecords'],
    'vehicle_log':          ['corporateVehicles', 'vehicleOperationLogs', 'vehicleFuelLogs', 'users'],
    'regular_reports':      ['contracts', 'contractAssets', 'deliveries', 'assets', 'repairs', 'purchaseSettlements', 'purchaseSettlementItems', 'externalLeases', 'depreciationLogs', 'billings', 'billingDetails', 'bankTransactions', 'customers', 'payrollClosings', 'vehicleFuelLogs', 'monthlyIncomeStatements'],
    'initial_db_upload':    ['contracts', 'contractAssets', 'customers', 'assets', 'sites', 'siteMasters', 'billings', 'billingDetails', 'bankTransactions', 'bankMatchingRules', 'bankInitialBalances', 'paymentDepositLinks'],
    'data_formation':       ['contracts', 'contractAssets', 'customers', 'assets', 'sites', 'siteMasters', 'products'],
    'print_queue_monitor':  ['printStations', 'printQueue'],
    'privacy_audit':        ['privacyAccessLogs', 'users', 'departments'],
    'receivable':           ['billings', 'billingDetails', 'customers', 'contracts', 'bankTransactions'],
    'purchase_settlement':  ['purchaseSettlements', 'purchaseSettlementItems', 'vendors', 'assets'],
    'inspection_checklist_manage': ['inspectionChecklistItems'],
    'error_report':         ['errorReports', 'users'],
    'agentic_ai_lab':       ['contracts', 'assets', 'billings', 'deliveries'],
    'agentic_dispatch_studio': ['deliveries', 'contracts', 'assets'],
    'agentic_settlement_autopilot': ['billings', 'billingDetails', 'bankTransactions', 'purchaseSettlements'],
    'agentic_asset_lifecycle': ['assets', 'contracts', 'repairs'],
    'dev_uploader':         ['contracts', 'contractAssets', 'customers', 'sites', 'siteMasters', 'assets'],
  };

  const inFlightMenuLoadsRef = useRef<Map<string, Promise<void>>>(new Map());
  const lastMenuLoadAtRef = useRef<Map<string, number>>(new Map());

  const loadTablesForMenu = useCallback(async (menuId: string) => {
    if (!db.isSupabaseConnected()) return;
    const keys = MENU_TABLE_MAP[menuId];
    if (!keys || keys.length === 0) return;

    const existingPromise = inFlightMenuLoadsRef.current.get(menuId);
    if (existingPromise) {
      return existingPromise;
    }

    const now = Date.now();
    const lastLoadedAt = lastMenuLoadAtRef.current.get(menuId) || 0;
    if (now - lastLoadedAt < 1500) {
      return;
    }

    const loadPromise = (async () => {
      try {
        await Promise.all(keys.map(key => db.pullTableFromSupabase(key)));
        lastMenuLoadAtRef.current.set(menuId, Date.now());
        refreshAllData();
      } catch (err: any) {
        console.error('loadTablesForMenu error:', err);
        showErrorModal(err?.message || String(err), '메뉴 데이터 동기화 오류');
      } finally {
        inFlightMenuLoadsRef.current.delete(menuId);
      }
    })();

    inFlightMenuLoadsRef.current.set(menuId, loadPromise);
    return loadPromise;
  }, []);


  useEffect(() => {
    // Seed 계약 데이터 초기화는 개발 환경에서만 실행
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (!localStorage.getItem('seed_v1_8_dummy_contracts_v2')) {
        localStorage.removeItem('erp_contracts');
        localStorage.removeItem('erp_contractAssets');
        localStorage.setItem('seed_v1_8_dummy_contracts_v2', 'true');
      }
    }


    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      if (document.documentElement.getAttribute('data-mobile-view') !== 'true') {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    }
    
    // 🛡️ [세션 위변조 방어 로드]
    const normalizeDeveloperIdentity = (u: User): User => {
      if (isSystemDeveloperUser(u)) {
        return {
          ...u,
          name: '개발자',
          department: '개발자',
          position: '개발자',
          departmentId: ''
        };
      }
      return u;
    };

    const savedUser = sessionStorage.getItem('user');
    const autoUser = localStorage.getItem('auto_user');
    if (savedUser) {
      try {
        const rawParsed = parseSessionUser<User>(savedUser);
        if (rawParsed) {
          const parsed = normalizeDeveloperIdentity(rawParsed);
          const isDev = isSystemDeveloperUser(parsed);
          if (isDev && !isDemoMode()) {
            isCurrentDeviceAuthorizedForDeveloper().then(auth => {
              if (!auth.isAuthorized) {
                console.warn('🚨 [보안 차단] 비인가 물리 단말기에서의 개발자 세션 복원 차단');
                sessionStorage.removeItem('user');
                setCurrentUser(null);
              }
            });
          }
          sessionStorage.setItem('user', signSessionUser(parsed));
          setCurrentUser(parsed);
        } else {
          sessionStorage.removeItem('user');
          setCurrentUser(null);
        }
      } catch (e) {
        sessionStorage.removeItem('user');
        setCurrentUser(null);
      }
    } else if (autoUser) {
      try {
        const rawParsed = parseSessionUser<User>(autoUser);
        if (rawParsed) {
          const parsed = normalizeDeveloperIdentity(rawParsed);
          const isDev = isSystemDeveloperUser(parsed);
          if (isDev && !isDemoMode()) {
            isCurrentDeviceAuthorizedForDeveloper().then(auth => {
              if (!auth.isAuthorized) {
                console.warn('🚨 [보안 차단] 비인가 물리 단말기에서의 개발자 자동 로그인 차단');
                localStorage.removeItem('auto_user');
                sessionStorage.removeItem('user');
                setCurrentUser(null);
              }
            });
          }
          localStorage.setItem('auto_user', signSessionUser(parsed));
          setCurrentUser(parsed);
        } else {
          localStorage.removeItem('auto_user');
          setCurrentUser(null);
        }
      } catch (e) {
        localStorage.removeItem('auto_user');
        setCurrentUser(null);
      }
    } else if (isDemoMode() && sessionStorage.getItem('demo_explicit_logout') !== 'true') {
      const demoUser = DEMO_DEFAULT_ADMIN_USER as User;
      sessionStorage.setItem('user', signSessionUser(demoUser));
      setCurrentUser(demoUser);
    }
    
    // 초기 로딩: 전체 28개 테이블 Supabase pull (앱 최초 진입 1회만)
    fullRefreshFromServer();
  }, []);

  // 💡 [사용자 편의성 최우선 정책] 미사용(30분 등)으로 인한 강제 자동 로그아웃 기능 영구 비활성화 (사장님 지시사항)

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const login = async (
    loginId: string, 
    passwordHash: string, 
    keepLoggedIn?: boolean,
    bypassDeviceCheck?: boolean
  ): Promise<{ 
    success: boolean; 
    reason?: string; 
    error?: string;
    requireDeviceVerification?: boolean;
    detectedFingerprint?: string;
    detectedMacs?: string[];
  }> => {
    const cleanId = (loginId || '').trim();
    const cleanPw = (passwordHash || '').trim();

    if (!cleanId) {
      return { success: false, reason: '사용자 아이디를 입력해 주십시오.' };
    }
    if (!cleanPw) {
      return { success: false, reason: '비밀번호를 입력해 주십시오.' };
    }

    // 1. 개발자 / 최고관리자 마스터 계정 (DB/네트워크 상태와 무관하게 100% 무조건 보장)
    if (cleanId.toLowerCase() === 'admin' && cleanPw === 'admin123') {
      // 🛡️ [물리 단말기 2단계 인가 검증]
      if (!bypassDeviceCheck && !isDemoMode()) {
        const deviceAuth = await isCurrentDeviceAuthorizedForDeveloper();
        if (!deviceAuth.isAuthorized) {
          logPrivacyAccess('LOGIN', 'login', `로그인 거부: 비인가 물리 단말기 개발자 마스터 로그인 시도 ('${cleanId}')`, {
            userId: cleanId,
            userName: '비인가 물리 단말기'
          }).catch(console.error);
          return {
            success: false,
            requireDeviceVerification: true,
            reason: '🚨 [물리 단말기 인가 필요] 개발자 권한은 사전에 등록 및 인가된 물리적 개발자 PC(MAC 주소/하드웨어 지문)에서만 로그인이 허용됩니다.',
            detectedFingerprint: deviceAuth.detectedFingerprint,
            detectedMacs: deviceAuth.detectedMacs
          };
        }
      }

      const fallbackAdmin: User = isDemoMode()
        ? ({ ...DEMO_DEFAULT_ADMIN_USER } as User)
        : { 
            id: 'sys-admin', loginId: 'admin', passwordHash: hashPassword('admin123'), 
            name: '개발자', department: '개발자', position: '개발자', departmentId: '', role: 'ADMIN', customRoleId: 'role_mgmt', createdAt: new Date().toISOString() 
          };
      sessionStorage.removeItem('demo_explicit_logout');
      setCurrentUser(fallbackAdmin);
      sessionStorage.setItem('user', signSessionUser(fallbackAdmin));
      if (keepLoggedIn) {
        localStorage.setItem('auto_user', signSessionUser(fallbackAdmin));
      } else {
        localStorage.removeItem('auto_user');
      }
      if (getDomainMode() === 'ADMIN') {
        setActiveTab('tenant_management');
      }
      logPrivacyAccess('LOGIN', 'login', '개발자 최고관리자 로그인 성공', {
        userId: fallbackAdmin.loginId,
        userName: fallbackAdmin.name
      }).catch(console.error);
      return { success: true };
    }

    // 🌐 플랫폼 최고관리자 도메인 접속 시 일반 계정 차단
    if (getDomainMode() === 'ADMIN') {
      return {
        success: false,
        reason: 'admin.ebro.run은 eBro 플랫폼 최고관리자 전용 관제탑입니다.\n일반 테넌트 임직원께서는 각 사 전용 도메인 또는 ebro.run 메인 포털에서 접속해 주십시오.'
      };
    }

    // 2. 개발 전용 테스트 계정 보장 또는 로컬/원격 DB 사용자 검색
    let user: User | undefined;

    if (cleanId.toLowerCase() === 'manager' && cleanPw === 'mgr123') {
      user = {
        id: 'USR-MGR-TEST', loginId: 'manager', passwordHash: hashPassword('mgr123'),
        name: '영업관리자', department: '영업관리', departmentId: 'DEPT-0000003', role: 'MANAGER', customRoleId: 'role_sales', createdAt: new Date().toISOString()
      };
    } else if (cleanId.toLowerCase() === 'user' && cleanPw === 'user123') {
      user = {
        id: 'USR-USER-TEST', loginId: 'user', passwordHash: hashPassword('user123'),
        name: '일반영업', department: '영업부', departmentId: 'DEPT-0000003', role: 'USER', customRoleId: 'role_sales', createdAt: new Date().toISOString()
      };
    } else if (cleanId.toLowerCase() === 'mechanic' && cleanPw === 'mech123') {
      user = {
        id: 'USR-MECH-TEST', loginId: 'mechanic', passwordHash: hashPassword('mech123'),
        name: '정비기사', department: '정비부', departmentId: 'DEPT-0000005', role: 'MECHANIC', customRoleId: 'role_mechanic', createdAt: new Date().toISOString()
      };
    } else {
      // 3. 로컬 캐시 사용자 검색 (아이디, 사원명, 사번, 전화번호, 이메일 다각도 매칭)
      const normInput = cleanId.toLowerCase();
      const phoneInput = cleanId.replace(/[^0-9]/g, '');

      const matchUser = (u: User) => {
        const uLogin = (u.loginId || '').trim().toLowerCase();
        const uName = (u.name || '').trim().toLowerCase();
        const uId = (u.id || '').trim().toLowerCase();
        const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
        const uEmail = (u.email || '').trim().toLowerCase();
        return uLogin === normInput || 
               uName === normInput || 
               uId === normInput ||
               (uEmail.length > 0 && uEmail === normInput) || 
               (phoneInput.length >= 8 && uPhone.length >= 8 && uPhone === phoneInput);
      };

      user = db.users.find(matchUser);

      // 4. 로컬 캐시에 없는 경우 (초기 로딩 전 또는 캐시 미반영), Supabase 원격 DB 직접 단건 조회
      if (!user && db.isSupabaseConnected() && supabase) {
        try {
          const { data: suUsers } = await supabase
            .from('users')
            .select('*')
            .or(`loginId.ilike.${cleanId},name.ilike.${cleanId},id.ilike.${cleanId}`);
          if (suUsers && suUsers.length > 0 && suUsers[0]) {
            const foundUser = suUsers[0] as User;
            user = foundUser;
            // 개발자 계정이 아닌 일반 테넌트 사원만 로컬 캐시에 보강 저장
            if (!isSystemDeveloperUser(foundUser)) {
              const currentList = db.users;
              if (!currentList.some(u => u.id === foundUser.id)) {
                db.users = [...currentList, foundUser];
              }
            }
          }
        } catch (suErr) {
          console.warn('원격 DB 직접 사용자 인증 조회 오류:', suErr);
        }
      }

      // 5. 사용자를 찾을 수 없는 경우 (등록되지 않은 사원)
      if (!user) {
        logPrivacyAccess('LOGIN', 'login', `로그인 거부: 미등록 계정 시도 ('${cleanId}')`, {
          userId: cleanId,
          userName: '미식별'
        }).catch(console.error);
        return { 
          success: false, 
          reason: `등록되지 않은 사원 계정입니다. ('${cleanId}')\n사원명(예: 김동우, 이수용 등) 또는 사번을 정확히 입력해 주십시오.` 
        };
      }

      // 6. 계정 상태 검증 (재직, 휴직, 퇴사)
      if (user.status === 'RETIRED') {
        logPrivacyAccess('LOGIN', 'login', `로그인 거부: 퇴사자 계정 접속 차단 (${user.name})`, {
          userId: user.loginId || user.id,
          userName: user.name
        }).catch(console.error);
        return { 
          success: false, 
          reason: `퇴사 처리된 계정입니다. (${user.name} 님)\n로그인이 제한되오니 인사담당자에게 문의해 주십시오.` 
        };
      }

      if (user.status === 'LEAVE_OF_ABSENCE') {
        logPrivacyAccess('LOGIN', 'login', `로그인 거부: 휴직자 계정 접속 차단 (${user.name})`, {
          userId: user.loginId || user.id,
          userName: user.name
        }).catch(console.error);
        return { 
          success: false, 
          reason: `현재 휴직 상태로 설정된 계정입니다. (${user.name} 님)\n관리자에게 업무 복귀 승인을 요청해 주십시오.` 
        };
      }

      // 7. 비밀번호 검증 (미설정 사원은 사내 기본 비밀번호 1111 적용, 해시 및 레거시 평문 검증)
      const expectedPassword = user.passwordHash || '1111';
      if (!verifyPassword(cleanPw, expectedPassword)) {
        logPrivacyAccess('LOGIN', 'login', `로그인 거부: 비밀번호 불일치 (${user.name})`, {
          userId: user.loginId || user.id,
          userName: user.name
        }).catch(console.error);
        return { 
          success: false, 
          reason: `비밀번호가 일치하지 않습니다. (${user.name} 님)\n사원 초기 비밀번호는 '1111'입니다. 비밀번호를 다시 확인해 주십시오.` 
        };
      }

      // 🛡️ 평문 비밀번호 자동 SHA-256 해시 업그레이드
      if (user.passwordHash && !/^[a-f0-9]{64}$/i.test(user.passwordHash)) {
        const upgradedHash = hashPassword(cleanPw);
        user.passwordHash = upgradedHash;
        try {
          db.updateRow<User>('users', user.id, { passwordHash: upgradedHash });
          if (supabase) {
            supabase.from('users').update({ password_hash: upgradedHash }).eq('id', user.id).then();
          }
        } catch (e) {
          console.warn('Auto password hash upgrade failed:', e);
        }
      }
    }

    // 7-1. 🏢 [테넌트 구독 만료 및 정지 가드]
    // 테넌트 상태가 SUSPENDED이거나 구독이 만료되고 유예기간이 지난 경우,
    // 일반 직원의 로그인을 차단하고 명확한 안내 에러 메시지 반환
    const targetTenant = (user as any).tenantId 
      ? (tenants.find(t => t.id === (user as any).tenantId) || currentTenant)
      : currentTenant;

    if (targetTenant) {
      const isStaff = user.role !== 'ADMIN' && !isSystemDeveloperUser(user);
      if (isStaff) {
        let isSuspended = targetTenant.status === 'SUSPENDED' || targetTenant.subscription?.status === 'SUSPENDED';
        let isExpiredPastGrace = targetTenant.status === 'EXPIRED';

        const sub = targetTenant.subscription;
        if (sub) {
          const graceDays = typeof sub.gracePeriodDays === 'number' ? sub.gracePeriodDays : 7;
          const todayStr = new Date().toISOString().slice(0, 10);
          const endStr = sub.endDate || todayStr;
          const today = new Date(todayStr).getTime();
          const end = new Date(endStr).getTime();
          const diffDays = Math.round((end - today) / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            const overdueDays = Math.abs(diffDays);
            if (overdueDays > graceDays) {
              isExpiredPastGrace = true;
            }
          }

          if (sub.status === 'EXPIRED') {
            if (!sub.endDate) {
              isExpiredPastGrace = true;
            } else {
              const overdueDays = Math.abs(diffDays);
              if (diffDays < 0 && overdueDays > graceDays) {
                isExpiredPastGrace = true;
              }
            }
          }
        }

        if (isSuspended || isExpiredPastGrace) {
          logPrivacyAccess('LOGIN', 'login', `로그인 거부: 테넌트 이용 기간 만료/정지 (${targetTenant.displayName || targetTenant.tradeName || targetTenant.corporateName}) - 사용자: ${user.name}`, {
            userId: user.loginId || user.id,
            userName: user.name
          }).catch(console.error);

          const errorMsg = '해당 테넌트의 이용 기간이 만료되었습니다. 관리자에게 문의하세요.';
          return { 
            success: false, 
            reason: errorMsg,
            error: errorMsg
          };
        }
      }
    }

    // 8. 권한 상속 롤 누락 시 부서 기반 자동 상속 보강
    if (!user.customRoleId) {
      const dept = (user.departmentId || user.department || '').toUpperCase();
      let assignedRoleId = '';
      if (dept.includes('0000001') || dept.includes('0000002') || dept.includes('관리') || dept.includes('경영') || dept.includes('임원') || user.position === '사장' || user.position === '부사장' || user.position === '대표이사') assignedRoleId = 'role_mgmt';
      else if (dept.includes('0000003') || dept.includes('영업')) assignedRoleId = 'role_sales';
      else if (dept.includes('0000004') || dept.includes('출고') || dept.includes('배차')) assignedRoleId = 'role_logistics';
      else if (dept.includes('0000005') || dept.includes('0000006') || dept.includes('AS') || dept.includes('정비') || dept.includes('외국인')) assignedRoleId = 'role_mechanic';
      if (assignedRoleId) {
        user = { ...user, customRoleId: assignedRoleId };
      }
    }

    // 🛡️ [물리 단말기 2단계 인가 검증 - 시스템 개발자 계정 전용]
    const isDevAdmin = isSystemDeveloperUser(user);
    if (isDevAdmin && !bypassDeviceCheck && !isDemoMode()) {
      const deviceAuth = await isCurrentDeviceAuthorizedForDeveloper();
      if (!deviceAuth.isAuthorized) {
        logPrivacyAccess('LOGIN', 'login', `로그인 거부: 비인가 물리 단말기 개발자 권한 로그인 시도 (${user.name})`, {
          userId: user.loginId || user.id,
          userName: user.name
        }).catch(console.error);
        return {
          success: false,
          requireDeviceVerification: true,
          reason: '🚨 [물리 단말기 인가 필요] 개발자 권한은 사전에 등록 및 인가된 물리적 개발자 PC(MAC 주소/하드웨어 지문)에서만 로그인이 허용됩니다.',
          detectedFingerprint: deviceAuth.detectedFingerprint,
          detectedMacs: deviceAuth.detectedMacs
        };
      }
    }

    // 9. 로그인 성공 확정
    if (isSystemDeveloperUser(user)) {
      user = {
        ...user,
        name: '개발자',
        department: '개발자',
        position: '개발자',
        departmentId: ''
      };
    }
    sessionStorage.removeItem('demo_explicit_logout');
    setCurrentUser(user);
    sessionStorage.setItem('user', signSessionUser(user));
    if (keepLoggedIn) {
      localStorage.setItem('auto_user', signSessionUser(user));
    } else {
      localStorage.removeItem('auto_user');
    }
    logPrivacyAccess('LOGIN', 'login', `사용자 로그인 성공: ${user.name} (${user.department || user.position || '임직원'})`, {
      userId: user.loginId || user.id,
      userName: user.name
    }).catch(console.error);

    return { success: true };
  };

  const logout = (reason?: any) => {
    const isSyntheticEvent = reason && typeof reason === 'object' && ('nativeEvent' in reason || 'preventDefault' in reason);
    const reasonStr = (typeof reason === 'string' && reason.trim()) ? reason.trim() : undefined;

    if (currentUser) {
      const logMsg = reasonStr ? `사용자 자동 로그아웃 (${reasonStr}): ${currentUser.name}` : `사용자 로그아웃: ${currentUser.name}`;
      logPrivacyAccess('LOGOUT', 'logout', logMsg, {
        userId: currentUser.loginId,
        userName: currentUser.name
      }).catch(console.error);
    }
    setCurrentUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('original_admin_user');
    localStorage.removeItem('auto_user');
    if (isDemoMode()) {
      sessionStorage.setItem('demo_explicit_logout', 'true');
    }
    if (reasonStr && !isSyntheticEvent) {
      showNoticeModal(reasonStr, '보안 자동 로그아웃');
    }
  };

  const switchUser = (userId: string) => {
    let targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      // sys-admin / u-1 등 users 배열에 없는 개발자 계정으로의 복귀 처리
      const originalAdminStr = sessionStorage.getItem('original_admin_user');
      if (originalAdminStr) {
        const originalAdmin = parseSessionUser<User>(originalAdminStr);
        if (originalAdmin && (originalAdmin.id === userId || isSystemDeveloperUser(originalAdmin))) {
          targetUser = isSystemDeveloperUser(originalAdmin)
            ? { ...originalAdmin, name: '개발자', department: '개발자', position: '개발자', departmentId: '' }
            : originalAdmin;
        }
      }
    }
    
    if (targetUser) {
      logPrivacyAccess('VIEW', 'switch_user', `사용자 계정 전환: ${currentUser?.name || '미인증'} -> ${targetUser.name}`, {
        userId: currentUser?.loginId || targetUser.loginId,
        userName: currentUser?.name || targetUser.name,
        targetSubjectId: targetUser.id,
        targetSubjectName: targetUser.name
      }).catch(console.error);

      if ((currentUser?.role === 'ADMIN' || isSystemDeveloperUser(currentUser)) && !sessionStorage.getItem('original_admin_user') && currentUser) {
        sessionStorage.setItem('original_admin_user', signSessionUser(currentUser));
      }
      setCurrentUser(targetUser);
      sessionStorage.setItem('user', signSessionUser(targetUser));
    }
  };

  const hasPermission = (menuId: string, action: 'view' | 'save'): boolean => {
    if (!currentUser) return false;

    // 0. 퇴사 계정은 전사 모든 메뉴 권한 즉시 전면 차단
    if (currentUser.status === 'RETIRED') return false;

    // 0-1. 휴직 계정은 변경/저장 권한 원천 차단 (조회만 허용)
    if (currentUser.status === 'LEAVE_OF_ABSENCE' && action === 'save') return false;

    // 2. 단일 표준 단수형 메뉴 ID로 정규화
    const normMenuId = normalizeMenuId(menuId);

    // 최고관리자 및 시스템 개발자 계정 여부 판정
    const isDeveloper =
      isSystemDeveloperUser(currentUser) ||
      currentUser.loginId === 'admin' ||
      currentUser.id === 'sys-admin' ||
      currentUser.id === 'u-1' ||
      currentUser.name === '개발자' ||
      currentUser.department === '개발자';
    const isSuperAdmin = isDeveloper || currentUser.role === 'ADMIN';

    // 🛡️ [특급 보안] 테넌트가 사용하는 사이트(giyeon.ebro.run 등)에서는 테넌트 관리 메뉴 원천 차단 (오직 admin.ebro.run 전용)
    if (normMenuId === 'tenant_management') {
      return getDomainMode() === 'ADMIN' && isSuperAdmin;
    }

    // 1. 시스템 개발자 계정 및 최고관리자(ADMIN)는 모든 메뉴에 100% 무조건 권한 부여
    if (isSuperAdmin) return true;

    // 0-2. 🏢 [테넌트별 페이지 노출/숨김 격리 (일반 임직원 대상)]
    if (currentTenant) {
      const rawHidden = Array.isArray(currentTenant.hiddenPages) ? currentTenant.hiddenPages : [];
      const rawAllowed = Array.isArray(currentTenant.allowedPages) ? currentTenant.allowedPages : [];

      const normHiddenPages = rawHidden.map(p => normalizeMenuId(p));
      const normAllowedPages = rawAllowed.map(p => normalizeMenuId(p));

      // 1) hiddenPages에 포함된 메뉴는 테넌트 화면에서 전면 차단
      if (normHiddenPages.includes(normMenuId)) {
        return false;
      }

      // 2) allowedPages가 지정되어 있는 경우, 허용 목록에 없는 메뉴는 원천 차단 (대시보드 및 신규 영업일지/가용재고조회/현장정비동선관리 기본 개방 제외, 숨김은 hiddenPages에서 제어)
      if (
        normAllowedPages.length > 0 &&
        normMenuId !== 'dashboard' &&
        normMenuId !== 'sales_journal' &&
        normMenuId !== 'available_inventory' &&
        normMenuId !== 'as_route_tracking' &&
        !normAllowedPages.includes(normMenuId)
      ) {
        return false;
      }
    }

    // 2-1. 대시보드 및 가용재고조회는 기본 진입/열람 화면이므로 모든 임직원(영업부, 경영진, 출고팀 등)에게 조회 개방
    if (normMenuId === 'dashboard' || (normMenuId === 'available_inventory' && action === 'view')) {
      return true;
    }

    // 3. 사용자 정의 권한 명칭 상속 판정 (역할 기반 자동 상속 최우선 - 매트릭스 설정과 100% 일치)
    if (currentUser.customRoleId) {
      const userRolePerms = rolePermissions.filter(p => p.roleId === currentUser.customRoleId);
      if (userRolePerms.length > 0) {
        const rolePerm = userRolePerms.find(p => normalizeMenuId(p.menuId) === normMenuId);
        if (rolePerm) {
          return action === 'view' ? Boolean(rolePerm.canView) : Boolean(rolePerm.canSave);
        }
        if (
          normMenuId === 'sales_journal' ||
          normMenuId === 'available_inventory' ||
          normMenuId === 'as_route_tracking' ||
          normMenuId.startsWith('trade_') ||
          normMenuId === 'courier_dispatch'
        ) {
          const dept = currentUser.departmentId || currentUser.department;
          const fallbackRule = getRoleTemplatePermission(currentUser.role, dept, normMenuId, action);
          if (fallbackRule !== undefined) return fallbackRule;
        }
        return false;
      }
    }

    // 4. 사용자별 명시적 오버라이드(개인 예외 권한) 우선 판정
    const perm = permissions.find(p => 
      (p.userId === currentUser.id || (p as any).user_id === currentUser.id) && 
      normalizeMenuId(p.menuId) === normMenuId
    );
    if (perm) {
      return action === 'view' ? Boolean(perm.canView) : Boolean(perm.canSave);
    }

    // 5. 직무 템플릿 기반 자동 상속 판정
    const dept = currentUser.departmentId || currentUser.department;
    const templateRule = getRoleTemplatePermission(currentUser.role, dept, normMenuId, action);
    if (templateRule !== undefined) {
      return templateRule;
    }

    // 6. 엄격한 거부 우선: 정의되지 않은 메뉴는 전면 차단
    return false;
  };

  const updatePermissions = async (updated: MenuPermission[]) => {
    try {
      db.permissions = updated;
      if (supabase) {
        // DB 스키마 및 레거시 role/updatedAt NOT NULL 제약 조건 우회를 위해 타임스탬프 & 기본값 부여 (userId camelCase 단일 표준 적용)
        const nowStr = new Date().toISOString();
        const payload = updated.map(p => ({
          ...p,
          userId: p.userId,
          role: (p as any).role || 'USER',
          createdAt: p.createdAt || nowStr,
          updatedAt: nowStr
        }));

        const lastCommandInfo = `supabase.from('permissions').upsert(payload[${payload.length}건], { onConflict: 'id' })`;
        const samplePayloadJson = JSON.stringify(payload.slice(0, 2), null, 2);

        const { error } = await supabase.from('permissions').upsert(payload as any[], { onConflict: 'id' });
        if (error) {
          const isSchemaCacheOrColumnError = error.message?.includes("userId") || error.code === 'PGRST204' || error.code === 'PGRST200';
          const rawErrorDetails = 
            `■ [마지막 실행 시도 명령]: ${lastCommandInfo}\n` +
            `■ [PostgREST Raw Error]:\n` +
            `  - Code: ${error.code || 'N/A'}\n` +
            `  - Message: ${error.message || 'N/A'}\n` +
            `  - Details: ${error.details || 'N/A'}\n` +
            `  - Hint: ${error.hint || 'N/A'}\n\n` +
            `■ [시도된 페이로드 샘플 (최대 2건)]:\n${samplePayloadJson}\n\n` +
            `■ [조치 안내 (개발자 도구 패치 적용 또는 Supabase SQL Editor 실행 DDL)]:\n` +
            (isSchemaCacheOrColumnError
              ? `💡 원인: Supabase DB의 permissions 테이블 컬럼 미비 또는 PostgREST 스키마 캐시 미갱신 현상입니다.\n` +
                `1) [개발자 도구] ➔ [[개발] DB 데이터 업로더] 메뉴 하단의 [⚡ 패치 자동 적용 (DB 직접 실행)] 버튼 클릭\n` +
                `2) 또는 Supabase SQL Editor에서 아래 DDL 직접 실행:\n` +
                `   ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "userId" TEXT;\n` +
                `   NOTIFY pgrst, 'reload schema';`
              : `ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "userId" TEXT;\nNOTIFY pgrst, 'reload schema';`);

          throw new Error(rawErrorDetails);
        }
      }
      refreshAllData();
    } catch (err: any) {
      console.error('Update permissions error:', err);
      throw err;
    }
  };

  const updateOfficialMailConfig = async (configData: OfficialMailConfig) => {
    try {
      const nowIso = new Date().toISOString();
      const targetTenantId = configData.tenantId || currentTenant?.id || 'tenant-giyeonlift';
      const payload: OfficialMailConfig = { 
        ...configData, 
        id: configData.id || `cfg-${targetTenantId}`,
        tenantId: targetTenantId,
        googlePassword: configData.googlePassword ? (configData.googlePassword.startsWith('__EBRO_ENC__v1__') ? configData.googlePassword : encryptSecret(configData.googlePassword)) : '',
        gmailAppPassword: configData.gmailAppPassword ? (configData.gmailAppPassword.startsWith('__EBRO_ENC__v1__') ? configData.gmailAppPassword : encryptSecret(configData.gmailAppPassword)) : '',
        r2SecretAccessKey: configData.r2SecretAccessKey ? (configData.r2SecretAccessKey.startsWith('__EBRO_ENC__v1__') ? configData.r2SecretAccessKey : encryptSecret(configData.r2SecretAccessKey)) : '',
        updatedAt: nowIso 
      };

      const currentList = [...db.officialMailConfigs];
      const localIndex = currentList.findIndex(cfg => cfg.id === payload.id || cfg.tenantId === targetTenantId);
      if (localIndex >= 0) {
        currentList[localIndex] = payload;
      } else {
        currentList.push({ ...payload, createdAt: nowIso });
      }
      db.officialMailConfigs = currentList;
      localStorage.setItem('erp_officialMailConfigs', JSON.stringify(currentList));

      const targetTenant = db.tenants.find(t => t.id === targetTenantId);
      if (targetTenant) {
        const nextOfficialMailConfig = {
          ...((targetTenant.features as any)?.officialMailConfig || (targetTenant as any).officialMailConfig || {}),
          googleEmail: payload.googleEmail,
          googlePassword: payload.googlePassword,
          gmailAppPassword: payload.gmailAppPassword,
          smtpProvider: payload.smtpProvider,
          smtpHost: payload.smtpHost,
          smtpPort: payload.smtpPort,
          isDevMode: payload.isDevMode,
          updatedAt: nowIso
        };
        const nextR2Config = {
          ...((targetTenant.features as any)?.r2Config || (targetTenant as any).r2Config || {}),
          r2AccountId: payload.r2AccountId ?? ((targetTenant.features as any)?.r2Config?.r2AccountId || ''),
          r2BucketName: payload.r2BucketName ?? ((targetTenant.features as any)?.r2Config?.r2BucketName || ''),
          r2AccessKeyId: payload.r2AccessKeyId ?? ((targetTenant.features as any)?.r2Config?.r2AccessKeyId || ''),
          r2SecretAccessKey: payload.r2SecretAccessKey || ((targetTenant.features as any)?.r2Config?.r2SecretAccessKey || ''),
          r2PublicDomain: payload.r2PublicDomain ?? ((targetTenant.features as any)?.r2Config?.r2PublicDomain || ''),
        };
        db.updateRow<Tenant>('tenants', targetTenantId, {
          officialMailConfig: nextOfficialMailConfig,
          r2Config: nextR2Config,
          features: {
            ...(targetTenant.features || {
              telegramBot: true,
              callRecordingStt: true,
              kakaoContract: true,
              autoTaxInvoice: true,
              voiceAssistance: true
            }),
            officialMailConfig: nextOfficialMailConfig,
            r2Config: nextR2Config
          } as any
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('updateOfficialMailConfig Error:', err);
      showErrorModal(`⚠️ 공식메일설정 원격 DB 저장 실패:\n\n${err?.message || err}`, '원격 DB 저장 오류');
      throw err;
    }
  };

  // ── 사용자 정의 권한 명칭 및 권한 관리 뮤테이터 ──
  const saveCustomRole = async (role: CustomRole) => {
    try {
      const now = new Date().toISOString();
      const updated = { ...role, updatedAt: now };
      if (!updated.createdAt) updated.createdAt = now;

      const list = [...db.customRoles];
      const idx = list.findIndex(r => r.id === role.id);
      if (idx > -1) {
        list[idx] = updated;
      } else {
        list.push(updated);
      }
      db.customRoles = list;
      setCustomRoles([...list]);

      await db.upsertRows('customRoles', [updated]);
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('saveCustomRole error:', err);
      showErrorModal(`권한 명칭 저장 실패: ${err?.message || err}`);
      throw err;
    }
  };

  const deleteCustomRole = async (roleId: string) => {
    try {
      // 1. 해당 역할의 세부 메뉴 권한 DB 및 로컬 삭제
      const targetPerms = db.rolePermissions.filter(p => p.roleId === roleId);
      for (const perm of targetPerms) {
        db.deleteRow('rolePermissions', perm.id);
      }

      // 2. 해당 역할을 상속받은 사용자들의 customRoleId 해제
      const affectedUsers = db.users.filter(u => u.customRoleId === roleId);
      for (const u of affectedUsers) {
        db.updateRow('users', u.id, { ...u, customRoleId: undefined } as any);
      }

      // 3. custom_roles 본체 DB 및 로컬 삭제 (db.customRoles 사전 필터링으로 인해 deleteRow가 스킵되지 않도록 정식 호출)
      db.deleteRow('customRoles', roleId);
      await db.awaitPendingWrites();

      setCustomRoles([...db.customRoles]);
      setRolePermissions([...db.rolePermissions]);
      setUsers([...db.users]);
      refreshAllData();
    } catch (err: any) {
      console.error('deleteCustomRole error:', err);
      showErrorModal(`권한 명칭 삭제 실패: ${err?.message || err}`);
      throw err;
    }
  };

  const saveRolePermissions = async (roleId: string, perms: { menuId: string; canView: boolean; canSave: boolean }[]) => {
    try {
      const now = new Date().toISOString();

      // 🛡️ [FK 무결성 보장] role_permissions 저장 전 부모 테이블에 해당 roleId가 반드시 존재하도록 선행 동기화
      const existingRoles = db.customRoles && db.customRoles.length > 0 ? [...db.customRoles] : [];
      if (!existingRoles.some(r => r.id === roleId)) {
        existingRoles.push({
          id: roleId,
          name: roleId,
          isSystem: roleId.startsWith('role_'),
          createdAt: now,
          updatedAt: now
        });
        db.customRoles = existingRoles;
        setCustomRoles([...existingRoles]);
      }
      await db.upsertRows('customRoles', existingRoles);
      await db.awaitPendingWrites();

      const otherPerms = db.rolePermissions.filter(p => p.roleId !== roleId);
      const newPerms: RolePermission[] = perms.map(p => ({
        id: `roleperm-${roleId}-${normalizeMenuId(p.menuId)}`,
        roleId,
        menuId: normalizeMenuId(p.menuId),
        canView: p.canView,
        canSave: p.canSave,
        createdAt: now,
        updatedAt: now
      }));
      const combined = [...otherPerms, ...newPerms];
      db.rolePermissions = combined;
      setRolePermissions([...combined]);

      await db.upsertRows('rolePermissions', newPerms);

      // 🔄 해당 roleId를 보유한 임직원들의 permissions(805행 호환 테이블)도 100% 동기화
      const affectedUsers = db.users.filter(u => u.customRoleId === roleId);
      if (affectedUsers.length > 0) {
        const syncPerms: MenuPermission[] = [];
        affectedUsers.forEach(u => {
          newPerms.forEach(np => {
            syncPerms.push({
              id: `perm-${u.id}-${np.menuId}`,
              userId: u.id,
              menuId: np.menuId,
              role: (u.role || 'USER') as any,
              canView: np.canView,
              canSave: np.canSave,
              createdAt: now,
              updatedAt: now
            });
          });
        });
        if (syncPerms.length > 0) {
          const validUserIds = new Set(db.users.map(u => u.id));
          const otherUserPerms = db.permissions.filter(p => !affectedUsers.some(au => au.id === p.userId));
          const updatedDbPerms = [...otherUserPerms, ...syncPerms].filter(p => p.userId && validUserIds.has(p.userId));
          db.permissions = updatedDbPerms;
          setPermissions([...updatedDbPerms]);
          await db.upsertRows('permissions', syncPerms);
        }
      }

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('saveRolePermissions error:', err);
      showErrorModal(`역할 메뉴 권한 저장 실패: ${err?.message || err}`);
      throw err;
    }
  };

  const assignUserRole = async (userId: string, customRoleId: string | null) => {
    try {
      const list = [...db.users];
      const idx = list.findIndex(u => u.id === userId);
      if (idx > -1) {
        if (customRoleId && db.customRoles && db.customRoles.length > 0) {
          await db.upsertRows('customRoles', db.customRoles);
          await db.awaitPendingWrites();
        }
        const updatedUser = { 
          ...list[idx], 
          customRoleId: customRoleId || undefined, 
          updatedAt: new Date().toISOString() 
        };
        list[idx] = updatedUser;
        db.users = list;
        setUsers([...list]);

        if (currentUser?.id === userId) {
          setCurrentUser(updatedUser);
        }

        await db.upsertRows('users', [updatedUser]);

        // 🔄 상속된 역할의 권한을 permissions 테이블(레거시/글로벌 호환)에도 1:1 동기화
        if (customRoleId) {
          const now = new Date().toISOString();
          const roleRules = db.rolePermissions.filter(p => p.roleId === customRoleId);
          if (roleRules.length > 0) {
            const userPerms: MenuPermission[] = roleRules.map(rp => ({
              id: `perm-${userId}-${rp.menuId}`,
              userId,
              menuId: rp.menuId,
              role: (updatedUser.role || 'USER') as any,
              canView: rp.canView,
              canSave: rp.canSave,
              createdAt: now,
              updatedAt: now
            }));
            const otherUserPerms = db.permissions.filter(p => p.userId !== userId);
            const mergedPerms = [...otherUserPerms, ...userPerms];
            db.permissions = mergedPerms;
            setPermissions([...mergedPerms]);
            await db.upsertRows('permissions', userPerms);
          }
        }

        await db.awaitPendingWrites();
        refreshAllData();
      }
    } catch (err: any) {
      console.error('assignUserRole error:', err);
      showErrorModal(`직원 권한 명칭 상속 배정 실패: ${err?.message || err}`);
      throw err;
    }
  };

  const saveUser = (userData: Omit<User, 'id' | 'createdAt'> & { id?: string }) => {
    // 🛡️ 비밀번호 해싱 처리 (평문 비밀번호를 SHA-256으로 변환하여 DB 평문 노출 방어)
    const sanitizedData = {
      ...userData,
      passwordHash: userData.passwordHash ? hashPassword(userData.passwordHash) : userData.passwordHash
    };

    if (sanitizedData.id) {
      db.updateRow<User>('users', sanitizedData.id, sanitizedData);
    } else {
      // 🛡️ [수량 한도 제한 인터셉터]
      const maxUsers = currentTenant?.subscription?.maxUsers;
      if (typeof maxUsers === 'number' && maxUsers > 0) {
        if (users.length >= maxUsers) {
          const errMsg = `최대 사용자 등록 한도(${maxUsers}명)를 초과했습니다.`;
          showErrorModal(errMsg, '구독 한도 초과');
          throw new Error(errMsg);
        }
      }

      // 신규 임직원 생성
      const newUser = db.insertRow<User>('users', { ...sanitizedData, createdAt: new Date().toISOString() });
      
      // ADMIN 역할 신규 임직원은 모든 메뉴에 대해 기본 전체 권한(canView+canSave=true) 레코드 자동 생성
      if (sanitizedData.role === 'ADMIN' && newUser?.id) {
        const allMenuIds = getAllSystemMenuIds();
        allMenuIds.forEach(menuId => {
          const exists = db.permissions.some(p => p.userId === newUser.id && p.menuId === menuId);
          if (!exists) {
            const perm = createMenuPermission(newUser.id, menuId, true, true);
            db.insertRow<MenuPermission>('permissions', perm);
          }
        });
      }
    }
    refreshAllData();
  };

  const saveCustomer = async (cust: Omit<Customer, 'id' | 'createdAt'> & { id?: string }): Promise<Customer> => {
    let res: Customer;
    const existingCust = cust.id ? db.customers.find(c => c.id === cust.id) : null;
    if (existingCust) {
      res = db.updateRow<Customer>('customers', existingCust.id, cust) as Customer;

      // 상호(고객사명) 변경 시 연관 테이블(contracts, deliveries, asset_inout_logs)의 고객사명 참조 자동 동기화
      if (res.name && existingCust.name !== res.name) {
        const oldName = existingCust.name;
        const newName = res.name;
        const linkedContracts = db.contracts.filter(c => c.customerId === existingCust.id);
        const linkedContractIds = new Set(linkedContracts.map(c => c.id));
        linkedContracts.forEach(c => {
          if (c.customerName !== newName) {
            db.updateRow<Contract>('contracts', c.id, { customerName: newName });
          }
        });
        const linkedPredContracts = db.contracts.filter(c => c.predecessorCustomerId === existingCust.id && c.predecessorCustomerName !== newName);
        linkedPredContracts.forEach(c => {
          db.updateRow<Contract>('contracts', c.id, { predecessorCustomerName: newName });
        });
        const linkedDeliveries = db.deliveries.filter(d => (d as any).customerId === existingCust.id || (d.contractId && linkedContractIds.has(d.contractId)) || d.billableCustomerId === existingCust.id);
        const linkedDeliveryIds = new Set(linkedDeliveries.map(d => d.id));
        linkedDeliveries.forEach(d => {
          const patch: Partial<Delivery> = {};
          if (d.cargoItems) {
            try {
              const items = JSON.parse(d.cargoItems);
              let changed = false;
              if (Array.isArray(items)) {
                items.forEach(it => {
                  if (it?.requestMeta && it.requestMeta.customerName !== newName) {
                    it.requestMeta.customerName = newName;
                    changed = true;
                  }
                });
              }
              if (changed) patch.cargoItems = JSON.stringify(items);
            } catch { /* ignore */ }
          }
          if (d.destinationAddress && d.destinationAddress.startsWith(`${oldName} (`)) {
            patch.destinationAddress = `${newName}${d.destinationAddress.slice(oldName.length)}`;
          }
          if (d.originAddress && d.originAddress.startsWith(`${oldName} (`)) {
            patch.originAddress = `${newName}${d.originAddress.slice(oldName.length)}`;
          }
          if (Object.keys(patch).length > 0) {
            db.updateRow<Delivery>('deliveries', d.id, patch);
          }
        });
        const linkedInOutLogs = db.assetInOutLogs.filter(l => (l.customerId === existingCust.id || (l.deliveryId && linkedDeliveryIds.has(l.deliveryId))) && l.customerName && !l.customerName.includes('(임차처)') && l.customerName !== newName);
        linkedInOutLogs.forEach(l => {
          db.updateRow<AssetInOutLog>('asset_inout_logs', l.id, { customerName: newName });
        });
        const linkedJournals = (db.salesJournals || []).filter(j => j.customerId === existingCust.id && j.customerName !== newName);
        linkedJournals.forEach(j => {
          db.updateRow<SalesJournal>('salesJournals', j.id, { customerName: newName });
        });
      }

      // 고객 정보 보완 완료 시 관련 할 일 자동 상계 처리
      const relatedTodos = db.todos.filter(
        t => t.relatedEntityId === cust.id && t.type === 'MISSING_INFO' && !t.isCompleted
      );
      if (relatedTodos.length > 0) {
        const isInfoComplete = 
          cust.bizRegNo && cust.bizRegNo !== '미상' && cust.bizRegNo.trim() !== '' &&
          cust.representative && cust.representative !== '미상' && cust.representative.trim() !== '' &&
          cust.repContact && cust.repContact !== '미상' && cust.repContact.trim() !== '' &&
          cust.address && cust.address !== '미상' && cust.address.trim() !== '' &&
          cust.repEmail && cust.repEmail !== '미상' && cust.repEmail.trim() !== '';

        if (isInfoComplete) {
          relatedTodos.forEach(todo => {
            db.updateRow<Todo>('todos', todo.id, { isCompleted: true });
          });
        }
      }
    } else {
      res = db.insertRow<Customer>('customers', { ...cust, createdAt: new Date().toISOString() }) as Customer;
    }

    if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
      try {
        await db.pendingWrites[db.pendingWrites.length - 1];
      } catch (err) {
        console.error("Supabase write await error:", err);
        throw err;
      }
    }

    refreshAllData();
    return res;
  };

  const deleteCustomer = async (id: string): Promise<boolean> => {
    const targetCust = db.customers.find(c => c.id === id);
    const custName = targetCust?.name || id;

    // 1. 고객사에 속한 모든 고객 현장 식별
    const custSites = db.sites.filter(s => s.customerId === id);
    const custSiteIds = new Set(custSites.map(s => s.id));

    // 2. 해당 고객사 직접 계약 또는 해당 고객사 현장에 체결된 계약 전수 검사
    const custContracts = db.contracts.filter(c =>
      c.customerId === id ||
      (c.siteId && custSiteIds.has(c.siteId))
    );
    const activeContracts = custContracts.filter(c => c.status === 'ACTIVE' || c.status === 'EXTENDED');

    // 3. 계약/장비가 연결되어 삭제 불가능한 고객 현장 식별
    const lockedSites = custSites.filter(s =>
      db.contracts.some(c => c.siteId === s.id) ||
      db.assets.some(a => a.currentSiteId === s.id)
    );

    // 4. 현재 해당 고객사 또는 해당 고객사 현장에 배정/투입된 장비 검사
    const custAssets = db.assets.filter(a =>
      a.currentCustomerId === id ||
      (a.currentSiteId && custSiteIds.has(a.currentSiteId))
    );

    // 5. 청구서 및 수납/미수금 이력 검사
    const custBillings = db.billings.filter(b => b.customerId === id);
    const custReceivables = (db.receivables || []).filter((r: any) => r.customerId === id);

    // ⚠️ 계약, 보호 대상 현장, 투입 장비, 청구 이력 중 하나라도 존재하면 고객 삭제 원천 차단 및 안내 모달 출력
    if (custContracts.length > 0 || lockedSites.length > 0 || custAssets.length > 0 || custBillings.length > 0 || custReceivables.length > 0) {
      const sampleContract = activeContracts[0] || custContracts[0];
      const lockedSiteNames = lockedSites.slice(0, 3).map(s => s.name);

      let detailLines = `⚠️ [${custName}] 고객사를 삭제할 수 없습니다.\n\n`;
      detailLines += `■ 삭제 불가 사유 (연결 데이터 보호):\n`;
      if (custContracts.length > 0) {
        detailLines += `• 연결된 계약 이력: 총 ${custContracts.length}건 (유지/진행중 ${activeContracts.length}건 / 종료 ${custContracts.length - activeContracts.length}건)\n`;
        if (sampleContract) {
          detailLines += `  - 대표 계약번호: ${sampleContract.contractNo || sampleContract.id}\n`;
        }
      }
      if (lockedSites.length > 0) {
        detailLines += `• 계약/장비가 유지 중인 고객 현장: ${lockedSites.length}곳 (${lockedSiteNames.join(', ')}${lockedSites.length > 3 ? ' 외' : ''})\n`;
      }
      if (custAssets.length > 0) {
        detailLines += `• 현재 배정/투입 중인 렌탈 장비: ${custAssets.length}대\n`;
      }
      if (custBillings.length > 0 || custReceivables.length > 0) {
        detailLines += `• 청구 및 정산 원장 이력: 청구 ${custBillings.length}건 / 채권 ${custReceivables.length}건\n`;
      }
      detailLines += `\n■ 조치 안내:\n`;
      detailLines += `• 유지 중인 계약이 있는 고객 현장이 보호되는 상태에서 상위 고객사를 삭제하면 현장 및 계약·청구 원장이 연쇄 유실되거나 고아 레코드가 발생하므로 삭제가 엄격히 제한됩니다.\n`;
      detailLines += `• 거래가 종료된 고객사는 영구 삭제 대신 거래 상태(신규제한/거래중지) 변경 기능을 이용해 주십시오.`;

      showErrorModal(detailLines, '고객사 삭제 불가 (유지 계약 및 현장 보호)');
      return false;
    }

    // 6. 계약/청구 이력이 전혀 없는 순수 오등록 고객사인 경우 하위 빈 현장 및 담당자 정리 후 삭제
    for (const s of custSites) {
      db.deleteRow('sites', s.id);
    }
    const custContacts = db.contacts.filter(c => c.customerId === id);
    for (const cc of custContacts) {
      db.deleteRow('contacts', cc.id);
    }

    db.deleteRow('customers', id);
    await db.awaitPendingWrites();
    refreshAllData();
    return true;
  };

  const saveContact = async (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }): Promise<CustomerContact> => {
    let savedObj: CustomerContact;
    const existingContact = contact.id ? db.contacts.find(c => c.id === contact.id) : null;
    if (existingContact) {
      const res = db.updateRow<CustomerContact>('contacts', existingContact.id, contact as CustomerContact);
      if (!res) throw new Error("Contact update failed (not found).");
      savedObj = res;
    } else {
      savedObj = db.insertRow<CustomerContact>('contacts', {
        ...contact,
        isActive: contact.isActive !== undefined ? contact.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<CustomerContact, 'id'>);
    }

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error("Supabase write await error:", err);
      showErrorModal(err?.message || String(err));
      throw err;
    }

    refreshAllData();
    return savedObj;
  };

  const deleteContact = async (id: string) => {
    // ✅ 고아 레코드 방지: 계약에 등록된 담당자 삭제 차단
    const linkedContracts = db.contracts.filter(c => c.contactId === id);
    if (linkedContracts.length > 0) {
      showErrorModal(
        `⚠️ 해당 담당자를 삭제할 수 없습니다.\n\n연결된 계약이 ${linkedContracts.length}건 존재합니다.\n계약에서 담당자를 먼저 변경/해제하십시오.`,
        '담당자 삭제 불가'
      );
      return;
    }
    db.deleteRow('contacts', id);
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error("Supabase write await error:", err);
      showErrorModal(err?.message || String(err));
      throw err;
    }
    refreshAllData();
  };

  
  const saveSiteMaster = async (s: Partial<SiteMaster>, options?: { propagateToLinkedSites?: boolean }): Promise<SiteMaster> => {
    // [헌장 1.5] 옵션 그룹에는 address를 일절 저장하지 않고 현장명(그룹명)과 옵션 정보만 저장
    const cleanPayload: Partial<SiteMaster> = {
      ...s,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    delete (cleanPayload as any).address;

    let savedMaster: SiteMaster;
    const existingMaster = s.id ? db.siteMasters.find(m => m.id === s.id) : null;
    if (existingMaster) {
      savedMaster = db.updateRow<SiteMaster>('siteMasters', existingMaster.id, cleanPayload as any) as SiteMaster;
    } else {
      savedMaster = db.insertRow<SiteMaster>('siteMasters', {
        ...cleanPayload,
        createdAt: new Date().toISOString(),
      } as any);
    }

    // 옵션 그룹을 상속받은 연결된 고객현장에 옵션만 일괄 전파 (현장명/주소/운송료청구기준은 절대 덮어쓰지 않음)
    if (options?.propagateToLinkedSites && savedMaster?.id) {
      const linkedSites = db.sites.filter(site => site.siteMasterId === savedMaster.id);
      for (const ls of linkedSites) {
        const nextCheckedSpecs: Record<string, any> = savedMaster.checkedSpecs ? { ...savedMaster.checkedSpecs } : (ls.checkedSpecs || {});
        if (ls.checkedSpecs && (ls.checkedSpecs as any).__freightBillingStandard && !nextCheckedSpecs.__freightBillingStandard) {
          nextCheckedSpecs.__freightBillingStandard = (ls.checkedSpecs as any).__freightBillingStandard;
        }
        db.updateRow<CustomerSite>('sites', ls.id, {
          paidOptions: savedMaster.paidOptions ?? ls.paidOptions ?? '',
          protection: savedMaster.protection ?? ls.protection ?? 'NONE',
          attachments: savedMaster.attachments ?? ls.attachments ?? '',
          checkedSpecs: nextCheckedSpecs,
          updatedAt: new Date().toISOString(),
        } as any);
      }
    }

    await db.awaitPendingWrites();
    refreshAllData();
    return savedMaster;
  };

  const deleteSiteMaster = async (id: string) => {
    // 옵션 그룹 삭제 시 고객 현장 자체는 절대 삭제하지 않고, 참조만 해제함
    const linkedSites = db.sites.filter(s => s.siteMasterId === id);
    for (const ls of linkedSites) {
      db.updateRow('sites', ls.id, { ...ls, siteMasterId: null } as any);
    }
    const linkedContacts = db.contacts.filter((c: any) => c.siteMasterId === id);
    for (const lc of linkedContacts) {
      db.updateRow('contacts', lc.id, { ...lc, siteMasterId: undefined } as any);
    }
    db.deleteRow('siteMasters', id);
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const saveSite = async (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => {
    // [헌장 1.5] 고객 현장 직접 귀속 및 옵션 그룹 상속
    const master = site.siteMasterId ? db.siteMasters.find(m => m.id === site.siteMasterId) : null;

    const sitePayload: Partial<CustomerSite> = {
      ...site,
      name: (site.name || '').trim(),
      address: (site.address || '').trim(),
      isActive: site.isActive !== undefined ? site.isActive : true,
      siteMasterId: site.siteMasterId || null,
      paidOptions: site.paidOptions !== undefined ? site.paidOptions : (master?.paidOptions || ''),
      protection: site.protection !== undefined ? site.protection : (master?.protection || 'NONE'),
      attachments: site.attachments !== undefined ? site.attachments : (master?.attachments || ''),
      checkedSpecs: site.checkedSpecs !== undefined ? site.checkedSpecs : (master?.checkedSpecs ? { ...master.checkedSpecs } : {}),
      updatedAt: new Date().toISOString(),
    };

    let resultSite: CustomerSite;
    const existingSite = site.id ? db.sites.find(s => s.id === site.id) : null;
    if (existingSite) {
      resultSite = db.updateRow<CustomerSite>('sites', existingSite.id, sitePayload as CustomerSite) as CustomerSite;
    } else {
      resultSite = db.insertRow<CustomerSite>('sites', {
        ...sitePayload,
        createdAt: new Date().toISOString()
      } as Omit<CustomerSite, 'id'>);
    }

    if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
      try {
        await Promise.all(db.pendingWrites);
        db.pendingWrites = [];
      } catch (err) {
        console.error("Supabase write await error:", err);
        throw err;
      }
    }

    refreshAllData();
    return resultSite;
  };

  const deleteSite = async (id: string): Promise<boolean> => {
    const targetSite = db.sites.find(s => s.id === id);

    // ✅ 고아 레코드 방지: 해당 고객 현장과 연결된 계약 또는 투입 장비가 있으면 삭제 차단
    const linkedContracts = db.contracts.filter(c => c.siteId === id);
    const linkedAssets = db.assets.filter(a => a.currentSiteId === id);
    if (linkedContracts.length > 0 || linkedAssets.length > 0) {
      const activeCnt = linkedContracts.filter(c => c.status === 'ACTIVE' || c.status === 'EXTENDED').length;
      const siteDisplayName = targetSite?.name || id;
      showErrorModal(
        `⚠️ [${siteDisplayName}] 고객 현장을 삭제할 수 없습니다.\n\n` +
        (linkedContracts.length > 0 ? `■ 연결된 계약: 총 ${linkedContracts.length}건 (유지중 ${activeCnt}건)\n` : '') +
        (linkedAssets.length > 0 ? `■ 투입 중인 장비: ${linkedAssets.length}대\n` : '') +
        `\n계약 이력이나 장비가 배정된 고객 현장은 삭제 대신 [완공/종료] 상태 변경을 이용해 주십시오.`,
        '고객 현장 삭제 불가'
      );
      return false;
    }
    db.deleteRow('sites', id);
    await db.awaitPendingWrites();
    refreshAllData();
    return true;
  };

  const saveProduct = async (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => {
    let result;
    const prevProduct = prod.id ? db.products.find(p => p.id === prod.id) : undefined;
    const oldModelName = prevProduct?.modelName?.trim();
    const newModelName = prod.modelName?.trim();
    const normalizedProd = {
      ...prod,
      modelName: newModelName || prod.modelName
    };

    if (prod.id) {
      result = db.updateRow<Product>('products', prod.id, normalizedProd as Product);
    } else {
      result = db.insertRow<Product>('products', {
        ...normalizedProd,
        isActive: prod.isActive !== undefined ? prod.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<Product, 'id'>);
    }
    
    try {
      await db.awaitPendingWrites();

      // 자산은 제품의 모델명을 상속받으므로 제품 모델명이 변경(대소문자 변경 포함)되면 하위 자산 및 종속 테이블에 즉시 자동 상속/동기화
      if (newModelName) {
        const nowIso = new Date().toISOString();
        const newUpper = newModelName.toUpperCase();
        const shouldInheritModel = (m?: string) => {
          if (!m) return false;
          if (m === newModelName) return false;
          if (oldModelName && m === oldModelName) return true;
          if (m.trim().toUpperCase() === newUpper) return true;
          return false;
        };

        const updatedAssetIds: string[] = [];
        const nextAssets = db.assets.map(a => {
          if (shouldInheritModel(a.modelName)) {
            updatedAssetIds.push(a.id);
            return { ...a, modelName: newModelName, updatedAt: nowIso };
          }
          return a;
        });
        if (updatedAssetIds.length > 0) db.assets = nextAssets;

        const updatedCaIds: string[] = [];
        const nextCas = db.contractAssets.map(ca => {
          if (shouldInheritModel(ca.expectedModel)) {
            updatedCaIds.push(ca.id);
            return { ...ca, expectedModel: newModelName, updatedAt: nowIso };
          }
          return ca;
        });
        if (updatedCaIds.length > 0) db.contractAssets = nextCas;

        const updatedRepairIds: string[] = [];
        const nextRepairs = db.repairs.map(r => {
          if (shouldInheritModel(r.modelName)) {
            updatedRepairIds.push(r.id);
            return { ...r, modelName: newModelName, updatedAt: nowIso };
          }
          return r;
        });
        if (updatedRepairIds.length > 0) db.repairs = nextRepairs;

        const updatedLogIds: string[] = [];
        const nextLogs = db.assetInOutLogs.map(l => {
          if (shouldInheritModel(l.modelName)) {
            updatedLogIds.push(l.id);
            return { ...l, modelName: newModelName, updatedAt: nowIso } as AssetInOutLog;
          }
          return l;
        });
        if (updatedLogIds.length > 0) db.assetInOutLogs = nextLogs;

        if (supabase) {
          if (updatedAssetIds.length > 0) {
            const { error: astErr } = await supabase
              .from('assets')
              .update({ modelName: newModelName, updatedAt: nowIso })
              .in('id', updatedAssetIds);
            if (astErr) throw astErr;
          }
          if (updatedCaIds.length > 0) {
            const { error: caErr } = await supabase
              .from('contract_assets')
              .update({ expectedModel: newModelName, updatedAt: nowIso })
              .in('id', updatedCaIds);
            if (caErr) throw caErr;
          }
          if (updatedRepairIds.length > 0) {
            const { error: repErr } = await supabase
              .from('repairs')
              .update({ modelName: newModelName, updatedAt: nowIso })
              .in('id', updatedRepairIds);
            if (repErr) throw repErr;
          }
          if (updatedLogIds.length > 0) {
            const { error: logErr } = await supabase
              .from('asset_inout_logs')
              .update({ modelName: newModelName })
              .in('id', updatedLogIds);
            if (logErr) throw logErr;
          }
        }
      }
    } catch (err: any) {
      console.error("Supabase write await error:", err);
      showErrorModal(`⚠️ 제품 카탈로그 저장 중 DB 동기화 오류가 발생했습니다:\n${err.message || err.details || JSON.stringify(err)}`, 'DB 동기화 오류');
      throw err;
    }
    
    refreshAllData();
    return result;
  };

  // 💡 [신규] 입고 검수 필요 항목 및 점수 기준 CUD
  const saveInspectionChecklistItem = async (itemData: Omit<InspectionChecklistItem, 'id' | 'createdAt'> & { id?: string }) => {
    if (itemData.id) {
      db.updateRow<InspectionChecklistItem>('inspectionChecklistItems', itemData.id, {
        ...itemData
      });
    } else {
      const nextId = db.generateNextId('inspectionChecklistItems', db.inspectionChecklistItems);
      db.insertRow<InspectionChecklistItem>('inspectionChecklistItems', {
        ...itemData,
        id: nextId,
        createdAt: new Date().toISOString()
      });
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  const deleteInspectionChecklistItem = async (id: string) => {
    db.deleteRow('inspectionChecklistItems', id);
    await db.awaitPendingWrites(); refreshAllData(); };

  const saveEquipmentManual = async (manualData: Omit<EquipmentManual, 'id' | 'createdAt'> & { id?: string }) => {
    if (manualData.id) {
      db.updateRow<EquipmentManual>('equipmentManuals', manualData.id, {
        ...manualData,
        updatedAt: new Date().toISOString()
      });
    } else {
      const nextId = db.generateNextId('equipmentManuals', db.equipmentManuals);
      db.insertRow<EquipmentManual>('equipmentManuals', {
        ...manualData,
        id: nextId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  const deleteEquipmentManual = async (id: string) => {
    db.deleteRow('equipmentManuals', id);
    await db.awaitPendingWrites(); refreshAllData(); };

  // 🏷️ 전사 표준 옵션 마스터 CUD
  const saveStandardOption = async (optionData: Omit<StandardOption, 'id' | 'createdAt'> & { id?: string }): Promise<StandardOption> => {
    const sanitizedName = (optionData.name || '').replace(/\s*,\s*/g, '·').trim();
    const cleanData = { ...optionData, name: sanitizedName };
    let result: StandardOption;
    if (cleanData.id) {
      result = db.updateRow<StandardOption>('standardOptions', cleanData.id, {
        ...cleanData,
        updatedAt: new Date().toISOString()
      }) as StandardOption;
    } else {
      const nextId = 'opt_' + Date.now();
      result = db.insertRow<StandardOption>('standardOptions', {
        ...cleanData,
        id: nextId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }) as StandardOption;
    }
    await db.awaitPendingWrites();
    refreshAllData();
    return result;
  };

  const deleteStandardOption = async (id: string): Promise<void> => {
    db.deleteRow('standardOptions', id);
    await db.awaitPendingWrites(); refreshAllData(); };

  // 📊 월간 결산 손익계산서 영구 발행 및 보존
  const saveMonthlyIncomeStatement = async (stmt: MonthlyIncomeStatement): Promise<MonthlyIncomeStatement> => {
    const existing = db.monthlyIncomeStatements.find(s => s.targetYm === stmt.targetYm || s.id === stmt.id);
    let saved: MonthlyIncomeStatement;
    if (existing) {
      saved = db.updateRow<MonthlyIncomeStatement>('monthlyIncomeStatements', existing.id, {
        ...stmt,
        updatedAt: new Date().toISOString()
      }) as MonthlyIncomeStatement;
    } else {
      saved = db.insertRow<MonthlyIncomeStatement>('monthlyIncomeStatements', {
        ...stmt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }) as MonthlyIncomeStatement;
    }
    await db.awaitPendingWrites();
    refreshAllData();
    return saved;
  };

  // 📝 영업일지 저장 및 삭제 (Groq LLM 추출 데이터 + 원문 통합 보관)
  const saveSalesJournal = async (journal: Omit<SalesJournal, 'id' | 'createdAt'> & { id?: string }): Promise<SalesJournal> => {
    const existing = journal.id ? (db.salesJournals || []).find(j => j.id === journal.id) : null;
    const nowIso = new Date().toISOString();
    let saved: SalesJournal;
    if (existing) {
      saved = db.updateRow<SalesJournal>('salesJournals', existing.id, {
        ...journal,
        updatedAt: nowIso
      }) as SalesJournal;
    } else {
      saved = db.insertRow<SalesJournal>('salesJournals', {
        ...journal,
        createdAt: nowIso,
        updatedAt: nowIso,
        tenant_id: currentTenant?.id || 'giyeun'
      }) as SalesJournal;
    }
    await db.awaitPendingWrites();
    refreshAllData();
    return saved;
  };

  const deleteSalesJournal = async (id: string): Promise<void> => {
    db.deleteRow('salesJournals', id);
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const normalizeManufactureYear = (raw?: string | number | null): string => {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return '';
    const exactFourDigits = trimmed.match(/^(\d{4})\s*\.?$/);
    if (exactFourDigits) return `${exactFourDigits[1]}년`;
    if (/^\d{4}(?!\d)/.test(trimmed) && !trimmed.includes('년')) {
      return trimmed.replace(/^(\d{4})\s*[.\-/]?\s*/, '$1년 ').trim();
    }
    return trimmed;
  };

  const saveAsset = async (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    let result;
    const existingAsset = asset.id ? db.assets.find(a => a.id === asset.id) : null;
    const isNew = !existingAsset;
    const resolvedMfg = db.resolveAssetManufacturer(asset.modelName || existingAsset?.modelName, asset.manufacturer || existingAsset?.manufacturer);
    const resolvedManufactureYear = normalizeManufactureYear(asset.manufactureYear ?? existingAsset?.manufactureYear ?? '');
    const normalizedAsset = {
      ...asset,
      manufacturer: resolvedMfg,
      manufactureYear: resolvedManufactureYear,
      yard: asset.yard || existingAsset?.yard || '용인'
    };

    if (existingAsset) {
      result = db.updateRow<Asset>('assets', existingAsset.id, normalizedAsset as Asset);
    } else {
      // 🛡️ [수량 한도 제한 인터셉터]
      const maxAssets = currentTenant?.subscription?.maxAssets;
      if (typeof maxAssets === 'number' && maxAssets > 0) {
        if (assets.length >= maxAssets) {
          const errMsg = `최대 장비 등록 한도(${maxAssets}대)를 초과했습니다.`;
          showErrorModal(errMsg, '구독 한도 초과');
          throw new Error(errMsg);
        }
      }

      result = db.insertRow<Asset>('assets', {
        ...normalizedAsset,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Omit<Asset, 'id'>);
    }

    if (result) {
      // 1. 신규 취득 이력 자동 기록
      if (isNew) {
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: result.id,
          assetNo: result.assetNo,
          modelName: result.modelName,
          type: 'INBOUND',
          eventDate: result.acquisitionDate || new Date().toISOString().split('T')[0],
          memo: `[자산 취득 입고] 대장 등록 (취득일: ${result.acquisitionDate || '-'} / 취득가: ${(result.acquisitionPrice || 0).toLocaleString()}원 / 임차/구입처: ${result.renter || '-'})`,
          createdAt: new Date().toISOString()
        });
      }

      // 2. 자산 매각 이력 자동 기록
      if (result.status === 'SOLD' && (!existingAsset || existingAsset.status !== 'SOLD')) {
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: result.id,
          assetNo: result.assetNo,
          modelName: result.modelName,
          type: 'OUTBOUND',
          eventDate: result.disposalDate || new Date().toISOString().split('T')[0],
          memo: `[자산 매각 출고] 완료 (매각일: ${result.disposalDate || '-'} / 매각가: ${(result.disposalPrice || 0).toLocaleString()}원 / 매각인수처: ${result.buyer || '-'})`,
          createdAt: new Date().toISOString()
        });
      }
    }

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('saveAsset Supabase sync error:', err);
      showErrorModal(`⚠️ 장비 자산 저장 중 DB 동기화 오류가 발생했습니다:\n${err.message || err.details || JSON.stringify(err)}`, 'DB 동기화 오류');
      throw err;
    }
    refreshAllData();
    return result;
  };

  // 💡 자산 상태 SSOT 실시간 자동 변동 헬퍼 메소드
  const changeAssetStatus = async (assetId: string, newStatus: Asset['status'], extraData?: Partial<Asset>) => {
    try {
      const targetAsset = db.assets.find(a => a.id === assetId);
      if (!targetAsset) return;

      const updatedPayload: Partial<Asset> = {
        status: newStatus,
        ...extraData
      };

      db.updateRow<Asset>('assets', assetId, updatedPayload);

      // 자산 입출고/상태 변동 이력 자동 타임라인 기록
      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: assetId,
        assetNo: targetAsset.assetNo || '',
        modelName: targetAsset.modelName || '',
        type: (newStatus === 'RENTED' || newStatus === 'ASSIGNED') ? 'OUTBOUND' : 'INBOUND',
        eventDate: new Date().toISOString().split('T')[0],
        memo: `[자산상태 변동] ${targetAsset.status || 'AVAILABLE'} ➔ ${newStatus}`,
        createdAt: new Date().toISOString()
      });

      if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
        await db.awaitPendingWrites();
      }
      refreshAllData();
    } catch (err: any) {
      console.error('changeAssetStatus error:', err);
      showErrorModal(`⚠️ 자산 상태 변동 처리 중 오류가 발생했습니다:\n\n${err?.message || err}`);
      throw err;
    }
  };

  // 전사 계약번호 통일 생성 헬퍼 (최초발생월 YYMM 기준 C{YYMM}-{4자리 순차}: 예 'C2608-0001')
  const generateNextContractNo = (targetDate?: string): string => {
    let yymm = '';
    if (targetDate) {
      const clean = targetDate.replace(/\D/g, '');
      if (clean.length >= 6) {
        yymm = clean.substring(2, 6);
      }
    }
    if (!yymm) {
      yymm = new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2, 6); // e.g. "2608"
    }
    const prefix = `C${yymm}`;
    let maxSeq = 0;
    
    db.contracts.forEach(c => {
      if (!c || !c.contractNo) return;
      const match = c.contractNo.match(new RegExp(`^${prefix}-(\\d{4})`)) || 
                    c.contractNo.match(new RegExp(`^${prefix}(\\d{4})`)) ||
                    c.contractNo.match(new RegExp(`${yymm}(\\d{4})`));
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    return `${prefix}-${nextSeq}`;
  };

  const getActorDispatchStaffTag = (): string => {
    if (!currentUser) return '';
    const matchedUser = db.users.find(u => u.id === currentUser.id) || currentUser;
    const rawName = (matchedUser.name || '').trim();
    if (!rawName) return '';
    const pos = ((matchedUser as any).position || '').trim();
    const displayName = pos && !rawName.endsWith(pos) ? `${rawName} ${pos}` : rawName;
    const phone = (matchedUser.phone || '').trim() || '-';
    return `[배차담당자: ${displayName} (${phone}) | ${matchedUser.id}]`;
  };

  const appendDispatchStaffTag = (memoText: string): string => {
    const tag = getActorDispatchStaffTag();
    const base = (memoText || '').trim();
    if (!tag || base.includes('[배차담당자:')) return base;
    return base ? `${base} ${tag}` : tag;
  };

  const saveSmartDispatch = async (data: SmartDispatchData, autoRegister: boolean, onProgress?: (log: string, percent: number) => void) => {
    const notify = async (msg: string, pct: number, delayMs = 180) => {
      if (onProgress) {
        onProgress(msg, pct);
        await new Promise(r => setTimeout(r, delayMs));
      }
    };

    await notify('🔍 [1/5] 고객사 명칭 정규화 및 거래 상태 확인 중...', 10);

    // 약칭("세보엠이씨") 또는 표기 형태(" (주) 세보엠이씨 ") 검색 시 기존 정식 법인명("주식회사 세보엠이씨") 자동 탐색 & 보정
    let customer = findCustomerByNormalizedName(db.customers, data.customerName);
    if (customer) {
      // 약칭 입력을 정식 등록 명칭으로 자동 치환/보정!
      data.customerName = customer.name;
    }
    if (customer && customer.transactionStatus === 'BLOCKED') {
      return { success: false, errorMessage: '⚠️ 해당 고객사는 [거래불가] 상태로 설정되어 있어 신규 출고 및 계약 등록이 원천 차단됩니다.' };
    }
    
    // 🛡️ [1. 방어 가드 - Validation Guard]
    // 현장명은 반드시 100% 정확히 일치(===)해야만 기존 현장으로 매칭하며, 부분/포함 매칭을 원천 차단한다.
    const currentCust = customer;
    const trimmedInputSiteName = (data.siteName || '').trim();
    const existingSite = currentCust
      ? db.sites.find(s => s.customerId === currentCust.id && s.name.trim() === trimmedInputSiteName)
      : null;

    // 🚫 기존 현장과 100% 일치하지 않는 현장명인데 신규 현장 등록(autoRegister)이 명시되지 않은 경우 입력 원천 차단
    if (currentCust && !existingSite && !autoRegister) {
      return {
        success: false,
        requiresConfirm: true,
        missingFields: [`현장: ${trimmedInputSiteName}`],
        errorMessage: `등록되지 않은 현장명('${trimmedInputSiteName}')입니다. 기존 현장명과 100% 일치하지 않으므로 입력이 제한됩니다. 기존 현장을 정확히 선택하거나 [신규현장 등록]을 통해 현장을 새로 등록해 주십시오.`
      };
    }

    const isBlankContactField = (v?: string | null) => {
      if (!v) return true;
      const t = String(v).trim();
      return t === '' || t === '미상' || t === '-' || t === '없음' || t === '미입력';
    };

    const existingSiteEqContact = existingSite
      ? ((existingSite.contacts || []).find(c => c && c.isActive !== false && c.contactType === 'EQUIPMENT') || (existingSite.contacts || []).find(c => c && c.isActive !== false))
      : undefined;

    const existingContact = currentCust ? db.contacts.find(ct => ct.customerId === currentCust.id && (!isBlankContactField(data.siteContactName) ? ct.name.replace(/\s/g, '') === data.siteContactName.replace(/\s/g, '') : true)) : null;

    const effectiveAddress = (!isBlankContactField(data.siteAddress) ? data.siteAddress.trim() : '') || (!isBlankContactField(existingSite?.address) ? existingSite!.address.trim() : '');
    const effectiveContactName = (!isBlankContactField(data.siteContactName) ? data.siteContactName.trim() : '')
      || (!isBlankContactField(existingSite?.contactName) ? existingSite!.contactName.trim() : '')
      || (!isBlankContactField(existingSiteEqContact?.name) ? existingSiteEqContact!.name.trim() : '');
    const effectivePhone = (!isBlankContactField(data.siteContactPhone) ? data.siteContactPhone.trim() : '')
      || (!isBlankContactField(existingSite?.contact) ? existingSite!.contact.trim() : '')
      || (!isBlankContactField(existingSiteEqContact?.contact) ? existingSiteEqContact!.contact.trim() : '')
      || (!isBlankContactField(existingContact?.contact) ? existingContact!.contact.trim() : '');
    const effectivePosition = (!isBlankContactField(data.siteContactPosition) ? data.siteContactPosition!.trim() : '')
      || (!isBlankContactField(existingSiteEqContact?.position) ? existingSiteEqContact!.position!.trim() : '');
    const effectiveEmail = (!isBlankContactField(data.siteContactEmail) ? data.siteContactEmail.trim() : '')
      || (!isBlankContactField(existingSite?.email) ? existingSite!.email.trim() : '')
      || (!isBlankContactField(existingSiteEqContact?.email) ? existingSiteEqContact!.email!.trim() : '');

    if (!effectiveAddress) {
      return {
        success: false,
        errorMessage: `⚠️ [현장 상세 주소 필수 누락]\n\n고객사 '${data.customerName}' / 현장 '${data.siteName}'의 기존 DB에 등록된 주소가 없으며, 현재 입력창에도 주소가 생략되어 있습니다.\n\n배차 기사 운송 및 계약 체결을 위해 현장 상세 주소를 반드시 입력해주세요.`
      };
    }
    if (!effectiveContactName) {
      return {
        success: false,
        errorMessage: `⚠️ [현장 담당자 성명 필수 누락]\n\n고객사 '${data.customerName}' / 현장 '${data.siteName}'의 기존 현장담당자 성명이 미입력(공백) 상태입니다.\n\n현장담당자의 부족한 정보(성명 및 연락처)를 입력해 주시면 해당 현장 정보에 즉시 업데이트됩니다.`
      };
    }
    if (!effectivePhone) {
      return {
        success: false,
        errorMessage: `⚠️ [현장 담당자 연락처 필수 누락]\n\n고객사 '${data.customerName}' / 현장 '${data.siteName}'의 현장 담당자 연락처가 기존 DB에 없으며 입력창에도 생략되었습니다.\n\n장비 하차 인계 및 기사 비상 연락을 위해 현장 담당자 연락처를 반드시 입력해주세요.`
      };
    }

    // ⚡ [2. 기존 정보 상속] 누락 필드 자동 승계
    data.siteAddress = effectiveAddress;
    data.siteContactName = effectiveContactName;
    data.siteContactPhone = effectivePhone;
    if (effectivePosition) data.siteContactPosition = effectivePosition;
    if (effectiveEmail) data.siteContactEmail = effectiveEmail;
    if (!data.taxBillEmail?.trim() && customer?.repEmail && customer.repEmail !== '미상') {
      data.taxBillEmail = customer.repEmail;
    }

    // 🛡️ [장비 수량 검증 가드]
    if (!data.equipments || data.equipments.length === 0) {
      return { success: false, errorMessage: '⚠️ 출고 대상 장비 규격 및 수량이 누락되었습니다.' };
    }
    const sanitizedEquipments = data.equipments.map(eq => ({
      ...eq,
      qty: Math.max(1, Math.floor(Number(eq.qty) || 1))
    }));
    const totalEqQty = sanitizedEquipments.reduce((sum, e) => sum + e.qty, 0);
    if (totalEqQty <= 0) {
      return { success: false, errorMessage: '⚠️ 출고 수량은 최소 1대 이상이어야 합니다.' };
    }
    data.equipments = sanitizedEquipments;

    const missingFields = [];
    if (!customer) missingFields.push(`고객사: ${data.customerName}`);
    if (!existingSite) missingFields.push(`현장: ${data.siteName}`);

    if (missingFields.length > 0 && !autoRegister) {
      return { success: false, requiresConfirm: true, missingFields };
    }

    const rawData = data as any;
    const parseDayNumber = (val: any, fallback: number): number => {
      if (val === undefined || val === null || val === '') return fallback;
      const str = String(val).trim();
      if (str.includes('말일') || str.includes('월말')) return 31;
      const matched = str.match(/\d+/);
      if (matched) {
        const n = parseInt(matched[0], 10);
        return Math.min(31, Math.max(1, n));
      }
      return fallback;
    };
    const contractBillingDay = parseDayNumber(rawData.closingDay, customer?.defaultBillingDay || 30);
    const contractStatementClosingDay = parseDayNumber(rawData.statementClosingDay, customer?.defaultStatementClosingDay || 25);
    const contractPaymentDueDay = parseDayNumber(rawData.paymentDay || rawData.paymentDueDay, customer?.paymentDueDay || 15);

    if (!customer) {
      await notify(`🏢 [신규 고객] DB에 없는 고객사 '${data.customerName}' 자동 신규 생성 중...`, 20);
      customer = db.insertRow<Customer>('customers', {
        name: data.customerName,
        bizRegNo: '미상',
        isClosed: false,
        address: data.siteAddress || '미상',
        representative: '미상',
        repContact: data.siteContactPhone || '미상',
        repEmail: data.taxBillEmail || data.statementEmail || '미상',
        defaultBillingDay: contractBillingDay,
        defaultStatementClosingDay: contractStatementClosingDay,
        paymentDueDay: contractPaymentDueDay,
        createdAt: new Date().toISOString()
      });

      // ⚠️ FK 제약 방지: 신규 고객이 Supabase에 완전히 저장된 후에만 contacts/sites 생성 가능
      try {
        await db.awaitPendingWrites();
      } catch (err: any) {
        console.error('Supabase new customer sync error:', err);
        showErrorModal(`⚠️ 신규 고객 DB 저장 중 오류:\n${err.message || JSON.stringify(err)}`, '출고 오류');
        return { success: false, errorMessage: err.message };
      }

      if (data.siteContactName) {
        db.insertRow<CustomerContact>('contacts', {
          customerId: customer.id,
          name: data.siteContactName,
          position: '현장담당자',
          contact: data.siteContactPhone || '미상',
          email: data.siteContactEmail || '미상',
          createdAt: new Date().toISOString()
        });
      }
    } else {
      await notify(`✅ [고객 확인] 기존 등록 고객사 '${customer.name}' 매핑 완료`, 25);
      
      // 🔄 [3. 최신 정보 업데이트] 고객 마스터 정보 동기화
      const custUpdates: Partial<Customer> = {};
      if (data.taxBillEmail && data.taxBillEmail !== '미상' && data.taxBillEmail !== customer.repEmail) {
        custUpdates.repEmail = data.taxBillEmail;
      }
      if (Object.keys(custUpdates).length > 0) {
        customer = db.updateRow<Customer>('customers', customer.id, { ...custUpdates, updatedAt: new Date().toISOString() }) as Customer;
        await notify(`🏢 [고객 정보 갱신] 계산서 수신처('${data.taxBillEmail}')가 고객 마스터에 업데이트되었습니다.`, 28);
      }

      // 담당자 정보 업데이트 및 신규 추가
      if (data.siteContactName && !isBlankContactField(data.siteContactName)) {
        const targetCustomerId = customer.id;
        const matchedContact = db.contacts.find(ct => ct.customerId === targetCustomerId && ct.name.replace(/\s/g, '') === data.siteContactName.replace(/\s/g, ''))
          || db.contacts.find(ct => ct.customerId === targetCustomerId && isBlankContactField(ct.name));
        if (matchedContact) {
          const contactUpdates: Partial<CustomerContact> = {};
          if (isBlankContactField(matchedContact.name) && data.siteContactName) {
            contactUpdates.name = data.siteContactName;
          }
          if (data.siteContactPhone && !isBlankContactField(data.siteContactPhone) && data.siteContactPhone !== matchedContact.contact) {
            contactUpdates.contact = data.siteContactPhone;
          }
          if (data.siteContactPosition && !isBlankContactField(data.siteContactPosition) && data.siteContactPosition !== matchedContact.position) {
            contactUpdates.position = data.siteContactPosition;
          }
          if (data.siteContactEmail && !isBlankContactField(data.siteContactEmail) && data.siteContactEmail !== matchedContact.email) {
            contactUpdates.email = data.siteContactEmail;
          }
          if (Object.keys(contactUpdates).length > 0) {
            db.updateRow<CustomerContact>('contacts', matchedContact.id, {
              ...contactUpdates,
              updatedAt: new Date().toISOString()
            });
            await notify(`👤 [담당자 최신화] 담당자 '${data.siteContactName}' 정보가 최신값으로 업데이트되었습니다.`, 30);
          }
        } else {
          await notify(`👤 [신규 담당자] 현장 담당자 '${data.siteContactName}' 등록 중...`, 30);
          db.insertRow<CustomerContact>('contacts', {
            customerId: targetCustomerId,
            name: data.siteContactName,
            position: data.siteContactPosition || '현장담당자',
            contact: data.siteContactPhone || '미상',
            email: data.siteContactEmail || '미상',
            createdAt: new Date().toISOString()
          });
        }
      }

      if (data.billingContactName) {
        const targetCustomerId = customer.id;
        const matchedBilling = db.contacts.find(ct => ct.customerId === targetCustomerId && ct.name.replace(/\s/g, '') === data.billingContactName.replace(/\s/g, ''));
        if (!matchedBilling) {
          db.insertRow<CustomerContact>('contacts', {
            customerId: targetCustomerId,
            name: data.billingContactName,
            position: '청구담당자',
            contact: data.billingContactPhone || '미상',
            email: data.taxBillEmail || data.statementEmail || '미상',
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    const finalCustomer = customer;

    // 현장 처리: 고객 산하 현장 매핑 (100% 정확히 일치하는 현장명 === 매칭) 또는 신규 고객현장 등록 (옵션은 CustomerSite에 직접 저장)
    let site = db.sites.find(s => s.customerId === finalCustomer.id && s.name.trim() === trimmedInputSiteName);
    const selectedOptionGroup = data.siteMasterId ? db.siteMasters.find(m => m.id === data.siteMasterId) : undefined;

    if (!site) {
      await notify(`📍 [2/5 현장 등록] 고객 현장 '${data.siteName}' 등록 중...`, 40);
      const initialSiteContacts = (!isBlankContactField(data.siteContactName) || !isBlankContactField(data.siteContactPhone))
        ? [{
            id: `sc-eq-${Date.now()}`,
            name: data.siteContactName || '미상',
            contactType: 'EQUIPMENT' as const,
            position: data.siteContactPosition || '현장담당자',
            contact: data.siteContactPhone || '미상',
            email: !isBlankContactField(data.siteContactEmail) ? data.siteContactEmail : '',
            isPrimary: true,
            isActive: true
          }]
        : undefined;
      const isSeboCust = finalCustomer.id === 'CUST-0000022' || String(finalCustomer.bizRegNo || '').replace(/[^0-9]/g, '') === '1188100241';
      const resolvedTaxInvoiceIssueType: 'FORWARD' | 'REVERSE' =
        rawData.taxInvoiceIssueType === 'REVERSE'
          ? 'REVERSE'
          : rawData.taxInvoiceIssueType === 'FORWARD'
            ? 'FORWARD'
            : (finalCustomer.defaultTaxInvoiceIssueType === 'REVERSE' || isSeboCust ? 'REVERSE' : 'FORWARD');
      const resolvedPaymentMethod: 'CASH' | 'BILL' | 'BOND' =
        (rawData.paymentMethod === 'BILL' || rawData.paymentMethod === 'BOND')
          ? rawData.paymentMethod
          : (finalCustomer.defaultPaymentMethod === 'BILL' || finalCustomer.defaultPaymentMethod === 'BOND' ? finalCustomer.defaultPaymentMethod : 'CASH');
      const resolvedPaymentTermsNote: string =
        rawData.paymentTermsNote !== undefined
          ? String(rawData.paymentTermsNote || '').trim()
          : String(finalCustomer.defaultPaymentTermsNote || '').trim();
      const resolvedPaymentDueMonthOffset: number =
        rawData.paymentDueMonthOffset !== undefined && rawData.paymentDueMonthOffset !== null
          ? Number(rawData.paymentDueMonthOffset)
          : (finalCustomer.paymentDueMonthOffset ?? 1);
      site = db.insertRow<CustomerSite>('sites', {
        customerId: finalCustomer.id,
        siteMasterId: selectedOptionGroup?.id || null,
        name: data.siteName,
        address: data.siteAddress || '미상',
        isActive: true,
        contactName: data.siteContactName || '미상',
        contact: data.siteContactPhone || '미상',
        email: data.siteContactEmail || '미상',
        contacts: initialSiteContacts,
        billingDay: contractBillingDay,
        statementClosingDay: contractStatementClosingDay,
        paymentDueMonthOffset: resolvedPaymentDueMonthOffset,
        paymentDueDay: contractPaymentDueDay,
        paymentMethod: resolvedPaymentMethod,
        paymentTermsNote: resolvedPaymentTermsNote,
        freightBillingStandard: rawData.freightBillingStandard === '2/4' ? '2/4' : '3/5',
        taxInvoiceIssueType: resolvedTaxInvoiceIssueType,
        paidOptions: data.paidOptions !== undefined ? data.paidOptions : (selectedOptionGroup?.paidOptions || finalCustomer.defaultPaidOptions || ''),
        protection: data.protection !== undefined ? data.protection : (selectedOptionGroup?.protection || finalCustomer.defaultProtection || 'NONE'),
        attachments: data.attachments !== undefined ? data.attachments : (selectedOptionGroup?.attachments || finalCustomer.defaultAttachments || ''),
        checkedSpecs: mergeOptionPricesIntoSpecs(
          {
            ...((data.checkedSpecs && Object.keys(data.checkedSpecs).length > 0)
              ? data.checkedSpecs
              : (selectedOptionGroup?.checkedSpecs || finalCustomer.defaultCheckedSpecs || {})),
            __freightBillingStandard: rawData.freightBillingStandard === '2/4' ? '2/4' : '3/5',
            __taxInvoiceIssueType: resolvedTaxInvoiceIssueType,
            __paymentMethod: resolvedPaymentMethod,
            __paymentTermsNote: resolvedPaymentTermsNote
          },
          db.standardOptions,
          data.paidOptionPrices
        ),
        createdAt: new Date().toISOString()
      });
    } else {
      // 기존 고객 현장 정보 최신화 (주소, 담당자, contacts 배열, 마감조건, 현장 옵션/보양/사양)
      const siteUpdates: Partial<CustomerSite> = {};
      if (selectedOptionGroup && selectedOptionGroup.id !== site.siteMasterId) {
        siteUpdates.siteMasterId = selectedOptionGroup.id;
      }
      if (data.siteAddress && !isBlankContactField(data.siteAddress) && data.siteAddress !== site.address) {
        siteUpdates.address = data.siteAddress;
      }
      if (data.siteContactName && !isBlankContactField(data.siteContactName) && data.siteContactName !== site.contactName) {
        siteUpdates.contactName = data.siteContactName;
      }
      if (data.siteContactPhone && !isBlankContactField(data.siteContactPhone) && data.siteContactPhone !== site.contact) {
        siteUpdates.contact = data.siteContactPhone;
      }
      if (data.siteContactEmail && !isBlankContactField(data.siteContactEmail) && data.siteContactEmail !== site.email) {
        siteUpdates.email = data.siteContactEmail;
      }

      // 🌟 [현장담당자 목록(contacts) 1:1 동기화]: 기존 현장의 담당자가 공백이었거나 추가 정보가 입력된 경우 contacts 배열 동시 업데이트
      if (!isBlankContactField(data.siteContactName) || !isBlankContactField(data.siteContactPhone) || !isBlankContactField(data.siteContactPosition) || !isBlankContactField(data.siteContactEmail)) {
        const existingContactsList = Array.isArray(site.contacts) ? site.contacts.map(c => ({ ...c })) : [];
        const eqIdx = existingContactsList.findIndex(c => c.contactType === 'EQUIPMENT');
        const targetIdx = eqIdx >= 0 ? eqIdx : (existingContactsList.length > 0 && !existingContactsList[0].contactType ? 0 : -1);

        const nextName = !isBlankContactField(data.siteContactName) ? data.siteContactName.trim() : (!isBlankContactField(site.contactName) ? site.contactName.trim() : '');
        const nextPhone = !isBlankContactField(data.siteContactPhone) ? data.siteContactPhone.trim() : (!isBlankContactField(site.contact) ? site.contact.trim() : '');
        const nextPos = !isBlankContactField(data.siteContactPosition) ? data.siteContactPosition!.trim() : '';
        const nextEmail = !isBlankContactField(data.siteContactEmail) ? data.siteContactEmail.trim() : (!isBlankContactField(site.email) ? site.email.trim() : '');

        if (targetIdx >= 0) {
          const prevEq = existingContactsList[targetIdx];
          const mergedName = nextName || prevEq.name || '';
          const mergedPhone = nextPhone || prevEq.contact || '';
          const mergedPos = nextPos || (!isBlankContactField(prevEq.position) ? prevEq.position! : '현장담당자');
          const mergedEmail = nextEmail || (!isBlankContactField(prevEq.email) ? prevEq.email! : '');
          if (mergedName !== prevEq.name || mergedPhone !== prevEq.contact || mergedPos !== prevEq.position || mergedEmail !== prevEq.email || prevEq.isActive === false) {
            existingContactsList[targetIdx] = {
              ...prevEq,
              id: prevEq.id || `sc-eq-${Date.now()}`,
              name: mergedName,
              contactType: 'EQUIPMENT',
              position: mergedPos,
              contact: mergedPhone,
              email: mergedEmail,
              isPrimary: prevEq.isPrimary ?? true,
              isActive: true
            };
            siteUpdates.contacts = existingContactsList;
          }
        } else if (nextName || nextPhone) {
          existingContactsList.unshift({
            id: `sc-eq-${Date.now()}`,
            name: nextName || '현장담당자',
            contactType: 'EQUIPMENT',
            position: nextPos || '현장담당자',
            contact: nextPhone || '',
            email: nextEmail || '',
            isPrimary: true,
            isActive: true
          });
          siteUpdates.contacts = existingContactsList;
        }
      }
      if (rawData.closingDay !== undefined) {
        siteUpdates.billingDay = contractBillingDay;
      }
      if (rawData.statementClosingDay !== undefined) {
        siteUpdates.statementClosingDay = contractStatementClosingDay;
      }
      if (rawData.paymentDay !== undefined || rawData.paymentDueDay !== undefined) {
        siteUpdates.paymentDueDay = contractPaymentDueDay;
      }
      if (rawData.freightBillingStandard === '2/4' || rawData.freightBillingStandard === '3/5') {
        const nextFreightStd: '2/4' | '3/5' = rawData.freightBillingStandard;
        const prevSiteStd = site.freightBillingStandard || (site.checkedSpecs && (site.checkedSpecs as any).__freightBillingStandard);
        if (prevSiteStd !== nextFreightStd) {
          siteUpdates.freightBillingStandard = nextFreightStd;
          siteUpdates.checkedSpecs = {
            ...(site.checkedSpecs || {}),
            ...(siteUpdates.checkedSpecs || {}),
            __freightBillingStandard: nextFreightStd
          };
        }
      }
      if (rawData.taxInvoiceIssueType === 'FORWARD' || rawData.taxInvoiceIssueType === 'REVERSE') {
        const nextIssueType: 'FORWARD' | 'REVERSE' = rawData.taxInvoiceIssueType;
        const prevIssueType = site.taxInvoiceIssueType || (site.checkedSpecs && (site.checkedSpecs as any).__taxInvoiceIssueType);
        if (prevIssueType !== nextIssueType) {
          siteUpdates.taxInvoiceIssueType = nextIssueType;
          siteUpdates.checkedSpecs = {
            ...(site.checkedSpecs || {}),
            ...(siteUpdates.checkedSpecs || {}),
            __taxInvoiceIssueType: nextIssueType
          };
        }
      }
      if (rawData.paymentDueMonthOffset !== undefined && rawData.paymentDueMonthOffset !== null) {
        siteUpdates.paymentDueMonthOffset = Number(rawData.paymentDueMonthOffset);
      }
      if (rawData.paymentMethod === 'CASH' || rawData.paymentMethod === 'BILL' || rawData.paymentMethod === 'BOND') {
        const nextMethod: 'CASH' | 'BILL' | 'BOND' = rawData.paymentMethod;
        const prevMethod = site.paymentMethod || (site.checkedSpecs && (site.checkedSpecs as any).__paymentMethod);
        if (prevMethod !== nextMethod) {
          siteUpdates.paymentMethod = nextMethod;
          siteUpdates.checkedSpecs = {
            ...(site.checkedSpecs || {}),
            ...(siteUpdates.checkedSpecs || {}),
            __paymentMethod: nextMethod
          };
        }
      }
      if (rawData.paymentTermsNote !== undefined) {
        const nextNote = String(rawData.paymentTermsNote || '').trim();
        const prevNote = site.paymentTermsNote ?? ((site.checkedSpecs && (site.checkedSpecs as any).__paymentTermsNote) || '');
        if (prevNote !== nextNote) {
          siteUpdates.paymentTermsNote = nextNote;
          siteUpdates.checkedSpecs = {
            ...(site.checkedSpecs || {}),
            ...(siteUpdates.checkedSpecs || {}),
            __paymentTermsNote: nextNote
          };
        }
      }
      // 🌟 [헌장 1.5] 옵션/보양/부착물/표준사양은 고객 현장에 직접 저장
      if (data.saveOptionsToSite !== false) {
        if (data.paidOptions !== undefined && data.paidOptions !== site.paidOptions) {
          siteUpdates.paidOptions = data.paidOptions;
        }
        if (data.protection !== undefined && data.protection !== site.protection) {
          siteUpdates.protection = data.protection;
        }
        if (data.attachments !== undefined && data.attachments !== site.attachments) {
          siteUpdates.attachments = data.attachments;
        }
        if ((data.checkedSpecs && Object.keys(data.checkedSpecs).length > 0) || (data.paidOptionPrices && Object.keys(data.paidOptionPrices).length > 0)) {
          const baseSpecsForUpdate = (data.checkedSpecs && Object.keys(data.checkedSpecs).length > 0)
            ? {
                ...(site.checkedSpecs?.__optionMeta && typeof site.checkedSpecs.__optionMeta === 'object' ? { __optionMeta: site.checkedSpecs.__optionMeta } : {}),
                ...data.checkedSpecs,
                ...(siteUpdates.checkedSpecs?.__freightBillingStandard ? { __freightBillingStandard: siteUpdates.checkedSpecs.__freightBillingStandard } : (site.checkedSpecs?.__freightBillingStandard ? { __freightBillingStandard: site.checkedSpecs.__freightBillingStandard } : {}))
              }
            : {
                ...(site.checkedSpecs || {}),
                ...(siteUpdates.checkedSpecs || {})
              };
          siteUpdates.checkedSpecs = mergeOptionPricesIntoSpecs(
            baseSpecsForUpdate,
            db.standardOptions,
            data.paidOptionPrices
          );
        }
      }
      if (Object.keys(siteUpdates).length > 0) {
        site = db.updateRow<CustomerSite>('sites', site.id, { ...siteUpdates, updatedAt: new Date().toISOString() }) as CustomerSite;
        await notify(`📍 [현장 정보 최신화] 고객 현장 '${site.name}'의 정보(주소/옵션/보양)가 업데이트되었습니다.`, 45);
      } else {
        await notify(`📍 [2/5 현장 매핑] 기존 고객 현장 '${site.name}' 매핑 완료`, 45);
      }
    }

    // 🌟 고객사 기본 옵션/보양 등록 및 전체 현장 일괄 전파 처리 (1회성 출고 적용 시에는 고객사 기본값 오염 방지)
    const custOptionUpdates: Partial<Customer> = {};
    if (rawData.freightBillingStandard === '2/4' || rawData.freightBillingStandard === '3/5') {
      if (!finalCustomer.defaultFreightBillingStandard) {
        custOptionUpdates.defaultFreightBillingStandard = rawData.freightBillingStandard;
        custOptionUpdates.defaultCheckedSpecs = {
          ...(finalCustomer.defaultCheckedSpecs || {}),
          __freightBillingStandard: rawData.freightBillingStandard
        };
      }
    }
    if (data.saveOptionsToSite !== false) {
      if (data.isSetAsCustomerDefault || (!finalCustomer.defaultPaidOptions && data.paidOptions)) {
        if (data.paidOptions) custOptionUpdates.defaultPaidOptions = data.paidOptions;
      }
      if (data.isSetAsCustomerDefault || (!finalCustomer.defaultProtection && data.protection)) {
        if (data.protection) custOptionUpdates.defaultProtection = data.protection;
      }
      if (data.isSetAsCustomerDefault || (!finalCustomer.defaultAttachments && data.attachments)) {
        if (data.attachments) custOptionUpdates.defaultAttachments = data.attachments;
      }
      if (data.isSetAsCustomerDefault || (!finalCustomer.defaultCheckedSpecs && ((data.checkedSpecs && Object.keys(data.checkedSpecs).length > 0) || (data.paidOptionPrices && Object.keys(data.paidOptionPrices).length > 0)))) {
        const baseCustSpecs = (data.checkedSpecs && Object.keys(data.checkedSpecs).length > 0)
          ? {
              ...(finalCustomer.defaultCheckedSpecs?.__optionMeta && typeof finalCustomer.defaultCheckedSpecs.__optionMeta === 'object' ? { __optionMeta: finalCustomer.defaultCheckedSpecs.__optionMeta } : {}),
              ...data.checkedSpecs
            }
          : (finalCustomer.defaultCheckedSpecs || {});
        custOptionUpdates.defaultCheckedSpecs = mergeOptionPricesIntoSpecs(baseCustSpecs, db.standardOptions, data.paidOptionPrices);
      }
    }
    if (Object.keys(custOptionUpdates).length > 0) {
      db.updateRow<Customer>('customers', finalCustomer.id, { ...custOptionUpdates, updatedAt: new Date().toISOString() });
      await notify(`🏢 [고객사 기본설정 동기화] 고객사('${finalCustomer.name}') 기본 옵션/보양 마스터가 등록되었습니다.`, 48);
    }

    if (data.applyToAllSites) {
      const allSites = db.sites.filter(s => s.customerId === finalCustomer.id);
      for (const s of allSites) {
        const baseSiteSpecs = (data.checkedSpecs && Object.keys(data.checkedSpecs).length > 0)
          ? {
              ...(s.checkedSpecs?.__optionMeta && typeof s.checkedSpecs.__optionMeta === 'object' ? { __optionMeta: s.checkedSpecs.__optionMeta } : {}),
              ...data.checkedSpecs
            }
          : (s.checkedSpecs || {});
        db.updateRow<CustomerSite>('sites', s.id, {
          paidOptions: data.paidOptions !== undefined ? data.paidOptions : s.paidOptions,
          protection: data.protection !== undefined ? data.protection : s.protection,
          attachments: data.attachments !== undefined ? data.attachments : s.attachments,
          checkedSpecs: mergeOptionPricesIntoSpecs(baseSiteSpecs, db.standardOptions, data.paidOptionPrices),
          updatedAt: new Date().toISOString()
        });
      }
      await notify(`🌐 [전체 현장 전파] '${finalCustomer.name}' 산하 ${allSites.length}개 모든 고객 현장에 옵션/보양이 일괄 적용되었습니다.`, 50);
    }

    if (autoRegister && currentUser) {
      db.insertRow<Todo>('todos', {
        userId: currentUser.id,
        type: 'MISSING_INFO',
        title: `신규 고객/현장 정보 보완 (${data.customerName})`,
        content: `출고 요청 시 사업자등록번호 등 미상으로 처리된 필수 항목을 채워주세요.`,
        isCompleted: false,
        relatedEntityId: finalCustomer.id,
        createdAt: new Date().toISOString()
      });
    }

    const finalSite = site!;

    // ⚠️ FK 제약 방지: 현장 레코드가 Supabase 원격 DB에 100% 저장·반영 완료된 후에만 contracts 생성이 가능하도록 동기 대기!
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('Supabase site sync error before contract creation:', err);
      showErrorModal(`⚠️ 신규 현장 DB 동기화 오류가 발생했습니다:\n${err.message || JSON.stringify(err)}`, '출고 오류');
      return { success: false, errorMessage: err.message };
    }

    const existingUsers = db.users;
    // 💡 계약 영업담당자 결정 원칙:
    // 1) 최초 출고 요청자(ownerId / salespersonId / salespersonName)가 명시되어 있으면 해당 직원을 최우선 적용
    // 2) 없으면 현재 출고 요청을 입력한 로그인 사용자(currentUser)를 적용
    // 3) 기존 계약에 장비 추가 편입 시에는 기존 계약의 최초 영업담당자(existingActiveContract.salespersonId)를 절대 덮어쓰지 않고 유지함
    const explicitRequesterId = rawData.salespersonId || rawData.requesterId || rawData.ownerId;
    const explicitRequesterByName = (!explicitRequesterId && data.salespersonName)
      ? existingUsers.find(u => u.name.trim() === data.salespersonName!.trim())?.id
      : undefined;
    const candidateSalespersonId = explicitRequesterId || explicitRequesterByName || currentUser?.id;
    const isSalespersonValid = candidateSalespersonId && existingUsers.some(u => u.id === candidateSalespersonId);
    const validSalespersonId = isSalespersonValid ? candidateSalespersonId : (existingUsers.find(u => u.id === 'u-1')?.id || existingUsers[0]?.id || undefined);

    const extractDate = (dateTimeStr?: string): string => {
      if (!dateTimeStr) return '';
      const match = dateTimeStr.match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    };
    const targetStartDate = extractDate(data.unloadingTime) || extractDate(data.loadingTime) || new Date().toISOString().split('T')[0];

    // ── 계약 단일성 원칙: 명시 지정 계약 ➔ 동일 (고객사 + 현장) 활성 계약 ➔ 동일 현장 종료 계약 탐색 ──
    const explicitTargetContract = (!rawData.forceNewContract && rawData.targetContractId)
      ? db.contracts.find(c => c.id === String(rawData.targetContractId) && c.customerId === finalCustomer.id)
      : undefined;
    const existingActiveContract = rawData.forceNewContract
      ? undefined
      : (
          explicitTargetContract ||
          db.contracts.find(c =>
            c.customerId === finalCustomer.id &&
            c.siteId === finalSite.id &&
            (c.status === 'ACTIVE' || c.status === 'EXTENDED')
          ) ||
          db.contracts.find(c =>
            c.customerId === finalCustomer.id &&
            c.siteId === finalSite.id &&
            c.status === 'COMPLETED'
          )
        );

    let contract: Contract;

    const resolvedFreightStd: '2/4' | '3/5' = rawData.freightBillingStandard === '2/4' ? '2/4' : '3/5';

    if (existingActiveContract) {
      // 1) 기존 계약이 존재할 경우: 신규 계약을 파편화하여 생성하지 않고 기존 계약에 장비 편입!
      if (existingActiveContract.status === 'COMPLETED' || existingActiveContract.freightBillingStandard !== resolvedFreightStd) {
        const reactivated = db.updateRow<Contract>('contracts', existingActiveContract.id, {
          status: 'ACTIVE',
          freightBillingStandard: resolvedFreightStd,
          updatedAt: new Date().toISOString(),
        });
        contract = reactivated || { ...existingActiveContract, status: 'ACTIVE', freightBillingStandard: resolvedFreightStd };
      } else {
        contract = existingActiveContract;
      }
      await notify(`📄 [3/5 기존 계약 편입] 기존 계약(${contract.contractNo})에 신규 장비 편입 중...`, 55);

      // 📜 [헌장 1.2] 발생 사건 무누락 DB 저장: 기존 계약에 장비 추가 편입 이력 등록
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: contract.id,
        changeType: 'REGISTER',
        changeDate: targetStartDate,
        newEndDate: contract.endDate || '',
        description: `기존 계약(${contract.contractNo})에 추가 장비 투입 (${data.equipments.map(e => `${e.modelName} ${e.qty}대`).join(', ')})`,
        createdAt: new Date().toISOString()
      });
    } else {
      // 2) 기존 계약이 없을 경우: 최초 발생월 기준 채번하여 신규 계약 생성
      const nextContractNo = generateNextContractNo(targetStartDate);

      await notify(`📄 [3/5 계약 생성] 임대차 계약서 작성 중 (${nextContractNo})...`, 55);

      const contractLateInterestRate = (rawData.lateInterestRate !== undefined && rawData.lateInterestRate !== '') ? (Number(rawData.lateInterestRate) || 0) : ((finalCustomer as any).defaultLateInterestRate || 0);

      contract = db.insertRow<Contract>('contracts', {
        contractNo: nextContractNo,
        contractType: 'RENTAL',
        customerId: finalCustomer.id,
        siteId: finalSite.id,
        startDate: targetStartDate,
        endDate: '', 
        billingDay: contractBillingDay,
        statementClosingDay: contractStatementClosingDay,
        freightBillingStandard: resolvedFreightStd,
        lateInterestRate: contractLateInterestRate,
        paymentDueDay: contractPaymentDueDay,
        salespersonId: validSalespersonId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // ⚠️ 외래키 제약조건 위반 방지: 부모 contract 레코드가 Supabase 원격 DB에 먼저 100% 생성되도록 1차 동기 대기!
      try {
        await db.awaitPendingWrites();
      } catch (err: any) {
        console.error('Supabase contract insert sync error:', err);
        if (contract?.id) {
          db.deleteRow('contracts', contract.id);
        }
        showErrorModal(`⚠️ 출고 계약 생성 중 DB 동기화 오류가 발생했습니다:\n${err.message || err.details || JSON.stringify(err)}`, '스마트 출고 DB 동기화 오류');
        return { success: false, errorMessage: err.message || err.details };
      }

      // 📜 [헌장 1.2] 발생 사건 무누락 DB 저장: 스마트 출고 신규 계약 체결 이력 등록
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: contract.id,
        changeType: 'REGISTER',
        changeDate: contract.startDate,
        newEndDate: '',
        description: `신규 임대차 계약 체결 (${finalCustomer.name} / ${finalSite.name} - ${data.equipments.map(e => `${e.modelName} ${e.qty}대`).join(', ')})`,
        createdAt: new Date().toISOString()
      });
    }

    await notify('🏗️ [4/5 장비 매핑] 계약 투입 장비 모델 및 단가 자동 상속 중...', 80);

    const custContractIds = db.contracts.filter(c => c.customerId === finalCustomer.id).map(c => c.id);
    const dData = data as any;
    const effectivePaidOptionsForDelivery: string = dData.paidOptions !== undefined ? String(dData.paidOptions) : '';
    const effectivePaidOptionPricesForDelivery: Record<string, number> | undefined =
      dData.paidOptionPrices && typeof dData.paidOptionPrices === 'object' && Object.keys(dData.paidOptionPrices).length > 0
        ? dData.paidOptionPrices
        : undefined;
    const effectivePaidOptionUnitsForDelivery: Record<string, '월' | '대' | '건' | '수량'> | undefined =
      dData.paidOptionUnits && typeof dData.paidOptionUnits === 'object' && Object.keys(dData.paidOptionUnits).length > 0
        ? dData.paidOptionUnits
        : undefined;
    const effectivePaidOptionQtysForDelivery: Record<string, number> | undefined =
      dData.paidOptionQtys && typeof dData.paidOptionQtys === 'object' && Object.keys(dData.paidOptionQtys).length > 0
        ? dData.paidOptionQtys
        : undefined;
    const cargoItemsPayload: {
      modelName: string;
      count: number;
      contractAssetIds: string[];
      paidOptions: string;
      paidOptionPrices?: Record<string, number>;
      paidOptionUnits?: Record<string, '월' | '대' | '건' | '수량'>;
      paidOptionQtys?: Record<string, number>;
      monthlyRentalFee?: number;
      dailyRentalFee?: number;
      requestMeta?: {
        requesterId?: string;
        requesterName?: string;
        requestedAt: string;
        context?: string;
        customerName: string;
        siteName: string;
        siteAddress: string;
        siteContactName: string;
        siteContactPhone: string;
        siteContactEmail?: string;
        loadingTime: string;
        unloadingTime: string;
        vehicleType: string;
        paidBy?: string;
        protection?: string;
        attachments?: string;
        staggeredMemo?: string;
        retrievalAssetIds?: string[];
        closingDay?: number | string;
        statementClosingDay?: number | string;
        paymentDueDay?: number | string;
        freightBillingStandard?: '2/4' | '3/5';
        userNote?: string;
        fullNote?: string;
        paidOptionPrices?: Record<string, number>;
        paidOptionUnits?: Record<string, '월' | '대' | '건' | '수량'>;
        paidOptionQtys?: Record<string, number>;
      };
    }[] = [];

    const requestSnapshotMeta = {
      requesterId: currentUser?.id,
      requesterName: currentUser?.name || '본사 담당자',
      requestedAt: new Date().toISOString(),
      context: dData.context || (dData.type === 'EXCHANGE' ? 'EXCHANGE' : 'ADDITIONAL'),
      customerName: finalCustomer.name,
      siteName: finalSite.name,
      siteAddress: finalSite.address || data.siteAddress || '',
      siteContactName: data.siteContactName || finalSite.contactName || '',
      siteContactPhone: data.siteContactPhone || finalSite.contact || '',
      siteContactEmail: (data.siteContactEmail && data.siteContactEmail !== '미상' ? data.siteContactEmail : '') || (finalSite.email && finalSite.email !== '미상' ? finalSite.email : '') || '',
      loadingTime: data.loadingTime || '',
      unloadingTime: data.unloadingTime || '',
      vehicleType: dData.vehicleType || '5T',
      paidBy: dData.paidBy || '',
      protection: dData.protection || '',
      attachments: dData.attachments || '',
      staggeredMemo: dData.staggeredMemo || '',
      retrievalAssetIds: dData.retrievalAssetIds || [],
      closingDay: contractBillingDay,
      statementClosingDay: contractStatementClosingDay,
      paymentDueDay: contractPaymentDueDay,
      freightBillingStandard: (dData.freightBillingStandard === '2/4' ? '2/4' : '3/5') as '2/4' | '3/5',
      userNote: dData.userNote !== undefined ? String(dData.userNote).trim() : '',
      fullNote: data.note || '',
      ...(effectivePaidOptionPricesForDelivery ? { paidOptionPrices: effectivePaidOptionPricesForDelivery } : {}),
      ...(effectivePaidOptionUnitsForDelivery ? { paidOptionUnits: effectivePaidOptionUnitsForDelivery } : {}),
      ...(effectivePaidOptionQtysForDelivery ? { paidOptionQtys: effectivePaidOptionQtysForDelivery } : {})
    };

    // 다중 PC 동시 출고 요청 시 CAST- / DLV- 채번 충돌 방지를 위해 최신 슬롯 및 배차 테이블을 원격 DB에서 선행 동기화
    if (db.isSupabaseConnected()) {
      try {
        await Promise.all([
          db.pullTableFromSupabase('contractAssets'),
          db.pullTableFromSupabase('deliveries'),
          db.pullTableFromSupabase('outboundInspections')
        ]);
      } catch (pullErr) {
        console.warn('saveSmartDispatch pre-insert sync warning:', pullErr);
      }
    }

    data.equipments.forEach((eq) => {
      const eqData = eq as any;
      const count = Math.max(1, Math.floor(Number(eq.qty) || 1));

      // 영업사원이 입력한 단가를 그대로 적용 (미입력/0원 입력 시에도 임의의 과거 계약 단가나 하드코딩된 추정 단가로 덮어쓰지 않고 0원 유지)
      const rawMonthly = eqData.monthlyRate ?? eqData.monthlyRent ?? eqData.monthlyRentalFee ?? 0;
      const rawDaily = eqData.dailyRate ?? eqData.dailyRent ?? eqData.dailyRentalFee;
      const determinedMonthly = Math.max(0, Number(rawMonthly) || 0);
      const determinedDaily = rawDaily !== undefined && rawDaily !== null && String(rawDaily).trim() !== ''
        ? Math.max(0, Number(rawDaily) || 0)
        : (determinedMonthly > 0 ? Math.round(determinedMonthly / 30) : 0);

      const eqCreatedCaIds: string[] = [];
      for(let i=0; i<count; i++) {
        const createdCa = db.insertRow<ContractAsset>('contractAssets', {
          contractId: contract.id,
          assetId: '',
          status: 'ASSIGNED',
          expectedModel: eq.modelName,
          monthlyRentalFee: determinedMonthly,
          dailyRentalFee: determinedDaily,
          startDate: targetStartDate || contract.startDate,
          firstStartDate: targetStartDate || contract.startDate,
          endDate: '',
          createdAt: new Date().toISOString()
        });
        if (createdCa?.id) eqCreatedCaIds.push(createdCa.id);
      }

      cargoItemsPayload.push({
        modelName: eq.modelName,
        count,
        contractAssetIds: eqCreatedCaIds,
        paidOptions: effectivePaidOptionsForDelivery,
        ...(effectivePaidOptionPricesForDelivery ? { paidOptionPrices: effectivePaidOptionPricesForDelivery } : {}),
        ...(effectivePaidOptionUnitsForDelivery ? { paidOptionUnits: effectivePaidOptionUnitsForDelivery } : {}),
        ...(effectivePaidOptionQtysForDelivery ? { paidOptionQtys: effectivePaidOptionQtysForDelivery } : {}),
        monthlyRentalFee: determinedMonthly,
        dailyRentalFee: determinedDaily,
        ...(cargoItemsPayload.length === 0 ? { requestMeta: requestSnapshotMeta } : {})
      });
    });

    await notify('🚚 [5/5 배차 생성] 배차/운송 관리 출고대기 지시건 생성 중...', 90);

    // 신규 배차 - 출고 대기 건 자동 생성 (출고 장비 ContractAsset ID 및 유상옵션 1:1 매핑 보존)
    const cargoItems = JSON.stringify(cargoItemsPayload);
    const loadingDateStr = extractDate(data.loadingTime) || contract.startDate;
    const getTimeSlot = (tStr: string | undefined) => {
      if (!tStr) return '오전';
      if (tStr.includes('ASAP')) return 'ASAP';
      if (tStr.includes('오전')) return '오전';
      if (tStr.includes('오후')) return '오후';
      const m = tStr.match(/\d{1,2}:\d{2}/);
      return m ? m[0] : (tStr.includes(' ') ? tStr.split(' ')[1] : '오전');
    };
    const loadingTimeSlotStr = getTimeSlot(data.loadingTime);
    const unloadingDateStr = extractDate(data.unloadingTime) || loadingDateStr || targetStartDate || contract.startDate;
    const unloadingTimeSlotStr = getTimeSlot(data.unloadingTime);

    const isExchangeDelivery = dData.type === 'EXCHANGE' || dData.context?.includes('EXCHANGE') || dData.rawText?.includes('교환');
    const isCustomerPaid = dData.paidBy === 'CUSTOMER' || !!dData.billableToCustomer;

    const retrievalMemo = dData.retrievalAssetIds && dData.retrievalAssetIds.length > 0
      ? ` | [대차회수대상] 자산 #${dData.retrievalAssetIds.join(', #')}`
      : '';
    const paidByMemo = dData.paidBy
      ? ` | [운송비부담] ${dData.paidBy === 'CUSTOMER' ? '고객청구' : dData.paidBy === 'OURS' ? '당사부담' : '편도지원'}`
      : '';
    const freightBillingStdMemo = ` | [운송료청구기준] ${dData.freightBillingStandard === '2/4' ? '2/4' : '3/5'}`;

    const defaultYard = currentTenant?.yards?.find((y: any) => y.isDefault) || currentTenant?.yards?.[0];
    const defaultYardAddress = currentTenant?.businessAddress || defaultYard?.address || currentTenant?.mainYardAddress || '당사 보관소';

    const resolvedSiteMasterId = finalSite?.siteMasterId || data.siteMasterId || (
      finalSite?.name ? db.siteMasters.find(m => m.name && m.name.replace(/\s/g, '') === finalSite.name.replace(/\s/g, ''))?.id : undefined
    );

    const nowOrderDate = new Date();
    const orderInputDateStr = `${nowOrderDate.getFullYear()}-${String(nowOrderDate.getMonth() + 1).padStart(2, '0')}-${String(nowOrderDate.getDate()).padStart(2, '0')}`;

    const createdDelivery = db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
      siteMasterId: resolvedSiteMasterId,
      type: isExchangeDelivery ? 'EXCHANGE' : 'OUTBOUND',
      dispatchCategory: isExchangeDelivery ? '교환' : '출고',
      status: 'REQUESTED',
      requestDate: orderInputDateStr,
      scheduledDate: loadingDateStr,
      loadingDate: loadingDateStr,
      loadingTimeSlot: loadingTimeSlotStr,
      unloadingDate: unloadingDateStr,
      unloadingTimeSlot: unloadingTimeSlotStr,
      originAddress: dData.originAddress || defaultYardAddress,
      destinationAddress: `${finalCustomer.name} (${finalSite.name} - ${finalSite.address || ''})`,
      transportCompany: '',
      vehicleType: dData.vehicleType || '5T',
      vehicleNo: '',
      driverName: '',
      driverContact: '',
      deliveryCost: 0,
      expectedCost: 0,
      finalCost: 0,
      billableToCustomer: isCustomerPaid,
      billableCustomerId: isCustomerPaid ? finalCustomer.id : undefined,
      reconciliationStatus: 'PENDING',
      cargoItems,
      isCostSettled: false,
      rawText: dData.userNote !== undefined ? String(dData.userNote).trim() : ((data as any).prompt || (data as any).rawText || ''),
      memo: appendDispatchStaffTag(`현장담당: ${data.siteContactName || '-'} (${data.siteContactPhone || '-'}) | 상차: ${data.loadingTime || '-'} / 하차: ${data.unloadingTime || '-'}${retrievalMemo}${paidByMemo}${freightBillingStdMemo} | 청구담당: ${data.billingContactName || '-'} (${data.billingContactPhone || '-'}) | 계산서: ${data.taxBillEmail || '-'} | 특이사항: ${data.note || '없음'}`),
      closingMemo: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await notify('🌐 Supabase 원격 DB 최종 2차 동기화 완료 중...', 96);

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('Supabase sync error during saveSmartDispatch:', err);
      
      // 💥 DB 저장 실패 시 생성되었던 임시 계약/배차/슬롯/이력 레코드 롤백 삭제!
      if (contract?.id) {
        db.deleteRow('contracts', contract.id);
        const addedCAssets = db.contractAssets.filter(ca => ca.contractId === contract.id);
        addedCAssets.forEach(ca => db.deleteRow('contractAssets', ca.id));
        const addedDeliveries = db.deliveries.filter(d => d.contractId === contract.id);
        addedDeliveries.forEach(d => db.deleteRow('deliveries', d.id));
        const addedHistories = db.contractHistory.filter(h => h.contractId === contract.id);
        addedHistories.forEach(h => db.deleteRow('contractHistory', h.id));
        // ✅ 고아 레코드 방지: 롤백 시 생성된 outboundInspections도 함께 삭제
        const addedInspections = db.outboundInspections.filter(i => i.contractId === contract.id);
        addedInspections.forEach(i => db.deleteRow('outboundInspections', i.id));
      }
      refreshAllData();

      const errorMsg = `⚠️ Supabase 데이터베이스 동기화 중 오류가 발생했습니다:\n\n■ [안내]: 저장 실패로 인해 생성 시도했던 데이터가 안전하게 자동 롤백 원복되었습니다.\n\n${err.message || err.details || JSON.stringify(err)}`;
      showErrorModal(errorMsg, '출고 DB 동기화 오류 (자동 원복 완료)');
      return { 
        success: false, 
        errorMessage: errorMsg
      };
    }

    await notify('🎉 [완료] 출고의뢰 생성을 성공적으로 완료하였습니다!', 100, 300);

    refreshAllData();

    // 🚀 [단일 업무 인계 파이프라인] 배차팀(배차 의뢰) 및 출고/주기장팀(장비 할당)에 물리 ToDo 영구 적재 + 실시간 브로드캐스트
    const totalEqCount = (data.equipments || []).reduce((acc: number, eq: any) => acc + (Number(eq.qty) || 1), 0);
    const modelSummaryStr = (data.equipments || [])
      .map((eq: any) => `${eq.modelName || '미지정'} × ${Number(eq.qty) || 1}대`)
      .join(', ');

    await issueHandoverTask({
      category: 'ASSET_ASSIGNMENT' as any,
      title: `[장비 할당] ${data.customerName || '고객사'} (미할당 ${totalEqCount}대)`,
      content: `${data.siteName || '현장'} | 미할당 요구: ${modelSummaryStr || `${totalEqCount}대`} | 출고예정: ${(data.loadingTime || '').slice(0, 10) || '미정'}`,
      targetDept: 'YARD',
      priority: 'HIGH',
      dueDate: (data.loadingTime || '').slice(0, 10) || undefined,
      actionUrl: `/admin/dispatch_assign?contractId=${contract.id}&deliveryId=${createdDelivery.id}`,
      entityType: 'DELIVERY',
      entityId: createdDelivery.id,
      senderId: currentUser?.id,
      senderName: currentUser?.name
    });

    await issueHandoverTask({
      category: 'DISPATCH_REQUEST',
      title: `[출고 배차 의뢰] ${data.customerName || '고객사'} (${totalEqCount}대)`,
      content: `${data.customerName || '고객사'} (${data.siteName || '현장'}) ${totalEqCount}대 출고 배차 요청 (상차: ${data.loadingTime || '미정'}, 하차: ${data.unloadingTime || '미정'})`,
      targetDept: 'DISPATCH',
      priority: 'HIGH',
      actionUrl: `/admin/dispatch?contractId=${contract.id}`,
      entityType: 'DELIVERY',
      entityId: createdDelivery.id,
      senderId: currentUser?.id,
      senderName: currentUser?.name
    });

    return { success: true, contractId: contract.id, contractNo: contract.contractNo };
  };

  // 🚫 출고 검수 완료 전 출고 요청 취소 트랜잭션 (장비 할당 해제 + 슬롯 제거 + 배차 CANCELLED + 이력/ToDo 정리)
  const cancelOutboundRequest = async (deliveryId: string, cancelReason?: string): Promise<{ success: boolean; errorMessage?: string }> => {
    const targetDelivery = db.deliveries.find(d => d.id === deliveryId);
    if (!targetDelivery) {
      showErrorModal('취소할 대상 출고 요청(배차)을 찾을 수 없습니다.');
      return { success: false, errorMessage: '출고 요청을 찾을 수 없습니다.' };
    }
    if (targetDelivery.status === 'CANCELLED') {
      showErrorModal('이미 취소된 출고 요청입니다.');
      return { success: false, errorMessage: '이미 취소된 출고 요청입니다.' };
    }

    // 1. cargoItems에서 contractAssetIds 추출
    let parsedCargo: any[] = [];
    try {
      if (targetDelivery.cargoItems) {
        const raw = JSON.parse(targetDelivery.cargoItems);
        if (Array.isArray(raw)) parsedCargo = raw;
      }
    } catch {
      parsedCargo = [];
    }

    const deliveryCaIds: string[] = [];
    parsedCargo.forEach(ci => {
      if (Array.isArray(ci?.contractAssetIds)) {
        deliveryCaIds.push(...ci.contractAssetIds.filter(Boolean));
      }
    });

    // 만약 cargoItems에 contractAssetIds가 없고 해당 계약에 이 배차 1건만 존재하는 초기/레거시 건이라면 계약 전체 슬롯 참조
    if (deliveryCaIds.length === 0 && targetDelivery.contractId) {
      const siblingOutboundDeliveries = db.deliveries.filter(
        d => d.contractId === targetDelivery.contractId && d.id !== targetDelivery.id && d.status !== 'CANCELLED' && (d.type === 'OUTBOUND' || d.type === 'EXCHANGE')
      );
      if (siblingOutboundDeliveries.length === 0) {
        db.contractAssets
          .filter(ca => ca.contractId === targetDelivery.contractId)
          .forEach(ca => deliveryCaIds.push(ca.id));
      }
    }

    // 2. 출고 검수 완료 여부 검증 (헌장 1.3: 출고 검수 완료되어 RENTED 전환된 건은 출고 요청 취소 불가)
    const matchedInsps = db.outboundInspections.filter(ins =>
      ins.deliveryId === deliveryId ||
      (deliveryCaIds.length > 0 && ins.contractAssetId && deliveryCaIds.includes(ins.contractAssetId) && (!targetDelivery.contractId || ins.contractId === targetDelivery.contractId)) ||
      (deliveryCaIds.length === 0 && targetDelivery.contractId && ins.contractId === targetDelivery.contractId)
    );
    const hasCompletedInspection = matchedInsps.some(
      ins => ins.status === 'COMPLETED' || (ins.status as string) === 'APPROVED'
    );
    const targetCas = db.contractAssets.filter(
      ca => deliveryCaIds.includes(ca.id) && (!targetDelivery.contractId || ca.contractId === targetDelivery.contractId)
    );
    const hasRentedAsset = targetCas.some(ca => {
      // 장비가 실제로 할당된 슬롯(ca.assetId 존재)이고 해당 자산이 실제 운송대기/대여중인 경우만 검수 완료로 간주
      if (!ca.assetId) return false;
      const a = db.assets.find(as => as.id === ca.assetId);
      if (a?.status === 'RENTED' || a?.status === 'AWAITING_TRANSPORT') return true;
      return false;
    });

    if (targetDelivery.status === 'DELIVERED' || targetDelivery.status === 'COMPLETED') {
      const msg = '운송이 완료된 건은 더이상 취소하거나 수정할 수 없습니다.';
      showErrorModal(msg, '취소/수정 불가');
      return { success: false, errorMessage: msg };
    }

    if (hasCompletedInspection || hasRentedAsset) {
      const msg = '출고 검수가 이미 완료(대여중 전환)된 출고 요청은 바로 취소할 수 없습니다.\n먼저 [출고 검수] 화면에서 [출고 승인 취소 (검수 롤백)]을 수행한 뒤, [장비 할당]에서 할당 취소를 진행해 주십시오.';
      showErrorModal(msg, '출고 요청 취소 불가 (출고검수 완료 상태)');
      return { success: false, errorMessage: msg };
    }

    const hasAssignedAsset = targetCas.some(ca => !!ca.assetId);
    const isDispatched = targetDelivery.status === 'DISPATCHED';

    if (isDispatched && hasAssignedAsset) {
      const msg = '배차완료 및 장비할당이 진행된 출고 요청은 바로 취소할 수 없습니다.\n먼저 [배차/운송 관리]에서 [배차 취소]를 수행하고, [장비 할당]에서 [할당 취소]를 완료한 후 출고 취소를 진행해 주십시오.';
      showErrorModal(msg, '출고 요청 취소 불가 (선행 단계 취소 필요)');
      return { success: false, errorMessage: msg };
    }

    if (isDispatched) {
      const msg = '배차완료(차량·기사 배정) 상태인 출고 요청은 바로 취소할 수 없습니다.\n먼저 [배차/운송 관리]에서 [배차 취소]를 수행하여 [배차대기] 상태로 되돌린 후 출고 취소를 진행해 주십시오.';
      showErrorModal(msg, '출고 요청 취소 불가 (배차 취소 필요)');
      return { success: false, errorMessage: msg };
    }

    if (hasAssignedAsset) {
      const msg = '장비가 할당된 상태에서는 출고 요청을 바로 취소할 수 없습니다.\n먼저 [장비 할당] 메뉴에서 할당된 장비의 [할당 취소]를 수행하여 미할당 상태로 되돌린 후 출고 취소를 진행해 주십시오.';
      showErrorModal(msg, '출고 요청 취소 불가 (장비 할당 취소 필요)');
      return { success: false, errorMessage: msg };
    }

    // 3. 롤백용 스냅샷 백업
    const deliverySnapshot = { ...targetDelivery };
    const caSnapshots = targetCas.map(ca => ({ ...ca }));
    const assetSnapshots: Asset[] = [];
    const inspSnapshots = matchedInsps.map(i => ({ ...i }));
    const parentContract = targetDelivery.contractId ? db.contracts.find(c => c.id === targetDelivery.contractId) : undefined;
    const contractSnapshot = parentContract ? { ...parentContract } : null;

    targetCas.forEach(ca => {
      if (ca.assetId) {
        const a = db.assets.find(as => as.id === ca.assetId);
        if (a) assetSnapshots.push({ ...a });
      }
    });

    try {
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split('T')[0];
      const actorName = currentUser?.name || '담당자';
      const cleanReason = (cancelReason || '').trim() || '출고 검수 전 요청 취소';

      // 4. 할당된 장비가 있으면 임대가능로 복원
      for (const ca of targetCas) {
        if (ca.assetId) {
          const origAsset = db.assets.find(a => a.id === ca.assetId);
          if (origAsset) {
            db.updateRow<Asset>('assets', origAsset.id, {
              status: 'AVAILABLE',
              currentCustomerId: null as any,
              currentSiteId: null as any,
              contractStart: null as any,
              contractEnd: null as any,
              updatedAt: nowIso
            });
          }
        }
      }

      // 5. 대기 중인 출고 검수 레코드 삭제
      for (const ins of matchedInsps) {
        db.deleteRow('outboundInspections', ins.id);
      }

      // 6. 해당 출고 요청으로 생성된 계약 자산 슬롯 삭제
      for (const ca of targetCas) {
        db.deleteRow('contractAssets', ca.id);
      }

      // 7. 부모 계약에 남은 슬롯 확인 및 계약 이력 기록
      if (parentContract) {
        const remainingCas = db.contractAssets.filter(
          ca => ca.contractId === parentContract.id && !deliveryCaIds.includes(ca.id)
        );
        const equipSummary = parsedCargo.map(ci => `${ci.modelName || '장비'} ${ci.count || 1}대`).join(', ');

        db.insertRow<ContractHistory>('contractHistory', {
          contractId: parentContract.id,
          changeType: 'TERMINATE',
          changeDate: todayStr,
          prevEndDate: parentContract.endDate || '',
          newEndDate: todayStr,
          description: `[출고 요청 취소] 배차번호 ${targetDelivery.id} (${equipSummary || `${targetCas.length}대`}) 출고 검수 전 취소 처리 (처리자: ${actorName}, 사유: ${cleanReason})`,
          createdAt: nowIso
        });

        // 남은 계약 자산 슬롯이 0개이고 청구서가 발행되지 않은 신규 계약이라면 계약을 COMPLETED(종료) 마감하여 유령 활성 계약 방지
        const hasActiveBillings = db.billings.some(b => b.contractId === parentContract.id && b.status !== 'REJECTED');
        if (remainingCas.length === 0 && !hasActiveBillings) {
          db.updateRow<Contract>('contracts', parentContract.id, {
            status: 'COMPLETED',
            endDate: todayStr,
            updatedAt: nowIso
          });
        }
      }

      // 8. 배차 상태를 CANCELLED로 업데이트하고 삭제된 슬롯 ID(contractAssetIds) 비우기 및 취소 메타 보존
      const updatedCargo = parsedCargo.map((ci, idx) => {
        const cleanedItem = {
          ...ci,
          contractAssetIds: []
        };
        if (idx === 0) {
          return {
            ...cleanedItem,
            requestMeta: {
              ...(ci.requestMeta || {}),
              cancelledAt: nowIso,
              cancelledBy: actorName,
              cancelReason: cleanReason
            }
          };
        }
        return cleanedItem;
      });

      const cancelClosingNote = `[출고취소 ${todayStr} ${actorName}] 사유: ${cleanReason}`;
      db.updateRow<Delivery>('deliveries', targetDelivery.id, {
        status: 'CANCELLED',
        cargoItems: updatedCargo.length > 0 ? JSON.stringify(updatedCargo) : targetDelivery.cargoItems,
        closingMemo: targetDelivery.closingMemo
          ? `${targetDelivery.closingMemo} | ${cancelClosingNote}`
          : cancelClosingNote,
        updatedAt: nowIso
      });

      // 9. 관련 미완료 ToDo 상계 완료 처리
      const relatedTodos = db.todos.filter(
        t => !t.isCompleted && (t.entityId === targetDelivery.id || t.relatedEntityId === targetDelivery.id)
      );
      relatedTodos.forEach(t => {
        db.updateRow<Todo>('todos', t.id, {
          isCompleted: true,
          completedAt: nowIso,
          completedByUserId: currentUser?.id,
          completedByName: actorName,
          completionAction: 'OUTBOUND_REQUEST_CANCELLED',
          updatedAt: nowIso
        });
      });

      // 10. 원격 DB 동기 대기 및 상태 리프레시 (헌장 5.2)
      await db.awaitPendingWrites();
      refreshAllData();
      return { success: true };
    } catch (err: any) {
      console.error('cancelOutboundRequest error & Rollback:', err);
      // 롤백 복구
      db.updateRow<Delivery>('deliveries', deliverySnapshot.id, deliverySnapshot);
      caSnapshots.forEach(ca => {
        if (!db.contractAssets.some(existing => existing.id === ca.id)) {
          db.insertRow<ContractAsset>('contractAssets', ca);
        } else {
          db.updateRow<ContractAsset>('contractAssets', ca.id, ca);
        }
      });
      assetSnapshots.forEach(a => db.updateRow<Asset>('assets', a.id, a));
      inspSnapshots.forEach(i => {
        if (!db.outboundInspections.some(existing => existing.id === i.id)) {
          db.insertRow<OutboundInspection>('outboundInspections', i);
        }
      });
      if (contractSnapshot) {
        db.updateRow<Contract>('contracts', contractSnapshot.id, contractSnapshot);
      }
      refreshAllData();

      const errMsg = err?.message || err?.details || JSON.stringify(err);
      showErrorModal(`⚠️ 출고 요청 취소 중 DB 동기화 오류가 발생하여 원복되었습니다:\n\n${errMsg}`, '출고 요청 취소 실패');
      return { success: false, errorMessage: errMsg };
    }
  };

  // 🗑️ 취소된 출고 요청(status === 'CANCELLED') 영구 삭제 및 잔여 슬롯/유령 계약 정리 트랜잭션
  const deleteCancelledOutboundRequests = async (deliveryIds?: string[]): Promise<{ success: boolean; deletedCount: number; errorMessage?: string }> => {
    const idSet = deliveryIds && deliveryIds.length > 0 ? new Set(deliveryIds) : null;
    const targets = db.deliveries.filter(d => {
      if (d.status !== 'CANCELLED') return false;
      const isOutboundOrExchange = d.type === 'OUTBOUND' || d.type === 'EXCHANGE' || d.dispatchCategory === '출고' || d.dispatchCategory === '교환';
      if (!isOutboundOrExchange) return false;
      if (idSet && !idSet.has(d.id)) return false;
      return true;
    });

    if (targets.length === 0) {
      return { success: false, deletedCount: 0, errorMessage: '삭제할 취소 상태의 출고 요청이 없습니다.' };
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    try {
      const affectedContractIds = new Set<string>();
      const deletedDeliveryIdSet = new Set(targets.map(t => t.id));

      for (const deliv of targets) {
        if (deliv.contractId) affectedContractIds.add(deliv.contractId);

        // 1. cargoItems 내 contractAssetIds 추출
        let parsedCargo: any[] = [];
        try {
          if (deliv.cargoItems) {
            const raw = JSON.parse(deliv.cargoItems);
            if (Array.isArray(raw)) parsedCargo = raw;
          }
        } catch {
          parsedCargo = [];
        }

        const caIds: string[] = [];
        parsedCargo.forEach(ci => {
          if (Array.isArray(ci?.contractAssetIds)) {
            caIds.push(...ci.contractAssetIds.filter(Boolean));
          }
        });

        // 레거시 취소 건(배차 관리에서 단순 CANCELLED만 찍혀 슬롯이 남아있던 건)의 슬롯 정리
        if (caIds.length === 0 && deliv.contractId) {
          const activeSiblingDeliveries = db.deliveries.filter(
            d => d.contractId === deliv.contractId && !deletedDeliveryIdSet.has(d.id) && d.status !== 'CANCELLED'
          );
          if (activeSiblingDeliveries.length === 0) {
            db.contractAssets
              .filter(ca => ca.contractId === deliv.contractId && ca.status !== 'RENTED')
              .forEach(ca => caIds.push(ca.id));
          }
        }

        // 2. 잔여 출고검수 레코드 삭제
        const leftoverInsps = db.outboundInspections.filter(
          ins => ins.deliveryId === deliv.id || (ins.contractAssetId && caIds.includes(ins.contractAssetId) && (!deliv.contractId || ins.contractId === deliv.contractId))
        );
        leftoverInsps.forEach(ins => db.deleteRow('outboundInspections', ins.id));

        // 3. 잔여 계약 자산 슬롯 정리 및 연결 장비 임대가능(AVAILABLE) 복원
        const leftoverCas = db.contractAssets.filter(
          ca => caIds.includes(ca.id) && (!deliv.contractId || ca.contractId === deliv.contractId)
        );
        for (const ca of leftoverCas) {
          const targetAssetId = ca.assetId;
          db.deleteRow('contractAssets', ca.id);
          if (targetAssetId) {
            const hasOtherActiveCa = db.contractAssets.some(
              other => other.id !== ca.id && other.assetId === targetAssetId && other.status !== 'RETURNED' && other.status !== 'SOLD'
            );
            if (!hasOtherActiveCa) {
              const a = db.assets.find(as => as.id === targetAssetId);
              if (a && (a.status === 'ASSIGNED' || a.status === 'RENTED')) {
                db.updateRow<Asset>('assets', a.id, {
                  status: 'AVAILABLE',
                  currentCustomerId: null as any,
                  currentSiteId: null as any,
                  contractStart: null as any,
                  contractEnd: null as any,
                  updatedAt: nowIso
                });
              }
            }
          }
        }

        // 4. 연결된 ToDo 삭제
        const relTodos = db.todos.filter(t => t.entityId === deliv.id || t.relatedEntityId === deliv.id);
        relTodos.forEach(t => db.deleteRow('todos', t.id));

        // 5. 취소된 출고 요청(배차) 레코드 영구 삭제
        db.deleteRow('deliveries', deliv.id);
      }

      // 6. 영향받은 계약 중 남은 슬롯·배차·청구서가 전혀 없는 유령 계약 정리
      affectedContractIds.forEach(contractId => {
        const contract = db.contracts.find(c => c.id === contractId);
        if (!contract) return;
        const remCas = db.contractAssets.filter(ca => ca.contractId === contractId);
        const remDeliveries = db.deliveries.filter(d => d.contractId === contractId);
        const remBillings = db.billings.filter(b => b.contractId === contractId);
        if (remCas.length === 0 && remDeliveries.length === 0 && remBillings.length === 0) {
          const relHist = db.contractHistory.filter(h => h.contractId === contractId);
          relHist.forEach(h => db.deleteRow('contractHistory', h.id));
          db.deleteRow('contracts', contractId);
        } else if (remCas.length === 0 && remBillings.length === 0 && contract.status === 'ACTIVE') {
          db.updateRow<Contract>('contracts', contractId, {
            status: 'COMPLETED',
            endDate: todayStr,
            updatedAt: nowIso
          });
        }
      });

      await db.awaitPendingWrites();
      refreshAllData();
      return { success: true, deletedCount: targets.length };
    } catch (err: any) {
      console.error('deleteCancelledOutboundRequests error:', err);
      const errMsg = err?.message || err?.details || JSON.stringify(err);
      showErrorModal(`취소한 출고 요청 삭제 중 오류가 발생했습니다:\n${errMsg}`, '삭제 실패');
      return { success: false, deletedCount: 0, errorMessage: errMsg };
    }
  };

  // 💰 출고 요청 내역 수정 (요청 모델/수량/삭제/추가, 옵션 변경, 유상옵션 청구조건·단가, 상하차일시 및 계약개시일 수정) 트랜잭션
  const updateOutboundRequestPricing = async (params: {
    deliveryId: string;
    allowCompletedModify?: boolean;
    equipments?: { contractAssetIds?: string[]; modelName: string; qty: number; monthlyRate: number; dailyRate: number }[];
    equipmentRates?: { modelName: string; monthlyRate: number; dailyRate: number }[];
    paidOptions?: string;
    protection?: string;
    attachments?: string;
    checkedSpecs?: Record<string, any>;
    paidOptionPrices?: Record<string, number>;
    paidOptionUnits?: Record<string, '월' | '대' | '건' | '수량'>;
    paidOptionQtys?: Record<string, number>;
    loadingDate?: string;
    loadingTimeSlot?: string;
    unloadingDate?: string;
    unloadingTimeSlot?: string;
    reason?: string;
  }): Promise<{ success: boolean; errorMessage?: string }> => {
    if (db.isSupabaseConnected()) {
      try {
        await Promise.all([
          db.pullTableFromSupabase('contracts'),
          db.pullTableFromSupabase('contractAssets'),
          db.pullTableFromSupabase('deliveries'),
          db.pullTableFromSupabase('outboundInspections')
        ]);
      } catch (pullErr) {
        console.warn('updateOutboundRequestPricing pre-sync warning:', pullErr);
      }
    }

    const targetDelivery = db.deliveries.find(d => d.id === params.deliveryId);
    if (!targetDelivery) {
      showErrorModal('수정할 출고 요청을 찾을 수 없습니다.');
      return { success: false, errorMessage: '출고 요청을 찾을 수 없습니다.' };
    }
    if (!params.allowCompletedModify && (targetDelivery.status === 'DELIVERED' || targetDelivery.status === 'COMPLETED')) {
      const msg = '운송이 완료된 건은 일반 수정할 수 없습니다. [계약의 수정(완결된 출고의 수정)] 품의를 이용해 주십시오.';
      showErrorModal(msg, '취소/수정 불가');
      return { success: false, errorMessage: msg };
    }

    const origLoadingDate = (targetDelivery.loadingDate || '').trim();
    const origLoadingSlot = (targetDelivery.loadingTimeSlot || '').trim();
    const origUnloadingDate = (targetDelivery.unloadingDate || targetDelivery.loadingDate || '').trim();
    const origUnloadingSlot = (targetDelivery.unloadingTimeSlot || targetDelivery.loadingTimeSlot || '').trim();

    const nextLoadingDate = params.loadingDate !== undefined ? params.loadingDate.trim() : origLoadingDate;
    const nextLoadingSlot = params.loadingTimeSlot !== undefined ? params.loadingTimeSlot.trim() : origLoadingSlot;
    const nextUnloadingDate = params.unloadingDate !== undefined ? params.unloadingDate.trim() : origUnloadingDate;
    const nextUnloadingSlot = params.unloadingTimeSlot !== undefined ? params.unloadingTimeSlot.trim() : origUnloadingSlot;

    if (nextLoadingDate && nextUnloadingDate && nextLoadingDate > nextUnloadingDate) {
      const msg = '상차일이 하차일보다 늦을 수 없습니다. 일자를 확인해 주십시오.';
      showErrorModal(msg, '상하차 일자 확인');
      return { success: false, errorMessage: msg };
    }

    let parsedCargo: any[] = [];
    try {
      if (targetDelivery.cargoItems) {
        const raw = JSON.parse(targetDelivery.cargoItems);
        if (Array.isArray(raw)) parsedCargo = raw;
      }
    } catch {
      parsedCargo = [];
    }

    const deliverySnapshot = { ...targetDelivery };
    const contractSnapshot = targetDelivery.contractId
      ? (() => {
          const c = db.contracts.find(ct => ct.id === targetDelivery.contractId);
          return c ? { ...c } : null;
        })()
      : null;
    const caSnapshots: ContractAsset[] = [];
    const deletedCas: ContractAsset[] = [];
    const createdCaIds: string[] = [];
    const assetSnapshots: Asset[] = [];
    const deletedInspections: OutboundInspection[] = [];

    try {
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split('T')[0];
      const actorName = currentUser?.name || '담당자';
      const changeLogs: string[] = [];

      if (params.loadingDate !== undefined || params.loadingTimeSlot !== undefined) {
        if (origLoadingDate !== nextLoadingDate || origLoadingSlot !== nextLoadingSlot) {
          changeLogs.push(`상차일시: [${origLoadingDate || '-'} ${origLoadingSlot}]➔[${nextLoadingDate || '-'} ${nextLoadingSlot}]`);
        }
      }
      if (params.unloadingDate !== undefined || params.unloadingTimeSlot !== undefined) {
        if (origUnloadingDate !== nextUnloadingDate || origUnloadingSlot !== nextUnloadingSlot) {
          changeLogs.push(`하차일시(계약개시일): [${origUnloadingDate || '-'} ${origUnloadingSlot}]➔[${nextUnloadingDate || '-'} ${nextUnloadingSlot}]`);
        }
      }

      const baseMeta = parsedCargo.find(ci => ci?.requestMeta)?.requestMeta || {};
      const nextLoadingTimeStr = `${nextLoadingDate} ${nextLoadingSlot}`.trim() || baseMeta?.loadingTime || '';
      const nextUnloadingTimeStr = `${nextUnloadingDate} ${nextUnloadingSlot}`.trim() || baseMeta?.unloadingTime || '';
      const origPaidOptions = parsedCargo[0]?.paidOptions ?? '';
      const origPrices: Record<string, number> = parsedCargo[0]?.paidOptionPrices || baseMeta?.paidOptionPrices || {};
      const origUnits: Record<string, '월' | '대' | '건' | '수량'> = parsedCargo[0]?.paidOptionUnits || baseMeta?.paidOptionUnits || {};
      const origQtys: Record<string, number> = parsedCargo[0]?.paidOptionQtys || baseMeta?.paidOptionQtys || {};

      const nextPaidOptions = params.paidOptions !== undefined ? params.paidOptions : origPaidOptions;
      const nextProtection = params.protection !== undefined ? params.protection : (baseMeta?.protection ?? '');
      const nextAttachments = params.attachments !== undefined ? params.attachments : (baseMeta?.attachments ?? '');
      const nextPrices: Record<string, number> = params.paidOptionPrices !== undefined
        ? { ...origPrices, ...params.paidOptionPrices }
        : origPrices;
      const rawNextCheckedSpecs = params.checkedSpecs !== undefined ? params.checkedSpecs : baseMeta?.checkedSpecs;
      const nextCheckedSpecs = (rawNextCheckedSpecs !== undefined || Object.keys(nextPrices).length > 0)
        ? mergeOptionPricesIntoSpecs(
            {
              ...(baseMeta?.checkedSpecs?.__optionMeta && typeof baseMeta.checkedSpecs.__optionMeta === 'object' ? { __optionMeta: baseMeta.checkedSpecs.__optionMeta } : {}),
              ...(rawNextCheckedSpecs || {})
            },
            db.standardOptions,
            nextPrices
          )
        : undefined;
      const nextUnits: Record<string, '월' | '대' | '건' | '수량'> = params.paidOptionUnits !== undefined
        ? { ...origUnits, ...params.paidOptionUnits }
        : origUnits;
      const nextQtys: Record<string, number> = params.paidOptionQtys !== undefined
        ? { ...origQtys, ...params.paidOptionQtys }
        : origQtys;

      if (params.paidOptions !== undefined && params.paidOptions !== origPaidOptions) {
        changeLogs.push(`유상옵션: [${origPaidOptions || '없음'}]➔[${params.paidOptions || '없음'}]`);
      }
      if (params.protection !== undefined && params.protection !== (baseMeta?.protection ?? '')) {
        changeLogs.push(`무상옵션: [${baseMeta?.protection || '없음'}]➔[${params.protection || '없음'}]`);
      }
      if (params.attachments !== undefined && params.attachments !== (baseMeta?.attachments ?? '')) {
        changeLogs.push(`부착물: [${baseMeta?.attachments || '없음'}]➔[${params.attachments || '없음'}]`);
      }
      if (params.paidOptionUnits) {
        Object.entries(params.paidOptionUnits).forEach(([optName, newUnit]) => {
          const oldUnit = origUnits[optName];
          if (oldUnit !== newUnit) {
            changeLogs.push(`유상옵션(${optName}) 청구조건: ${oldUnit || '기본'}➔${newUnit}`);
          }
        });
      }
      if (params.paidOptionQtys) {
        Object.entries(params.paidOptionQtys).forEach(([optName, newQty]) => {
          const oldQty = origQtys[optName] || 1;
          if (oldQty !== newQty) {
            const effU = nextUnits[optName] || '대';
            changeLogs.push(`유상옵션(${optName}) ${effU === '수량' ? '수량' : '1대당 수량'}: ${oldQty}개➔${newQty}개`);
          }
        });
      }
      if (params.paidOptionPrices) {
        Object.entries(params.paidOptionPrices).forEach(([optName, newVal]) => {
          const oldVal = origPrices[optName];
          if (oldVal !== newVal) {
            changeLogs.push(`유상옵션(${optName}) 단가: ${(oldVal ?? 0).toLocaleString()}원➔${Number(newVal).toLocaleString()}원`);
          }
        });
      }

      let updatedCargo: any[] = [];

      // Case A: 미완료 출고 요청 전체 장비(모델 수정, 수량 변경, 모델 삭제, 신규 모델 추가) 및 단가 편집
      if (params.equipments && params.equipments.length > 0) {
        const mergedEqs: { contractAssetIds: string[]; modelName: string; qty: number; monthlyRate: number; dailyRate: number }[] = [];
        params.equipments.forEach(eq => {
          const cleanModel = String(eq.modelName || '').trim();
          if (!cleanModel) return;
          const cleanQty = Math.max(1, Math.floor(Number(eq.qty) || 1));
          const cleanM = Math.max(0, Number(eq.monthlyRate || 0));
          const cleanD = Math.max(0, Number(eq.dailyRate || (cleanM ? Math.round(cleanM / 30) : 0)));
          const existing = mergedEqs.find(m => m.modelName === cleanModel);
          if (existing) {
            existing.qty += cleanQty;
            if (Array.isArray(eq.contractAssetIds)) {
              eq.contractAssetIds.forEach(id => {
                if (id && !existing.contractAssetIds.includes(id)) existing.contractAssetIds.push(id);
              });
            }
            existing.monthlyRate = cleanM;
            existing.dailyRate = cleanD;
          } else {
            mergedEqs.push({
              contractAssetIds: Array.isArray(eq.contractAssetIds) ? [...eq.contractAssetIds.filter(Boolean)] : [],
              modelName: cleanModel,
              qty: cleanQty,
              monthlyRate: cleanM,
              dailyRate: cleanD
            });
          }
        });

        // 기존 배차에 속했던 모든 ContractAsset ID 수집
        const allOriginalCaIds = new Set<string>();
        parsedCargo.forEach(ci => {
          if (Array.isArray(ci?.contractAssetIds)) {
            ci.contractAssetIds.forEach((id: string) => {
              if (id) allOriginalCaIds.add(id);
            });
          }
        });
        db.outboundInspections
          .filter(ins => ins.deliveryId === targetDelivery.id && (ins as any).contractAssetId)
          .forEach(ins => allOriginalCaIds.add((ins as any).contractAssetId));
        if (allOriginalCaIds.size === 0 && targetDelivery.contractId) {
          db.contractAssets
            .filter(ca => ca.contractId === targetDelivery.contractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD' && (params.allowCompletedModify || !ca.assetId || ca.status === 'ASSIGNED'))
            .forEach(ca => allOriginalCaIds.add(ca.id));
        }

        const oldSummary = parsedCargo.map(ci => `${ci.modelName} ${ci.count || ci.qty || 1}대(월 ${(ci.monthlyRentalFee || 0).toLocaleString()}원)`).join(', ');
        const newSummary = mergedEqs.map(eq => `${eq.modelName} ${eq.qty}대(월 ${eq.monthlyRate.toLocaleString()}원)`).join(', ');
        if (oldSummary !== newSummary) {
          changeLogs.push(`요청 장비: [${oldSummary || '없음'}] ➔ [${newSummary}]`);
        }

        const keptCaIds = new Set<string>();
        const targetContract = targetDelivery.contractId ? db.contracts.find(c => c.id === targetDelivery.contractId) : undefined;
        const startDateStr = (nextUnloadingDate || nextLoadingDate || targetDelivery.scheduledDate || targetContract?.startDate || todayStr).slice(0, 10);

        const releaseAssignedAssetOnCa = (ca: ContractAsset) => {
          if (!ca.assetId) return;
          const assignedAsset = db.assets.find(a => a.id === ca.assetId);
          if (assignedAsset) {
            if (!assetSnapshots.some(s => s.id === assignedAsset.id)) {
              assetSnapshots.push({ ...assignedAsset });
            }
            db.updateRow<Asset>('assets', assignedAsset.id, {
              status: 'AVAILABLE',
              currentCustomerId: null as any,
              currentSiteId: null as any,
              contractStart: null as any,
              contractEnd: null as any
            });
          }
          db.outboundInspections
            .filter(ins => ins.deliveryId === targetDelivery.id && (ins.assetId === ca.assetId || (ins as any).contractAssetId === ca.id))
            .forEach(ins => {
              if (!deletedInspections.some(d => d.id === ins.id)) {
                deletedInspections.push({ ...ins });
              }
              db.deleteRow('outboundInspections', ins.id);
            });
        };

        mergedEqs.forEach((eq, idx) => {
          let existingCas = eq.contractAssetIds
            .map(id => db.contractAssets.find(c => c.id === id && (!targetDelivery.contractId || c.contractId === targetDelivery.contractId)))
            .filter((c): c is ContractAsset => Boolean(c));

          if (existingCas.length === 0 && allOriginalCaIds.size > 0) {
            const unclaimedCas = Array.from(allOriginalCaIds)
              .filter(id => !keptCaIds.has(id))
              .map(id => db.contractAssets.find(c => c.id === id && (!targetDelivery.contractId || c.contractId === targetDelivery.contractId)))
              .filter((c): c is ContractAsset => Boolean(c));
            const sameModelCas = unclaimedCas.filter(c => c.expectedModel === eq.modelName);
            existingCas = sameModelCas.length > 0 ? sameModelCas : (mergedEqs.length === 1 ? unclaimedCas : []);
          }

          // 모델이 변경된 경우 이미 할당된 장비가 새 모델과 다르면 할당 해제
          existingCas.forEach(ca => {
            if (ca.assetId) {
              const assignedAsset = db.assets.find(a => a.id === ca.assetId);
              if (assignedAsset && assignedAsset.modelName !== eq.modelName) {
                if (!caSnapshots.some(s => s.id === ca.id)) {
                  caSnapshots.push({ ...ca });
                }
                releaseAssignedAssetOnCa(ca);
                db.updateRow<ContractAsset>('contractAssets', ca.id, {
                  assetId: '',
                  status: 'ASSIGNED'
                });
                ca.assetId = '';
              }
            }
          });

          // 유효하게 장비가 할당된 슬롯을 우선 보존
          const sortedCas = [...existingCas].sort((a, b) => (b.assetId ? 1 : 0) - (a.assetId ? 1 : 0));
          const toKeep = sortedCas.slice(0, eq.qty);
          const finalCaIdsForRow: string[] = [];

          toKeep.forEach(ca => {
            keptCaIds.add(ca.id);
            finalCaIdsForRow.push(ca.id);
            if (!caSnapshots.some(s => s.id === ca.id)) {
              caSnapshots.push({ ...ca });
            }
            db.updateRow<ContractAsset>('contractAssets', ca.id, {
              expectedModel: eq.modelName,
              monthlyRentalFee: eq.monthlyRate,
              dailyRentalFee: eq.dailyRate
            });
            if (ca.assetId) {
              const assignedAsset = db.assets.find(a => a.id === ca.assetId);
              if (assignedAsset) {
                if (!assetSnapshots.some(s => s.id === assignedAsset.id)) {
                  assetSnapshots.push({ ...assignedAsset });
                }
                db.updateRow<Asset>('assets', assignedAsset.id, {
                  monthlyRentalFee: eq.monthlyRate,
                  dailyRentalFee: eq.dailyRate
                });
              }
            }
          });

          // 수량 증가 또는 신규 모델 추가 시 새 ContractAsset 슬롯 생성
          const needMore = eq.qty - toKeep.length;
          if (needMore > 0 && targetDelivery.contractId) {
            for (let i = 0; i < needMore; i++) {
              const createdCa = db.insertRow<ContractAsset>('contractAssets', {
                contractId: targetDelivery.contractId,
                assetId: '',
                status: 'ASSIGNED',
                expectedModel: eq.modelName,
                monthlyRentalFee: eq.monthlyRate,
                dailyRentalFee: eq.dailyRate,
                startDate: startDateStr,
                firstStartDate: startDateStr,
                endDate: '',
                createdAt: nowIso
              });
              if (createdCa?.id) {
                createdCaIds.push(createdCa.id);
                keptCaIds.add(createdCa.id);
                finalCaIdsForRow.push(createdCa.id);
              }
            }
          }

          const updatedMeta = {
            ...baseMeta,
            ...(nextLoadingTimeStr ? { loadingTime: nextLoadingTimeStr } : {}),
            ...(nextUnloadingTimeStr ? { unloadingTime: nextUnloadingTimeStr } : {}),
            protection: nextProtection,
            attachments: nextAttachments,
            ...(nextCheckedSpecs !== undefined ? { checkedSpecs: nextCheckedSpecs } : {}),
            ...(Object.keys(nextPrices).length > 0 ? { paidOptionPrices: nextPrices } : {}),
            ...(Object.keys(nextUnits).length > 0 ? { paidOptionUnits: nextUnits } : {}),
            ...(Object.keys(nextQtys).length > 0 ? { paidOptionQtys: nextQtys } : {})
          };

          updatedCargo.push({
            modelName: eq.modelName,
            count: eq.qty,
            contractAssetIds: finalCaIdsForRow,
            paidOptions: nextPaidOptions,
            ...(Object.keys(nextPrices).length > 0 ? { paidOptionPrices: nextPrices } : {}),
            ...(Object.keys(nextUnits).length > 0 ? { paidOptionUnits: nextUnits } : {}),
            ...(Object.keys(nextQtys).length > 0 ? { paidOptionQtys: nextQtys } : {}),
            monthlyRentalFee: eq.monthlyRate,
            dailyRentalFee: eq.dailyRate,
            ...(idx === 0 ? { requestMeta: updatedMeta } : {})
          });
        });

        // 삭제된 모델 또는 수량 감소로 인해 제외된 기존 ContractAsset 슬롯 정리 (타 계약 슬롯 절대 건드리지 않음)
        allOriginalCaIds.forEach(origCaId => {
          if (!keptCaIds.has(origCaId)) {
            const caObj = db.contractAssets.find(c => c.id === origCaId && (!targetDelivery.contractId || c.contractId === targetDelivery.contractId));
            if (caObj) {
              releaseAssignedAssetOnCa(caObj);
              deletedCas.push({ ...caObj });
              db.deleteRow('contractAssets', caObj.id);
            }
          }
        });
      } else {
        // Case B: 단가/옵션 또는 상하차 일정만 수정하는 경우
        updatedCargo = parsedCargo.map((ci, idx) => {
          const nextCi = { ...ci };

          if (params.equipmentRates && params.equipmentRates.length > 0) {
            const matchedRate = params.equipmentRates.find(r => r.modelName === ci.modelName);
            if (matchedRate) {
              const oldM = Number(ci.monthlyRentalFee || 0);
              const oldD = Number(ci.dailyRentalFee || 0);
              const newM = Number(matchedRate.monthlyRate || 0);
              const newD = Number(matchedRate.dailyRate || (newM ? Math.round(newM / 30) : 0));

              if (oldM !== newM || oldD !== newD) {
                changeLogs.push(`${ci.modelName} 렌탈료: 월 ${oldM.toLocaleString()}원➔${newM.toLocaleString()}원 / 일 ${oldD.toLocaleString()}원➔${newD.toLocaleString()}원`);
              }
              nextCi.monthlyRentalFee = newM;
              nextCi.dailyRentalFee = newD;

              const caIds: string[] = Array.isArray(ci.contractAssetIds) ? [...ci.contractAssetIds] : [];
              if (caIds.length === 0) {
                db.outboundInspections
                  .filter(ins => ins.deliveryId === targetDelivery.id && (ins as any).contractAssetId)
                  .forEach(ins => {
                    const caId = (ins as any).contractAssetId;
                    const caObj = db.contractAssets.find(c => c.id === caId && (!targetDelivery.contractId || c.contractId === targetDelivery.contractId));
                    if (caObj && (!ci.modelName || caObj.expectedModel === ci.modelName) && !caIds.includes(caId)) {
                      caIds.push(caId);
                    }
                  });
              }
              caIds.forEach(caId => {
                const caObj = db.contractAssets.find(c => c.id === caId && (!targetDelivery.contractId || c.contractId === targetDelivery.contractId));
                if (caObj) {
                  if (!caSnapshots.some(s => s.id === caObj.id)) {
                    caSnapshots.push({ ...caObj });
                  }
                  db.updateRow<ContractAsset>('contractAssets', caObj.id, {
                    monthlyRentalFee: newM,
                    dailyRentalFee: newD
                  });
                }
              });
            }
          }

          nextCi.paidOptions = nextPaidOptions;
          if (Object.keys(nextPrices).length > 0) {
            nextCi.paidOptionPrices = nextPrices;
          }
          if (Object.keys(nextUnits).length > 0) {
            nextCi.paidOptionUnits = nextUnits;
          }
          if (Object.keys(nextQtys).length > 0) {
            nextCi.paidOptionQtys = nextQtys;
          }
          if (idx === 0 || nextCi.requestMeta) {
            nextCi.requestMeta = {
              ...(nextCi.requestMeta || baseMeta),
              ...(nextLoadingTimeStr ? { loadingTime: nextLoadingTimeStr } : {}),
              ...(nextUnloadingTimeStr ? { unloadingTime: nextUnloadingTimeStr } : {}),
              protection: nextProtection,
              attachments: nextAttachments,
              ...(nextCheckedSpecs !== undefined ? { checkedSpecs: nextCheckedSpecs } : {}),
              ...(Object.keys(nextPrices).length > 0 ? { paidOptionPrices: nextPrices } : {}),
              ...(Object.keys(nextUnits).length > 0 ? { paidOptionUnits: nextUnits } : {}),
              ...(Object.keys(nextQtys).length > 0 ? { paidOptionQtys: nextQtys } : {})
            };
          }

          return nextCi;
        });
      }

      // 🔗 [하차일 = 계약(청구) 개시일 자동 연동]: 하차일이 지정/변경된 경우 이 출고 요청에 귀속된 모든 체결 자산(ContractAsset), 할당 장비(Asset), 계약(Contract)의 개시일을 하차일로 일괄 동기화
      if (nextUnloadingDate && /^\d{4}-\d{2}-\d{2}$/.test(nextUnloadingDate)) {
        const targetCaIdSet = new Set<string>();
        updatedCargo.forEach(ci => {
          if (Array.isArray(ci?.contractAssetIds)) {
            ci.contractAssetIds.forEach((id: string) => {
              if (id) targetCaIdSet.add(id);
            });
          }
        });
        db.outboundInspections
          .filter(ins => ins.deliveryId === targetDelivery.id && (ins as any).contractAssetId)
          .forEach(ins => targetCaIdSet.add((ins as any).contractAssetId));

        if (targetCaIdSet.size === 0 && targetDelivery.contractId) {
          db.contractAssets
            .filter(ca =>
              ca.contractId === targetDelivery.contractId &&
              ca.status !== 'RETURNED' &&
              ca.status !== 'SOLD' &&
              (!ca.startDate || ca.startDate === origUnloadingDate || ca.startDate === origLoadingDate)
            )
            .forEach(ca => targetCaIdSet.add(ca.id));
        }

        let syncedSlotCount = 0;
        targetCaIdSet.forEach(caId => {
          const caObj = db.contractAssets.find(c => c.id === caId && (!targetDelivery.contractId || c.contractId === targetDelivery.contractId));
          if (!caObj) return;
          const shouldSyncFirstStart =
            !caObj.firstStartDate ||
            caObj.firstStartDate === caObj.startDate ||
            caObj.firstStartDate === origUnloadingDate ||
            caObj.firstStartDate === origLoadingDate;

          if (caObj.startDate !== nextUnloadingDate || (shouldSyncFirstStart && caObj.firstStartDate !== nextUnloadingDate)) {
            if (!caSnapshots.some(s => s.id === caObj.id)) {
              caSnapshots.push({ ...caObj });
            }
            db.updateRow<ContractAsset>('contractAssets', caObj.id, {
              startDate: nextUnloadingDate,
              ...(shouldSyncFirstStart ? { firstStartDate: nextUnloadingDate } : {})
            });
            syncedSlotCount++;
          }

          if (caObj.assetId) {
            const assignedAsset = db.assets.find(a => a.id === caObj.assetId);
            if (assignedAsset && assignedAsset.contractStart !== nextUnloadingDate) {
              if (!assetSnapshots.some(s => s.id === assignedAsset.id)) {
                assetSnapshots.push({ ...assignedAsset });
              }
              db.updateRow<Asset>('assets', assignedAsset.id, {
                contractStart: nextUnloadingDate
              });
            }
          }
        });

        db.assetInOutLogs
          .filter(l => l.deliveryId === targetDelivery.id && l.type === 'OUTBOUND' && l.eventDate !== nextUnloadingDate)
          .forEach(l => {
            db.updateRow<AssetInOutLog>('asset_inout_logs', l.id, {
              eventDate: nextUnloadingDate
            });
          });

        if (targetDelivery.contractId) {
          const parentContract = db.contracts.find(c => c.id === targetDelivery.contractId);
          if (parentContract) {
            const activeCasForContract = db.contractAssets.filter(
              c => c.contractId === parentContract.id && c.status !== 'RETURNED' && c.status !== 'SOLD' && c.startDate
            );
            const sortedStartDates = activeCasForContract.map(c => c.startDate).filter(Boolean).sort();
            const earliestContractStart = sortedStartDates[0] || nextUnloadingDate;
            if (parentContract.startDate !== earliestContractStart) {
              db.updateRow<Contract>('contracts', parentContract.id, {
                startDate: earliestContractStart,
                updatedAt: nowIso
              });
            }
          }
        }

        if (syncedSlotCount > 0 && !changeLogs.some(l => l.startsWith('하차일시'))) {
          changeLogs.push(`계약·청구 개시일(하차일 기준) 동기화: ${nextUnloadingDate} (${syncedSlotCount}대)`);
        }
      }

      // 레거시 closingMemo / memo에 옵션 태그가 이미 있던 경우에만 동기화 (신규 배차의 closingMemo에는 옵션을 주입하지 않음)
      let nextClosingMemo = targetDelivery.closingMemo || '';
      if ((params.paidOptions !== undefined || params.protection !== undefined) && nextClosingMemo.includes('유상옵션:')) {
        nextClosingMemo = nextClosingMemo
          .replace(/유상옵션:\s*[^|]+/, `유상옵션: ${nextPaidOptions || '없음'} `)
          .replace(/보양:\s*[^|]+/, `보양: ${nextProtection || '없음'}`);
      }

      let nextMemo = targetDelivery.memo || '';
      if ((params.paidOptions !== undefined || params.protection !== undefined) && nextMemo.includes('[옵션]')) {
        const optSegment = `[옵션] ${nextPaidOptions || '없음'}${nextProtection && nextProtection !== 'NONE' && nextProtection !== '없음' ? ` / 보양: ${nextProtection}` : ''}`;
        nextMemo = nextMemo.replace(/\[옵션\]\s*[^|]+/, `${optSegment} `);
      }
      if ((params.unloadingDate !== undefined || params.unloadingTimeSlot !== undefined) && nextMemo.includes('[하차일정]')) {
        nextMemo = nextMemo.replace(/\[하차일정\]\s*[^|]+/, `[하차일정] ${nextUnloadingDate} ${nextUnloadingSlot} `);
      }

      db.updateRow<Delivery>('deliveries', targetDelivery.id, {
        loadingDate: nextLoadingDate,
        loadingTimeSlot: nextLoadingSlot,
        unloadingDate: nextUnloadingDate,
        unloadingTimeSlot: nextUnloadingSlot,
        scheduledDate: nextLoadingDate || targetDelivery.scheduledDate,
        cargoItems: JSON.stringify(updatedCargo),
        closingMemo: nextClosingMemo,
        memo: nextMemo,
        updatedAt: nowIso
      });

      if (targetDelivery.contractId) {
        if (params.allowCompletedModify) {
          db.updateRow<Contract>('contracts', targetDelivery.contractId, {
            approvalStatus: 'APPROVED',
            updatedAt: nowIso
          });
        }
        if (changeLogs.length > 0 || params.allowCompletedModify) {
          const prefix = params.allowCompletedModify
            ? '[계약의 수정(완결된 출고의 수정)]'
            : '[출고 요청 내역 수정]';
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: targetDelivery.contractId,
            changeType: 'FEE_CHANGE',
            changeDate: todayStr,
            description: `${prefix} 배차 ${targetDelivery.id}: ${changeLogs.length > 0 ? changeLogs.join(' / ') : '요청 내역 변경 반영'} (처리자: ${actorName}${params.reason ? `, 사유: ${params.reason}` : ''})`,
            createdAt: nowIso
          });
        }
      }

      await db.awaitPendingWrites();
      refreshAllData();
      return { success: true };
    } catch (err: any) {
      console.error('updateOutboundRequestPricing error:', err);
      db.updateRow<Delivery>('deliveries', deliverySnapshot.id, deliverySnapshot);
      if (contractSnapshot) {
        db.updateRow<Contract>('contracts', contractSnapshot.id, contractSnapshot);
      }
      createdCaIds.forEach(id => db.deleteRow('contractAssets', id));
      deletedCas.forEach(ca => db.insertRow<ContractAsset>('contractAssets', ca));
      caSnapshots.forEach(ca => db.updateRow<ContractAsset>('contractAssets', ca.id, ca));
      assetSnapshots.forEach(a => db.updateRow<Asset>('assets', a.id, a));
      deletedInspections.forEach(ins => db.insertRow<OutboundInspection>('outboundInspections', ins));
      refreshAllData();
      const errMsg = err?.message || err?.details || JSON.stringify(err);
      showErrorModal(`⚠️ 출고 요청 수정 저장 중 DB 동기화 오류가 발생하여 원복되었습니다:\n\n${errMsg}`, '출고 요청 수정 실패');
      return { success: false, errorMessage: errMsg };
    }
  };

  const saveSmartReturn = async (data: SmartReturnData) => {
    try {
      let resultDeliveryId = '';
      if (data.contractId) {
        const contract = db.contracts.find(c => c.id === data.contractId);
        if (!contract) return { success: false, errorMessage: '계약 정보를 찾을 수 없습니다.' };

        // 새로운 고객담당자(처음 등장하는 사람)라면 자동 등록!
        if (data.contactName) {
          const existingContact = db.contacts.find(ct => ct.customerId === contract.customerId && ct.name.replace(/\s/g, '') === data.contactName!.replace(/\s/g, ''));
          if (!existingContact) {
            db.insertRow<CustomerContact>('contacts', {
              customerId: contract.customerId,
              name: data.contactName,
              position: '담당자',
              contact: data.contactPhone || '미상',
              email: '미상',
              createdAt: new Date().toISOString()
            });
          }
        }

        // 💡 헌장 1.2 & 1.3 준수:
        // 회수 배차 의뢰 단계에서는 현장 장비의 실제 가동 상태를 조기 종료하거나 RENTED_RETURNED로 바꾸지 않음.
        // 자산 상태는 실제 운송 및 입고 검수가 완료되는 시점에 전환됨.
        // 다만 의뢰 이력 관리를 위해 contractHistory에 회수 의뢰 접수 이력만 기록.
        db.insertRow<ContractHistory>('contractHistory', {
          contractId: data.contractId,
          changeType: 'SHORTEN',
          changeDate: new Date().toISOString().split('T')[0],
          prevEndDate: contract.endDate,
          newEndDate: data.returnDate,
          description: `회수 의뢰 접수 (회수 대상: ${data.assetIds.length}대, 희망일: ${data.returnDate})`,
          createdAt: new Date().toISOString()
        });

        const contactInfoMemo = data.contactName || data.contactPhone
          ? `[고객담당자: ${data.contactName || '-'} (${data.contactPhone || '-'})] `
          : '';
        const cust = db.customers.find(c => c.id === contract.customerId);
        let site = db.sites.find(s => s.id === contract.siteId);
        if (site && (data.contactName || data.contactPhone)) {
          const cleanName = (data.contactName || '').trim();
          const cleanPhone = (data.contactPhone || '').trim();
          const siteUpdates: Partial<CustomerSite> = {};
          if (cleanName && cleanName !== '미상') siteUpdates.contactName = cleanName;
          if (cleanPhone && cleanPhone !== '미상') siteUpdates.contact = cleanPhone;
          if (cleanName && cleanName !== '미상') {
            const existingSiteContacts = Array.isArray(site.contacts) ? [...site.contacts] : [];
            const idx = existingSiteContacts.findIndex(c => (c.name || '').replace(/\s/g, '') === cleanName.replace(/\s/g, ''));
            if (idx >= 0) {
              existingSiteContacts[idx] = {
                ...existingSiteContacts[idx],
                contact: cleanPhone || existingSiteContacts[idx].contact,
                isActive: true
              };
            } else {
              existingSiteContacts.unshift({
                id: `SC-${Date.now()}`,
                name: cleanName,
                contact: cleanPhone || '',
                position: '현장담당',
                isActive: true
              });
            }
            siteUpdates.contacts = existingSiteContacts;
          }
          if (Object.keys(siteUpdates).length > 0) {
            site = db.updateRow<CustomerSite>('sites', site.id, {
              ...siteUpdates,
              updatedAt: new Date().toISOString()
            }) || site;
          }
        }
        const siteMaster = site?.siteMasterId ? db.siteMasters.find(sm => sm.id === site.siteMasterId) : undefined;
        const returnAssets = db.assets.filter(a => data.assetIds.includes(a.id));
        const modelCountsMap: Record<string, number> = {};
        returnAssets.forEach(a => {
          modelCountsMap[a.modelName] = (modelCountsMap[a.modelName] || 0) + 1;
        });
        // 🌟 [전사 표준 헌장 2.2 자동 상속 및 무누락/무잡음 원칙] 출고 시 장착 옵션 및 보양은 cargoItems 메타데이터로 보존하고, 배차 특이사항(closingMemo) 및 원문(memo)에는 옵션을 주입하지 않음
        const outboundDelivery = db.deliveries.find(d => d.contractId === contract.id && d.type === 'OUTBOUND');

        let rawPaidOptions = (data as any).paidOptions;
        if (rawPaidOptions === undefined) {
          rawPaidOptions = site?.paidOptions || siteMaster?.paidOptions || cust?.defaultPaidOptions;
          if (!rawPaidOptions && outboundDelivery?.closingMemo) {
            const m = outboundDelivery.closingMemo.match(/유상옵션:\s*([^\|]+)/);
            if (m && m[1]?.trim() && m[1].trim() !== '없음') rawPaidOptions = m[1].trim();
          }
        }
        const cleanPaidOptions = (rawPaidOptions && rawPaidOptions !== '없음' && rawPaidOptions !== 'NONE') ? String(rawPaidOptions).trim() : '';

        let rawProtection = (data as any).protection;
        if (rawProtection === undefined) {
          rawProtection = (site?.protection && site.protection !== 'NONE')
            ? site.protection
            : ((siteMaster?.protection && siteMaster.protection !== 'NONE') ? siteMaster.protection : cust?.defaultProtection);
          if ((!rawProtection || rawProtection === 'NONE') && outboundDelivery?.closingMemo) {
            const m = outboundDelivery.closingMemo.match(/보양:\s*([^\|]+)/);
            if (m && m[1]?.trim() && m[1].trim() !== '없음' && m[1].trim() !== 'NONE') rawProtection = m[1].trim();
          }
        }
        const cleanProtection = (rawProtection && rawProtection !== '없음' && rawProtection !== 'NONE') ? String(rawProtection).trim() : 'NONE';

        const cargoItems = JSON.stringify(
          Object.entries(modelCountsMap).map(([modelName, count], idx) => ({
            modelName,
            count,
            ...(cleanPaidOptions ? { paidOptions: cleanPaidOptions } : {}),
            ...(idx === 0 && cleanProtection !== 'NONE' ? { requestMeta: { protection: cleanProtection } } : {})
          }))
        );

        const createdReturnDelivery = db.insertRow<Delivery>('deliveries', {
          contractId: data.contractId,
          assetIds: data.assetIds.join(','),
          type: 'INBOUND',
          dispatchCategory: '입고',
          status: 'REQUESTED',
          requestDate: data.returnDate,
          loadingDate: data.returnDate,
          loadingTimeSlot: data.loadingTime || '오전',
          scheduledDate: data.returnDate,
          unloadingDate: data.returnDate,
          unloadingTimeSlot: data.loadingTime || '오전',
          originAddress: `${cust?.name || '고객사'} (${site?.name || '현장'})`,
          destinationAddress: '당사 보관소',
          transportCompany: '',
          vehicleType: '',
          vehicleNo: '',
          driverName: '',
          driverContact: '',
          deliveryCost: 0,
          expectedCost: 0,
          finalCost: 0,
          reconciliationStatus: 'PENDING',
          cargoItems,
          isCostSettled: false,
          rawText: (data.note || '').trim(),
          memo: appendDispatchStaffTag(`${contactInfoMemo}${data.note || ''}`.trim()),
          closingMemo: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // 🚀 [단일 업무 인계 파이프라인] 배차팀에 회수 배차 ToDo 영구 적재
        const retCount = data.assetIds?.length || 1;
        await issueHandoverTask({
          category: 'DISPATCH_REQUEST',
          title: `[회수 배차 의뢰] ${cust?.name || '고객사'} (${retCount}대)`,
          content: `${cust?.name || '고객사'} (${site?.name || '현장'}) ${retCount}대 회수 배차 요청 (요청일: ${data.returnDate})`,
          targetDept: 'DISPATCH',
          priority: 'HIGH',
          actionUrl: '/admin/dispatch',
          entityType: 'DELIVERY',
          entityId: createdReturnDelivery.id,
          senderId: currentUser?.id,
          senderName: currentUser?.name
        });
        resultDeliveryId = createdReturnDelivery.id;
      } else {
        // Case 4: 외주정비 회수
        const createdRepairReturnDelivery = db.insertRow<Delivery>('deliveries', {
          assetIds: data.assetIds.join(','),
          type: 'INBOUND',
          dispatchCategory: '입고',
          status: 'REQUESTED',
          requestDate: data.returnDate,
          loadingDate: data.returnDate,
          loadingTimeSlot: data.loadingTime || '오전',
          scheduledDate: data.returnDate,
          unloadingDate: data.returnDate,
          unloadingTimeSlot: data.loadingTime || '오전',
          originAddress: '외주정비업체',
          destinationAddress: '당사 보관소',
          transportCompany: '',
          vehicleType: '',
          vehicleNo: '',
          driverName: '',
          driverContact: '',
          deliveryCost: 0,
          isCostSettled: false,
          memo: appendDispatchStaffTag(`[외주정비회수] 정비건: ${data.repairId || '-'} / 외주업체: ${data.vendorId || '-'} | ${data.note || ''}`),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await issueHandoverTask({
          category: 'DISPATCH_REQUEST',
          title: `[외주정비 회수 배차] 장비 ${data.assetIds.length}대`,
          content: `외주정비업체 회수 배차 요청 (정비건: ${data.repairId || '-'}, 외주: ${data.vendorId || '-'})`,
          targetDept: 'DISPATCH',
          priority: 'NORMAL',
          actionUrl: '/admin/dispatch',
          entityType: 'DELIVERY',
          entityId: createdRepairReturnDelivery.id,
          senderId: currentUser?.id,
          senderName: currentUser?.name
        });
        resultDeliveryId = createdRepairReturnDelivery.id;
      }

      await db.awaitPendingWrites();
      refreshAllData();

      return { success: true, deliveryId: resultDeliveryId };
    } catch (err: any) {
      console.error('saveSmartReturn error:', err);
      showErrorModal(`회수 의뢰 저장 실패:\n${err?.message || err}`);
      return { success: false, errorMessage: err?.message || String(err) };
    }
  };

  const completeTodo = (todoId: string) => {
    const nowIso = new Date().toISOString();
    db.updateRow<Todo>('todos', todoId, { 
      isCompleted: true,
      completedAt: nowIso,
      completedByUserId: currentUser?.id,
      completedByName: currentUser?.name,
      completionAction: 'MANUAL_COMPLETED',
      updatedAt: nowIso
    });
    refreshAllData();
  };

  const issueExecutiveDirective = async (params: {
    targetType: 'USER' | 'DEPT';
    targetUserId?: string;
    targetDept?: string;
    title: string;
    content: string;
    priority?: 'URGENT' | 'HIGH' | 'NORMAL';
    dueDate?: string;
    actionUrl?: string;
  }): Promise<Todo> => {
    const userRole = (currentUser?.role || '').toUpperCase();
    const userDept = (currentUser?.department || '').toUpperCase();
    const isAuthorized = userRole === 'ADMIN' || userRole === 'EXECUTIVE' || userRole === 'MANAGER' || userDept.includes('경영') || userDept.includes('대표');
    if (!isAuthorized) {
      throw new Error('경영진 업무지시 발행 권한이 없습니다. (관리자/경영진 전용)');
    }

    const newTodo = await issueHandoverTask({
      category: 'EXECUTIVE_DIRECTIVE',
      title: params.title,
      content: params.content,
      priority: params.priority || 'URGENT',
      targetType: params.targetType,
      targetDept: params.targetType === 'DEPT' ? params.targetDept : undefined,
      assignedUserId: params.targetType === 'USER' ? params.targetUserId : undefined,
      dueDate: params.dueDate,
      actionUrl: params.actionUrl || '/',
      entityType: 'DIRECTIVE',
      entityId: `DIR-${Date.now()}`,
      senderId: currentUser?.id,
      senderName: currentUser?.name || '경영진'
    });

    await db.awaitPendingWrites();
    refreshAllData();
    return newTodo;
  };

  const resolveExecutiveDirective = async (todoId: string, resolutionNote: string) => {
    const targetTodo = db.todos.find(t => t.id === todoId);
    if (!targetTodo) return;

    const nowIso = new Date().toISOString();
    db.updateRow<Todo>('todos', todoId, {
      isCompleted: true,
      completedAt: nowIso,
      completedByUserId: currentUser?.id,
      completedByName: currentUser?.name,
      completionAction: 'DIRECTIVE_RESOLVED',
      resolutionNote: resolutionNote,
      updatedAt: nowIso
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  const cancelExecutiveDirective = async (todoId: string) => {
    const targetTodo = db.todos.find(t => t.id === todoId);
    if (!targetTodo) return;

    const nowIso = new Date().toISOString();
    db.updateRow<Todo>('todos', todoId, {
      isCompleted: true,
      completedAt: nowIso,
      completedByUserId: currentUser?.id,
      completedByName: currentUser?.name,
      completionAction: 'DIRECTIVE_CANCELLED',
      updatedAt: nowIso
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  // 💡 매입처 거래액 및 거래개시일 자동 트리거 갱신 헬퍼
  const triggerVendorPurchaseMetric = (vendorIdOrName: string, purchaseAmount: number, tradeDate?: string) => {
    if (!vendorIdOrName || !purchaseAmount) return;
    const targetVendor = db.vendors.find(v => 
      v.id === vendorIdOrName || 
      v.name === vendorIdOrName || 
      (v.name && (v.name.includes(vendorIdOrName) || vendorIdOrName.includes(v.name)))
    );
    if (!targetVendor) return;

    const currentTotal = targetVendor.totalPurchaseAmount || 0;
    const newTotal = currentTotal + purchaseAmount;
    const actualDate = tradeDate || new Date().toISOString().split('T')[0];
    const newFirstDate = !targetVendor.firstTradeDate || actualDate < targetVendor.firstTradeDate 
      ? actualDate 
      : targetVendor.firstTradeDate;
    const newLastDate = !targetVendor.lastTradeDate || actualDate > targetVendor.lastTradeDate 
      ? actualDate 
      : targetVendor.lastTradeDate;

    db.updateRow<Vendor>('vendors', targetVendor.id, {
      totalPurchaseAmount: newTotal,
      firstTradeDate: newFirstDate,
      lastTradeDate: newLastDate,
      updatedAt: new Date().toISOString()
    } as any);
  };

  const acquireAsset = async (assetData: Partial<Asset>): Promise<Asset> => {
    const residualRate = assetData.residualValueRate ?? 10;
    const price = assetData.acquisitionPrice ?? 0;
    const bookVal = price;
    
    const newAsset = db.insertRow<Asset>('assets', {
      modelName: assetData.modelName || '',
      assetNo: assetData.assetNo || '',
      serialNo: assetData.serialNo || '',
      manufacturer: assetData.manufacturer || '',
      manufactureYear: normalizeManufactureYear(assetData.manufactureYear),
      ownerType: 'OWNED',
      yard: assetData.yard || '용인',
      status: 'AVAILABLE',
      monthlyRentalFee: assetData.monthlyRentalFee || 0,
      dailyRentalFee: assetData.dailyRentalFee || 0,
      acquisitionDate: assetData.acquisitionDate || new Date().toISOString().split('T')[0],
      acquisitionPrice: price,
      depreciationMonths: assetData.depreciationMonths || 96,
      residualValueRate: residualRate,
      accumDepreciation: 0,
      bookValue: bookVal,
      cumRentalFee: 0,
      cumRepairCost: 0,
      vendorId: assetData.vendorId || '',
      supplier: assetData.supplier || '',
      safetyInspectionUrl: assetData.safetyInspectionUrl || '',
      memo1: assetData.memo1 || '',
      memo2: assetData.memo2 || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 헌장 1.2 사건 기록 무누락 DB 저장: 취득 이벤트 감사 로그
    db.insertRow<AssetInOutLog>('assetInOutLogs', {
      assetId: newAsset.id,
      assetNo: newAsset.assetNo,
      modelName: newAsset.modelName,
      type: 'ACQUISITION',
      eventDate: newAsset.acquisitionDate || new Date().toISOString().split('T')[0],
      memo: `신규 당사자산 취득 등록 (취득가: ${(price || 0).toLocaleString()}원 / 공급처: ${newAsset.supplier || '-'})`,
      createdAt: new Date().toISOString()
    });

    // 💡 매입처 누적거래액 및 거래개시일 자동 트리거 갱신
    triggerVendorPurchaseMetric(newAsset.vendorId || newAsset.supplier || '', price, newAsset.acquisitionDate);

    await db.awaitPendingWrites(); // 💡 헌장 5.2 동기 쓰기 대기
    refreshAllData();
    return newAsset;
  };

  const batchAcquireAssets = async (assetsData: Partial<Asset>[]): Promise<Asset[]> => {
    const createdList: Asset[] = [];
    for (const assetData of assetsData) {
      const residualRate = assetData.residualValueRate ?? 10;
      const price = assetData.acquisitionPrice ?? 0;
      const bookVal = price;
      
      const newAsset = db.insertRow<Asset>('assets', {
        modelName: assetData.modelName || '',
        assetNo: assetData.assetNo || '',
        serialNo: assetData.serialNo || '',
        manufacturer: assetData.manufacturer || '',
        manufactureYear: normalizeManufactureYear(assetData.manufactureYear),
        ownerType: 'OWNED',
        yard: assetData.yard || '용인',
        status: 'AVAILABLE',
        monthlyRentalFee: assetData.monthlyRentalFee || 0,
        dailyRentalFee: assetData.dailyRentalFee || 0,
        acquisitionDate: assetData.acquisitionDate || new Date().toISOString().split('T')[0],
        acquisitionPrice: price,
        depreciationMonths: assetData.depreciationMonths || 96,
        residualValueRate: residualRate,
        accumDepreciation: 0,
        bookValue: bookVal,
        cumRentalFee: 0,
        cumRepairCost: 0,
        vendorId: assetData.vendorId || '',
        supplier: assetData.supplier || '',
        safetyInspectionUrl: assetData.safetyInspectionUrl || '',
        memo1: assetData.memo1 || '',
        memo2: assetData.memo2 || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: newAsset.id,
        assetNo: newAsset.assetNo,
        modelName: newAsset.modelName,
        type: 'ACQUISITION',
        eventDate: newAsset.acquisitionDate || new Date().toISOString().split('T')[0],
        memo: `신규 당사자산 취득 등록 [일괄] (취득가: ${(price || 0).toLocaleString()}원 / 공급처: ${newAsset.supplier || '-'})`,
        createdAt: new Date().toISOString()
      });

      // 💡 매입처 누적거래액 및 거래개시일 자동 트리거 갱신
      triggerVendorPurchaseMetric(newAsset.vendorId || newAsset.supplier || '', price, newAsset.acquisitionDate);

      createdList.push(newAsset);
    }
    await db.awaitPendingWrites(); // 💡 헌장 5.2 동기 쓰기 대기
    refreshAllData();
    return createdList;
  };

  // 자산 매각 계약번호 전용 채번기
  const generateNextSaleContractNo = (): string => {
    const todayYmd = new Date().toISOString().split('T')[0].replace(/-/g, '');
    let maxSeq = 0;
    db.contracts.forEach(c => {
      if (c?.contractType === 'SALE' && c.contractNo?.startsWith(`SALE-${todayYmd}-`)) {
        const parts = c.contractNo.split('-');
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
    return `SALE-${todayYmd}-${String(maxSeq + 1).padStart(3, '0')}`;
  };

  // 💡 자산 매각 계약 체결 & 청구서 발행 & 이메일 발송 5단계 논스톱 완결 파이프라인
  const executeAssetSale = async (payload: AssetSalePayload): Promise<{ success: boolean; contractId: string; billingId: string; contractNo: string }> => {
    try {
      if (!payload.items || payload.items.length === 0) {
        throw new Error('매각 대상 자산이 1대 이상 선택되어야 합니다.');
      }
      if (!payload.disposalDate) {
        throw new Error('매각 일자가 지정되지 않았습니다.');
      }

      // 1. 매수처 고객사 확인 또는 신규 등록
      let customer: Customer | undefined;
      if (payload.customerId) {
        customer = db.customers.find(c => c.id === payload.customerId);
      }
      if (!customer && payload.buyerName) {
        customer = db.customers.find(c => c.name.trim().toLowerCase() === payload.buyerName.trim().toLowerCase());
      }
      if (!customer) {
        customer = db.insertRow<Customer>('customers', {
          name: payload.buyerName || '자산매수처(미상)',
          bizRegNo: payload.buyerBizRegNo || '',
          isClosed: false,
          address: payload.buyerAddress || '',
          representative: payload.buyerRepresentative || '',
          repContact: payload.buyerContact || '',
          repEmail: payload.recipientEmail || '',
          transactionStatus: 'ALLOWED',
          createdAt: new Date().toISOString()
        });
      }

      // 2. 매각 계약번호 및 기본 청구월 책정
      const contractNo = generateNextSaleContractNo();
      const billingYm = payload.disposalDate.slice(0, 7);
      const dayNum = parseInt(payload.disposalDate.slice(8, 10), 10) || 30;

      // 3. 헌장 2.1 & 2.2: 매각 계약 생성 (5대 계약 조건 포함)
      const contract = db.insertRow<Contract>('contracts', {
        contractNo,
        contractType: 'SALE',
        saleTerms: payload.saleTerms,
        customerId: customer.id,
        salespersonId: payload.salespersonId || '',
        startDate: payload.disposalDate,
        endDate: payload.disposalDate,
        billingDay: dayNum,
        paymentDueDay: 25,
        lateInterestRate: 0,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      let totalSalePrice = 0;
      const soldAssetSummaries: { assetNo: string; modelName: string; salePrice: number; bookValue: number; gainLoss: number }[] = [];

      // 4. 각 자산별 체결 자산 슬롯 바인딩 및 마스터 SOLD 전이
      for (const item of payload.items) {
        const asset = db.assets.find(a => a.id === item.assetId);
        if (!asset) continue;

        const salePrice = Math.max(0, Number(item.salePrice) || 0);
        totalSalePrice += salePrice;

        const dep = calculateAssetDepreciation(asset, new Date(payload.disposalDate));
        const bookVal = dep.bookValue;
        const gainLoss = salePrice - bookVal;

        soldAssetSummaries.push({
          assetNo: asset.assetNo,
          modelName: asset.modelName,
          salePrice,
          bookValue: bookVal,
          gainLoss
        });

        // 4-1. 체결 자산 슬롯 추가
        const ca = db.insertRow<ContractAsset>('contractAssets', {
          contractId: contract.id,
          assetId: asset.id,
          expectedModel: asset.modelName,
          status: 'SOLD',
          monthlyRentalFee: 0,
          dailyRentalFee: 0,
          salePrice,
          startDate: payload.disposalDate,
          endDate: payload.disposalDate,
          createdAt: new Date().toISOString()
        });

        // 4-2. 자산 마스터 SOLD 전이 및 처분 스냅샷 반영
        db.updateRow<Asset>('assets', asset.id, {
          status: 'SOLD',
          disposalDate: payload.disposalDate,
          disposalPrice: salePrice,
          buyer: customer.name,
          currentCustomerId: customer.id,
          monthlyRentalFee: 0,
          dailyRentalFee: 0,
          updatedAt: new Date().toISOString()
        });

        // 4-3. 헌장 1.2 무누락 DB 저장: 자산 입출고 이력 영구 기록
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: asset.id,
          assetNo: asset.assetNo,
          modelName: asset.modelName,
          type: 'DISPOSAL',
          customerId: customer.id,
          customerName: customer.name,
          eventDate: payload.disposalDate,
          memo: `자산 매각 처분 계약 체결 (계약: ${contract.contractNo}, 매각단가: ₩${salePrice.toLocaleString()}, 처분손익: ₩${gainLoss.toLocaleString()})`,
          createdAt: new Date().toISOString()
        });
      }

      // 5. 1회성 매각 청구서 및 상세 발행 (과세 10% 분리, 총액 100% 일치)
      const vat = Math.round(totalSalePrice * 0.1);
      const grandTotal = totalSalePrice + vat;

      const billing = db.insertRow<Billing>('billings', {
        billingType: 'ASSET_SALE',
        customerId: customer.id,
        contractId: contract.id,
        billingYm,
        billingDate: payload.disposalDate,
        totalAmount: grandTotal, // 💡 공급가 + 부가세 10% 총액 일치 (BankMatching 1원 오차 방지)
        paidAmount: 0,
        status: 'REQUESTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();

      for (const summary of soldAssetSummaries) {
        db.insertRow<BillingDetail>('billingDetails', {
          billingId: billing.id,
          itemName: `[자산매각] ${summary.modelName} (관리번호: ${summary.assetNo})`,
          quantity: 1,
          unitPrice: summary.salePrice,
          amount: summary.salePrice,
          internalDescription: `운영 자산 매각 대금 청구 (계약: ${contract.contractNo})`,
          displayName: `${summary.modelName} 매각대금`,
          createdAt: new Date().toISOString()
        });
      }

      // 6. 계약 이력 기록
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: contract.id,
        changeType: 'ASSET_SOLD',
        changeDate: payload.disposalDate,
        description: `운영 자산 ${soldAssetSummaries.length}대 매각 처분 계약 체결 (매각총액: ₩${totalSalePrice.toLocaleString()})`,
        createdAt: new Date().toISOString()
      });

      // 🚀 [단일 업무 인계 파이프라인] 주기장에 매각 장비 실물 인도 검수 ToDo 발행
      await issueHandoverTask({
        category: 'ASSET_DISPOSAL_HANDOVER',
        title: `[매각 장비 인도 검수] ${customer.name} (${soldAssetSummaries.length}대)`,
        content: `매각 처분 계약 체결 완료 (계약: ${contract.contractNo}, 총액: ₩${grandTotal.toLocaleString()}). 주기장 실물 인도 및 상차 검수를 진행하세요.`,
        targetDept: 'YARD',
        priority: 'HIGH',
        actionUrl: '/admin/asset_acquisition_disposal',
        entityType: 'CONTRACT',
        entityId: contract.id,
        senderId: currentUser?.id,
        senderName: currentUser?.name
      });

      // 7. 헌장 5.2 동기 쓰기 대기
      await db.awaitPendingWrites();

      // 8. 이메일 발송 연동 (요청된 경우)
      if (payload.sendEmail && payload.recipientEmail) {
        try {
          const vat = Math.round(totalSalePrice * 0.1);
          const grand = totalSalePrice + vat;
          const tenantBrand = currentTenant?.displayName || currentTenant?.tradeName || 'e-Bro';
          const tenantCorp = currentTenant?.tradeName || currentTenant?.corporateName || tenantBrand;
          const tenantAccount = currentTenant?.bankAccounts?.[0]
            ? `[${tenantBrand}] ${currentTenant.bankAccounts[0].bankName} ${currentTenant.bankAccounts[0].accountNumber} (예금주: ${currentTenant.bankAccounts[0].accountHolder})`
            : '[e-Bro] 계좌문의';
          const subject = `[${tenantBrand}] 자산 매각 계약서 및 청구서 안내 (${customer.name} 귀하)`;
          const paymentTermsText = payload.saleTerms?.paymentType === 'INSTALLMENT'
            ? `분할 지급 (계약금: ₩${(payload.saleTerms.installmentDownAmount || 0).toLocaleString()}원 / 잔금: ₩${(payload.saleTerms.installmentBalanceAmount || 0).toLocaleString()}원, 잔금납기: ${payload.saleTerms.installmentBalanceDueDate || '-'})`
            : `일시불 완납 (${payload.saleTerms?.lumpSumDueTerm === 'DELIVERY' ? '장비 인도일 완납' : payload.saleTerms?.lumpSumDueTerm === '7_DAYS' ? '계약일로부터 7일 이내' : payload.saleTerms?.lumpSumDueTerm === '14_DAYS' ? '계약일로부터 14일 이내' : payload.saleTerms?.lumpSumDueTerm === 'MONTH_10' ? '익월 10일 완납' : '계약 체결 즉시 완납'})`;

          const deliveryTermsText = `${payload.saleTerms?.deliveryLocationType === 'BUYER_SITE' ? '매수처 지정지 하차도' : '당사 주기장 상차도'} (${payload.saleTerms?.freightBearer === 'SELLER' ? '당사 운송부담' : '매수자 운송부담'}) / 인도예정일: ${payload.saleTerms?.deliveryDate || payload.disposalDate}`;

          const body = `
안녕하세요, ${customer.name} 담당자님.
${tenantCorp}입니다.

귀사와 체결된 고소작업대 자산 매각 계약 건에 대한 계약서 및 매각 대금 청구 내역을 안내해 드립니다.

[계약 및 청구 요약]
- 계약번호: ${contract.contractNo}
- 계약유형: 자산 매각 계약
- 양도일자: ${payload.disposalDate}
- 매각 수량: 총 ${soldAssetSummaries.length}대
- 공급가액: ₩${totalSalePrice.toLocaleString()}원
- 부가세 (10%): ₩${vat.toLocaleString()}원
- 청구 총합계금액: ₩${grand.toLocaleString()}원
- 입금 계좌: ${payload.saleTerms?.bankAccount ? payload.saleTerms.bankAccount : tenantAccount}
- 결제 조건: ${paymentTermsText}
- 인도 조건: ${deliveryTermsText}
${payload.saleTerms?.useStandardAsIsClause ? '- 특약: 현상태 인수 및 소유권 유보(대금 완납 시 이전)\n' : ''}
[매각 장비 상세 내역]
${soldAssetSummaries.map((s, idx) => `${idx + 1}. 관리번호: ${s.assetNo} / 모델명: ${s.modelName} / 매각단가: ₩${s.salePrice.toLocaleString()}원`).join('\n')}

${payload.memo ? `\n[특이사항 / 메모]\n${payload.memo}\n` : ''}

감사합니다.
${currentTenant?.corporateName || tenantCorp} 배상
연락처: ${currentUser?.name || ''} ${(currentUser as any)?.mobile || currentUser?.phone || currentTenant?.tel || '031-334-5295'}
          `.trim();

          await emailService.sendEmail(
            payload.recipientEmail,
            subject,
            body,
            [],
            payload.ccEmail
          );

          db.insertRow<ContractHistory>('contractHistory', {
            contractId: contract.id,
            changeType: 'DOCUMENT_SENT',
            changeDate: payload.disposalDate,
            description: `자산 매각 계약서 및 청구 내역 이메일 발송 완료 (수신: ${payload.recipientEmail})`,
            createdAt: new Date().toISOString()
          });
          await db.awaitPendingWrites();
        } catch (mailErr: any) {
          console.warn('[executeAssetSale] 이메일 발송 실패 (계약 및 청구는 정상 보존됨):', mailErr);
        }
      }

      refreshAllData();
      return { success: true, contractId: contract.id, billingId: billing.id, contractNo: contract.contractNo };
    } catch (err: any) {
      console.error('[executeAssetSale] Error:', err);
      showErrorModal(`⚠️ 자산 매각 계약 처리 중 오류가 발생했습니다:\n\n${err?.message || err}`, '자산 매각 실패');
      throw err;
    }
  };

  // 구버전 호환용 래퍼
  const disposeAsset = async (assetId: string, disposalData: { disposalDate: string; disposalPrice: number; buyer: string; billingYm?: string }) => {
    return executeAssetSale({
      buyerName: disposalData.buyer,
      disposalDate: disposalData.disposalDate,
      items: [{ assetId, salePrice: disposalData.disposalPrice }]
    });
  };

  const registerRentedAsset = async (assetData: Partial<Asset>) => {
    let result;
    const { isReactivating, ...cleanAssetData } = assetData as any;
    const sanitizedMonthlyFee = Math.max(0, Number(cleanAssetData.monthlyRentFee) || 0);
    const sanitizedDailyFee = cleanAssetData.dailyRentFee ? Math.max(0, Number(cleanAssetData.dailyRentFee)) : Math.floor(sanitizedMonthlyFee / 30);

    const existing = db.assets.find(a => a.assetNo === cleanAssetData.assetNo || (cleanAssetData.id && a.id === cleanAssetData.id));
    const resolvedOwnership = cleanAssetData.antiEntrapmentOwnership || existing?.antiEntrapmentOwnership || 'NONE';
    const ownershipLabel = resolvedOwnership === 'VENDOR' ? '임차처 소유(탈거금지)' : resolvedOwnership === 'OURS' ? '당사 소유(회수대상)' : '미장착';
    const targetModelName = (cleanAssetData.modelName || existing?.modelName || '').trim();
    const resolvedManufacturer = db.resolveAssetManufacturer(targetModelName, cleanAssetData.manufacturer || existing?.manufacturer);
    const resolvedManufactureYear = normalizeManufactureYear(cleanAssetData.manufactureYear ?? existing?.manufactureYear ?? '');

    if (existing) {
      const wasReturned = Boolean(isReactivating || existing.status === 'RENTED_RETURNED' || existing.actualRentReturnDate);
      const nextStatus =
        wasReturned
          ? (cleanAssetData.status && cleanAssetData.status !== 'RENTED_RETURNED' ? cleanAssetData.status : 'AVAILABLE')
          : cleanAssetData.status || existing.status || 'AVAILABLE';
      result = db.updateRow<Asset>('assets', existing.id, {
        ...cleanAssetData,
        vendorAssetNo: cleanAssetData.vendorAssetNo || existing.vendorAssetNo || '',
        serialNo: cleanAssetData.serialNo ?? existing.serialNo ?? '',
        manufacturer: resolvedManufacturer,
        manufactureYear: resolvedManufactureYear,
        ownerType: 'RENTED',
        yard: cleanAssetData.yard || existing.yard || '용인',
        antiEntrapmentOwnership: resolvedOwnership,
        status: nextStatus,
        monthlyRentFee: sanitizedMonthlyFee,
        dailyRentFee: sanitizedDailyFee,
        actualRentReturnDate: wasReturned ? '' : (cleanAssetData.actualRentReturnDate ?? existing.actualRentReturnDate ?? ''),
        updatedAt: new Date().toISOString()
      });
    } else {
      result = db.insertRow<Asset>('assets', {
        modelName: assetData.modelName || '',
        assetNo: assetData.assetNo || '',
        vendorId: assetData.vendorId || '',
        vendorAssetNo: assetData.vendorAssetNo || '',
        serialNo: assetData.serialNo || '',
        manufacturer: resolvedManufacturer,
        manufactureYear: resolvedManufactureYear,
        ownerType: 'RENTED',
        yard: assetData.yard || '용인',
        antiEntrapmentOwnership: resolvedOwnership,
        status: 'AVAILABLE',
        renter: assetData.renter || '',
        rentStart: assetData.rentStart || '',
        rentEnd: assetData.rentEnd || '',
        monthlyRentFee: sanitizedMonthlyFee,
        dailyRentFee: sanitizedDailyFee,
        acquisitionPrice: 0,
        depreciationMonths: 0,
        residualValueRate: 0,
        accumDepreciation: 0,
        bookValue: 0,
        cumRentalFee: 0,
        cumRepairCost: 0,
        memo1: assetData.memo1 || '',
        memo2: assetData.memo2 || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    // 헌장 1.2 무누락 감사 로그: 임차처 임차 반입
    if (result) {
      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: result.id,
        assetNo: result.assetNo,
        modelName: result.modelName,
        type: 'INBOUND',
        eventDate: result.rentStart || new Date().toISOString().split('T')[0],
        memo: `[임차 반입] 임차처: ${result.renter || '임차처'} (임차처번호: ${result.vendorAssetNo || '-'}, 협착방지봉: ${ownershipLabel})`,
        createdAt: new Date().toISOString()
      });
    }

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('registerRentedAsset Supabase sync error:', err);
      showErrorModal(`⚠️ 임차 자산 저장 중 원격 DB 동기화 오류가 발생했습니다:\n${err.message || err.details || JSON.stringify(err)}`, 'DB 동기화 오류');
      throw err;
    }
    refreshAllData();
    return result;
  };

  const returnRentedAsset = async (assetId: string, returnDate: string, options?: { isDirectReturn?: boolean; memo?: string }): Promise<void> => {
    const target = db.assets.find(a => a.id === assetId);
    if (!target) return;

    if (target.rentStart && returnDate < target.rentStart) {
      showErrorModal(`⚠️ 임차처 반납일(${returnDate})은 임차 시작일(${target.rentStart}) 이전일 수 없습니다.`);
      throw new Error(`임차처 반납일이 임차 시작일 이전입니다.`);
    }

    const isDirect = options?.isDirectReturn || target.status === 'RENTED';
    const cust = db.customers.find(c => c.id === target.currentCustomerId);
    const site = db.sites.find(s => s.id === target.currentSiteId);

    try {
      db.updateRow<Asset>('assets', assetId, {
        status: 'RENTED_RETURNED',
        actualRentReturnDate: returnDate,
        currentCustomerId: '',
        currentSiteId: '',
        contractStart: undefined,
        contractEnd: undefined,
        updatedAt: new Date().toISOString()
      });

      // 헌장 1.2 무누락 감사 로그: 임차처 반납 반출 (사법 감사 판정: type OUTBOUND)
      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: target.id,
        assetNo: target.assetNo,
        modelName: target.modelName,
        type: 'OUTBOUND',
        customerId: target.currentCustomerId || undefined,
        customerName: cust?.name,
        siteId: target.currentSiteId || undefined,
        siteName: site?.name,
        eventDate: returnDate,
        memo: options?.memo || (isDirect 
          ? `[임차자산 현장 직반납] 고객사(${cust?.name || '-'}) 현장에서 임차처(${target.renter || '임차처'})로 직반납 처리`
          : `[임차자산 주기장 반납] 당사 주기장에서 임차처(${target.renter || '임차처'})로 반납 처리`),
        createdAt: new Date().toISOString()
      });

      // 헌장 5.2 준수: CUD 동기 검증
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('returnRentedAsset 동기화 실패:', err);
      showErrorModal(`⚠️ 임차처 반납 마감 처리 중 DB 동기화 오류가 발생했습니다:\n${err.message || err}`, 'DB 동기화 오류');
      throw err;
    }
  };

  const createVendorClaimReceivable = async (data: {
    contractId?: string;
    customerId?: string;
    vendorName: string;
    assetNo: string;
    totalAmount: number;
    internalDescription: string;
    displayName?: string;
    occurredDate?: string;
  }): Promise<void> => {
    try {
      db.insertRow<Receivable>('receivables', {
        contractId: data.contractId,
        customerId: data.customerId,
        type: 'VENDOR_CLAIM',
        totalAmount: data.totalAmount,
        billedAmount: 0,
        internalDescription: data.internalDescription,
        displayName: data.displayName || data.internalDescription,
        occurredDate: data.occurredDate || new Date().toISOString().split('T')[0],
        vendorName: data.vendorName,
        assetNo: data.assetNo,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('createVendorClaimReceivable error:', err);
      showErrorModal(`⚠️ 구상 미수금 등록 오류:\n${err.message || err.details || JSON.stringify(err)}`, 'DB 동기화 오류');
      throw err;
    }
  };

  const addConsumable = async (data: Omit<Consumable, 'id' | 'createdAt' | 'updatedAt' | 'stockQty'> & { stockQty?: number }) => {
    try {
      db.insertRow<Consumable>('consumables', {
        ...data,
        stockQty: data.stockQty || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 소모품 품목 등록 오류:\n${err.message || err}`, 'DB 동기화 오류');
      throw err;
    }
  };

  const updateConsumable = async (id: string, updates: Partial<Consumable>) => {
    try {
      db.updateRow<Consumable>('consumables', id, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 소모품 품목 수정 오류:\n${err.message || err}`, 'DB 동기화 오류');
      throw err;
    }
  };

  const deleteConsumable = async (id: string) => {
    try {
      const hasLogs = db.consumableLogs.some(l => l.consumableId === id);
      const hasVehicleStock = db.mechanicConsumableStocks.some(s => s.consumableId === id && s.stockQty > 0);
      
      if (hasLogs || hasVehicleStock) {
        showErrorModal('수불 이력이 있거나 차량에 불출된 재고가 있어 삭제할 수 없습니다. 관리자에게 문의하여 단종 처리하세요.', '삭제 불가');
        throw new Error('삭제 불가');
      }

      db.deleteRow('consumables', id);
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      if (err.message !== '삭제 불가') {
        showErrorModal(`⚠️ 소모품 삭제 오류:\n${err.message || err}`, 'DB 동기화 오류');
      }
      throw err;
    }
  };

  const purchaseConsumable = async (data: { modelName: string; qty: number; unit: string; unitPrice: number; supplier: string }) => {
    if (!data.modelName?.trim()) {
      showErrorModal('소모품 품명을 입력해주세요.');
      return;
    }
    if (data.qty <= 0) {
      showErrorModal('입고 수량은 1개 이상이어야 합니다.');
      return;
    }
    if (data.unitPrice < 0) {
      showErrorModal('단가는 0원 이상이어야 합니다.');
      return;
    }
    const cleanQty = Math.max(1, Math.floor(data.qty));
    const cleanPrice = Math.max(0, Number(data.unitPrice) || 0);

    let consumable = db.consumables.find(c => c.modelName.replace(/\s/g, '') === data.modelName.replace(/\s/g, ''));
    
    if (consumable) {
      db.updateRow<Consumable>('consumables', consumable.id, {
        stockQty: consumable.stockQty + cleanQty,
        unitPrice: cleanPrice,
        supplier: data.supplier,
        updatedAt: new Date().toISOString()
      });
    } else {
      consumable = db.insertRow<Consumable>('consumables', {
        modelName: data.modelName.trim(),
        stockQty: cleanQty,
        unit: data.unit || '개',
        unitPrice: cleanPrice,
        supplier: data.supplier,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    db.insertRow<ConsumableLog>('consumableLogs', {
      consumableId: consumable.id,
      type: 'INBOUND',
      quantity: cleanQty,
      unitPrice: cleanPrice,
      supplier: data.supplier,
      userId: getValidUserId(currentUser?.id),
      actionDate: new Date().toISOString().split('T')[0],
      description: '소모품 구입 입고',
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  const useConsumable = async (data: { consumableId: string; quantity: number; targetAssetId: string; description: string }) => {
    try {
      if (data.quantity <= 0) {
        showErrorModal('소모 수량은 1개 이상이어야 합니다.');
        throw new Error('소모 수량은 1개 이상이어야 합니다.');
      }
      const cleanQty = Math.max(1, Math.floor(data.quantity));
      const consumable = db.consumables.find(c => c.id === data.consumableId);
      if (!consumable || consumable.stockQty < cleanQty) {
        const msg = `소모품 재고가 부족합니다. (현재고: ${consumable?.stockQty || 0}개 / 요청: ${cleanQty}개)`;
        showErrorModal(`⚠️ ${msg}`);
        throw new Error(msg);
      }

      let remainingQtyToDeduct = cleanQty;
      const lots = db.consumableLots
        .filter(l => l.consumableId === consumable.id && l.currentQty > 0)
        .sort((a, b) => new Date(a.inboundDate).getTime() - new Date(b.inboundDate).getTime());

      for (const lot of lots) {
        if (remainingQtyToDeduct <= 0) break;
        const deductQty = Math.min(lot.currentQty, remainingQtyToDeduct);
        
        db.updateRow<ConsumableLot>('consumableLots', lot.id, {
          currentQty: lot.currentQty - deductQty,
          updatedAt: new Date().toISOString()
        });

        db.insertRow<ConsumableLog>('consumableLogs', {
          consumableId: consumable.id,
          lotId: lot.id,
          type: 'OUTBOUND',
          quantity: deductQty,
          unitPrice: lot.unitPrice,
          targetAssetId: data.targetAssetId,
          userId: getValidUserId(currentUser?.id),
          actionDate: new Date().toISOString().split('T')[0],
          description: data.description,
          createdAt: new Date().toISOString()
        });

        const asset = db.assets.find(a => a.id === data.targetAssetId);
        if (asset) {
          const cost = lot.unitPrice * deductQty;
          db.updateRow<Asset>('assets', asset.id, {
            cumRepairCost: (asset.cumRepairCost || 0) + cost,
            updatedAt: new Date().toISOString()
          });
        }
        
        remainingQtyToDeduct -= deductQty;
      }

      if (remainingQtyToDeduct > 0) {
        throw new Error('Lot 데이터 무결성 오류: 총 재고는 충분하나 Lot 재고의 합이 부족합니다.');
      }

      db.updateRow<Consumable>('consumables', consumable.id, {
        stockQty: consumable.stockQty - cleanQty,
        updatedAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 소모품 사용 처리 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const transferConsumableToMechanic = async (mechanicId: string, consumableId: string, quantity: number, memo?: string): Promise<void> => {
    try {
      if (quantity <= 0) {
        showErrorModal('불출 수량은 1개 이상이어야 합니다.');
        throw new Error('불출 수량은 1개 이상이어야 합니다.');
      }
      const consumable = db.consumables.find(c => c.id === consumableId);
      if (!consumable || consumable.stockQty < quantity) {
        const msg = `본사 재고가 부족합니다. (본사 현재고: ${consumable?.stockQty || 0}개)`;
        showErrorModal(`⚠️ ${msg}`);
        throw new Error(msg);
      }

      const mechanic = db.users.find(u => u.id === mechanicId);
      const mechanicName = mechanic?.name || '정비사';

      let remainingQtyToDeduct = quantity;
      const lots = db.consumableLots
        .filter(l => l.consumableId === consumableId && l.currentQty > 0)
        .sort((a, b) => new Date(a.inboundDate).getTime() - new Date(b.inboundDate).getTime());

      for (const lot of lots) {
        if (remainingQtyToDeduct <= 0) break;
        const deductQty = Math.min(lot.currentQty, remainingQtyToDeduct);
        
        // 1. 본사 재고 차감
        db.updateRow<ConsumableLot>('consumableLots', lot.id, {
          currentQty: lot.currentQty - deductQty,
          updatedAt: new Date().toISOString()
        });

        // 2. 기사 차량 재고 증가
        const existingStock = db.mechanicConsumableStocks.find(s => s.mechanicId === mechanicId && s.lotId === lot.id);
        if (existingStock) {
          db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', existingStock.id, {
            stockQty: existingStock.stockQty + deductQty,
            updatedAt: new Date().toISOString()
          });
        } else {
          const newId = `mcs-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
          db.insertRow<MechanicConsumableStock>('mechanicConsumableStocks', {
            id: newId,
            mechanicId,
            consumableId,
            lotId: lot.id,
            stockQty: deductQty,
            updatedAt: new Date().toISOString()
          });
        }

        // 3. 수불 로그 기록
        db.insertRow<ConsumableLog>('consumableLogs', {
          consumableId,
          lotId: lot.id,
          type: 'TRANSFER_TO_VEHICLE',
          quantity: deductQty,
          unitPrice: lot.unitPrice,
          userId: currentUser?.id,
          mechanicId,
          fromLocation: '주기장 재고',
          toLocation: `${mechanicName} 차량`,
          actionDate: new Date().toISOString().split('T')[0],
          description: memo || `[차량 불출] 주기장 ➔ ${mechanicName} 차량 이동 (${deductQty}개)`,
          createdAt: new Date().toISOString()
        });

        remainingQtyToDeduct -= deductQty;
      }

      if (remainingQtyToDeduct > 0) {
        throw new Error('Lot 데이터 무결성 오류: 총 재고는 충분하나 Lot 재고의 합이 부족합니다.');
      }

      // HQ 마스터 재고 차감
      db.updateRow<Consumable>('consumables', consumableId, {
        stockQty: consumable.stockQty - quantity,
        updatedAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 차량 불출 처리 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const returnConsumableToHq = async (
    mechanicId: string, 
    consumableId: string, 
    quantity: number, 
    memo?: string,
    isDefective: boolean = false,
    disposition: 'REBUILD' | 'SCRAP' | 'VENDOR_WARRANTY' = 'REBUILD'
  ): Promise<void> => {
    try {
      if (quantity <= 0) {
        showErrorModal('반납 수량은 1개 이상이어야 합니다.');
        throw new Error('반납 수량은 1개 이상이어야 합니다.');
      }
      
      const mechStocks = db.mechanicConsumableStocks
        .filter(s => s.mechanicId === mechanicId && s.consumableId === consumableId && s.stockQty > 0);
      
      const totalMechStock = mechStocks.reduce((sum, s) => sum + s.stockQty, 0);

      if (totalMechStock < quantity) {
        const msg = `차량 보유 재고가 부족합니다. (차량 현재고: ${totalMechStock}개)`;
        showErrorModal(`⚠️ ${msg}`);
        throw new Error(msg);
      }

      const consumable = db.consumables.find(c => c.id === consumableId);
      const mechanic = db.users.find(u => u.id === mechanicId);
      const mechanicName = mechanic?.name || '정비사';

      // Sort mechanic stocks by inboundDate of their lot (FIFO from vehicle)
      mechStocks.sort((a, b) => {
        const lotA = db.consumableLots.find(l => l.id === a.lotId);
        const lotB = db.consumableLots.find(l => l.id === b.lotId);
        return new Date(lotA?.inboundDate || 0).getTime() - new Date(lotB?.inboundDate || 0).getTime();
      });

      let remainingQty = quantity;

      for (const stock of mechStocks) {
        if (remainingQty <= 0) break;
        const deductQty = Math.min(stock.stockQty, remainingQty);
        const lot = db.consumableLots.find(l => l.id === stock.lotId);

        // 1. 기사 차량 재고 차감
        db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', stock.id, {
          stockQty: stock.stockQty - deductQty,
          updatedAt: new Date().toISOString()
        });

        // 2. 신품 정상 반납 vs 고품 격리 처리
        if (!isDefective) {
          if (lot) {
            db.updateRow<ConsumableLot>('consumableLots', lot.id, {
              currentQty: lot.currentQty + deductQty,
              updatedAt: new Date().toISOString()
            });
          }
        } else {
          const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
          const newPartNo = `COL-${todayStr}-${Math.floor(1000 + Math.random() * 9000)}`;
          db.insertRow<CollectedPart>('collectedParts', {
            id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            partNo: newPartNo,
            consumableId,
            lotId: lot?.id,
            modelName: consumable?.modelName || '부품',
            mechanicId,
            mechanicName,
            quantity: deductQty,
            disposition,
            status: 'RECEIVED',
            receivedDate: new Date().toISOString().split('T')[0],
            memo: memo || `[고품 수거] ${mechanicName} 차량 반납 (${disposition})`,
            createdAt: new Date().toISOString()
          });
        }

        db.insertRow<ConsumableLog>('consumableLogs', {
          consumableId,
          lotId: lot?.id,
          type: 'RETURN_TO_HQ',
          quantity: deductQty,
          unitPrice: lot?.unitPrice || consumable?.unitPrice || 0,
          userId: currentUser?.id,
          mechanicId,
          fromLocation: `${mechanicName} 차량`,
          toLocation: !isDefective ? '주기장 재고' : `고품 격리실 (${disposition})`,
          actionDate: new Date().toISOString().split('T')[0],
          description: memo || (!isDefective 
            ? `[주기장 반납] ${mechanicName} 차량 ➔ 주기장 재고 회수 (${deductQty}개)`
            : `[고품 반납] ${mechanicName} 차량 ➔ 고품 격리 (${disposition}, ${deductQty}개)`),
          createdAt: new Date().toISOString()
        });

        remainingQty -= deductQty;
      }

      if (!isDefective && consumable) {
        db.updateRow<Consumable>('consumables', consumableId, {
          stockQty: consumable.stockQty + quantity,
          updatedAt: new Date().toISOString()
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 본사 반납 처리 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const transferConsumableBetweenMechanics = async (
    fromMechanicId: string,
    toMechanicId: string,
    consumableId: string,
    quantity: number,
    memo?: string
  ): Promise<void> => {
    try {
      if (fromMechanicId === toMechanicId) {
        showErrorModal('동일한 정비사 차량 간에는 이동할 수 없습니다.');
        throw new Error('동일한 정비사 차량 간에는 이동할 수 없습니다.');
      }
      if (quantity <= 0) {
        showErrorModal('이동 수량은 1개 이상이어야 합니다.');
        throw new Error('이동 수량은 1개 이상이어야 합니다.');
      }

      const fromStocks = db.mechanicConsumableStocks
        .filter(s => s.mechanicId === fromMechanicId && s.consumableId === consumableId && s.stockQty > 0);
      
      const totalFromStock = fromStocks.reduce((sum, s) => sum + s.stockQty, 0);

      if (totalFromStock < quantity) {
        const msg = `양도 정비사 차량의 보유 재고가 부족합니다. (현재고: ${totalFromStock}개)`;
        showErrorModal(`⚠️ ${msg}`);
        throw new Error(msg);
      }

      const fromUser = db.users.find(u => u.id === fromMechanicId);
      const toUser = db.users.find(u => u.id === toMechanicId);
      const consumable = db.consumables.find(c => c.id === consumableId);

      // Sort by inboundDate (FIFO)
      fromStocks.sort((a, b) => {
        const lotA = db.consumableLots.find(l => l.id === a.lotId);
        const lotB = db.consumableLots.find(l => l.id === b.lotId);
        return new Date(lotA?.inboundDate || 0).getTime() - new Date(lotB?.inboundDate || 0).getTime();
      });

      let remainingQty = quantity;

      for (const stock of fromStocks) {
        if (remainingQty <= 0) break;
        const deductQty = Math.min(stock.stockQty, remainingQty);
        const lot = db.consumableLots.find(l => l.id === stock.lotId);

        // 1. 양도 차량 재고 차감
        db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', stock.id, {
          stockQty: stock.stockQty - deductQty,
          updatedAt: new Date().toISOString()
        });

        // 2. 양수 차량 재고 증가
        const toStock = db.mechanicConsumableStocks.find(s => s.mechanicId === toMechanicId && s.lotId === lot?.id);
        if (toStock) {
          db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', toStock.id, {
            stockQty: toStock.stockQty + deductQty,
            updatedAt: new Date().toISOString()
          });
        } else {
          db.insertRow<MechanicConsumableStock>('mechanicConsumableStocks', {
            id: `mcs-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            mechanicId: toMechanicId,
            consumableId,
            lotId: lot?.id || '',
            stockQty: deductQty,
            updatedAt: new Date().toISOString()
          });
        }

        // 3. 수불 로그 기록
        db.insertRow<ConsumableLog>('consumableLogs', {
          consumableId,
          lotId: lot?.id,
          type: 'TRANSFER_TO_VEHICLE',
          quantity: deductQty,
          unitPrice: lot?.unitPrice || consumable?.unitPrice || 0,
          userId: currentUser?.id,
          mechanicId: toMechanicId,
          fromLocation: `${fromUser?.name || '정비사'} 차량`,
          toLocation: `${toUser?.name || '정비사'} 차량`,
          actionDate: new Date().toISOString().split('T')[0],
          description: memo || `[차량 간 융통] ${fromUser?.name} 차량 ➔ ${toUser?.name} 차량 (${deductQty}개)`,
          createdAt: new Date().toISOString()
        });

        remainingQty -= deductQty;
      }

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 차량 간 부품 융통 처리 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const createStocktakingAudit = async (
    targetType: 'HQ' | 'VEHICLE',
    mechanicId?: string,
    memo?: string
  ): Promise<StocktakingAudit> => {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const ymdCompact = dateStr.replace(/-/g, '');
      const auditNo = `STK-${ymdCompact}-${Math.floor(1000 + Math.random() * 9000)}`;

      let mechanicName: string | undefined;
      let vehicleNo: string | undefined;

      if (targetType === 'VEHICLE') {
        if (!mechanicId) throw new Error('차량 실사의 경우 담당 정비사를 지정해야 합니다.');
        const mech = db.users.find(u => u.id === mechanicId);
        mechanicName = mech?.name;
        const corpVehicle = db.corporateVehicles.find(v => v.primaryDriverId === mechanicId);
        vehicleNo = corpVehicle?.vehicleNo || (mech as any)?.vehicleNo || '';
      }

      const newAuditId = `stk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      
      const itemsToInsert: StocktakingAuditItem[] = [];
      let totalSystemQty = 0;
      let totalSystemAmount = 0;

      if (targetType === 'HQ') {
        // 1. 소모품 스냅샷
        db.consumables.forEach(c => {
          const sysQty = c.stockQty || 0;
          const uPrice = c.unitPrice || 0;
          totalSystemQty += sysQty;
          totalSystemAmount += sysQty * uPrice;

          itemsToInsert.push({
            id: `sti-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            auditId: newAuditId,
            itemType: 'CONSUMABLE',
            consumableId: c.id,
            modelName: c.modelName,
            unit: c.unit,
            unitPrice: uPrice,
            systemQty: sysQty,
            actualQty: sysQty,
            diffQty: 0,
            diffAmount: 0
          });
        });

        // 2. 비가동 장비 스냅샷
        const nonOpAssets = db.assets.filter(a => ['AVAILABLE', 'REPAIRING', 'RENTED_RETURNED'].includes(a.status));
        nonOpAssets.forEach(a => {
          const sysQty = 1;
          const uPrice = 0;
          totalSystemQty += sysQty;
          totalSystemAmount += sysQty * uPrice;

          itemsToInsert.push({
            id: `sti-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            auditId: newAuditId,
            itemType: 'ASSET',
            assetId: a.id,
            assetNo: a.assetNo,
            modelName: a.modelName,
            unit: '대',
            unitPrice: uPrice,
            systemQty: sysQty,
            actualQty: sysQty,
            diffQty: 0,
            diffAmount: 0
          });
        });

      } else if (targetType === 'VEHICLE' && mechanicId) {
        const mechStocks = db.mechanicConsumableStocks.filter(s => s.mechanicId === mechanicId && s.stockQty > 0);
        const grouped = mechStocks.reduce((acc, s) => {
          if (!acc[s.consumableId]) acc[s.consumableId] = 0;
          acc[s.consumableId] += s.stockQty;
          return acc;
        }, {} as Record<string, number>);

        Object.keys(grouped).forEach(cId => {
          const sysQty = grouped[cId];
          const consumable = db.consumables.find(c => c.id === cId);
          if (!consumable) return;
          const uPrice = consumable.unitPrice || 0;
          totalSystemQty += sysQty;
          totalSystemAmount += sysQty * uPrice;

          itemsToInsert.push({
            id: `sti-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            auditId: newAuditId,
            itemType: 'CONSUMABLE',
            consumableId: consumable.id,
            modelName: consumable.modelName,
            unit: consumable.unit,
            unitPrice: uPrice,
            systemQty: sysQty,
            actualQty: sysQty,
            diffQty: 0,
            diffAmount: 0
          });
        });
      }

      if (itemsToInsert.length === 0) {
        throw new Error('실사 대상 품목/장비가 없습니다.');
      }

      const newAudit: StocktakingAudit = {
        id: newAuditId,
        auditNo,
        targetType,
        mechanicId,
        mechanicName,
        vehicleNo,
        auditDate: dateStr,
        auditorId: currentUser?.id || '',
        auditorName: currentUser?.name || '시스템',
        status: 'DRAFT',
        totalSystemQty,
        totalActualQty: totalSystemQty,
        totalDiffQty: 0,
        totalSystemAmount,
        totalActualAmount: totalSystemAmount,
        totalDiffAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.insertRow<StocktakingAudit>('stocktakingAudits', newAudit);
      itemsToInsert.forEach(i => db.insertRow<StocktakingAuditItem>('stocktakingAuditItems', i));

      await db.awaitPendingWrites();
      refreshAllData();
      
      return newAudit;
    } catch (err: any) {
      showErrorModal(`⚠️ 실사 전표 생성 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const updateStocktakingItem = async (
    auditId: string,
    itemId: string,
    actualQty: number,
    diffReason?: StocktakingAuditItem['diffReason'],
    note?: string
  ): Promise<void> => {
    try {
      const item = db.stocktakingAuditItems.find(i => i.id === itemId && i.auditId === auditId);
      if (!item) throw new Error('실사 품목을 찾을 수 없습니다.');

      const clampedActualQty = Math.max(0, actualQty);
      const diffQty = clampedActualQty - item.systemQty;
      const diffAmount = diffQty * item.unitPrice;

      db.updateRow<StocktakingAuditItem>('stocktakingAuditItems', itemId, {
        actualQty: clampedActualQty,
        diffQty,
        diffAmount,
        diffReason: diffQty !== 0 ? (diffReason || item.diffReason || 'OTHER') : undefined,
        note
      });

      // 마스터 합계 갱신
      const allItems = db.stocktakingAuditItems.filter(i => i.auditId === auditId);
      const updatedItems = allItems.map(i => i.id === itemId ? { ...i, actualQty: clampedActualQty, diffQty, diffAmount } : i);
      const totalSystemQty = updatedItems.reduce((acc, i) => acc + (i.systemQty || 0), 0);
      const totalActualQty = updatedItems.reduce((acc, i) => acc + (i.actualQty || 0), 0);
      const totalDiffQty = totalActualQty - totalSystemQty;
      const totalSystemAmount = updatedItems.reduce((acc, i) => acc + ((i.systemQty || 0) * (i.unitPrice || 0)), 0);
      const totalActualAmount = updatedItems.reduce((acc, i) => acc + ((i.actualQty || 0) * (i.unitPrice || 0)), 0);
      const totalDiffAmount = totalActualAmount - totalSystemAmount;

      db.updateRow<StocktakingAudit>('stocktakingAudits', auditId, {
        totalSystemQty,
        totalActualQty,
        totalDiffQty,
        totalSystemAmount,
        totalActualAmount,
        totalDiffAmount,
        updatedAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 실사 품목 수량 수정 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const confirmStocktakingAudit = async (auditId: string): Promise<void> => {
    try {
      const audit = db.stocktakingAudits.find(a => a.id === auditId);
      if (!audit) throw new Error('실사 전표를 찾을 수 없습니다.');
      if (audit.status === 'CONFIRMED') throw new Error('이미 확정 완료된 실사 전표입니다.');

      const items = db.stocktakingAuditItems.filter(i => i.auditId === auditId);
      const targetLocation = audit.targetType === 'HQ' ? '주기장 재고' : `${audit.mechanicName || '정비사'} 차량`;

      items.forEach(item => {
        if (item.diffQty !== 0) {
          if (item.itemType === 'ASSET' && item.assetId) {
            if (item.diffQty < 0) {
              db.updateRow<Asset>('assets', item.assetId, {
                status: 'LOST',
                updatedAt: new Date().toISOString()
              });
              
              const reasonText = item.diffReason === 'LOST' ? '망실/도난' 
              : item.diffReason === 'DAMAGED' ? '파손/폐기'
              : '실사누락(망실)';

              db.insertRow<AssetInOutLog>('assetInOutLogs', {
                id: `aio-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                assetId: item.assetId,
                assetNo: item.assetNo || '',
                modelName: item.modelName,
                type: 'DISPOSAL',
                eventDate: new Date().toISOString().split('T')[0],
                memo: `[자산 증발] 실사결과 없음. 처리사유: ${reasonText}`,
                createdAt: new Date().toISOString()
              });
            } else if (item.diffQty > 0) {
              db.updateRow<Asset>('assets', item.assetId, {
                status: 'AVAILABLE',
                updatedAt: new Date().toISOString()
              });
              
              db.insertRow<AssetInOutLog>('assetInOutLogs', {
                id: `aio-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                assetId: item.assetId,
                assetNo: item.assetNo || '',
                modelName: item.modelName,
                type: 'INBOUND',
                eventDate: new Date().toISOString().split('T')[0],
                memo: `[자산 잉여 발견] 실사결과 존재함 (가동대기 복구).`,
                createdAt: new Date().toISOString()
              });
            }
          } else if (item.consumableId) {
            // 소모품 처리
            if (audit.targetType === 'HQ') {
              const c = db.consumables.find(con => con.id === item.consumableId);
              if (c) {
                db.updateRow<Consumable>('consumables', c.id, {
                  stockQty: item.actualQty,
                  updatedAt: new Date().toISOString()
                });
                let diff = item.diffQty; 
                const lots = db.consumableLots
                  .filter(l => l.consumableId === item.consumableId)
                  .sort((a, b) => new Date(a.inboundDate).getTime() - new Date(b.inboundDate).getTime());
                  
                if (diff < 0) {
                  let toDeduct = Math.abs(diff);
                  for (const lot of lots.filter(l => l.currentQty > 0)) {
                    if (toDeduct <= 0) break;
                    const deduct = Math.min(lot.currentQty, toDeduct);
                    db.updateRow<ConsumableLot>('consumableLots', lot.id, { currentQty: lot.currentQty - deduct, updatedAt: new Date().toISOString() });
                    toDeduct -= deduct;
                  }
                } else if (diff > 0 && lots.length > 0) {
                  const newestLot = lots[lots.length - 1];
                  db.updateRow<ConsumableLot>('consumableLots', newestLot.id, { currentQty: newestLot.currentQty + diff, updatedAt: new Date().toISOString() });
                }
              }
            } else {
              const mechStocks = db.mechanicConsumableStocks
                .filter(s => s.mechanicId === audit.mechanicId && s.consumableId === item.consumableId)
                .sort((a, b) => {
                  const lotA = db.consumableLots.find(l => l.id === a.lotId);
                  const lotB = db.consumableLots.find(l => l.id === b.lotId);
                  return new Date(lotA?.inboundDate || 0).getTime() - new Date(lotB?.inboundDate || 0).getTime();
                });

              let diff = item.diffQty;
              if (mechStocks.length === 0) {
                const newestLot = db.consumableLots.filter(l => l.consumableId === item.consumableId).sort((a, b) => new Date(b.inboundDate).getTime() - new Date(a.inboundDate).getTime())[0];
                db.insertRow<MechanicConsumableStock>('mechanicConsumableStocks', {
                  id: `mcs-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                  mechanicId: audit.mechanicId!,
                  consumableId: item.consumableId,
                  lotId: newestLot?.id || '',
                  stockQty: item.actualQty,
                  updatedAt: new Date().toISOString()
                });
              } else if (diff < 0) {
                let toDeduct = Math.abs(diff);
                for (const stock of mechStocks.filter(s => s.stockQty > 0)) {
                  if (toDeduct <= 0) break;
                  const deduct = Math.min(stock.stockQty, toDeduct);
                  db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', stock.id, { stockQty: stock.stockQty - deduct, updatedAt: new Date().toISOString() });
                  toDeduct -= deduct;
                }
              } else if (diff > 0) {
                const newestStock = mechStocks[mechStocks.length - 1];
                db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', newestStock.id, { stockQty: newestStock.stockQty + diff, updatedAt: new Date().toISOString() });
              }
            }

            const reasonText = item.diffReason === 'LOST' ? '망실/도난' 
              : item.diffReason === 'DAMAGED' ? '파손/폐기'
              : item.diffReason === 'UNRECORDED_USAGE' ? '미기록현장소모'
              : item.diffReason === 'SURPLUS' ? '미등록잉여' : '기타사유';

            db.insertRow<ConsumableLog>('consumableLogs', {
              consumableId: item.consumableId,
              type: 'ADJUST',
              quantity: Math.abs(item.diffQty),
              unitPrice: item.unitPrice,
              userId: currentUser?.id,
              mechanicId: audit.mechanicId,
              fromLocation: targetLocation,
              toLocation: item.diffQty < 0 ? `실사 손실 (${reasonText})` : targetLocation,
              actionDate: new Date().toISOString().split('T')[0],
              description: `[실사 보정] ${targetLocation} (${item.diffQty > 0 ? '+' : ''}${item.diffQty}개, ${reasonText})`,
              createdAt: new Date().toISOString()
            });
          }
        }
      });

      db.updateRow<StocktakingAudit>('stocktakingAudits', audit.id, {
        status: 'CONFIRMED',
        confirmedAt: new Date().toISOString(),
        confirmedBy: currentUser?.name || '시스템',
        updatedAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 실사 확정 처리 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const cancelStocktakingAudit = async (auditId: string): Promise<void> => {
    try {
      const audit = db.stocktakingAudits.find(a => a.id === auditId);
      if (!audit) throw new Error('실사 전표를 찾을 수 없습니다.');
      if (audit.status === 'CONFIRMED') throw new Error('이미 확정된 실사 전표는 취소할 수 없습니다.');

      db.updateRow<StocktakingAudit>('stocktakingAudits', auditId, {
        status: 'CANCELLED',
        updatedAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 실사 전표 취소 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const processCollectedPart = async (
    partId: string, 
    actionStatus: 'IN_PROCESS' | 'COMPLETED', 
    actionMemo?: string
  ): Promise<void> => {
    try {
      const part = db.collectedParts.find(p => p.id === partId);
      if (!part) throw new Error('수거 고품을 찾을 수 없습니다.');

      db.updateRow<CollectedPart>('collectedParts', partId, {
        status: actionStatus,
        actionDate: actionStatus === 'COMPLETED' ? new Date().toISOString().split('T')[0] : part.actionDate,
        actionMemo: actionMemo || part.actionMemo
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 고품 사후처리 갱신 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  // ─── [전사 정비 & AS 단일 물리 통합 핵심 비즈니스 로직] ─────────
  const createFieldAsTicket = async (data: Partial<Repair>): Promise<Repair> => {
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const ymCompact = dateStr.replace(/-/g, '').slice(2, 8);
      const existingList = db.repairs;
      const todayPrefix = `AS-${ymCompact}`;
      let maxNum = 0;
      existingList.forEach(t => {
        if (t.ticketNo && t.ticketNo.startsWith(todayPrefix)) {
          const num = parseInt(t.ticketNo.replace(`${todayPrefix}-`, ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const ticketNo = `${todayPrefix}-${String(maxNum + 1).padStart(3, '0')}`;
      const newRepairId = data.id || db.generateNextId('repairs', db.repairs);

      // 💡 계약 및 1대 단독계약 자산 자동 매핑 (사장님 확정 1번 원칙)
      let resolvedContractId = data.contractId;
      let resolvedAssetId = data.assetId;
      let resolvedAssetNo = data.assetNo;
      let resolvedModelName = data.modelName;

      if (!resolvedContractId && (data.customerId || data.siteId)) {
        const matchedContract = db.contracts.find(c => 
          (data.customerId && c.customerId === data.customerId) || 
          (data.siteId && c.siteId === data.siteId)
        );
        if (matchedContract) {
          resolvedContractId = matchedContract.id;
        }
      }

      const isExplicitUnknownAsset =
        resolvedAssetNo === '관리번호 모름' || resolvedAssetNo === '관리번호모름';

      if (
        !isExplicitUnknownAsset &&
        resolvedContractId &&
        (!resolvedAssetId || resolvedAssetId === '현장확인' || resolvedAssetNo === '현장확인')
      ) {
        const cas = db.contractAssets.filter(ca => ca.contractId === resolvedContractId && ca.status !== 'RETURNED');
        if (cas.length === 1 && cas[0].assetId) {
          const singleAsset = db.assets.find(a => a.id === cas[0].assetId);
          if (singleAsset) {
            resolvedAssetId = singleAsset.id;
            resolvedAssetNo = singleAsset.assetNo;
            resolvedModelName = singleAsset.modelName;
          }
        }
      }

      // 💡 도로명 상세 주소 자동 역추적 및 매핑 (T맵/내비 연동 단일 진실의 원천)
      let resolvedSiteAddress = data.siteAddress?.trim();
      if (!resolvedSiteAddress) {
        resolvedSiteAddress = resolveSiteDetailedAddress({
          siteId: data.siteId,
          siteName: data.siteName,
          contractId: resolvedContractId,
          assetNo: resolvedAssetNo,
          assetId: resolvedAssetId,
          customerName: data.customerName,
          locationDetail: data.locationDetail,
          customerSites: db.customerSites,
          contracts: db.contracts,
          contractAssets: db.contractAssets,
          customers: db.customers,
        });
        if (resolvedSiteAddress === (data.siteName || data.customerName || '현장')) {
          const cust = db.customers.find(c => (data.customerId && c.id === data.customerId) || (data.customerName && c.name === data.customerName));
          if (cust?.address?.trim()) {
            resolvedSiteAddress = cust.address.trim();
          } else {
            resolvedSiteAddress = '';
          }
        }
      }

      const initialMemo = data.memo || '';
      const finalMemo = (resolvedSiteAddress && !initialMemo.includes(resolvedSiteAddress))
        ? (initialMemo ? `${initialMemo}\n[현장도로명: ${resolvedSiteAddress}]` : `[현장도로명: ${resolvedSiteAddress}]`)
        : initialMemo;

      const newTicket = db.insertRow<Repair>('repairs', {
        id: newRepairId,
        ticketNo: data.ticketNo || ticketNo,
        workCategory: 'FIELD_AS',
        workLocation: 'SITE',
        stockSource: 'VEHICLE_VAN',
        maintenanceType: 'EMERGENCY_AS',
        repairType: 'INTERNAL',
        source: data.source || 'DIRECT_INTAKE',
        contractId: resolvedContractId,
        customerId: data.customerId || '',
        customerName: data.customerName || '',
        siteId: data.siteId || '',
        siteName: data.siteName || '',
        siteAddress: resolvedSiteAddress || '',
        assetId: resolvedAssetId || '',
        assetNo: resolvedAssetNo || '관리번호 모름',
        modelName: resolvedModelName || (isExplicitUnknownAsset ? '' : '고소작업대'),
        locationDetail: data.locationDetail || (resolvedSiteAddress ? resolvedSiteAddress : ''),
        reporterName: data.reporterName || '',
        reporterContact: data.reporterContact || '',
        issueCategory: data.issueCategory || '기타',
        issueDescription: data.issueDescription || '',
        details: data.issueDescription || '',
        errorCode: data.errorCode || '',
        priority: data.priority || 'NORMAL',
        status: data.status || 'REQUESTED',
        requestDate: data.requestDate || dateStr,
        visitDate: data.visitDate || '',
        scheduleDate: data.visitDate || '',
        mechanicId: data.mechanicId || data.assignedMechanicId || '',
        assignedMechanicId: data.mechanicId || data.assignedMechanicId || '',
        mechanicName: data.mechanicName || '',
        actionTaken: data.actionTaken || '',
        resolutionType: data.resolutionType || undefined,
        partsUsed: data.partsUsed || [],
        collectedParts: data.collectedParts || [],
        billableType: data.billableType || 'FREE',
        billableAmount: data.billableAmount || 0,
        billableToCustomer: data.billableType === 'BILLABLE',
        faultImageUrl: data.faultImageUrl || (data.evidenceImages && data.evidenceImages[0]) || '',
        evidenceImages: data.evidenceImages || (data.faultImageUrl ? [data.faultImageUrl] : []),
        beforeImage: data.beforeImage || data.faultImageUrl || (data.evidenceImages && data.evidenceImages[0]) || '',
        afterImage: data.afterImage || '',
        customerSignature: data.customerSignature || '',
        customerConfirmName: data.customerConfirmName || '',
        parentRepairId: data.parentRepairId || data.parentTicketId || '',
        revisitRepairId: data.revisitRepairId || data.revisitTicketId || '',
        revisitDate: data.revisitDate || '',
        revisitReason: data.revisitReason || '',
        exchangeSuggested: !!data.exchangeSuggested,
        memo: finalMemo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();

      // 🚀 [단일 업무 인계 파이프라인] 정비팀에 물리 ToDo 영구 적재 + 실시간 브로드캐스트
      await issueHandoverTask({
        category: 'AS_DISPATCH_REPAIR',
        title: `[긴급 AS 출동] ${newTicket.customerName || '현장'} (${newTicket.modelName || '장비'})`,
        content: `증상: ${newTicket.issueCategory || '기타'} - ${newTicket.issueDescription || 'AS 요청'} (현장: ${newTicket.siteName || '-'})`,
        targetDept: 'AS',
        priority: 'URGENT',
        actionUrl: '/mobile?tab=as',
        entityType: 'REPAIR',
        entityId: newTicket.id,
        senderId: currentUser?.id,
        senderName: currentUser?.name
      });

      return newTicket;
    } catch (err: any) {
      showErrorModal(`⚠️ AS 접수 생성 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const updateFieldAsTicketStatus = async (ticketId: string, status: Repair['status'], extra?: Partial<Repair>): Promise<void> => {
    try {
      db.updateRow<Repair>('repairs', ticketId, {
        status,
        ...(extra || {}),
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ AS 상태 변경 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const logFieldAsTimelineEvent = async (
    ticketId: string,
    eventType: 'CALL_MADE' | 'TRANSIT_START' | 'ARRIVED' | 'COMPLETED',
    detail?: string
  ): Promise<void> => {
    try {
      const ticket = db.repairs.find(t => t.id === ticketId);
      if (!ticket) return;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const mechanicName = currentUser?.name || ticket.mechanicName || '담당기사';

      let label = '';
      let newStatus = ticket.status;

      if (eventType === 'CALL_MADE') {
        label = `📞 [${timeStr}] ${mechanicName} 현장 통화 발신 (${detail || ticket.reporterContact || ''})`;
      } else if (eventType === 'TRANSIT_START') {
        label = `🚗 [${timeStr}] ${mechanicName} ${detail || '내비 길안내'} (현장 이동 시작)`;
        if (ticket.status === 'REQUESTED' || ticket.status === 'SCHEDULED') {
          newStatus = 'IN_PROGRESS';
        }
      } else if (eventType === 'ARRIVED') {
        label = `📍 [${timeStr}] ${mechanicName} 현장 도착 및 점검 착수`;
        newStatus = 'IN_PROGRESS';
      } else if (eventType === 'COMPLETED') {
        label = `✅ [${timeStr}] ${mechanicName} 현장 조치 완료 (${detail || ''})`;
      }

      const eventItem = {
        id: `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        eventType,
        label,
        mechanicId: currentUser?.id || ticket.assignedMechanicId || '',
        mechanicName,
        detail,
        timestamp: now.toISOString()
      };

      const existingEvents = ticket.timelineEvents || [];
      const updatedEvents = [...existingEvents, eventItem];

      db.updateRow<Repair>('repairs', ticketId, {
        status: newStatus,
        timelineEvents: updatedEvents,
        updatedAt: now.toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.warn('Timeline log error:', err);
    }
  };

  const recordAsRouteEvent = async (params: {
    eventType: AsRouteEventType;
    ticketId?: string;
    nextTicketId?: string;
    nextSiteCustomName?: string;
    sourcingType?: AsPartsSourcingType;
    sourcingTargetName?: string;
    partName?: string;
    revisitDate?: string;
    memo?: string;
    mechanicId?: string;
    mechanicName?: string;
  }): Promise<AsRouteLog> => {
    try {
      const targetTicket = params.ticketId ? db.repairs.find(r => r.id === params.ticketId) || null : null;
      const targetNextTicket = params.nextTicketId ? db.repairs.find(r => r.id === params.nextTicketId) || null : null;
      const resolvedMechanicId =
        params.mechanicId ||
        currentUser?.id ||
        targetTicket?.mechanicId ||
        targetTicket?.assignedMechanicId ||
        'u-mechanic';
      const matchedUser = db.users.find(u => u.id === resolvedMechanicId);
      const resolvedMechanicName =
        params.mechanicName ||
        matchedUser?.name ||
        currentUser?.name ||
        targetTicket?.mechanicName ||
        '담당기사';

      const createdLog = await recordAsRouteStep({
        eventType: params.eventType,
        mechanicId: resolvedMechanicId,
        mechanicName: resolvedMechanicName,
        ticket: targetTicket,
        nextTicket: targetNextTicket,
        nextSiteCustomName: params.nextSiteCustomName,
        sourcingType: params.sourcingType,
        sourcingTargetName: params.sourcingTargetName,
        partName: params.partName,
        revisitDate: params.revisitDate,
        memo: params.memo,
      });
      refreshAllData();
      return createdLog;
    } catch (err: any) {
      showErrorModal(`동선 기록 저장 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const completeFieldAsTicket = async (ticketId: string, data: {
    mechanicId: string;
    actionTaken: string;
    resolutionType: Repair['resolutionType'];
    partsUsed?: RepairPartUsed[];
    collectedParts?: RepairCollectedPart[];
    billableType: 'FREE' | 'BILLABLE';
    billableAmount: number;
    beforeImage?: string;
    afterImage?: string;
    customerSignature?: string;
    customerConfirmName?: string;
    revisitDate?: string;
    revisitReason?: string;
    exchangeSuggested?: boolean;
    inspectionItemId?: string;
    inspectionItemCode?: string;
    degradationScore?: number;
    durationMinutes?: number;
    spentManHours?: number;
    assetId?: string;
    assetNo?: string;
    modelName?: string;
    visitDate?: string;
  }): Promise<void> => {
    try {
      const ticket = db.repairs.find(t => t.id === ticketId);
      if (!ticket) throw new Error('해당 정비/AS 접수건을 찾을 수 없습니다.');

      const mechanic = db.users.find(u => u.id === data.mechanicId);
      const mechanicName = mechanic?.name || ticket.mechanicName || '담당기사';
      const nowIso = new Date().toISOString();
      const actionDateStr = data.visitDate || ticket.visitDate || nowIso.split('T')[0];

      // 0. 대상 자산(assetId / assetNo / modelName) 정밀 매핑 및 다단계 자동 추적
      const rawInputAssetId = (data.assetId ?? ticket.assetId ?? '').trim();
      const rawInputAssetNo = (data.assetNo ?? ticket.assetNo ?? '').trim();
      let matchedAsset = rawInputAssetId
        ? db.assets.find(a => a.id === rawInputAssetId)
        : undefined;

      if (!matchedAsset && rawInputAssetNo && rawInputAssetNo !== '현장확인' && rawInputAssetNo !== '전체장비') {
        matchedAsset = db.assets.find(
          a => (a.assetNo || '').trim().toUpperCase() === rawInputAssetNo.toUpperCase()
        );
      }

      // 미지정('현장확인' 등)인 경우 계약 또는 동일 현장의 단일 활성 대여 자산 자동 역추적
      if (!matchedAsset && (!rawInputAssetNo || rawInputAssetNo === '현장확인')) {
        if (ticket.contractId) {
          const activeCas = (db.contractAssets || []).filter(
            ca => ca.contractId === ticket.contractId && ca.status !== 'RETURNED' && ca.assetId
          );
          if (activeCas.length === 1 && activeCas[0].assetId) {
            matchedAsset = db.assets.find(a => a.id === activeCas[0].assetId);
          }
        }
        if (!matchedAsset && (ticket.siteId || ticket.siteName)) {
          const siteContracts = (db.contracts || []).filter(c => {
            if (c.status === 'COMPLETED') return false;
            if (ticket.siteId && c.siteId === ticket.siteId) return true;
            if (ticket.customerId && c.customerId !== ticket.customerId) return false;
            const siteObj = c.siteId ? (db.customerSites || []).find(s => s.id === c.siteId) : undefined;
            return Boolean(ticket.siteName && siteObj?.name && siteObj.name.trim() === ticket.siteName.trim());
          });
          const siteContractIds = new Set(siteContracts.map(c => c.id));
          const activeSiteCas = (db.contractAssets || []).filter(
            ca => siteContractIds.has(ca.contractId) && ca.status !== 'RETURNED' && ca.assetId
          );
          const uniqueAssetIds = Array.from(new Set(activeSiteCas.map(ca => ca.assetId).filter(Boolean)));
          if (uniqueAssetIds.length === 1 && uniqueAssetIds[0]) {
            matchedAsset = db.assets.find(a => a.id === uniqueAssetIds[0]);
          }
        }
      }

      const resolvedAssetId = matchedAsset?.id || (rawInputAssetId || undefined);
      const resolvedAssetNo = matchedAsset?.assetNo || (rawInputAssetNo || '현장확인');
      const resolvedModelName =
        matchedAsset?.modelName ||
        data.modelName ||
        ticket.modelName ||
        ticket.locationDetail ||
        '고소작업대';

      // 1. 소모품 차량 재고 다중 로트(FIFO) 유효성 검사 및 차감 + 정비소모품(repairConsumables) 매핑
      let totalPartsCost = 0;
      if (data.partsUsed && data.partsUsed.length > 0) {
        // 1-1. 동일 품목 중복 선택 합산 검증 및 기사 차량 내 가용 로트 총합 검증
        const requiredByConsumable = new Map<string, { qty: number; modelName: string }>();
        for (const part of data.partsUsed) {
          if (!part.quantity || part.quantity <= 0) {
            throw new Error(`사용 부품("${part.modelName}")의 수량은 1개 이상이어야 합니다.`);
          }
          const prev = requiredByConsumable.get(part.consumableId);
          requiredByConsumable.set(part.consumableId, {
            qty: (prev?.qty || 0) + part.quantity,
            modelName: part.modelName || prev?.modelName || '소모품'
          });
        }

        for (const [consId, reqInfo] of requiredByConsumable.entries()) {
          const mechStocks = db.mechanicConsumableStocks.filter(
            s => s.mechanicId === data.mechanicId && s.consumableId === consId && (s.stockQty || 0) > 0
          );
          const totalAvailableQty = mechStocks.reduce((acc, s) => acc + (s.stockQty || 0), 0);
          if (totalAvailableQty < reqInfo.qty) {
            throw new Error(`⚠️ [차량 재고 부족] ${mechanicName} 기사의 차량 재고에 "${reqInfo.modelName}" 품목이 부족합니다.\n(현재 적재: ${totalAvailableQty}개 / 사용 필요: ${reqInfo.qty}개)\n\n[소모품 관리 ➔ 차량별 이동재고] 메뉴에서 주기장 재고를 차량으로 먼저 불출(이동) 등록해 주시기 바랍니다.`);
          }
        }

        // 기존에 동일 티켓으로 등록된 repairConsumables가 있으면 중복 누적 방지를 위해 정리
        const prevRepairConsumables = (db.repairConsumables || []).filter(rc => rc.repairId === ticket.id);
        for (const prevRc of prevRepairConsumables) {
          db.deleteRow('repairConsumables', prevRc.id);
        }

        // 1-2. 실제 차감 수행 (로트 입고일 기준 선입선출 FIFO 차감 및 targetAssetId / lotId 무누락 기록)
        for (const part of data.partsUsed) {
          const cMaster = db.consumables.find(c => c.id === part.consumableId);
          const fallbackUnitPrice = part.unitPrice ?? cMaster?.unitPrice ?? 0;
          let remainingToDeduct = part.quantity;
          let partActualCost = 0;
          let primaryLotId: string | undefined = undefined;

          const mechStocks = db.mechanicConsumableStocks
            .filter(s => s.mechanicId === data.mechanicId && s.consumableId === part.consumableId && (s.stockQty || 0) > 0)
            .sort((a, b) => {
              const lotA = db.consumableLots.find(l => l.id === a.lotId);
              const lotB = db.consumableLots.find(l => l.id === b.lotId);
              return new Date(lotA?.inboundDate || 0).getTime() - new Date(lotB?.inboundDate || 0).getTime();
            });

          for (const stock of mechStocks) {
            if (remainingToDeduct <= 0) break;
            const deductQty = Math.min(stock.stockQty, remainingToDeduct);
            const lot = stock.lotId ? db.consumableLots.find(l => l.id === stock.lotId) : undefined;
            const lotUnitPrice = lot?.unitPrice ?? fallbackUnitPrice;
            if (!primaryLotId && stock.lotId) primaryLotId = stock.lotId;

            db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', stock.id, {
              stockQty: stock.stockQty - deductQty,
              updatedAt: nowIso
            });

            // 소모품 출고 로그 기록 (대상 자산 ID 및 로트 ID 1:1 매핑)
            db.insertRow<ConsumableLog>('consumableLogs', {
              consumableId: part.consumableId,
              lotId: stock.lotId,
              type: 'OUTBOUND',
              quantity: deductQty,
              unitPrice: lotUnitPrice,
              targetAssetId: resolvedAssetId,
              userId: currentUser?.id,
              mechanicId: data.mechanicId,
              fromLocation: `${mechanicName} 차량`,
              toLocation: `현장AS (${ticket.siteName || ''} / ${resolvedAssetNo})`,
              actionDate: actionDateStr,
              description: `[현장AS 조치 소진] ${resolvedAssetNo} 수리 사용 (${ticket.ticketNo || ticket.id})`,
              createdAt: nowIso
            });

            partActualCost += lotUnitPrice * deductQty;
            remainingToDeduct -= deductQty;
          }

          const finalUnitPrice = part.quantity > 0 ? Math.round(partActualCost / part.quantity) : fallbackUnitPrice;
          totalPartsCost += partActualCost;

          // 정비-소모품 매핑 테이블(repairConsumables) 무누락 기록
          db.insertRow<RepairConsumable>('repairConsumables', {
            repairId: ticket.id,
            consumableId: part.consumableId,
            lotId: primaryLotId,
            quantity: part.quantity,
            unitPrice: finalUnitPrice,
            cost: partActualCost
          });
        }
      }

      // 1-3. 현장 수거 부품(고품)이 있는 경우 고품 관리 대장(collectedParts) 동기화
      if (data.collectedParts && data.collectedParts.length > 0) {
        const ymdCompact = actionDateStr.replace(/-/g, '');
        for (const cp of data.collectedParts) {
          if (!cp.partName || !cp.partName.trim()) continue;
          const matchedCons = db.consumables.find(
            c => c.modelName.trim().toLowerCase() === cp.partName.trim().toLowerCase()
          );
          const newPartNo = `COL-${ymdCompact}-${Math.floor(1000 + Math.random() * 9000)}`;
          db.insertRow<CollectedPart>('collectedParts', {
            id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            partNo: newPartNo,
            consumableId: matchedCons?.id || '',
            modelName: cp.partName.trim(),
            mechanicId: data.mechanicId,
            mechanicName,
            quantity: Math.max(1, cp.quantity || 1),
            disposition: cp.status === 'DISPOSED' ? 'SCRAP' : 'REBUILD',
            status: cp.status === 'DISPOSED' ? 'COMPLETED' : 'RECEIVED',
            receivedDate: actionDateStr,
            actionDate: cp.status === 'DISPOSED' ? actionDateStr : undefined,
            memo: `[현장AS 고품수거] ${ticket.siteName || ''} / 장비: ${resolvedAssetNo} (${ticket.ticketNo || ticket.id})`,
            createdAt: nowIso
          });
        }
      }

      // 2. 재방문 연계 티켓 생성 (선택된 경우)
      let revisitRepairId: string | undefined = undefined;
      let finalStatus: Repair['status'] = 'COMPLETED';

      if (data.resolutionType === 'REVISIT_NEEDED') {
        finalStatus = 'REVISIT';
        const now = new Date();
        const ymCompact = now.toISOString().split('T')[0].replace(/-/g, '').slice(2, 8);
        const todayPrefix = `AS-${ymCompact}`;
        let maxNum = 0;
        db.repairs.forEach(t => {
          if (t.ticketNo && t.ticketNo.startsWith(todayPrefix)) {
            const num = parseInt(t.ticketNo.replace(`${todayPrefix}-`, ''), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        });
        const nextTicketNo = `${todayPrefix}-${String(maxNum + 1).padStart(3, '0')}`;
        const chainedId = db.generateNextId('repairs', db.repairs);

        const chainedTicket = db.insertRow<Repair>('repairs', {
          id: chainedId,
          ticketNo: nextTicketNo,
          workCategory: 'FIELD_AS',
          workLocation: 'SITE',
          stockSource: 'VEHICLE_VAN',
          maintenanceType: 'EMERGENCY_AS',
          repairType: 'INTERNAL',
          source: 'DIRECT_INTAKE',
          customerId: ticket.customerId,
          customerName: ticket.customerName,
          siteId: ticket.siteId,
          siteName: ticket.siteName,
          siteAddress: ticket.siteAddress,
          contractId: ticket.contractId,
          assetId: resolvedAssetId,
          assetNo: resolvedAssetNo,
          modelName: resolvedModelName,
          locationDetail: ticket.locationDetail,
          reporterName: ticket.reporterName,
          reporterContact: ticket.reporterContact,
          issueCategory: ticket.issueCategory,
          issueDescription: `[재방문 사유] ${data.revisitReason || '후속 조치 필요'} (원 접수: ${ticket.issueDescription})`,
          details: `[재방문 사유] ${data.revisitReason || '후속 조치 필요'} (원 접수: ${ticket.issueDescription})`,
          errorCode: ticket.errorCode,
          priority: ticket.priority,
          status: 'SCHEDULED',
          requestDate: nowIso.split('T')[0],
          visitDate: data.revisitDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          scheduleDate: data.revisitDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          mechanicId: data.mechanicId,
          assignedMechanicId: data.mechanicId,
          mechanicName,
          billableType: data.billableType,
          billableAmount: 0,
          billableToCustomer: data.billableType === 'BILLABLE',
          parentRepairId: ticket.id,
          parentTicketId: ticket.id,
          memo: `이전 AS 티켓(${ticket.ticketNo || ticket.id}) 1차 점검 후 연계 생성됨`,
          createdAt: nowIso,
          updatedAt: nowIso
        });
        revisitRepairId = chainedTicket.id;
      } else if (data.resolutionType === 'GUIDED_END') {
        finalStatus = 'GUIDED';
      }

      // 3. 현재 티켓 완료/종결 업데이트 (대상 자산 매핑 및 투입 소모품 원가 totalCost 반영)
      const sanitizedBillableAmount = Math.max(0, Number(data.billableAmount) || 0);
      const prevTicketCost = ticket.totalCost || 0;
      db.updateRow<Repair>('repairs', ticketId, {
        status: finalStatus,
        assetId: resolvedAssetId,
        assetNo: resolvedAssetNo,
        modelName: resolvedModelName,
        visitDate: actionDateStr,
        repairDate: actionDateStr,
        mechanicId: data.mechanicId,
        assignedMechanicId: data.mechanicId,
        mechanicName,
        actionTaken: data.actionTaken,
        resolutionType: data.resolutionType,
        partsUsed: data.partsUsed || [],
        collectedParts: data.collectedParts || [],
        totalCost: totalPartsCost,
        billableType: data.billableType,
        billableAmount: sanitizedBillableAmount,
        billableToCustomer: data.billableType === 'BILLABLE',
        beforeImage: data.beforeImage || ticket.beforeImage,
        afterImage: data.afterImage || ticket.afterImage,
        customerSignature: data.customerSignature || ticket.customerSignature,
        customerConfirmName: data.customerConfirmName || ticket.customerConfirmName,
        revisitDate: data.revisitDate,
        revisitReason: data.revisitReason,
        revisitRepairId: revisitRepairId || ticket.revisitRepairId,
        revisitTicketId: revisitRepairId || ticket.revisitTicketId,
        exchangeSuggested: !!data.exchangeSuggested,
        inspectionItemId: data.inspectionItemId !== undefined ? data.inspectionItemId : ticket.inspectionItemId,
        inspectionItemCode: data.inspectionItemCode !== undefined ? data.inspectionItemCode : ticket.inspectionItemCode,
        degradationScore: data.degradationScore !== undefined ? data.degradationScore : ticket.degradationScore,
        durationMinutes: data.durationMinutes !== undefined ? data.durationMinutes : ticket.durationMinutes,
        spentManHours: data.spentManHours !== undefined ? data.spentManHours : ticket.spentManHours,
        completedDate: nowIso,
        updatedAt: nowIso
      });

      // 3-1. 대상 자산의 누적 수리비(cumRepairCost) 정밀 반영
      if (matchedAsset && (totalPartsCost > 0 || prevTicketCost > 0)) {
        const nextCumRepairCost = Math.max(0, (matchedAsset.cumRepairCost || 0) - prevTicketCost) + totalPartsCost;
        db.updateRow<Asset>('assets', matchedAsset.id, {
          cumRepairCost: nextCumRepairCost,
          updatedAt: nowIso
        });
      }

      // 🚐 현장AS 완료 시 일자별 동선 대장에 '작업 완료(WORK_COMPLETE)' 자동 기록
      try {
        await recordAsRouteStep({
          eventType: 'WORK_COMPLETE',
          mechanicId: data.mechanicId || currentUser?.id || ticket.mechanicId || 'u-mechanic',
          mechanicName,
          ticket: db.repairs.find(r => r.id === ticketId) || ticket,
          memo: data.actionTaken || undefined,
        });
      } catch (routeErr) {
        console.warn('Auto WORK_COMPLETE route log skipped:', routeErr);
      }

      // 🟢 선행 AS 출동 ToDo 원자적 자동 상계
      await clearHandoverTasks({
        entityType: 'REPAIR',
        entityId: ticketId,
        category: 'AS_DISPATCH_REPAIR',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name,
        completionAction: `AS_${finalStatus}`
      });

      // 🚀 고객 과실 유상 수리 시 청구팀에 바인딩 ToDo 발행 (매출 누락 방지)
      if (sanitizedBillableAmount > 0) {
        await issueHandoverTask({
          category: 'BILLABLE_REPAIR_BILLING',
          title: `[유상AS 청구 반영] ${ticket.customerName || '고객사'} (₩${sanitizedBillableAmount.toLocaleString()}원)`,
          content: `고객 과실 유상 수리비 ₩${sanitizedBillableAmount.toLocaleString()}원 청구서 바인딩 요망 (${ticket.siteName || '현장'}, ${data.actionTaken || '수리'})`,
          targetDept: 'ACCOUNTING',
          priority: 'HIGH',
          actionUrl: '/admin/billing',
          entityType: 'REPAIR',
          entityId: ticketId,
          senderId: currentUser?.id,
          senderName: currentUser?.name
        });
      }

      // 🌟 [헌장 2.3 준수] 현장 수리 불능 대차 제안 시 단일 'EXCHANGE' 왕복 배차 의뢰 1건 자동 발행
      if (data.exchangeSuggested) {
        const defaultYard = currentTenant?.yards?.find((y: any) => y.isDefault) || currentTenant?.yards?.[0];
        const originYardAddress = defaultYard ? `${defaultYard.name} (${defaultYard.address || ''})` : (currentTenant?.mainYardAddress || '본사 주기장');

        const deliveryId = db.generateNextId('deliveries', db.deliveries);
        db.insertRow<Delivery>('deliveries', {
          id: deliveryId,
          contractId: ticket.contractId,
          type: 'EXCHANGE',
          dispatchCategory: '교환',
          status: 'PENDING',
          requestDate: nowIso.split('T')[0],
          originAddress: originYardAddress,
          pickupType: 'HQ_YARD',
          destinationAddress: ticket.locationDetail || ticket.siteName || '현장',
          dropoffType: 'CUSTOMER_SITE',
          deliveryCost: 0,
          memo: appendDispatchStaffTag(`[현장AS 대차 요청] 회수대상 자산: ${resolvedAssetNo || '현장고장장비'} / 현장: ${ticket.siteName || ''} (${ticket.customerName || ''}) / 사유: ${data.actionTaken || '현장 수리불능 대차'}`),
          createdAt: nowIso,
          updatedAt: nowIso
        });

        // 🚀 대차 배차 지시 ToDo 발행
        await issueHandoverTask({
          category: 'DISPATCH_REQUEST',
          title: `[대차 교환 배차] ${ticket.customerName || '고객사'} (${resolvedAssetNo || '장비'})`,
          content: `현장 수리불능 대차 요청. 신규 장비 출고 및 고장 장비 회수 왕복 1건 배차 처리. (현장: ${ticket.siteName || '-'})`,
          targetDept: 'DISPATCH',
          priority: 'URGENT',
          actionUrl: '/admin/dispatch',
          entityType: 'DELIVERY',
          entityId: deliveryId,
          senderId: currentUser?.id,
          senderName: currentUser?.name
        });
      }

      // 4. 자산 이력(assetInOutLogs)에 정비 사건 및 사용 소모품 내역 무누락 DB 저장 (repairId 1:1 매핑으로 중복 방지)
      if (matchedAsset || (resolvedAssetNo && resolvedAssetNo !== '현장확인' && resolvedAssetNo !== '전체장비')) {
        const partsSummaryText =
          data.partsUsed && data.partsUsed.length > 0
            ? ` / 사용소모품: ${data.partsUsed.map(p => `${p.modelName} ${p.quantity}개`).join(', ')}${totalPartsCost > 0 ? ` (₩${totalPartsCost.toLocaleString()})` : ''}`
            : '';
        const statusLabel =
          finalStatus === 'COMPLETED' ? '조치완료' : finalStatus === 'REVISIT' ? '1차조치/재방문' : '안내종결';
        const logMemo = `[현장AS ${statusLabel}] ${ticket.ticketNo || ''} ${ticket.issueDescription || '현장점검'} ➔ ${data.actionTaken}${partsSummaryText} (정비사: ${mechanicName})`;

        const existingAssetLog = (db.assetInOutLogs || []).find(l => l.repairId === ticket.id);
        if (existingAssetLog) {
          db.updateRow<AssetInOutLog>('assetInOutLogs', existingAssetLog.id, {
            assetId: matchedAsset?.id || resolvedAssetId || `asset-${resolvedAssetNo}`,
            assetNo: resolvedAssetNo,
            modelName: resolvedModelName,
            eventDate: actionDateStr,
            customerId: ticket.customerId,
            customerName: ticket.customerName,
            siteId: ticket.siteId,
            siteName: ticket.siteName,
            maintenanceScore: data.degradationScore ?? ticket.degradationScore ?? 0,
            memo: logMemo,
          });
        } else {
          db.insertRow<AssetInOutLog>('assetInOutLogs', {
            assetId: matchedAsset?.id || resolvedAssetId || `asset-${resolvedAssetNo}`,
            assetNo: resolvedAssetNo,
            modelName: resolvedModelName,
            type: 'REPAIR',
            eventDate: actionDateStr,
            customerId: ticket.customerId,
            customerName: ticket.customerName,
            siteId: ticket.siteId,
            siteName: ticket.siteName,
            repairId: ticket.id,
            maintenanceScore: data.degradationScore ?? ticket.degradationScore ?? 0,
            memo: logMemo,
            createdAt: nowIso
          });
        }
      }

      // 5. 계약 이력에 AS 발생 및 조치 사건 무누락 DB 저장 (양방향 완벽 추적성)
      if (ticket.contractId) {
        const partsSummaryShort =
          data.partsUsed && data.partsUsed.length > 0
            ? `, 사용부품: ${data.partsUsed.map(p => `${p.modelName}×${p.quantity}`).join(', ')}`
            : '';
        db.insertRow<ContractHistory>('contract_history', {
          id: `ch-as-${ticket.id}-${Date.now()}`,
          contractId: ticket.contractId,
          changeType: 'AS_SERVICE',
          changeDate: actionDateStr,
          description: `[현장 AS ${finalStatus === 'COMPLETED' ? '완료' : '조치'}] ${data.actionTaken} (${resolvedAssetNo || '현장장비'}, 정비사: ${mechanicName}${partsSummaryShort}${data.billableAmount && data.billableAmount > 0 ? `, 유상수리비 ₩${data.billableAmount.toLocaleString()}` : ''})`,
          createdAt: nowIso
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();

      // 📢 대차 제안 시 배차/출고팀에 대차교체 알림 브로드캐스트
      if (data.exchangeSuggested) {
        broadcastWorkNotification({
          type: 'EXCHANGE',
          title: '대차 교체 의뢰 등록',
          body: `${ticket.customerName || '고객사'} (${ticket.siteName || '현장'}) ${resolvedAssetNo || '장비'} 현장수리불능 대차요청`,
          url: '/admin/dispatch',
          targetDepts: ['DISPATCH', 'YARD', 'ADMIN', 'EXECUTIVE']
        }).catch(console.warn);
      }
    } catch (err: any) {
      showErrorModal(err?.message || String(err));
      throw err;
    }
  };

  const createRevisitAsTicket = async (parentRepairId: string, revisitDate: string, revisitReason: string, mechanicId?: string): Promise<Repair> => {
    try {
      const parent = db.repairs.find(t => t.id === parentRepairId);
      if (!parent) throw new Error('이전 AS 티켓을 찾을 수 없습니다.');

      const now = new Date();
      const ymCompact = now.toISOString().split('T')[0].replace(/-/g, '').slice(2, 8);
      const todayPrefix = `AS-${ymCompact}`;
      let maxNum = 0;
      db.repairs.forEach(t => {
        if (t.ticketNo && t.ticketNo.startsWith(todayPrefix)) {
          const num = parseInt(t.ticketNo.replace(`${todayPrefix}-`, ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const nextTicketNo = `${todayPrefix}-${String(maxNum + 1).padStart(3, '0')}`;
      const newId = db.generateNextId('repairs', db.repairs);

      const effectiveMechId = mechanicId || parent.mechanicId || parent.assignedMechanicId;
      const mech = db.users.find(u => u.id === effectiveMechId);

      const newTicket = db.insertRow<Repair>('repairs', {
        id: newId,
        ticketNo: nextTicketNo,
        workCategory: 'FIELD_AS',
        workLocation: 'SITE',
        stockSource: 'VEHICLE_VAN',
        maintenanceType: 'EMERGENCY_AS',
        repairType: 'INTERNAL',
        source: 'DIRECT_INTAKE',
        customerId: parent.customerId,
        customerName: parent.customerName,
        siteId: parent.siteId,
        siteName: parent.siteName,
        assetId: parent.assetId,
        assetNo: parent.assetNo,
        locationDetail: parent.locationDetail,
        reporterName: parent.reporterName,
        reporterContact: parent.reporterContact,
        issueCategory: parent.issueCategory,
        issueDescription: `[재방문] ${revisitReason} (원 접수: ${parent.issueDescription || parent.details})`,
        details: `[재방문] ${revisitReason} (원 접수: ${parent.issueDescription || parent.details})`,
        errorCode: parent.errorCode,
        priority: parent.priority,
        status: 'SCHEDULED',
        requestDate: now.toISOString().split('T')[0],
        visitDate: revisitDate,
        scheduleDate: revisitDate,
        mechanicId: effectiveMechId,
        assignedMechanicId: effectiveMechId,
        mechanicName: mech?.name || parent.mechanicName,
        billableType: parent.billableType,
        billableAmount: 0,
        billableToCustomer: parent.billableToCustomer,
        parentRepairId: parent.id,
        parentTicketId: parent.id,
        memo: `티켓 ${parent.ticketNo || parent.id}에서 재방문 연계 생성`,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });

      db.updateRow<Repair>('repairs', parentRepairId, {
        revisitRepairId: newTicket.id,
        revisitTicketId: newTicket.id,
        updatedAt: now.toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
      return newTicket;
    } catch (err: any) {
      showErrorModal(`⚠️ 재방문 티켓 생성 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const importBandAsHistory = async (records: any[]): Promise<number> => {
    try {
      let importedCount = 0;
      const existingList = db.repairs;
      const existingRawSet = new Set(existingList.map(t => `${t.siteName}_${t.assetNo}_${t.requestDate}_${(t.issueDescription || t.details || '').slice(0, 20)}`));

      const newRepairs: Repair[] = [];
      const newAssetLogs: AssetInOutLog[] = [];

      records.forEach((r, idx) => {
        const site = r.site || '미지정현장';
        const asset = r.asset_no || '현장확인';
        const reqDate = r.date || '2026-08-01';
        const issue = r.issue || (r.raw ? r.raw.slice(0, 100) : '점검 요청');
        const dedupeKey = `${site}_${asset}_${reqDate}_${issue.slice(0, 20)}`;

        if (existingRawSet.has(dedupeKey)) return;

        existingRawSet.add(dedupeKey);
        importedCount++;

        const ticketNo = `BAND-${String(5518 - idx).padStart(4, '0')}`;
        const rawText = r.raw || '';
        const isRevisit = rawText.includes('내일방문') || rawText.includes('재방문') || rawText.includes('방문예정');
        const isGuided = rawText.includes('설명처리') || rawText.includes('이상없음') || rawText.includes('문제없음');
        const isCompleted = rawText.includes('완료') || rawText.includes('교체') || rawText.includes('수리') || rawText.includes('보수');

        let status: Repair['status'] = 'COMPLETED';
        let resolutionType: Repair['resolutionType'] = 'REPAIR_DONE';
        if (isRevisit) {
          status = 'REVISIT';
          resolutionType = 'REVISIT_NEEDED';
        } else if (isGuided) {
          status = 'GUIDED';
          resolutionType = 'GUIDED_END';
        } else if (isCompleted) {
          status = 'COMPLETED';
          resolutionType = 'REPAIR_DONE';
        }

        let category = '기타';
        if (issue.includes('방지봉') || issue.includes('협착')) category = '방지봉/협착';
        else if (issue.includes('상승') || issue.includes('하강')) category = '상하강불량';
        else if (issue.includes('충전') || issue.includes('배터리')) category = '충전/전원';
        else if (issue.includes('오일') || issue.includes('누유')) category = '오일누유';
        else if (issue.includes('키박스') || issue.includes('키스위치')) category = '키박스/스위치';
        else if (issue.includes('파이프')) category = '파이프걸림';
        else if (issue.includes('점검')) category = '점검요청';

        // 💡 4-A 원칙: 밴드 작성자 ➔ 시스템 users 이름 1:1 자동 매칭
        const authorName = (r.author || '').trim();
        const matchedUser = db.users.find(u => u.name && authorName && (u.name.trim() === authorName || authorName.includes(u.name.trim())));
        const mechanicId = matchedUser?.id || '';
        const mechanicName = matchedUser?.name || authorName || '정비기사';

        // 💡 고객사 및 현장 매칭
        const contractorName = (r.contractor || '').trim();
        let matchedCustomer = db.customers.find(c => 
          c.name && contractorName && (
            c.name.trim() === contractorName || 
            contractorName.includes(c.name.trim()) || 
            c.name.trim().includes(contractorName)
          )
        );
        let matchedSite = db.customerSites.find(s => 
          s.name && site && (
            s.name.trim() === site.trim() || 
            site.includes(s.name.trim()) || 
            s.name.trim().includes(site)
          )
        );

        // 계약 조회 (고객/현장 기준)
        let matchedContract = db.contracts.find(c => 
          (matchedCustomer && c.customerId === matchedCustomer.id) || 
          (matchedSite && c.siteId === matchedSite.id)
        );

        // 💡 5대 매트릭스 & 사장님 확정 원칙 1: 관리번호 미기재 시 1대 단독 계약이면 해당 자산으로 자동 추정 매핑
        let finalAssetNo = asset;
        let matchedAsset = db.assets.find(a => a.assetNo && asset && a.assetNo.trim().toUpperCase() === asset.trim().toUpperCase());
        if (!matchedAsset && asset && asset !== '현장확인') {
          const cleanNo = asset.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          matchedAsset = db.assets.find(a => a.assetNo && a.assetNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanNo);
        }
        let assetId = matchedAsset?.id || '';

        const currentContract = matchedContract;
        if ((!finalAssetNo || finalAssetNo === '현장확인' || finalAssetNo === '전체장비') && currentContract) {
          const contractAssetsForContract = db.contractAssets.filter(ca => ca.contractId === currentContract.id && ca.status !== 'RETURNED');
          if (contractAssetsForContract.length === 1 && contractAssetsForContract[0].assetId) {
            const singleAsset = db.assets.find(a => a.id === contractAssetsForContract[0].assetId);
            if (singleAsset) {
              assetId = singleAsset.id;
              finalAssetNo = singleAsset.assetNo;
              matchedAsset = singleAsset;
            }
          }
        } else if (matchedAsset && !matchedContract) {
          const currentAsset = matchedAsset;
          const activeCa = db.contractAssets.find(ca => ca.assetId === currentAsset.id && ca.status !== 'RETURNED');
          if (activeCa) {
            matchedContract = db.contracts.find(c => c.id === activeCa.contractId);
          }
        }

        // 🌟 자산 마스터 기준 현장 및 고객사 역추적
        if (matchedAsset) {
          if ((!matchedSite || !site || site === '미지정현장' || site === '일반 현장') && matchedAsset.currentSiteId) {
            const foundSite = db.customerSites.find(s => s.id === matchedAsset.currentSiteId);
            if (foundSite) {
              matchedSite = foundSite;
            }
          }
          if ((!matchedCustomer || !r.contractor || r.contractor === '현장 협력업체' || r.contractor === '협력업체') && matchedAsset.currentCustomerId) {
            const foundCust = db.customers.find(c => c.id === matchedAsset.currentCustomerId);
            if (foundCust) {
              matchedCustomer = foundCust;
            }
          }
          if (matchedContract) {
            if (!matchedSite && matchedContract.siteId) {
              matchedSite = db.customerSites.find(s => s.id === matchedContract.siteId);
            }
            if (!matchedCustomer && matchedContract.customerId) {
              matchedCustomer = db.customers.find(c => c.id === matchedContract.customerId);
            }
          }
        }

        const actionText = r.action || (isCompleted ? '현장 정비 및 조치 완료' : (isRevisit ? '익일 재방문 접수' : '설명 및 안내 종결'));

        const repairRow: Repair = {
          id: `rep-band-${idx + 1}`,
          ticketNo,
          workCategory: 'FIELD_AS',
          workLocation: 'SITE',
          stockSource: 'VEHICLE_VAN',
          maintenanceType: 'EMERGENCY_AS',
          repairType: 'INTERNAL',
          source: 'BAND_IMPORT',
          contractId: matchedContract?.id || undefined,
          customerId: matchedCustomer?.id || '',
          customerName: matchedCustomer?.name || r.contractor || '현장 협력업체',
          siteId: matchedSite?.id || '',
          siteName: matchedSite?.name || site,
          assetId: assetId || undefined,
          assetNo: finalAssetNo || '현장확인',
          modelName: matchedAsset?.modelName || '고소작업대',
          locationDetail: r.location || '',
          reporterContact: r.contact || '',
          issueCategory: category,
          issueDescription: issue,
          details: issue,
          status,
          resolutionType,
          priority: 'NORMAL',
          requestDate: reqDate,
          visitDate: reqDate,
          scheduleDate: reqDate,
          completedDate: status === 'COMPLETED' ? reqDate : undefined,
          mechanicId,
          assignedMechanicId: mechanicId,
          mechanicName,
          actionTaken: actionText,
          billableType: 'FREE',
          billableAmount: 0,
          billableToCustomer: false,
          memo: `[밴드 과거이력 자동 임포트]\n작성자: ${authorName || '기사'}\n원문: ${rawText.slice(0, 150)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        newRepairs.push(repairRow);

        // 💡 자산 생애주기 이력 로그 동시 기록 (관리번호가 식별되는 장비)
        if (finalAssetNo && finalAssetNo !== '현장확인' && finalAssetNo !== '전체장비') {
          newAssetLogs.push({
            id: `aiog-band-${idx + 1}`,
            assetId: assetId || `asset-${finalAssetNo}`,
            assetNo: finalAssetNo,
            modelName: matchedAsset?.modelName || '고소작업대',
            type: 'REPAIR',
            eventDate: reqDate,
            customerName: repairRow.customerName,
            siteName: repairRow.siteName,
            repairId: repairRow.id,
            memo: `[현장AS] ${issue} ➔ ${actionText} (정비자: ${mechanicName})`,
            createdAt: new Date().toISOString()
          });
        }
      });

      if (newRepairs.length > 0) {
        db.repairs = [...newRepairs, ...db.repairs];
        if (newAssetLogs.length > 0) {
          db.assetInOutLogs = [...newAssetLogs, ...db.assetInOutLogs];
        }
        await db.awaitPendingWrites();
        refreshAllData();
      }

      return importedCount;
    } catch (err: any) {
      showErrorModal(`⚠️ 밴드 데이터 가져오기 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const getValidUserId = (id?: string): string => {
    if (id && !['system', 'sys-admin', 'usr-admin', 'sys-anon', 'admin'].includes(id)) {
      const exists = db.users.some(u => u.id === id && !['sys-admin', 'usr-admin'].includes(u.id));
      if (exists) return id;
    }
    return db.users.find(u => u.id === 'u-1')?.id || db.users.find(u => !['sys-admin', 'usr-admin'].includes(u.id))?.id || 'u-1';
  };

  const requestConsumablePurchase = async (data: { consumableId?: string; modelName: string; qty: number; unitPrice: number; requestDate: string; sellerName: string; purchaseUrl?: string; requestAttachmentUrl?: string; vendorId?: string; paymentMethod?: 'CARD' | 'CREDIT'; }) => {
    const validUserId = getValidUserId(currentUser?.id);
    let finalConsumableId = data.consumableId;

    if (!finalConsumableId) {
      const existing = db.consumables.find(c => c.modelName.toLowerCase() === data.modelName.toLowerCase());
      if (existing) {
        finalConsumableId = existing.id;
      } else {
        const newC = db.insertRow<any>('consumables', {
          category: '기타',
          modelName: data.modelName,
          unitPrice: data.unitPrice,
          stockQty: 0,
          supplier: data.sellerName,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        finalConsumableId = newC.id;
      }
    }

    const newReq = db.insertRow<ConsumablePurchaseRequest>('consumablePurchases', {
      consumableId: finalConsumableId,
      modelName: data.modelName,
      requestedQty: data.qty,
      unitPrice: data.unitPrice,
      requestDate: data.requestDate,
      sellerName: data.sellerName,
      purchaseUrl: data.purchaseUrl,
      vendorId: data.vendorId,
      paymentMethod: data.paymentMethod,
      status: 'REQUESTED',
      requesterId: validUserId,
      requesterName: currentUser?.name || '시스템',
      receivedQty: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 🚀 [단일 업무 인계 파이프라인] 관리자/부서장에게 구매 결재 ToDo 발행
    await issueHandoverTask({
      category: 'CONSUMABLE_PURCHASE_APPROVAL',
      title: `[소모품 구매 승인] ${data.modelName} (${data.qty}EA)`,
      content: `구매 요청: ${data.modelName} ${data.qty}개 (단가: ₩${data.unitPrice.toLocaleString()}원, 공급처: ${data.sellerName})`,
      targetRole: 'MANAGER',
      priority: data.unitPrice * data.qty >= 1000000 ? 'HIGH' : 'NORMAL',
      actionUrl: '/admin/consumable',
      entityType: 'CONSUMABLE',
      entityId: newReq.id,
      senderId: currentUser?.id,
      senderName: currentUser?.name
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  const updatePurchaseUnitPrice = async (id: string, newUnitPrice: number) => {
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      unitPrice: newUnitPrice,
      updatedAt: new Date().toISOString()
    });
    await db.awaitPendingWrites(); refreshAllData(); };

  const acceptConsumablePurchase = async (id: string) => {
    const validUserId = getValidUserId(currentUser?.id);
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      status: 'ACCEPTED',
      acceptedDate: new Date().toISOString().split('T')[0],
      accepterId: validUserId,
      accepterName: currentUser?.name || '시스템',
      updatedAt: new Date().toISOString()
    });

    // 🟢 구매 결재 ToDo 자동 상계
    await clearHandoverTasks({
      entityType: 'CONSUMABLE',
      entityId: id,
      category: 'CONSUMABLE_PURCHASE_APPROVAL',
      completedByUserId: currentUser?.id,
      completedByName: currentUser?.name,
      completionAction: 'PURCHASE_ACCEPTED'
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  const completeConsumablePurchase = async (id: string) => {
    const req = db.consumablePurchases.find(p => p.id === id);
    if (!req) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const settlementYm = req.requestDate ? req.requestDate.substring(0, 7) : todayStr.substring(0, 7);
    const effectiveQty = (req.receivedQty && req.receivedQty > 0) ? req.receivedQty : req.requestedQty;
    const totalAmount = effectiveQty * (req.unitPrice || 0);

    // 1. 월말 매입 정산 마스터 레코드 생성
    const settlementId = db.generateNextId('purchaseSettlements', db.purchaseSettlements);
    const settlement = db.insertRow<PurchaseSettlement>('purchaseSettlements', {
      id: settlementId,
      settlementYm,
      settlementType: 'CONSUMABLE',
      vendorName: req.sellerName || '소모품 공급처',
      totalAmount,
      paidAmount: 0,
      status: 'CONFIRMED',
      confirmedAt: nowIso,
      confirmedBy: currentUser?.name || req.requesterName || '구매신청자',
      itemCount: 1,
      memo: `[소모품 구매완결] ${req.modelName} ${effectiveQty}개 (신청자: ${req.requesterName || currentUser?.name || '담당자'})`,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // 2. 월말 매입 정산 1:1 상세 항목 생성
    const settlementItemId = db.generateNextId('purchaseSettlementItems', db.purchaseSettlementItems);
    db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
      id: settlementItemId,
      settlementId: settlement.id,
      sourceType: 'CONSUMABLE_PURCHASE',
      sourceId: req.id,
      itemDescription: `${req.modelName} × ${effectiveQty}개 (${req.requestDate || todayStr})`,
      quantity: effectiveQty,
      unitPrice: req.unitPrice || 0,
      amount: totalAmount,
      evidenceFileUrl: req.statementFileUrl || undefined,
      createdAt: nowIso
    });

    // 3. 소모품 구매신청 완결 상태 및 연계 정산 ID 업데이트
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      status: 'COMPLETED',
      completedDate: todayStr,
      completerName: currentUser?.name || '구매신청자',
      settlementId: settlement.id,
      updatedAt: nowIso
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  const inboundConsumablePurchase = async (id: string, qty: number, statementFileUrl: string) => {
    const req = db.consumablePurchases.find(p => p.id === id);
    if (!req) return;

    const nextReceivedQty = req.receivedQty + qty;

    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      receivedQty: nextReceivedQty,
      statementFileUrl,
      inbounderName: currentUser?.name || '시스템',
      updatedAt: new Date().toISOString()
    });

    let consumable = req.consumableId ? db.consumables.find(c => c.id === req.consumableId) : null;
    if (!consumable) {
      consumable = db.consumables.find(c => c.modelName.replace(/\s/g, '') === req.modelName.replace(/\s/g, '')) || null;
    }

    if (consumable) {
      db.updateRow<Consumable>('consumables', consumable.id, {
        stockQty: consumable.stockQty + qty,
        // Master retains the latest unitPrice and supplier conceptually, though lots track their own
        unitPrice: req.unitPrice,
        supplier: req.sellerName,
        updatedAt: new Date().toISOString()
      });
    } else {
      consumable = db.insertRow<Consumable>('consumables', {
        modelName: req.modelName,
        stockQty: qty,
        unit: '개',
        unitPrice: req.unitPrice,
        supplier: req.sellerName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      // ⚠️ FK(Foreign Key) 위반 방지: consumables 마스터 생성이 원격 DB에 먼저 반영되도록 1차 동기 대기
      try {
        await db.awaitPendingWrites();
      } catch (e: any) {
        showErrorModal(e?.message || String(e), '소모품 마스터 생성 오류');
        throw e;
      }
      db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
        consumableId: consumable.id
      });
    }

    // 🌟 Create a new Lot for this inbound batch
    const newLotId = `lot-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const todayStr = new Date().toISOString().split('T')[0];
    db.insertRow<ConsumableLot>('consumableLots', {
      id: newLotId,
      consumableId: consumable.id,
      inboundDate: todayStr,
      unitPrice: req.unitPrice,
      initialQty: qty,
      currentQty: qty,
      purchaseRequestId: req.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    db.insertRow<ConsumableLog>('consumableLogs', {
      consumableId: consumable.id,
      lotId: newLotId,
      type: 'INBOUND',
      quantity: qty,
      unitPrice: req.unitPrice,
      supplier: req.sellerName,
      userId: getValidUserId(currentUser?.id),
      actionDate: todayStr,
      description: `구매신청 연계 입고 (증빙: ${statementFileUrl.split('/').pop()})`,
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  // 증빙 파일 Storage 삭제 후 DB URL 초기화
  const clearEvidenceFileUrls = async (ids: string[]): Promise<void> => {
    for (const id of ids) {
      db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, { statementFileUrl: '' });
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  // Storage 삭제 후 Drive URL로 교체
  const updateEvidenceFileUrls = async (updates: { id: string; url: string }[]): Promise<void> => {
    for (const { id, url } of updates) {
      db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, { statementFileUrl: url });
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  const ensureCustomerContactExists = (customerId: string, contactId: string | undefined) => {
    if (contactId && contactId.startsWith('SC-')) {
      const existing = db.customerContacts.find(c => c.id === contactId);
      if (!existing) {
        let siteContact;
        for (const s of db.sites) {
          if (s.contacts) {
            siteContact = s.contacts.find(c => c.id === contactId);
            if (siteContact) break;
          }
        }
        if (siteContact) {
          db.insertRow<any>('customer_contacts', {
            id: siteContact.id,
            customerId: customerId,
            name: siteContact.name,
            contact: siteContact.contact,
            email: siteContact.email,
            position: siteContact.contactType,
            isPrimary: false,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
  };
  const createContract = async (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => {
    const customer = db.customers.find(c => c.id === contractData.customerId);
    if (customer && customer.transactionStatus === 'BLOCKED') {
      showErrorModal('⚠️ 해당 고객사는 [거래불가] 상태로 설정되어 있어 신규 계약 등록이 불가능합니다.', '계약 등록 제한');
      throw new Error('거래 불가 고객사입니다.');
    }

    const contractNo = generateNextContractNo(contractData.startDate);
    ensureCustomerContactExists(contractData.customerId, contractData.contactId);
    
    // ⚠️ 외래키 제약조건 위반 방지: 선행 sites/contacts/customer 레코드가 Supabase 원격 DB에 먼저 100% 저장되도록 동기 대기!
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.warn('Pending writes sync before createContract:', err);
    }

    const contract = db.insertRow<Contract>('contracts', {
      ...contractData,
      contractNo,
      billingDay: contractData.billingDay || customer?.defaultBillingDay || 30,
      paymentDueDay: contractData.paymentDueDay || customer?.paymentDueDay || 25,
      salespersonId: contractData.salespersonId || currentUser?.id,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // ⚠️ 외래키 제약조건 위반 방지: contract가 Supabase 원격 DB에 먼저 100% 생성되도록 1차 동기 대기!
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('Supabase contract insert sync error in saveContract:', err);
    }

    const nowIso = new Date().toISOString();
    const createdCargoMap = new Map<string, { modelName: string; count: number; contractAssetIds: string[]; monthlyRentalFee: number; dailyRentalFee: number }>();
    const createdInspIdsForDelivery: string[] = [];

    assetsList.forEach(item => {
      const resolvedModel = item.expectedModel || (item.assetId ? db.assets.find(a => a.id === item.assetId)?.modelName : undefined) || '미지정';
      const insertedCA = db.insertRow<ContractAsset>('contractAssets', {
        contractId: contract.id,
        assetId: item.assetId || undefined,
        status: 'ASSIGNED',
        expectedModel: resolvedModel,
        monthlyRentalFee: item.monthlyRentalFee,
        dailyRentalFee: item.dailyRentalFee,
        startDate: contractData.startDate,
        firstStartDate: contractData.startDate,
        endDate: contractData.endDate,
        createdAt: nowIso
      });

      if (insertedCA?.id) {
        const grp = createdCargoMap.get(resolvedModel) || {
          modelName: resolvedModel,
          count: 0,
          contractAssetIds: [],
          monthlyRentalFee: Number(item.monthlyRentalFee) || 0,
          dailyRentalFee: Number(item.dailyRentalFee) || 0
        };
        grp.count += 1;
        grp.contractAssetIds.push(insertedCA.id);
        createdCargoMap.set(resolvedModel, grp);
      }

      if (item.assetId) {
        db.updateRow<Asset>('assets', item.assetId, {
          // 💡 헌장 1.3 준수: 계약 체결 시점에는 대여중로 변경하지 않고 ASSIGNED(출고대기) 유지, 출고 검수 승인 마감 시점에 RENTED로 전이됨!
          status: 'ASSIGNED',
          currentCustomerId: contractData.customerId,
          currentSiteId: contractData.siteId,
          contractStart: contractData.startDate,
          contractEnd: contractData.endDate,
          monthlyRentalFee: item.monthlyRentalFee,
          dailyRentalFee: item.dailyRentalFee,
          updatedAt: nowIso
        });
        // ✅ 고아 레코드 방지: assetId가 있는 슬롯 생성 시 출고검수 의뢰 자동 연동 생성
        const createdInsp = db.insertRow<OutboundInspection>('outboundInspections', {
          contractId: contract.id,
          contractAssetId: insertedCA.id,
          assetId: item.assetId,
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso
        });
        if (createdInsp?.id) createdInspIdsForDelivery.push(createdInsp.id);
      }
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId: contract.id,
      changeType: 'REGISTER',
      changeDate: new Date().toISOString().split('T')[0],
      newEndDate: contractData.endDate,
      description: '계약 신규 등록',
      createdAt: new Date().toISOString()
    });

    const today = new Date().toISOString().split('T')[0];
    const targetStart = contractData.startDate || today;
    const targetSite = contractData.siteId ? db.sites.find(s => s.id === contractData.siteId) : undefined;
    const createdDelivery = db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
      destinationAddress: targetSite?.address || customer?.address || undefined,
      cargoItems: createdCargoMap.size > 0 ? JSON.stringify(Array.from(createdCargoMap.values())) : undefined,
      type: 'OUTBOUND',
      dispatchCategory: '출고',
      status: 'REQUESTED',
      requestDate: today,
      loadingDate: targetStart,
      loadingTimeSlot: '오전',
      unloadingDate: targetStart,
      unloadingTimeSlot: '오전',
      deliveryCost: 0,
      isCostSettled: false,
      memo: appendDispatchStaffTag('신규 계약 체결에 따른 출고 의뢰'),
      closingMemo: '출고 파이프라인 자동 지시건',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (createdDelivery?.id && createdInspIdsForDelivery.length > 0) {
      createdInspIdsForDelivery.forEach(inspId => {
        db.updateRow<OutboundInspection>('outboundInspections', inspId, { deliveryId: createdDelivery.id });
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
    return contract;
  };

  const getPendingCustomerOrContractBlockReason = (contractId?: string, customerId?: string): string | null => {
    const targetContract = contractId ? db.contracts.find(c => c.id === contractId) : undefined;
    const resolvedCustomerId = customerId || targetContract?.customerId;
    const targetCustomer = resolvedCustomerId ? db.customers.find(c => c.id === resolvedCustomerId) : undefined;
    const pendingRequests = ((db as any).approvalRequests || []).filter((r: any) => r.status === 'PENDING');

    if (targetCustomer) {
      const hasCustomerPendingReq = pendingRequests.some((r: any) =>
        (r.target_record_id === targetCustomer.id || r.targetRecordId === targetCustomer.id) &&
        (r.payload?.eventCode === 'CUSTOMER_REGISTRATION' || r.target_table === 'customers' || r.targetTable === 'customers')
      );
      if (hasCustomerPendingReq || targetCustomer.transactionStatus === 'BLOCKED_ALL') {
        return `고객사(${targetCustomer.name})의 [고객 등록] 결재가 아직 승인되지 않았거나 거래차단 상태이므로 배차·장비할당·출고 업무를 진행할 수 없습니다.`;
      }
    }

    if (targetContract) {
      const hasContractSignPendingReq = targetContract.approvalStatus === 'PENDING' || pendingRequests.some((r: any) =>
        (r.target_record_id === targetContract.id || r.targetRecordId === targetContract.id) &&
        r.payload?.eventCode === 'CONTRACT_SIGN'
      );
      if (hasContractSignPendingReq) {
        return `해당 계약(${targetContract.contractNo || targetContract.id})의 [계약 체결] 결재가 아직 승인 대기 중이므로 배차·장비할당·출고 업무를 진행할 수 없습니다.`;
      }
    }

    return null;
  };

  const rescindContract = async (params: {
    contractId: string;
    reason: string;
    freightOption: 'NONE' | 'CUSTOMER' | 'OURS';
    customerFreightAmount?: number;
  }) => {
    const { contractId, reason, freightOption, customerFreightAmount = 0 } = params;
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) {
      showErrorModal('해제 대상 계약을 찾을 수 없습니다.');
      throw new Error('해제 대상 계약을 찾을 수 없습니다.');
    }
    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];
    const effectiveRescindDate = contract.startDate || today;

    // 1. 계약 본체 상태 COMPLETED(해제 종결) 및 무효화 업데이트
    db.updateRow<Contract>('contracts', contractId, {
      status: 'COMPLETED',
      endDate: effectiveRescindDate,
      approvalStatus: 'APPROVED',
      updatedAt: nowIso
    });

    // 2. 연결된 체결 자산 일괄 원상복구 (렌탈료 0원 소급 무효화 + 실물 자산 즉시 임대가능 AVAILABLE 전환)
    const linkedContractAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    linkedContractAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, {
        status: 'RETURNED',
        monthlyRentalFee: 0,
        dailyRentalFee: 0,
        endDate: effectiveRescindDate,
        actualReturnDate: effectiveRescindDate,
        updatedAt: nowIso
      });
      if (ca.assetId) {
        db.updateRow<Asset>('assets', ca.assetId, {
          status: 'AVAILABLE',
          currentCustomerId: '',
          currentSiteId: '',
          contractStart: '',
          contractEnd: '',
          updatedAt: nowIso
        });
      }
    });

    // 3. 미완료 출고검수 레코드 삭제
    db.outboundInspections
      .filter(ins => ins.contractId === contractId && ins.status !== 'COMPLETED')
      .forEach(ins => db.deleteRow('outboundInspections', ins.id));

    // 4. 연결된 배차/출고 요청 취소 처리
    const linkedDeliveries = db.deliveries.filter(d => d.contractId === contractId && d.status !== 'CANCELLED');
    linkedDeliveries.forEach(d => {
      db.updateRow<Delivery>('deliveries', d.id, {
        status: 'CANCELLED',
        updatedAt: nowIso
      });
    });

    // 5. 기발행 미수금/청구서 중 렌탈료·유상옵션 청구 0원 소급 무효화
    const linkedBillings = db.billings.filter(b => b.contractId === contractId && b.status !== 'PAID' && b.status !== 'REJECTED');
    linkedBillings.forEach(b => {
      db.updateRow<Billing>('billings', b.id, {
        status: 'REJECTED',
        totalAmount: 0,
        rejectReason: `[계약의 해제] 렌탈료·유상옵션 청구 0원 소급 무효화 (${reason})`,
        updatedAt: nowIso
      });
    });

    // 6. 기발생 운송비(회차비) 고객 청구 선택 시 운송비 채권(Receivable) 생성
    if (freightOption === 'CUSTOMER' && customerFreightAmount > 0) {
      db.insertRow<Receivable>('receivables', {
        contractId: contract.id,
        customerId: contract.customerId,
        type: 'TRANSPORT',
        occurredDate: today,
        totalAmount: customerFreightAmount,
        billedAmount: 0,
        status: 'PENDING',
        displayName: '계약 해제 회차 운송비',
        internalDescription: `[계약의 해제 고객 귀책 운송비] ${reason}`,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    // 7. 계약 변경 이력 기록
    const freightLabel = freightOption === 'CUSTOMER'
      ? `기발생 운송비 고객 청구 (₩${customerFreightAmount.toLocaleString()})`
      : freightOption === 'OURS'
      ? '기발생 운송비 당사 부담'
      : '기발생 운송비 없음';
    db.insertRow<ContractHistory>('contractHistory', {
      contractId: contract.id,
      changeType: 'TERMINATE',
      changeDate: today,
      prevEndDate: contract.endDate,
      newEndDate: effectiveRescindDate,
      description: `[계약의 해제] 체결 자산 임대가능 원상복구 및 렌탈료 0원 소급 무효화 (${freightLabel}) / 사유: ${reason}`,
      createdAt: nowIso
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const extendContract = async (contractId: string, newEndDate: string, description: string) => {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) {
      showErrorModal('계약 정보를 찾을 수 없습니다.');
      return;
    }
    if (!newEndDate) {
      showErrorModal('연장 종료일을 입력하십시오.');
      return;
    }
    if (contract.startDate && newEndDate < contract.startDate) {
      showErrorModal(`연장 종료일(${newEndDate})은 계약 시작일(${contract.startDate}) 이후여야 합니다.`);
      return;
    }

    const prevEnd = contract.endDate;
    const allContractCAs = db.contractAssets.filter(ca => ca.contractId === contractId && ca.status !== 'SOLD');
    const nonReturnedCAs = allContractCAs.filter(ca => ca.status !== 'RETURNED');
    const cAssets = nonReturnedCAs.length > 0 ? nonReturnedCAs : allContractCAs;

    db.updateRow<Contract>('contracts', contractId, {
      endDate: newEndDate,
      status: (contract.status === 'COMPLETED' && nonReturnedCAs.length === 0) ? 'COMPLETED' : 'EXTENDED',
      updatedAt: new Date().toISOString()
    });

    cAssets.forEach(ca => {
      const caUpdates: Partial<ContractAsset> = {
        endDate: newEndDate,
        updatedAt: new Date().toISOString()
      };
      if (ca.status === 'RETURNED' && ca.actualReturnDate) {
        caUpdates.actualReturnDate = newEndDate !== '미정' ? newEndDate : '';
      }
      db.updateRow<ContractAsset>('contractAssets', ca.id, caUpdates);
      if (ca.assetId && ca.status !== 'RETURNED') {
        db.updateRow<Asset>('assets', ca.assetId, {
          contractEnd: newEndDate,
          updatedAt: new Date().toISOString()
        });
      }
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId,
      changeType: 'EXTEND',
      changeDate: new Date().toISOString().split('T')[0],
      prevEndDate: prevEnd,
      newEndDate,
      description: `계약 연장 처리: ${description}`,
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  const shortenContract = async (contractId: string, newEndDate: string, description: string) => {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) {
      showErrorModal('계약 정보를 찾을 수 없습니다.');
      return;
    }
    if (!newEndDate) {
      showErrorModal('단축 종료일을 입력하십시오.');
      return;
    }
    if (contract.startDate && newEndDate < contract.startDate) {
      showErrorModal(`단축 종료일(${newEndDate})은 계약 시작일(${contract.startDate}) 이후여야 합니다.`);
      return;
    }

    const prevEnd = contract.endDate;

    db.updateRow<Contract>('contracts', contractId, {
      endDate: newEndDate,
      status: 'SHORTENED',
      updatedAt: new Date().toISOString()
    });

    const cAssets = db.contractAssets.filter(ca => ca.contractId === contractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD');
      cAssets.forEach(ca => {
        db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: newEndDate });
      if (ca.assetId) {
        db.updateRow<Asset>('assets', ca.assetId, {
          contractEnd: newEndDate,
          updatedAt: new Date().toISOString()
        });
      }
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId,
      changeType: 'SHORTEN',
      changeDate: new Date().toISOString().split('T')[0],
      prevEndDate: prevEnd,
      newEndDate,
      description: `계약 단축 처리: ${description}`,
      createdAt: new Date().toISOString()
    });

    if (cAssets.length > 0) {
      db.insertRow<Delivery>('deliveries', {
        contractId: contract.id,
        type: 'INBOUND',
        status: 'REQUESTED',
        requestDate: new Date().toISOString().split('T')[0],
        scheduledDate: newEndDate,
        deliveryCost: 0,
        isCostSettled: false,
        memo: appendDispatchStaffTag('계약 조기 단축/만료에 따른 회수 하차'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    await db.awaitPendingWrites(); refreshAllData(); };

  const succeedContract = async (contractId: string, successorCustomerId: string, successorContactId: string, successorSiteId: string, successionDate: string, description: string, selectedAssetIds?: string[]) => {
    const oldContract = db.contracts.find(c => c.id === contractId);
    if (!oldContract) {
      showErrorModal('승계 대상 계약을 찾을 수 없습니다.');
      return;
    }
    if (!successionDate) {
      showErrorModal('승계일자를 입력하십시오.');
      return;
    }
    if (oldContract.startDate && successionDate < oldContract.startDate) {
      showErrorModal(`승계일자(${successionDate})는 기존 계약 시작일(${oldContract.startDate}) 이후여야 합니다.`);
      return;
    }
    if (oldContract.endDate && oldContract.endDate !== '미정' && successionDate > oldContract.endDate) {
      showErrorModal(`승계일자(${successionDate})는 기존 계약 만료일(${oldContract.endDate}) 이전이어야 합니다.`);
      return;
    }

    const successorCust = db.customers.find(c => c.id === successorCustomerId);
    if (successorCust?.transactionStatus === 'BLOCKED') {
      showErrorModal(`인수 고객사(${successorCust.name})는 거래제한(출고차단) 상태이므로 계약을 승계할 수 없습니다.`);
      return;
    }

    const oldEndDate = oldContract.endDate;
    
    db.updateRow<Contract>('contracts', contractId, {
      endDate: successionDate,
      status: 'SHORTENED',
      updatedAt: new Date().toISOString()
    });

    const allCAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    // Feature 5: selectedAssetIds가 지정된 경우 선택된 자산만 승계, 없으면 전체
    const assetsToSucceed = selectedAssetIds && selectedAssetIds.length > 0
      ? allCAssets.filter(ca => selectedAssetIds.includes(ca.id))
      : allCAssets;
    const assetsToRetain = selectedAssetIds && selectedAssetIds.length > 0
      ? allCAssets.filter(ca => !selectedAssetIds.includes(ca.id))
      : [];

    // 전체 승계 시 원 계약 단축, 부분 승계 시 원 계약 ACTIVE 유지
    if (assetsToRetain.length === 0) {
      db.updateRow<Contract>('contracts', contractId, {
        endDate: successionDate,
        status: 'SHORTENED',
        updatedAt: new Date().toISOString()
      });
    } else {
      // 부분 승계: 원 계약의 상태는 ACTIVE 유지, 이전 대상 ContractAsset만 endDate 조정
      db.updateRow<Contract>('contracts', contractId, { updatedAt: new Date().toISOString() });
    }

    const oldCAssets = assetsToSucceed;
    oldCAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { 
        endDate: successionDate,
        status: 'RETURNED',
        actualReturnDate: successionDate
      });
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId,
      changeType: 'SHORTEN',
      changeDate: successionDate,
      prevEndDate: oldEndDate,
      newEndDate: successionDate,
      description: assetsToRetain.length > 0
        ? `계약 부분 승계 이전 (${assetsToSucceed.length}대 승계, ${assetsToRetain.length}대 잔류)`
        : `계약 승계 이전(타 고객 인수)에 따른 단축 완료`,
      createdAt: new Date().toISOString()
    });

    const oldCustomer = db.customers.find(cust => cust.id === oldContract.customerId);
    const oldCustomerName = oldCustomer ? oldCustomer.name : '-';

    const nextDay = new Date(new Date(successionDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 💡 [단일 계약 원칙 준수] 양수 고객사 + 해당 현장의 기존 활성 계약 탐색
    const existingTargetContract = db.contracts.find(c =>
      c.customerId === successorCustomerId &&
      c.siteId === successorSiteId &&
      (c.status === 'ACTIVE' || c.status === 'EXTENDED')
    );

    let targetContract: Contract;
    let isTargetExisting = false;

    if (existingTargetContract) {
      targetContract = existingTargetContract;
      isTargetExisting = true;
      // 만약 승계 대상 자산의 종료일이 기존 계약 만료일보다 길다면 부모 계약 만료일 동적 확장
      // 💡 기존 양수 계약에 영업담당자가 비어있는 경우에만 원 계약의 최초 영업담당자를 승계하며, 이미 지정된 담당자는 절대 덮어쓰지 않음
      const currentTargetEnd = targetContract.endDate;
      const needEndExtend = Boolean(currentTargetEnd && oldEndDate && (currentTargetEnd === '미정' || oldEndDate > currentTargetEnd));
      const needSalespersonFill = !targetContract.salespersonId && Boolean(oldContract.salespersonId);
      if (needEndExtend || needSalespersonFill) {
        const updatedTarget = db.updateRow<Contract>('contracts', targetContract.id, {
          ...(needEndExtend ? { endDate: oldEndDate } : {}),
          ...(needSalespersonFill ? { salespersonId: oldContract.salespersonId } : {}),
          updatedAt: new Date().toISOString()
        });
        if (updatedTarget) targetContract = updatedTarget;
      }
    } else {
      const newContractNo = generateNextContractNo(nextDay);
      ensureCustomerContactExists(successorCustomerId, successorContactId);
      // 💡 최초 영업담당자 보존 원칙: 원 계약의 salespersonId가 있으면 그대로 유지, 만약 비어있으면 선행 계약(predecessorContractId) 체인을 역추적하여 최초 영업담당자를 유지함
      let inheritedSalespersonId = oldContract.salespersonId;
      if (!inheritedSalespersonId && oldContract.predecessorContractId) {
        let curPredId: string | undefined = oldContract.predecessorContractId;
        const visited = new Set<string>();
        while (curPredId && !visited.has(curPredId)) {
          visited.add(curPredId);
          const pred = db.contracts.find(c => c.id === curPredId);
          if (pred?.salespersonId) {
            inheritedSalespersonId = pred.salespersonId;
            break;
          }
          curPredId = pred?.predecessorContractId;
        }
      }
      targetContract = db.insertRow<Contract>('contracts', {
        contractNo: newContractNo,
        customerId: successorCustomerId,
        contactId: successorContactId,
        siteId: successorSiteId,
        startDate: nextDay,
        endDate: oldEndDate,
        billingDay: oldContract.billingDay,
        statementClosingDay: oldContract.statementClosingDay,
        paymentDueDay: oldContract.paymentDueDay,
        paymentDueMonthOffset: oldContract.paymentDueMonthOffset,
        lateInterestRate: oldContract.lateInterestRate || 0,
        salespersonId: inheritedSalespersonId,
        status: 'ACTIVE',
        predecessorContractId: oldContract.id,
        predecessorContractNo: oldContract.contractNo,
        predecessorCustomerId: oldContract.customerId,
        predecessorCustomerName: oldCustomerName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // ⚠️ 외래키 제약조건 방지
    await db.awaitPendingWrites();


    // 전체 승계 시 원 계약의 장비가 0대가 되므로 상태를 COMPLETED로 종결 처리
    // (부분 승계 시 원 계약 ACTIVE 유지)
    if (assetsToRetain.length === 0) {
      db.updateRow<Contract>('contracts', contractId, {
        status: 'COMPLETED'
      });
    }

    const nowIsoSucceed = new Date().toISOString();
    oldCAssets.forEach(ca => {
      const newCA = db.insertRow<ContractAsset>('contractAssets', {
        contractId: targetContract.id,
        assetId: ca.assetId,
        monthlyRentalFee: ca.monthlyRentalFee,
        dailyRentalFee: ca.dailyRentalFee,
        startDate: nextDay,
        firstStartDate: ca.firstStartDate || ca.startDate || nextDay,
        endDate: oldEndDate,
        status: ca.status,
        predecessorContractId: contractId,
        predecessorContractAssetId: ca.id,
        createdAt: nowIsoSucceed
      });

      if (ca.assetId) {
        db.updateRow<Asset>('assets', ca.assetId, {
          currentCustomerId: successorCustomerId,
          currentSiteId: successorSiteId,
          contractStart: nextDay,
          contractEnd: oldEndDate,
          updatedAt: nowIsoSucceed
        });

        // ✅ 고아 레코드 방지: ASSIGNED(출고대기) 상태 자산 승계 시 신규 계약 기준 출고검수 의뢰 생성
        const asset = db.assets.find(a => a.id === ca.assetId);
        if (asset && asset.status === 'ASSIGNED') {
          db.insertRow<OutboundInspection>('outboundInspections', {
            contractId: targetContract.id,
            contractAssetId: newCA.id,
            assetId: ca.assetId,
            status: 'PENDING',
            createdAt: nowIsoSucceed,
            updatedAt: nowIsoSucceed
          });
        }
      }
    });

    db.insertRow<ContractHistory>('contractHistory', {
      contractId: targetContract.id,
      changeType: 'REGISTER',
      changeDate: successionDate,
      newEndDate: oldEndDate,
      description: isTargetExisting
        ? `계약 승계 기존계약 편입 완료 (이전 계약번호: ${oldContract.contractNo}): ${description}`
        : `계약 승계 신규계약 인수 완료 (이전 계약번호: ${oldContract.contractNo}): ${description}`,
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  // Feature 6) 동일 고객 현장간 장비 이동
  const relocateContractAsset = async (params: {
    contractAssetId: string;
    targetSiteId: string;
    relocationDate: string;
    needTransport?: boolean;
    transportCost?: number;
    paidBy?: 'OURS' | 'CUSTOMER' | 'VENDOR';
    reason?: string;
  }) => {
    const { contractAssetId, targetSiteId, relocationDate, needTransport, transportCost, paidBy, reason } = params;

    const sourceCA = db.contractAssets.find(ca => ca.id === contractAssetId);
    if (!sourceCA) {
      showErrorModal('이동 대상 체결 자산 슬롯을 찾을 수 없습니다.');
      return;
    }

    const sourceContract = db.contracts.find(c => c.id === sourceCA.contractId);
    if (!sourceContract) {
      showErrorModal('원 계약 정보를 찾을 수 없습니다.');
      return;
    }

    if (sourceContract.siteId === targetSiteId) {
      showErrorModal('현재 현장과 동일한 현장으로는 이동할 수 없습니다.');
      return;
    }

    if (!relocationDate) {
      showErrorModal('현장 이동 일자를 입력하십시오.');
      return;
    }

    if (sourceCA.startDate && relocationDate < sourceCA.startDate) {
      showErrorModal(`이동일자(${relocationDate})는 장비 계약 시작일(${sourceCA.startDate}) 이후여야 합니다.`);
      return;
    }

    const asset = sourceCA.assetId ? db.assets.find(a => a.id === sourceCA.assetId) : null;
    const assetNo = asset?.assetNo || '장비';
    const modelName = asset?.modelName || sourceCA.expectedModel || '고소작업대';
    const sourceSite = db.sites.find(s => s.id === sourceContract.siteId);
    const targetSite = db.sites.find(s => s.id === targetSiteId);
    const sourceSiteName = sourceSite?.name || '1현장';
    const targetSiteName = targetSite?.name || '2현장';
    const oldEndDate = sourceCA.endDate;

    const nowIso = new Date().toISOString();

    // 0. 날짜 보존 원칙:
    // - 이동 현장(2현장)의 청구개시일은 현장이동일(relocationDate) 당일로 적용한다.
    // - 개시일 당일 즉시 이동(relocationDate <= sourceCA.startDate)인 경우: 1현장은 단 하루도 사용하지 않았으므로 1현장 슬롯을 제거하여 청구 0일로 처리한다.
    // - 1현장에서 1일 이상 사용 후 이동(relocationDate > sourceCA.startDate)인 경우: 1현장은 이동 전일(relocationDate - 1일)까지 청구 마감한다.
    const getPrevDate = (dStr: string): string => {
      const [y, m, day] = dStr.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1, day - 1));
      return d.toISOString().split('T')[0];
    };
    const relocationStartDate = relocationDate;
    const isSameDayImmediateMove = !sourceCA.startDate || relocationDate <= sourceCA.startDate;
    const sourceEndDate = isSameDayImmediateMove ? '' : getPrevDate(relocationDate);

    // 1. 1현장(출발 계약) 처리
    if (isSameDayImmediateMove) {
      // 개시일 당일 즉시 이동: 출발 현장 사용일수 0일이므로 출발 계약 슬롯 삭제 (청구 0일 보장)
      db.deleteRow('contractAssets', sourceCA.id);

      db.insertRow<ContractHistory>('contractHistory', {
        contractId: sourceContract.id,
        changeType: 'SHORTEN',
        changeDate: relocationDate,
        prevEndDate: oldEndDate,
        newEndDate: relocationDate,
        description: `장비 [${assetNo} / ${modelName}] 개시 당일 현장 즉시 이동 (도착지: ${targetSiteName}, 이동일: ${relocationDate}, 출발현장 청구 0일)${reason ? ' - 사유: ' + reason : ''}`,
        createdAt: nowIso
      });
    } else {
      // 중도 현장 이동: 1현장 슬롯의 endDate를 이동 전일(relocationDate - 1일)로 단축 마감
      db.updateRow<ContractAsset>('contractAssets', sourceCA.id, {
        endDate: sourceEndDate
      });

      db.insertRow<ContractHistory>('contractHistory', {
        contractId: sourceContract.id,
        changeType: 'SHORTEN',
        changeDate: relocationDate,
        prevEndDate: oldEndDate,
        newEndDate: sourceEndDate,
        description: `장비 [${assetNo} / ${modelName}] 현장간 이동 출고 (도착지: ${targetSiteName}, 이동일: ${relocationDate}, 1현장 마감일: ${sourceEndDate})${reason ? ' - 사유: ' + reason : ''}`,
        createdAt: nowIso
      });
    }

    // 1현장에 다른 활성 자산 잔여 여부 검사
    const remainingSourceCAs = db.contractAssets.filter(ca =>
      ca.contractId === sourceContract.id &&
      ca.id !== sourceCA.id &&
      ca.status !== 'CANCELLED' &&
      (!ca.endDate || ca.endDate >= relocationDate)
    );

    if (remainingSourceCAs.length === 0) {
      if (isSameDayImmediateMove) {
        // 1현장에 다른 체결 자산이 전혀 없고 개시 당일 즉시 타 현장으로 이동한 경우: 1현장 계약은 사용 0일이므로 COMPLETED 종결 처리 (청구 슬롯 0건으로 청구 0일 보장)
        db.updateRow<Contract>('contracts', sourceContract.id, {
          status: 'COMPLETED',
          endDate: relocationDate,
          updatedAt: nowIso
        });
      } else {
        db.updateRow<Contract>('contracts', sourceContract.id, {
          status: 'COMPLETED',
          endDate: sourceEndDate,
          updatedAt: nowIso
        });
      }
    } else {
      const maxRemainingEndDate = remainingSourceCAs.map(ca => ca.endDate).filter(Boolean).sort().pop();
      if (maxRemainingEndDate && sourceContract.endDate !== maxRemainingEndDate) {
        db.updateRow<Contract>('contracts', sourceContract.id, {
          endDate: maxRemainingEndDate,
          updatedAt: nowIso
        });
      }
    }

    // 2. 2현장(도착 계약): 동일 고객 + targetSiteId의 활성 계약 탐색
    const existingTargetContract = db.contracts.find(c =>
      c.customerId === sourceContract.customerId &&
      c.siteId === targetSiteId &&
      (c.status === 'ACTIVE' || c.status === 'EXTENDED')
    );

    let destinationContract: Contract;
    let isNewDestinationContract = false;

    if (existingTargetContract) {
      destinationContract = existingTargetContract;
      // 부모 계약 만료일이 이전된 자산보다 짧으면 확장
      if (oldEndDate && destinationContract.endDate && destinationContract.endDate !== '미정' && oldEndDate > destinationContract.endDate) {
        db.updateRow<Contract>('contracts', destinationContract.id, {
          endDate: oldEndDate,
          updatedAt: nowIso
        });
      }
    } else {
      isNewDestinationContract = true;
      const newContractNo = generateNextContractNo(relocationStartDate);
      destinationContract = db.insertRow<Contract>('contracts', {
        contractNo: newContractNo,
        customerId: sourceContract.customerId,
        customerName: sourceContract.customerName,
        contactId: sourceContract.contactId,
        siteId: targetSiteId,
        startDate: relocationStartDate,
        endDate: oldEndDate,
        billingDay: sourceContract.billingDay,
        statementClosingDay: sourceContract.statementClosingDay,
        paymentDueDay: sourceContract.paymentDueDay,
        paymentDueMonthOffset: sourceContract.paymentDueMonthOffset,
        freightBillingStandard: sourceContract.freightBillingStandard,
        lateInterestRate: sourceContract.lateInterestRate || 0,
        salespersonId: sourceContract.salespersonId,
        status: 'ACTIVE',
        predecessorContractId: sourceContract.id,
        predecessorContractNo: sourceContract.contractNo,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    // 3. 2현장 계약에 contractAssets 슬롯 신규 삽입 (이동일 당일부터 청구 개시, 단가 및 조건 100% 자동 상속 - 헌장 2.2)
    db.insertRow<ContractAsset>('contractAssets', {
      contractId: destinationContract.id,
      assetId: sourceCA.assetId,
      expectedModel: sourceCA.expectedModel || modelName,
      status: sourceCA.status || 'RENTED',
      monthlyRentalFee: sourceCA.monthlyRentalFee,
      dailyRentalFee: sourceCA.dailyRentalFee,
      startDate: relocationStartDate,
      firstStartDate: sourceCA.firstStartDate || relocationStartDate,
      endDate: oldEndDate,
      predecessorContractId: sourceContract.id,
      predecessorContractAssetId: isSameDayImmediateMove ? sourceCA.predecessorContractAssetId : sourceCA.id,
      createdAt: nowIso
    });

    // 4. 2현장 계약 이력에 [현장 이동 전입] 기록
    db.insertRow<ContractHistory>('contractHistory', {
      contractId: destinationContract.id,
      changeType: 'REGISTER',
      changeDate: relocationStartDate,
      newEndDate: oldEndDate,
      description: isNewDestinationContract
        ? `신규 계약 생성 - 현장 이동 전입 (출발지: ${sourceSiteName}, 이전 계약: ${sourceContract.contractNo}, 장비: ${assetNo}, 개시일: ${relocationStartDate})`
        : `기존 계약 편입 - 현장 이동 전입 (출발지: ${sourceSiteName}, 이전 계약: ${sourceContract.contractNo}, 장비: ${assetNo}, 개시일: ${relocationStartDate})`,
      createdAt: nowIso
    });

    // 5. 자산 마스터: currentSiteId 2현장으로 동기화 & contractEnd 갱신
    if (sourceCA.assetId) {
      db.updateRow<Asset>('assets', sourceCA.assetId, {
        currentSiteId: targetSiteId,
        contractStart: relocationStartDate,
        contractEnd: oldEndDate,
        updatedAt: nowIso
      });
    }

    // 6. 배차 시스템 연동 (needTransport가 true인 경우 배차 자동 발행)
    if (needTransport) {
      const deliveryId = `DEL-${relocationDate.replace(/-/g, '').slice(2)}-${Math.floor(100 + Math.random() * 900)}`;
      const cost = transportCost || 0;
      const isCustPaid = paidBy === 'CUSTOMER';

      db.insertRow<Delivery>('deliveries', {
        id: deliveryId,
        type: 'MOVEMENT',
        dispatchCategory: '이동',
        status: 'REQUESTED',
        contractId: destinationContract.id,
        assetIds: sourceCA.assetId || '',
        requestDate: relocationDate,
        scheduledDate: relocationDate,
        loadingDate: relocationDate,
        loadingTimeSlot: '오전',
        unloadingDate: relocationDate,
        unloadingTimeSlot: '오후',
        originAddress: sourceSite?.address || `${sourceSiteName} (1현장)`,
        pickupType: 'HQ_YARD',
        destinationAddress: targetSite?.address || `${targetSiteName} (2현장)`,
        dropoffType: 'SINGLE',
        deliveryCost: cost,
        expectedCost: cost,
        finalCost: cost,
        billableToCustomer: isCustPaid,
        billableCustomerId: isCustPaid ? sourceContract.customerId : undefined,
        isCostSettled: false,
        memo: appendDispatchStaffTag(`[현장간 장비 이동] ${sourceSiteName} ➔ ${targetSiteName} (${assetNo} / ${modelName})${reason ? ' | 사유: ' + reason : ''}`),
        cargoItems: JSON.stringify([{ modelName, count: 1 }]),
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    await db.awaitPendingWrites(); refreshAllData(); };

  /**
   * [헌장 1.2 & 2.2] 수리 완료 장비 동일 계약 재투입 (회수 후 수리 재출고)
   * - 하나의 계약이 유지되는 상황에서 고장 회수된 동일 장비를 수리 완료 후 동일 계약에 재출고
   * - 1차 슬롯(단축 마감) ➔ 수리 공백(무과금 보존) ➔ 2차 신규 슬롯(재투입일 개시)으로 분리 편입
   * - 계약은 분할 생성되지 않고 기존 계약 유지
   * - 자산 상태 RENTED 전환 및 OUTBOUND 배차 1건 자동 발행
   */
  const redeployRepairedAsset = async (params: {
    contractId: string;
    assetId: string;
    redeployDate: string;
    expectedEndDate?: string;
    monthlyRentalFee?: number;
    dailyRentalFee?: number;
    needTransport?: boolean;
    transportCost?: number;
    paidBy?: 'OURS' | 'CUSTOMER' | 'VENDOR';
    reason?: string;
  }) => {
    const {
      contractId,
      assetId,
      redeployDate,
      expectedEndDate,
      monthlyRentalFee,
      dailyRentalFee,
      needTransport = false,
      transportCost = 0,
      paidBy = 'OURS',
      reason
    } = params;

    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) {
      showErrorModal('재투입 대상 계약을 찾을 수 없습니다.');
      return;
    }

    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) {
      showErrorModal('재투입 대상 장비를 찾을 수 없습니다.');
      return;
    }

    const nowIso = new Date().toISOString();

    // 1. 단가 자동 상속: 해당 계약 내 동일 장비의 이전 슬롯 단가 (미지정 시 0원 유지, 하드코딩 단가 금지)
    const prevCA = db.contractAssets.find(ca => ca.contractId === contractId && ca.assetId === assetId);
    const feeMonth = monthlyRentalFee !== undefined ? monthlyRentalFee : (prevCA?.monthlyRentalFee ?? 0);
    const feeDay = dailyRentalFee !== undefined ? dailyRentalFee : (prevCA?.dailyRentalFee ?? (feeMonth > 0 ? Math.round(feeMonth / 30) : 0));

    // 2. 만료일 결정 (부모 계약 만료일 또는 전달받은 종료일)
    const finalEndDate = expectedEndDate || contract.endDate || '';

    // 3. 부모 계약 만료일 및 상태 갱신 (종료 상태였다면 ACTIVE로 복원 및 만료일 확장)
    const contractUpdates: Partial<Contract> = {};
    if (contract.status === 'COMPLETED') {
      contractUpdates.status = 'ACTIVE';
    }
    if (finalEndDate && (!contract.endDate || contract.endDate === '미정' || finalEndDate > contract.endDate)) {
      contractUpdates.endDate = finalEndDate;
    }
    if (Object.keys(contractUpdates).length > 0) {
      db.updateRow<Contract>('contracts', contract.id, {
        ...contractUpdates,
        updatedAt: nowIso
      });
    }

    // 4. 계약에 새로운 자산 슬롯(2차 운용 시작) 삽입
    db.insertRow<ContractAsset>('contractAssets', {
      contractId: contract.id,
      assetId: asset.id,
      monthlyRentalFee: feeMonth,
      dailyRentalFee: feeDay,
      startDate: redeployDate,
      firstStartDate: prevCA?.firstStartDate || prevCA?.startDate || redeployDate,
      endDate: finalEndDate,
      createdAt: nowIso
    });

    // 5. 계약 이력에 [수리완료 재투입] 재출고 기록
    db.insertRow<ContractHistory>('contractHistory', {
      contractId: contract.id,
      changeType: 'REGISTER',
      changeDate: redeployDate,
      newEndDate: finalEndDate,
      description: `[수리완료 재투입] 장비 [${asset.assetNo} / ${asset.modelName}] 현장 재출고 (재가동 시작: ${redeployDate})${reason ? ' - 사유: ' + reason : ''}`,
      createdAt: nowIso
    });

    // 6. 자산 마스터: 상태 RENTED 전환 및 고객/현장/기간 동기화
    db.updateRow<Asset>('assets', asset.id, {
      status: 'RENTED',
      currentCustomerId: contract.customerId,
      currentSiteId: contract.siteId,
      contractStart: redeployDate,
      contractEnd: finalEndDate,
      updatedAt: nowIso
    });

    // 7. 배차 시스템 연동: OUTBOUND 배차 1건 자동 발행
    if (needTransport) {
      const site = db.sites.find(s => s.id === contract.siteId);
      const deliveryId = `DEL-RED-${redeployDate.replace(/-/g, '').slice(2)}-${Math.floor(100 + Math.random() * 900)}`;
      const isCustPaid = paidBy === 'CUSTOMER';

      db.insertRow<Delivery>('deliveries', {
        id: deliveryId,
        type: 'OUTBOUND',
        dispatchCategory: '출고',
        status: 'REQUESTED',
        contractId: contract.id,
        assetIds: asset.id,
        requestDate: redeployDate,
        scheduledDate: redeployDate,
        loadingDate: redeployDate,
        loadingTimeSlot: '오전',
        unloadingDate: redeployDate,
        unloadingTimeSlot: '오후',
        originAddress: '당사 보관소',
        pickupType: 'HQ_YARD',
        destinationAddress: site?.address || site?.name || '현장',
        dropoffType: 'SINGLE',
        deliveryCost: transportCost,
        expectedCost: transportCost,
        finalCost: transportCost,
        billableToCustomer: isCustPaid,
        billableCustomerId: isCustPaid ? contract.customerId : undefined,
        isCostSettled: false,
        memo: appendDispatchStaffTag(`[수리완료 재투입 배차] ${asset.assetNo} (${asset.modelName}) ➔ ${site?.name || '현장'}${reason ? ' | 사유: ' + reason : ''}`),
        cargoItems: JSON.stringify([{ modelName: asset.modelName, count: 1 }]),
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    await db.awaitPendingWrites(); refreshAllData(); };

  // Feature 4) 개별 ContractAsset 기간 수정 (부분 연장 / 부분 단축)
  const updateContractAssetPeriod = async (caId: string, startDate: string, endDate: string, reason: string) => {
    const ca = db.contractAssets.find(c => c.id === caId);
    if (!ca) {
      showErrorModal('수정 대상 자산 계약을 찾을 수 없습니다.');
      return;
    }
    if (endDate < startDate) {
      showErrorModal('종료일은 시작일 이후여야 합니다.');
      return;
    }

    const prevEnd = ca.status === 'RETURNED' ? (ca.actualReturnDate || ca.endDate) : ca.endDate;
    const isExtension = prevEnd && endDate > prevEnd;
    const isShortening = prevEnd && endDate < prevEnd;

    // 1. 개별 계약 자산 슬롯 기간 갱신 (반납완료 자산인 경우 actualReturnDate도 함께 갱신하여 청구 반영 보장)
    const caUpdates: Partial<ContractAsset> = {
      startDate,
      endDate,
      updatedAt: new Date().toISOString()
    };
    if (ca.status === 'RETURNED' && ca.actualReturnDate) {
      caUpdates.actualReturnDate = endDate !== '미정' ? endDate : '';
    }
    db.updateRow<ContractAsset>('contractAssets', caId, caUpdates);

    // 2. 자산 마스터의 contractEnd 동기화 (헌장 1.2: 이미 반납완료된 물리 장비 마스터는 타 계약 운용 보호를 위해 제외)
    if (ca.assetId && ca.status !== 'RETURNED') {
      db.updateRow<Asset>('assets', ca.assetId, {
        contractEnd: endDate,
        updatedAt: new Date().toISOString()
      });
    }

    // 3. 부모 계약의 전체 기간 및 상태 동기 보정 (제4원칙: 자산들의 합집합 구간 자동 확장)
    const parentContract = db.contracts.find(c => c.id === ca.contractId);
    if (parentContract) {
      const allContractCAs = db.contractAssets.filter(item => item.contractId === ca.contractId && item.status !== 'SOLD');
      const nonReturnedCAs = allContractCAs.filter(item => item.status !== 'RETURNED');
      const siblingCAs = allContractCAs.filter(item => item.id !== caId);
      const allEndDates = [
        endDate,
        ...siblingCAs.map(item => (item.status === 'RETURNED' ? (item.actualReturnDate || item.endDate) : item.endDate)).filter(Boolean) as string[]
      ];
      const maxEndDate = allEndDates.includes('미정')
        ? '미정'
        : allEndDates.reduce((max, cur) => (cur > max ? cur : max), endDate);
      const allStartDates = [startDate, ...siblingCAs.map(item => item.startDate).filter(Boolean)];
      const minStartDate = allStartDates.reduce((min, cur) => (cur < min ? cur : min), startDate);

      const nextStatus = (parentContract.status === 'COMPLETED' && nonReturnedCAs.length === 0)
        ? 'COMPLETED'
        : (isExtension ? 'EXTENDED' : isShortening ? 'SHORTENED' : parentContract.status);

      db.updateRow<Contract>('contracts', parentContract.id, {
        startDate: minStartDate,
        endDate: maxEndDate,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
    }

    // 4. 이력 저장
    db.insertRow<ContractHistory>('contractHistory', {
      contractId: ca.contractId,
      changeType: isExtension ? 'EXTEND' : 'SHORTEN',
      changeDate: new Date().toISOString().split('T')[0],
      prevEndDate: prevEnd,
      newEndDate: endDate,
      description: `[부분 ${isExtension ? '연장' : isShortening ? '단축' : '기간변경'}] 자산(${ca.assetId || ca.expectedModel}) 기간 조정: ${startDate} ~ ${endDate}${reason ? ` (사유: ${reason})` : ''}`,
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  const assignAssetToContract = async (contractAssetId: string, assetId: string) => {
    // 💡 1. 롤백용 원본 스냅샷 백업
    const origCa = db.contractAssets.find(c => c.id === contractAssetId);
    const caSnapshot = origCa ? { ...origCa } : null;

    const origAsset = db.assets.find(a => a.id === assetId);
    const assetSnapshot = origAsset ? { ...origAsset } : null;

    let createdInspectionId: string | null = null;

    try {
      if (!origCa) throw new Error('해당 계약 슬롯을 찾을 수 없습니다.');

      let contract = db.contracts.find(c => c.id === origCa.contractId);
      if (!contract && db.isSupabaseConnected()) {
        await db.pullTableFromSupabase('contracts');
        contract = db.contracts.find(c => c.id === origCa.contractId);
      }

      const blockReason = getPendingCustomerOrContractBlockReason(origCa.contractId, contract?.customerId);
      if (blockReason) {
        showErrorModal(blockReason, '결재 미승인 업무 제한');
        throw new Error(blockReason);
      }

      if (!origAsset) throw new Error('할당할 대상 장비를 찾을 수 없습니다.');

      const nowIso = new Date().toISOString();

      // 1. ContractAsset 업데이트 (실물 장비 ID 할당, 기존 계약의 expectedModel 보존)
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, {
        assetId: assetId,
        status: 'ASSIGNED',
        expectedModel: origCa.expectedModel || origAsset?.modelName
      });

      // 2. Asset 상태 업데이트 (ASSIGNED 출고대기로 전환)
      const assetUpdatePayload: Partial<Asset> = {
        status: 'ASSIGNED',
        updatedAt: nowIso
      };
      if (contract?.customerId) assetUpdatePayload.currentCustomerId = contract.customerId;
      if (contract?.siteId) assetUpdatePayload.currentSiteId = contract.siteId;
      if (contract?.startDate) assetUpdatePayload.contractStart = contract.startDate;
      if (contract?.endDate) assetUpdatePayload.contractEnd = contract.endDate;

      db.updateRow<Asset>('assets', assetId, assetUpdatePayload);

      // 3. 출고 검수/정비 작업 의뢰 생성 (연결 배차 ID 자동 매칭 및 중복 방지)
      const extractCaIdsFromDeliv = (d: Delivery): string[] => {
        if (!d.cargoItems) return [];
        try {
          const raw = typeof d.cargoItems === 'string' ? JSON.parse(d.cargoItems) : d.cargoItems;
          if (!Array.isArray(raw)) return [];
          const ids: string[] = [];
          raw.forEach((ci: any) => {
            if (Array.isArray(ci?.contractAssetIds)) ids.push(...ci.contractAssetIds.filter(Boolean));
          });
          return ids;
        } catch {
          return [];
        }
      };
      const matchedDelivery = db.deliveries.find(d =>
        d.status !== 'CANCELLED' &&
        (d.type === 'OUTBOUND' || d.type === 'EXCHANGE') &&
        (!d.contractId || d.contractId === origCa.contractId) &&
        extractCaIdsFromDeliv(d).includes(origCa.id)
      ) || db.deliveries.find(d =>
        d.status !== 'CANCELLED' &&
        (d.type === 'OUTBOUND' || d.type === 'EXCHANGE') &&
        d.contractId === origCa.contractId &&
        d.status !== 'DELIVERED'
      );
      db.outboundInspections
        .filter(i => i.contractAssetId === origCa.id && i.status !== 'COMPLETED')
        .forEach(i => db.deleteRow('outboundInspections', i.id));
      const createdInsp = db.insertRow<OutboundInspection>('outboundInspections', {
        contractId: origCa.contractId,
        contractAssetId: origCa.id,
        assetId: assetId,
        deliveryId: matchedDelivery?.id,
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso
      });
      createdInspectionId = createdInsp.id;

      // 3-1. 장비 할당 완료 여부 확인 -> [장비 할당] ToDo 상계 및 [출고 검수] ToDo 발행
      try {
        const targetEntityId = matchedDelivery?.id || origCa.contractId;
        const remainingUnassigned = db.contractAssets.filter(
          c => c.contractId === origCa.contractId && c.status !== 'RETURNED' && c.status !== 'SOLD' && c.status !== 'RENTED' && !c.assetId
        );
        if (remainingUnassigned.length === 0) {
          await clearHandoverTasks({
            entityId: targetEntityId,
            category: 'ASSET_ASSIGNMENT' as any,
            completedByUserId: currentUser?.id,
            completedByName: currentUser?.name,
            completionAction: 'ASSET_ASSIGNED'
          });
        }
        const existingPdiTodo = db.todos.find(
          t =>
            !t.isCompleted &&
            ((t.taskCategory || '').includes('INSPECTION') || (t.taskCategory || '').includes('PDI')) &&
            (t.entityId === targetEntityId || t.relatedEntityId === targetEntityId)
        );
        if (!existingPdiTodo) {
          const custObj = contract?.customerId ? db.customers.find(c => c.id === contract.customerId) : undefined;
          const siteObj = contract?.siteId ? db.sites.find(s => s.id === contract.siteId) : undefined;
          const pendingInspCount = db.outboundInspections.filter(
            i => (matchedDelivery ? i.deliveryId === matchedDelivery.id : i.contractId === origCa.contractId) && (i.status === 'PENDING' || i.status === 'IN_PROGRESS')
          ).length;
          const spUser = contract?.salespersonId ? db.users.find(u => u.id === contract.salespersonId) : undefined;
          const spName = spUser?.name || (contract as any)?.salespersonName || currentUser?.name || '영업부';
          await issueHandoverTask({
            category: 'OUTBOUND_PDI_INSPECTION',
            title: `[출고 검수] ${custObj?.name || '고객사'} (${pendingInspCount || 1}대 검수 대기${matchedDelivery?.driverName ? ` · ${matchedDelivery.driverName} 배정` : ''})`,
            content: `${siteObj?.name || '현장'} | 상차예정: ${(matchedDelivery?.loadingDate || contract?.startDate || '').slice(0, 10) || '미정'}`,
            targetDept: 'YARD',
            priority: 'HIGH',
            dueDate: (matchedDelivery?.loadingDate || contract?.startDate || '').slice(0, 10) || undefined,
            actionUrl: `/admin/outbound_inspections?deliveryId=${matchedDelivery?.id || ''}&contractId=${origCa.contractId}`,
            entityType: 'INSPECTION',
            entityId: targetEntityId,
            senderId: contract?.salespersonId || currentUser?.id,
            senderName: spName
          });
        }
      } catch (todoErr) {
        console.warn('assignAssetToContract todo sync warning:', todoErr);
      }

      // 4. Supabase 원격 DB 쓰기 100% 완결 동기 대기 (실패 시 catch 블록에서 자동 롤백!)
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('assignAssetToContract error & Rollback:', err);

      // 💥 DB 저장 실패 시 로컬 DB 및 UI State를 100% 이전 상태로 자동 롤백!
      if (caSnapshot) {
        db.updateRow<ContractAsset>('contractAssets', contractAssetId, caSnapshot);
      }
      if (assetSnapshot) {
        db.updateRow<Asset>('assets', assetId, assetSnapshot);
      }
      if (createdInspectionId) {
        db.deleteRow('outboundInspections', createdInspectionId);
      }

      refreshAllData(); // 롤백된 원복 상태를 UI에 반영!

      const errMsg = err?.message || err?.details || JSON.stringify(err);
      showErrorModal(
        `⚠️ 장비 할당 저장 중 DB 동기화 오류가 발생했습니다:\n\n` +
        `■ [안내]: 저장 실패로 인해 장비 할당 상태가 이전 미할당 상태로 안전하게 롤백(자동 원복)되었습니다. 할당 대상 목록에서 계속 작업하실 수 있습니다.\n\n` +
        `■ [실패 원인]: ${errMsg}`,
        '장비 할당 DB 동기화 오류 (자동 롤백 원복 완료)'
      );
      throw err;
    }
  };

  // 🚀 다중 장비 원자적 일괄 할당 트랜잭션 메소드 (중간 리렌더링 및 레이스 컨디션 원천 차단)
  const batchAssignAssetsToContract = async (pairs: { contractAssetId: string; assetId: string }[]) => {
    if (!pairs || pairs.length === 0) return;

    // 롤백용 전체 스냅샷 준비
    const caSnapshots: { id: string; snapshot: ContractAsset }[] = [];
    const assetSnapshots: { id: string; snapshot: Asset }[] = [];
    const createdInspectionIds: string[] = [];

    const nowIso = new Date().toISOString();

    try {
      // 1. 사전 검증 및 스냅샷 백업
      for (const pair of pairs) {
        const origCa = db.contractAssets.find(c => c.id === pair.contractAssetId);
        if (!origCa) throw new Error(`계약 슬롯(${pair.contractAssetId})을 찾을 수 없습니다.`);
        const cObj = db.contracts.find(c => c.id === origCa.contractId);
        const blockReason = getPendingCustomerOrContractBlockReason(origCa.contractId, cObj?.customerId);
        if (blockReason) {
          showErrorModal(blockReason, '결재 미승인 업무 제한');
          throw new Error(blockReason);
        }
        caSnapshots.push({ id: origCa.id, snapshot: { ...origCa } });

        const origAsset = db.assets.find(a => a.id === pair.assetId);
        if (!origAsset) throw new Error(`대상 장비(${pair.assetId})를 찾을 수 없습니다.`);
        assetSnapshots.push({ id: origAsset.id, snapshot: { ...origAsset } });
      }

      // 2. 전체 슬롯 및 자산 일괄 메모리 업데이트 (단일 원자적 배치)
      for (const pair of pairs) {
        const origCa = db.contractAssets.find(c => c.id === pair.contractAssetId)!;
        const origAsset = db.assets.find(a => a.id === pair.assetId)!;
        const contract = db.contracts.find(c => c.id === origCa.contractId);

        // 2-1. contractAssets 업데이트 (기존 계약의 expectedModel 절대 보존)
        db.updateRow<ContractAsset>('contractAssets', origCa.id, {
          assetId: origAsset.id,
          status: 'ASSIGNED',
          expectedModel: origCa.expectedModel || origAsset.modelName
        });

        // 2-2. assets 업데이트
        const assetUpdatePayload: Partial<Asset> = {
          status: 'ASSIGNED',
          updatedAt: nowIso
        };
        if (contract?.customerId) assetUpdatePayload.currentCustomerId = contract.customerId;
        if (contract?.siteId) assetUpdatePayload.currentSiteId = contract.siteId;
        if (contract?.startDate) assetUpdatePayload.contractStart = contract.startDate;
        if (contract?.endDate) assetUpdatePayload.contractEnd = contract.endDate;

        db.updateRow<Asset>('assets', origAsset.id, assetUpdatePayload);

        // 2-3. 출고 검수 의뢰 생성 (연결 배차 ID 자동 매칭 및 중복 방지)
      const extractCaIdsFromDeliv = (d: Delivery): string[] => {
        if (!d.cargoItems) return [];
        try {
          const raw = typeof d.cargoItems === 'string' ? JSON.parse(d.cargoItems) : d.cargoItems;
          if (!Array.isArray(raw)) return [];
          const ids: string[] = [];
          raw.forEach((ci: any) => {
            if (Array.isArray(ci?.contractAssetIds)) ids.push(...ci.contractAssetIds.filter(Boolean));
          });
          return ids;
        } catch {
          return [];
        }
      };
      const matchedDelivery = db.deliveries.find(d =>
        d.status !== 'CANCELLED' &&
        (d.type === 'OUTBOUND' || d.type === 'EXCHANGE') &&
        (!d.contractId || d.contractId === origCa.contractId) &&
        extractCaIdsFromDeliv(d).includes(origCa.id)
      ) || db.deliveries.find(d =>
        d.status !== 'CANCELLED' &&
        (d.type === 'OUTBOUND' || d.type === 'EXCHANGE') &&
        d.contractId === origCa.contractId &&
        d.status !== 'DELIVERED'
      );
      db.outboundInspections
        .filter(i => i.contractAssetId === origCa.id && i.status !== 'COMPLETED')
        .forEach(i => db.deleteRow('outboundInspections', i.id));
        const createdInsp = db.insertRow<OutboundInspection>('outboundInspections', {
          contractId: origCa.contractId,
          contractAssetId: origCa.id,
          assetId: origAsset.id,
          deliveryId: matchedDelivery?.id,
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso
        });
        createdInspectionIds.push(createdInsp.id);
        // 2-4. 🌟 [패키지 서류 무결성]: 기존 슬롯에 다른 장비가 배정되어 있었는데 교체된 경우 ToDo 발행
        if (origCa.assetId && origCa.assetId !== origAsset.id) {
          try {
            await checkAndIssuePackageResendTask({
              contractId: origCa.contractId,
              oldAssetId: origCa.assetId,
              newAssetId: origAsset.id,
              reason: '출고 전 장비 재할당/교체',
              senderName: '장비할당시스템'
            });
          } catch (taskErr) {
            console.warn('계약서패키지 재발송 ToDo 발행 경고 (무시):', taskErr);
          }
        }
      }

      // 2-5. 일괄 할당된 계약/배차건에 대해 [장비 할당] ToDo 상계 및 [출고 검수] ToDo 발행
      try {
        const affectedContractIds = Array.from(new Set(pairs.map(p => db.contractAssets.find(c => c.id === p.contractAssetId)?.contractId).filter(Boolean))) as string[];
        for (const cid of affectedContractIds) {
          const contract = db.contracts.find(c => c.id === cid);
          const matchedDeliv = db.deliveries.find(
            d => d.contractId === cid && d.status !== 'CANCELLED' && (d.type === 'OUTBOUND' || d.type === 'EXCHANGE') && d.status !== 'DELIVERED'
          );
          const targetEntityId = matchedDeliv?.id || cid;
          const remainingUnassigned = db.contractAssets.filter(
            c => c.contractId === cid && c.status !== 'RETURNED' && c.status !== 'SOLD' && c.status !== 'RENTED' && !c.assetId
          );
          if (remainingUnassigned.length === 0) {
            await clearHandoverTasks({
              entityId: targetEntityId,
              category: 'ASSET_ASSIGNMENT' as any,
              completedByUserId: currentUser?.id,
              completedByName: currentUser?.name,
              completionAction: 'ASSET_ASSIGNED'
            });
          }
          const existingPdiTodo = db.todos.find(
            t =>
              !t.isCompleted &&
              ((t.taskCategory || '').includes('INSPECTION') || (t.taskCategory || '').includes('PDI')) &&
              (t.entityId === targetEntityId || t.relatedEntityId === targetEntityId)
          );
          if (!existingPdiTodo) {
            const custObj = contract?.customerId ? db.customers.find(c => c.id === contract.customerId) : undefined;
            const siteObj = contract?.siteId ? db.sites.find(s => s.id === contract.siteId) : undefined;
            const pendingInspCount = db.outboundInspections.filter(
              i => (matchedDeliv ? i.deliveryId === matchedDeliv.id : i.contractId === cid) && (i.status === 'PENDING' || i.status === 'IN_PROGRESS')
            ).length;
            const spUser = contract?.salespersonId ? db.users.find(u => u.id === contract.salespersonId) : undefined;
            const spName = spUser?.name || (contract as any)?.salespersonName || currentUser?.name || '영업부';
            await issueHandoverTask({
              category: 'OUTBOUND_PDI_INSPECTION',
              title: `[출고 검수] ${custObj?.name || '고객사'} (${pendingInspCount || pairs.length}대 검수 대기${matchedDeliv?.driverName ? ` · ${matchedDeliv.driverName} 배정` : ''})`,
              content: `${siteObj?.name || '현장'} | 상차예정: ${(matchedDeliv?.loadingDate || contract?.startDate || '').slice(0, 10) || '미정'}`,
              targetDept: 'YARD',
              priority: 'HIGH',
              dueDate: (matchedDeliv?.loadingDate || contract?.startDate || '').slice(0, 10) || undefined,
              actionUrl: `/admin/outbound_inspections?deliveryId=${matchedDeliv?.id || ''}&contractId=${cid}`,
              entityType: 'INSPECTION',
              entityId: targetEntityId,
              senderId: contract?.salespersonId || currentUser?.id,
              senderName: spName
            });
          }
        }
      } catch (todoErr) {
        console.warn('batchAssignAssetsToContract todo sync warning:', todoErr);
      }

      // 3. 단 1회의 원격 DB 쓰기 완결 동기 대기 & 단 1회의 전역 리렌더링!
      await db.awaitPendingWrites();
      refreshAllData();

    } catch (err: any) {
      console.error('batchAssignAssetsToContract error & Rollback:', err);

      // 💥 일괄 롤백
      caSnapshots.forEach(item => {
        db.updateRow<ContractAsset>('contractAssets', item.id, item.snapshot);
      });
      assetSnapshots.forEach(item => {
        db.updateRow<Asset>('assets', item.id, item.snapshot);
      });
      createdInspectionIds.forEach(id => {
        db.deleteRow('outboundInspections', id);
      });

      refreshAllData();

      const errMsg = err?.message || err?.details || JSON.stringify(err);
      showErrorModal(`⚠️ 일괄 장비 할당 중 오류가 발생하여 모든 작업이 안전하게 원복되었습니다:\n\n${errMsg}`, '일괄 장비 할당 실패');
      throw err;
    }
  };

  // 🔄 장비 할당 취소 메소드 (출고 검수 전 슬롯 할당 해제 및 장비 AVAILABLE 복원)
  const unassignAssetFromContract = async (contractAssetId: string) => {
    const origCa = db.contractAssets.find(c => c.id === contractAssetId);
    if (!origCa || !origCa.assetId) return;

    const origAssetId = origCa.assetId;
    const origAsset = db.assets.find(a => a.id === origAssetId);

    // 🔴 [절차적 무결성 가드]: 이미 출고검수가 완료(COMPLETED)되었거나 운송대기(AWAITING_TRANSPORT)/대여중(RENTED)인 장비는 할당 취소 차단
    const completedInsp = db.outboundInspections.find(
      i => (i.contractAssetId === contractAssetId || (i.contractId === origCa.contractId && i.assetId === origAssetId)) && i.status === 'COMPLETED'
    );
    if (completedInsp || origCa.status === 'RENTED' || origCa.status === 'AWAITING_TRANSPORT' || origAsset?.status === 'RENTED' || origAsset?.status === 'AWAITING_TRANSPORT') {
      const msg = '이미 출고검수가 완료되어 운송대기 또는 대여중으로 전환된 장비는 할당을 취소할 수 없습니다.\n장비를 변경하려면 먼저 [출고 검수] 메뉴에서 [출고 승인 취소]를 수행해 주십시오.';
      showErrorModal(msg, '장비 할당 취소 불가 (출고검수 완료 상태)');
      throw new Error(msg);
    }

    const caSnapshot = { ...origCa };
    const assetSnapshot = origAsset ? { ...origAsset } : null;

    try {
      const nowIso = new Date().toISOString();

      // 1. ContractAsset 에서 assetId 명시적 NULL 제거 (Supabase DB 반영 보장)
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, {
        assetId: null as any,
        status: 'ASSIGNED'
      });

      // 2. Asset 상태를 임대가능 로 복원 및 계약 연결 명시적 NULL 해제
      if (origAsset) {
        db.updateRow<Asset>('assets', origAssetId, {
          status: 'AVAILABLE',
          currentCustomerId: null as any,
          currentSiteId: null as any,
          contractStart: null as any,
          contractEnd: null as any,
          updatedAt: nowIso
        });
      }

      // 3. 아직 완료되지 않은 출고 검수 의뢰건 전체 삭제
      const pendingInsps = db.outboundInspections.filter(
        i => (i.contractAssetId === contractAssetId || (i.contractId === origCa.contractId && i.assetId === origAssetId)) && i.status !== 'COMPLETED'
      );
      pendingInsps.forEach(i => db.deleteRow('outboundInspections', i.id));

      // 4. 🌟 [패키지 서류 무결성]: 계약서패키지 발송 후 출고 전 장비 할당 해제 시 ToDo 자동 발행
      try {
        await checkAndIssuePackageResendTask({
          contractId: origCa.contractId,
          oldAssetId: origAssetId,
          newAssetId: undefined,
          reason: '출고 전 장비 할당 해제/취소',
          senderName: '장비할당시스템'
        });
      } catch (taskErr) {
        console.warn('계약서패키지 재발송 ToDo 발행 경고 (무시):', taskErr);
      }

      // 5. DB 완결 동기 대기 & 전역 리렌더링
      await db.awaitPendingWrites();
      refreshAllData();

    } catch (err: any) {
      console.error('unassignAssetFromContract error & Rollback:', err);
      // 롤백
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, caSnapshot);
      if (assetSnapshot && origAssetId) {
        db.updateRow<Asset>('assets', origAssetId, assetSnapshot);
      }
      refreshAllData();

      showErrorModal(`⚠️ 장비 할당 취소 중 오류가 발생하여 원복되었습니다:\n${err?.message || err}`, '할당 취소 실패');
      throw err;
    }
  };

  // 🔄 다중 장비 원자적 일괄 할당 취소 트랜잭션 메소드 (중간 리렌더링 및 레이스 컨디션 원천 차단)
  const batchUnassignAssetsFromContract = async (contractAssetIds: string[]) => {
    if (!contractAssetIds || contractAssetIds.length === 0) return;

    const caSnapshots: { id: string; snapshot: ContractAsset }[] = [];
    const assetSnapshots: { id: string; snapshot: Asset }[] = [];
    const deletedInspectionIds: { id: string; row: OutboundInspection }[] = [];

    const nowIso = new Date().toISOString();

    try {
      // 1. 사전 검증 및 스냅샷 백업
      for (const caId of contractAssetIds) {
        const origCa = db.contractAssets.find(c => c.id === caId);
        if (origCa && origCa.assetId) {
          const origAsset = db.assets.find(a => a.id === origCa.assetId);
          const completedInsp = db.outboundInspections.find(
            i => (i.contractAssetId === caId || (i.contractId === origCa.contractId && i.assetId === origCa.assetId)) && i.status === 'COMPLETED'
          );
          if (completedInsp || origCa.status === 'RENTED' || origCa.status === 'AWAITING_TRANSPORT' || origAsset?.status === 'RENTED' || origAsset?.status === 'AWAITING_TRANSPORT') {
            const msg = `장비(${origAsset?.assetNo || origCa.expectedModel})는 이미 출고검수가 완료되어 운송대기 또는 대여중 상태이므로 할당을 취소할 수 없습니다.\n[출고 검수]에서 검수 롤백을 먼저 수행해 주십시오.`;
            showErrorModal(msg, '일괄 할당 취소 불가 (출고검수 완료 포함)');
            throw new Error(msg);
          }
          caSnapshots.push({ id: origCa.id, snapshot: { ...origCa } });
          if (origAsset) {
            assetSnapshots.push({ id: origAsset.id, snapshot: { ...origAsset } });
          }
          const pendingInsp = db.outboundInspections.find(
            i => (i.contractAssetId === caId || (i.contractId === origCa.contractId && i.assetId === origCa.assetId)) && i.status !== 'COMPLETED'
          );
          if (pendingInsp) {
            deletedInspectionIds.push({ id: pendingInsp.id, row: { ...pendingInsp } });
          }
        }
      }

      // 2. 일괄 메모리 업데이트 (단일 원자적 배치)
      for (const caId of contractAssetIds) {
        const origCa = db.contractAssets.find(c => c.id === caId);
        if (origCa && origCa.assetId) {
          const origAssetId = origCa.assetId;
          db.updateRow<ContractAsset>('contractAssets', caId, {
            assetId: null as any,
            status: 'ASSIGNED'
          });
          db.updateRow<Asset>('assets', origAssetId, {
            status: 'AVAILABLE',
            currentCustomerId: null as any,
            currentSiteId: null as any,
            contractStart: null as any,
            contractEnd: null as any,
            updatedAt: nowIso
          });
          const pendingInsps = db.outboundInspections.filter(
            i => (i.contractAssetId === caId || (i.contractId === origCa.contractId && i.assetId === origAssetId)) && i.status !== 'COMPLETED'
          );
          pendingInsps.forEach(i => {
            deletedInspectionIds.push({ id: i.id, row: { ...i } });
            db.deleteRow('outboundInspections', i.id);
          });
        }
      }

      // 3. 단 1회의 원격 DB 쓰기 완결 동기 대기 & 단 1회의 전역 리렌더링!
      await db.awaitPendingWrites();
      refreshAllData();

    } catch (err: any) {
      console.error('batchUnassignAssetsFromContract error & Rollback:', err);
      // 💥 일괄 롤백
      caSnapshots.forEach(item => {
        db.updateRow<ContractAsset>('contractAssets', item.id, item.snapshot);
      });
      assetSnapshots.forEach(item => {
        db.updateRow<Asset>('assets', item.id, item.snapshot);
      });
      deletedInspectionIds.forEach(item => {
        db.insertRow<OutboundInspection>('outboundInspections', item.row);
      });
      refreshAllData();

      showErrorModal(`⚠️ 일괄 장비 할당 취소 중 오류가 발생하여 모든 작업이 안전하게 원복되었습니다:\n\n${err?.message || err}`, '일괄 할당 취소 실패');
      throw err;
    }
  };

  // 💡 출고 진행 중 장비 교체 및 수리전환 트랜잭션 메소드 (contractAssetId 또는 contractId 2중 자동추적 지원)
  const exchangeOutboundAsset = async (
    contractAssetIdOrContractId: string,
    oldAssetId: string,
    newAssetId: string,
    reason?: string,
    markOldAsRepairing: boolean = true,
    customPenaltyScore?: number
  ) => {
    // 롤백용 스냅샷 준비
    const oldAssetOrig = db.assets.find(a => a.id === oldAssetId);
    const newAssetOrig = db.assets.find(a => a.id === newAssetId);
    
    // contractAssetId 직접 매칭 또는 contractId + oldAssetId 조합으로 2중 유연 추적
    let caOrig = db.contractAssets.find(c => c.id === contractAssetIdOrContractId);
    if (!caOrig) {
      caOrig = db.contractAssets.find(c => c.contractId === contractAssetIdOrContractId && (c.assetId === oldAssetId || !c.assetId));
    }
    if (!caOrig) {
      caOrig = db.contractAssets.find(c => c.contractId === contractAssetIdOrContractId);
    }
    const contractAssetId = caOrig?.id || contractAssetIdOrContractId;

    const inspOrig = db.outboundInspections.find(i => (i.contractAssetId === contractAssetId || i.contractId === contractAssetIdOrContractId) && i.assetId === oldAssetId);

    const oldSnapshot = oldAssetOrig ? { ...oldAssetOrig } : null;
    const newSnapshot = newAssetOrig ? { ...newAssetOrig } : null;
    const caSnapshot = caOrig ? { ...caOrig } : null;
    const inspSnapshot = inspOrig ? { ...inspOrig } : null;
    let createdRepairId: string | undefined = undefined;

    try {
      if (!oldAssetOrig || !newAssetOrig || !caOrig) {
        throw new Error(`교체 대상 장비 또는 계약 슬롯을 찾을 수 없습니다. (구장비: ${oldAssetId ? '정상' : '누락'}, 신장비: ${newAssetId ? '정상' : '누락'}, 계약슬롯: ${caOrig ? '정상' : '누락'})`);
      }

      const today = new Date().toISOString().split('T')[0];
      const nowIso = new Date().toISOString();

      // 1. 기존 장비: 수리정비중 선택 시 REPAIRING 전환, 아니면 임대가능 유지!
      // 💡 [전사 정책]: 출고검수 탈락 교체 시 사유 유무와 무관하게 정비점수 가산 (지정 점수 또는 기본 5점)
      const targetStatus = markOldAsRepairing ? 'REPAIRING' : 'AVAILABLE';
      const penaltyToAdd = typeof customPenaltyScore === 'number' && !isNaN(customPenaltyScore) ? customPenaltyScore : 5;
      const updatedScore = (Number(oldAssetOrig.maintenanceScore) || 0) + penaltyToAdd;
      
      const cleanReason = reason && reason.trim() ? reason.trim() : '출고검수 탈락 교체(사유미기재)';
      const oldNote = oldAssetOrig.note || '';
      const appendedNote = oldNote
        ? `${oldNote}\n[출고검수 교체(벌점+${penaltyToAdd}, 총점:${updatedScore}점)] ${today}: ${cleanReason}`
        : `[출고검수 교체(벌점+${penaltyToAdd}, 총점:${updatedScore}점)] ${today}: ${cleanReason}`;

      const oldPayload: Partial<Asset> = {
        status: targetStatus,
        maintenanceScore: updatedScore,
        currentCustomerId: undefined,
        currentSiteId: undefined,
        contractStart: undefined,
        contractEnd: undefined,
        note: appendedNote, // 🌟 자산 정비필요항목에만 정확히 저장
        // 🌟 memo(일반 자산 비고: 임차처/결제조건 등)는 절대 오염시키지 않고 원본 100% 보존!
        updatedAt: nowIso
      };

      db.updateRow<Asset>('assets', oldAssetId, oldPayload);

      // 1-1. 🌟 [주기장 정비 연계]: 수리정비중 전환 시 주기장 정비 대장 티켓 1:1 자동 발행 (헌장 1.2 무누락 저장)
      if (markOldAsRepairing) {
        createdRepairId = db.generateNextId('repairs', db.repairs);
        db.insertRow<Repair>('repairs', {
          id: createdRepairId,
          assetId: oldAssetId,
          assetNo: oldAssetOrig.assetNo,
          modelName: oldAssetOrig.modelName,
          contractId: caOrig.contractId,
          customerId: oldAssetOrig.currentCustomerId,
          customerName: db.customers.find(c => c.id === oldAssetOrig.currentCustomerId)?.name || '출고 검수처',
          siteId: oldAssetOrig.currentSiteId,
          siteName: db.sites.find(s => s.id === oldAssetOrig.currentSiteId)?.name || '주기장',
          requestDate: today,
          status: 'PENDING',
          workCategory: 'YARD_INTERNAL',
          workLocation: 'YARD',
          stockSource: 'YARD_STOCK',
          source: 'OUTBOUND_DEFECT',
          repairType: 'INTERNAL',
          priority: 'URGENT',
          details: `[출고검수 불량 정비 접수] 교체사유: ${cleanReason}\n대체장비: ${newAssetOrig.assetNo} (${newAssetOrig.modelName})`,
          issueDescription: cleanReason,
          totalCost: 0,
          billableToCustomer: false,
          targetAssetStatus: 'REPAIRING',
          degradationScore: penaltyToAdd,
          createdAt: nowIso,
          updatedAt: nowIso
        });

        // 🚀 주기장 정비팀에 긴급 정비 ToDo 자동 적재
        try {
          await issueHandoverTask({
            category: 'OUTBOUND_REPAIR_DEFECT',
            title: `[출고 교체 긴급 정비] ${oldAssetOrig.assetNo} (${oldAssetOrig.modelName})`,
            content: `출고검수 불량 교체 (+${penaltyToAdd}점): ${cleanReason} (대체: ${newAssetOrig.assetNo})`,
            targetDept: 'YARD',
            priority: 'URGENT',
            actionUrl: '/repairs',
            entityType: 'REPAIR',
            entityId: createdRepairId,
            senderId: currentUser?.id,
            senderName: currentUser?.name || '출고검수시스템'
          });
        } catch (taskErr) {
          console.warn('출고 불량 정비 ToDo 발행 경고 (무시):', taskErr);
        }
      }

      // 2. 대체 장비: 현재 검수 단계(IN_PROGRESS면 출고검수, 아니면 출고대기) 상태 상속 및 계약 정보 매핑
      const inheritedReplacementStatus = inspOrig?.status === 'IN_PROGRESS' ? 'OUTBOUND_INSPECTION' : 'ASSIGNED';
      db.updateRow<Asset>('assets', newAssetId, {
        status: inheritedReplacementStatus,
        currentCustomerId: oldAssetOrig.currentCustomerId,
        currentSiteId: oldAssetOrig.currentSiteId,
        contractStart: oldAssetOrig.contractStart,
        contractEnd: oldAssetOrig.contractEnd,
        updatedAt: nowIso
      });

      // 3. 계약 슬롯 assetId 교체
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, {
        assetId: newAssetId,
        expectedModel: newAssetOrig.modelName,
        status: inheritedReplacementStatus
      });

      // 4. 출고 검수 의뢰건 assetId 교체 (없으면 신규 생성하여 검수 누락 방지)
      if (inspOrig) {
        db.updateRow<OutboundInspection>('outboundInspections', inspOrig.id, {
          assetId: newAssetId,
          note: `[장비교체] 기존(${oldAssetOrig.assetNo}) ➔ 대체(${newAssetOrig.assetNo}) | 사유: ${reason}`,
          updatedAt: nowIso
        });
      } else {
        db.insertRow<OutboundInspection>('outboundInspections', {
          id: `insp-${contractAssetId}-${Date.now()}`,
          contractId: caOrig.contractId,
          contractAssetId,
          assetId: newAssetId,
          status: 'PENDING',
          note: `[장비교체] 대체(${newAssetOrig.assetNo}) 신규 검수의뢰 | 사유: ${reason}`,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }

      // 4-1. 🌟 [전사 표준 헌장 2.3 단일 EXCHANGE 1건 발행/전환 원칙]: 출고불량 교체 시 배차 건을 단일 'EXCHANGE'로 갱신
      const existingDel = db.deliveries.find(d => d.contractId === caOrig.contractId && (d.assetIds?.includes(oldAssetId) || !d.assetIds));
      if (existingDel) {
        db.updateRow<Delivery>('deliveries', existingDel.id, {
          assetIds: newAssetId,
          type: 'EXCHANGE',
          memo: `[출고불량 교체배차 (헌장 2.3)] 구장비(${oldAssetOrig.assetNo}) ➔ 대체장비(${newAssetOrig.assetNo}) | 사유: ${cleanReason}`,
          updatedAt: nowIso
        });
      }

      // 5. 자산 입출고/수리 타임라인 로깅 (대체 장비는 향후 출고 검수 승인 시 OUTBOUND 이력이 생성됨)
      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: oldAssetId,
        assetNo: oldAssetOrig.assetNo,
        modelName: oldAssetOrig.modelName,
        type: 'REPAIR',
        repairId: createdRepairId,
        eventDate: today,
        memo: `[출고불가 수리전환] 대체장비(${newAssetOrig.assetNo}) 교체배정 | 사유: ${cleanReason}${createdRepairId ? ` (정비티켓 ${createdRepairId} 자동발행)` : ''}`,
        createdAt: nowIso
      });

      // 6. 🌟 [패키지 서류 무결성 보존]: 계약서패키지 발송 후 출고 자산 교체 시 ToDo 자동 발행
      try {
        await checkAndIssuePackageResendTask({
          contractId: caOrig.contractId,
          oldAssetId,
          newAssetId,
          reason,
          senderName: '출고검수시스템'
        });
      } catch (taskErr) {
        console.warn('계약서패키지 재발송 ToDo 발행 경고 (무시):', taskErr);
      }

      // 7. DB 완결 동기 대기 (실패 시 catch 블록에서 자동 롤백!)
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('exchangeOutboundAsset error & Rollback:', err);

      // 💥 DB 저장 실패 시 100% 스냅샷 롤백!
      if (oldSnapshot) db.updateRow('assets', oldAssetId, oldSnapshot);
      if (newSnapshot) db.updateRow('assets', newAssetId, newSnapshot);
      if (caSnapshot) db.updateRow('contractAssets', contractAssetId, caSnapshot);
      if (inspSnapshot && inspOrig) db.updateRow('outboundInspections', inspOrig.id, inspSnapshot);
      if (createdRepairId) db.deleteRow('repairs', createdRepairId);

      refreshAllData();

      const errorMsg = `⚠️ 출고 장비 교체 처리 중 DB 동기화 오류가 발생했습니다:\n\n■ [안내]: 저장 실패로 인해 장비 교체 작업이 안전하게 자동 롤백 원복되었습니다.\n\n${err.message || err.details || JSON.stringify(err)}`;
      showErrorModal(errorMsg, '출고 장비 교체 DB 동기화 오류');
      throw err;
    }
  };

  const exchangeAsset = async (contractId: string, oldAssetId: string, newAssetId: string, exchangeDate: string) => {
    try {
      const contract = db.contracts.find(c => c.id === contractId);
      if (!contract) {
        showErrorModal('대차 교체 대상 계약 정보를 찾을 수 없습니다.');
        return;
      }

      const caList = db.contractAssets.filter(ca => ca.contractId === contractId && ca.assetId === oldAssetId);
      const ca = caList.find(c => !c.endDate || new Date(c.endDate) >= new Date(exchangeDate));
      if (!ca) {
        showErrorModal('대차 대상 계약 자산 슬롯을 찾을 수 없습니다.');
        return;
      }

      const originalEndDate = ca.endDate;
      const prevDateObj = new Date(exchangeDate);
      prevDateObj.setDate(prevDateObj.getDate() - 1);
      const dayBeforeExchange = prevDateObj.toISOString().split('T')[0];

      // 헌장 4.1: 전자산은 교체 전일까지 일할 마감
      db.updateRow<ContractAsset>('contractAssets', ca.id, { 
        endDate: dayBeforeExchange,
        status: 'RETURNED',
        actualReturnDate: exchangeDate,
        updatedAt: new Date().toISOString()
      });

      const oldAsset = db.assets.find(a => a.id === oldAssetId);
      if (oldAsset) {
        db.updateRow<Asset>('assets', oldAssetId, {
          status: 'REPAIRING',
          currentCustomerId: undefined,
          currentSiteId: undefined,
          contractStart: undefined,
          contractEnd: undefined,
          updatedAt: new Date().toISOString()
        });
      }

      // 헌장 4.1: 후장비는 교체 당일부터 가동 승계
      const newAsset = db.assets.find(a => a.id === newAssetId);
      if (newAsset) {
        db.insertRow<ContractAsset>('contractAssets', {
          contractId: contractId,
          assetId: newAssetId,
          monthlyRentalFee: ca.monthlyRentalFee,
          dailyRentalFee: ca.dailyRentalFee,
          startDate: exchangeDate,
          firstStartDate: ca.firstStartDate || ca.startDate || exchangeDate,
          endDate: originalEndDate || contract.endDate,
          createdAt: new Date().toISOString()
        });

        // 헌장 1.3 준수: 배차 단계에서는 ASSIGNED(배정/출고대기) 상태 부여, 출고 검수 승인 마감 시 RENTED 전환
        db.updateRow<Asset>('assets', newAssetId, {
          status: 'ASSIGNED',
          currentCustomerId: contract.customerId,
          currentSiteId: contract.siteId,
          contractStart: exchangeDate,
          contractEnd: originalEndDate || contract.endDate,
          monthlyRentalFee: ca.monthlyRentalFee,
          dailyRentalFee: ca.dailyRentalFee,
          updatedAt: new Date().toISOString()
        });
      }

      // 헌장 2.3 준수: 단일 EXCHANGE 배차 의뢰 1건 발행
      db.insertRow<Delivery>('deliveries', {
        contractId: contractId,
        type: 'EXCHANGE',
        status: 'REQUESTED',
        requestDate: exchangeDate,
        deliveryCost: 0,
        isCostSettled: false,
        memo: appendDispatchStaffTag(`장비 교체 의뢰 (구: ${oldAsset?.assetNo || '미상'} -> 신: ${newAsset?.assetNo || '미상'})`),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 헌장 4.2 준수: changeType 'EXCHANGE' 명시
      db.insertRow<ContractHistory>('contractHistory', {
        contractId,
        changeType: 'EXCHANGE',
        changeDate: exchangeDate,
        description: `장비 교체 완료 (구: ${oldAsset?.assetNo || '미상'} -> 신: ${newAsset?.assetNo || '미상'})`,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 대차 교체 처리 중 DB 동기화 오류:\n${err?.message || err}`);
      throw err;
    }
  };

  const generateBillingsForMonth = async (billingYm: string, billingDate: string) => {
    try {
      const [year, month] = billingYm.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);

      // 해당 월에 활성 상태인 계약 전체 탐색 (계약 단위 독립 생성 - E-1 원칙, 매각 계약 원천 배제)
      // 💡 종료(COMPLETED)된 계약이라도 기간 연장 등으로 인해 아직 최종 만료일(endDate)까지 청구가 완료되지 않은 경우 포함
      const activeContracts = db.contracts.filter(c => {
        if ((c.contractType || 'RENTAL') !== 'RENTAL') return false; // 🚫 자산 매각 계약 원천 배제
        if (c.status === 'COMPLETED' && c.lastBilledPeriodEnd && c.endDate && c.endDate !== '미정' && c.lastBilledPeriodEnd >= c.endDate) return false;
        const contractStart = new Date(c.startDate);
        const contractEnd = c.endDate && c.endDate !== '미정' ? new Date(c.endDate) : null;
        if (contractStart > endOfMonth) return false;
        if (contractEnd && contractEnd < startOfMonth) return false;
        return true;
      });

      let createdCount = 0;
      const errors: string[] = [];

      for (const c of activeContracts) {
        try {
          const bId = await generateBillingForSingleContract(c.id, billingYm, billingDate);
          if (bId) createdCount++;
        } catch (err: any) {
          // 중복 경고는 조용히 skip (이미 존재하는 청구서)
          if (err?.message?.includes('[중복 경고]')) continue;
          errors.push(err?.message || String(err));
        }
      }

      await db.awaitPendingWrites();
      refreshAllData();

      if (errors.length > 0) {
        showErrorModal(`⚠️ 일부 청구서 생성 실패 (${errors.length}건):\n\n${errors.slice(0, 5).join('\n')}`, '청구서 생성 일부 실패');
      }
    } catch (err: any) {
      showErrorModal(`⚠️ 일괄 청구서 DB 저장 실패:\n\n${err?.message || err}`, '청구서 생성 실패');
    }
  };

  // 거래명세서 발송: UNPAID → REQUESTED (F-2 원칙)
  const approveBilling = async (billingId: string) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) return;
    if (billing.status === 'UNPAID') {
      // 발송 처리: REQUESTED로 전환
      db.updateRow<Billing>('billings', billingId, {
        status: 'REQUESTED',
        updatedAt: new Date().toISOString()
      });
      // 계약이력 기록
      if (billing.contractId) {
        db.insertRow<ContractHistory>('contractHistory', {
          contractId: billing.contractId,
          changeType: 'BILLING_SENT',
          changeDate: new Date().toISOString().split('T')[0],
          description: `청구서 발송: ${billing.billingYm} / ${billing.totalAmount.toLocaleString()}원 (청구번호: ${billingId})`,
          createdAt: new Date().toISOString()
        });
      }
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  // 청구 취소 (J-1, J-2 원칙)
  // refund=true: 수납 취소 + 입금잔액 소멸 (환불 케이스)
  // refund=false: 청구만 취소, 수납·입금잔액 잔류 (비환불 케이스 → 새 청구에 연결)
  /**
   * 수납 1건 전체 취소 처리 (단일 경로).
   * - PAYMENT_REVERSAL_ENABLED=false: 기존 동작. 연결 행과 수납 행 삭제.
   * - true: 원 행을 보존하고 음수 상계 행을 추가한다. 원 수납 행과 연결 행에는 reversedBy 를 기록하고,
   *   유효 합계 조회는 isActivePayment / isActiveDepositLink 로 상계 쌍을 제외한다.
   * billingId 가 없는 선수금 수납 행은 FK(billings) 제약상 상계 행을 만들 수 없어 기존 삭제 동작을 유지한다.
   */
  const reversePaymentRecord = (payment: Payment, links: PaymentDepositLink[], reason: string) => {
    if (!PAYMENT_REVERSAL_ENABLED || !payment.billingId) {
      links.forEach(l => db.deleteRow('paymentDepositLinks', l.id));
      db.deleteRow('payments', payment.id);
      return;
    }
    const nowIso = new Date().toISOString();
    const revId = `pay-reversal-${payment.id}`;
    const actor = currentUser?.name || '미식별';
    db.insertRow<Payment>('payments', {
      id: revId,
      billingId: payment.billingId,
      paymentDate: nowIso.split('T')[0],
      amount: -payment.amount,
      method: payment.method,
      memo: `[상계] ${reason} (원 수납 ${payment.id})`,
      reversalOf: payment.id,
      reversalReason: reason,
      reversedByUser: actor,
      reversedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    } as Payment);
    links.forEach(l => {
      const negId = `pdl-reversal-${l.id}`;
      db.insertRow<PaymentDepositLink>('paymentDepositLinks', {
        id: negId,
        paymentId: revId,
        bankTransactionId: l.bankTransactionId,
        usedAmount: -l.usedAmount,
        reversalOf: l.id,
        createdAt: nowIso
      } as PaymentDepositLink);
      db.updateRow<PaymentDepositLink>('paymentDepositLinks', l.id, { reversedBy: negId } as any);
    });
    db.updateRow<Payment>('payments', payment.id, {
      reversedBy: revId,
      reversalReason: reason,
      reversedByUser: actor,
      reversedAt: nowIso,
      updatedAt: nowIso
    } as any);
  };

  const cancelBilling = async (billingId: string, refund: boolean = false) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) return;

    if (billing.parentBillingId) {
      throw new Error('분할 생성된 청구서는 단독으로 취소할 수 없습니다. 원본 청구서를 취소하면 일괄 취소됩니다.');
    }

    const children = db.billings.filter(b => b.parentBillingId === billingId && b.status !== 'REJECTED');
    if (children.length > 0) {
      if (children.some(c => c.status === 'PAID' || c.status === 'PARTIAL')) {
        throw new Error('분할된 청구서 중 수납이 진행된 건이 있어 원본을 취소할 수 없습니다. 수납을 먼저 취소해주세요.');
      }
      for (const c of children) {
        db.updateRow<Billing>('billings', c.id, {
          status: 'REJECTED',
          rejectReason: '원본 청구서 취소에 따른 분할 청구 일괄 취소',
          updatedAt: new Date().toISOString()
        });
      }
    }
    const details = db.billingDetails.filter(bd => bd.billingId === billingId);

    // 선수금·누적렌탈료 롤백
    details.forEach(bd => {
      if (bd.itemName === '선수금(예치금) 차감 반영') {
        const customer = db.customers.find(c => c.id === billing.customerId);
        if (customer) {
          db.updateRow<Customer>('customers', customer.id, {
            prepaidBalance: (customer.prepaidBalance || 0) + Math.abs(bd.amount),
            updatedAt: new Date().toISOString()
          } as any);
        }
      }
      if (bd.contractAssetId) {
        const ca = db.contractAssets.find(x => x.id === bd.contractAssetId);
        if (ca) {
          const assetInfo = db.assets.find(a => a.id === ca.assetId);
          if (assetInfo) {
            db.updateRow<Asset>('assets', assetInfo.id, {
              cumRentalFee: Math.max(0, (assetInfo.cumRentalFee || 0) - bd.amount),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
      // 외상미수금 연동 해제 (billedAmount 롤백)
      if (bd.receivableId) {
        const rcv = db.receivables.find(r => r.id === bd.receivableId);
        if (rcv) {
          const newBilled = Math.max(0, rcv.billedAmount - bd.amount);
          db.updateRow<Receivable>('receivables', rcv.id, {
            billedAmount: newBilled,
            status: newBilled <= 0 ? 'PENDING' : newBilled < rcv.totalAmount ? 'PARTIAL' : 'CLEARED',
            updatedAt: new Date().toISOString()
          });
        }
      }
    });

    if (refund) {
      // 환불 케이스: 수납 취소 + payment_deposit_links 해제
      const linkedPayments = db.payments.filter(p => p.billingId === billingId && isActivePayment(p));
      linkedPayments.forEach(p => {
        const links = db.paymentDepositLinks.filter(l => l.paymentId === p.id && isActiveDepositLink(l));
        // 상계/삭제 전 감사 이력 기록
        if (billing.contractId) {
          const linkSummary = links.length > 0
            ? links.map(l => `${l.bankTransactionId}:${l.usedAmount.toLocaleString()}원`).join(', ')
            : '입금 연결 없음';
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: billing.contractId,
            changeType: 'PAYMENT_CANCELLED',
            changeDate: new Date().toISOString().split('T')[0],
            description: `청구 취소(환불) 수납 ${PAYMENT_REVERSAL_ENABLED ? '상계' : '삭제'}: ${billing.billingYm} 청구 ${billingId} / 수납 ${p.id} ${p.amount.toLocaleString()}원 (${p.paymentDate}, ${p.method}) / 입금 연결: ${linkSummary}`,
            createdAt: new Date().toISOString()
          });
        }
        reversePaymentRecord(p, links, `청구 취소(환불) ${billingId}`);
      });
    }
    // 비환불 케이스: 수납·입금잔액 그대로 유지 → 새 청구 생성 시 FIFO로 자동 연결

    // 공통: 청구 상세 삭제 후 청구 REJECTED 처리 (완전 삭제 대신 이력 보존)
    details.forEach(bd => db.deleteRow('billingDetails', bd.id));
    db.updateRow<Billing>('billings', billingId, {
      status: 'REJECTED',
      updatedAt: new Date().toISOString()
    });

    // 계약이력 기록
    if (billing.contractId) {
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: billing.contractId,
        changeType: 'BILLING_CANCELLED',
        changeDate: new Date().toISOString().split('T')[0],
        description: `청구 취소: ${billing.billingYm} / ${billing.totalAmount.toLocaleString()}원 (${refund ? '환불 처리' : '비환불 처리'}, 청구번호: ${billingId})`,
        createdAt: new Date().toISOString()
      });
      // 💡 청구 취소 시 계약 메타데이터 이전 상태로 롤백 동기화
      syncContractBillingMilestones(billing.contractId);
    }

    await db.awaitPendingWrites(); refreshAllData(); };

  // ─── 외상미수금 CRUD (4단계) ──────────────────────────────────────────────

  /** 외상미수금 신규 등록 */
  const addReceivable = (data: Omit<Receivable, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRcv = db.insertRow<Receivable>('receivables', {
      ...data,
      createdAt: now,
      updatedAt: now
    });
    refreshAllData();
    return newRcv.id;
  };

  /**
   * 입고 자산 파손·불량 상태(증상별 사진 최대 2장, 증상별 예상 수리비용)를
   * 외상미수금 대장에 1개의 청구건으로 통합 기록하고 영업사원에게 전달/협상 Todo를 발행한다.
   */
  const registerInboundDefectClaimReceivable = async (payload: {
    existingReceivableId?: string;
    assetId?: string;
    assetNo: string;
    modelName?: string;
    ownerType?: 'OWN' | 'RENTED';
    vendorName?: string;
    customerId?: string;
    customerName: string;
    siteId?: string;
    siteName: string;
    siteAddress?: string;
    contractId?: string;
    contractNo?: string;
    outboundDate?: string;
    inboundDate: string;
    billingDay?: number;
    salespersonId?: string;
    salespersonName?: string;
    customerContactName?: string;
    customerPhone?: string;
    customerEmail?: string;
    inspectorMemo?: string;
    defectItems: InboundClaimDefectItem[];
    negotiationMemo?: string;
  }): Promise<string> => {
    const now = new Date().toISOString();
    const sanitizedDefectItems: InboundClaimDefectItem[] = (payload.defectItems || []).map((item, idx) => ({
      id: item.id || `DEF-${idx + 1}`,
      checkitemId: item.checkitemId || undefined,
      category: (item.category || '입고불량').trim(),
      symptomName: (item.symptomName || `불량 증상 ${idx + 1}`).trim(),
      estimatedCost: Math.max(0, Math.round(Number(item.estimatedCost) || 0)),
      agreedCost: Math.max(
        0,
        Math.round(Number(item.agreedCost !== undefined ? item.agreedCost : item.estimatedCost) || 0)
      ),
      photos: Array.isArray(item.photos) ? item.photos.filter(Boolean).slice(0, 2) : [],
      memo: (item.memo || '').trim()
    }));

    if (sanitizedDefectItems.length === 0) {
      throw new Error('최소 1개 이상의 불량 증상을 입력해 주십시오.');
    }

    const initialEstimatedAmount = sanitizedDefectItems.reduce(
      (sum, item) => sum + (item.estimatedCost || 0),
      0
    );
    const allPhotos = sanitizedDefectItems.flatMap(item => item.photos || []);

    const existingRcv = payload.existingReceivableId
      ? db.receivables.find(r => r.id === payload.existingReceivableId)
      : undefined;
    const receivableId = existingRcv ? existingRcv.id : db.generateNextId('RCV', db.receivables);
    const existingRepair = existingRcv?.repairId
      ? db.repairs.find(r => r.id === existingRcv.repairId)
      : undefined;
    const repairId = existingRepair ? existingRepair.id : db.generateNextId('RPR', db.repairs);

    // 자산번호 기준으로 누락된 계약/현장/고객 연락처/임차처 컨텍스트 자동 보완
    const autoLookup = lookupRecentInboundInfoByAsset(payload.assetNo, {
      assets: db.assets,
      assetInOutLogs: db.assetInOutLogs,
      contractAssets: db.contractAssets,
      contracts: db.contracts,
      deliveries: db.deliveries,
      repairs: db.repairs,
      customers: db.customers,
      sites: db.sites,
      users: db.users,
      vendors: db.vendors
    });

    const resolvedInspectorMemo = (payload.inspectorMemo ?? payload.negotiationMemo ?? '').trim();
    const displayName = `[수리비 청구] ${payload.assetNo} 입고 파손·불량 수리비 (${sanitizedDefectItems.length}건)`;

    const claimMeta: InboundDefectClaimMeta = {
      kind: 'INBOUND_DEFECT_CLAIM_V1',
      receivableId,
      repairId,
      assetId: payload.assetId || autoLookup?.assetId,
      assetNo: payload.assetNo,
      modelName: payload.modelName || autoLookup?.modelName || '',
      ownerType: payload.ownerType || autoLookup?.ownerType || 'OWN',
      vendorName: payload.vendorName || autoLookup?.vendorName || undefined,
      customerId: payload.customerId || autoLookup?.customerId,
      customerName: payload.customerName || autoLookup?.customerName || '미지정 고객',
      siteId: payload.siteId || autoLookup?.siteId,
      siteName: payload.siteName || autoLookup?.siteName || '미지정 현장',
      siteAddress: payload.siteAddress || autoLookup?.siteAddress || '',
      contractId: payload.contractId || autoLookup?.contractId,
      contractNo: payload.contractNo || autoLookup?.contractNo,
      outboundDate: payload.outboundDate || autoLookup?.outboundDate || undefined,
      inboundDate: payload.inboundDate || autoLookup?.inboundDate || now.slice(0, 10),
      billingDay: payload.billingDay || autoLookup?.billingDay,
      salespersonId: payload.salespersonId || autoLookup?.salespersonId,
      salespersonName: payload.salespersonName || autoLookup?.salespersonName,
      customerContactName: payload.customerContactName || autoLookup?.customerContactName || undefined,
      customerPhone: payload.customerPhone || autoLookup?.customerPhone || undefined,
      customerEmail: payload.customerEmail || autoLookup?.customerEmail || undefined,
      registeredById: currentUser?.id,
      registeredByName: currentUser?.name || '출고팀',
      registeredAt: existingRcv?.createdAt || now,
      inspectorMemo: resolvedInspectorMemo,
      displayName,
      initialEstimatedAmount,
      agreedAmount: initialEstimatedAmount,
      negotiationStatus: 'PENDING_NEGOTIATION',
      negotiationMemo: payload.negotiationMemo || '',
      defectItems: sanitizedDefectItems
    };

    const symptomSummaryText = sanitizedDefectItems
      .map(d => `${d.symptomName}(₩${(d.estimatedCost || 0).toLocaleString()})`)
      .join(', ');

    const internalDescription = `[입고불량 수리비] ${payload.assetNo} (${claimMeta.customerName} / ${claimMeta.siteName}) - ${symptomSummaryText}`;

    // 1. 연결된 Repair 레코드를 먼저 생성/갱신하여 FK(receivables.repairId -> repairs.id) 무결성 및 defectsJson 영속성 보장
    if (existingRepair) {
      db.updateRow<Repair>('repairs', repairId, {
        assetId: payload.assetId || existingRepair.assetId,
        assetNo: payload.assetNo,
        modelName: payload.modelName || existingRepair.modelName,
        contractId: payload.contractId || existingRepair.contractId,
        customerId: payload.customerId || existingRepair.customerId,
        customerName: payload.customerName || existingRepair.customerName,
        siteId: payload.siteId || existingRepair.siteId,
        siteName: payload.siteName || existingRepair.siteName,
        issueCategory: sanitizedDefectItems[0]?.category || '입고불량',
        issueDescription: internalDescription,
        billableType: 'BILLABLE',
        billableAmount: initialEstimatedAmount,
        billableToCustomer: true,
        isCustomerFault: true,
        evidenceImages: allPhotos,
        defectsJson: JSON.stringify(claimMeta),
        memo: payload.negotiationMemo || existingRepair.memo,
        updatedAt: now
      } as any);
    } else {
      db.insertRow<Repair>('repairs', {
        id: repairId,
        ticketNo: repairId,
        workCategory: 'YARD_INTERNAL',
        workLocation: 'YARD',
        stockSource: 'YARD_STOCK',
        source: 'INBOUND_INSPECTION',
        repairType: 'INTERNAL',
        priority: 'URGENT',
        assetId: payload.assetId || undefined,
        assetNo: payload.assetNo,
        modelName: payload.modelName || undefined,
        contractId: payload.contractId || undefined,
        customerId: payload.customerId || undefined,
        customerName: payload.customerName || undefined,
        siteId: payload.siteId || undefined,
        siteName: payload.siteName || undefined,
        reporterName: currentUser?.name || '출고팀',
        issueCategory: sanitizedDefectItems[0]?.category || '입고불량',
        degradationScore: 0,
        issueDescription: internalDescription,
        requestDate: payload.inboundDate || now.slice(0, 10),
        status: 'REQUESTED',
        partsUsed: [],
        collectedParts: [],
        consumables: [],
        timelineLogs: [],
        timelineEvents: [],
        billableType: 'BILLABLE',
        billableAmount: initialEstimatedAmount,
        billableToCustomer: true,
        totalCost: initialEstimatedAmount,
        costTotal: initialEstimatedAmount,
        isCustomerFault: true,
        isWaived: false,
        waivedAmount: 0,
        evidenceImages: allPhotos,
        defectsJson: JSON.stringify(claimMeta),
        memo: payload.negotiationMemo || '',
        createdAt: now,
        updatedAt: now
      } as any);
    }

    // 2. 외상미수금 대장에 1개의 청구건(Receivable)으로 기록
    const finalTotalAmount = Math.max(existingRcv?.billedAmount || 0, initialEstimatedAmount);
    if (existingRcv) {
      db.updateRow<Receivable>('receivables', receivableId, {
        contractId: payload.contractId || existingRcv.contractId,
        customerId: payload.customerId || existingRcv.customerId,
        assetNo: payload.assetNo,
        type: 'REPAIR',
        totalAmount: finalTotalAmount,
        internalDescription,
        displayName,
        occurredDate: payload.inboundDate || existingRcv.occurredDate || now.slice(0, 10),
        repairId,
        claimMeta,
        updatedAt: now
      });
    } else {
      db.insertRow<Receivable>('receivables', {
        id: receivableId,
        contractId: payload.contractId || undefined,
        customerId: payload.customerId || undefined,
        assetNo: payload.assetNo,
        type: 'REPAIR',
        totalAmount: finalTotalAmount,
        billedAmount: 0,
        internalDescription,
        displayName,
        occurredDate: payload.inboundDate || now.slice(0, 10),
        status: 'PENDING',
        repairId,
        claimMeta,
        createdAt: now,
        updatedAt: now
      });
    }

    saveLocalClaimMetaCache(receivableId, claimMeta);

    // 3. 영업사원에게 파손 수리비 고객 전달 및 협상 Todo 발행
    await issueHandoverTask({
      category: 'CLAIM_DAMAGE_BILLING',
      title: `[입고불량 수리비 협상·전달] ${payload.customerName} (${payload.siteName}) - ${payload.assetNo}`,
      content: `입고 불량 증상 ${sanitizedDefectItems.length}건(예상 수리비 ₩${initialEstimatedAmount.toLocaleString()})이 등록되었습니다. PDF 내역서를 고객에게 전달(이메일/카톡)하고 수리비를 합의해 주십시오.`,
      priority: 'HIGH',
      targetDept: 'SALES',
      assignedUserId: payload.salespersonId || undefined,
      dueDate: now.slice(0, 10),
      actionUrl: '/receivables',
      entityType: 'RECEIVABLE',
      entityId: receivableId,
      senderId: currentUser?.id,
      senderName: currentUser?.name || '출고팀'
    });

    await db.awaitPendingWrites();
    refreshAllData();
    return receivableId;
  };

  /**
   * 영업사원의 고객 전달(이메일/카톡), 수리비 협상 조정 및 최종 합의 완료 처리
   * 최종 합의 완료 시 외상미수금액(totalAmount)을 합의 금액으로 확정하고 청구담당자에게 Todo를 발행한다.
   */
  const updateReceivableClaimNegotiation = async (payload: {
    receivableId: string;
    agreedAmount: number;
    negotiationStatus: ClaimNegotiationStatus;
    defectItems?: InboundClaimDefectItem[];
    negotiationMemo?: string;
    displayName?: string;
    sentChannel?: 'EMAIL' | 'KAKAO_SHARE' | 'PDF_DOWNLOAD';
    sentToEmail?: string;
  }): Promise<void> => {
    const rcv = db.receivables.find(r => r.id === payload.receivableId);
    if (!rcv) {
      throw new Error('대상 외상미수금 청구건을 찾을 수 없습니다.');
    }

    const now = new Date().toISOString();
    const currentMeta = resolveReceivableClaimMeta(rcv, {
      repairs: db.repairs,
      assets: db.assets,
      customers: db.customers,
      sites: db.sites,
      contracts: db.contracts,
      contractAssets: db.contractAssets,
      users: db.users,
      vendors: db.vendors
    });

    const newTotalAmount = Math.max(
      rcv.billedAmount || 0,
      Math.round(Number(payload.agreedAmount) || 0)
    );

    const updatedDefectItems: InboundClaimDefectItem[] = (
      payload.defectItems ||
      currentMeta?.defectItems ||
      []
    ).map((item, idx) => ({
      ...item,
      id: item.id || `DEF-${idx + 1}`,
      photos: Array.isArray(item.photos) ? item.photos.filter(Boolean).slice(0, 2) : [],
      estimatedCost: Math.max(0, Math.round(Number(item.estimatedCost) || 0)),
      agreedCost:
        item.agreedCost !== undefined
          ? Math.max(0, Math.round(Number(item.agreedCost) || 0))
          : Math.max(0, Math.round(Number(item.estimatedCost) || 0))
    }));

    const updatedDisplayName =
      payload.displayName?.trim()
        ? payload.displayName.trim()
        : payload.negotiationStatus === 'AGREED'
          ? `[수리비 합의완료] ${currentMeta?.assetNo || rcv.assetNo || ''} 입고 파손·불량 수리비 (${updatedDefectItems.length}건)`
          : rcv.displayName;

    const updatedMeta: InboundDefectClaimMeta = {
      ...currentMeta,
      kind: 'INBOUND_DEFECT_CLAIM_V1',
      receivableId: rcv.id,
      repairId: rcv.repairId || currentMeta?.repairId,
      assetId: currentMeta?.assetId,
      assetNo: rcv.assetNo || currentMeta?.assetNo || '',
      modelName: currentMeta?.modelName || '',
      ownerType: currentMeta?.ownerType,
      vendorName: currentMeta?.vendorName,
      customerId: rcv.customerId || currentMeta?.customerId,
      customerName: currentMeta?.customerName || '미지정 고객',
      siteId: currentMeta?.siteId,
      siteName: currentMeta?.siteName || '미지정 현장',
      siteAddress: currentMeta?.siteAddress,
      contractId: rcv.contractId || currentMeta?.contractId,
      contractNo: currentMeta?.contractNo,
      outboundDate: currentMeta?.outboundDate,
      inboundDate: currentMeta?.inboundDate || rcv.occurredDate,
      billingDay: currentMeta?.billingDay,
      salespersonId: currentMeta?.salespersonId,
      salespersonName: currentMeta?.salespersonName,
      customerContactName: currentMeta?.customerContactName,
      customerPhone: currentMeta?.customerPhone,
      customerEmail: currentMeta?.customerEmail,
      registeredById: currentMeta?.registeredById,
      registeredByName: currentMeta?.registeredByName,
      registeredAt: currentMeta?.registeredAt || rcv.createdAt,
      inspectorMemo: currentMeta?.inspectorMemo,
      displayName: updatedDisplayName,
      initialEstimatedAmount:
        currentMeta?.initialEstimatedAmount !== undefined
          ? currentMeta.initialEstimatedAmount
          : rcv.totalAmount,
      agreedAmount: newTotalAmount,
      negotiationStatus: payload.negotiationStatus,
      sentAt: payload.sentChannel ? now : currentMeta?.sentAt,
      sentChannel: payload.sentChannel || currentMeta?.sentChannel,
      sentToEmail: payload.sentToEmail || currentMeta?.sentToEmail,
      agreedAt: payload.negotiationStatus === 'AGREED' ? now : currentMeta?.agreedAt,
      agreedBy:
        payload.negotiationStatus === 'AGREED'
          ? currentUser?.name || '영업담당자'
          : currentMeta?.agreedBy,
      negotiationMemo:
        payload.negotiationMemo !== undefined
          ? payload.negotiationMemo
          : currentMeta?.negotiationMemo || '',
      defectItems: updatedDefectItems
    };

    // 연결된 Repair 업데이트
    if (rcv.repairId) {
      const existingRepair = db.repairs.find(r => r.id === rcv.repairId);
      if (existingRepair) {
        db.updateRow<Repair>('repairs', rcv.repairId, {
          billableAmount: newTotalAmount,
          defectsJson: JSON.stringify(updatedMeta),
          memo: updatedMeta.negotiationMemo || updatedMeta.inspectorMemo || existingRepair.memo,
          updatedAt: now
        } as any);
      }
    }

    db.updateRow<Receivable>('receivables', rcv.id, {
      totalAmount: newTotalAmount,
      displayName: updatedDisplayName,
      claimMeta: updatedMeta,
      status:
        newTotalAmount <= (rcv.billedAmount || 0) && newTotalAmount > 0
          ? 'CLEARED'
          : (rcv.billedAmount || 0) > 0
            ? 'PARTIAL'
            : 'PENDING',
      updatedAt: now
    });

    saveLocalClaimMetaCache(rcv.id, updatedMeta);

    // 최종 합의 완료 시 영업부 협상 Todo 마감 및 청구담당자(ACCOUNTING)에게 당월 청구 반영 Todo 발행
    if (payload.negotiationStatus === 'AGREED') {
      await clearHandoverTasks({
        entityId: rcv.id,
        category: 'CLAIM_DAMAGE_BILLING',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name || '영업담당자',
        completionAction: '입고 불량 수리비 고객 최종 합의 완료'
      });
      if (rcv.repairId) {
        await clearHandoverTasks({
          entityId: rcv.repairId,
          category: 'CLAIM_DAMAGE_BILLING',
          completedByUserId: currentUser?.id,
          completedByName: currentUser?.name || '영업담당자',
          completionAction: '입고 불량 수리비 고객 최종 합의 완료'
        });
      }

      await issueHandoverTask({
        category: 'BILLABLE_REPAIR_BILLING',
        title: `[당월 청구 반영] ${updatedMeta.customerName} (${updatedMeta.siteName}) - ${updatedMeta.assetNo} 합의 수리비 ₩${newTotalAmount.toLocaleString()}`,
        content: `고객과 최종 합의된 입고 파손·불량 수리비(₩${newTotalAmount.toLocaleString()})가 외상미수금 대장에 확정되었습니다. 당월 청구 업무 시 포함하여 진행해 주십시오.`,
        priority: 'HIGH',
        targetDept: 'ACCOUNTING',
        dueDate: now.slice(0, 10),
        actionUrl: '/billings',
        entityType: 'RECEIVABLE',
        entityId: rcv.id,
        senderId: currentUser?.id,
        senderName: currentUser?.name || '영업담당자'
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  /** 외상미수금 → 청구 상세 연동 (이번 달 청구할 금액 지정) */
    const linkReceivableToBilling = async (
    billingId: string,
    receivableId: string,
    amount: number,
    displayName?: string
  ) => {
    const rcv = db.receivables.find(r => r.id === receivableId);
    if (!rcv) throw new Error('외상미수금 항목을 찾을 수 없습니다.');

    const remaining = rcv.totalAmount - rcv.billedAmount;
    if (amount > remaining + 1) { // 부동소수점 오차 허용
      throw new Error(`청구 금액(${amount.toLocaleString()}원)이 미청구 잔액(${remaining.toLocaleString()}원)을 초과합니다.`);
    }

    const newBilled = rcv.billedAmount + amount;
    const newRemaining = rcv.totalAmount - newBilled;
    
    // K-3: 고객 투명성 확보를 위한 강제 트래커 텍스트 생성
    const trackerText = `[총 청구대상: ${rcv.totalAmount.toLocaleString()}원 / 금회 청구: ${amount.toLocaleString()}원 / 미청구 잔액: ${Math.max(0, newRemaining).toLocaleString()}원]`;

    const now = new Date().toISOString();
    db.insertRow<BillingDetail>('billingDetails', {
      billingId,
      receivableId,
      itemName: displayName || rcv.internalDescription,
      quantity: 1,
      unitPrice: amount,
      amount,
      description: trackerText,
      internalDescription: rcv.internalDescription,
      displayName: displayName || rcv.displayName,
      createdAt: now,
      updatedAt: now
    });

    db.updateRow<Receivable>('receivables', receivableId, {
      billedAmount: newBilled,
      status: newBilled >= rcv.totalAmount ? 'CLEARED' : 'PARTIAL',
      updatedAt: now
    });

    // 청구서 총액 갱신
    const billing = db.billings.find(b => b.id === billingId);
    if (billing) {
      db.updateRow<Billing>('billings', billingId, {
        totalAmount: billing.totalAmount + amount,
        updatedAt: now
      });
    }

    await db.awaitPendingWrites(); refreshAllData(); };

  /** K-2: 외상미수금 단독 청구서 발행 (수금 기동성 및 진상고객 방어) */
  const generateStandaloneBillingForReceivable = async (receivableId: string, reason: string): Promise<string> => {
    const rcv = db.receivables.find(r => r.id === receivableId);
    if (!rcv) throw new Error('외상미수금 항목을 찾을 수 없습니다.');
    if (rcv.status === 'CLEARED') throw new Error('이미 청구가 완료된 건입니다.');
    if (!rcv.customerId) throw new Error('고객 정보가 없는 미수금은 단독 청구할 수 없습니다.');

    const remaining = rcv.totalAmount - rcv.billedAmount;
    const now = new Date().toISOString();
    const billingYm = now.substring(0, 7);
    const billingDate = now.split('T')[0];

    // 결정: rcv.type에 따라 적절한 billingType 매핑 (Gap 2 방어)
    let bType: BillingType = 'REPAIR';
    if (rcv.type === 'TRANSPORT') bType = 'TRANSPORT';
    else if (rcv.type === 'CLEANING' || rcv.type === 'REPAIR') bType = 'REPAIR';
    else if (rcv.type === 'VENDOR_CLAIM' || rcv.type === 'OTHER') bType = 'REPAIR';

    const newBilling = db.insertRow<Billing>('billings', {
      billingType: bType,
      customerId: rcv.customerId,
      contractId: rcv.contractId || (null as any),
      billingYm,
      billingDate,
      totalAmount: 0, // linkReceivableToBilling이 갱신함
      paidAmount: 0,
      status: 'UNPAID',
      createdAt: now,
      updatedAt: now
    });

    await db.awaitPendingWrites();

    const standaloneTitle = `[단독 청구 - ${reason}] ${rcv.displayName || rcv.internalDescription}`;
    await linkReceivableToBilling(newBilling.id, rcv.id, remaining, standaloneTitle);
    
    return newBilling.id;
  };

  const getDueContractsForBilling = (targetDate?: string) => {
    const todayStr = targetDate || new Date().toISOString().split('T')[0];
    const [year, month, day] = todayStr.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const liveContracts = db.contracts.filter(c => {
      if ((c.contractType || 'RENTAL') !== 'RENTAL') return false; 
      if (c.status === 'COMPLETED' && c.lastBilledPeriodEnd && c.endDate && c.endDate !== '미정' && c.lastBilledPeriodEnd >= c.endDate) return false;
      const cStart = new Date(c.startDate);
      if (cStart > endOfMonth) return false;
      if (c.endDate && c.endDate !== '미정') {
        const cEnd = new Date(c.endDate);
        if (cEnd < startOfMonth) return false;
      }
      return true;
    });

    const dueList: { contract: Contract; customer: Customer; site?: CustomerSite; billingDay: number; dueReason: string; targetYm?: string }[] = [];

    liveContracts.forEach(c => {
      const cust = db.customers.find(cu => cu.id === c.customerId);
      if (!cust) return;
      const site = db.sites.find(s => s.id === c.siteId);

      const [sYear, sMonth] = c.startDate.split('-').map(Number);
      let curY = sYear;
      let curM = sMonth;
      
      let foundDueYm = null;
      let reason = '';

      while (curY < year || (curY === year && curM <= month)) {
        const checkYm = `${curY}-${String(curM).padStart(2, '0')}`;
        const lastDayOfCheckMonth = new Date(curY, curM, 0).getDate();
        
        const rawBillingDay = c.billingDay || cust.defaultBillingDay || 31;
        const rawStatementDay = c.statementClosingDay || cust.defaultStatementClosingDay || rawBillingDay;
        const effectiveBillingDay = Math.min(rawBillingDay, lastDayOfCheckMonth);
        const effectiveStatementDay = Math.min(rawStatementDay, lastDayOfCheckMonth);
        const triggerDay = Math.min(effectiveBillingDay, effectiveStatementDay);

        const closingDateStr = `${curY}-${String(curM).padStart(2, '0')}-${String(triggerDay).padStart(2, '0')}`;
        if (c.startDate > closingDateStr) {
           curM++;
           if (curM > 12) { curY++; curM = 1; }
           continue;
        }

        const existingBilling = db.billings.find(b => 
          b.contractId === c.id && 
          b.billingYm === checkYm && 
          (b.billingType === 'RENTAL' || !b.billingType) && 
          b.status !== 'REJECTED'
        );

        if (!existingBilling) {
          let isDue = false;
          if (curY < year || (curY === year && curM < month)) {
            isDue = true;
            reason = `이전 미청구월 누락분 자동 감지 (${checkYm})`;
          } else if (curY === year && curM === month) {
            if (day >= triggerDay) {
              isDue = true;
              reason = `청구기준일(매월 ${rawBillingDay}일) 도래`;
            }
          }

          if (isDue) {
            foundDueYm = checkYm;
            break;
          }
        }

        curM++;
        if (curM > 12) { curY++; curM = 1; }
      }

      if (foundDueYm) {
        dueList.push({
          contract: c,
          customer: cust,
          site,
          billingDay: c.billingDay || cust.defaultBillingDay || 31,
          dueReason: reason,
          targetYm: foundDueYm
        });
      }
    });

    return dueList;
  };

  /**
   * billingDay 기반 청구 기간 계산 (인터뷰 원칙 A-1 ~ A-5, B-1 ~ B-4)
   * - billingDay = 청구서 발행일 (예: 25 → 전월26~당월25)
   * - 첫 달 / 마지막 달만 일할, 중간 달 정액
   * - billingDay > 월말이면 월말로 자동 보정
   */
  const calcBillingPeriod = (
    billingYm: string,
    billingDay: number,
    contractStartDate: string,
    contractEndDate?: string
  ) => {
    const [year, month] = billingYm.split('-').map(Number);

    // 당월 billingDay 보정 (A-5, UTC 기준)
    const lastDayOfCurrent = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const effectiveBillingDay = Math.min(billingDay, lastDayOfCurrent);

    // 청구 기간 끝: 당월 billingDay
    const periodEnd = new Date(Date.UTC(year, month - 1, effectiveBillingDay));

    // 청구 기간 시작: 전월일
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const lastDayOfPrev = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const prevEffectiveBillingDay = Math.min(billingDay, lastDayOfPrev);
    const periodStart = new Date(Date.UTC(prevYear, prevMonth - 1, prevEffectiveBillingDay + 1));

    // 실제 자산 사용 기간: 계약 startDate 보정
    const contractStart = new Date(contractStartDate.includes('T') ? contractStartDate : `${contractStartDate}T00:00:00Z`);
    const actualStart = contractStart > periodStart ? contractStart : periodStart;

    // 실제 자산 사용 기간: 계약 endDate 보정
    const contractEnd = contractEndDate ? new Date(contractEndDate.includes('T') ? contractEndDate : `${contractEndDate}T00:00:00Z`) : null;
    const actualEnd = contractEnd && contractEnd < periodEnd ? contractEnd : periodEnd;

    // 첫 달 / 마지막 달 판단 → 일할 계산 여부
    const isFirstMonth = contractStart > periodStart && contractStart <= periodEnd;
    const isLastMonth = contractEnd
      ? contractEnd >= periodStart && contractEnd <= periodEnd
      : false;
    const isProRata = isFirstMonth || isLastMonth;

    return { actualStart, actualEnd, periodStart, periodEnd, isProRata };
  };

  /**
   * 일할 금액 계산 (B-1: 30일 고정, 역일 기준, 1,000원 단위 반올림 업계 전사 표준)
   */
  const calcProRataAmount = (monthlyFee: number, dailyFee: number, days: number): number => {
    if (dailyFee > 0) {
      return Math.round((dailyFee * days) / 1000) * 1000;
    }
    return Math.round(((monthlyFee / 30) * days) / 1000) * 1000;
  };

  /**
   * 💡 계약별 직전 청구 마일스톤 메타데이터 동기화 (트리거 갱신 및 백필)
   * - 최근 렌탈료 청구 발행일
   * - 최근 청구 시작일
   * - 최근 청구 종료일
   * - 최근 청구 귀속월
   * - 누적 발행 청구 건수
   */
  const syncContractBillingMilestones = (contractId?: string) => {
    const targetContracts = contractId 
      ? db.contracts.filter(c => c.id === contractId) 
      : db.contracts;

    targetContracts.forEach(c => {
      const activeBillings = db.billings
        .filter(b => b.contractId === c.id && b.status !== 'REJECTED' && (!b.billingType || b.billingType === 'RENTAL'))
        .sort((a, b) => (b.billingYm || '').localeCompare(a.billingYm || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

      const count = activeBillings.length;
      if (count === 0) {
        db.updateRow<Contract>('contracts', c.id, {
          lastBillingDate: undefined,
          lastBilledPeriodStart: undefined,
          lastBilledPeriodEnd: undefined,
          lastBilledYm: undefined,
          billingCount: 0,
          updatedAt: new Date().toISOString()
        } as any);
        return;
      }

      const latestBilling = activeBillings[0];
      const sameYmBillings = activeBillings.filter(b => b.billingYm === latestBilling.billingYm);
      const sameYmBillingIds = new Set(sameYmBillings.map(b => b.id));
      const sameYmRentalDetails = db.billingDetails.filter(bd => sameYmBillingIds.has(bd.billingId) && bd.contractAssetId);

      let parsedStart = '';
      let parsedEnd = '';
      sameYmRentalDetails.forEach(bd => {
        const m = (bd.description || '').match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
        if (m) {
          if (!parsedStart || m[1] < parsedStart) parsedStart = m[1];
          if (!parsedEnd || m[2] > parsedEnd) parsedEnd = m[2];
        }
      });

      let startIso = parsedStart;
      let endIso = parsedEnd;
      if (!startIso || !endIso) {
        const billingDay = c.billingDay || 25;
        const { actualStart, actualEnd } = calcBillingPeriod(
          latestBilling.billingYm,
          billingDay,
          c.startDate,
          c.endDate
        );
        startIso = actualStart.toISOString().split('T')[0];
        endIso = actualEnd.toISOString().split('T')[0];
      }

      db.updateRow<Contract>('contracts', c.id, {
        lastBillingDate: latestBilling.billingDate || latestBilling.createdAt?.split('T')[0],
        lastBilledPeriodStart: startIso,
        lastBilledPeriodEnd: endIso,
        lastBilledYm: latestBilling.billingYm,
        billingCount: count,
        updatedAt: new Date().toISOString()
      });
    });
  };

  const generateBillingForSingleContract = async (contractId: string, billingYm: string, billingDate: string, selectedContractAssetIds?: string[]): Promise<string | null> => {
    const c = db.contracts.find(x => x.id === contractId);
    if (!c) return null;

    if ((c.contractType || 'RENTAL') !== 'RENTAL') {
      throw new Error(`[계약 유형 오류] 계약 ${c.contractNo}는 자산 매각 계약입니다. 월 정기 렌탈료 청구 대상이 아닙니다.`);
    }

    // 중복 발행 감지: 동일 계약 + 동일 귀속월 활성 청구 존재 시 throw (부분 청구 또는 기간 연장 후 추가 정산 건은 제외)
    const existingActive = db.billings.find(
      b => b.contractId === c.id && b.billingYm === billingYm && b.status !== 'REJECTED' && !b.isPartial
    );
    const hasUnbilledExtension = Boolean(
      existingActive &&
      c.lastBilledPeriodEnd &&
      c.endDate &&
      c.endDate !== '미정' &&
      c.lastBilledPeriodEnd < c.endDate
    );
    if (existingActive && !selectedContractAssetIds && !hasUnbilledExtension) {
      throw new Error(`[중복 경고] 계약 ${c.contractNo}의 ${billingYm} 청구서가 이미 존재합니다.\n상태: ${existingActive.status} / ID: ${existingActive.id}`);
    }

    const cust = db.customers.find(cu => cu.id === c.customerId);
    const billingDay = c.billingDay || cust?.defaultBillingDay || 25;
    const allCAssets = db.contractAssets.filter(ca => ca.contractId === c.id);
    // 부분 청구 시: 선택된 자산 ID만 필터링, 전체 청구 시: 전체 자산
    const cAssets = selectedContractAssetIds
      ? allCAssets.filter(ca => selectedContractAssetIds.includes(ca.id))
      : allCAssets;
    const isPartialBilling = !!(selectedContractAssetIds && selectedContractAssetIds.length < allCAssets.length);

    let detailsList: Omit<BillingDetail, 'id' | 'billingId' | 'createdAt'>[] = [];
    let totalAmount = 0;

    // 직전 청구 종료일 익일 계산 (동일 월 내 기간 연장 후 추가 정산 시 중복 청구 방지)
    let nextDayAfterLastBilled = '';
    if (hasUnbilledExtension && c.lastBilledPeriodEnd) {
      const [py, pm, pd] = c.lastBilledPeriodEnd.slice(0, 10).split('-').map(Number);
      const nextObj = new Date(Date.UTC(py, pm - 1, pd + 1));
      nextDayAfterLastBilled = nextObj.toISOString().split('T')[0];
    }

    // 1. 자산별 렌탈료 계산 (인터뷰 원칙 A, B, C 통합 적용)
    cAssets.forEach(ca => {
      const effectiveCaStart = (nextDayAfterLastBilled && nextDayAfterLastBilled > ca.startDate)
        ? nextDayAfterLastBilled
        : ca.startDate;
      const effectiveCaEnd = (ca.status === 'RETURNED' && ca.actualReturnDate && ca.actualReturnDate !== '미정')
        ? (ca.endDate && ca.endDate !== '미정' && ca.endDate > ca.actualReturnDate ? ca.endDate : ca.actualReturnDate)
        : (ca.endDate && ca.endDate !== '미정' ? ca.endDate : c.endDate);

      const { actualStart, actualEnd, isProRata } = calcBillingPeriod(
        billingYm,
        billingDay,
        effectiveCaStart,
        effectiveCaEnd
      );

      if (actualStart > actualEnd) return; // 청구 기간 외 자산

      const assetInfo = db.assets.find(a => a.id === ca.assetId);
      const assetName = assetInfo
        ? `${assetInfo.modelName} (관리번호: ${assetInfo.assetNo})`
        : '렌탈 장비';

      let rentalCost = 0;
      let calcDesc = '';

      if (isProRata) {
        // 일할 계산: 30일 고정, 역일 기준
        const diffMs = actualEnd.getTime() - actualStart.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        rentalCost = calcProRataAmount(ca.monthlyRentalFee, ca.dailyRentalFee, days);
        calcDesc = `${actualStart.toISOString().split('T')[0]} ~ ${actualEnd.toISOString().split('T')[0]} 일할 청구 (${days}일 × ${(ca.dailyRentalFee > 0 ? ca.dailyRentalFee : ca.monthlyRentalFee / 30).toLocaleString()}원)`;
      } else {
        // 중간 달: 월 정액
        rentalCost = ca.monthlyRentalFee;
        const startStr = actualStart.toISOString().split('T')[0];
        const endStr = actualEnd.toISOString().split('T')[0];
        calcDesc = `${startStr} ~ ${endStr} 정기 월렌탈료`;
      }

      if (rentalCost > 0) {
        detailsList.push({
          contractAssetId: ca.id,
          assetId: ca.assetId,
          itemName: `${assetName} 렌탈료`,
          quantity: 1,
          unitPrice: rentalCost,
          amount: rentalCost,
          internalDescription: calcDesc,
          displayName: undefined
        });
        totalAmount += rentalCost;

        if (assetInfo) {
          // 기수 원칙: 청구서 발행(기수) 시점에만 cumRentalFee 누적 — 미수(미발행) 금액 절대 포함 금지
          db.updateRow<Asset>('assets', assetInfo.id, {
            cumRentalFee: (assetInfo.cumRentalFee || 0) + rentalCost,
            updatedAt: new Date().toISOString()
          });
        }
      }
    });

    // 2. 출고 요청 유상 옵션 자동 산출 ('월': 매월 가동 대수 × 단가, '건': 출고 건당 1회, '대': 해당 출고 대수 × 1회)
    const { periodStart: contractPeriodStart, periodEnd: contractPeriodEnd } = calcBillingPeriod(
      billingYm,
      billingDay,
      c.startDate,
      c.endDate
    );
    const periodStartIso = contractPeriodStart.toISOString().split('T')[0];
    const periodEndIso = contractPeriodEnd.toISOString().split('T')[0];

    const paidOptionItems = calculatePaidOptionBillingItems({
      contract: c,
      billingYm,
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
      deliveries: db.deliveries,
      contractAssets: db.contractAssets,
      standardOptions: db.standardOptions,
      billings: db.billings,
      billingDetails: db.billingDetails,
      selectedContractAssetIds,
      sites: db.sites,
      siteMasters: db.siteMasters,
      customers: db.customers,
    });

    paidOptionItems.forEach(optItem => {
      detailsList.push({
        contractAssetId: undefined,
        itemName: optItem.itemName,
        quantity: optItem.quantity,
        unitPrice: optItem.unitPrice,
        amount: optItem.amount,
        description: optItem.description,
        internalDescription: optItem.description,
        displayName: optItem.itemName,
      });
      totalAmount += optItem.amount;
    });

    // 2-1. 수리비 자동 합산 제거 (H-1 원칙: 수리비는 외상미수금 대장으로 분리 관리)
    // → 담당자가 외상미수금 화면에서 수동으로 청구에 포함

    // 3. 선수금(예치금) 차감 반영 — 부분 청구가 아닌 경우에만 자동 차감 (I-1 원칙)
    let finalBillingAmount = totalAmount;
    if (!isPartialBilling && cust && (cust.prepaidBalance || 0) > 0 && totalAmount > 0) {
      const prepaid = cust.prepaidBalance || 0;
      const applied = Math.min(totalAmount, prepaid);
      if (applied > 0) {
        detailsList.push({
          contractAssetId: undefined,
          itemName: '선수금(예치금) 차감 반영',
          quantity: 1,
          unitPrice: -applied,
          amount: -applied,
          internalDescription: `보유 선수금 중 ${applied.toLocaleString()}원 자동 차감`,
          displayName: undefined
        });
        db.updateRow<Customer>('customers', cust.id, {
          prepaidBalance: prepaid - applied,
          updatedAt: new Date().toISOString()
        } as any);
        finalBillingAmount = totalAmount - applied;
      }
    }

    const unbilledTradeReceivables = (db.receivables || []).filter(r => {
      if (
        r.contractId !== c.id ||
        r.status === 'CLEARED' ||
        (r.totalAmount || 0) - (r.billedAmount || 0) <= 0 ||
        !Boolean(r.internalDescription && r.internalDescription.includes('[유통출고:'))
      ) {
        return false;
      }
      const ymMatch = String(r.internalDescription || '').match(/(?:\[귀속월:|·\s*)(\d{4}-\d{2})/);
      const rcvTargetYm = ymMatch ? ymMatch[1] : undefined;
      if (rcvTargetYm && billingYm && rcvTargetYm > billingYm) {
        return false;
      }
      return true;
    });

    if (detailsList.length === 0 && unbilledTradeReceivables.length === 0) return null;

    // 4. 청구서 생성 — 초기 상태 UNPAID (F-2 원칙: 거래명세서 발송 후 REQUESTED로 전환)
    const newBilling = db.insertRow<Billing>('billings', {
      customerId: c.customerId,
      contractId: c.id,
      billingYm,
      billingDate,
      totalAmount: finalBillingAmount,
      paidAmount: 0,
      status: 'UNPAID',
      isPartial: isPartialBilling || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();

    detailsList.forEach(det => {
      db.insertRow<BillingDetail>('billingDetails', {
        ...det,
        billingId: newBilling.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // 5. 계약 연동 유통출고 미청구분이 있으면 당월 청구에 즉시 자동 병합
    for (const rcv of unbilledTradeReceivables) {
      const rem = (rcv.totalAmount || 0) - (rcv.billedAmount || 0);
      if (rem > 0) {
        await linkReceivableToBilling(newBilling.id, rcv.id, rem, rcv.displayName || rcv.internalDescription);
      }
    }

    // 💡 계약 메타데이터 트리거 자동 갱신 (최근 청구 발행일, 시작일, 종료일, 청구건수)
    syncContractBillingMilestones(c.id);

    return newBilling.id;
  };

  const generateDueBillings = async (targetDate?: string, targetYm?: string): Promise<{ successCount: number; skippedContracts: { contractId: string; customerId: string; reason: string }[] }> => {
    try {
      const todayStr = targetDate || new Date().toISOString().split('T')[0];
      const ym = targetYm || todayStr.slice(0, 7);
      const dueContracts = getDueContractsForBilling(todayStr);

      let createdCount = 0;
      const skippedContracts: { contractId: string; customerId: string; reason: string }[] = [];

      for (const item of dueContracts) {
        // K-1: 미청구 외상미수금 존재 여부 체크 (일괄 청구 방어 로직 — 단, 계약 상세에서 당월 청구 합산으로 확정 등록된 [유통출고] 건은 자동 병합하므로 보류 대상에서 제외)
        const hasPendingReceivables = db.receivables.some(r => 
          r.contractId === item.contract.id &&
          r.status !== 'CLEARED' &&
          !(r.internalDescription && r.internalDescription.includes('[유통출고:'))
        );

        if (hasPendingReceivables) {
          skippedContracts.push({
            contractId: item.contract.id,
            customerId: item.customer.id,
            reason: '미청구 외상미수금 존재'
          });
          continue; // 해당 계약은 청구 건너뜀
        }

        const targetMonthlyYm = item.targetYm || ym;
        const bId = await generateBillingForSingleContract(item.contract.id, targetMonthlyYm, todayStr);
        if (bId) createdCount++;
      }

      await db.awaitPendingWrites();
      refreshAllData();
      return { successCount: createdCount, skippedContracts };
    } catch (err: any) {
      showErrorModal(`⚠️ 도래 계약 청구 일괄 생성 실패:\n\n${err?.message || err}`, '청구 생성 오류');
      return { successCount: 0, skippedContracts: [] };
    }
  };

  const regenerateBilling = async (
    billingId: string,
    customDetails?: Omit<BillingDetail, 'id' | 'billingId' | 'createdAt'>[],
    options?: { billingYm?: string; billingDate?: string; memo?: string }
  ): Promise<string> => {
    const oldBilling = db.billings.find(b => b.id === billingId);
    if (!oldBilling) throw new Error('청구서를 찾을 수 없습니다.');
    if (oldBilling.parentBillingId) throw new Error('분할 생성된 청구서는 수정/재생성할 수 없습니다. 취소 후 재발행해 주세요.');
    const regenChildren = db.billings.filter(b => b.parentBillingId === billingId && b.status !== 'REJECTED');
    if (regenChildren.length > 0) throw new Error('이미 분할된 원본 청구서는 수정/재생성할 수 없습니다. 취소 후 재발행해 주세요.');

    // 1. 기존 청구서 롤백 & 상태 REJECTED 마감
    const oldDetails = db.billingDetails.filter(bd => bd.billingId === billingId);
    oldDetails.forEach(bd => {
      if (bd.itemName === '선수금(예치금) 차감 반영') {
        const cust = db.customers.find(c => c.id === oldBilling.customerId);
        if (cust) {
          db.updateRow<Customer>('customers', cust.id, {
            prepaidBalance: (cust.prepaidBalance || 0) + Math.abs(bd.amount),
            updatedAt: new Date().toISOString()
          } as any);
        }
      }
      if (bd.contractAssetId) {
        const ca = db.contractAssets.find(x => x.id === bd.contractAssetId);
        if (ca) {
          const ast = db.assets.find(a => a.id === ca.assetId);
          if (ast) {
            db.updateRow<Asset>('assets', ast.id, {
              cumRentalFee: Math.max(0, (ast.cumRentalFee || 0) - bd.amount),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
      if (bd.receivableId) {
        const rcv = db.receivables.find(r => r.id === bd.receivableId);
        if (rcv) {
          const newBilled = Math.max(0, rcv.billedAmount - (bd.amount || 0));
          db.updateRow<Receivable>('receivables', rcv.id, {
            billedAmount: newBilled,
            status: newBilled === 0 ? 'PENDING' : (newBilled >= rcv.totalAmount ? 'CLEARED' : 'PARTIAL'),
            updatedAt: new Date().toISOString()
          });
        }
      }
    });

    const linkedRepairs = db.repairs.filter(r => r.billingId === billingId);
    const linkedDeliveries = db.deliveries.filter(d => d.billingId === billingId);

    // 기존 청구서 REJECTED 처리 (감사 추적성 보존)
    db.updateRow<Billing>('billings', billingId, {
      status: 'REJECTED',
      rejectReason: options?.memo || '수정사항 반영에 따른 기존 청구서 취소 및 재생성',
      updatedAt: new Date().toISOString()
    });

    // 2. 새 청구서 생성
    const newYm = options?.billingYm || oldBilling.billingYm;
    const newDate = options?.billingDate || oldBilling.billingDate || new Date().toISOString().split('T')[0];

    const finalDetails = customDetails && customDetails.length > 0 ? customDetails : oldDetails.map(od => {
      const { id, billingId, createdAt, updatedAt, ...rest } = od;
      return rest;
    });

    const newTotalAmount = finalDetails.reduce((sum, d) => sum + (d.amount || (d.quantity * (d.unitPrice || 0))), 0);

    const newBilling = db.insertRow<Billing>('billings', {
      customerId: oldBilling.customerId,
      contractId: oldBilling.contractId,
      billingYm: newYm,
      billingDate: newDate,
      totalAmount: newTotalAmount,
      paidAmount: 0,
      status: 'REQUESTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();

    finalDetails.forEach(det => {
      db.insertRow<BillingDetail>('billingDetails', {
        ...det,
        billingId: newBilling.id,
        createdAt: new Date().toISOString()
      });

      if (det.itemName === '선수금(예치금) 차감 반영') {
        const cust = db.customers.find(c => c.id === oldBilling.customerId);
        if (cust) {
          db.updateRow<Customer>('customers', cust.id, {
            prepaidBalance: Math.max(0, (cust.prepaidBalance || 0) - Math.abs(det.amount)),
            updatedAt: new Date().toISOString()
          } as any);
        }
      }

      if (det.contractAssetId) {
        const ca = db.contractAssets.find(x => x.id === det.contractAssetId);
        if (ca) {
          const ast = db.assets.find(a => a.id === ca.assetId);
          if (ast) {
            db.updateRow<Asset>('assets', ast.id, {
              cumRentalFee: (ast.cumRentalFee || 0) + det.amount,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      if (det.receivableId) {
        const rcv = db.receivables.find(r => r.id === det.receivableId);
        if (rcv) {
          const newBilled = rcv.billedAmount + (det.amount || 0);
          db.updateRow<Receivable>('receivables', rcv.id, {
            billedAmount: newBilled,
            status: newBilled >= rcv.totalAmount ? 'CLEARED' : 'PARTIAL',
            updatedAt: new Date().toISOString()
          });
        }
      }
    });

    linkedRepairs.forEach(r => {
      db.updateRow<Repair>('repairs', r.id, { billingId: newBilling.id });
    });
    linkedDeliveries.forEach(d => {
      db.updateRow<Delivery>('deliveries', d.id, { billingId: newBilling.id });
    });

    if (oldBilling.contractId) {
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: oldBilling.contractId,
        changeType: 'BILLING_REGENERATED',
        changeDate: new Date().toISOString().split('T')[0],
        description: `청구 재생성: ${newYm} / ${newTotalAmount.toLocaleString()}원 (기존 ${billingId} → 신규 ${newBilling.id}, 사유: ${options?.memo || '수정사항 반영'})`,
        createdAt: new Date().toISOString()
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
    return newBilling.id;
  };

  const splitBillingAbsoluteAmount = async (billingId: string, splitAmount: number): Promise<string> => {
    const origBilling = db.billings.find(b => b.id === billingId);
    if (!origBilling) throw new Error("원본 청구를 찾을 수 없습니다.");
    if (origBilling.status === 'PAID') throw new Error("이미 수납이 완료된 청구서는 분할할 수 없습니다.");
    if (origBilling.invoiceId) throw new Error('이미 통합 명세서로 발행된 청구서는 분할할 수 없습니다. 먼저 통합 인보이스를 취소해 주세요.');
    if (splitAmount <= 0 || splitAmount >= origBilling.totalAmount) throw new Error("분할 금액이 유효하지 않습니다.");
    
    const now = new Date().toISOString();

    const childBillingId = 'b_' + Date.now().toString() + '_' + Math.floor(Math.random()*1000);
    db.insertRow<Billing>('billings', {
      id: childBillingId,
      billingType: origBilling.billingType,
      customerId: origBilling.customerId,
      contractId: origBilling.contractId,
      invoiceId: origBilling.invoiceId,
      billingYm: origBilling.billingYm,
      billingDate: origBilling.billingDate,
      totalAmount: splitAmount,
      paidAmount: 0,
      status: origBilling.status,
      rejectReason: origBilling.rejectReason,
      isPartial: origBilling.isPartial,
      parentBillingId: origBilling.id,
      createdAt: now,
      updatedAt: now
    });

    await db.awaitPendingWrites();

    const childDetailId = 'bd_' + Date.now().toString() + '_' + Math.floor(Math.random()*1000) + 'c';
    db.insertRow<BillingDetail>('billingDetails', {
      id: childDetailId,
      billingId: childBillingId,
      contractAssetId: undefined,
      assetId: undefined,
      itemName: '금액 분할 청구건',
      quantity: 1,
      unitPrice: splitAmount,
      amount: splitAmount,
      createdAt: now
    });
    
    const subtractDetailId = 'bd_' + Date.now().toString() + '_' + Math.floor(Math.random()*1000);
    db.insertRow<BillingDetail>('billingDetails', {
      id: subtractDetailId,
      billingId: origBilling.id,
      contractAssetId: undefined,
      assetId: undefined,
      itemName: '청구 분할 차감',
      quantity: 1,
      unitPrice: -splitAmount,
      amount: -splitAmount,
      createdAt: now
    });

    db.updateRow<Billing>('billings', origBilling.id, {
      totalAmount: origBilling.totalAmount - splitAmount,
      updatedAt: now
    });
    
    await db.awaitPendingWrites();
    refreshAllData();
    return childBillingId;
  };

  // 💡 [사장님 지시] 특수 거래명세서 커스텀 항목 및 사유 저장 (실제 계약/청구 DB 원형 보존)
  const saveCustomStatementForBilling = async (
    billingId: string,
    data: {
      reason: string;
      items: CustomStatementItem[];
      originalSummary?: string;
      approvalStatus?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
      approvalRequestId?: string;
    }
  ) => {
    const billingForRegen = db.billings.find(b => b.id === billingId);
    if (billingForRegen?.parentBillingId) {
      throw new Error('분할 생성된 청구서는 수정/재생성할 수 없습니다. 원본 청구서를 취소 후 재발행해 주세요.');
    }
    const regenChildren = db.billings.filter(b => b.parentBillingId === billingId && b.status !== 'REJECTED');
    if (regenChildren.length > 0) {
      throw new Error('이미 분할된 원본 청구서는 수정/재생성할 수 없습니다. 취소 후 재발행해 주세요.');
    }

    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) throw new Error('청구서를 찾을 수 없습니다.');

    const now = new Date().toISOString();
    const isApproved = (data.approvalStatus || 'APPROVED') === 'APPROVED';

    db.updateRow<Billing>('billings', billingId, {
      hasCustomStatement: isApproved ? true : (billing.hasCustomStatement || false),
      customStatementReason: isApproved ? data.reason : (billing.customStatementReason || ''),
      customStatementItems: isApproved ? data.items : (billing.customStatementItems || []),
      customStatementOriginalSummary: data.originalSummary,
      customStatementCreatedAt: now,
      customStatementCreatedBy: currentUser?.name || '관리자',
      approvalStatus: data.approvalStatus || billing.approvalStatus || 'APPROVED',
      approvalRequestId: data.approvalRequestId || billing.approvalRequestId,
      stagedCustomStatement: !isApproved ? {
        reason: data.reason,
        items: data.items,
        originalSummary: data.originalSummary
      } : undefined,
      updatedAt: now
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  // 💡 특수 거래명세서 해제 (원래 정상 청구 양식으로 원복)
  const removeCustomStatementForBilling = async (billingId: string) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) throw new Error('청구서를 찾을 수 없습니다.');

    const now = new Date().toISOString();
    db.updateRow<Billing>('billings', billingId, {
      hasCustomStatement: false,
      customStatementReason: undefined,
      customStatementItems: undefined,
      customStatementOriginalSummary: undefined,
      customStatementCreatedAt: undefined,
      customStatementCreatedBy: undefined,
      updatedAt: now
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  // 💡 테넌트별 특수 거래명세서 기능 활성화/비활성화 제어
  const toggleTenantCustomBillingStatement = async (tenantId: string, enabled: boolean) => {
    const target = tenants.find(t => t.id === tenantId) || currentTenant;
    if (!target) return;
    await saveTenant({ id: target.id, allowCustomBillingStatement: enabled });
  };

  // 💡 테넌트별 렌탈 계약 연동 유통 출고(당월 청구 합산) 기능 활성화/비활성화 제어
  const toggleTenantContractTradeOutbound = async (tenantId: string, enabled: boolean) => {
    const target = tenants.find(t => t.id === tenantId) || currentTenant;
    if (!target) return;
    const curSf = Array.isArray(target.specialFeatures)
      ? target.specialFeatures
      : (Array.isArray(target.features?.specialFeatures) ? target.features.specialFeatures : []);
    const nextSf = enabled
      ? (curSf.includes('btn:contracts:trade_outbound') ? curSf : [...curSf, 'btn:contracts:trade_outbound'])
      : curSf.filter(id => id !== 'btn:contracts:trade_outbound');
    await saveTenant({
      id: target.id,
      allowContractTradeOutbound: enabled,
      specialFeatures: nextSf,
      features: {
        ...(target.features || {}),
        allowContractTradeOutbound: enabled,
        specialFeatures: nextSf
      }
    });
  };

  // v2: 복수 입금건 연동 수납 처리
  const receivePayment = async (billingId: string, data: {
    paymentDate: string;
    amount: number;
    method: string;
    memo: string;
    depositLinks?: { bankTransactionId: string; usedAmount: number }[];
  }) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) {
      showErrorModal('청구서를 찾을 수 없습니다.');
      return;
    }
    if (!data.amount || data.amount <= 0) {
      showErrorModal('수납 금액은 1원 이상이어야 합니다.');
      return;
    }

    const supply = billing.totalAmount || 0;
    const grandTotal = supply + Math.round(supply * 0.1);
    const unpaidAmount = Math.max(0, grandTotal - (billing.paidAmount || 0));
    const appliedToBilling = Math.min(unpaidAmount, data.amount);
    const overAmount = Math.max(0, data.amount - appliedToBilling);

    // 1. 청구서 충당 Payment 생성 (appliedToBilling 분만큼)
    let newPayment: Payment | null = null;
    if (appliedToBilling > 0 || overAmount === 0) {
      newPayment = db.insertRow<Payment>('payments', {
        billingId,
        paymentDate: data.paymentDate,
        amount: appliedToBilling,
        method: data.method,
        memo: data.memo,
        createdAt: new Date().toISOString()
      });
    }

    // 2. 초과분 선수금 적립 및 가상 수납 전표 발행 (overAmount > 0)
    let prepaidPayment: Payment | null = null;
    if (overAmount > 0) {
      const customer = db.customers.find(c => c.id === billing.customerId);
      if (customer) {
        const prevPrepaid = customer.prepaidBalance || 0;
        db.updateRow<Customer>('customers', customer.id, {
          prepaidBalance: prevPrepaid + overAmount,
          updatedAt: new Date().toISOString()
        } as any);
      }

      prepaidPayment = db.insertRow<Payment>('payments', {
        billingId: null,
        paymentDate: data.paymentDate,
        amount: overAmount,
        method: data.method,
        memo: `초과 수납 선수금 자동 적립 (${billing.billingYm} 청구분 초과 ₩${overAmount.toLocaleString()})`,
        createdAt: new Date().toISOString()
      });
    }

    // 3. PaymentDepositLinks 생성 (통장입금 연동 시 청구 충당분과 선수금 분할 매핑)
    if (data.depositLinks && data.depositLinks.length > 0) {
      let remainingBillingCoverage = appliedToBilling;
      for (const link of data.depositLinks) {
        if (link.usedAmount <= 0) continue;

        const useForBilling = Math.min(link.usedAmount, remainingBillingCoverage);
        const useForPrepaid = link.usedAmount - useForBilling;
        remainingBillingCoverage = Math.max(0, remainingBillingCoverage - useForBilling);

        if (useForBilling > 0 && newPayment) {
          db.insertRow<PaymentDepositLink>('paymentDepositLinks', {
            paymentId: newPayment.id,
            bankTransactionId: link.bankTransactionId,
            usedAmount: useForBilling,
            createdAt: new Date().toISOString()
          });
        }

        if (useForPrepaid > 0 && prepaidPayment) {
          db.insertRow<PaymentDepositLink>('paymentDepositLinks', {
            paymentId: prepaidPayment.id,
            bankTransactionId: link.bankTransactionId,
            usedAmount: useForPrepaid,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    // 4. Billing.paidAmount / status 자동 갱신 (VAT 포함 총액 기준 캡 적용)
    const nextPaid = (billing.paidAmount || 0) + appliedToBilling;
    let nextStatus: Billing['status'] = 'UNPAID';
    if (nextPaid >= grandTotal) {
      nextStatus = 'PAID';
    } else if (nextPaid > 0) {
      nextStatus = 'PARTIAL';
    }

    db.updateRow<Billing>('billings', billingId, {
      paidAmount: nextPaid,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    });

    // 5. 계약이력 기록
    if (billing.contractId) {
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: billing.contractId,
        changeType: 'PAYMENT_RECEIVED',
        changeDate: data.paymentDate,
        description: `수납 처리: ${billing.billingYm} / ${appliedToBilling.toLocaleString()}원 수납 (누적: ${nextPaid.toLocaleString()}/${grandTotal.toLocaleString()}원, 상태: ${nextStatus})${overAmount > 0 ? ` [초과금 ₩${overAmount.toLocaleString()} 선수금 적립]` : ''}`,
        createdAt: new Date().toISOString()
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  // 수납 취소: Payment 삭제 + 연결된 PDL 전체 삭제 + Billing.paidAmount 롤백 + 선수금 환원 + 계약 이력 보존
  const cancelPayment = async (paymentId: string) => {
    const payment = db.payments.find(p => p.id === paymentId);
    if (!payment || !isActivePayment(payment)) return;

    // 1. 연결된 유효 PDL 수집 (통장 입금잔액 자동 복원은 3단계 상계/삭제에서 처리)
    const linkedLinks = db.paymentDepositLinks.filter(l => l.paymentId === paymentId && isActiveDepositLink(l));

    // 2. 선수금 상계 수납 건인 경우 고객 선수금 잔액 자동 환원
    const billing = db.billings.find(b => b.id === payment.billingId);
    if (payment.method === 'PREPAID' && billing) {
      const cust = db.customers.find(c => c.id === billing.customerId);
      if (cust) {
        db.updateRow<Customer>('customers', cust.id, {
          prepaidBalance: (cust.prepaidBalance || 0) + payment.amount,
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 3. Payment 및 연결 행 상계(또는 기존 방식 삭제)
    reversePaymentRecord(payment, linkedLinks, '수납 취소');

    // 4. Billing paidAmount 및 상태 롤백
    if (billing) {
      const newPaid = Math.max(0, (billing.paidAmount || 0) - payment.amount);
      const bSupply = billing.totalAmount || 0;
      const bGrand = bSupply + Math.round(bSupply * 0.1);
      let newStatus: Billing['status'] = 'UNPAID';
        const wasRequested = db.contractHistory.some(h => h.changeType === 'BILLING_SENT' && h.description.includes(billing.id));
        if (newPaid >= bGrand) newStatus = 'PAID';
        else if (newPaid > 0) newStatus = 'PARTIAL';
        else if (wasRequested) newStatus = 'REQUESTED';

      db.updateRow<Billing>('billings', billing.id, {
        paidAmount: newPaid,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // 5. 계약 이력 무누락 기록
      if (billing.contractId) {
        db.insertRow<ContractHistory>('contractHistory', {
          contractId: billing.contractId,
          changeType: 'PAYMENT_CANCELLED',
          changeDate: new Date().toISOString().split('T')[0],
          description: `수납 취소 (롤백): ${billing.billingYm} 청구분 / ${payment.amount.toLocaleString()}원 수납 취소 (${payment.method}) (수납후 잔액: ${newPaid.toLocaleString()}원, 상태: ${newStatus})`,
          createdAt: new Date().toISOString()
        });
      }
    }

    refreshAllData();
    await db.awaitPendingWrites();
  };

  // 특정 청구서의 모든 수납 내역 일괄 취소 및 완전 롤백
  const cancelAllPaymentsForBilling = async (billingId: string) => {
    const targetPayments = db.payments.filter(p => p.billingId === billingId && isActivePayment(p));
    for (const p of targetPayments) {
      await cancelPayment(p.id);
    }
  };

  // 통장입금 등록 (입금내역으로 수납 재원 등록)
  const saveBankDeposit = (data: Omit<BankTransaction, 'id' | 'createdAt' | 'withdrawAmount'>) => {
    db.insertRow<BankTransaction>('bankTransactions', {
      ...data,
      withdrawAmount: 0,
      isDeposit: true,
      createdAt: new Date().toISOString()
    });
    refreshAllData();
  };

  // 통장입금 삭제 (연결된 PaymentDepositLink가 있으면 차단)
  const deleteBankDeposit = (txId: string) => {
    const linked = db.paymentDepositLinks.filter(l => l.bankTransactionId === txId && isActiveDepositLink(l));
    if (linked.length > 0) {
      throw new Error(`이 입금건에 연결된 수납 내역 ${linked.length}건이 존재합니다.\n수납을 먼저 취소한 후 삭제하세요.`);
    }
    // ✅ 고아 레코드 방지: 레거시 패턴 수납 레코드 존재 시 삭제 차단
    const legacyPayments = db.payments.filter(p => p.id.startsWith(`pay-matching-${txId}`) && isActivePayment(p));
    if (legacyPayments.length > 0) {
      throw new Error(`이 입금건에 연결된 레거시 수납 기록 ${legacyPayments.length}건이 존재합니다.\n수납을 먼저 취소한 후 삭제하세요.`);
    }
    db.deleteRow('bankTransactions', txId);
    refreshAllData();
  };


  const executeMatch = (
    txId: string,
    billingId: string,
    matchingType: 'AUTO' | 'MANUAL',
    options?: {
      matchingMode?: 'PINPOINT' | 'CASCADE' | 'MULTI';
      allocations?: { billingId: string; amount: number; feeAdjustment?: number }[];
      feeAdjustment?: number;
    }
  ) => {
    const tx = db.bankTransactions.find(t => t.id === txId);
    const firstBilling = db.billings.find(b => b.id === billingId);
    if (!tx || !firstBilling) return;

    const customerId = firstBilling.customerId;
    const mode = options?.matchingMode || 'CASCADE';
    
    // 🌟 이미 사용된 금액을 제외한 실제 가용 잔액 산출 (과대/중복 소진 완벽 차단)
    const usedSoFar = (db.paymentDepositLinks || [])
      .filter(link => link.bankTransactionId === txId && isActiveDepositLink(link))
      .reduce((sum, link) => sum + (link.usedAmount || 0), 0);
    let remainingDeposit = Math.max(0, (tx.depositAmount || 0) - usedSoFar);
    if (remainingDeposit <= 0) {
      console.warn(`[executeMatch] Transaction ${txId} has no available deposit balance (used: ${usedSoFar}, total: ${tx.depositAmount})`);
      return;
    }
    const matchedBillingIds: string[] = [];

    if (mode === 'MULTI' && options?.allocations && options.allocations.length > 0) {
      // 🌟 [MULTI 모드]: 사용자가 지정한 청구서별 금액 및 감액 직접 적용
      for (const alloc of options.allocations) {
        if (remainingDeposit <= 0 && (!alloc.amount || alloc.amount <= 0)) continue;
        const billing = db.billings.find(b => b.id === alloc.billingId);
        if (!billing) continue;

        const bSup = billing.totalAmount || 0;
        const bGrand = bSup + Math.round(bSup * 0.1);
        const feeAdj = alloc.feeAdjustment || 0;
        const paymentAmount = Math.min(alloc.amount, remainingDeposit);
        remainingDeposit = Math.max(0, remainingDeposit - paymentAmount);

        const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const payId = `pay-matching-${txId}-${billing.id}-${uniqueSuffix}`;
        db.insertRow<Payment>('payments', {
          id: payId,
          billingId: billing.id,
          paymentDate: tx.transactionDate.split(' ')[0],
          amount: paymentAmount,
          method: 'BANK_TRANSFER',
          memo: `사용자 분할 대조 수납 (${tx.senderName})${feeAdj > 0 ? ` (수수료 감액 ₩${feeAdj.toLocaleString()})` : ''}`,
          feeAdjustment: feeAdj > 0 ? feeAdj : undefined,
          createdAt: new Date().toISOString()
        });

        db.insertRow<PaymentDepositLink>('paymentDepositLinks', {
          paymentId: payId,
          bankTransactionId: txId,
          usedAmount: paymentAmount,
          createdAt: new Date().toISOString()
        });

        const nextPaid = (billing.paidAmount || 0) + paymentAmount + feeAdj;
        const nextStatus: Billing['status'] = nextPaid >= bGrand ? 'PAID' : 'PARTIAL';
        db.updateRow<Billing>('billings', billing.id, {
          paidAmount: nextPaid,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        });

        if (billing.contractId) {
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: billing.contractId,
            changeType: 'PAYMENT_RECEIVED',
            changeDate: tx.transactionDate.split(' ')[0],
            description: `수납 처리 (통장대조): ${billing.billingYm} / ${paymentAmount.toLocaleString()}원 수납 (누적: ${nextPaid.toLocaleString()}/${bGrand.toLocaleString()}원, 상태: ${nextStatus})${feeAdj > 0 ? ` (수수료 감액 ₩${feeAdj.toLocaleString()})` : ''}`,
            createdAt: new Date().toISOString()
          });
        }
        matchedBillingIds.push(billing.id);
      }
    } else if (mode === 'PINPOINT') {
      // 🌟 [PINPOINT 모드]: 선택한 단일 청구서에만 전액 충당
      const billing = firstBilling;
      const bSup = billing.totalAmount || 0;
      const bGrand = bSup + Math.round(bSup * 0.1);
      const feeAdj = options?.feeAdjustment || 0;
      const unpaidAmount = Math.max(0, bGrand - (billing.paidAmount || 0) - feeAdj);

      const paymentAmount = Math.min(unpaidAmount, remainingDeposit);
      remainingDeposit -= paymentAmount;

      const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const payId = `pay-matching-${txId}-${billing.id}-${uniqueSuffix}`;
      db.insertRow<Payment>('payments', {
        id: payId,
        billingId: billing.id,
        paymentDate: tx.transactionDate.split(' ')[0],
        amount: paymentAmount,
        method: 'BANK_TRANSFER',
        memo: `단독 지정 대조 수납 (${tx.senderName})${feeAdj > 0 ? ` (수수료 감액 ₩${feeAdj.toLocaleString()})` : ''}`,
        feeAdjustment: feeAdj > 0 ? feeAdj : undefined,
        createdAt: new Date().toISOString()
      });

      db.insertRow<PaymentDepositLink>('paymentDepositLinks', {
        paymentId: payId,
        bankTransactionId: txId,
        usedAmount: paymentAmount,
        createdAt: new Date().toISOString()
      });

      const nextPaid = (billing.paidAmount || 0) + paymentAmount + feeAdj;
      const nextStatus: Billing['status'] = nextPaid >= bGrand ? 'PAID' : 'PARTIAL';
      db.updateRow<Billing>('billings', billing.id, {
        paidAmount: nextPaid,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });

      if (billing.contractId) {
        db.insertRow<ContractHistory>('contractHistory', {
          contractId: billing.contractId,
          changeType: 'PAYMENT_RECEIVED',
          changeDate: tx.transactionDate.split(' ')[0],
          description: `수납 처리 (통장대조 단독): ${billing.billingYm} / ${paymentAmount.toLocaleString()}원 수납 (누적: ${nextPaid.toLocaleString()}/${bGrand.toLocaleString()}원, 상태: ${nextStatus})${feeAdj > 0 ? ` (수수료 감액 ₩${feeAdj.toLocaleString()})` : ''}`,
          createdAt: new Date().toISOString()
        });
      }
      matchedBillingIds.push(billing.id);
    } else {
      // 🌟 [CASCADE 모드]: 과거 미수부터 순차 충당 (수수료 감액 옵션 포함)
      const activeBillings = db.billings
        .filter(b => b.customerId === customerId && (b.status === 'UNPAID' || b.status === 'PARTIAL' || b.status === 'REQUESTED'))
        .sort((a, b) => a.billingYm.localeCompare(b.billingYm));

      if (!activeBillings.some(x => x.id === billingId)) {
        activeBillings.unshift(firstBilling);
      }

      let feeAdjRemaining = options?.feeAdjustment || 0;

      for (const billing of activeBillings) {
        if (remainingDeposit <= 0 && feeAdjRemaining <= 0) break;

        const bSup = billing.totalAmount || 0;
        const bGrand = bSup + Math.round(bSup * 0.1);
        let unpaidAmount = Math.max(0, bGrand - (billing.paidAmount || 0));
        if (unpaidAmount <= 0) continue;

        let feeAdjForThis = 0;
        if (feeAdjRemaining > 0) {
          feeAdjForThis = Math.min(feeAdjRemaining, unpaidAmount);
          feeAdjRemaining -= feeAdjForThis;
          unpaidAmount -= feeAdjForThis;
        }

        const paymentAmount = Math.min(unpaidAmount, remainingDeposit);
        remainingDeposit -= paymentAmount;

        const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const payId = `pay-matching-${txId}-${billing.id}-${uniqueSuffix}`;
        db.insertRow<Payment>('payments', {
          id: payId,
          billingId: billing.id,
          paymentDate: tx.transactionDate.split(' ')[0],
          amount: paymentAmount,
          method: 'BANK_TRANSFER',
          memo: `${matchingType === 'AUTO' ? '자동' : '수동'} 순차 대조 수납 (${tx.senderName})${feeAdjForThis > 0 ? ` (수수료 감액 ₩${feeAdjForThis.toLocaleString()})` : ''}`,
          feeAdjustment: feeAdjForThis > 0 ? feeAdjForThis : undefined,
          createdAt: new Date().toISOString()
        });

        db.insertRow<PaymentDepositLink>('paymentDepositLinks', {
          paymentId: payId,
          bankTransactionId: txId,
          usedAmount: paymentAmount,
          createdAt: new Date().toISOString()
        });

        const nextPaid = (billing.paidAmount || 0) + paymentAmount + feeAdjForThis;
        const nextStatus: Billing['status'] = nextPaid >= bGrand ? 'PAID' : 'PARTIAL';
        db.updateRow<Billing>('billings', billing.id, {
          paidAmount: nextPaid,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        });

        if (billing.contractId) {
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: billing.contractId,
            changeType: 'PAYMENT_RECEIVED',
            changeDate: tx.transactionDate.split(' ')[0],
            description: `수납 처리 (${matchingType === 'AUTO' ? '통장대조 자동' : '통장대조 순차'}): ${billing.billingYm} / ${paymentAmount.toLocaleString()}원 수납 (누적: ${nextPaid.toLocaleString()}/${bGrand.toLocaleString()}원, 상태: ${nextStatus})${feeAdjForThis > 0 ? ` (수수료 감액 ₩${feeAdjForThis.toLocaleString()})` : ''}`,
            createdAt: new Date().toISOString()
          });
        }

        matchedBillingIds.push(billing.id);
      }
    }

    // 2. 남은 초과금 선수금 적립 (CASCADE 모드에서 모든 미수 청구서가 소진된 후에도 남은 경우에만 선수금 적립!)
    // PINPOINT 또는 MULTI 모드에서는 사용자가 지정한 청구서만 매칭하였으므로 남은 금액은 통장 잔여 가용잔액으로 유지되어 추가 매칭이 가능함.
    if (mode === 'CASCADE' && remainingDeposit > 0) {
      const customer = db.customers.find(c => c.id === customerId);
      if (customer) {
        const prevPrepaid = customer.prepaidBalance || 0;
        db.updateRow<Customer>('customers', customerId, {
          prepaidBalance: prevPrepaid + remainingDeposit,
          updatedAt: new Date().toISOString()
        } as any);

        const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const prepaidPayId = `pay-matching-${txId}-${uniqueSuffix}-prepaid`;
        // 선수금 가상 수납 전표 등록
        db.insertRow<Payment>('payments', {
          id: prepaidPayId,
          billingId: null,
          paymentDate: tx.transactionDate.split(' ')[0],
          amount: remainingDeposit,
          method: 'BANK_TRANSFER',
          memo: `통장 대조 매칭 초과 선수금 적립 (${tx.senderName})`,
          createdAt: new Date().toISOString()
        });

        // 🌟 선수금 전표에 대해서도 PaymentDepositLink를 등록하여 통장 입금 사용 추적 완벽 일치화!
        db.insertRow<PaymentDepositLink>('paymentDepositLinks', {
          paymentId: prepaidPayId,
          bankTransactionId: txId,
          usedAmount: remainingDeposit,
          createdAt: new Date().toISOString()
        });
      }
    }

    // 3. 거래 내역 상태 변경
    db.updateRow<BankTransaction>('bankTransactions', txId, {
      customerId: customerId,
      matchedBillingId: matchedBillingIds.length > 0 ? matchedBillingIds[0] : billingId,
      matchingType,
      updatedAt: new Date().toISOString()
    } as any);
  };

  const tryAutoMatchForTransaction = (tx: BankTransaction) => {
    const getBillingGrand = (b: Billing) => {
      const sup = b.totalAmount || 0;
      return sup + Math.round(sup * 0.1);
    };

    const cleanName = (n: string) => (n || '').replace(/\(주\)|주식회사|\s+/g, '').toLowerCase();
    const cleanSender = cleanName(tx.senderName);

    const rule = db.bankMatchingRules.find(r => r.senderName === tx.senderName);
    if (rule) {
      const activeBillings = db.billings.filter(b => 
        b.customerId === rule.customerId && 
        (b.status === 'UNPAID' || b.status === 'PARTIAL' || b.status === 'REQUESTED')
      );
      if (activeBillings.length > 0) {
        let target = activeBillings.find(b => (getBillingGrand(b) - (b.paidAmount || 0)) === tx.depositAmount);
        if (!target) {
          target = activeBillings.sort((a, b) => a.billingYm.localeCompare(b.billingYm))[0];
        }
        executeMatch(tx.id, target.id, 'AUTO', { matchingMode: 'CASCADE' });
        return;
      }
    }

    const matchedCustomer = db.customers.find(c => {
      const cClean = cleanName(c.name);
      return cleanSender && cClean && (cleanSender.includes(cClean) || cClean.includes(cleanSender));
    });
    if (matchedCustomer) {
      const activeBillings = db.billings.filter(b => 
        b.customerId === matchedCustomer.id && 
        (b.status === 'UNPAID' || b.status === 'PARTIAL' || b.status === 'REQUESTED')
      );
      if (activeBillings.length > 0) {
        let target = activeBillings.find(b => (getBillingGrand(b) - (b.paidAmount || 0)) === tx.depositAmount);
        if (!target) {
          target = activeBillings.sort((a, b) => a.billingYm.localeCompare(b.billingYm))[0];
        }
        executeMatch(tx.id, target.id, 'AUTO', { matchingMode: 'CASCADE' });
        return;
      }
    }
  };

  const uploadBankTransactions = (txs: Omit<BankTransaction, 'id' | 'createdAt'>[]) => {
    txs.forEach(tx => {
      const newTx = db.insertRow<BankTransaction>('bankTransactions', {
        ...tx,
        matchedBillingId: undefined,
        matchingType: undefined,
        createdAt: new Date().toISOString()
      } as any);

      if (newTx.depositAmount > 0) {
        tryAutoMatchForTransaction(newTx);
      }
    });
    refreshAllData();
  };

  const batchAutoMatchTransactions = async () => {
    const unallocatedTxs = db.bankTransactions.filter(t => 
      (t.depositAmount || 0) > 0 && !t.matchedBillingId
    );
    let matchedCount = 0;
    for (const tx of unallocatedTxs) {
      const prevMatched = tx.matchedBillingId;
      tryAutoMatchForTransaction(tx);
      const updatedTx = db.bankTransactions.find(t => t.id === tx.id);
      if (updatedTx?.matchedBillingId && updatedTx.matchedBillingId !== prevMatched) {
        matchedCount++;
      }
    }
    await db.awaitPendingWrites();
    refreshAllData();
    return matchedCount;
  };

  const matchTransactionManual = async (
    txId: string,
    billingId: string,
    learnRule: boolean,
    options?: {
      matchingMode?: 'PINPOINT' | 'CASCADE' | 'MULTI';
      allocations?: { billingId: string; amount: number; feeAdjustment?: number }[];
      feeAdjustment?: number;
    }
  ) => {
    const tx = db.bankTransactions.find(t => t.id === txId);
    const billing = db.billings.find(b => b.id === billingId);
    if (!tx || !billing) return;

    executeMatch(txId, billingId, 'MANUAL', options);

    if (learnRule) {
      const exists = db.bankMatchingRules.some(r => r.senderName === tx.senderName);
      if (!exists) {
        db.insertRow<BankMatchingRule>('bankMatchingRules', {
          senderName: tx.senderName,
          customerId: billing.customerId,
          createdAt: new Date().toISOString()
        });
      }
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  const unmatchTransaction = async (txId: string) => {
    const tx = db.bankTransactions.find(t => t.id === txId);
    if (!tx) return;

    // customerId 식별 (청구서, 매칭규칙, 거래처 역추적)
    const linkedLinks = db.paymentDepositLinks.filter(l => l.bankTransactionId === txId && isActiveDepositLink(l));
    let customerId: string | undefined;
    for (const link of linkedLinks) {
      const p = db.payments.find(x => x.id === link.paymentId);
      if (p?.billingId) {
        const b = db.billings.find(x => x.id === p.billingId);
        if (b?.customerId) {
          customerId = b.customerId;
          break;
        }
      }
    }
    if (!customerId && tx.matchedBillingId) {
      const b = db.billings.find(x => x.id === tx.matchedBillingId);
      if (b?.customerId) customerId = b.customerId;
    }
    if (!customerId) {
      customerId = db.bankMatchingRules.find(r => r.senderName === tx.senderName)?.customerId;
    }
    if (!customerId) {
      const cleanSender = (tx.senderName || '').replace(/\(주\)|주식회사|\s+/g, '').toLowerCase();
      customerId = db.customers.find(c => {
        const cClean = (c.name || '').replace(/\(주\)|주식회사|\s+/g, '').toLowerCase();
        return cleanSender && cClean && (cleanSender.includes(cClean) || cClean.includes(cleanSender));
      })?.id;
    }

    // 해제 추적 기록 (수납 행/연결 행은 삭제되므로 원 입금 거래 메모에 영구 보존)
    const unmatchTrace: string[] = [];

    // 1. paymentDepositLinks 기반 롤백 (신규 체계)
    const handledPayIds = new Set<string>();
    linkedLinks.forEach(link => {
      let linkHandled = false;
      const pay = db.payments.find(p => p.id === link.paymentId);
      if (pay) {
        if (pay.billingId) {
          const billing = db.billings.find(b => b.id === pay.billingId);
          if (billing) {
            const bSup = billing.totalAmount || 0;
            const bGrand = bSup + Math.round(bSup * 0.1);
            const feeAdj = pay.feeAdjustment || 0;
            const nextPaid = Math.max(0, (billing.paidAmount || 0) - link.usedAmount - feeAdj);
            const nextStatus: Billing['status'] = nextPaid === 0 ? 'UNPAID' : (nextPaid >= bGrand ? 'PAID' : 'PARTIAL');
            db.updateRow<Billing>('billings', billing.id, {
              paidAmount: nextPaid,
              status: nextStatus,
              updatedAt: new Date().toISOString()
            });
            unmatchTrace.push(`${billing.billingYm} 청구(${billing.id}) ${link.usedAmount.toLocaleString()}원 수납 해제 (잔여 ${nextPaid.toLocaleString()}원, ${nextStatus})`);

            if (billing.contractId) {
              db.insertRow<ContractHistory>('contractHistory', {
                contractId: billing.contractId,
                changeType: 'PAYMENT_CANCELLED',
                changeDate: new Date().toISOString().split('T')[0],
                description: `수납 대조 해제: ${billing.billingYm} 청구분 / ${link.usedAmount.toLocaleString()}원 수납 취소 (잔여: ${nextPaid.toLocaleString()}원, 상태: ${nextStatus})`,
                createdAt: new Date().toISOString()
              });
            }
          }
        } else if (pay.id.endsWith('-prepaid') || !pay.billingId) {
          // 초과 선수금 환원 차감
          unmatchTrace.push(`선수금 ${pay.amount.toLocaleString()}원 환원 차감${customerId ? ` (고객 ${customerId})` : ' (고객 식별 불가)'}`);
          if (customerId) {
            const customer = db.customers.find(c => c.id === customerId);
            if (customer) {
              db.updateRow<Customer>('customers', customerId, {
                prepaidBalance: Math.max(0, (customer.prepaidBalance || 0) - pay.amount),
                updatedAt: new Date().toISOString()
              } as any);
            }
          }
        }

        // 수납 행/연결 행 처리: 전체 취소 대상은 상계(또는 기존 방식 삭제), 부분 소진 감액은 금액 차감 + 연결 행 삭제
        if (pay.id.startsWith(`pay-matching-${txId}`)) {
          if (!handledPayIds.has(pay.id)) {
            handledPayIds.add(pay.id);
            reversePaymentRecord(pay, linkedLinks.filter(l => l.paymentId === pay.id), `매칭 해제 ${txId}`);
          }
          linkHandled = true;
        } else {
          const newAmount = Math.max(0, pay.amount - link.usedAmount);
          if (newAmount === 0) {
            if (!handledPayIds.has(pay.id)) {
              handledPayIds.add(pay.id);
              reversePaymentRecord(pay, linkedLinks.filter(l => l.paymentId === pay.id), `매칭 해제 ${txId}`);
            }
            linkHandled = true;
          } else {
            db.updateRow<Payment>('payments', pay.id, { amount: newAmount, updatedAt: new Date().toISOString() });
          }
        }
      }
      if (!linkHandled) db.deleteRow('paymentDepositLinks', link.id);
    });

    // 2. 레거시 ID 패턴(`pay-matching-${txId}`)으로 잔존하는 수납 전표 검색 및 롤백
    const matchPrefix = `pay-matching-${txId}`;
    const associatedPayments = db.payments.filter(p => p.id.startsWith(matchPrefix) && isActivePayment(p));

    associatedPayments.forEach(pay => {
      if (pay.billingId) {
        const billing = db.billings.find(b => b.id === pay.billingId);
        if (billing) {
          const bSup = billing.totalAmount || 0;
          const bGrand = bSup + Math.round(bSup * 0.1);
          const feeAdj = pay.feeAdjustment || 0;
          const nextPaid = Math.max(0, (billing.paidAmount || 0) - pay.amount - feeAdj);
          const nextStatus: Billing['status'] = nextPaid === 0 ? 'UNPAID' : (nextPaid >= bGrand ? 'PAID' : 'PARTIAL');
          db.updateRow<Billing>('billings', billing.id, {
            paidAmount: nextPaid,
            status: nextStatus,
            updatedAt: new Date().toISOString()
          });
          unmatchTrace.push(`${billing.billingYm} 청구(${billing.id}) ${pay.amount.toLocaleString()}원 수납 해제 레거시 (잔여 ${nextPaid.toLocaleString()}원, ${nextStatus})`);

          if (billing.contractId) {
            db.insertRow<ContractHistory>('contractHistory', {
              contractId: billing.contractId,
              changeType: 'PAYMENT_CANCELLED',
              changeDate: new Date().toISOString().split('T')[0],
              description: `수납 대조 해제(레거시): ${billing.billingYm} 청구분 / ${pay.amount.toLocaleString()}원 수납 취소 (잔여: ${nextPaid.toLocaleString()}원, 상태: ${nextStatus})`,
              createdAt: new Date().toISOString()
            });
          }
        }
      } else if (customerId) {
        unmatchTrace.push(`선수금 ${pay.amount.toLocaleString()}원 환원 차감 레거시 (고객 ${customerId})`);
        const customer = db.customers.find(c => c.id === customerId);
        if (customer) {
          db.updateRow<Customer>('customers', customerId, {
            prepaidBalance: Math.max(0, (customer.prepaidBalance || 0) - pay.amount),
            updatedAt: new Date().toISOString()
          } as any);
        }
      }
      reversePaymentRecord(pay, [], `매칭 해제 ${txId} 레거시`);
    });

    // 3. 거래 정보 복구 + 해제 이력 영구 보존
    // 수납 행과 연결 행은 삭제되므로, 입금 거래 메모에 [해제 일시 / 수행자 / 해제 내역]을 덧붙여 계약 이력이 없는 선수금 경로까지 추적 가능하게 한다.
    const nowIso = new Date().toISOString();
    const unmatchStamp = `[매칭 해제 ${nowIso.replace('T', ' ').slice(0, 16)} / ${currentUser?.name || '미식별'}] ${unmatchTrace.length > 0 ? unmatchTrace.join(' | ') : '해제 대상 수납 내역 없음'}`;
    db.updateRow<BankTransaction>('bankTransactions', txId, {
      matchedBillingId: '',
      matchingType: undefined,
      memo: tx.memo ? `${tx.memo}\n${unmatchStamp}` : unmatchStamp,
      updatedAt: nowIso
    } as any);

    await db.awaitPendingWrites(); refreshAllData(); };

  const saveMatchingRule = (senderName: string, customerId: string) => {
    const existing = db.bankMatchingRules.find(r => r.senderName.toLowerCase() === senderName.toLowerCase());
    if (existing) {
      db.updateRow<BankMatchingRule>('bankMatchingRules', existing.id, {
        customerId,
        updatedAt: new Date().toISOString()
      } as any);
    } else {
      db.insertRow<BankMatchingRule>('bankMatchingRules', {
        senderName,
        customerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any);
    }
    refreshAllData();
  };

  const deleteMatchingRule = (ruleId: string) => {
    db.deleteRow('bankMatchingRules', ruleId);
    refreshAllData();
  };

  const saveBankInitialBalance = async (bankName: string, initialBalance: number, accountNumber?: string) => {
    const existing = db.bankInitialBalances.find(b => b.bankName === bankName);
    if (existing) {
      db.updateRow<BankAccountInitialBalance>('bankInitialBalances', existing.id, {
        initialBalance,
        accountNumber: accountNumber || existing.accountNumber,
        updatedAt: new Date().toISOString()
      } as any);
    } else {
      db.insertRow<BankAccountInitialBalance>('bankInitialBalances', {
        id: `bank-init-${bankName}`,
        bankName,
        accountNumber,
        initialBalance,
        updatedAt: new Date().toISOString()
      } as any);
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  const updateAnnualLeaveQuota = async (userId: string, periodStart: string, periodEnd: string, grantedDays: number, memo?: string) => {
    const existing = db.annualLeaveQuotas.find(q => q.userId === userId && q.periodStart === periodStart);
    if (existing) {
      db.updateRow<AnnualLeaveQuota>('annualLeaveQuotas', existing.id, {
        grantedDays,
        memo,
        updatedAt: new Date().toISOString()
      } as any);
    } else {
      db.insertRow<AnnualLeaveQuota>('annualLeaveQuotas', {
        userId,
        periodStart,
        periodEnd,
        grantedDays,
        memo,
        createdAt: new Date().toISOString()
      } as any);
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  const addLeaveUsage = async (usage: Omit<LeaveUsage, 'id' | 'createdAt'>) => {
    const newLeave = db.insertRow<LeaveUsage>('leaveUsages', {
      ...usage,
      createdAt: new Date().toISOString()
    } as any);

    // 🚀 [단일 업무 인계 파이프라인] 부서장에게 휴가 승인 ToDo 발행
    const applicant = db.users.find(u => u.id === usage.userId);
    await issueHandoverTask({
      category: 'LEAVE_OT_APPROVAL',
      title: `[휴가 승인 요망] ${applicant?.name || '임직원'} (${usage.leaveType || '연차'})`,
      content: `${applicant?.name || '임직원'} 휴가 신청 (${usage.startDate} ~ ${usage.endDate}, ${usage.usedDays}일). 사유: ${usage.reason || '-'}`,
      targetRole: 'MANAGER',
      priority: 'NORMAL',
      actionUrl: '/admin/leave_management',
      entityType: 'LEAVE',
      entityId: newLeave.id,
      senderId: currentUser?.id,
      senderName: currentUser?.name
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  const deleteLeaveUsage = async (id: string) => {
    db.deleteRow('leaveUsages', id);
    await clearHandoverTasks({
      entityType: 'LEAVE',
      entityId: id,
      completionAction: 'LEAVE_DELETED'
    });
    await db.awaitPendingWrites(); refreshAllData(); };

  const addOvertimeRecord = async (record: Omit<OvertimeRecord, 'id' | 'createdAt'>) => {
    const newOt = db.insertRow<OvertimeRecord>('overtimeRecords', {
      ...record,
      createdAt: new Date().toISOString()
    } as any);

    const applicant = db.users.find(u => u.id === record.userId);
    await issueHandoverTask({
      category: 'LEAVE_OT_APPROVAL',
      title: `[초과근무 승인 요망] ${applicant?.name || '임직원'} (${record.hours}시간)`,
      content: `${applicant?.name || '임직원'} 연장/야간 근무 신청 (${record.startDateTime?.substring(0, 10)}, ${record.hours}시간). 사유: ${record.workDetail || '-'}`,
      targetRole: 'MANAGER',
      priority: 'NORMAL',
      actionUrl: '/admin/ot_management',
      entityType: 'OT',
      entityId: newOt.id,
      senderId: currentUser?.id,
      senderName: currentUser?.name
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  const deleteOvertimeRecord = async (id: string) => {
    db.deleteRow('overtimeRecords', id);
    await clearHandoverTasks({
      entityType: 'LEAVE',
      entityId: id,
      completionAction: 'OT_DELETED'
    });
    await db.awaitPendingWrites(); refreshAllData(); };

  const setPayrollClosingStatus = async (month: string, status: 'DRAFT' | 'APPROVED', approvedBy?: string) => {
    const existing = db.payrollClosings.find(p => p.month === month);
    if (existing) {
      db.updateRow<PayrollClosing>('payrollClosings', existing.id, {
        status,
        approvedAt: status === 'APPROVED' ? new Date().toISOString() : undefined,
        approvedBy: status === 'APPROVED' ? approvedBy : undefined,
        updatedAt: new Date().toISOString()
      } as any);
    } else {
      db.insertRow<PayrollClosing>('payrollClosings', {
        month,
        status,
        approvedAt: status === 'APPROVED' ? new Date().toISOString() : undefined,
        approvedBy: status === 'APPROVED' ? approvedBy : undefined,
        createdAt: new Date().toISOString()
      } as any);
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  const dispatchDelivery = (
    deliveryId: string, 
    dispatchData: { 
      scheduledDate: string; 
      transportCompany: string; 
      vehicleType: string; 
      vehicleNo: string; 
      driverName: string; 
      driverContact: string; 
      deliveryCost: number; 
      vehiclesJson?: string;
    }
  ) => {
    const existingDel = db.deliveries.find(d => d.id === deliveryId);
    if (existingDel?.contractId) {
      const blockReason = getPendingCustomerOrContractBlockReason(existingDel.contractId);
      if (blockReason) {
        showErrorModal(blockReason, '결재 미승인 배차 제한');
        return;
      }
    }
    const keepCompleted = existingDel?.status === 'DELIVERED' || existingDel?.status === 'COMPLETED';
    db.updateRow<Delivery>('deliveries', deliveryId, {
      scheduledDate: dispatchData.scheduledDate,
      transportCompany: dispatchData.transportCompany,
      vehicleType: dispatchData.vehicleType,
      vehicleNo: dispatchData.vehicleNo,
      driverName: dispatchData.driverName,
      driverContact: dispatchData.driverContact,
      deliveryCost: dispatchData.deliveryCost,
      vehicles: dispatchData.vehiclesJson,
      status: keepCompleted ? existingDel.status : 'DISPATCHED',
      updatedAt: new Date().toISOString()
    });
    refreshAllData();

    // 📢 배차 완료 시 관련 부서(영업/출고/관리/경영)에 실시간 알림 브로드캐스트
    const dObj = db.deliveries.find(d => d.id === deliveryId);
    const dContract = dObj?.contractId ? db.contracts.find(c => c.id === dObj.contractId) : null;
    const dCust = dContract ? db.customers.find(c => c.id === dContract.customerId)?.name : '';
    const dSite = dContract ? db.sites.find(s => s.id === dContract.siteId)?.name : '';
    broadcastWorkNotification({
      type: 'DISPATCH',
      title: '배차 완료 안내',
      body: `${dCust || '현장'} (${dSite || '배차'}) ${dispatchData.driverName || '기사'} (${dispatchData.vehicleType || '화물'}) 배차 완료`,
      url: '/admin/dispatch',
      targetDepts: ['SALES', 'YARD', 'ADMIN', 'EXECUTIVE']
    }).catch(console.warn);
  };

  const settleDeliveryCost = (deliveryId: string, deliveryCostConfirmed: number, vehiclesJson?: string) => {
    db.updateRow<Delivery>('deliveries', deliveryId, {
      isCostSettled: true,
      deliveryCostConfirmed,
      vehicles: vehiclesJson,
      updatedAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const completeDelivery = async (deliveryId: string) => {
    const delivery = db.deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    if (delivery.contractId) {
      const blockReason = getPendingCustomerOrContractBlockReason(delivery.contractId);
      if (blockReason) {
        showErrorModal(blockReason, '결재 미승인 운송완료 제한');
        throw new Error(blockReason);
      }
    }

    const isOutboundLike =
      delivery.type === 'OUTBOUND' ||
      delivery.type === 'EXCHANGE' ||
      delivery.dispatchCategory === '출고' ||
      delivery.dispatchCategory === '교환';

    // 🛡️ [절차적 무결성 가드레일]: 출고/교환 배차는 반드시 (1) 기사 배정 ➔ (2) 장비 할당 완료 ➔ (3) 출고 검수 승인을 거쳐야만 운송 완료 처리 가능
    if (isOutboundLike && delivery.contractId) {
      if (delivery.status === 'REQUESTED' || !delivery.driverName?.trim()) {
        throw new Error('배차 기사 배정(배차 완료)이 선행되지 않은 출고 건은 운송 완료 처리할 수 없습니다.');
      }

      // 1. 해당 배차의 대상 계약자산 슬롯 추출
      let parsedCargo: any[] = [];
      try {
        if (delivery.cargoItems) {
          const raw = typeof delivery.cargoItems === 'string' ? JSON.parse(delivery.cargoItems) : delivery.cargoItems;
          if (Array.isArray(raw)) parsedCargo = raw;
        }
      } catch {
        parsedCargo = [];
      }

      const deliveryCaIds: string[] = [];
      let totalRequestedCount = 0;
      parsedCargo.forEach(ci => {
        totalRequestedCount += Number(ci?.count) || 0;
        if (Array.isArray(ci?.contractAssetIds)) {
          deliveryCaIds.push(...ci.contractAssetIds.filter(Boolean));
        }
      });

      let targetCas = deliveryCaIds.length > 0
        ? db.contractAssets.filter(ca => deliveryCaIds.includes(ca.id))
        : [];

      // 레거시/초기 계약 배차 등 contractAssetIds가 비어있는 경우 해당 계약의 슬롯 참조
      if (targetCas.length === 0) {
        const allContractCas = db.contractAssets.filter(ca => ca.contractId === delivery.contractId && ca.status !== 'RETURNED');
        const unassignedCas = allContractCas.filter(ca => !ca.assetId);
        if (unassignedCas.length > 0) {
          targetCas = unassignedCas;
        } else {
          targetCas = allContractCas;
        }
      }

      if (targetCas.length === 0 && totalRequestedCount > 0) {
        throw new Error(`해당 출고 요청(${totalRequestedCount}대)에 연결된 계약 자산 슬롯을 찾을 수 없어 운송 완료 처리할 수 없습니다.`);
      }

      // 2. 미할당 슬롯(assetId 누락) 검증
      const unassignedSlots = targetCas.filter(ca => !ca.assetId);
      if (unassignedSlots.length > 0) {
        const missingModels = unassignedSlots.map(ca => ca.expectedModel || '미지정').join(', ');
        throw new Error(
          `[절차 차단: 장비 미할당]\n` +
          `이 출고 건에 아직 장비가 할당되지 않은 슬롯이 ${unassignedSlots.length}대(${missingModels}) 남아 있습니다.\n\n` +
          `반드시 [장비 할당] ➔ [출고 검수 승인]을 먼저 완료한 후 운송 완료 처리해 주십시오.`
        );
      }

      // 3. 출고 검수 승인 완료(COMPLETED & 자산 AWAITING_TRANSPORT/RENTED 전환) 검증
      const uninspectedAssets: string[] = [];
      for (const ca of targetCas) {
        const asset = db.assets.find(a => a.id === ca.assetId);
        const matchedInsps = db.outboundInspections.filter(
          ins =>
            ins.contractAssetId === ca.id ||
            (ins.deliveryId === delivery.id && ins.assetId === ca.assetId) ||
            (ins.contractId === delivery.contractId && ins.assetId === ca.assetId)
        );
        const isInspCompleted = matchedInsps.length > 0
          ? matchedInsps.some(ins => ins.status === 'COMPLETED' || (ins.status as string) === 'APPROVED')
          : ((asset?.status === 'AWAITING_TRANSPORT' || asset?.status === 'RENTED') && (ca.status === 'AWAITING_TRANSPORT' || ca.status === 'RENTED'));
        const isAssetReady = asset?.status === 'AWAITING_TRANSPORT' || asset?.status === 'RENTED';

        if (!isInspCompleted || !isAssetReady) {
          const label = asset ? `${asset.modelName}(${asset.assetNo})` : (ca.expectedModel || ca.id);
          uninspectedAssets.push(label);
        }
      }

      if (uninspectedAssets.length > 0) {
        throw new Error(
          `[절차 차단: 출고 검수 미완료]\n` +
          `출고 검수 승인이 완료되지 않은 장비가 ${uninspectedAssets.length}대 존재합니다:\n` +
          `• ${uninspectedAssets.join(', ')}\n\n` +
          `[출고 검수] 메뉴에서 기능 점검 및 출고 승인을 먼저 완료해 주십시오.`
        );
      }
    }

    const nowObj = new Date();
    const nowIso = nowObj.toISOString();
    const todayLocalStr = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-${String(nowObj.getDate()).padStart(2, '0')}`;
    const effectiveUnloadingDate = (delivery.unloadingDate || delivery.loadingDate || delivery.scheduledDate || todayLocalStr).slice(0, 10);

    // [헌장 1.3 준수 & 상차완료 ➔ 하차 예정일 자동 운송완료]:
    // 상차완료 시 하차 예정일(effectiveUnloadingDate)이 오늘 이하이면 즉시 DELIVERED로 마감하고,
    // 미래 하차 예정일이면 loadingCompletedAt 및 unloadingCompletedAt(하차예정일)을 기록하여 하차 예정일에 자동 DELIVERED 전환되도록 한다.
    // 동시에 하차 예정일 = 운송 완료일 = 계약 개시일 = 청구 개시일로 체결자산/장비/입출고로그/계약 개시일을 100% 일치시킨다.
    db.updateRow<Delivery>('deliveries', deliveryId, {
      status: effectiveUnloadingDate <= todayLocalStr ? 'DELIVERED' : 'DISPATCHED',
      loadingCompletedAt: delivery.loadingCompletedAt || nowIso,
      unloadingCompletedAt: effectiveUnloadingDate,
      updatedAt: nowIso
    });

    if (isOutboundLike && delivery.contractId) {
      const syncCaIds = new Set<string>();
      if (delivery.cargoItems) {
        try {
          const parsed = typeof delivery.cargoItems === 'string' ? JSON.parse(delivery.cargoItems) : delivery.cargoItems;
          if (Array.isArray(parsed)) {
            parsed.forEach((ci: any) => {
              if (Array.isArray(ci?.contractAssetIds)) {
                ci.contractAssetIds.forEach((id: string) => {
                  if (id) syncCaIds.add(id);
                });
              }
            });
          }
        } catch {}
      }
      db.outboundInspections
        .filter(ins => ins.deliveryId === delivery.id && ins.contractAssetId)
        .forEach(ins => {
          if (ins.contractAssetId) syncCaIds.add(ins.contractAssetId);
        });

      if (syncCaIds.size === 0) {
        db.contractAssets
          .filter(ca => ca.contractId === delivery.contractId && ca.status !== 'RETURNED' && ca.status !== 'SOLD')
          .forEach(ca => syncCaIds.add(ca.id));
      }

      const loadDateStr = (delivery.loadingDate || delivery.scheduledDate || '').slice(0, 10);
      syncCaIds.forEach(caId => {
        const caObj = db.contractAssets.find(c => c.id === caId && c.contractId === delivery.contractId);
        if (!caObj) return;
        const shouldSyncFirstStart =
          !caObj.firstStartDate ||
          caObj.firstStartDate === caObj.startDate ||
          caObj.firstStartDate === loadDateStr;
        db.updateRow<ContractAsset>('contractAssets', caObj.id, {
          status: 'RENTED',
          startDate: effectiveUnloadingDate,
          ...(shouldSyncFirstStart ? { firstStartDate: effectiveUnloadingDate } : {})
        });
        if (caObj.assetId) {
          db.updateRow<Asset>('assets', caObj.assetId, {
            status: 'RENTED',
            contractStart: effectiveUnloadingDate,
            updatedAt: nowIso
          });
        }
      });

      db.assetInOutLogs
        .filter(l => l.deliveryId === delivery.id && l.type === 'OUTBOUND')
        .forEach(l => {
          db.updateRow<AssetInOutLog>('asset_inout_logs', l.id, {
            eventDate: effectiveUnloadingDate
          });
        });

      const contract = db.contracts.find(c => c.id === delivery.contractId);
      if (contract) {
        const activeCas = db.contractAssets.filter(
          c => c.contractId === contract.id && c.status !== 'RETURNED' && c.status !== 'SOLD' && c.startDate
        );
        const earliestStart = activeCas.map(c => c.startDate).filter(Boolean).sort()[0] || effectiveUnloadingDate;
        const nextContractStatus = (contract.status !== 'COMPLETED' && contract.status !== 'EXTENDED') ? 'ACTIVE' : contract.status;
        db.updateRow<Contract>('contracts', delivery.contractId, {
          startDate: earliestStart,
          status: nextContractStatus,
          updatedAt: nowIso
        });
      }
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const completeInboundDelivery = async (
    deliveryId: string,
    actualReturnDate: string,
    reviews: { assetId: string; status: 'AVAILABLE' | 'REPAIRING'; maintenanceScore: number; memo: string; faultImageUrl?: string }[]
  ) => {
    const delivery = db.deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    db.updateRow<Delivery>('deliveries', deliveryId, {
      status: 'COMPLETED',
      updatedAt: new Date().toISOString()
    });

    const contract = delivery.contractId ? db.contracts.find(c => c.id === delivery.contractId) : null;
    const customer = contract ? db.customers.find(c => c.id === contract.customerId) : null;
    const site = contract ? db.sites.find(s => s.id === contract.siteId) : null;

    reviews.forEach(review => {
      const asset = db.assets.find(a => a.id === review.assetId);
      if (!asset) return;

      db.updateRow<Asset>('assets', review.assetId, {
        status: review.status,
        maintenanceScore: review.maintenanceScore,
        currentCustomerId: '',
        currentSiteId: '',
        contractStart: '',
        contractEnd: '',
        updatedAt: new Date().toISOString()
      });

      const registeredAt = new Date().toISOString();

      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: asset.id,
        assetNo: asset.assetNo,
        modelName: asset.modelName,
        type: 'INBOUND',
        eventDate: actualReturnDate,
        inDate: actualReturnDate,
        inRegisteredAt: registeredAt,
        customerId: contract?.customerId || '',
        customerName: customer?.name || '',
        siteId: contract?.siteId || '',
        siteName: site?.name || '',
        deliveryId: deliveryId,
        maintenanceScore: review.maintenanceScore,
        memo: review.memo,
        createdAt: registeredAt
      });

      if (review.status === 'REPAIRING') {
        db.insertRow<Repair>('repairs', {
          assetId: asset.id,
          details: `입고 검수 시 등록됨: ${review.memo}`,
          status: 'PENDING',
          requestDate: actualReturnDate,
          totalCost: 0,
          billableToCustomer: false,
          isCustomerFault: true,
          faultImageUrl: review.faultImageUrl || '',
          createdAt: registeredAt,
          updatedAt: registeredAt
        });
      }
    });

    if (delivery.contractId) {
      const isExchange = delivery.type === 'EXCHANGE' || delivery.dispatchCategory === '교환';
      const reviewedAssetIds = reviews.map(r => r.assetId);
      const cAssets = db.contractAssets.filter(ca => ca.contractId === delivery.contractId);
      const registeredAt = new Date().toISOString();

      if (isExchange) {
        // 교환 배차: 계약은 계속 진행되므로 완료시키지 않음
        // 회수 검수된 장비 슬롯만 RETURNED 처리 (대차로 투입된 장비는 계속 RENTED 유지)
        cAssets.forEach(ca => {
          if (ca.assetId && reviewedAssetIds.includes(ca.assetId)) {
            // 💡 [단일 진실의 원천]: 해당 자산의 '모든' 미반납 ContractAsset 슬롯 청소 (찌꺼기 원천 봉쇄)
            const allActiveSlots = db.contractAssets.filter(c => c.assetId === ca.assetId && c.status !== 'RETURNED');
            allActiveSlots.forEach(targetCa => {
              db.updateRow<ContractAsset>('contractAssets', targetCa.id, {
                status: 'RETURNED',
                actualReturnDate: targetCa.actualReturnDate || actualReturnDate,
                inRegisteredAt: targetCa.inRegisteredAt || registeredAt,
                updatedAt: registeredAt
              });
            });
          }
        });
      } else {
        // 일반 입고/반납 배차: 검수된 자산 슬롯 RETURNED 처리
        cAssets.forEach(ca => {
          if (reviewedAssetIds.length === 0 || (ca.assetId && reviewedAssetIds.includes(ca.assetId))) {
            const assetToClean = ca.assetId;
            if (assetToClean) {
              const allActiveSlots = db.contractAssets.filter(c => c.assetId === assetToClean && c.status !== 'RETURNED');
              allActiveSlots.forEach(targetCa => {
                db.updateRow<ContractAsset>('contractAssets', targetCa.id, {
                  status: 'RETURNED',
                  actualReturnDate: targetCa.actualReturnDate || actualReturnDate,
                  inRegisteredAt: targetCa.inRegisteredAt || registeredAt,
                  updatedAt: registeredAt
                });
              });
            } else {
              db.updateRow<ContractAsset>('contractAssets', ca.id, {
                status: 'RETURNED',
                actualReturnDate: ca.actualReturnDate || actualReturnDate,
                inRegisteredAt: ca.inRegisteredAt || registeredAt,
                updatedAt: registeredAt
              });
            }
          }
        });

        // 계약에 남은 대여/체결 자산 슬롯이 있는지 확인
        const remainingActiveAssets = cAssets.filter(ca => 
          !(ca.assetId && reviewedAssetIds.includes(ca.assetId)) && ca.status !== 'RETURNED'
        );

        // 💡 [단일 진실의 원천]: 모든 장비가 회수 완료되었을 때 마스터 계약을 COMPLETED로 종료하고 종료일을 입고일로 덮어쓰기
        if (remainingActiveAssets.length === 0) {
          const contract = db.contracts.find(c => c.id === delivery.contractId);
          if (contract) {
            db.updateRow<Contract>('contracts', delivery.contractId, {
              status: 'COMPLETED',
              endDate: actualReturnDate, // 💡 마지막 자산의 입고일로 동기화
              updatedAt: registeredAt
            });
            db.insertRow<ContractHistory>('contractHistory', {
              contractId: contract.id,
              changeType: 'TERMINATE',
              changeDate: actualReturnDate,
              prevEndDate: contract.endDate,
              newEndDate: actualReturnDate,
              description: `[자동 마감] 마지막 자산 배차 반납(입고일: ${actualReturnDate})에 따른 마스터 계약 마감 및 종료일 동기화`,
              createdAt: registeredAt
            });
          }
        } else {
          // 잔여 장비가 남아있지만 이번 반납일이 마스터 계약 종료일보다 늦은 경우 후행 연장
          const contract = db.contracts.find(c => c.id === delivery.contractId);
          if (contract && actualReturnDate > contract.endDate) {
            db.updateRow<Contract>('contracts', delivery.contractId, {
              endDate: actualReturnDate,
              updatedAt: registeredAt
            });
            db.insertRow<ContractHistory>('contractHistory', {
              contractId: contract.id,
              changeType: 'EXTEND',
              changeDate: actualReturnDate,
              prevEndDate: contract.endDate,
              newEndDate: actualReturnDate,
              description: `[자동 연장] 자산 배차 반납(입고일: ${actualReturnDate})에 따른 마스터 계약 강제 연장 동기화`,
              createdAt: registeredAt
            });
          }
        }
      }
    }

    await db.awaitPendingWrites(); refreshAllData(); };

  // 💡 [사장님 지시] 입고 등록 (입고번호, 하위번호 INB-XXXX-01, 증상별 사진 및 자산정비수리 자동연동, 불량 시 REPAIRING 전환)
  const registerInboundAsset = async (data: {
    assetId: string;
    returnDate: string;
    maintenanceScore?: number;
    memo?: string;
    inboundNo?: string;
    defects?: InboundDefectDetail[];
    photos?: string[];
    otherDefectText?: string;
    targetAssetStatus?: Asset['status'];
  }) => {
    const asset = db.assets.find(a => a.id === data.assetId);
    if (!asset) throw new Error('해당 자산을 찾을 수 없습니다.');

    // 💡 [단일 진실의 원천 완결]: 자산이 입고(물리적 회수)되었으므로, 해당 자산을 점유하고 있는 *모든* 활성 ContractAsset 슬롯을 탐색하여 청소합니다.
    const activeCAs = db.contractAssets.filter(c => c.assetId === data.assetId && c.status !== 'RETURNED');
    const ca = activeCAs.length > 0 ? activeCAs[0] : db.contractAssets.find(c => c.assetId === data.assetId);
    
    const contract = ca ? db.contracts.find(ct => ct.id === ca.contractId) : null;
    const customer = contract ? db.customers.find(cu => cu.id === contract.customerId) : null;
    const site = contract ? db.sites.find(s => s.id === contract.siteId) : null;

    const score = data.maintenanceScore || 0;
    const hasDefect = score > 0 || (data.defects && data.defects.length > 0) || Boolean(data.otherDefectText);
    // 자산 상태: 점수 0점이고 결함 없으면 임대가능, 이상 시 정비중 또는 전달된 targetAssetStatus
    const nextAssetStatus: Asset['status'] = data.targetAssetStatus || (!hasDefect ? 'AVAILABLE' : 'REPAIRING');

    // 💡 [입고 번호 채번]
    const assignedInboundNo = data.inboundNo || db.generateNextId('inboundNo', db.assetInOutLogs as any);

    // 💡 [불량 증상 하위 번호 결합 (예: INB-20260809-001-01)]
    const processedDefects: InboundDefectDetail[] = (data.defects || []).map((d, idx) => ({
      ...d,
      subNo: d.subNo || `${assignedInboundNo}-${String(idx + 1).padStart(2, '0')}`
    }));

    const defectsJsonStr = processedDefects.length > 0 ? JSON.stringify(processedDefects) : undefined;
    const defectSummary = processedDefects.map(d => `[${d.subNo}] ${d.checkitemName}(+${d.score}점)`).join(', ');
    const fullDefectSummary = [defectSummary, data.otherDefectText ? `[기타] ${data.otherDefectText}` : ''].filter(Boolean).join(' | ');

    const registeredAt = new Date().toISOString();

    // 1. 자산 마스터 갱신 (정비필요항목 note 저장)
    db.updateRow<Asset>('assets', asset.id, {
      status: nextAssetStatus,
      maintenanceScore: score,
      note: hasDefect ? fullDefectSummary : (score === 0 ? '정상 입고 점검 완료' : asset.note),
      currentCustomerId: '',
      currentSiteId: '',
      contractStart: '',
      contractEnd: '',
      updatedAt: registeredAt
    });

    // 2. 계약 자산 반납 갱신 (청구 연동: actualReturnDate는 실제 입고일, inRegisteredAt은 전산 등록일시)
    const prevCaEndDate = ca?.endDate || contract?.endDate || data.returnDate;
    const prevContractEndDate = contract?.endDate || data.returnDate;
    if (activeCAs.length > 0 || ca) {
      if (activeCAs.length > 0) {
        activeCAs.forEach(targetCa => {
          db.updateRow<ContractAsset>('contractAssets', targetCa.id, {
            status: 'RETURNED',
            endDate: data.returnDate,
            actualReturnDate: data.returnDate,
            inRegisteredAt: registeredAt,
            updatedAt: registeredAt
          });
        });
      } else if (ca && ca.status === 'RENTED') {
        db.updateRow<ContractAsset>('contractAssets', ca.id, {
          status: 'RETURNED',
          endDate: data.returnDate,
          actualReturnDate: data.returnDate,
          inRegisteredAt: registeredAt,
          updatedAt: registeredAt
        });
      }

      // 💡 [단일 진실의 원천]: 해당 계약의 잔여 장비가 0대가 되었는지 확인하고 마감 처리 (동기화)
      if (contract) {
        const updatedCaIds = activeCAs.map(c => c.id);
        if (ca && !updatedCaIds.includes(ca.id)) updatedCaIds.push(ca.id);
        
        const remainingAssets = db.contractAssets.filter(c => 
          c.contractId === contract.id && 
          c.status !== 'RETURNED' && 
          !updatedCaIds.includes(c.id)
        );

        if (remainingAssets.length === 0) {
          // 마지막 장비 반납 -> 계약 완전 마감 (종료일 덮어쓰기)
          db.updateRow<Contract>('contracts', contract.id, {
            status: 'COMPLETED',
            endDate: data.returnDate, // 마지막 자산 반납일로 완전 동기화 (단축/연장 모두 포함)
            updatedAt: registeredAt
          });
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: contract.id,
            changeType: 'TERMINATE',
            changeDate: data.returnDate,
            prevEndDate: prevContractEndDate,
            newEndDate: data.returnDate,
            description: `[자동 마감] 마지막 자산(${asset.assetNo}) 반납(입고일: ${data.returnDate})에 따른 마스터 계약 마감 및 종료일 동기화 (원래종료일: ${prevContractEndDate}, 원래슬롯종료일: ${prevCaEndDate})`,
            createdAt: registeredAt
          });
        } else if (data.returnDate > contract.endDate) {
          // 잔여 장비가 남아있지만, 이번 장비가 지연 반납된 경우 -> 계약 연장만
          db.updateRow<Contract>('contracts', contract.id, {
            endDate: data.returnDate,
            updatedAt: registeredAt
          });
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: contract.id,
            changeType: 'EXTEND',
            changeDate: data.returnDate,
            prevEndDate: prevContractEndDate,
            newEndDate: data.returnDate,
            description: `[자동 연장] 자산(${asset.assetNo}) 입고 처리(입고일: ${data.returnDate})에 따른 마스터 계약 강제 연장 동기화 (원래종료일: ${prevContractEndDate}, 원래슬롯종료일: ${prevCaEndDate})`,
            createdAt: registeredAt
          });
        } else {
          // 다수 장비 계약 중 일부 장비 조기/정상 반납 -> 슬롯 원래 종료일 스냅샷 보존
          db.insertRow<ContractHistory>('contractHistory', {
            contractId: contract.id,
            changeType: 'ASSET_PERIOD_CHANGE',
            changeDate: data.returnDate,
            prevEndDate: prevCaEndDate,
            newEndDate: data.returnDate,
            description: `[부분 입고] 자산(${asset.assetNo}) 반납 입고(입고일: ${data.returnDate}) 처리 (원래슬롯종료일: ${prevCaEndDate})`,
            createdAt: registeredAt
          });
        }
      }
    }

    // 3. 자산 정비수리 대장 연동 (결함 발생 시 자동 PENDING 정비 건 발행)
    let createdRepairId: string | undefined = undefined;
    if (hasDefect) {
      const repairId = db.generateNextId('repairs', db.repairs);
      createdRepairId = repairId;
      
      db.insertRow<Repair>('repairs', {
        id: repairId,
        assetId: asset.id,
        assetNo: asset.assetNo,
        modelName: asset.modelName,
        contractId: contract?.id,
        customerId: customer?.id,
        customerName: customer?.name || '입고 점검처',
        siteId: site?.id,
        siteName: site?.name || '주기장',
        requestDate: data.returnDate,
        status: 'PENDING',
        workCategory: 'YARD_INTERNAL',
        workLocation: 'YARD',
        source: 'INBOUND_INSPECTION',
        details: `입고검수 자동 정비 접수: ${assignedInboundNo}\n정비 필요 항목: ${fullDefectSummary}\n비고: ${data.memo || '이상 무'}`,
        totalCost: 0,
        billableToCustomer: false,
        inboundNo: assignedInboundNo,
        defectsJson: defectsJsonStr,
        evidenceImages: data.photos || [],
        targetAssetStatus: 'REPAIRING',
        inspectionItemCode: processedDefects.length > 0 ? processedDefects.map(d => d.checkitemId).join(',') : undefined,
        degradationScore: score,
        createdAt: registeredAt,
        updatedAt: registeredAt
      });

      // 🚀 [단일 업무 인계 파이프라인] 주기장 정비팀에 입고 정비 ToDo 영구 적재
      await issueHandoverTask({
        category: 'INBOUND_REPAIR_DEFECT',
        title: `[입고 장비 정비] ${asset.assetNo} (${asset.modelName})`,
        content: `입고 결함 발견 (+${score}점): ${fullDefectSummary || '정비 요망'}`,
        targetDept: 'YARD',
        priority: score >= 5 ? 'HIGH' : 'NORMAL',
        actionUrl: '/repairs',
        entityType: 'REPAIR',
        entityId: repairId,
        senderId: currentUser?.id,
        senderName: currentUser?.name
      });
    }

    // 🟢 회수 배차 및 관련 선행 ToDo 자동 상계 & 회수 배차 상태 DELIVERED 완결
    const matchedReturnDelivery = db.deliveries.find(d => 
      (d.type === 'INBOUND' || d.type === 'RETURN') &&
      d.status !== 'CANCELLED' &&
      (d.contractId === contract?.id || (d.assetIds && d.assetIds.split(',').includes(asset.id)))
    );

    if (matchedReturnDelivery) {
      const delAssetIds = matchedReturnDelivery.assetIds ? matchedReturnDelivery.assetIds.split(',').filter(Boolean) : [];
      const allDelAssetsInbound = delAssetIds.length === 0 || delAssetIds.every(id => {
        if (id === asset.id) return true;
        const otherAsset = db.assets.find(a => a.id === id);
        return otherAsset && otherAsset.status !== 'RENTED';
      });

      if (allDelAssetsInbound && matchedReturnDelivery.status !== 'DELIVERED') {
        db.updateRow<Delivery>('deliveries', matchedReturnDelivery.id, {
          status: 'DELIVERED',
          unloadingCompletedAt: registeredAt,
          updatedAt: registeredAt
        });
      }
    }

    await clearHandoverTasks({
      entityId: asset.id,
      completionAction: 'INBOUND_REGISTERED'
    });
    if (contract?.id) {
      await clearHandoverTasks({
        entityId: contract.id,
        category: 'DISPATCH_REQUEST',
        completionAction: 'INBOUND_REGISTERED'
      });
    }

    // 4. 자산 입출고 이력 무누락 기록 (INBOUND: eventDate/inDate는 실제 입고일, inRegisteredAt/createdAt은 등록일시)
    const ownershipNote = asset.ownerType === 'RENTED' && asset.antiEntrapmentOwnership === 'VENDOR'
      ? ' [협착방지봉: 원사 소유(탈거금지)]'
      : asset.ownerType === 'RENTED' && asset.antiEntrapmentOwnership === 'OURS'
      ? ' [협착방지봉: 당사 소유(회수대상)]'
      : '';

    db.insertRow<AssetInOutLog>('assetInOutLogs', {
      assetId: asset.id,
      assetNo: asset.assetNo,
      modelName: asset.modelName,
      type: 'INBOUND',
      inboundNo: assignedInboundNo,
      deliveryId: matchedReturnDelivery?.id || (data as any).deliveryId || undefined,
      eventDate: data.returnDate,        // 기준 일자 (실제 입고일)
      inDate: data.returnDate,           // 💡 실제 현장 입고일 (YYYY-MM-DD, 청구 및 가동일수 정산 기준)
      inRegisteredAt: registeredAt,     // 💡 실제 전산 입고 등록 일시 (ISO String, 행위 발생 감사 기준)
      customerId: customer?.id || '',
      customerName: customer?.name || '',
      siteId: site?.id || '',
      siteName: site?.name || '',
      repairId: createdRepairId,
      maintenanceScore: score,
      defectsJson: defectsJsonStr,
      memo: (data.memo || (hasDefect ? `불량 입고 등록 (${fullDefectSummary})` : '정상 입고 등록 완결')) + ownershipNote,
      createdAt: registeredAt
    });

    await db.awaitPendingWrites(); refreshAllData(); };

  // 💡 [사장님 지시] 입고 취소 롤백 (휴먼에러 원상복구 6단계 트랜잭션: 계약종료일·계약상태·체결자산·정비·배차·감사로그 100% 복원)
  const cancelInboundAsset = async (logId: string, cancelReason?: string) => {
    // 🔒 테넌트 정식 오픈 전까지 개발자 계정 또는 데모 모드에서만 실행 허용
    if (!isSystemDeveloperUser(currentUser) && !isDemoMode()) {
      throw new Error('입고 취소 기능은 현재 개발자 전용으로 제한되어 있습니다.');
    }

    const log = db.assetInOutLogs.find(l => l.id === logId && l.type === 'INBOUND');
    if (!log) throw new Error('해당 입고 이력 로그를 찾을 수 없거나 이미 취소된 건입니다.');

    const asset = db.assets.find(a => a.id === log.assetId);
    if (!asset) throw new Error('연관 자산을 찾을 수 없습니다.');

    // [Step 0] 사전 안전 검증
    // 0-1. 입고 등록 이후 타 계약에 이미 재출고/배정되었는지 검사
    const hasSubsequentOutbound = db.assetInOutLogs.some(l =>
      l.assetId === asset.id &&
      l.type === 'OUTBOUND' &&
      l.createdAt && log.createdAt &&
      l.createdAt > log.createdAt
    );
    const isAssignedToAnotherCustomer =
      (asset.status === 'RENTED' || asset.status === 'ASSIGNED') &&
      Boolean(asset.currentCustomerId) &&
      Boolean(log.customerId) &&
      asset.currentCustomerId !== log.customerId;

    if (hasSubsequentOutbound || isAssignedToAnotherCustomer) {
      throw new Error(`자산(${asset.assetNo})은 입고 등록 이후 이미 다른 계약에 배정 또는 재출고되어 입고를 취소할 수 없습니다.`);
    }

    // 0-2. 입고 결함으로 자동 생성된 정비 건이 이미 완료 마감되었는지 검사
    const linkedRepair = log.repairId ? db.repairs.find(r => r.id === log.repairId) : undefined;
    if (linkedRepair && linkedRepair.status === 'COMPLETED') {
      throw new Error(`해당 입고 건으로 자동 접수된 정비(${linkedRepair.id})가 이미 완료 마감되어 부품/수리비가 반영되었습니다. 정비 내역을 먼저 취소 또는 확인해 주십시오.`);
    }

    const nowIso = new Date().toISOString();
    const inboundDateStr = log.inDate || log.eventDate;

    // [Step 1] 해당 입고 건과 매칭되는 정확한 체결 자산 슬롯 및 마스터 계약 특정
    const candidateCAs = db.contractAssets
      .filter(c => c.assetId === asset.id)
      .sort((a, b) => (b.inRegisteredAt || b.updatedAt || b.createdAt || '').localeCompare(a.inRegisteredAt || a.updatedAt || a.createdAt || ''));

    const ca =
      candidateCAs.find(c => c.status === 'RETURNED' && c.actualReturnDate === inboundDateStr) ||
      candidateCAs.find(c => {
        if (c.status !== 'RETURNED') return false;
        const ct = db.contracts.find(con => con.id === c.contractId);
        return ct && log.customerId && ct.customerId === log.customerId;
      }) ||
      candidateCAs.find(c => c.status === 'RETURNED') ||
      candidateCAs[0];

    const contract = ca ? db.contracts.find(ct => ct.id === ca.contractId) : undefined;

    // [Step 2] 자동 단축/변경된 계약 종료일 및 슬롯 종료일 역추적 산출
    let restoredContractEndDate = contract?.endDate || '';
    let restoredCaEndDate = ca?.endDate || '';

    if (contract) {
      const contractHistories = db.contractHistory
        .filter(h => h.contractId === contract.id)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      // 입고 등록 시 자동 기록된 TERMINATE / EXTEND / ASSET_PERIOD_CHANGE 이력 탐색
      const matchedAutoHistory = contractHistories.find(h =>
        (h.changeType === 'TERMINATE' || h.changeType === 'EXTEND' || h.changeType === 'ASSET_PERIOD_CHANGE') &&
        (h.newEndDate === inboundDateStr || h.changeDate === inboundDateStr || (h.description && h.description.includes(asset.assetNo)))
      );

      if (matchedAutoHistory?.prevEndDate) {
        if (matchedAutoHistory.changeType === 'TERMINATE' || matchedAutoHistory.changeType === 'EXTEND') {
          restoredContractEndDate = matchedAutoHistory.prevEndDate;
        }
        restoredCaEndDate = matchedAutoHistory.prevEndDate;
      }

      // description 내 '원래슬롯종료일: YYYY-MM-DD' 또는 '원래종료일: YYYY-MM-DD' 파싱 보강
      if (matchedAutoHistory?.description) {
        const slotMatch = matchedAutoHistory.description.match(/원래슬롯종료일:\s*(\d{4}-\d{2}-\d{2})/);
        const contractMatch = matchedAutoHistory.description.match(/원래종료일:\s*(\d{4}-\d{2}-\d{2})/);
        if (slotMatch?.[1]) restoredCaEndDate = slotMatch[1];
        if (contractMatch?.[1]) restoredContractEndDate = contractMatch[1];
      }

      // 만약 이전 이력에 prevEndDate가 없는 레거시 데이터라면 직전 계약 이력 또는 동일 계약 타 자산 종료일로 폴백 복원
      if (!matchedAutoHistory?.prevEndDate && restoredContractEndDate === inboundDateStr) {
        const priorHistory = contractHistories.find(h =>
          h.id !== matchedAutoHistory?.id &&
          (h.changeType === 'REGISTER' || h.changeType === 'EXTEND' || h.changeType === 'SHORTEN') &&
          Boolean(h.newEndDate) &&
          h.newEndDate !== inboundDateStr
        );
        const siblingMaxEndDate = db.contractAssets
          .filter(c => c.contractId === contract.id && c.id !== ca?.id && c.endDate)
          .reduce((max, c) => (c.endDate > max ? c.endDate : max), '');

        if (priorHistory?.newEndDate) {
          restoredContractEndDate = priorHistory.newEndDate;
        } else if (siblingMaxEndDate && siblingMaxEndDate > restoredContractEndDate) {
          restoredContractEndDate = siblingMaxEndDate;
        }
      }

      if (!restoredCaEndDate || restoredCaEndDate === inboundDateStr) {
        restoredCaEndDate = restoredContractEndDate || ca?.endDate || '';
      }

      // 마스터 계약 상태 및 계약 종료일 원상복구
      db.updateRow<Contract>('contracts', contract.id, {
        status: 'ACTIVE',
        endDate: restoredContractEndDate || contract.endDate,
        updatedAt: nowIso
      });
    }

    // [Step 3] 계약 체결 자산 슬롯 대여중 및 원래 종료일 복원
    if (ca) {
      db.updateRow<ContractAsset>('contractAssets', ca.id, {
        status: 'RENTED',
        endDate: restoredCaEndDate || ca.endDate,
        actualReturnDate: undefined,
        inRegisteredAt: undefined,
        updatedAt: nowIso
      });
    }

    // [Step 4] 자산 마스터 대여중 및 계약 귀속 속성 원상복구
    db.updateRow<Asset>('assets', asset.id, {
      status: 'RENTED',
      currentCustomerId: contract?.customerId || log.customerId || asset.currentCustomerId || '',
      currentSiteId: contract?.siteId || log.siteId || asset.currentSiteId || '',
      contractStart: ca?.startDate || contract?.startDate || asset.contractStart || '',
      contractEnd: restoredCaEndDate || restoredContractEndDate || asset.contractEnd || '',
      monthlyRentalFee: ca?.monthlyRentalFee ?? asset.monthlyRentalFee,
      dailyRentalFee: ca?.dailyRentalFee ?? asset.dailyRentalFee,
      maintenanceScore: 0,
      note: '입고 취소 롤백 (대여중 원복)',
      updatedAt: nowIso
    });

    // [Step 5] 연동된 자동 생성 입고 정비 및 회수 배차 상태 원상복구
    if (linkedRepair && linkedRepair.status === 'PENDING') {
      db.deleteRow('repairs', linkedRepair.id);
      await clearHandoverTasks({
        entityId: linkedRepair.id,
        completionAction: 'INBOUND_CANCELLED',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name
      });
    }

    if (log.deliveryId) {
      const matchedDel = db.deliveries.find(d => d.id === log.deliveryId);
      if (matchedDel && (matchedDel.type === 'INBOUND' || matchedDel.type === 'RETURN') && matchedDel.status === 'DELIVERED') {
        db.updateRow<Delivery>('deliveries', matchedDel.id, {
          status: 'DISPATCHED',
          unloadingCompletedAt: undefined,
          updatedAt: nowIso
        });
      }
    }

    // [Step 6] 오등록 입고 로그 제거 및 입고 취소 감사 이력·계약 이력 무누락 기록
    db.deleteRow('assetInOutLogs', logId);

    db.insertRow<AssetInOutLog>('assetInOutLogs', {
      assetId: asset.id,
      assetNo: asset.assetNo,
      modelName: asset.modelName,
      type: 'INBOUND_CANCEL',
      inboundNo: log.inboundNo,
      eventDate: nowIso.split('T')[0],
      customerId: contract?.customerId || log.customerId || '',
      customerName: log.customerName || '',
      siteId: contract?.siteId || log.siteId || '',
      siteName: log.siteName || '',
      memo: `[입고 취소 롤백] 오등록 입고일(${inboundDateStr}) 취소 ➔ 대여중 복원 및 계약종료일(${restoredContractEndDate || '-'}) 원복 (사유: ${cancelReason || '사용자 휴먼에러 입고 취소'})`,
      createdAt: nowIso
    });

    if (contract) {
      db.insertRow<ContractHistory>('contractHistory', {
        contractId: contract.id,
        changeType: 'EXTEND',
        changeDate: nowIso.split('T')[0],
        prevEndDate: inboundDateStr,
        newEndDate: restoredContractEndDate || contract.endDate,
        description: `[입고 취소 원상복구] 자산(${asset.assetNo}) 휴먼에러 입고 취소 ➔ 계약상태(진행중) 및 계약종료일(${inboundDateStr} ➔ ${restoredContractEndDate || contract.endDate}) 원복 (사유: ${cancelReason || '사용자 휴먼에러 입고 취소'})`,
        createdAt: nowIso
      });
    }

    await db.awaitPendingWrites(); refreshAllData(); };

  const registerRepair = async (repairData: Partial<Repair>, usedConsumables: { consumableId: string; quantity: number }[]) => {
    const repairId = repairData.id || db.generateNextId('repairs', db.repairs);
    const totalRepairCost = repairData.totalCost ?? 0;
    const maintenanceType = repairData.maintenanceType || (repairData.repairType === 'EXTERNAL' ? 'EXTERNAL' : 'INHOUSE_REPAIR');
    const repairStatus = repairData.status || 'COMPLETED';

    const targetAsset = db.assets.find(a => a.id === repairData.assetId);
    let resolvedCustomerName = repairData.customerName || '';
    let resolvedSiteName = repairData.siteName || '';
    let resolvedContractId = repairData.contractId;

    // 대여중 장비인 경우 현재 계약의 고객사/현장 자동 매핑
    if (targetAsset && targetAsset.status === 'RENTED') {
      const activeContractAsset = db.contractAssets.find(ca => ca.assetId === targetAsset.id && ca.status !== 'RETURNED');
      if (activeContractAsset) {
        const activeContract = db.contracts.find(c => c.id === activeContractAsset.contractId);
        if (activeContract) {
          resolvedContractId = resolvedContractId || activeContract.id;
          const cust = db.customers.find(cu => cu.id === activeContract.customerId);
          const st = db.sites.find(s => s.id === activeContract.siteId);
          resolvedCustomerName = cust?.name || resolvedCustomerName;
          resolvedSiteName = st?.name || resolvedSiteName;
        }
      }
    }

    if (repairData.id) {
      db.updateRow<Repair>('repairs', repairData.id, {
        ...repairData,
        contractId: resolvedContractId,
        maintenanceType,
        status: repairStatus,
        customerName: resolvedCustomerName,
        siteName: resolvedSiteName,
        updatedAt: new Date().toISOString()
      });
    } else {
      db.insertRow<Repair>('repairs', {
        id: repairId,
        contractId: resolvedContractId,
        assetId: repairData.assetId || '',
        assetNo: targetAsset?.assetNo || repairData.assetNo || '현장확인',
        modelName: targetAsset?.modelName || repairData.modelName || '고소작업대',
        mechanicId: repairData.mechanicId || currentUser?.id || '',
        maintenanceType,
        repairType: repairData.repairType || (maintenanceType === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL'),
        requestDate: repairData.requestDate || new Date().toISOString().split('T')[0],
        scheduleDate: repairData.scheduleDate,
        repairDate: repairData.repairDate || new Date().toISOString().split('T')[0],
        status: repairStatus,
        unresolvedReason: repairData.unresolvedReason,
        nextAction: repairData.nextAction,
        targetAssetStatus: repairData.targetAssetStatus,
        vendorId: repairData.vendorId,
        details: repairData.details || '',
        totalCost: totalRepairCost,
        billableType: repairData.billableType || (repairData.billableToCustomer ? 'BILLABLE' : 'FREE'),
        billableAmount: repairData.billableAmount || 0,
        billableToCustomer: repairData.billableType === 'BILLABLE' || repairData.billableToCustomer || false,
        inspectionItemId: repairData.inspectionItemId,
        inspectionItemCode: repairData.inspectionItemCode,
        degradationScore: repairData.degradationScore || 0,
        durationMinutes: repairData.durationMinutes,
        spentManHours: repairData.spentManHours ?? (repairData.durationMinutes ? repairData.durationMinutes / 60 : undefined),
        beforeImage: repairData.beforeImage || '',
        afterImage: repairData.afterImage || '',
        evidenceImages: repairData.evidenceImages || [],
        workLocation: repairData.workLocation || 'YARD',
        stockSource: repairData.stockSource || 'YARD_STOCK',
        customerName: resolvedCustomerName,
        siteName: resolvedSiteName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 소모품 재고 차감: 주기장 정비이거나 stockSource가 YARD_STOCK/CENTRAL_HQ인 경우 주기장 재고에서 우선 차감
    const isYardDepotRepair = repairData.workLocation === 'YARD' || repairData.stockSource === 'YARD_STOCK' || repairData.stockSource === 'CENTRAL_HQ' || maintenanceType === 'INHOUSE_REPAIR';
    const effectiveMechanicId = repairData.mechanicId || currentUser?.id;
    const mechanic = db.users.find(u => u.id === effectiveMechanicId);
    const mechanicName = mechanic?.name || '정비사';

    usedConsumables.forEach(uc => {
      const consumable = db.consumables.find(c => c.id === uc.consumableId);
      if (!consumable) return;

      let remainingToDeduct = uc.quantity;
      let hqDeducted = 0;

      if (!isYardDepotRepair && effectiveMechanicId) {
        // 1. 기사 차량 재고에서 차감 (현장 출장 AS인 경우)
        const mechStocks = db.mechanicConsumableStocks
          .filter(s => s.mechanicId === effectiveMechanicId && s.consumableId === uc.consumableId && s.stockQty > 0)
          .sort((a, b) => {
            const lotA = db.consumableLots.find(l => l.id === a.lotId);
            const lotB = db.consumableLots.find(l => l.id === b.lotId);
            return new Date(lotA?.inboundDate || 0).getTime() - new Date(lotB?.inboundDate || 0).getTime();
          });

        for (const stock of mechStocks) {
          if (remainingToDeduct <= 0) break;
          const deduct = Math.min(stock.stockQty, remainingToDeduct);
          
          db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', stock.id, {
            stockQty: stock.stockQty - deduct,
            updatedAt: new Date().toISOString()
          });

          db.insertRow<ConsumableLog>('consumableLogs', {
            consumableId: consumable.id,
            lotId: stock.lotId,
            type: 'OUTBOUND',
            quantity: deduct,
            unitPrice: consumable.unitPrice,
            targetAssetId: repairData.assetId,
            userId: currentUser?.id,
            mechanicId: effectiveMechanicId,
            fromLocation: `${mechanicName} 차량`,
            toLocation: `현장 장비(${targetAsset?.assetNo || 'N/A'})`,
            actionDate: repairData.repairDate || new Date().toISOString().split('T')[0],
            description: `[차량재고 소진] 정비(${repairId}) ${mechanicName} 차량에서 현장 투입`,
            createdAt: new Date().toISOString()
          });

          remainingToDeduct -= deduct;
        }
      }

      if (remainingToDeduct > 0) {
        hqDeducted = remainingToDeduct;
        // 2. 주기장 재고에서 차감 (주기장 정비 또는 차량 재고 부족분)
        const lots = db.consumableLots
          .filter(l => l.consumableId === consumable.id && l.currentQty > 0)
          .sort((a, b) => new Date(a.inboundDate).getTime() - new Date(b.inboundDate).getTime());

        for (const lot of lots) {
          if (remainingToDeduct <= 0) break;
          const deduct = Math.min(lot.currentQty, remainingToDeduct);
          
          db.updateRow<ConsumableLot>('consumableLots', lot.id, {
            currentQty: lot.currentQty - deduct,
            updatedAt: new Date().toISOString()
          });

          db.insertRow<ConsumableLog>('consumableLogs', {
            consumableId: consumable.id,
            lotId: lot.id,
            type: 'OUTBOUND',
            quantity: deduct,
            unitPrice: lot.unitPrice,
            targetAssetId: repairData.assetId,
            userId: currentUser?.id,
            fromLocation: '주기장 재고',
            toLocation: `장비(${targetAsset?.assetNo || 'N/A'})`,
            actionDate: repairData.repairDate || new Date().toISOString().split('T')[0],
            description: `[주기장 재고 투입] 정비(${repairId}) 주기장 부품 투입`,
            createdAt: new Date().toISOString()
          });

          remainingToDeduct -= deduct;
        }

        if (hqDeducted > 0) {
          const nextQty = Math.max(0, (consumable.stockQty || 0) - hqDeducted);
          db.updateRow<Consumable>('consumables', consumable.id, {
            stockQty: nextQty,
            updatedAt: new Date().toISOString()
          });
        }
      }

      db.insertRow<RepairConsumable>('repairConsumables', {
        repairId,
        consumableId: uc.consumableId,
        quantity: uc.quantity,
        unitPrice: consumable.unitPrice,
        cost: consumable.unitPrice * uc.quantity
      });
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const updateRepairStatus = async (
    repairId: string, 
    status: Repair['status'], 
    unresolvedReason?: string, 
    nextAction?: Repair['nextAction'],
    targetAssetStatus?: Asset['status']
  ) => {
    const existing = db.repairs.find(r => r.id === repairId);
    if (!existing) return;

    const today = new Date().toISOString().split('T')[0];
    db.updateRow<Repair>('repairs', repairId, {
      status,
      repairDate: status === 'COMPLETED' ? today : existing.repairDate,
      unresolvedReason: unresolvedReason ?? existing.unresolvedReason,
      nextAction: nextAction ?? existing.nextAction,
      targetAssetStatus: targetAssetStatus ?? existing.targetAssetStatus,
      updatedAt: new Date().toISOString()
    });

    // 🌟 자산 상태 전이 명시적 지원
    if (existing.assetId && targetAssetStatus) {
      const targetAsset = db.assets.find(a => a.id === existing.assetId);
      if (targetAsset) {
        db.updateRow<Asset>('assets', targetAsset.id, {
          status: targetAssetStatus,
          maintenanceScore: targetAssetStatus === 'AVAILABLE' ? 0 : targetAsset.maintenanceScore,
          updatedAt: new Date().toISOString()
        });
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: targetAsset.id,
          assetNo: targetAsset.assetNo,
          modelName: targetAsset.modelName,
          type: 'REPAIR',
          eventDate: today,
          repairId: repairId,
          maintenanceScore: targetAssetStatus === 'AVAILABLE' ? 0 : targetAsset.maintenanceScore,
          memo: `[주기장 정비 상태 갱신] ${status} ➔ 자산상태 [${targetAssetStatus}] 전이`,
          createdAt: new Date().toISOString()
        });
      }
    }

    await db.awaitPendingWrites(); refreshAllData(); };

  const saveTransportDataOnFly = (companyName: string, driverName: string, contact: string, vehicleNo: string, vehicleType: string) => {
    if (!companyName && !driverName) return;

    let companyId = '';
    
    // 1. 운송업체 처리
    if (companyName) {
      const existingCompany = db.transportCompanies.find(c => c.name === companyName);
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const newCompany = db.insertRow<TransportCompany>('transportCompanies', {
          name: companyName,
          businessNo: '',
          contact: contact || '',
          memo: '자동 추가됨',
          createdAt: new Date().toISOString()
        });
        companyId = newCompany.id;
      }
    }

    // 2. 기사 처리
    if (driverName) {
      const existingDriver = db.transportDrivers.find(d => 
        d.driverName === driverName && (companyId ? d.companyId === companyId : true)
      );
      if (!existingDriver) {
        db.insertRow<TransportDriver>('transportDrivers', {
          companyId: companyId,
          driverName: driverName,
          driverContact: contact || '',
          vehicleNo: vehicleNo || '',
          vehicleType: vehicleType || '',
          createdAt: new Date().toISOString()
        });
      }
    }
    
    refreshAllData();
  };

  const saveCashFlowSnapshot = (snap: Omit<CashFlowSnapshot, 'id' | 'createdAt'>) => {
    db.insertRow<CashFlowSnapshot>('cashFlowSnapshots', {
      ...snap,
      createdAt: new Date().toISOString()
    });
    refreshAllData();
  };

  const deleteCashFlowSnapshot = (snapId: string) => {
    db.deleteRow('cashFlowSnapshots', snapId);
    refreshAllData();
  };

  const saveVendor = async (vendor: Vendor): Promise<Vendor> => {
    let result: Vendor;
    try {
      const existing = db.vendors.find(v => v.id === vendor.id);
      if (existing) {
        result = db.updateRow('vendors', vendor.id!, vendor) as Vendor;
      } else {
        result = db.insertRow('vendors', vendor) as Vendor;
      }
      if (db.pendingWrites.length > 0) {
        await db.awaitPendingWrites();
      }
      refreshAllData();
      return result;
    } catch (err: any) {
      console.error('saveVendor error:', err);
      throw err;
    }
  };

  const deleteVendor = (id: string) => {
    // ✅ 고아 레코드 방지: 연관 자산 또는 매입 정산건이 있으면 삭제 차단
    const linkedAssets = db.assets.filter(a => a.vendorId === id);
    const linkedSettlements = db.purchaseSettlements.filter(s => s.vendorId === id);
    if (linkedAssets.length > 0 || linkedSettlements.length > 0) {
      showErrorModal(
        `⚠️ 해당 매입처를 삭제할 수 없습니다.\n\n` +
        (linkedAssets.length > 0 ? `■ 연결된 자산: ${linkedAssets.length}대\n` : '') +
        (linkedSettlements.length > 0 ? `■ 연결된 매입 정산건: ${linkedSettlements.length}건\n` : '') +
        `\n연결된 자산/정산을 먼저 해제한 후 삭제하십시오.`,
        '매입처 삭제 불가'
      );
      return;
    }
    db.deleteRow('vendors', id);
    refreshAllData();
  };

  // 💡 전사 매입처 거래개시일 및 매입누적거래액 일괄 재집계/동기화 헬퍼 (헌장 4.1, 5.2)
  const recalculateAllVendorMetrics = async (): Promise<{ updatedCount: number; totalAmount: number }> => {
    let updatedCount = 0;
    let grandTotal = 0;
    const allVendors = [...db.vendors];
    const allAssets = db.assets.filter(a => a.ownerType === 'OWNED');
    const allSettlements = db.purchaseSettlements;

    for (const v of allVendors) {
      const matchedAssets = allAssets.filter(a => 
        (a.vendorId && a.vendorId === v.id) || 
        (a.supplier && (a.supplier === v.name || a.supplier.includes(v.name) || v.name.includes(a.supplier)))
      );
      const assetTotal = matchedAssets.reduce((sum, a) => sum + (a.acquisitionPrice || 0), 0);
      
      const matchedSettlements = allSettlements.filter(s => 
        (s.vendorId && s.vendorId === v.id) || 
        (s.vendorName && (s.vendorName === v.name || s.vendorName.includes(v.name) || v.name.includes(s.vendorName)))
      );
      const settlementTotal = matchedSettlements.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const totalAmount = assetTotal + settlementTotal;
      grandTotal += totalAmount;

      const tradeDates: string[] = [];
      if (v.firstTradeDate) tradeDates.push(v.firstTradeDate);
      matchedAssets.forEach(a => { if (a.acquisitionDate) tradeDates.push(a.acquisitionDate); });
      matchedSettlements.forEach(s => {
        if (s.paymentDate) tradeDates.push(s.paymentDate);
        else if (s.settlementYm) tradeDates.push(`${s.settlementYm}-01`);
      });
      tradeDates.sort();
      const firstTradeDate = tradeDates.length > 0 ? tradeDates[0] : v.firstTradeDate;
      const lastTradeDate = tradeDates.length > 0 ? tradeDates[tradeDates.length - 1] : v.lastTradeDate;

      db.updateRow<Vendor>('vendors', v.id, {
        totalPurchaseAmount: totalAmount,
        firstTradeDate: firstTradeDate || undefined,
        lastTradeDate: lastTradeDate || undefined,
        updatedAt: new Date().toISOString()
      } as any);
      updatedCount++;
    }
    await db.awaitPendingWrites();
    refreshAllData();
    return { updatedCount, totalAmount: grandTotal };
  };

  // 월 1회 당사자산 감가상각 결산 마감 실행 (월말 의도적 실행)
  const executeMonthlyDepreciation = async (depreciationYm: string, note?: string) => {
    const existing = db.depreciationLogs.find(l => l.depreciationYm === depreciationYm);
    if (existing) {
      throw new Error(`이미 [${depreciationYm}] 연월의 감가상각 결산 마감이 완료되었습니다. (마감 처리일시: ${existing.executedAt.substring(0, 10)})`);
    }

    const ownedAssets = db.assets.filter(a => a.ownerType === 'OWNED');
    let totalDepnSum = 0;
    let updatedCount = 0;
    const nowIso = new Date().toISOString();

    // 마감 연월의 말일 시점 Date 생성 (예: '2026-08' -> 2026년 8월 31일 23:59:59)
    const [ymYear, ymMonth] = depreciationYm.split('-').map(Number);
    const closingDate = new Date(ymYear, ymMonth, 0, 23, 59, 59, 999); // 해당 월의 마지막 날

    for (const asset of ownedAssets) {
      const cost = asset.acquisitionPrice || 0;
      if (cost <= 0 || !asset.acquisitionDate || !asset.depreciationMonths || asset.depreciationMonths <= 0) {
        continue;
      }

      // 1. 취득일자 검증: 마감 연월 말일보다 미래에 취득된 자산은 당월 상각 대상 제외
      const acqDate = new Date(asset.acquisitionDate);
      if (isNaN(acqDate.getTime()) || acqDate > closingDate) {
        continue;
      }

      // 2. 매각 여부 및 매각일자 검증: 매각 상태이거나 매각일이 마감 연월 이전/당월인 경우 상각 정지 처리
      if (asset.status === 'SOLD' || asset.disposalDate) {
        const dispDateStr = asset.disposalDate ? asset.disposalDate.substring(0, 7) : '';
        // 이미 마감 연월 이전이나 당월 이전에 매각된 자산은 감가상각 발생 중단
        if (dispDateStr && dispDateStr < depreciationYm) {
          continue;
        }
      }

      const residualRate = asset.residualValueRate ?? 0;
      const residualValue = Math.round(cost * (residualRate / 100));
      const depreciableAmount = cost - residualValue;
      if (depreciableAmount <= 0) continue;

      const monthlyDepn = depreciableAmount / asset.depreciationMonths;
      if (monthlyDepn <= 0) continue;

      // 3. 취득일부터 마감연월 말일까지의 경과 개월수 정밀 산출
      let yearsDiff = closingDate.getFullYear() - acqDate.getFullYear();
      let monthsDiff = closingDate.getMonth() - acqDate.getMonth();
      let totalElapsedMonths = yearsDiff * 12 + monthsDiff + 1; // 취득당월 포함

      if (totalElapsedMonths < 1) totalElapsedMonths = 1;

      // 매각 자산은 매각 시점까지의 경과월수로 캡 제한
      if ((asset.status === 'SOLD' || asset.disposalDate) && asset.disposalDate) {
        const dispDate = new Date(asset.disposalDate);
        if (!isNaN(dispDate.getTime()) && dispDate <= closingDate) {
          let dispYears = dispDate.getFullYear() - acqDate.getFullYear();
          let dispMonths = dispDate.getMonth() - acqDate.getMonth();
          totalElapsedMonths = Math.max(1, dispYears * 12 + dispMonths + 1);
        }
      }

      // 내용월수 캡 제한
      const effectiveElapsed = Math.min(totalElapsedMonths, asset.depreciationMonths);

      // 이번 마감 연월 시점의 목표 누적상각액 (IFRS 정액법 정밀 산출)
      const targetAccum = Math.min(depreciableAmount, Math.round(monthlyDepn * effectiveElapsed));

      const currentAccum = asset.accumDepreciation || 0;

      // 당월 반영할 감가상각비 = 목표 누적상각액 - 기존 누적상각액
      const actualDepn = Math.max(0, targetAccum - currentAccum);

      if (actualDepn <= 0 && currentAccum >= targetAccum) continue;

      const newAccum = Math.min(depreciableAmount, currentAccum + actualDepn);
      const newBookValue = Math.max(residualValue, cost - newAccum);

      db.updateRow<Asset>('assets', asset.id, {
        accumDepreciation: newAccum,
        bookValue: newBookValue,
        updatedAt: nowIso
      });

      totalDepnSum += actualDepn;
      updatedCount++;
    }

    db.insertRow<DepreciationLog>('depreciationLogs', {
      depreciationYm,
      executedAt: nowIso,
      executedBy: currentUser?.name || currentUser?.id,
      targetAssetCount: updatedCount,
      totalDepreciationAmount: totalDepnSum,
      note: note || `[${depreciationYm}] 월말 당사자산 감가상각 결산 마감 완료`,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('executeMonthlyDepreciation sync error:', err);
    }

    refreshAllData();
    return { count: updatedCount, totalAmount: totalDepnSum };
  };

  // ─────────────────────────────────────────────────────────
  // 월말 매입 정산 관련 Mutators
  // ─────────────────────────────────────────────────────────

  /** 당월 운송료 + 소모품 매입 + 임차자산 임차료 + 외주 정비비 자동 집계 → PurchaseSettlement 생성 */
  const generateMonthlyPurchaseSettlements = async (ym: string): Promise<{ transport: number; consumable: number; lease: number; repair: number }> => {
    const nowIso = new Date().toISOString();
    let transportCount = 0;
    let consumableCount = 0;
    let leaseCount = 0;

    // ① 운송료 집계 — 당월 DELIVERED 배차 중 미정산 건 (고객직접운송 0원 건 제외)
    const deliveriesOfMonth = db.deliveries.filter(d => {
      if ((d.transportCompany || '').trim() === '고객직접운송') return false;
      const dateStr = d.unloadingDate || d.scheduledDate || d.requestDate;
      return dateStr?.startsWith(ym) &&
        d.status === 'DELIVERED' &&
        d.reconciliationStatus !== 'PAID' &&
        (d.deliveryCostConfirmed || 0) > 0;
    });

    // 운송사별 그루핑
    const transportGroups = new Map<string, typeof deliveriesOfMonth>();
    deliveriesOfMonth.forEach(d => {
      const key = d.transportCompany || '미지정 운송사';
      if (!transportGroups.has(key)) transportGroups.set(key, []);
      transportGroups.get(key)!.push(d);
    });

    for (const [vendorName, items] of transportGroups.entries()) {
      // 이미 동일 정산월+운송사 정산건이 있으면 스킵
      const exists = db.purchaseSettlements.find(p => p.settlementYm === ym && p.settlementType === 'TRANSPORT' && p.vendorName === vendorName);
      if (exists) continue;

      const totalAmount = items.reduce((sum, d) => sum + (d.deliveryCostConfirmed || d.deliveryCost || 0), 0);
      const settlement = db.insertRow<PurchaseSettlement>('purchaseSettlements', {
        settlementYm: ym,
        settlementType: 'TRANSPORT',
        vendorName,
        totalAmount,
        paidAmount: 0,
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso
      });

      items.forEach(d => {
        db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
          settlementId: settlement.id,
          sourceType: 'DELIVERY',
          sourceId: d.id,
          itemDescription: `배차 ${d.id} / ${d.dispatchCategory || d.type} (${d.unloadingDate || d.scheduledDate || d.requestDate})`,
          quantity: 1,
          unitPrice: d.deliveryCostConfirmed || d.deliveryCost || 0,
          amount: d.deliveryCostConfirmed || d.deliveryCost || 0,
          evidenceFileUrl: d.statementFileUrl,
          createdAt: nowIso
        });
      });
      transportCount++;
    }

    // ② 소모품 매입 집계 — 당월 COMPLETED / 입고 완료 구매신청 중 미정산 건
    const existingConsumableSettlementSourceIds = new Set(
      db.purchaseSettlementItems
        .filter(i => i.sourceType === 'CONSUMABLE_PURCHASE')
        .map(i => i.sourceId)
    );

    const purchasesOfMonth = db.consumablePurchases.filter(p => {
      if (existingConsumableSettlementSourceIds.has(p.id)) return false;
      // 헌장 1.1: 법인카드/즉시결제 완료 건은 외상매입(월말정산) 대장에서 완전 배제 (가짜 부채 생성 방지)
      if (p.paymentMethod === 'CARD') return false;
      
      const isFinished = p.status === 'COMPLETED' || p.receivedQty > 0;
      if (!isFinished) return false;
      const rawDate = p.completedDate || p.requestDate || p.createdAt || '';
      const normDate = rawDate.replace(/\./g, '-');
      return normDate.startsWith(ym);
    });

    // 판매처별 그루핑
    const consumableGroups = new Map<string, typeof purchasesOfMonth>();
    purchasesOfMonth.forEach(p => {
      const key = p.sellerName || '미지정 판매처';
      if (!consumableGroups.has(key)) consumableGroups.set(key, []);
      consumableGroups.get(key)!.push(p);
    });

    for (const [vendorName, items] of consumableGroups.entries()) {
      const groupTotalAmount = items.reduce((sum, p) => sum + (p.requestedQty * p.unitPrice), 0);

      let settlement = db.purchaseSettlements.find(p => p.settlementYm === ym && p.settlementType === 'CONSUMABLE' && p.vendorName === vendorName);
      if (!settlement) {
        settlement = db.insertRow<PurchaseSettlement>('purchaseSettlements', {
          settlementYm: ym,
          settlementType: 'CONSUMABLE',
          vendorName,
          totalAmount: groupTotalAmount,
          paidAmount: 0,
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso
        });
      } else {
        db.updateRow<PurchaseSettlement>('purchaseSettlements', settlement.id, {
          totalAmount: settlement.totalAmount + groupTotalAmount,
          updatedAt: nowIso
        });
      }

      // ⚠️ 외래키 제약조건 방지
      await db.awaitPendingWrites();

      items.forEach(p => {
        db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
          settlementId: settlement.id,
          sourceType: 'CONSUMABLE_PURCHASE',
          sourceId: p.id,
          itemDescription: `${p.modelName} × ${p.requestedQty}개 (${p.completedDate || p.requestDate})`,
          quantity: p.requestedQty,
          unitPrice: p.unitPrice,
          amount: p.requestedQty * p.unitPrice,
          evidenceFileUrl: p.statementFileUrl,
          createdAt: nowIso
        });
      });
      consumableCount++;
    }

    // ③ 임차자산(ownerType === 'RENTED') 임차료 집계 및 자동 정산 생성
    console.log('Generating settlements for ym:', ym);
    const rentedAssetsOfMonth = db.assets.filter(a => {
      console.log('Checking asset:', a.assetNo, 'ownerType:', a.ownerType, 'vendorId:', a.vendorId, 'fee:', a.monthlyRentFee);
      if (a.ownerType !== 'RENTED' || !a.monthlyRentFee || a.monthlyRentFee <= 0) return false;
      const vId = a.vendorId;
      if (!vId) return false;
      const start = a.rentStart ? a.rentStart.slice(0, 7) : '';
      const end = a.actualRentReturnDate ? a.actualRentReturnDate.slice(0, 7) : (a.rentEnd ? a.rentEnd.slice(0, 7) : '9999-12');
      return (!start || start <= ym) && ym <= end;
    });

    const rentedByVendor: Record<string, Asset[]> = {};
    rentedAssetsOfMonth.forEach(a => {
      const vId = a.vendorId!;
      if (!rentedByVendor[vId]) rentedByVendor[vId] = [];
      rentedByVendor[vId].push(a);
    });

    for (const [vendorId, aList] of Object.entries(rentedByVendor)) {
      const existing = db.purchaseSettlements.find(p => p.vendorId === vendorId && p.settlementYm === ym && p.settlementType === 'EQUIPMENT_LEASE');
      if (existing) continue;

      const vendor = db.vendors.find(v => v.id === vendorId);
      const vendorName = vendor?.name || aList[0]?.renter || '장비 임차처';
      const totalAmount = aList.reduce((sum, a) => sum + (a.monthlyRentFee || 0), 0);
      const settlementId = db.generateNextId('purchaseSettlements', db.purchaseSettlements);

      db.insertRow<PurchaseSettlement>('purchaseSettlements', {
        id: settlementId,
        settlementYm: ym,
        vendorId,
        vendorName,
        settlementType: 'EQUIPMENT_LEASE',
        totalAmount,
        paidAmount: 0,
        status: 'PENDING',
        itemCount: aList.length,
        createdAt: nowIso,
        updatedAt: nowIso
      });

      // ⚠️ 외래키 제약조건 방지 (PurchaseSettlement 먼저 생성 대기)
      await db.awaitPendingWrites();

      aList.forEach(a => {
        db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
          settlementId,
          sourceType: 'EQUIPMENT_LEASE',
          sourceId: a.id,
          itemDescription: `장비임차: ${a.assetNo} (${a.modelName})`,
          quantity: 1,
          unitPrice: a.monthlyRentFee || 0,
          amount: a.monthlyRentFee || 0,
          createdAt: nowIso
        });
      });
    }

    const leaseSettlementsOfMonth = db.purchaseSettlements.filter(p => 
      p.settlementYm === ym && 
      (p.settlementType === 'EQUIPMENT_LEASE')
    );
    leaseCount = leaseSettlementsOfMonth.length;

    // ④ [신규 추가] 외주 정비비 집계 — 정비수리에서 repairType === 'EXTERNAL'이고 status === 'COMPLETED'인 외주 정비 건 수집
    let repairCount = 0;
    const completedExternalRepairs = db.repairs.filter(r => {
      if (r.repairType !== 'EXTERNAL' || r.status !== 'COMPLETED' || !r.vendorId) return false;
      const rDate = r.completedDate || r.requestDate || r.repairDate;
      return rDate && rDate.startsWith(ym);
    });

    const repairsByVendor: Record<string, Repair[]> = {};
    completedExternalRepairs.forEach(r => {
      if (!repairsByVendor[r.vendorId!]) repairsByVendor[r.vendorId!] = [];
      repairsByVendor[r.vendorId!].push(r);
    });

    for (const [vendorId, rList] of Object.entries(repairsByVendor)) {
      const vendor = db.vendors.find(v => v.id === vendorId);
      const vendorName = vendor?.name || '외주 정비업체';
      const existing = db.purchaseSettlements.find(p => p.vendorId === vendorId && p.settlementYm === ym && p.settlementType === 'EXTERNAL_REPAIR');
      if (existing) continue;

      const totalAmount = rList.reduce((sum, r) => sum + (r.totalCost || 0), 0);
      const settlementId = db.generateNextId('purchaseSettlements', db.purchaseSettlements);

      db.insertRow<PurchaseSettlement>('purchaseSettlements', {
        id: settlementId,
        settlementYm: ym,
        vendorId,
        vendorName,
        settlementType: 'EXTERNAL_REPAIR',
        totalAmount,
        paidAmount: 0,
        status: 'PENDING',
        itemCount: rList.length,
        createdAt: nowIso
      });

      // ⚠️ 외래키 제약조건 방지
      await db.awaitPendingWrites();

      rList.forEach(r => {
        const asset = db.assets.find(a => a.id === r.assetId);
        db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
          settlementId,
          sourceType: 'REPAIR' as any,
          sourceId: r.id,
          itemDescription: `외주 정비 ${asset?.assetNo || '자산'} ${r.details.slice(0, 30)}`,
          quantity: 1,
          unitPrice: r.totalCost || 0,
          amount: r.totalCost || 0,
          evidenceFileUrl: r.estimateFileUrl || r.faultImageUrl,
          createdAt: nowIso
        });

        // repair에 purchaseBillId 연결
        db.updateRow<Repair>('repairs', r.id, {
          purchaseBillId: settlementId,
          updatedAt: nowIso
        });
      });
      repairCount++;
    }

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('generateMonthlyPurchaseSettlements error:', err);
    }

    refreshAllData();
    return { transport: transportCount, consumable: consumableCount, lease: leaseCount, repair: repairCount };
  };

  const confirmPurchaseSettlement = async (id: string): Promise<void> => {
    const settlement = db.purchaseSettlements.find(p => p.id === id);
    db.updateRow<PurchaseSettlement>('purchaseSettlements', id, {
      status: 'CONFIRMED',
      confirmedAt: new Date().toISOString(),
      confirmedBy: currentUser?.name || '시스템'
    });
    if (settlement) {
      triggerVendorPurchaseMetric(
        settlement.vendorId || settlement.vendorName || '',
        settlement.totalAmount || 0,
        settlement.paymentDate || (settlement.settlementYm ? `${settlement.settlementYm}-01` : undefined)
      );
    }
    await db.awaitPendingWrites(); refreshAllData(); };

  const recordPurchaseSettlementPayment = async (
    id: string,
    data: { paidAmount: number; paymentDate: string; paymentMethod: string; bankAccount?: string; bankTransactionId?: string; memo?: string }
  ): Promise<void> => {
    const settlement = db.purchaseSettlements.find(p => p.id === id);
    if (!settlement) return;
    const newPaidAmount = (settlement.paidAmount || 0) + data.paidAmount;
    const newStatus: PurchaseSettlementStatus = newPaidAmount >= settlement.totalAmount ? 'PAID' : 'CONFIRMED';
    db.updateRow<PurchaseSettlement>('purchaseSettlements', id, {
      paidAmount: newPaidAmount,
      status: newStatus,
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod,
      bankAccount: data.bankAccount,
      bankTransactionId: data.bankTransactionId,
      memo: data.memo
    });

    // SettlementPaymentLog 지급 이력 레코드 1:N 보관
    const logId = `SPL-${Date.now()}`;
    const logs = db.settlementPaymentLogs;
    logs.push({
      id: logId,
      settlementId: id,
      bankTransactionId: data.bankTransactionId,
      paidAmount: data.paidAmount,
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod,
      bankAccount: data.bankAccount,
      memo: data.memo,
      createdAt: new Date().toISOString()
    });
    db.settlementPaymentLogs = logs;

    // 연결된 배차 건 상태 PAID 연동
    if (newStatus === 'PAID' && settlement.settlementType === 'TRANSPORT') {
      const items = db.purchaseSettlementItems.filter(i => i.settlementId === id && i.sourceType === 'DELIVERY');
      items.forEach(item => {
        db.updateRow<Delivery>('deliveries', item.sourceId, {
          reconciliationStatus: 'PAID',
          paymentCompletedAt: new Date().toISOString()
        });
      });
    }

    await db.awaitPendingWrites(); refreshAllData(); };

  const savePurchaseSettlement = async (settlement: Partial<PurchaseSettlement>): Promise<void> => {
    if (!settlement.id) return;
    db.updateRow<PurchaseSettlement>('purchaseSettlements', settlement.id, {
      ...settlement,
      updatedAt: new Date().toISOString()
    });
    await db.awaitPendingWrites(); refreshAllData(); };

  // ── 월말 감가상각 결산 취소 (롤백) ──
  const cancelMonthlyDepreciation = async (depreciationYm: string): Promise<void> => {
    try {
      const log = db.depreciationLogs.find(l => l.depreciationYm === depreciationYm);
      if (!log) {
        throw new Error(`[${depreciationYm}] 연월의 감가상각 결산 이력이 존재하지 않습니다.`);
      }

      // 1. 해당 연월의 DepreciationLog 삭제
      db.deleteRow('depreciationLogs', log.id);

      // 2. 이전 연월(1개월 전)의 말일 시점으로 각 자산의 감가상각 재계산 및 롤백
      const [year, month] = depreciationYm.split('-').map(Number);
      const prevClosingDate = new Date(year, month - 1, 0, 23, 59, 59, 999);

      db.assets.forEach(asset => {
        if (asset.ownerType === 'OWNED') {
          const depnInfo = calculateAssetDepreciation(asset, prevClosingDate);
          db.updateRow<Asset>('assets', asset.id, {
            accumDepreciation: depnInfo.accumDepreciation,
            bookValue: depnInfo.bookValue,
            updatedAt: new Date().toISOString()
          });
        }
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 감가상각 결산 취소 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  // ── 대사 완료 배차 → 월말 매입 정산 자동 집계 ──
  const convertReconciledDeliveriesToSettlement = async (settlementYm: string, transportCompanyId?: string): Promise<number> => {
    try {
      const targetDeliveries = db.deliveries.filter(d => {
        if ((d.transportCompany || '').trim() === '고객직접운송') return false;
        const dDate = d.loadingDate || d.scheduledDate || d.requestDate || d.createdAt.split('T')[0];
        const matchYm = dDate.startsWith(settlementYm);
        const matchStatus = d.reconciliationStatus === 'RECONCILED' || d.reconciliationStatus === 'MATCHED';
        const tcObj = transportCompanyId ? db.transportCompanies.find(c => c.id === transportCompanyId) : null;
        const matchComp = !transportCompanyId || d.transportCompany === tcObj?.name || d.transportCompany === transportCompanyId; // 💡 FIX: d.transportCompany가 name이거나 id일 수 있으므로 모두 허용 (논리 충돌 버그 수정)
        return matchYm && matchStatus && matchComp;
      });

      if (targetDeliveries.length === 0) return 0;

      // 운송사별 그룹핑
      const compGroups = new Map<string, Delivery[]>();
      targetDeliveries.forEach(d => {
        const comp = d.transportCompany || '기타 운송사';
        if (!compGroups.has(comp)) compGroups.set(comp, []);
        compGroups.get(comp)!.push(d);
      });

      let totalConverted = 0;
      for (const [compName, dList] of compGroups.entries()) {
        const compObj = db.transportCompanies.find(c => c.name === compName);
        const settlementId = `PST-TR-${settlementYm.replace('-', '')}-${(compObj?.id || compName).slice(-6)}`;
        
        let existingSettlement = db.purchaseSettlements.find(s => s.id === settlementId);
        const totalSum = dList.reduce((acc, d) => acc + (d.deliveryCostConfirmed || d.deliveryCost || 0), 0);

        if (!existingSettlement) {
          db.insertRow<PurchaseSettlement>('purchaseSettlements', {
            id: settlementId,
            settlementYm,
            settlementType: 'TRANSPORT',
            vendorId: compObj?.id,
            vendorName: compName,
            totalAmount: totalSum,
            paidAmount: 0,
            status: 'PENDING',
            bankAccount: compObj?.bankAccount ? `${compObj.bankName || ''} ${compObj.bankAccount} (${compObj.bankHolder || ''})` : undefined,
            itemCount: dList.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } else {
          db.updateRow<PurchaseSettlement>('purchaseSettlements', settlementId, {
            totalAmount: existingSettlement.totalAmount + totalSum,
            itemCount: (existingSettlement.itemCount || 0) + dList.length,
            updatedAt: new Date().toISOString()
          });
        }

        // 아이템 삽입 및 배차 상태 갱신
        dList.forEach(d => {
          const cost = d.deliveryCostConfirmed || d.deliveryCost || 0;
          db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
            settlementId,
            sourceType: 'DELIVERY',
            sourceId: d.id,
            itemDescription: `[배차 운반비] ${d.originAddress || '상차지'} ➔ ${d.destinationAddress || '하차지'} (${d.vehicleType || '차량'})`,
            quantity: 1,
            unitPrice: cost,
            amount: cost,
            createdAt: new Date().toISOString()
          });

          db.updateRow<Delivery>('deliveries', d.id, {
            reconciliationStatus: 'PAYMENT_REQUESTED',
            updatedAt: new Date().toISOString()
          });
          totalConverted++;
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();
      return totalConverted;
    } catch (err: any) {
      showErrorModal(`⚠️ 매입 정산 이관 오류:\n${err?.message || err}`);
      throw err;
    }
  };

  // ── 고객 과실 수리비 청구서 연동 ──
  const linkRepairToBilling = async (repairId: string, billingId: string): Promise<void> => {
    try {
      db.updateRow<Repair>('repairs', repairId, {
        billingId,
        updatedAt: new Date().toISOString()
      });

      // 🟢 유상 수리비 청구 ToDo 자동 상계
      await clearHandoverTasks({
        entityType: 'REPAIR',
        entityId: repairId,
        category: 'BILLABLE_REPAIR_BILLING',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name,
        completionAction: `LINKED_TO_BILLING_${billingId}`
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 수리비 청구 연동 실패:\n${err?.message || err}`);
    }
  };

  const unlinkRepairFromBilling = async (repairId: string): Promise<void> => {
    try {
      db.updateRow<Repair>('repairs', repairId, {
        billingId: undefined,
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 수리비 청구 연동 해제 실패:\n${err?.message || err}`);
    }
  };

  // ── 고객 과실 수리비 영업 청구 면제 처리 ──
  const waiveRepairBilling = async (repairId: string, waivedAmount: number, waivedReason: string, waivedBy: string): Promise<void> => {
    try {
      const now = new Date().toISOString();
      db.updateRow<Repair>('repairs', repairId, {
        isWaived: true,
        waivedAmount,
        waivedReason,
        waivedBy,
        waivedAt: now,
        updatedAt: now
      });

      // 🟢 유상 수리비 청구 ToDo 자동 상계 (영업 면제 완료)
      await clearHandoverTasks({
        entityType: 'REPAIR',
        entityId: repairId,
        category: 'BILLABLE_REPAIR_BILLING',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name,
        completionAction: `WAIVED_BY_SALES_${waivedBy}`
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 수리비 영업 면제 처리 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const cancelRepairWaiver = async (repairId: string): Promise<void> => {
    try {
      const now = new Date().toISOString();
      db.updateRow<Repair>('repairs', repairId, {
        isWaived: false,
        waivedAmount: 0,
        waivedReason: undefined,
        waivedBy: undefined,
        waivedAt: undefined,
        updatedAt: now
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 수리비 영업 면제 취소 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  // ── 고객 부담 운송료 청구서 연동 및 영업 면제 ──
  const linkDeliveryToBilling = async (deliveryId: string, billingId: string): Promise<void> => {
    try {
      db.updateRow<Delivery>('deliveries', deliveryId, {
        billingId,
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 운송료 청구 연동 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const unlinkDeliveryFromBilling = async (deliveryId: string): Promise<void> => {
    try {
      db.updateRow<Delivery>('deliveries', deliveryId, {
        billingId: undefined,
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 운송료 청구 연동 해제 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const waiveDeliveryBilling = async (deliveryId: string, waivedAmount: number, waivedReason: string, waivedBy: string): Promise<void> => {
    try {
      const now = new Date().toISOString();
      db.updateRow<Delivery>('deliveries', deliveryId, {
        isWaived: true,
        waivedAmount,
        waivedReason,
        waivedBy,
        waivedAt: now,
        updatedAt: now
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 운송료 영업 면제 처리 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const cancelDeliveryWaiver = async (deliveryId: string): Promise<void> => {
    try {
      const now = new Date().toISOString();
      db.updateRow<Delivery>('deliveries', deliveryId, {
        isWaived: false,
        waivedAmount: 0,
        waivedReason: undefined,
        waivedBy: undefined,
        waivedAt: undefined,
        updatedAt: now
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 운송료 영업 면제 취소 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  // ── 선수금 (예치금) 관리 ──
  const chargePrepaidBalance = async (customerId: string, amount: number, memo?: string): Promise<void> => {
    try {
      const customer = db.customers.find(c => c.id === customerId);
      if (!customer) throw new Error('고객사를 찾을 수 없습니다.');
      if (amount <= 0) throw new Error('유효한 금액을 입력하십시오.');

      const nextBal = (customer.prepaidBalance || 0) + amount;
      db.updateRow<Customer>('customers', customerId, {
        prepaidBalance: nextBal
      });

      db.insertRow<PrepaidTransaction>('prepaidTransactions', {
        customerId,
        type: 'CHARGE',
        amount,
        balanceAfter: nextBal,
        memo: memo || '선수금(예치금) 충전/입금',
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 선수금 충전 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const applyPrepaidBalanceForBilling = async (billingId: string, amount: number, memo?: string): Promise<void> => {
    try {
      if (!amount || amount <= 0) {
        throw new Error('상계할 금액은 1원 이상이어야 합니다.');
      }
      const billing = db.billings.find(b => b.id === billingId);
      if (!billing) throw new Error('청구서를 찾을 수 없습니다.');
      const customer = db.customers.find(c => c.id === billing.customerId);
      if (!customer) throw new Error('고객사를 찾을 수 없습니다.');

      const currentBal = customer.prepaidBalance || 0;
      if (currentBal < amount) {
        throw new Error(`선수금 잔액이 부족합니다. (현재 잔액: ₩${currentBal.toLocaleString()}원, 요청액: ₩${amount.toLocaleString()}원)`);
      }

      const bSup = billing.totalAmount || 0;
      const bGrand = bSup + Math.round(bSup * 0.1);
      const unpaid = Math.max(0, bGrand - (billing.paidAmount || 0));
      if (amount > unpaid) {
        throw new Error(`청구서 미수금(₩${unpaid.toLocaleString()}원)을 초과하여 상계할 수 없습니다.`);
      }

      // 1. 고객 선수금 잔액 차감
      const nextBal = currentBal - amount;
      db.updateRow<Customer>('customers', customer.id, {
        prepaidBalance: nextBal
      });

      // 2. 수납 레코드 생성
      const paymentId = `pay-prepaid-${Date.now()}`;
      db.insertRow<Payment>('payments', {
        id: paymentId,
        billingId,
        paymentDate: new Date().toISOString().split('T')[0],
        amount,
        method: 'PREPAID',
        memo: memo || `선수금(예치금) 상계 수납 (잔여 선수금: ₩${nextBal.toLocaleString()}원)`,
        createdAt: new Date().toISOString()
      });

      // 3. 청구서 수납액 및 상태 갱신 (VAT 포함 총액 기준)
      const newPaid = billing.paidAmount + amount;
      const newStatus = newPaid >= bGrand ? 'PAID' : 'PARTIAL';
      db.updateRow<Billing>('billings', billingId, {
        paidAmount: newPaid,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // 4. 선수금 사용 이력 기록
      db.insertRow<PrepaidTransaction>('prepaidTransactions', {
        customerId: customer.id,
        type: 'USE_FOR_BILLING',
        amount,
        balanceAfter: nextBal,
        billingId,
        paymentId,
        memo: memo || `청구서(${billing.billingYm}) 선수금 상계 수납`,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 선수금 상계 수납 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const refundPrepaidBalance = async (customerId: string, amount: number, memo?: string): Promise<void> => {
    try {
      if (!amount || amount <= 0) {
        throw new Error('환불할 금액은 1원 이상이어야 합니다.');
      }
      const customer = db.customers.find(c => c.id === customerId);
      if (!customer) throw new Error('고객사를 찾을 수 없습니다.');
      const currentBal = customer.prepaidBalance || 0;
      if (currentBal < amount) {
        throw new Error(`환불 요청 금액이 선수금 잔액을 초과합니다. (잔액: ₩${currentBal.toLocaleString()}원)`);
      }

      const nextBal = currentBal - amount;
      db.updateRow<Customer>('customers', customerId, {
        prepaidBalance: nextBal
      });

      db.insertRow<PrepaidTransaction>('prepaidTransactions', {
        customerId,
        type: 'REFUND',
        amount,
        balanceAfter: nextBal,
        memo: memo || '선수금(예치금) 환불 처리',
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 선수금 환불 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  // ── 연체 조치 및 입금 약속 관리 ──
  const saveDelinquencyAction = async (action: Omit<DelinquencyActionLog, 'id' | 'createdAt'>): Promise<void> => {
    try {
      db.insertRow<DelinquencyActionLog>('delinquencyActionLogs', {
        ...action,
        createdAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 연체 조치사항 저장 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const updateDelinquencyActionPromise = async (actionId: string, status: 'PENDING' | 'KEPT' | 'BROKEN'): Promise<void> => {
    try {
      db.updateRow<DelinquencyActionLog>('delinquencyActionLogs', actionId, {
        promiseStatus: status
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`⚠️ 입금 약속 상태 변경 실패:\n${err?.message || err}`);
      throw err;
    }
  };

  const saveLegalNoticeLog = async (log: Omit<LegalNoticeLog, 'id' | 'createdAt'>): Promise<LegalNoticeLog> => {
    const newLog = db.insertRow<LegalNoticeLog>('legalNoticeLogs', {
      ...log,
      createdAt: new Date().toISOString()
    }) as LegalNoticeLog;

    await db.awaitPendingWrites();
    refreshAllData();
    return newLog;
  };

  const saveLegalNoticeTemplate = async (tpl: Omit<LegalNoticeTemplate, 'id' | 'updatedAt'> & { id?: string }): Promise<void> => {
    const existing = db.legalNoticeTemplates[0];
    if (existing) {
      db.updateRow<LegalNoticeTemplate>('legalNoticeTemplates', existing.id, {
        ...tpl,
        updatedAt: new Date().toISOString()
      });
    } else {
      db.insertRow<LegalNoticeTemplate>('legalNoticeTemplates', {
        ...tpl,
        updatedAt: new Date().toISOString()
      });
    }

    try {
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('Supabase write error:', err);
      showErrorModal(err?.message || String(err));
      throw err;
    }
  };

  // ============================================================
  // 법인 차량 및 차량운행일지/주유 영수증 Mutators (Corporate Fleet & Logs)
  // ============================================================

  const registerCorporateVehicle = async (vehicleData: Omit<CorporateVehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<CorporateVehicle> => {
    const now = new Date().toISOString();
    const newVehicle = db.insertRow<CorporateVehicle>('corporateVehicles', {
      ...vehicleData,
      createdAt: now,
      updatedAt: now
    }) as CorporateVehicle;
    await db.awaitPendingWrites();
    refreshAllData();
    return newVehicle;
  };

  const updateCorporateVehicle = async (id: string, updates: Partial<CorporateVehicle>): Promise<void> => {
    db.updateRow<CorporateVehicle>('corporateVehicles', id, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    await db.awaitPendingWrites(); refreshAllData(); };

  const deleteCorporateVehicle = async (id: string): Promise<void> => {
    // ✅ 고아 레코드 방지: 차량 삭제 시 연관 운행일지, 주유 기록 cascade 삭제
    const linkedOpLogs = db.vehicleOperationLogs.filter(l => l.vehicleId === id);
    linkedOpLogs.forEach(l => db.deleteRow('vehicleOperationLogs', l.id));
    const linkedFuelLogs = db.vehicleFuelLogs.filter(l => l.vehicleId === id);
    linkedFuelLogs.forEach(l => db.deleteRow('vehicleFuelLogs', l.id));
    db.deleteRow('corporateVehicles', id);
    await db.awaitPendingWrites(); refreshAllData(); };

  const registerVehicleOperationLog = async (logData: Omit<VehicleOperationLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<VehicleOperationLog> => {
    const now = new Date().toISOString();
    const driveDistance = Math.max(0, (logData.arrivalMileage || 0) - (logData.departureMileage || 0));
    const newLog = db.insertRow<VehicleOperationLog>('vehicleOperationLogs', {
      ...logData,
      driveDistance: logData.driveDistance !== undefined ? logData.driveDistance : driveDistance,
      createdAt: now,
      updatedAt: now
    }) as VehicleOperationLog;

    // 차량의 현재 누적 주행거리 자동 업데이트 (도착 거리가 더 큰 경우)
    const veh = db.corporateVehicles.find(v => v.id === logData.vehicleId);
    if (veh && logData.arrivalMileage > veh.currentMileage) {
      db.updateRow<CorporateVehicle>('corporateVehicles', veh.id, {
        currentMileage: logData.arrivalMileage,
        updatedAt: now
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
    return newLog;
  };

  const updateVehicleOperationLog = async (id: string, updates: Partial<VehicleOperationLog>): Promise<void> => {
    db.updateRow<VehicleOperationLog>('vehicleOperationLogs', id, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    await db.awaitPendingWrites(); refreshAllData(); };

  const deleteVehicleOperationLog = async (id: string): Promise<void> => {
      const log = db.vehicleOperationLogs.find(l => l.id === id);
      if (log && log.status === 'CONFIRMED') {
        throw new Error('승인 완료된 운행일지는 삭제할 수 없습니다.');
      }
    db.deleteRow('vehicleOperationLogs', id);
    await db.awaitPendingWrites(); refreshAllData(); };

  const registerVehicleFuelLog = async (fuelData: Omit<VehicleFuelLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<VehicleFuelLog> => {
    const now = new Date().toISOString();
    const fuelUnitPrice = fuelData.fuelUnitPrice || (fuelData.fuelVolume > 0 ? Math.round(fuelData.fuelAmount / fuelData.fuelVolume) : 0);
    
    // 직전 주유 대비 연비 자동 계산 (동일 차량의 직전 주유 기록 검색)
    const pastFuelLogs = db.vehicleFuelLogs
      .filter(f => f.vehicleId === fuelData.vehicleId && f.currentMileage < fuelData.currentMileage)
      .sort((a, b) => b.currentMileage - a.currentMileage);
    let calculatedEfficiency: number | undefined = undefined;
    if (pastFuelLogs.length > 0 && fuelData.fuelVolume > 0) {
      const distanceDelta = fuelData.currentMileage - pastFuelLogs[0].currentMileage;
      if (distanceDelta > 0) {
        calculatedEfficiency = Number((distanceDelta / fuelData.fuelVolume).toFixed(2));
      }
    }

    const newFuelLog = db.insertRow<VehicleFuelLog>('vehicleFuelLogs', {
      ...fuelData,
      fuelUnitPrice,
      fuelEfficiency: fuelData.fuelEfficiency || calculatedEfficiency,
      createdAt: now,
      updatedAt: now
    }) as VehicleFuelLog;

    // 차량의 현재 누적 주행거리 자동 업데이트
    const veh = db.corporateVehicles.find(v => v.id === fuelData.vehicleId);
    if (veh && fuelData.currentMileage > veh.currentMileage) {
      db.updateRow<CorporateVehicle>('corporateVehicles', veh.id, {
        currentMileage: fuelData.currentMileage,
        updatedAt: now
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
    return newFuelLog;
  };

  const deleteVehicleFuelLog = async (id: string): Promise<void> => {
    db.deleteRow('vehicleFuelLogs', id);
    await db.awaitPendingWrites(); refreshAllData(); };

  // 分散 인쇄 큐 & 스테이션 관리 액션
  const enqueuePrintJobAction = async (params: {
    stationId?: string;
    docType: 'DISPATCH_ORDER' | 'RETURN_ORDER';
    docNo?: string;
    title: string;
    documentHtml: string;
    requestedById?: string;
    requestedByName?: string;
  }): Promise<PrintQueueItem> => {
    const job = await serviceEnqueuePrintJob(params);
    refreshAllData();
    return job;
  };

  const registerPrintStationAction = async (station: {
    id?: string;
    stationName: string;
    localPrinterName: string;
    machineName?: string;
    docTypeDefault?: 'DISPATCH_ORDER' | 'RETURN_ORDER' | 'ALL';
    description?: string;
  }): Promise<PrintStation> => {
    const s = await serviceRegisterPrintStation(station);
    refreshAllData();
    return s;
  };

  const deletePrintStationAction = async (id: string): Promise<void> => {
    await serviceDeletePrintStation(id);
    refreshAllData();
  };

  const retryPrintJobAction = async (id: string): Promise<void> => {
    await serviceRetryPrintJob(id);
    refreshAllData();
  };

  const cancelPrintJobAction = async (id: string): Promise<void> => {
    await serviceCancelPrintJob(id);
    refreshAllData();
  };

  // ─── 오류 신고 관리 (3단계 라이프사이클 & 파일첨부) ───
  const addErrorReport = async (reportData: Omit<ErrorReport, 'id' | 'createdAt' | 'updatedAt' | 'reportNo'> & { id?: string; reportNo?: string }): Promise<ErrorReport> => {
    const list = db.errorReports || [];
    const reportNo = reportData.reportNo || `ERR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(list.length + 1).padStart(4, '0')}`;
    const newReport: ErrorReport = {
      id: reportData.id || `ERR-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      reportNo,
      title: reportData.title,
      description: reportData.description,
      menuId: reportData.menuId,
      menuName: reportData.menuName,
      category: reportData.category || 'OTHER',
      severity: reportData.severity || 'MEDIUM',
      status: 'REGISTERED',
      reporterId: reportData.reporterId || currentUser?.id || 'usr-anon',
      reporterName: reportData.reporterName || currentUser?.name || '시스템사용자',
      reporterDept: reportData.reporterDept,
      reporterPhone: reportData.reporterPhone,
      reportedAt: reportData.reportedAt || new Date().toISOString().replace('T', ' ').slice(0, 16),
      attachments: reportData.attachments || [],
      environmentInfo: reportData.environmentInfo || {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
        activeUrl: typeof window !== 'undefined' ? window.location.pathname : '',
        appVersion: 'v1.14.0'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const inserted = db.insertRow<ErrorReport>('errorReports', newReport);
    await db.awaitPendingWrites();
    setErrorReports([...db.errorReports]);
    return inserted;
  };

  const receiveErrorReport = async (id: string, payload: { assigneeId: string; assigneeName: string; receptionNote?: string; targetCompletionDate?: string }): Promise<void> => {
    const nowIso = new Date().toISOString();
    const safeReceiverId = (currentUser?.id && !['sys-admin', 'usr-admin'].includes(currentUser.id)) ? currentUser.id : 'u-1';
    const updates: Partial<ErrorReport> = {
      status: 'IN_PROGRESS',
      receiverId: safeReceiverId,
      receiverName: currentUser?.name || '관리자',
      receivedAt: nowIso.replace('T', ' ').slice(0, 16),
      assigneeId: payload.assigneeId,
      assigneeName: payload.assigneeName,
      receptionNote: payload.receptionNote,
      targetCompletionDate: payload.targetCompletionDate,
      updatedAt: nowIso
    };
    db.updateRow<ErrorReport>('errorReports', id, updates);
    await db.awaitPendingWrites();
    setErrorReports([...db.errorReports]);
  };

  const completeErrorReport = async (id: string, payload: { resolutionNote: string; resolvedVersion?: string; rootCause?: string }): Promise<void> => {
    const nowIso = new Date().toISOString();
    const safeResolverId = (currentUser?.id && !['sys-admin', 'usr-admin'].includes(currentUser.id)) ? currentUser.id : 'u-1';
    const updates: Partial<ErrorReport> = {
      status: 'COMPLETED',
      resolverId: safeResolverId,
      resolverName: currentUser?.name || '관리자',
      completedAt: nowIso.replace('T', ' ').slice(0, 16),
      resolutionNote: payload.resolutionNote,
      resolvedVersion: payload.resolvedVersion || 'v1.14.0',
      rootCause: payload.rootCause,
      updatedAt: nowIso
    };
    db.updateRow<ErrorReport>('errorReports', id, updates);
    await db.awaitPendingWrites();
    setErrorReports([...db.errorReports]);
  };

  const cancelErrorReport = async (id: string, reason: string): Promise<void> => {
    const nowIso = new Date().toISOString();
    const updates: Partial<ErrorReport> = {
      status: 'CANCELLED',
      resolutionNote: reason ? `[취소 사유]: ${reason}` : '신고자 요청 또는 중복 건 취소',
      updatedAt: nowIso
    };
    db.updateRow<ErrorReport>('errorReports', id, updates);
    await db.awaitPendingWrites();
    setErrorReports([...db.errorReports]);
  };

  const reopenErrorReport = async (id: string): Promise<void> => {
    const nowIso = new Date().toISOString();
    const updates: Partial<ErrorReport> = {
      status: 'REGISTERED',
      updatedAt: nowIso
    };
    db.updateRow<ErrorReport>('errorReports', id, updates);
    await db.awaitPendingWrites();
    setErrorReports([...db.errorReports]);
  };

  const deleteErrorReport = async (id: string): Promise<void> => {
    db.deleteRow('errorReports', id);
    await db.awaitPendingWrites();
    setErrorReports([...db.errorReports]);
  };

  // 🛡️ [권한 기반 로컬 DB 매일 09:00 자동 백업 정책 동기화]
  // 로그인한 직원의 백업 권한(autoBackupEnabled, autoBackupTime)을 로컬 에이전트(C:\eBroAgent)에 실시간 핫 동기화
  useEffect(() => {
    if (!currentUser && !currentTenant) return;
    const matchedUser = currentUser
      ? (users.find(u => u.id === currentUser.id || (currentUser.loginId && u.loginId === currentUser.loginId)) || currentUser)
      : null;

    syncTenantPolicyToAgent(
      currentTenant,
      matchedUser
        ? {
            autoBackupEnabled: Boolean(matchedUser.autoBackupEnabled),
            autoBackupTime: matchedUser.autoBackupTime || '09:00',
            autoBackupRetentionDays: matchedUser.autoBackupRetentionDays || 30,
            backupUserId: matchedUser.id || '',
            backupUserName: matchedUser.name || ''
          }
        : {
            autoBackupEnabled: false,
            autoBackupTime: '09:00',
            autoBackupRetentionDays: 30,
            backupUserId: '',
            backupUserName: ''
          }
    ).catch(() => {});
  }, [
    currentUser?.id,
    currentUser?.loginId,
    currentUser?.autoBackupEnabled,
    currentUser?.autoBackupTime,
    users,
    currentTenant?.id,
    currentTenant?.tenantCode
  ]);

  const contextValue: AppContextType = {
    db,
    fetchRuleForEvent,
    createApprovalRequest,
    processApprovalStep,
    receivables: db.receivables as any[], refreshReceivables: () => {}, 
      currentUser, theme, toggleTheme, login, logout, switchUser, hasPermission, showErrorModal, showNoticeModal, showPrintSuccessModal,
      tenants, currentTenant, setCurrentTenantId, saveTenant, deleteTenant,
      addTenantWorkplace, updateTenantWorkplace, deleteTenantWorkplace,
      addTenantYard, updateTenantYard, deleteTenantYard, setDefaultYard,
      errorReports, addErrorReport, receiveErrorReport, completeErrorReport, cancelErrorReport, reopenErrorReport, deleteErrorReport,
      users, departments, permissions, customers, contacts, sites, siteMasters, saveSiteMaster, deleteSiteMaster, products, assets, consumables, consumableLots: db.consumableLots, consumableLogs, consumablePurchases, mechanicConsumableStocks, contracts, contractAssets, contractHistory, deliveries, billings, billingDetails, payments, paymentDepositLinks, repairs, repairConsumables, transportCompanies, transportDrivers, transportNegotiations, subleaseNegotiations, todos,
      stocktakingAudits, stocktakingAuditItems, collectedParts,
      bankTransactions, bankMatchingRules, bankInitialBalances, assetInOutLogs, vendors, officialMailConfigs, cashFlowSnapshots, outboundInspections, depreciationLogs,
      purchaseSettlements, purchaseSettlementItems, settlementPaymentLogs: db.settlementPaymentLogs, externalLeases, inspectionChecklistItems,
      equipmentManuals, saveEquipmentManual, deleteEquipmentManual,
      standardOptions, saveStandardOption, deleteStandardOption, monthlyIncomeStatements, saveMonthlyIncomeStatement,
      salesJournals, saveSalesJournal, deleteSalesJournal,
      customRoles, rolePermissions, saveCustomRole, deleteCustomRole, saveRolePermissions, assignUserRole,
      annualLeaveQuotas, leaveUsages, overtimeRecords, payrollClosings, prepaidTransactions, delinquencyActionLogs, legalNoticeLogs, legalNoticeTemplates, saveLegalNoticeLog, saveLegalNoticeTemplate,
      corporateVehicles, vehicleOperationLogs, vehicleFuelLogs, registerCorporateVehicle, updateCorporateVehicle, deleteCorporateVehicle, registerVehicleOperationLog, updateVehicleOperationLog, deleteVehicleOperationLog, registerVehicleFuelLog, deleteVehicleFuelLog,
      refreshAllData, fullRefreshFromServer, executeMonthlyDepreciation, loadTablesForMenu, updatePermissions, saveUser, saveCustomer, deleteCustomer, saveContact, deleteContact, saveSite, deleteSite, saveProduct, saveAsset, updateOfficialMailConfig,
      saveCashFlowSnapshot, deleteCashFlowSnapshot, saveVendor, deleteVendor, recalculateAllVendorMetrics, saveBankInitialBalance, saveInspectionChecklistItem, deleteInspectionChecklistItem,
      updateAnnualLeaveQuota, addLeaveUsage, deleteLeaveUsage, addOvertimeRecord, deleteOvertimeRecord, setPayrollClosingStatus,
      acquireAsset, batchAcquireAssets, disposeAsset, executeAssetSale, registerRentedAsset, returnRentedAsset, createVendorClaimReceivable, changeAssetStatus, registerInboundAsset, cancelInboundAsset,
      purchaseConsumable, useConsumable, transferConsumableToMechanic, returnConsumableToHq, transferConsumableBetweenMechanics, addConsumable, updateConsumable, deleteConsumable,
      createStocktakingAudit, updateStocktakingItem, confirmStocktakingAudit, cancelStocktakingAudit, processCollectedPart,
      requestConsumablePurchase, updatePurchaseUnitPrice, acceptConsumablePurchase, completeConsumablePurchase, inboundConsumablePurchase, clearEvidenceFileUrls, updateEvidenceFileUrls,
      createContract, rescindContract, extendContract, shortenContract, succeedContract, exchangeAsset, updateContractAssetPeriod, relocateContractAsset, redeployRepairedAsset,
      assignAssetToContract, batchAssignAssetsToContract, unassignAssetFromContract, batchUnassignAssetsFromContract, exchangeOutboundAsset,
      saveSmartDispatch, cancelOutboundRequest, deleteCancelledOutboundRequests, updateOutboundRequestPricing, saveSmartReturn,
      completeTodo, issueExecutiveDirective, resolveExecutiveDirective, cancelExecutiveDirective,
      generateBillingsForMonth, getDueContractsForBilling, generateDueBillings, generateBillingForSingleContract, syncContractBillingMilestones, splitBillingAbsoluteAmount, regenerateBilling, saveCustomStatementForBilling, removeCustomStatementForBilling, toggleTenantCustomBillingStatement, toggleTenantContractTradeOutbound, approveBilling, cancelBilling, receivePayment, cancelPayment, cancelAllPaymentsForBilling, saveBankDeposit, deleteBankDeposit,
      addReceivable, registerInboundDefectClaimReceivable, updateReceivableClaimNegotiation, generateStandaloneBillingForReceivable, linkReceivableToBilling,
      uploadBankTransactions, matchTransactionManual, batchAutoMatchTransactions, unmatchTransaction, saveMatchingRule, deleteMatchingRule,
      dispatchDelivery, settleDeliveryCost, completeDelivery, completeInboundDelivery,
      registerRepair, updateRepairStatus,
      // 현장 AS 관리 (단일 물리 테이블 repairs 뷰 제공)
      fieldAsTickets: repairs.filter(r => r.workCategory === 'FIELD_AS' || r.source === 'BAND_IMPORT' || r.source === 'SALES_REQUEST'),
      createFieldAsTicket,
      updateFieldAsTicketStatus,
      completeFieldAsTicket,
      createRevisitAsTicket,
      importBandAsHistory,
      logFieldAsTimelineEvent,
      recordAsRouteEvent,
      saveTransportDataOnFly,
      generateMonthlyPurchaseSettlements, confirmPurchaseSettlement, recordPurchaseSettlementPayment, savePurchaseSettlement, convertReconciledDeliveriesToSettlement,
      cancelMonthlyDepreciation, linkRepairToBilling, unlinkRepairFromBilling,
      waiveRepairBilling, cancelRepairWaiver, linkDeliveryToBilling, unlinkDeliveryFromBilling, waiveDeliveryBilling, cancelDeliveryWaiver,
      chargePrepaidBalance, applyPrepaidBalanceForBilling, refundPrepaidBalance,
      saveDelinquencyAction, updateDelinquencyActionPromise,
      printStations,
      printQueue,
      enqueuePrintJob: enqueuePrintJobAction,
      registerPrintStation: registerPrintStationAction,
      deletePrintStation: deletePrintStationAction,
      retryPrintJob: retryPrintJobAction,
      cancelPrintJob: cancelPrintJobAction,
      activeTab,
      setActiveTab,
      navigationPayload,
      setNavigationPayload,
      canGoBack,
      canGoForward,
      goBack,
      goForward,
    historyStack,
    historyIndex
  };

  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    (window as any).__APP_CONTEXT__ = contextValue;
    (window as any).__ebro_db = db;
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <ErrorModal
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
        onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
      />
      <PrintSuccessModal
        isOpen={printSuccessModal.isOpen}
        docType={printSuccessModal.docType}
        docTitle={printSuccessModal.docTitle}
        docNo={printSuccessModal.docNo}
        stationName={printSuccessModal.stationName}
        printerName={printSuccessModal.printerName}
        detailMessage={printSuccessModal.detailMessage}
        onClose={() => setPrintSuccessModal(prev => ({ ...prev, isOpen: false }))}
      />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
