import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db, supabase, Tenant, TenantWorkplace, TenantYard, TenantBusinessType, TenantBankAccount, OFFICIAL_STAMP_BASE64, User, MenuPermission, createMenuPermission, CustomRole, RolePermission, Customer, CustomerContact, CustomerSite, Product, Asset, Consumable, ConsumableLog, ConsumablePurchaseRequest, MechanicConsumableStock, Contract, ContractAsset, ContractHistory, Delivery, Billing, BillingType, BillingDetail, Receivable, Payment, PaymentDepositLink, Repair, RepairConsumable, Todo, BankTransaction, BankMatchingRule, BankAccountInitialBalance, AssetInOutLog, GoogleConfig, Vendor, CashFlowSnapshot, OutboundInspection, TransportCompany, TransportDriver, TransportNegotiation, SubleaseNegotiation, DepreciationLog, PurchaseSettlement, PurchaseSettlementItem, SettlementPaymentLog, ExternalLease, PurchaseSettlementType, PurchaseSettlementStatus, findCustomerByNormalizedName, AnnualLeaveQuota, LeaveUsage, OvertimeRecord, PayrollClosing, InspectionChecklistItem, EquipmentManual, StandardOption, InboundDefectDetail, PrepaidTransaction, DelinquencyActionLog, LegalNoticeLog, LegalNoticeTemplate, calculateAssetDepreciation, FieldAsTicket, FieldAsPartUsed, FieldAsCollectedPart, CorporateVehicle, VehicleOperationLog, VehicleFuelLog, RepairPartUsed, RepairCollectedPart, SaleContractTerms, StocktakingAudit, StocktakingAuditItem, CollectedPart, PrintStation, PrintQueueItem, logPrivacyAccess, ErrorReport, ErrorReportAttachment, ErrorReportStatus, ErrorReportSeverity, ErrorReportCategory } from '../services/db';
import { enqueuePrintJob as serviceEnqueuePrintJob, registerPrintStation as serviceRegisterPrintStation, deletePrintStation as serviceDeletePrintStation, retryPrintJob as serviceRetryPrintJob, cancelPrintJob as serviceCancelPrintJob } from '../services/printQueueService';
import { ErrorModal } from '../components/ErrorModal';
import { getAllSystemMenuIds, normalizeMenuId } from '../config/menu_config';
import { getRoleTemplatePermission } from '../config/role_templates';
import { broadcastWorkNotification } from '../utils/workNotificationService';
import { issueHandoverTask, clearHandoverTasks, findActiveTasksForUser, checkAndIssuePackageResendTask } from '../utils/taskHandoverPipeline';
import { resolveSiteDetailedAddress } from '../utils/nativeLauncher';
import { emailService } from '../services/email';
import { sortCustomersByName } from '../utils/hangulSearch';

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
  salespersonName?: string;
  salespersonPhone?: string;
  siteContactName: string;
  siteContactPhone: string;
  siteContactEmail: string;
  billingContactName: string;
  billingContactPhone: string;
  statementEmail: string;
  taxBillEmail: string;
  loadingTime: string;
  unloadingTime: string;
  equipments: { modelName: string, qty: number }[];
  paidOptions?: string;
  protection?: string;
  checkedSpecs?: Record<string, boolean>;
  saveOptionsToSite?: boolean; // ?뙚 ?듭뀡 蹂寃????꾩옣 留덉뒪??????щ? (false: ?대쾲 異쒓퀬留?1?뚯꽦 ?곸슜, true: ?꾩옣 留덉뒪??媛깆떊)
  isSetAsCustomerDefault?: boolean;
  applyToAllSites?: boolean;
  closingDay?: string;
  paymentDay?: string;
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
  // ?뺣퉬?뚯닔 異붽? ?꾨뱶
  repairId?: string;
  vendorId?: string;
  // 怨좉컼痢??뚯닔 ?대떦 ?뺣낫
  contactName?: string;
  contactPhone?: string;
}

interface AppContextType {
  receivables: any[];
  refreshReceivables: () => void;
  currentUser: User | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (loginId: string, passwordHash: string, keepLoggedIn?: boolean) => Promise<{ success: boolean; reason?: string }>;
  logout: () => void;
  switchUser: (userId: string) => void;
  hasPermission: (menuId: string, action: 'view' | 'save') => boolean;
  showErrorModal: (message: string, title?: string) => void;
  
  // Data States
  tenants: Tenant[];
  currentTenant: Tenant;
  setCurrentTenantId: (tenantId: string) => void;
  saveTenant: (tenant: Partial<Tenant> & { id?: string }) => Promise<Tenant>;
  addTenantWorkplace: (tenantId: string, workplace: Omit<TenantWorkplace, 'id'>) => Promise<Tenant>;
  updateTenantWorkplace: (tenantId: string, workplaceId: string, workplace: Partial<TenantWorkplace>) => Promise<Tenant>;
  deleteTenantWorkplace: (tenantId: string, workplaceId: string) => Promise<Tenant>;
  addTenantYard: (tenantId: string, yard: Omit<TenantYard, 'id'>) => Promise<Tenant>;
  updateTenantYard: (tenantId: string, yardId: string, yard: Partial<TenantYard>) => Promise<Tenant>;
  deleteTenantYard: (tenantId: string, yardId: string) => Promise<Tenant>;
  setDefaultYard: (tenantId: string, yardId: string) => Promise<Tenant>;
  users: User[];
  permissions: MenuPermission[];
  customers: Customer[];
  contacts: CustomerContact[];
  sites: CustomerSite[];
  products: Product[];
  assets: Asset[];
  consumables: Consumable[];
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
  googleConfigs: GoogleConfig[];
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
  saveContact: (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }) => Promise<CustomerContact>;
  deleteContact: (id: string) => Promise<void>;
  saveSite: (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }) => Promise<CustomerSite>;
  deleteSite: (id: string) => Promise<void>;
  saveProduct: (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => void;
  saveAsset: (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Asset>;
  updateGoogleConfig: (config: GoogleConfig) => Promise<void>;
  saveCashFlowSnapshot: (snap: Omit<CashFlowSnapshot, 'id' | 'createdAt'>) => void;
  deleteCashFlowSnapshot: (snapId: string) => void;
  saveVendor: (vendor: Vendor) => Promise<void>;
  deleteVendor: (id: string) => void;
  recalculateAllVendorMetrics: () => Promise<{ updatedCount: number; totalAmount: number }>;
  saveInspectionChecklistItem: (item: Omit<InspectionChecklistItem, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  deleteInspectionChecklistItem: (id: string) => Promise<void>;
  saveEquipmentManual: (item: Omit<EquipmentManual, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  deleteEquipmentManual: (id: string) => Promise<void>;
  saveStandardOption: (option: Omit<StandardOption, 'id' | 'createdAt'> & { id?: string }) => Promise<StandardOption>;
  deleteStandardOption: (id: string) => Promise<void>;
  
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
  requestConsumablePurchase: (data: { consumableId?: string; modelName: string; qty: number; unitPrice: number; requestDate: string; sellerName: string }) => Promise<void>;
  acceptConsumablePurchase: (id: string) => Promise<void>;
  completeConsumablePurchase: (id: string) => Promise<void>;
  inboundConsumablePurchase: (id: string, qty: number, statementFileUrl: string) => Promise<void>;
  clearEvidenceFileUrls: (ids: string[]) => Promise<void>;  // Storage ??젣 ??DB URL 珥덇린??
  updateEvidenceFileUrls: (updates: { id: string; url: string }[]) => Promise<void>; // Storage ??젣 ??Drive URL濡?援먯껜
  
  // AS 湲곗궗 李⑤웾蹂??대룞?ш퀬 (Van Stock)
  mechanicConsumableStocks: MechanicConsumableStock[];
  transferConsumableToMechanic: (mechanicId: string, consumableId: string, quantity: number, memo?: string) => Promise<void>;
  returnConsumableToHq: (mechanicId: string, consumableId: string, quantity: number, memo?: string, isDefective?: boolean, disposition?: 'REBUILD' | 'SCRAP' | 'VENDOR_WARRANTY') => Promise<void>;
  transferConsumableBetweenMechanics: (fromMechanicId: string, toMechanicId: string, consumableId: string, quantity: number, memo?: string) => Promise<void>;

  // ?ш퀬?ㅼ궗(Stocktaking Audit) & 怨좏뭹 愿由?
  stocktakingAudits: StocktakingAudit[];
  stocktakingAuditItems: StocktakingAuditItem[];
  collectedParts: CollectedPart[];
  createStocktakingAudit: (targetType: 'HQ' | 'VEHICLE', mechanicId?: string, memo?: string) => Promise<StocktakingAudit>;
  updateStocktakingItem: (auditId: string, itemId: string, actualQty: number, diffReason?: StocktakingAuditItem['diffReason'], note?: string) => Promise<void>;
  confirmStocktakingAudit: (auditId: string) => Promise<void>;
  cancelStocktakingAudit: (auditId: string) => Promise<void>;
  processCollectedPart: (partId: string, actionStatus: 'IN_PROCESS' | 'COMPLETED', actionMemo?: string) => Promise<void>;

  // ?꾩옣 AS 愿由?
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
  }) => Promise<void>;
  createRevisitAsTicket: (parentTicketId: string, revisitDate: string, revisitReason: string, mechanicId?: string) => Promise<FieldAsTicket>;
  importBandAsHistory: (records: any[]) => Promise<number>;
  logFieldAsTimelineEvent: (ticketId: string, eventType: 'CALL_MADE' | 'TRANSIT_START' | 'ARRIVED' | 'COMPLETED', detail?: string) => Promise<void>;
  
  // Contract Mutators
  createContract: (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]) => Promise<Contract>;
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
  
  // ?λ퉬 ?좊떦 諛?異쒓퀬??援먯껜 / ?좊떦 痍⑥냼
  assignAssetToContract: (contractAssetId: string, assetId: string) => Promise<void>;
  batchAssignAssetsToContract: (pairs: { contractAssetId: string; assetId: string }[]) => Promise<void>;
  unassignAssetFromContract: (contractAssetId: string) => Promise<void>;
  batchUnassignAssetsFromContract: (contractAssetIds: string[]) => Promise<void>;
  exchangeOutboundAsset: (contractAssetId: string, oldAssetId: string, newAssetId: string, reason?: string, markOldAsRepairing?: boolean, customPenaltyScore?: number) => Promise<void>;
  saveSmartDispatch: (data: SmartDispatchData, autoRegister: boolean, onProgress?: (log: string, percent: number) => void) => Promise<{ success: boolean; requiresConfirm?: boolean; missingFields?: string[]; errorMessage?: string; contractId?: string; contractNo?: string }>;
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
  getDueContractsForBilling: (targetDate?: string) => { contract: Contract; customer: Customer; site?: CustomerSite; billingDay: number; dueReason: string }[];
  generateDueBillings: (targetDate?: string, targetYm?: string) => Promise<{ successCount: number; skippedContracts: { contractId: string; customerId: string; reason: string }[] }>;
  generateBillingForSingleContract: (contractId: string, billingYm: string, billingDate: string, selectedContractAssetIds?: string[]) => Promise<string | null>;
  regenerateBilling: (billingId: string, customDetails?: Omit<BillingDetail, 'id' | 'billingId' | 'createdAt'>[], options?: { billingYm?: string; billingDate?: string; memo?: string }) => Promise<string>;
  approveBilling: (billingId: string) => Promise<void>; // UNPAID ??REQUESTED (嫄곕옒紐낆꽭??諛쒖넚)
  cancelBilling: (billingId: string, refund?: boolean) => Promise<void>; // ?섎텋=true, 鍮꾪솚遺?false(湲곕낯)
  addReceivable: (data: Omit<Receivable, 'id' | 'createdAt' | 'updatedAt'>) => string;
  generateStandaloneBillingForReceivable: (receivableId: string, reason: string) => Promise<string>;
  linkReceivableToBilling: (billingId: string, receivableId: string, amount: number, displayName?: string) => Promise<void>;
  receivePayment: (billingId: string, data: {
    paymentDate: string;
    amount: number;
    method: string;
    memo: string;
    depositLinks?: { bankTransactionId: string; usedAmount: number }[]; // ?듭옣?낃툑 ?곕룞 (N嫄?
  }) => Promise<void> | void;
  cancelPayment: (paymentId: string) => Promise<void>;  // ?섎궔 痍⑥냼 + PDL ?곗뇙 ??젣 + Billing 濡ㅻ갚 + ?좎닔湲??섏썝
  cancelAllPaymentsForBilling: (billingId: string) => Promise<void>; // 泥?뎄???꾩껜 ?섎궔 ?쇨큵 痍⑥냼 諛?濡ㅻ갚
  saveBankDeposit: (data: Omit<BankTransaction, 'id' | 'createdAt' | 'withdrawAmount'>) => void;  // ?듭옣?낃툑 ?깅줉/?섏젙
  deleteBankDeposit: (txId: string) => void;  // ?듭옣?낃툑 ??젣 (?곌껐 ?섎궔 ?놁쓣 ?뚮쭔)
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

  // Error Reports (?ㅻ쪟 ?좉퀬 愿由? ?깅줉-?묒닔-?꾨즺 3?④퀎 ?쇱씠?꾩궗?댄겢 & ?뚯씪泥⑤?)
  errorReports: ErrorReport[];
  addErrorReport: (report: Omit<ErrorReport, 'id' | 'createdAt' | 'updatedAt' | 'reportNo'> & { id?: string; reportNo?: string }) => Promise<ErrorReport>;
  receiveErrorReport: (id: string, payload: { assigneeId: string; assigneeName: string; receptionNote?: string; targetCompletionDate?: string }) => Promise<void>;
  completeErrorReport: (id: string, payload: { resolutionNote: string; resolvedVersion?: string; rootCause?: string }) => Promise<void>;
  cancelErrorReport: (id: string, reason: string) => Promise<void>;
  reopenErrorReport: (id: string) => Promise<void>;
  deleteErrorReport: (id: string) => Promise<void>;

  // Navigation states (cross-page routing)
  activeTab: string;
  setActiveTab: (tab: string) => void;
  navigationPayload: any;
  setNavigationPayload: (payload: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // React state of database tables
  const [tenants, setTenants] = useState<Tenant[]>(() => db.tenants || []);
  const [currentTenantId, setCurrentTenantIdState] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('erp_current_tenant_id') : null) || db.currentTenant?.id || 'tenant-1';
  });

  const currentTenant = (tenants && tenants.length > 0 ? (tenants.find(t => t.id === currentTenantId || t.tenantCode === currentTenantId) || tenants.find(t => t.isDefault) || tenants[0]) : null) || db.currentTenant;

  const setCurrentTenantId = (id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_current_tenant_id', id);
    }
    setCurrentTenantIdState(id);
  };

  const saveTenant = async (tenant: Partial<Tenant> & { id?: string }): Promise<Tenant> => {
    let saved: Tenant;
    if (tenant.id) {
      saved = db.updateRow<Tenant>('tenants', tenant.id, tenant as any) as Tenant;
    } else {
      saved = db.insertRow<Tenant>('tenants', tenant as any) as Tenant;
    }
    await db.awaitPendingWrites();
    setTenants([...db.tenants]);
    return saved;
  };

  const addTenantWorkplace = async (tenantId: string, workplaceData: Omit<TenantWorkplace, 'id'>): Promise<Tenant> => {
    const targetTenant = tenants.find(t => t.id === tenantId) || currentTenant;
    const newId = `wp-${Date.now()}`;
    const newWorkplace: TenantWorkplace = {
      ...workplaceData,
      id: newId,
      createdAt: new Date().toISOString(),
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
  const [permissions, setPermissions] = useState<MenuPermission[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [sites, setSites] = useState<CustomerSite[]>([]);
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
  const [googleConfigs, setGoogleConfigs] = useState<GoogleConfig[]>([]);
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


  // Navigation / Routing states
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [navigationPayload, setNavigationPayload] = useState<any>(null);

  // 湲濡쒕쾶 而ㅼ뒪? ?먮윭 紐⑤떖 ?곹깭
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title?: string; message: string }>({
    isOpen: false,
    title: '?쒖뒪???ㅻ쪟 諛쒖깮',
    message: ''
  });

  const showErrorModal = (message: string, title: string = '?쒖뒪???ㅻ쪟 諛쒖깮') => {
    setErrorModal({
      isOpen: true,
      title,
      message
    });
  };

  // ?????????????????????????????????????????????????????????
  // 濡쒖뺄 db ?몃찓紐⑤━ ?ㅽ넗????React state 利됱떆 ?숆린??(Supabase pull ?놁쓬 ???????利됯컖 ?붾㈃ 諛섏쁺??
  const refreshAllData = () => {
    // ?뮕 ?뚯옣 1.2 & 5.2 以?? DB ?곸뿉 議댁옱?섎뒗 臾쇰━??以묐났 泥?뎄 ?곸꽭 ?덉퐫???꾨꼍 ?뚰깢 & ?먭꺽 DB(Supabase) ?숆린 ??젣
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
      // ?먭꺽 DB?먯꽌??以묐났 ??臾쇰━ ??젣 ?湲?
      db.awaitPendingWrites().catch(err => console.error("BillingDetails cleanup error:", err));
    }

    // ?뮕 ?뚯옣 1.2 & 5.2 以?? 怨꾩빟/諛곗감媛 議댁옱?섏? ?딅뒗 怨좎븘 異쒓퀬寃?섏쓽猶?outboundInspections) ?먮룞 ?뚰깢 & DB ?숆린 ??젣
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
    }

    // 吏꾩쭨 媛쒕컻??admin, sys-admin) 怨꾩젙留?'媛쒕컻??濡??뺢퇋??(?ъ옣/遺?ъ옣 ??理쒓퀬愿由ъ옄 ?깅챸 蹂댁〈)
    db.users.forEach(u => {
      if (u.loginId === 'admin' || u.id === 'sys-admin') {
        u.name = '媛쒕컻??;
      }
    });

    setTenants([...db.tenants]);
    setUsers([...db.users]);
    setPermissions([...db.permissions]);
    setCustomers(sortCustomersByName([...db.customers]));
    setContacts([...db.contacts]);
    setSites([...db.sites]);
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
    setGoogleConfigs([...db.googleConfigs]);
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

    setCurrentUser(prev => {
      if (prev && (prev.loginId === 'admin' || prev.id === 'sys-admin')) {
        return { ...prev, name: '媛쒕컻?? };
      }
      return prev;
    });
  };

  // ?꾩껜 ?뚯씠釉?Supabase pull ??state ?숆린??(珥덇린 濡쒕뵫 ?꾩슜)
  const fullRefreshFromServer = async () => {
    if (db.isSupabaseConnected()) {
      try {
        await db.pullFromSupabase();
      } catch (err) {
        console.error("Failed to sync from Supabase:", err);
      }
    }
    refreshAllData();
  };

  // 硫붾돱蹂?愿???뚯씠釉붾쭔 Supabase pull (硫붾돱 ?꾪솚 ???몄텧 ??理쒖떊 ?곗씠??蹂댁옣)
  const MENU_TABLE_MAP: Record<string, string[]> = {
    'dashboard':            ['deliveries', 'contracts', 'todos', 'assets'],
    'delivery':             ['deliveries', 'transportCompanies', 'transportDrivers', 'contracts', 'assets', 'printStations', 'printQueue'],
    'transport_master':     ['transportCompanies', 'transportDrivers'],
    'field_as':             ['repairs', 'assets', 'users', 'consumables', 'mechanicConsumableStocks', 'customers', 'sites', 'contracts'],
    'smart_as_request':     ['repairs', 'customers', 'sites', 'contracts', 'contractAssets', 'assets'],
    'repair':               ['repairs', 'assets', 'consumables', 'repairConsumables', 'mechanicConsumableStocks', 'vendors'],
    'contract':             ['contracts', 'contractAssets', 'customers', 'assets'],
    'billing':              ['billingDetails', 'payments', 'paymentDepositLinks', 'bankTransactions', 'contracts', 'customers'],
    'customer':             ['customers', 'contacts', 'sites'],
    'product':              ['products'],
    'asset':                ['assets', 'products', 'vendors'],
    'acquisition_disposal': ['assets', 'products', 'vendors'],
    'rent_asset':           ['assets', 'vendors'],
    'consumable':           ['consumables', 'consumableLogs', 'consumablePurchases', 'vendors', 'mechanicConsumableStocks', 'stocktakingAudits', 'stocktakingAuditItems', 'collectedParts'],
    'consumable_purchase':  ['consumables', 'consumablePurchases', 'vendors'],
    'consumable_inout':     ['consumables', 'consumableLogs', 'consumablePurchases', 'assets', 'mechanicConsumableStocks'],
    'consumable_stock':     ['consumables', 'consumableLogs', 'mechanicConsumableStocks', 'stocktakingAudits', 'stocktakingAuditItems', 'collectedParts'],
    'smart_dispatch':       ['deliveries', 'contracts', 'assets', 'transportCompanies', 'transportDrivers', 'printStations', 'printQueue'],
    'smart_dispatch4':      ['customers', 'sites', 'contacts', 'contracts', 'deliveries', 'assets', 'products'],
    'smart_return':         ['deliveries', 'contracts', 'assets', 'transportCompanies', 'transportDrivers', 'printStations', 'printQueue'],
    'asset_inout_history':  ['assetInOutLogs', 'assets', 'customers'],
    'dispatch_assign':      ['contracts', 'contractAssets', 'assets', 'outboundInspections', 'customers'],
    'outbound_inspections': ['outboundInspections', 'contracts', 'contractAssets', 'assets', 'customers', 'sites', 'deliveries'],
    'bank_matching':        ['bankTransactions', 'bankMatchingRules', 'customers'],
    'vendors':              ['vendors'],
    'organization':         ['users', 'departments'],
    'permission':           ['users', 'permissions', 'departments', 'customRoles', 'rolePermissions'],
    'payroll':              ['users', 'departments'],
    'corporate_card':       ['vendors'],
    'cash_flow':            ['payments', 'contracts', 'assets'],
    'delinquency':          ['customers', 'contracts'],
    'google_config':        ['googleConfigs'],
    'depreciation_execution': ['depreciationLogs', 'assets'],
    'leave_application':    ['users', 'annualLeaveQuotas', 'leaveUsages'],
    'leave_management':     ['users', 'annualLeaveQuotas', 'leaveUsages', 'overtimeRecords', 'departments'],
    'ot_management':        ['users', 'overtimeRecords', 'departments'],
    'leave_ot':             ['users', 'annualLeaveQuotas', 'leaveUsages', 'overtimeRecords'],
    'vehicle_log':          ['corporateVehicles', 'vehicleOperationLogs', 'vehicleFuelLogs', 'users'],
    'regular_reports':      ['contracts', 'contractAssets', 'deliveries', 'assets', 'repairs', 'purchaseSettlements', 'purchaseSettlementItems', 'billingDetails', 'bankTransactions', 'customers'],
    'initial_db_upload':    ['contracts', 'contractAssets', 'customers', 'assets', 'sites', 'billingDetails'],
    'print_queue_monitor':  ['printStations', 'printQueue'],
    'privacy_audit':        ['privacyAccessLogs', 'users', 'departments'],
    'receivable':           ['billingDetails', 'customers', 'contracts', 'bankTransactions'],
    'purchase_settlement':  ['purchaseSettlements', 'purchaseSettlementItems', 'vendors', 'assets'],
    'inspection_checklist_manage': ['inspectionChecklists', 'inspectionItems'],
    'error_report':         ['errorReports', 'users'],
    'agentic_ai_lab':       ['contracts', 'assets', 'deliveries'],
    'agentic_dispatch_studio': ['deliveries', 'contracts', 'assets'],
    'agentic_settlement_autopilot': ['billingDetails', 'bankTransactions', 'purchaseSettlements'],
    'agentic_asset_lifecycle': ['assets', 'contracts', 'repairs'],
    'dev_uploader':         ['contracts', 'contractAssets', 'customers', 'assets'],
  };

  const loadTablesForMenu = async (menuId: string) => {
    if (!db.isSupabaseConnected()) return;
    const keys = MENU_TABLE_MAP[menuId];
    if (!keys || keys.length === 0) return;
    try {
      await Promise.all(keys.map(key => db.pullTableFromSupabase(key)));
      refreshAllData();
    } catch (err) {
      console.warn('loadTablesForMenu error:', err);
    }
  };


  useEffect(() => {
    // Seed 怨꾩빟 ?곗씠??珥덇린?붾뒗 媛쒕컻 ?섍꼍(localhost)?먯꽌留??ㅽ뻾
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (!localStorage.getItem('seed_v1_8_dummy_contracts_v2')) {
        localStorage.removeItem('erp_contracts');
        localStorage.removeItem('erp_contractAssets');
        localStorage.setItem('seed_v1_8_dummy_contracts_v2', 'true');
      }
    }


    // ?덉쟾??Google Config 留덉씠洹몃젅?댁뀡 (湲곗〈 ?뺣낫 蹂댁〈 諛??좉퇋 而щ읆 二쇱엯)
    const existingConfigsStr = localStorage.getItem('erp_googleConfigs');
    if (existingConfigsStr) {
      try {
        const configs = JSON.parse(existingConfigsStr);
        if (Array.isArray(configs) && configs.length > 0) {
          let updated = false;
          const defaultTemplate: Record<string, any> = {
            isDevMode: false,
            quotationTemplateUrl: 'templates/?뚰깉寃ъ쟻???묒떇.html',
            contractTemplateUrl: 'templates/怨좎냼?묒뾽?_?꾨?李④퀎?쎌꽌_?묒떇.html',
            safetyInspectionTemplateUrl: 'templates/怨좎냼?묒뾽?_?덉쟾?먭?寃곌낵???묒떇.html',
            preDeliveryChecklistTemplateUrl: 'templates/諛섏엯??CHECK_LIST_?묒떇.html',
            bizRegCertUrl: '',
            bankbookCopyUrl: '',
            transactionStatementTemplateUrl: 'templates/嫄곕옒紐낆꽭???묒떇.html',
            r2AccountId: '35014a2514680107d74e1e68d96e6c32',
            r2BucketName: 'kiyeun-storage',
            r2AccessKeyId: '03cdb7560d37242de608a5db2a976030',
            r2SecretAccessKey: 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986',
            r2PublicDomain: 'https://pub-a2fd3c2ae0cc450b8ebe34baf1b051e1.r2.dev'
          };

          const mergedConfigs = configs.map(cfg => {
            const newCfg = { ...cfg };
            for (const [key, value] of Object.entries(defaultTemplate)) {
              if (newCfg[key] === undefined) {
                newCfg[key] = value;
                updated = true;
              }
            }
            return newCfg;
          });

          if (updated) {
            localStorage.setItem('erp_googleConfigs', JSON.stringify(mergedConfigs));
          }
        }
      } catch (e) {
        console.error('Failed to migrate google config safely', e);
      }
    }
    localStorage.setItem('seed_v2_2_google_config_v2', 'true');

    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    const savedUser = sessionStorage.getItem('user');
    const autoUser = localStorage.getItem('auto_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.loginId === 'admin' && (parsed.name === '理쒓퀬愿由ъ옄' || !parsed.name)) {
          parsed.name = '媛쒕컻??;
          sessionStorage.setItem('user', JSON.stringify(parsed));
        }
        setCurrentUser(parsed);
      } catch (e) {
        setCurrentUser(null);
      }
    } else if (autoUser) {
      try {
        const parsed = JSON.parse(autoUser);
        if (parsed.loginId === 'admin' && (parsed.name === '理쒓퀬愿由ъ옄' || !parsed.name)) {
          parsed.name = '媛쒕컻??;
          localStorage.setItem('auto_user', JSON.stringify(parsed));
        }
        setCurrentUser(parsed);
      } catch (e) {
        setCurrentUser(null);
      }
    }
    
    // 珥덇린 濡쒕뵫: ?꾩껜 28媛??뚯씠釉?Supabase pull (??理쒖큹 吏꾩엯 1?뚮쭔)
    fullRefreshFromServer();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const login = async (
    loginId: string, 
    passwordHash: string, 
    keepLoggedIn?: boolean
  ): Promise<{ success: boolean; reason?: string }> => {
    const cleanId = (loginId || '').trim();
    const cleanPw = (passwordHash || '').trim();

    if (!cleanId) {
      return { success: false, reason: '?ъ슜???꾩씠?붾? ?낅젰??二쇱떗?쒖삤.' };
    }
    if (!cleanPw) {
      return { success: false, reason: '鍮꾨?踰덊샇瑜??낅젰??二쇱떗?쒖삤.' };
    }

    // 1. 媛쒕컻??/ 理쒓퀬愿由ъ옄 留덉뒪??怨꾩젙 (DB/?ㅽ듃?뚰겕 ?곹깭? 臾닿??섍쾶 100% 臾댁“嫄?蹂댁옣)
    if (cleanId.toLowerCase() === 'admin' && cleanPw === 'admin123') {
      const fallbackAdmin: User = { 
        id: 'sys-admin', loginId: 'admin', passwordHash: 'admin123', 
        name: '媛쒕컻??, department: '?쒖뒪??, departmentId: '', role: 'ADMIN', customRoleId: 'role_mgmt', createdAt: new Date().toISOString() 
      };
      setCurrentUser(fallbackAdmin);
      sessionStorage.setItem('user', JSON.stringify(fallbackAdmin));
      if (keepLoggedIn) {
        localStorage.setItem('auto_user', JSON.stringify(fallbackAdmin));
      } else {
        localStorage.removeItem('auto_user');
      }
      logPrivacyAccess('LOGIN', 'login', '媛쒕컻??理쒓퀬愿由ъ옄 濡쒓렇???깃났', {
        userId: fallbackAdmin.loginId,
        userName: fallbackAdmin.name
      }).catch(console.error);
      return { success: true };
    }

    // 2. 媛쒕컻 ?꾩슜 ?뚯뒪??怨꾩젙 蹂댁옣 (manager, user, mechanic)
    if (cleanId.toLowerCase() === 'manager' && cleanPw === 'mgr123') {
      const fallbackManager: User = {
        id: 'USR-MGR-TEST', loginId: 'manager', passwordHash: 'mgr123',
        name: '?곸뾽愿由ъ옄', department: '?곸뾽愿由?, departmentId: 'DEPT-0000003', role: 'MANAGER', customRoleId: 'role_sales', createdAt: new Date().toISOString()
      };
      setCurrentUser(fallbackManager);
      sessionStorage.setItem('user', JSON.stringify(fallbackManager));
      if (keepLoggedIn) localStorage.setItem('auto_user', JSON.stringify(fallbackManager));
      return { success: true };
    }
    if (cleanId.toLowerCase() === 'user' && cleanPw === 'user123') {
      const fallbackUser: User = {
        id: 'USR-USER-TEST', loginId: 'user', passwordHash: 'user123',
        name: '?쇰컲?곸뾽', department: '?곸뾽遺', departmentId: 'DEPT-0000003', role: 'USER', customRoleId: 'role_sales', createdAt: new Date().toISOString()
      };
      setCurrentUser(fallbackUser);
      sessionStorage.setItem('user', JSON.stringify(fallbackUser));
      if (keepLoggedIn) localStorage.setItem('auto_user', JSON.stringify(fallbackUser));
      return { success: true };
    }
    if (cleanId.toLowerCase() === 'mechanic' && cleanPw === 'mech123') {
      const fallbackMech: User = {
        id: 'USR-MECH-TEST', loginId: 'mechanic', passwordHash: 'mech123',
        name: '?뺣퉬湲곗궗', department: '?뺣퉬遺', departmentId: 'DEPT-0000005', role: 'MECHANIC', customRoleId: 'role_mechanic', createdAt: new Date().toISOString()
      };
      setCurrentUser(fallbackMech);
      sessionStorage.setItem('user', JSON.stringify(fallbackMech));
      if (keepLoggedIn) localStorage.setItem('auto_user', JSON.stringify(fallbackMech));
      return { success: true };
    }

    // 3. 濡쒖뺄 罹먯떆 ?ъ슜??寃??(?꾩씠?? ?ъ썝紐? ?щ쾲, ?꾪솕踰덊샇, ?대찓???ㅺ컖??留ㅼ묶)
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

    let user = db.users.find(matchUser);

    // 4. 濡쒖뺄 罹먯떆???녿뒗 寃쎌슦 (珥덇린 濡쒕뵫 ???먮뒗 罹먯떆 誘몃컲??, Supabase ?먭꺽 DB 吏곸젒 ?④굔 議고쉶 (Zero Race Condition)
    if (!user && db.isSupabaseConnected() && supabase) {
      try {
        const { data: suUsers } = await supabase
          .from('users')
          .select('*')
          .or(`loginId.ilike.${cleanId},name.ilike.${cleanId},id.ilike.${cleanId}`);
        if (suUsers && suUsers.length > 0 && suUsers[0]) {
          const foundUser = suUsers[0] as User;
          user = foundUser;
          // 濡쒖뺄 罹먯떆??利됱떆 蹂닿컯 ???
          const currentList = db.users;
          if (!currentList.some(u => u.id === foundUser.id)) {
            db.users = [...currentList, foundUser];
          }
        }
      } catch (suErr) {
        console.warn('?먭꺽 DB 吏곸젒 ?ъ슜???몄쬆 議고쉶 ?ㅻ쪟:', suErr);
      }
    }

    // 5. ?ъ슜?먮? 李얠쓣 ???녿뒗 寃쎌슦 (?깅줉?섏? ?딆? ?ъ썝)
    if (!user) {
      logPrivacyAccess('LOGIN', 'login', `濡쒓렇??嫄곕?: 誘몃벑濡?怨꾩젙 ?쒕룄 ('${cleanId}')`, {
        userId: cleanId,
        userName: '誘몄떇蹂?
      }).catch(console.error);
      return { 
        success: false, 
        reason: `?깅줉?섏? ?딆? ?ъ썝 怨꾩젙?낅땲?? ('${cleanId}')\n?ъ썝紐??? 源?숈슦, ?댁닔???? ?먮뒗 ?щ쾲???뺥솗???낅젰??二쇱떗?쒖삤.` 
      };
    }

    // 6. 怨꾩젙 ?곹깭 寃利?(?ъ쭅, ?댁쭅, ?댁궗)
    if (user.status === 'RETIRED') {
      logPrivacyAccess('LOGIN', 'login', `濡쒓렇??嫄곕?: ?댁궗??怨꾩젙 ?묒냽 李⑤떒 (${user.name})`, {
        userId: user.loginId || user.id,
        userName: user.name
      }).catch(console.error);
      return { 
        success: false, 
        reason: `?댁궗 泥섎━??怨꾩젙?낅땲?? (${user.name} ??\n濡쒓렇?몄씠 ?쒗븳?섏삤???몄궗?대떦?먯뿉寃?臾몄쓽??二쇱떗?쒖삤.` 
      };
    }

    if (user.status === 'LEAVE_OF_ABSENCE') {
      logPrivacyAccess('LOGIN', 'login', `濡쒓렇??嫄곕?: ?댁쭅??怨꾩젙 ?묒냽 李⑤떒 (${user.name})`, {
        userId: user.loginId || user.id,
        userName: user.name
      }).catch(console.error);
      return { 
        success: false, 
        reason: `?꾩옱 ?댁쭅 ?곹깭濡??ㅼ젙??怨꾩젙?낅땲?? (${user.name} ??\n愿由ъ옄?먭쾶 ?낅Т 蹂듦? ?뱀씤???붿껌??二쇱떗?쒖삤.` 
      };
    }

    // 7. 鍮꾨?踰덊샇 寃利?(誘몄꽕???ъ썝? ?щ궡 湲곕낯 鍮꾨?踰덊샇 1111 ?곸슜)
    const expectedPassword = user.passwordHash || '1111';
    if (expectedPassword !== cleanPw) {
      logPrivacyAccess('LOGIN', 'login', `濡쒓렇??嫄곕?: 鍮꾨?踰덊샇 遺덉씪移?(${user.name})`, {
        userId: user.loginId || user.id,
        userName: user.name
      }).catch(console.error);
      return { 
        success: false, 
        reason: `鍮꾨?踰덊샇媛 ?쇱튂?섏? ?딆뒿?덈떎. (${user.name} ??\n?ъ썝 珥덇린 鍮꾨?踰덊샇??'1111'?낅땲?? 鍮꾨?踰덊샇瑜??ㅼ떆 ?뺤씤??二쇱떗?쒖삤.` 
      };
    }

    // 8. 沅뚰븳 ?곸냽 濡??꾨씫 ??遺??湲곕컲 ?먮룞 ?곸냽 蹂닿컯
    if (!user.customRoleId) {
      const dept = (user.departmentId || user.department || '').toUpperCase();
      let assignedRoleId = '';
      if (dept.includes('0000001') || dept.includes('0000002') || dept.includes('愿由?) || dept.includes('寃쎌쁺') || dept.includes('?꾩썝') || user.position === '?ъ옣' || user.position === '遺?ъ옣' || user.position === '??쒖씠??) assignedRoleId = 'role_mgmt';
      else if (dept.includes('0000003') || dept.includes('?곸뾽')) assignedRoleId = 'role_sales';
      else if (dept.includes('0000004') || dept.includes('異쒓퀬') || dept.includes('諛곗감')) assignedRoleId = 'role_logistics';
      else if (dept.includes('0000005') || dept.includes('0000006') || dept.includes('AS') || dept.includes('?뺣퉬') || dept.includes('?멸뎅??)) assignedRoleId = 'role_mechanic';
      if (assignedRoleId) {
        user = { ...user, customRoleId: assignedRoleId };
      }
    }

    // 9. 濡쒓렇???깃났 ?뺤젙
    if (user.loginId === 'admin' && user.name === '理쒓퀬愿由ъ옄') {
      user.name = '媛쒕컻??;
    }
    setCurrentUser(user);
    sessionStorage.setItem('user', JSON.stringify(user));
    if (keepLoggedIn) {
      localStorage.setItem('auto_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auto_user');
    }
    logPrivacyAccess('LOGIN', 'login', `?ъ슜??濡쒓렇???깃났: ${user.name} (${user.department || user.position || '?꾩쭅??})`, {
      userId: user.loginId || user.id,
      userName: user.name
    }).catch(console.error);

    return { success: true };
  };

  const logout = () => {
    if (currentUser) {
      logPrivacyAccess('LOGOUT', 'logout', `?ъ슜??濡쒓렇?꾩썐: ${currentUser.name}`, {
        userId: currentUser.loginId,
        userName: currentUser.name
      }).catch(console.error);
    }
    setCurrentUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('original_admin_user');
    localStorage.removeItem('auto_user');
  };

  const switchUser = (userId: string) => {
    let targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      // sys-admin ??users 諛곗뿴???녿뒗 fallback 怨꾩젙?쇰줈??蹂듦? 泥섎━
      const originalAdminStr = sessionStorage.getItem('original_admin_user');
      if (originalAdminStr) {
        const originalAdmin = JSON.parse(originalAdminStr);
        if (originalAdmin.id === userId) {
          targetUser = originalAdmin;
        }
      }
    }
    
    if (targetUser) {
      logPrivacyAccess('VIEW', 'switch_user', `?ъ슜??怨꾩젙 ?꾪솚: ${currentUser?.name || '誘몄씤利?} -> ${targetUser.name}`, {
        userId: currentUser?.loginId || targetUser.loginId,
        userName: currentUser?.name || targetUser.name,
        targetSubjectId: targetUser.id,
        targetSubjectName: targetUser.name
      }).catch(console.error);

      if (currentUser?.role === 'ADMIN' && !sessionStorage.getItem('original_admin_user')) {
        sessionStorage.setItem('original_admin_user', JSON.stringify(currentUser));
      }
      setCurrentUser(targetUser);
      sessionStorage.setItem('user', JSON.stringify(targetUser));
    }
  };

  const hasPermission = (menuId: string, action: 'view' | 'save'): boolean => {
    if (!currentUser) return false;

    // 0. ?댁궗(RETIRED) 怨꾩젙? ?꾩궗 紐⑤뱺 硫붾돱 沅뚰븳 利됱떆 ?꾨㈃ 李⑤떒 (Zero-Access Security)
    if (currentUser.status === 'RETIRED') return false;

    // 0-1. ?댁쭅(LEAVE_OF_ABSENCE) 怨꾩젙? 蹂寃????save) 沅뚰븳 ?먯쿇 李⑤떒 (議고쉶留??덉슜)
    if (currentUser.status === 'LEAVE_OF_ABSENCE' && action === 'save') return false;

    // 1. ?쒖뒪??理쒓퀬愿由ъ옄 怨꾩젙 諛?ADMIN ??븷 ?ъ슜?먮뒗 紐⑤뱺 硫붾돱??100% 臾댁“嫄?沅뚰븳 遺??
    if (currentUser.role === 'ADMIN' || currentUser.loginId === 'admin' || currentUser.id === 'sys-admin' || currentUser.id === 'u-1') return true;

    // 2. ?⑥씪 ?쒖?(SSOT) ?⑥닔??硫붾돱 ID濡??뺢퇋??
    const normMenuId = normalizeMenuId(menuId);

    // 2-1. ?곗감?좎껌, 留ㅻ돱???ㅽ뒠?붿삤, ?낅Т留ㅻ돱??諛??ㅻ쪟 ?좉퀬??沅뚰븳 援щ텇 ?놁씠 紐⑤뱺 ?꾩쭅?먯쓽 怨듯넻 湲곕뒫?쇰줈 泥섎━ (?꾩썝 ?곸떆 媛쒕갑)
    if (normMenuId === 'leave_application' || normMenuId === 'manual_studio' || normMenuId === 'operations_manual' || normMenuId === 'error_report') {
      return true;
    }

    // 2-2. ?곗감愿由?沅뚰븳? 湲됱뿬 沅뚰븳?먯? 100% ?숈씪?섍쾶 蹂寃?(湲됱뿬 沅뚰븳 ?곸냽)
    if (normMenuId === 'leave_management') {
      return hasPermission('payroll', action);
    }

    // 3. ?ъ슜???뺤쓽 沅뚰븳 紐낆묶(CustomRole) ?곸냽 ?먯젙 (??븷 湲곕컲 ?먮룞 ?곸냽 理쒖슦??
    if (currentUser.customRoleId) {
      const rolePerm = rolePermissions.find(p => 
        p.roleId === currentUser.customRoleId && 
        normalizeMenuId(p.menuId) === normMenuId
      );
      if (rolePerm) {
        return action === 'view' ? Boolean(rolePerm.canView) : Boolean(rolePerm.canSave);
      }
    }

    // 4. ?ъ슜?먮퀎 紐낆떆???ㅻ쾭?쇱씠??媛쒖씤 ?덉쇅 沅뚰븳) ?곗꽑 ?먯젙
    const perm = permissions.find(p => 
      (p.userId === currentUser.id || (p as any).user_id === currentUser.id) && 
      normalizeMenuId(p.menuId) === normMenuId
    );
    if (perm) {
      return action === 'view' ? Boolean(perm.canView) : Boolean(perm.canSave);
    }

    // 5. 吏곷Т ?쒗뵆由?RBAC) 湲곕컲 ?먮룞 ?곸냽 ?먯젙
    const dept = currentUser.departmentId || currentUser.department;
    const templateRule = getRoleTemplatePermission(currentUser.role, dept, normMenuId, action);
    if (templateRule !== undefined) {
      return templateRule;
    }

    // 6. ?꾧꺽??嫄곕? ?곗꽑 (Deny-by-Default): ?뺤쓽?섏? ?딆? 硫붾돱???꾨㈃ 李⑤떒
    return false;
  };

  const updatePermissions = async (updated: MenuPermission[]) => {
    try {
      db.permissions = updated;
      if (supabase) {
        // DB ?ㅽ궎留?諛??덇굅??role/updatedAt NOT NULL ?쒖빟 議곌굔 ?고쉶瑜??꾪빐 ??꾩뒪?ы봽 & 湲곕낯媛?遺??(userId camelCase ?⑥씪 ?쒖? ?곸슜)
        const nowStr = new Date().toISOString();
        const payload = updated.map(p => ({
          ...p,
          userId: p.userId,
          role: (p as any).role || 'USER',
          createdAt: p.createdAt || nowStr,
          updatedAt: nowStr
        }));

        const lastCommandInfo = `supabase.from('permissions').upsert(payload[${payload.length}嫄?, { onConflict: 'id' })`;
        const samplePayloadJson = JSON.stringify(payload.slice(0, 2), null, 2);

        const { error } = await supabase.from('permissions').upsert(payload as any[], { onConflict: 'id' });
        if (error) {
          const isSchemaCacheOrColumnError = error.message?.includes("userId") || error.code === 'PGRST204' || error.code === 'PGRST200';
          const rawErrorDetails = 
            `??[留덉?留??ㅽ뻾 ?쒕룄 紐낅졊]: ${lastCommandInfo}\n` +
            `??[PostgREST Raw Error]:\n` +
            `  - Code: ${error.code || 'N/A'}\n` +
            `  - Message: ${error.message || 'N/A'}\n` +
            `  - Details: ${error.details || 'N/A'}\n` +
            `  - Hint: ${error.hint || 'N/A'}\n\n` +
            `??[?쒕룄???섏씠濡쒕뱶 ?섑뵆 (理쒕? 2嫄?]:\n${samplePayloadJson}\n\n` +
            `??[議곗튂 ?덈궡 (媛쒕컻???꾧뎄 ?⑥튂 ?곸슜 ?먮뒗 Supabase SQL Editor ?ㅽ뻾 DDL)]:\n` +
            (isSchemaCacheOrColumnError
              ? `?뮕 ?먯씤: Supabase DB??permissions ?뚯씠釉?而щ읆 誘몃퉬 ?먮뒗 PostgREST ?ㅽ궎留?罹먯떆 誘멸갚???꾩긽?낅땲??\n` +
                `1) [媛쒕컻???꾧뎄] ??[[媛쒕컻] DB ?곗씠???낅줈?? 硫붾돱 ?섎떒??[???⑥튂 ?먮룞 ?곸슜 (DB 吏곸젒 ?ㅽ뻾)] 踰꾪듉 ?대┃\n` +
                `2) ?먮뒗 Supabase SQL Editor?먯꽌 ?꾨옒 DDL 吏곸젒 ?ㅽ뻾:\n` +
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

  const updateGoogleConfig = async (configData: GoogleConfig) => {
    try {
      const nowIso = new Date().toISOString();
      const payload: GoogleConfig = { ...configData, updatedAt: nowIso };

      // 1. 濡쒖뺄 ?ㅽ넗由ъ? 利됱떆 諛섏쁺
      const currentList = [...db.googleConfigs];
      const localIndex = currentList.findIndex(cfg => cfg.id === configData.id);
      if (localIndex >= 0) {
        currentList[localIndex] = payload;
      } else {
        currentList.push({ ...payload, createdAt: nowIso });
      }
      db.googleConfigs = currentList;
      localStorage.setItem('erp_googleConfigs', JSON.stringify(currentList));

      // 2. Supabase UPSERT ????議댁옱 ?щ?? 愿怨꾩뾾??諛섎뱶??諛섏쁺
      if (supabase) {
        const upsertPayload = { ...payload, createdAt: (payload as any).createdAt || nowIso };
        const { error } = await supabase
          .from('google_configs')
          .upsert([upsertPayload], { onConflict: 'id' });
        if (error) {
          console.error('Supabase upsert failed for google_configs:', error);
          throw error;
        }
      }

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('updateGoogleConfig Error:', err);
      showErrorModal(`?좑툘 援ш? ?ㅼ젙 ?먭꺽 DB ????ㅽ뙣:\n\n${err?.message || err}`, '?먭꺽 DB ????ㅻ쪟');
      throw err;
    }
  };

  // ?? ?ъ슜???뺤쓽 沅뚰븳 紐낆묶(CustomRole) 諛?沅뚰븳(RolePermission) 愿由?裕ㅽ뀒?댄꽣 ??
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
      showErrorModal(`沅뚰븳 紐낆묶 ????ㅽ뙣: ${err?.message || err}`);
      throw err;
    }
  };

  const deleteCustomRole = async (roleId: string) => {
    try {
      const list = db.customRoles.filter(r => r.id !== roleId);
      db.customRoles = list;
      setCustomRoles([...list]);

      // ?대떦 ??븷???몃? 硫붾돱 沅뚰븳 ??젣
      const remainingPerms = db.rolePermissions.filter(p => p.roleId !== roleId);
      db.rolePermissions = remainingPerms;
      setRolePermissions([...remainingPerms]);

      // ?대떦 ??븷???곸냽諛쏆? ?ъ슜?먮뱾??customRoleId ?댁젣
      const updatedUsers = db.users.map(u => u.customRoleId === roleId ? { ...u, customRoleId: undefined } : u);
      db.users = updatedUsers;
      setUsers([...updatedUsers]);

      await db.deleteRow('customRoles', roleId);
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('deleteCustomRole error:', err);
      showErrorModal(`沅뚰븳 紐낆묶 ??젣 ?ㅽ뙣: ${err?.message || err}`);
      throw err;
    }
  };

  const saveRolePermissions = async (roleId: string, perms: { menuId: string; canView: boolean; canSave: boolean }[]) => {
    try {
      const now = new Date().toISOString();
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

      // ?봽 ?대떦 roleId瑜?蹂댁쑀???꾩쭅?먮뱾??permissions(805???명솚 ?뚯씠釉???100% ?숆린??
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
      showErrorModal(`??븷 硫붾돱 沅뚰븳 ????ㅽ뙣: ${err?.message || err}`);
      throw err;
    }
  };

  const assignUserRole = async (userId: string, customRoleId: string | null) => {
    try {
      const list = [...db.users];
      const idx = list.findIndex(u => u.id === userId);
      if (idx > -1) {
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

        // ?봽 ?곸냽????븷??沅뚰븳??permissions ?뚯씠釉??덇굅??湲濡쒕쾶 ?명솚)?먮룄 1:1 ?숆린??
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
      showErrorModal(`吏곸썝 沅뚰븳 紐낆묶 ?곸냽 諛곗젙 ?ㅽ뙣: ${err?.message || err}`);
      throw err;
    }
  };

  const saveUser = (userData: Omit<User, 'id' | 'createdAt'> & { id?: string }) => {
    if (userData.id) {
      db.updateRow<User>('users', userData.id, userData);
    } else {
      // ?좉퇋 ?꾩쭅???앹꽦
      const newUser = db.insertRow<User>('users', { ...userData, createdAt: new Date().toISOString() });
      
      // ADMIN ??븷 ?좉퇋 ?꾩쭅?먯? 紐⑤뱺 硫붾돱?????湲곕낯 ?꾩껜 沅뚰븳(canView+canSave=true) ?덉퐫???먮룞 ?앹꽦
      if (userData.role === 'ADMIN' && newUser?.id) {
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
    if (cust.id) {
      res = db.updateRow<Customer>('customers', cust.id, cust) as Customer;

      // 怨좉컼 ?뺣낫 蹂댁셿 ?꾨즺 ??愿??????Todo) ?먮룞 ?곴퀎 泥섎━
      const relatedTodos = db.todos.filter(
        t => t.relatedEntityId === cust.id && t.type === 'MISSING_INFO' && !t.isCompleted
      );
      if (relatedTodos.length > 0) {
        const isInfoComplete = 
          cust.bizRegNo && cust.bizRegNo !== '誘몄긽' && cust.bizRegNo.trim() !== '' &&
          cust.representative && cust.representative !== '誘몄긽' && cust.representative.trim() !== '' &&
          cust.repContact && cust.repContact !== '誘몄긽' && cust.repContact.trim() !== '' &&
          cust.address && cust.address !== '誘몄긽' && cust.address.trim() !== '' &&
          cust.repEmail && cust.repEmail !== '誘몄긽' && cust.repEmail.trim() !== '';

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

  const saveContact = async (contact: Omit<CustomerContact, 'id' | 'createdAt'> & { id?: string }): Promise<CustomerContact> => {
    let savedContact: CustomerContact;
    if (contact.id) {
      savedContact = db.updateRow<CustomerContact>('contacts', contact.id, contact as CustomerContact);
    } else {
      savedContact = db.insertRow<CustomerContact>('contacts', {
        ...contact,
        isActive: contact.isActive !== undefined ? contact.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<CustomerContact, 'id'>);
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
    return savedContact;
  };

  const deleteContact = async (id: string) => {
    // ??怨좎븘 ?덉퐫??諛⑹?: 怨꾩빟???깅줉???대떦????젣 李⑤떒
    const linkedContracts = db.contracts.filter(c => c.contactId === id);
    if (linkedContracts.length > 0) {
      showErrorModal(
        `?좑툘 ?대떦 ?대떦?먮? ??젣?????놁뒿?덈떎.\n\n?곌껐??怨꾩빟??${linkedContracts.length}嫄?議댁옱?⑸땲??\n怨꾩빟?먯꽌 ?대떦?먮? 癒쇱? 蹂寃??댁젣?섏떗?쒖삤.`,
        '?대떦????젣 遺덇?'
      );
      return;
    }
    db.deleteRow('contacts', id);
      await db.awaitPendingWrites();
    if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
      try {
        await db.pendingWrites[db.pendingWrites.length - 1];
      } catch (err) {
        console.error("Supabase write await error:", err);
        throw err;
      }
    }
    refreshAllData();
  };

  const saveSite = async (site: Omit<CustomerSite, 'id' | 'createdAt'> & { id?: string }): Promise<CustomerSite> => {
    let savedSite: CustomerSite;
    if (site.id) {
      savedSite = db.updateRow<CustomerSite>('sites', site.id, site as CustomerSite);
    } else {
      savedSite = db.insertRow<CustomerSite>('sites', {
        ...site,
        isActive: site.isActive !== undefined ? site.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<CustomerSite, 'id'>);
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
    return savedSite;
  };

  const deleteSite = async (id: string) => {
    // ??怨좎븘 ?덉퐫??諛⑹?: ?곌껐??怨꾩빟 ?먮뒗 ?ъ엯 以묒씤 ?λ퉬媛 ?덉쑝硫???젣 李⑤떒
    const linkedContracts = db.contracts.filter(c => c.siteId === id);
    const linkedAssets = db.assets.filter(a => a.currentSiteId === id);
    if (linkedContracts.length > 0 || linkedAssets.length > 0) {
      showErrorModal(
        `?좑툘 ?대떦 ?꾩옣????젣?????놁뒿?덈떎.\n\n` +
        (linkedContracts.length > 0 ? `???곌껐??怨꾩빟: ${linkedContracts.length}嫄?n` : '') +
        (linkedAssets.length > 0 ? `???ъ엯 以묒씤 ?λ퉬: ${linkedAssets.length}?\n` : '') +
        `\n怨꾩빟 ?먮뒗 ?λ퉬?먯꽌 ?꾩옣 ?곌껐??癒쇱? ?댁젣?섏떗?쒖삤.`,
        '?꾩옣 ??젣 遺덇?'
      );
      return;
    }
    db.deleteRow('sites', id);
      await db.awaitPendingWrites();
    if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
      try {
        await db.pendingWrites[db.pendingWrites.length - 1];
      } catch (err) {
        console.error("Supabase write await error:", err);
        throw err;
      }
    }
    refreshAllData();
  };

  const saveProduct = async (prod: Omit<Product, 'id' | 'createdAt'> & { id?: string }) => {
    let result;
    if (prod.id) {
      result = db.updateRow<Product>('products', prod.id, prod as Product);
    } else {
      result = db.insertRow<Product>('products', {
        ...prod,
        isActive: prod.isActive !== undefined ? prod.isActive : true,
        createdAt: new Date().toISOString()
      } as Omit<Product, 'id'>);
    }
    
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error("Supabase write await error:", err);
      showErrorModal(`?좑툘 ?쒗뭹 移댄깉濡쒓렇 ???以?DB ?숆린???ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n${err.message || err.details || JSON.stringify(err)}`, 'DB ?숆린???ㅻ쪟');
      throw err;
    }
    
    refreshAllData();
    return result;
  };

  // ?뮕 [?좉퇋] ?낃퀬 寃???꾩슂 ??ぉ 諛??먯닔 湲곗? CUD
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
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const deleteInspectionChecklistItem = async (id: string) => {
    db.deleteRow('inspectionChecklistItems', id);
    await db.awaitPendingWrites();
    refreshAllData();
  };

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
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const deleteEquipmentManual = async (id: string) => {
    db.deleteRow('equipmentManuals', id);
    await db.awaitPendingWrites();
    refreshAllData();
  };

  // ?뤇截??꾩궗 ?쒖? ?듭뀡 留덉뒪??CUD
  const saveStandardOption = async (optionData: Omit<StandardOption, 'id' | 'createdAt'> & { id?: string }): Promise<StandardOption> => {
    let result: StandardOption;
    if (optionData.id) {
      result = db.updateRow<StandardOption>('standardOptions', optionData.id, {
        ...optionData,
        updatedAt: new Date().toISOString()
      }) as StandardOption;
    } else {
      const nextId = 'opt_' + Date.now();
      result = db.insertRow<StandardOption>('standardOptions', {
        ...optionData,
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
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const saveAsset = async (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    let result;
    const isNew = !asset.id;
    const existingAsset = asset.id ? db.assets.find(a => a.id === asset.id) : null;

    if (asset.id) {
      result = db.updateRow<Asset>('assets', asset.id, asset as Asset);
    } else {
      result = db.insertRow<Asset>('assets', {
        ...asset,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Omit<Asset, 'id'>);
    }

    if (result) {
      // 1. ?좉퇋 痍⑤뱷(ACQUISITION) ?대젰 ?먮룞 湲곕줉
      if (isNew) {
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: result.id,
          assetNo: result.assetNo,
          modelName: result.modelName,
          type: 'INBOUND', // ACQUISITION ???INBOUND ?ъ슜?섏뿬 ?쒖빟議곌굔 ?고쉶
          eventDate: result.acquisitionDate || new Date().toISOString().split('T')[0],
          memo: `[理쒖큹痍⑤뱷] ?먯궛 理쒖큹 痍⑤뱷 諛?????깅줉 (痍⑤뱷?? ${result.acquisitionDate || '-'} / 痍⑤뱷媛: ${(result.acquisitionPrice || 0).toLocaleString()}??/ ?꾩감/援ъ엯泥? ${result.renter || '-'})`,
          createdAt: new Date().toISOString()
        });
      }

      // 2. ?먯궛 留ㅺ컖(DISPOSAL) ?대젰 ?먮룞 湲곕줉
      if (result.status === 'SOLD' && (!existingAsset || existingAsset.status !== 'SOLD')) {
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: result.id,
          assetNo: result.assetNo,
          modelName: result.modelName,
          type: 'OUTBOUND', // DISPOSAL ???OUTBOUND ?ъ슜?섏뿬 ?쒖빟議곌굔 ?고쉶
          eventDate: result.disposalDate || new Date().toISOString().split('T')[0],
          memo: `[留ㅺ컖泥섎텇] ?먯궛 留ㅺ컖 ?꾨즺 (留ㅺ컖?? ${result.disposalDate || '-'} / 留ㅺ컖媛: ${(result.disposalPrice || 0).toLocaleString()}??/ 留ㅺ컖?몄닔泥? ${result.buyer || '-'})`,
          createdAt: new Date().toISOString()
        });
      }
    }

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('saveAsset Supabase sync error:', err);
      showErrorModal(`?좑툘 ?λ퉬 ?먯궛 ???以?DB ?숆린???ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n${err.message || err.details || JSON.stringify(err)}`, 'DB ?숆린???ㅻ쪟');
      throw err;
    }
    refreshAllData();
    return result;
  };

  // ?뮕 ?먯궛 ?곹깭 SSOT ?먮룞 蹂???ы띁 硫붿냼??
  const changeAssetStatus = async (assetId: string, newStatus: Asset['status'], extraData?: Partial<Asset>) => {
    try {
      const targetAsset = db.assets.find(a => a.id === assetId);
      if (!targetAsset) return;

      const updatedPayload: Partial<Asset> = {
        status: newStatus,
        ...extraData
      };

      db.updateRow<Asset>('assets', assetId, updatedPayload);

      // ?먯궛 ?낆텧怨??곹깭 蹂???대젰(assetInOutLogs) ?먮룞 ??꾨씪??湲곕줉
      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: assetId,
        assetNo: targetAsset.assetNo || '',
        modelName: targetAsset.modelName || '',
        type: (newStatus === 'RENTED' || newStatus === 'ASSIGNED') ? 'OUTBOUND' : 'INBOUND',
        eventDate: new Date().toISOString().split('T')[0],
        memo: `[?먯궛?곹깭 蹂?? ${targetAsset.status || 'AVAILABLE'} ??${newStatus}`,
        createdAt: new Date().toISOString()
      });

      if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
        await db.awaitPendingWrites();
      }
      refreshAllData();
    } catch (err: any) {
      console.error('changeAssetStatus error:', err);
      showErrorModal(`?좑툘 ?먯궛 ?곹깭 蹂??泥섎━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n\n${err?.message || err}`);
      throw err;
    }
  };

  // ?꾩궗 怨꾩빟踰덊샇 ?듭씪 ?앹꽦 ?ы띁 (理쒖큹諛쒖깮??YYMM 湲곗? C{YYMM}-{4?먮━ ?쒖감}: ??'C2608-0001')
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

  const saveSmartDispatch = async (data: SmartDispatchData, autoRegister: boolean, onProgress?: (log: string, percent: number) => void) => {
    const notify = async (msg: string, pct: number, delayMs = 180) => {
      if (onProgress) {
        onProgress(msg, pct);
        await new Promise(r => setTimeout(r, delayMs));
      }
    };

    await notify('?뵇 [1/5] 怨좉컼??紐낆묶 ?뺢퇋??諛?嫄곕옒 ?곹깭 ?뺤씤 以?..', 10);

    // ?쎌묶("?몃낫?좎씠??) ?먮뒗 ?쒓린 ?뺥깭(" (二? ?몃낫?좎씠??") 寃????湲곗〈 ?뺤떇 踰뺤씤紐?"二쇱떇?뚯궗 ?몃낫?좎씠??) ?먮룞 ?먯깋 & 蹂댁젙
    let customer = findCustomerByNormalizedName(db.customers, data.customerName);
    if (customer) {
      // ?쎌묶 ?낅젰???뺤떇 ?깅줉 紐낆묶?쇰줈 ?먮룞 移섑솚/蹂댁젙!
      data.customerName = customer.name;
    }
    if (customer && customer.transactionStatus === 'BLOCKED') {
      return { success: false, errorMessage: '?좑툘 ?대떦 怨좉컼?щ뒗 [嫄곕옒遺덇?] ?곹깭濡??ㅼ젙?섏뼱 ?덉뼱 ?좉퇋 異쒓퀬 諛?怨꾩빟 ?깅줉???먯쿇 李⑤떒?⑸땲??' };
    }
    
    // ?썳截?[1. 諛⑹뼱 媛??- Validation Guard]
    // ?꾩옣 ?곸꽭 二쇱냼? ?꾩옣?대떦???곕씫泥섍? ?낅젰媛믨낵 湲곗〈 DB 紐⑤몢???꾪? ?녿뒗 寃쎌슦 媛뺣젰 諛⑹뼱
    const currentCust = customer;
    const existingSite = currentCust ? db.sites.find(s => s.customerId === currentCust.id && (s.name.replace(/\s/g, '') === data.siteName.replace(/\s/g, '') || s.name.includes(data.siteName) || data.siteName.includes(s.name))) : null;
    const existingContact = currentCust ? db.contacts.find(ct => ct.customerId === currentCust.id && (data.siteContactName ? ct.name.replace(/\s/g, '') === data.siteContactName.replace(/\s/g, '') : true)) : null;

    const effectiveAddress = data.siteAddress?.trim() || (existingSite?.address && existingSite.address !== '誘몄긽' ? existingSite.address : '');
    const effectivePhone = data.siteContactPhone?.trim() || (existingSite?.contact && existingSite.contact !== '誘몄긽' ? existingSite.contact : '') || (existingContact?.contact && existingContact.contact !== '誘몄긽' ? existingContact.contact : '');

    if (!effectiveAddress) {
      return {
        success: false,
        errorMessage: `?좑툘 [?꾩옣 ?곸꽭 二쇱냼 ?꾩닔 ?꾨씫]\n\n怨좉컼??'${data.customerName}' / ?꾩옣 '${data.siteName}'??湲곗〈 DB???깅줉??二쇱냼媛 ?놁쑝硫? ?꾩옱 ?낅젰李쎌뿉??二쇱냼媛 ?앸왂?섏뼱 ?덉뒿?덈떎.\n\n諛곗감 湲곗궗 ?댁넚 諛?怨꾩빟 泥닿껐???꾪빐 ?꾩옣 ?곸꽭 二쇱냼瑜?諛섎뱶???낅젰?댁＜?몄슂.`
      };
    }
    if (!effectivePhone) {
      return {
        success: false,
        errorMessage: `?좑툘 [?꾩옣 ?대떦???곕씫泥??꾩닔 ?꾨씫]\n\n怨좉컼??'${data.customerName}' / ?꾩옣 '${data.siteName}'???꾩옣 ?대떦???곕씫泥섍? 湲곗〈 DB???놁쑝硫??낅젰李쎌뿉???앸왂?섏뿀?듬땲??\n\n?λ퉬 ?섏감 ?멸퀎 諛?湲곗궗 鍮꾩긽 ?곕씫???꾪빐 ?꾩옣 ?대떦???곕씫泥섎? 諛섎뱶???낅젰?댁＜?몄슂.`
      };
    }

    // ??[2. 湲곗〈 ?뺣낫 ?곸냽] ?꾨씫 ?꾨뱶 ?먮룞 ?밴퀎
    data.siteAddress = effectiveAddress;
    if (!data.siteContactPhone?.trim()) data.siteContactPhone = effectivePhone;
    if (!data.siteContactName?.trim() && existingSite?.contactName && existingSite.contactName !== '誘몄긽') {
      data.siteContactName = existingSite.contactName;
    }
    if (!data.taxBillEmail?.trim() && customer?.repEmail && customer.repEmail !== '誘몄긽') {
      data.taxBillEmail = customer.repEmail;
    }

    // ?썳截?[?λ퉬 ?섎웾 寃利?媛??
    if (!data.equipments || data.equipments.length === 0) {
      return { success: false, errorMessage: '?좑툘 異쒓퀬 ????λ퉬 洹쒓꺽 諛??섎웾???꾨씫?섏뿀?듬땲??' };
    }
    const sanitizedEquipments = data.equipments.map(eq => ({
      ...eq,
      qty: Math.max(1, Math.floor(Number(eq.qty) || 1))
    }));
    const totalEqQty = sanitizedEquipments.reduce((sum, e) => sum + e.qty, 0);
    if (totalEqQty <= 0) {
      return { success: false, errorMessage: '?좑툘 異쒓퀬 ?섎웾? 理쒖냼 1? ?댁긽?댁뼱???⑸땲??' };
    }
    data.equipments = sanitizedEquipments;

    const missingFields = [];
    if (!customer) missingFields.push(`怨좉컼?? ${data.customerName}`);
    if (!existingSite) missingFields.push(`?꾩옣: ${data.siteName}`);

    if (missingFields.length > 0 && !autoRegister) {
      return { success: false, requiresConfirm: true, missingFields };
    }

    const rawData = data as any;
    const parseDayNumber = (val: any, fallback: number): number => {
      if (val === undefined || val === null || val === '') return fallback;
      const str = String(val).trim();
      if (str.includes('留먯씪') || str.includes('?붾쭚')) return 31;
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
      await notify(`?룫 [?좉퇋 怨좉컼] DB???녿뒗 怨좉컼??'${data.customerName}' ?먮룞 ?좉퇋 ?앹꽦 以?..`, 20);
      customer = db.insertRow<Customer>('customers', {
        name: data.customerName,
        bizRegNo: '誘몄긽',
        isClosed: false,
        address: data.siteAddress || '誘몄긽',
        representative: '誘몄긽',
        repContact: data.siteContactPhone || '誘몄긽',
        repEmail: data.taxBillEmail || data.statementEmail || '誘몄긽',
        defaultBillingDay: contractBillingDay,
        defaultStatementClosingDay: contractStatementClosingDay,
        paymentDueDay: contractPaymentDueDay,
        createdAt: new Date().toISOString()
      });

      // ?좑툘 FK ?쒖빟 諛⑹?: ?좉퇋 怨좉컼??Supabase???꾩쟾????λ맂 ?꾩뿉留?contacts/sites ?앹꽦 媛??
      try {
        await db.awaitPendingWrites();
      } catch (err: any) {
        console.error('Supabase new customer sync error:', err);
        showErrorModal(`?좑툘 ?좉퇋 怨좉컼 DB ???以??ㅻ쪟:\n${err.message || JSON.stringify(err)}`, '異쒓퀬 ?ㅻ쪟');
        return { success: false, errorMessage: err.message };
      }

      if (data.siteContactName) {
        db.insertRow<CustomerContact>('contacts', {
          customerId: customer.id,
          name: data.siteContactName,
          position: '?꾩옣?대떦??,
          contact: data.siteContactPhone || '誘몄긽',
          email: data.siteContactEmail || '誘몄긽',
          createdAt: new Date().toISOString()
        });
      }
    } else {
      await notify(`??[怨좉컼 ?뺤씤] 湲곗〈 ?깅줉 怨좉컼??'${customer.name}' 留ㅽ븨 ?꾨즺`, 25);
      
      // ?봽 [3. 理쒖떊 ?뺣낫 ?낅뜲?댄듃] 怨좉컼 留덉뒪???뺣낫 ?숆린??
      const custUpdates: Partial<Customer> = {};
      if (data.taxBillEmail && data.taxBillEmail !== '誘몄긽' && data.taxBillEmail !== customer.repEmail) {
        custUpdates.repEmail = data.taxBillEmail;
      }
      if (Object.keys(custUpdates).length > 0) {
        customer = db.updateRow<Customer>('customers', customer.id, { ...custUpdates, updatedAt: new Date().toISOString() }) as Customer;
        await notify(`?룫 [怨좉컼 ?뺣낫 媛깆떊] 怨꾩궛???섏떊泥?'${data.taxBillEmail}')媛 怨좉컼 留덉뒪?곗뿉 ?낅뜲?댄듃?섏뿀?듬땲??`, 28);
      }

      // ?대떦???뺣낫 ?낅뜲?댄듃 諛??좉퇋 異붽?
      if (data.siteContactName) {
        const targetCustomerId = customer.id;
        const matchedContact = db.contacts.find(ct => ct.customerId === targetCustomerId && ct.name.replace(/\s/g, '') === data.siteContactName.replace(/\s/g, ''));
        if (matchedContact) {
          if ((data.siteContactPhone && data.siteContactPhone !== '誘몄긽' && data.siteContactPhone !== matchedContact.contact) || (data.siteContactEmail && data.siteContactEmail !== '誘몄긽' && data.siteContactEmail !== matchedContact.email)) {
            db.updateRow<CustomerContact>('contacts', matchedContact.id, {
              contact: data.siteContactPhone || matchedContact.contact,
              email: data.siteContactEmail || matchedContact.email,
              updatedAt: new Date().toISOString()
            });
            await notify(`?뫀 [?대떦??理쒖떊?? ?대떦??'${data.siteContactName}' ?곕씫泥섍? 理쒖떊媛믪쑝濡??낅뜲?댄듃?섏뿀?듬땲??`, 30);
          }
        } else {
          await notify(`?뫀 [?좉퇋 ?대떦?? ?꾩옣 ?대떦??'${data.siteContactName}' ?깅줉 以?..`, 30);
          db.insertRow<CustomerContact>('contacts', {
            customerId: targetCustomerId,
            name: data.siteContactName,
            position: '?꾩옣?대떦??,
            contact: data.siteContactPhone || '誘몄긽',
            email: data.siteContactEmail || '誘몄긽',
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
            position: '泥?뎄?대떦??,
            contact: data.billingContactPhone || '誘몄긽',
            email: data.taxBillEmail || data.statementEmail || '誘몄긽',
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    const finalCustomer = customer;

    // ?꾩옣(Site) 泥섎━: 湲곗〈 ?꾩옣 ?낅뜲?댄듃 ?먮뒗 ?좉퇋 ?꾩옣 ?깅줉
    let site = db.sites.find(s => s.customerId === finalCustomer.id && (s.name.replace(/\s/g, '') === data.siteName.replace(/\s/g, '') || s.name.includes(data.siteName) || data.siteName.includes(s.name)));
    if (!site) {
      await notify(`?뱧 [2/5 ?좉퇋 ?꾩옣] ?좉퇋 ?꾩옣 '${data.siteName}' ?먮룞 ?깅줉 以?..`, 40);
      site = db.insertRow<CustomerSite>('sites', {
        customerId: finalCustomer.id,
        name: data.siteName,
        address: data.siteAddress || '誘몄긽',
        contactName: data.siteContactName || '誘몄긽',
        contact: data.siteContactPhone || '誘몄긽',
        email: data.siteContactEmail || '誘몄긽',
        paidOptions: data.paidOptions || undefined,
        protection: data.protection || undefined,
        checkedSpecs: data.checkedSpecs || undefined,
        billingDay: contractBillingDay,
        statementClosingDay: contractStatementClosingDay,
        paymentDueDay: contractPaymentDueDay,
        createdAt: new Date().toISOString()
      });
    } else {
      // 湲곗〈 ?꾩옣 ?뺣낫媛 '誘몄긽'?닿굅??蹂寃쎈맂 寃쎌슦 理쒖떊媛믪쑝濡??낅뜲?댄듃!
      const siteUpdates: Partial<CustomerSite> = {};
      if (data.siteAddress && data.siteAddress !== '誘몄긽' && data.siteAddress !== site.address) {
        siteUpdates.address = data.siteAddress;
      }
      if (data.siteContactName && data.siteContactName !== '誘몄긽' && data.siteContactName !== site.contactName) {
        siteUpdates.contactName = data.siteContactName;
      }
      if (data.siteContactPhone && data.siteContactPhone !== '誘몄긽' && data.siteContactPhone !== site.contact) {
        siteUpdates.contact = data.siteContactPhone;
      }
      if (data.siteContactEmail && data.siteContactEmail !== '誘몄긽' && data.siteContactEmail !== site.email) {
        siteUpdates.email = data.siteContactEmail;
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
      // ?뙚 ?듭뀡 蹂寃????꾩옣 留덉뒪??????щ? ?뺤씤 (false??寃쎌슦 ?대쾲 異쒓퀬留?1?뚯꽦 ?곸슜?섍퀬 ?꾩옣 留덉뒪?곕뒗 湲곗〈 ?듭뀡 ?먰삎 蹂댁〈)
      if (data.saveOptionsToSite !== false) {
        if (data.paidOptions !== undefined && data.paidOptions !== site.paidOptions) {
          siteUpdates.paidOptions = data.paidOptions;
        }
        if (data.protection !== undefined && data.protection !== site.protection) {
          siteUpdates.protection = data.protection;
        }
        if (data.checkedSpecs && Object.keys(data.checkedSpecs).length > 0) {
          siteUpdates.checkedSpecs = data.checkedSpecs;
        }
      }
      if (Object.keys(siteUpdates).length > 0) {
        site = db.updateRow<CustomerSite>('sites', site.id, { ...siteUpdates, updatedAt: new Date().toISOString() }) as CustomerSite;
        await notify(`?뱧 [?꾩옣 ?뺣낫 理쒖떊?? ?꾩옣 '${site.name}'???뺣낫(二쇱냼/?듭뀡/蹂댁뼇)媛 怨좉컼 留덉뒪?곗뿉 ?낅뜲?댄듃?섏뿀?듬땲??`, 45);
      } else {
        await notify(`?뱧 [2/5 ?꾩옣 留ㅽ븨] 湲곗〈 ?꾩옣 '${site.name}' 留ㅽ븨 ?꾨즺`, 45);
      }
    }

    // ?뙚 怨좉컼??湲곕낯 ?듭뀡/蹂댁뼇 ?깅줉 諛??꾩껜 ?꾩옣 ?쇨큵 ?꾪뙆 泥섎━
    const custOptionUpdates: Partial<Customer> = {};
    if (data.isSetAsCustomerDefault || (!finalCustomer.defaultPaidOptions && data.paidOptions)) {
      if (data.paidOptions) custOptionUpdates.defaultPaidOptions = data.paidOptions;
    }
    if (data.isSetAsCustomerDefault || (!finalCustomer.defaultProtection && data.protection)) {
      if (data.protection) custOptionUpdates.defaultProtection = data.protection;
    }
    if (data.isSetAsCustomerDefault || (!finalCustomer.defaultCheckedSpecs && data.checkedSpecs && Object.keys(data.checkedSpecs).length > 0)) {
      if (data.checkedSpecs) custOptionUpdates.defaultCheckedSpecs = data.checkedSpecs;
    }
    if (Object.keys(custOptionUpdates).length > 0) {
      db.updateRow<Customer>('customers', finalCustomer.id, { ...custOptionUpdates, updatedAt: new Date().toISOString() });
      await notify(`?룫 [怨좉컼??湲곕낯?ㅼ젙 ?숆린?? 怨좉컼??'${finalCustomer.name}') 湲곕낯 ?듭뀡/蹂댁뼇 留덉뒪?곌? ?깅줉?섏뿀?듬땲??`, 48);
    }

    if (data.applyToAllSites) {
      const allSites = db.sites.filter(s => s.customerId === finalCustomer.id);
      for (const s of allSites) {
        db.updateRow<CustomerSite>('sites', s.id, {
          paidOptions: data.paidOptions || s.paidOptions,
          protection: data.protection || s.protection,
          checkedSpecs: data.checkedSpecs || s.checkedSpecs,
          updatedAt: new Date().toISOString()
        });
      }
      await notify(`?뙋 [?꾩껜 ?꾩옣 ?꾪뙆] '${finalCustomer.name}' ?고븯 ${allSites.length}媛?紐⑤뱺 ?꾩옣???듭뀡/蹂댁뼇???쇨큵 ?곸슜?섏뿀?듬땲??`, 50);
    }

    if (autoRegister && currentUser) {
      db.insertRow<Todo>('todos', {
        userId: currentUser.id,
        type: 'MISSING_INFO',
        title: `?좉퇋 怨좉컼/?꾩옣 ?뺣낫 蹂댁셿 (${data.customerName})`,
        content: `異쒓퀬 ?붿껌 ???ъ뾽?먮벑濡앸쾲????誘몄긽?쇰줈 泥섎━???꾩닔 ??ぉ??梨꾩썙二쇱꽭??`,
        isCompleted: false,
        relatedEntityId: finalCustomer.id,
        createdAt: new Date().toISOString()
      });
    }

    const finalSite = site!;

    const existingUsers = db.users;
    const isSalespersonValid = currentUser?.id && existingUsers.some(u => u.id === currentUser.id);
    const validSalespersonId = isSalespersonValid ? currentUser.id : (existingUsers.find(u => u.id === 'u-1')?.id || existingUsers[0]?.id || undefined);

    const extractDate = (dateTimeStr?: string): string => {
      if (!dateTimeStr) return '';
      const match = dateTimeStr.match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    };
    const targetStartDate = extractDate(data.loadingTime) || extractDate(data.unloadingTime) || new Date().toISOString().split('T')[0];

    // ?? 怨꾩빟 ?⑥씪???먯튃: ?숈씪 (怨좉컼??+ ?꾩옣) ?쒖꽦 怨꾩빟 ?먯깋 ??
    const existingActiveContract = db.contracts.find(c => 
      c.customerId === finalCustomer.id && 
      c.siteId === finalSite.id && 
      (c.status === 'ACTIVE' || c.status === 'EXTENDED')
    );

    let contract: Contract;

    if (existingActiveContract) {
      // 1) 湲곗〈 ?쒖꽦 怨꾩빟??議댁옱??寃쎌슦: ?좉퇋 怨꾩빟???뚰렪?뷀븯???앹꽦?섏? ?딄퀬 湲곗〈 怨꾩빟???λ퉬 ?몄엯!
      contract = existingActiveContract;
      await notify(`?뱞 [3/5 湲곗〈 怨꾩빟 ?몄엯] 湲곗〈 怨꾩빟(${contract.contractNo})???좉퇋 ?λ퉬 ?몄엯 以?..`, 55);

      // ?뱶 [?뚯옣 1.2] 諛쒖깮 ?ш굔 臾대늻??DB ??? 湲곗〈 怨꾩빟???λ퉬 異붽? ?몄엯 ?대젰 ?깅줉
      db.insertRow<ContractHistory>({
        contractId: contract.id,
        changeType: 'ADD_ASSET',
        changeDate: targetStartDate,
        newEndDate: contract.endDate || '',
        description: `[異쒓퀬] 湲곗〈 怨꾩빟(${contract.contractNo})??異붽? ?λ퉬 ?ъ엯 (${data.equipments.map(e => `${e.modelName} ${e.qty}?`).join(', ')})`,
        createdAt: new Date().toISOString()
      });
    } else {
      // 2) 湲곗〈 怨꾩빟???놁쓣 寃쎌슦: 理쒖큹 諛쒖깮??YYMM) 湲곗? 梨꾨쾲?섏뿬 ?좉퇋 怨꾩빟 ?앹꽦
      const nextContractNo = generateNextContractNo(targetStartDate);

      await notify(`?뱞 [3/5 怨꾩빟 ?앹꽦] ?꾨?李?怨꾩빟???묒꽦 以?(${nextContractNo})...`, 55);

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
        lateInterestRate: contractLateInterestRate,
        paymentDueDay: contractPaymentDueDay,
        salespersonId: validSalespersonId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // ?좑툘 ?몃옒??Foreign Key) ?쒖빟議곌굔 ?꾨컲 諛⑹?: 遺紐?contract ?덉퐫?쒓? Supabase ?먭꺽 DB??癒쇱? 100% ?앹꽦?섎룄濡?1李??숆린 ?湲?
      try {
        await db.awaitPendingWrites();
      } catch (err: any) {
        console.error('Supabase contract insert sync error:', err);
        showErrorModal(`?좑툘 異쒓퀬 怨꾩빟 ?앹꽦 以?DB ?숆린???ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n${err.message || err.details || JSON.stringify(err)}`, '異쒓퀬 DB ?숆린???ㅻ쪟');
        return { success: false, errorMessage: err.message || err.details };
      }

      // ?뱶 [?뚯옣 1.2] 諛쒖깮 ?ш굔 臾대늻??DB ??? 異쒓퀬 ?좉퇋 怨꾩빟 泥닿껐 ?대젰 ?깅줉
      db.insertRow<ContractHistory>({
        contractId: contract.id,
        changeType: 'REGISTER',
        changeDate: contract.startDate,
        newEndDate: '',
        description: `[異쒓퀬] ?좉퇋 ?꾨?李?怨꾩빟 泥닿껐 (${finalCustomer.name} / ${finalSite.name} - ${data.equipments.map(e => `${e.modelName} ${e.qty}?`).join(', ')})`,
        createdAt: new Date().toISOString()
      });
    }

    await notify('?룛截?[4/5 ?λ퉬 留ㅽ븨] 怨꾩빟 ?ъ엯 ?λ퉬 紐⑤뜽 諛??④? ?먮룞 ?곸냽 以?..', 80);

    const custContractIds = db.contracts.filter(c => c.customerId === finalCustomer.id).map(c => c.id);

    data.equipments.forEach((eq) => {
      const eqData = eq as any;
      const count = Math.max(1, Math.floor(Number(eq.qty) || 1));

      // 1. 紐낆떆???④? ?뺤씤 (紐⑤컮??諛쒖＜ ??
      let determinedMonthly = Number(eqData.monthlyRent || eqData.monthlyRentalFee) || 0;
      let determinedDaily = Number(eqData.dailyRent || eqData.dailyRentalFee) || 0;

      // 2. 誘몄엯????怨좉컼?ъ쓽 ?숈씪 紐⑤뜽 理쒓렐 怨꾩빟 ?④? ?먮룞 ?곸냽 (?뚯옣 2.2)
      if (!determinedMonthly && finalCustomer?.id) {
        const recentCustCA = db.contractAssets
          .filter(ca => custContractIds.includes(ca.contractId) && ca.expectedModel === eq.modelName && ca.monthlyRentalFee > 0)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
        if (recentCustCA) {
          determinedMonthly = recentCustCA.monthlyRentalFee;
          determinedDaily = recentCustCA.dailyRentalFee || Math.round(determinedMonthly / 30);
        }
      }

      // 3. 誘몄엯?????먯궛 留덉뒪???숈씪 紐⑤뜽???쒖? ???뚰깉猷??곸냽
      if (!determinedMonthly) {
        const peerAsset = db.assets.find(a => a.modelName === eq.modelName && (a.monthlyRentalFee || a.dailyRentalFee));
        if (peerAsset) {
          determinedMonthly = peerAsset.monthlyRentalFee || 0;
          determinedDaily = peerAsset.dailyRentalFee || (determinedMonthly ? Math.round(determinedMonthly / 30) : 0);
        }
      }

      // 4. 紐⑤뜽紐?洹쒓꺽 湲곕컲 ?쒖? ?④? 異붿젙
      if (!determinedMonthly) {
        const m = (eq.modelName || '').toUpperCase();
        if (m.includes('53') || m.includes('1614')) determinedMonthly = 1500000;
        else if (m.includes('46') || m.includes('1412')) determinedMonthly = 1200000;
        else if (m.includes('40') || m.includes('1212')) determinedMonthly = 900000;
        else if (m.includes('32') || m.includes('1012')) determinedMonthly = 600000;
        else if (m.includes('26') || m.includes('0812')) determinedMonthly = 500000;
        else determinedMonthly = 400000;
        determinedDaily = Math.round(determinedMonthly / 30);
      }

      for(let i=0; i<count; i++) {
        db.insertRow<ContractAsset>('contractAssets', {
          contractId: contract.id,
          assetId: '',
          expectedModel: eq.modelName,
          monthlyRentalFee: determinedMonthly,
          dailyRentalFee: determinedDaily,
          startDate: targetStartDate || contract.startDate,
          endDate: '',
          createdAt: new Date().toISOString()
        });
      }
    });

    await notify('?슊 [5/5 諛곗감 ?앹꽦] 諛곗감/?댁넚 愿由?異쒓퀬?湲?吏?쒓굔 ?앹꽦 以?..', 90);

    // ?좉퇋 諛곗감(Delivery) - 異쒓퀬 ?湲?嫄??먮룞 ?앹꽦
    const cargoItems = JSON.stringify(data.equipments.map(e => ({ modelName: e.modelName, count: Number(e.qty) || 1 })));
    const dData = data as any;
    const loadingDateStr = extractDate(data.loadingTime) || contract.startDate;
    const getTimeSlot = (tStr: string | undefined) => {
      if (!tStr) return '?ㅼ쟾';
      if (tStr.includes('ASAP')) return 'ASAP';
      if (tStr.includes('?ㅼ쟾')) return '?ㅼ쟾';
      if (tStr.includes('?ㅽ썑')) return '?ㅽ썑';
      const m = tStr.match(/\d{1,2}:\d{2}/);
      return m ? m[0] : (tStr.includes(' ') ? tStr.split(' ')[1] : '?ㅼ쟾');
    };
    const loadingTimeSlotStr = getTimeSlot(data.loadingTime);
    const unloadingDateStr = extractDate(data.unloadingTime) || contract.startDate;
    const unloadingTimeSlotStr = getTimeSlot(data.unloadingTime);

    const isExchangeDelivery = dData.type === 'EXCHANGE' || dData.context?.includes('EXCHANGE') || dData.rawText?.includes('援먰솚');
    const isCustomerPaid = dData.paidBy === 'CUSTOMER' || !!dData.billableToCustomer;

    const retrievalMemo = dData.retrievalAssetIds && dData.retrievalAssetIds.length > 0
      ? ` | [?李⑦쉶?섎??? ?먯궛 #${dData.retrievalAssetIds.join(', #')}`
      : '';
    const paidByMemo = dData.paidBy
      ? ` | [?댁넚鍮꾨??? ${dData.paidBy === 'CUSTOMER' ? '怨좉컼泥?뎄' : dData.paidBy === 'OURS' ? '?뱀궗遺?? : '?몃룄吏??}`
      : '';

    const defaultYard = currentTenant?.yards?.find((y: any) => y.isDefault) || currentTenant?.yards?.[0];
    const defaultYardAddress = defaultYard?.address || currentTenant?.mainYardAddress || currentTenant?.businessAddress || '?뱀궗 蹂닿???;

    const createdDelivery = db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
      type: isExchangeDelivery ? 'EXCHANGE' : 'OUTBOUND',
      dispatchCategory: isExchangeDelivery ? '援먰솚' : '異쒓퀬',
      status: 'REQUESTED',
      requestDate: contract.startDate,
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
      rawText: (data as any).prompt || (data as any).rawText || data.note || '',
      memo: `[異쒓퀬] ?꾩옣?대떦: ${data.siteContactName || '-'} (${data.siteContactPhone || '-'}) | ?곸감: ${data.loadingTime || '-'} / ?섏감: ${data.unloadingTime || '-'}${retrievalMemo}${paidByMemo} | 泥?뎄?대떦: ${data.billingContactName || '-'} (${data.billingContactPhone || '-'}) | 怨꾩궛?? ${data.taxBillEmail || '-'} | ?뱀씠?ы빆: ${data.note || '?놁쓬'}`,
      closingMemo: `[留덇컧議곌굔] 留덇컧?? ${dData.closingDay || '-'} / 寃곗젣?? ${dData.paymentDay || '-'} | ?좎긽?듭뀡: ${dData.paidOptions || '?놁쓬'} | 蹂댁뼇: ${dData.protection || '?놁쓬'}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await notify('?뙋 Supabase ?먭꺽 DB 理쒖쥌 2李??숆린???꾨즺 以?..', 96);

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('Supabase sync error during saveSmartDispatch:', err);
      
      // ?뮙 DB ????ㅽ뙣 ???앹꽦?섏뿀???꾩떆 怨꾩빟/諛곗감/?щ’/?대젰 ?덉퐫??濡ㅻ갚 ??젣!
      if (contract?.id) {
        db.deleteRow('contracts', contract.id);
      await db.awaitPendingWrites();
        const addedCAssets = db.contractAssets.filter(ca => ca.contractId === contract.id);
        addedCAssets.forEach(ca => db.deleteRow('contractAssets', ca.id));
        const addedDeliveries = db.deliveries.filter(d => d.contractId === contract.id);
        addedDeliveries.forEach(d => db.deleteRow('deliveries', d.id));
        const addedHistories = db.contractHistory.filter(h => h.contractId === contract.id);
        addedHistories.forEach(h => db.deleteRow(h.id));
        // ??怨좎븘 ?덉퐫??諛⑹?: 濡ㅻ갚 ???앹꽦??outboundInspections???④퍡 ??젣
        const addedInspections = db.outboundInspections.filter(i => i.contractId === contract.id);
        addedInspections.forEach(i => db.deleteRow('outboundInspections', i.id));
      }
      refreshAllData();

      const errorMsg = `?좑툘 Supabase ?곗씠?곕쿋?댁뒪 ?숆린??以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n\n??[?덈궡]: ????ㅽ뙣濡??명빐 ?앹꽦 ?쒕룄?덈뜕 ?곗씠?곌? ?덉쟾?섍쾶 ?먮룞 濡ㅻ갚 ?먮났?섏뿀?듬땲??\n\n${err.message || err.details || JSON.stringify(err)}`;
      showErrorModal(errorMsg, '異쒓퀬 DB ?숆린???ㅻ쪟 (?먮룞 ?먮났 ?꾨즺)');
      return { 
        success: false, 
        errorMessage: errorMsg
      };
    }

    await notify('?럦 [?꾨즺] 異쒓퀬?섎ː ?앹꽦???깃났?곸쑝濡??꾨즺?섏??듬땲??', 100, 300);

    refreshAllData();

    // ?? [?⑥씪 ?낅Т ?멸퀎 ?뚯씠?꾨씪?? 諛곗감???臾쇰━ ToDo ?곸옱 + 釉뚮줈?쒖틦?ㅽ듃
    const totalEqCount = (data.equipments || []).reduce((acc: number, eq: any) => acc + (Number(eq.qty) || 1), 0);
    await issueHandoverTask({
      category: 'DISPATCH_REQUEST',
      title: `[異쒓퀬 諛곗감 ?섎ː] ${data.customerName || '怨좉컼??} (${totalEqCount}?)`,
      content: `${data.customerName || '怨좉컼??} (${data.siteName || '?꾩옣'}) ${totalEqCount}? 異쒓퀬 諛곗감 ?붿껌 (?곸감: ${data.loadingTime || '誘몄젙'}, ?섏감: ${data.unloadingTime || '誘몄젙'})`,
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

  const saveSmartReturn = async (data: SmartReturnData) => {
    try {
      if (data.contractId) {
        const contract = db.contracts.find(c => c.id === data.contractId);
        if (!contract) return { success: false, errorMessage: '怨꾩빟 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.' };

        // ?덈줈??怨좉컼?대떦??泥섏쓬 ?깆옣?섎뒗 ?щ엺)?쇰㈃ ?먮룞 ?깅줉!
        if (data.contactName) {
          const existingContact = db.contacts.find(ct => ct.customerId === contract.customerId && ct.name.replace(/\s/g, '') === data.contactName!.replace(/\s/g, ''));
          if (!existingContact) {
            db.insertRow<CustomerContact>('contacts', {
              customerId: contract.customerId,
              name: data.contactName,
              position: '?대떦??,
              contact: data.contactPhone || '誘몄긽',
              email: '誘몄긽',
              createdAt: new Date().toISOString()
            });
          }
        }

        // ?뮕 ?뚯옣 1.2 & 1.3 以??
        // ?뚯닔 諛곗감 ?섎ː ?④퀎?먯꽌???꾩옣 ?λ퉬???ㅼ젣 媛???곹깭瑜?議곌린 醫낅즺?섍굅??RENTED_RETURNED濡?諛붽씀吏 ?딆쓬.
        // ?먯궛 ?곹깭???ㅼ젣 ?댁넚 諛??낃퀬 寃?섍? ?꾨즺?섎뒗 ?쒖젏???꾪솚??
        // ?ㅻ쭔 ?섎ː ?대젰 愿由щ? ?꾪빐 contractHistory???뚯닔 ?섎ː ?묒닔 ?대젰留?湲곕줉.
        db.insertRow<ContractHistory>({
          contractId: data.contractId,
          changeType: 'SHORTEN',
          changeDate: new Date().toISOString().split('T')[0],
          prevEndDate: contract.endDate,
          newEndDate: data.returnDate,
          description: `?뚯닔 ?섎ː ?묒닔 (?뚯닔 ??? ${data.assetIds.length}?, ?щ쭩?? ${data.returnDate})`,
          createdAt: new Date().toISOString()
        });

        const contactInfoMemo = data.contactName || data.contactPhone
          ? `[怨좉컼?대떦?? ${data.contactName || '-'} (${data.contactPhone || '-'})] `
          : '';
        const cust = db.customers.find(c => c.id === contract.customerId);
        const site = db.sites.find(s => s.id === contract.siteId);
        const returnAssets = db.assets.filter(a => data.assetIds.includes(a.id));
        const modelCountsMap: Record<string, number> = {};
        returnAssets.forEach(a => {
          modelCountsMap[a.modelName] = (modelCountsMap[a.modelName] || 0) + 1;
        });
        const cargoItems = JSON.stringify(Object.entries(modelCountsMap).map(([modelName, count]) => ({ modelName, count })));

        const createdReturnDelivery = db.insertRow<Delivery>('deliveries', {
          contractId: data.contractId,
          assetIds: data.assetIds.join(','),
          type: 'INBOUND',
          dispatchCategory: '?낃퀬',
          status: 'REQUESTED',
          requestDate: data.returnDate,
          loadingDate: data.returnDate,
          loadingTimeSlot: data.loadingTime || '?ㅼ쟾',
          scheduledDate: data.returnDate,
          unloadingDate: data.returnDate,
          unloadingTimeSlot: data.loadingTime || '?ㅼ쟾',
          originAddress: `${cust?.name || '怨좉컼??} (${site?.name || '?꾩옣'})`,
          destinationAddress: '?뱀궗 蹂닿???,
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
          memo: `${contactInfoMemo}${data.note || ''}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // ?? [?⑥씪 ?낅Т ?멸퀎 ?뚯씠?꾨씪?? 諛곗감????뚯닔 諛곗감 ToDo ?곸옱
        const retCount = data.assetIds?.length || 1;
        await issueHandoverTask({
          category: 'DISPATCH_REQUEST',
          title: `[?뚯닔 諛곗감 ?섎ː] ${cust?.name || '怨좉컼??} (${retCount}?)`,
          content: `${cust?.name || '怨좉컼??} (${site?.name || '?꾩옣'}) ${retCount}? ?뚯닔 諛곗감 ?붿껌 (?붿껌?? ${data.returnDate})`,
          targetDept: 'DISPATCH',
          priority: 'HIGH',
          actionUrl: '/admin/dispatch',
          entityType: 'DELIVERY',
          entityId: createdReturnDelivery.id,
          senderId: currentUser?.id,
          senderName: currentUser?.name
        });
      } else {
        // Case 4: ?몄＜?뺣퉬 ?뚯닔
        const createdRepairReturnDelivery = db.insertRow<Delivery>('deliveries', {
          assetIds: data.assetIds.join(','),
          type: 'INBOUND',
          dispatchCategory: '?낃퀬',
          status: 'REQUESTED',
          requestDate: data.returnDate,
          loadingDate: data.returnDate,
          loadingTimeSlot: data.loadingTime || '?ㅼ쟾',
          scheduledDate: data.returnDate,
          unloadingDate: data.returnDate,
          unloadingTimeSlot: data.loadingTime || '?ㅼ쟾',
          originAddress: '?몄＜?뺣퉬?낆껜',
          destinationAddress: '?뱀궗 蹂닿???,
          transportCompany: '',
          vehicleType: '',
          vehicleNo: '',
          driverName: '',
          driverContact: '',
          deliveryCost: 0,
          isCostSettled: false,
          memo: `[?몄＜?뺣퉬?뚯닔] ?뺣퉬嫄? ${data.repairId || '-'} / ?몄＜?낆껜: ${data.vendorId || '-'} | ${data.note || ''}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await issueHandoverTask({
          category: 'DISPATCH_REQUEST',
          title: `[?몄＜?뺣퉬 ?뚯닔 諛곗감] ?λ퉬 ${data.assetIds.length}?`,
          content: `?몄＜?뺣퉬?낆껜 ?뚯닔 諛곗감 ?붿껌 (?뺣퉬嫄? ${data.repairId || '-'}, ?몄＜: ${data.vendorId || '-'})`,
          targetDept: 'DISPATCH',
          priority: 'NORMAL',
          actionUrl: '/admin/dispatch',
          entityType: 'DELIVERY',
          entityId: createdRepairReturnDelivery.id,
          senderId: currentUser?.id,
          senderName: currentUser?.name
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();

      return { success: true };
    } catch (err: any) {
      console.error('saveSmartReturn error:', err);
      showErrorModal(`?뚯닔 ?섎ː ????ㅽ뙣:\n${err?.message || err}`);
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
    const isAuthorized = userRole === 'ADMIN' || userRole === 'EXECUTIVE' || userRole === 'MANAGER' || userDept.includes('寃쎌쁺') || userDept.includes('???);
    if (!isAuthorized) {
      throw new Error('寃쎌쁺吏??낅Т吏??諛쒗뻾 沅뚰븳???놁뒿?덈떎. (愿由ъ옄/寃쎌쁺吏??꾩슜)');
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
      senderName: currentUser?.name || '寃쎌쁺吏?
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

    await db.awaitPendingWrites();
    refreshAllData();
  };

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

    await db.awaitPendingWrites();
    refreshAllData();
  };

  // ?뮕 留ㅼ엯泥?嫄곕옒??諛?嫄곕옒媛쒖떆???먮룞 ?몃━嫄?媛깆떊 ?ы띁
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
      manufactureYear: assetData.manufactureYear || '',
      ownerType: 'OWNED',
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

    // ?뚯옣 1.2 ?ш굔 湲곕줉 臾대늻??DB ??? 痍⑤뱷 ?대깽??媛먯궗 濡쒓렇
    db.insertRow<AssetInOutLog>('assetInOutLogs', {
      assetId: newAsset.id,
      assetNo: newAsset.assetNo,
      modelName: newAsset.modelName,
      type: 'ACQUISITION',
      eventDate: newAsset.acquisitionDate || new Date().toISOString().split('T')[0],
      memo: `?좉퇋 ?뱀궗?먯궛 痍⑤뱷 ?깅줉 (痍⑤뱷媛: ${(price || 0).toLocaleString()}??/ 怨듦툒泥? ${newAsset.supplier || '-'})`,
      createdAt: new Date().toISOString()
    });

    // ?뮕 留ㅼ엯泥??꾩쟻嫄곕옒??諛?嫄곕옒媛쒖떆???먮룞 ?몃━嫄?媛깆떊
    triggerVendorPurchaseMetric(newAsset.vendorId || newAsset.supplier || '', price, newAsset.acquisitionDate);

    await db.awaitPendingWrites(); // ?뮕 ?뚯옣 5.2 ?숆린 ?곌린 ?湲?
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
        manufactureYear: assetData.manufactureYear || '',
        ownerType: 'OWNED',
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
        memo: `?좉퇋 ?뱀궗?먯궛 痍⑤뱷 ?깅줉 [?쇨큵] (痍⑤뱷媛: ${(price || 0).toLocaleString()}??/ 怨듦툒泥? ${newAsset.supplier || '-'})`,
        createdAt: new Date().toISOString()
      });

      // ?뮕 留ㅼ엯泥??꾩쟻嫄곕옒??諛?嫄곕옒媛쒖떆???먮룞 ?몃━嫄?媛깆떊
      triggerVendorPurchaseMetric(newAsset.vendorId || newAsset.supplier || '', price, newAsset.acquisitionDate);

      createdList.push(newAsset);
    }
    await db.awaitPendingWrites(); // ?뮕 ?뚯옣 5.2 ?숆린 ?곌린 ?湲?
    refreshAllData();
    return createdList;
  };

  // ?먯궛 留ㅺ컖 怨꾩빟踰덊샇 ?꾩슜 梨꾨쾲湲?(SALE-YYYYMMDD-NNN)
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

  // ?뮕 ?먯궛 留ㅺ컖 怨꾩빟 泥닿껐 & 泥?뎄??諛쒗뻾 & ?대찓??諛쒖넚 5?④퀎 ?쇱뒪???꾧껐 ?뚯씠?꾨씪??
  const executeAssetSale = async (payload: AssetSalePayload): Promise<{ success: boolean; contractId: string; billingId: string; contractNo: string }> => {
    try {
      if (!payload.items || payload.items.length === 0) {
        throw new Error('留ㅺ컖 ????먯궛??1? ?댁긽 ?좏깮?섏뼱???⑸땲??');
      }
      if (!payload.disposalDate) {
        throw new Error('留ㅺ컖 ?쇱옄媛 吏?뺣릺吏 ?딆븯?듬땲??');
      }

      // 1. 留ㅼ닔泥?怨좉컼???뺤씤 ?먮뒗 ?좉퇋 ?깅줉
      let customer: Customer | undefined;
      if (payload.customerId) {
        customer = db.customers.find(c => c.id === payload.customerId);
      }
      if (!customer && payload.buyerName) {
        customer = db.customers.find(c => c.name.trim().toLowerCase() === payload.buyerName.trim().toLowerCase());
      }
      if (!customer) {
        customer = db.insertRow<Customer>('customers', {
          name: payload.buyerName || '?먯궛留ㅼ닔泥?誘몄긽)',
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

      // 2. 留ㅺ컖 怨꾩빟踰덊샇 諛?湲곕낯 泥?뎄??梨낆젙
      const contractNo = generateNextSaleContractNo();
      const billingYm = payload.disposalDate.slice(0, 7);
      const dayNum = parseInt(payload.disposalDate.slice(8, 10), 10) || 30;

      // 3. ?뚯옣 2.1 & 2.2: 留ㅺ컖 怨꾩빟(Sale Contract) ?앹꽦 (5? 怨꾩빟 議곌굔 ?ы븿)
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

      // 4. 媛??먯궛蹂?泥닿껐 ?먯궛 ?щ’ 諛붿씤??諛?留덉뒪??SOLD ?꾩씠
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

        // 4-1. 泥닿껐 ?먯궛 ?щ’ 異붽?
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

        // 4-2. ?먯궛 留덉뒪??SOLD ?꾩씠 諛?泥섎텇 ?ㅻ깄??諛섏쁺
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

        // 4-3. ?뚯옣 1.2 臾대늻??DB ??? ?먯궛 ?낆텧怨??대젰(DISPOSAL) 湲곕줉
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: asset.id,
          assetNo: asset.assetNo,
          modelName: asset.modelName,
          type: 'DISPOSAL',
          customerId: customer.id,
          customerName: customer.name,
          eventDate: payload.disposalDate,
          memo: `?먯궛 留ㅺ컖 泥섎텇 怨꾩빟 泥닿껐 (怨꾩빟: ${contract.contractNo}, 留ㅺ컖?④?: ??{salePrice.toLocaleString()}, 泥섎텇?먯씡: ??{gainLoss.toLocaleString()})`,
          createdAt: new Date().toISOString()
        });
      }

      // 5. 1?뚯꽦 留ㅺ컖 泥?뎄??billings) 諛??곸꽭(billingDetails) 諛쒗뻾 (怨쇱꽭 10% 遺꾨━, 珥앹븸 100% ?쇱튂)
      const vat = Math.round(totalSalePrice * 0.1);
      const grandTotal = totalSalePrice + vat;

      const billing = db.insertRow<Billing>({
        billingType: 'ASSET_SALE',
        customerId: customer.id,
        contractId: contract.id,
        billingYm,
        billingDate: payload.disposalDate,
        totalAmount: grandTotal, // ?뮕 怨듦툒媛 + 遺媛??10% 珥앹븸 ?쇱튂 (BankMatching 1???ㅼ감 諛⑹?)
        paidAmount: 0,
        status: 'REQUESTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      for (const summary of soldAssetSummaries) {
        db.insertRow<BillingDetail>('billingDetails', {
          billingId: billing.id,
          itemName: `[?먯궛留ㅺ컖] ${summary.modelName} (愿由щ쾲?? ${summary.assetNo})`,
          quantity: 1,
          unitPrice: summary.salePrice,
          amount: summary.salePrice,
          internalDescription: `?댁쁺 ?먯궛 留ㅺ컖 ?湲?泥?뎄 (怨꾩빟: ${contract.contractNo})`,
          displayName: `${summary.modelName} 留ㅺ컖?湲?,
          createdAt: new Date().toISOString()
        });
      }

      // 6. 怨꾩빟 ?대젰(contractHistory) 湲곕줉
      db.insertRow<ContractHistory>({
        contractId: contract.id,
        changeType: 'ASSET_SOLD',
        changeDate: payload.disposalDate,
        description: `?댁쁺 ?먯궛 ${soldAssetSummaries.length}? 留ㅺ컖 泥섎텇 怨꾩빟 泥닿껐 (留ㅺ컖珥앹븸: ??{totalSalePrice.toLocaleString()})`,
        createdAt: new Date().toISOString()
      });

      // ?? [?⑥씪 ?낅Т ?멸퀎 ?뚯씠?꾨씪?? 二쇨린?μ뿉 留ㅺ컖 ?λ퉬 ?ㅻЪ ?몃룄 寃??ToDo 諛쒗뻾
      await issueHandoverTask({
        category: 'ASSET_DISPOSAL_HANDOVER',
        title: `[留ㅺ컖 ?λ퉬 ?몃룄 寃?? ${customer.name} (${soldAssetSummaries.length}?)`,
        content: `留ㅺ컖 泥섎텇 怨꾩빟 泥닿껐 ?꾨즺 (怨꾩빟: ${contract.contractNo}, 珥앹븸: ??{grandTotal.toLocaleString()}). 二쇨린???ㅻЪ ?몃룄 諛??곸감 寃?섎? 吏꾪뻾?섏꽭??`,
        targetDept: 'YARD',
        priority: 'HIGH',
        actionUrl: '/admin/asset_acquisition_disposal',
        entityType: 'CONTRACT',
        entityId: contract.id,
        senderId: currentUser?.id,
        senderName: currentUser?.name
      });

      // 7. ?뚯옣 5.2 ?숆린 ?곌린 ?湲?
      await db.awaitPendingWrites();

      // 8. ?대찓??諛쒖넚 ?곕룞 (?붿껌??寃쎌슦)
      if (payload.sendEmail && payload.recipientEmail) {
        try {
          const vat = Math.round(totalSalePrice * 0.1);
          const grand = totalSalePrice + vat;
          const tenantBrand = currentTenant?.displayName || currentTenant?.tradeName || 'e-Bro';
          const tenantCorp = currentTenant?.tradeName || currentTenant?.corporateName || tenantBrand;
          const tenantAccount = currentTenant?.bankAccounts?.[0]
            ? `[${tenantBrand}] ${currentTenant.bankAccounts[0].bankName} ${currentTenant.bankAccounts[0].accountNumber} (?덇툑二? ${currentTenant.bankAccounts[0].accountHolder})`
            : '[e-Bro] 怨꾩쥖臾몄쓽';
          const subject = `[${tenantBrand}] ?먯궛 留ㅺ컖 怨꾩빟??諛?泥?뎄???덈궡 (${customer.name} 洹??`;
          const paymentTermsText = payload.saleTerms?.paymentType === 'INSTALLMENT'
            ? `遺꾪븷 吏湲?(怨꾩빟湲? ??{(payload.saleTerms.installmentDownAmount || 0).toLocaleString()}??/ ?붽툑: ??{(payload.saleTerms.installmentBalanceAmount || 0).toLocaleString()}?? ?붽툑?⑷린: ${payload.saleTerms.installmentBalanceDueDate || '-'})`
            : `?쇱떆遺??꾨궔 (${payload.saleTerms?.lumpSumDueTerm === 'DELIVERY' ? '?λ퉬 ?몃룄???꾨궔' : payload.saleTerms?.lumpSumDueTerm === '7_DAYS' ? '怨꾩빟?쇰줈遺??7???대궡' : payload.saleTerms?.lumpSumDueTerm === '14_DAYS' ? '怨꾩빟?쇰줈遺??14???대궡' : payload.saleTerms?.lumpSumDueTerm === 'MONTH_10' ? '?듭썡 10???꾨궔' : '怨꾩빟 泥닿껐 利됱떆 ?꾨궔'})`;

          const deliveryTermsText = `${payload.saleTerms?.deliveryLocationType === 'BUYER_SITE' ? '留ㅼ닔泥?吏?뺤? ?섏감?? : '?뱀궗 二쇨린???곸감??FOB)'} (${payload.saleTerms?.freightBearer === 'SELLER' ? '?뱀궗 ?댁넚遺?? : '留ㅼ닔???댁넚遺??}) / ?몃룄?덉젙?? ${payload.saleTerms?.deliveryDate || payload.disposalDate}`;

          const body = `
?덈뀞?섏꽭?? ${customer.name} ?대떦?먮떂.
${tenantCorp}?낅땲??

洹?ъ? 泥닿껐??怨좎냼?묒뾽? ?먯궛 留ㅺ컖 怨꾩빟 嫄댁뿉 ???怨꾩빟??諛?留ㅺ컖 ?湲?泥?뎄 ?댁뿭???덈궡???쒕┰?덈떎.

[怨꾩빟 諛?泥?뎄 ?붿빟]
- 怨꾩빟踰덊샇: ${contract.contractNo}
- 怨꾩빟?좏삎: ?먯궛 留ㅺ컖 怨꾩빟
- ?묐룄?쇱옄: ${payload.disposalDate}
- 留ㅺ컖 ?섎웾: 珥?${soldAssetSummaries.length}?
- 怨듦툒媛?? ??{totalSalePrice.toLocaleString()}??
- 遺媛??(10%): ??{vat.toLocaleString()}??
- 泥?뎄 珥앺빀怨꾧툑?? ??{grand.toLocaleString()}??
- ?낃툑 怨꾩쥖: ${payload.saleTerms?.bankAccount ? payload.saleTerms.bankAccount : tenantAccount}
- 寃곗젣 議곌굔: ${paymentTermsText}
- ?몃룄 議곌굔: ${deliveryTermsText}
${payload.saleTerms?.useStandardAsIsClause ? '- ?뱀빟: ?꾩긽???몄닔(As-Is) 諛??뚯쑀沅??좊낫(?湲??꾨궔 ???댁쟾)\n' : ''}
[留ㅺ컖 ?λ퉬 ?곸꽭 ?댁뿭]
${soldAssetSummaries.map((s, idx) => `${idx + 1}. 愿由щ쾲?? ${s.assetNo} / 紐⑤뜽紐? ${s.modelName} / 留ㅺ컖?④?: ??{s.salePrice.toLocaleString()}??).join('\n')}

${payload.memo ? `\n[?뱀씠?ы빆 / 硫붾え]\n${payload.memo}\n` : ''}

媛먯궗?⑸땲??
${currentTenant?.corporateName || tenantCorp} 諛곗긽
          `.trim();

          await emailService.sendEmail(
            payload.recipientEmail,
            subject,
            body,
            [],
            payload.ccEmail
          );

          db.insertRow<ContractHistory>({
            contractId: contract.id,
            changeType: 'DOCUMENT_SENT',
            changeDate: payload.disposalDate,
            description: `?먯궛 留ㅺ컖 怨꾩빟??諛?泥?뎄 ?댁뿭 ?대찓??諛쒖넚 ?꾨즺 (?섏떊: ${payload.recipientEmail})`,
            createdAt: new Date().toISOString()
          });
          await db.awaitPendingWrites();
        } catch (mailErr: any) {
          console.warn('[executeAssetSale] ?대찓??諛쒖넚 ?ㅽ뙣 (怨꾩빟 諛?泥?뎄???뺤긽 蹂댁〈??:', mailErr);
        }
      }

      refreshAllData();
      return { success: true, contractId: contract.id, billingId: billing.id, contractNo: contract.contractNo };
    } catch (err: any) {
      console.error('[executeAssetSale] Error:', err);
      showErrorModal(`?좑툘 ?먯궛 留ㅺ컖 怨꾩빟 泥섎━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n\n${err?.message || err}`, '?먯궛 留ㅺ컖 ?ㅽ뙣');
      throw err;
    }
  };

  // 援щ쾭???명솚???섑띁
  const disposeAsset = async (assetId: string, disposalData: { disposalDate: string; disposalPrice: number; buyer: string; billingYm?: string }) => {
    return executeAssetSale({
      buyerName: disposalData.buyer,
      disposalDate: disposalData.disposalDate,
      items: [{ assetId, salePrice: disposalData.disposalPrice }]
    });
  };

  const registerRentedAsset = async (assetData: Partial<Asset>) => {
    let result;
    const sanitizedMonthlyFee = Math.max(0, Number(assetData.monthlyRentFee) || 0);
    const sanitizedDailyFee = assetData.dailyRentFee ? Math.max(0, Number(assetData.dailyRentFee)) : Math.floor(sanitizedMonthlyFee / 30);

    const existing = db.assets.find(a => a.assetNo === assetData.assetNo || (assetData.id && a.id === assetData.id));
    if (existing) {
      result = db.updateRow<Asset>('assets', existing.id, {
        ...assetData,
        vendorAssetNo: assetData.vendorAssetNo || existing.vendorAssetNo || '',
        ownerType: 'RENTED',
        status: 'AVAILABLE',
        monthlyRentFee: sanitizedMonthlyFee,
        dailyRentFee: sanitizedDailyFee,
        actualRentReturnDate: '', // 怨쇨굅 ?ㅼ젣 諛섎궔??珥덇린??(?ъ엫李??쒖꽦??
        updatedAt: new Date().toISOString()
      });
    } else {
      result = db.insertRow<Asset>('assets', {
        modelName: assetData.modelName || '',
        assetNo: assetData.assetNo || '',
        vendorAssetNo: assetData.vendorAssetNo || '',
        serialNo: assetData.serialNo || '',
        manufacturer: assetData.manufacturer || '',
        ownerType: 'RENTED',
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
    // ?뚯옣 1.2 臾대늻??媛먯궗 濡쒓렇: ?꾩감泥??꾩감 諛섏엯
    if (result) {
      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: result.id,
        assetNo: result.assetNo,
        modelName: result.modelName,
        type: 'INBOUND',
        eventDate: result.rentStart || new Date().toISOString().split('T')[0],
        memo: `[?꾩감 諛섏엯] ?꾩감泥? ${result.renter || '?꾩감泥?} (?꾩감泥섎쾲?? ${result.vendorAssetNo || '-'})`,
        createdAt: new Date().toISOString()
      });
    }

    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('registerRentedAsset Supabase sync error:', err);
      showErrorModal(`?좑툘 ?꾩감 ?먯궛 ???以??먭꺽 DB ?숆린???ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n${err.message || err.details || JSON.stringify(err)}`, 'DB ?숆린???ㅻ쪟');
      throw err;
    }
    refreshAllData();
    return result;
  };

  const returnRentedAsset = async (assetId: string, returnDate: string, options?: { isDirectReturn?: boolean; memo?: string }): Promise<void> => {
    const target = db.assets.find(a => a.id === assetId);
    if (!target) return;

    if (target.rentStart && returnDate < target.rentStart) {
      showErrorModal(`?좑툘 ?꾩감泥?諛섎궔??${returnDate})? ?꾩감 ?쒖옉??${target.rentStart}) ?댁쟾?????놁뒿?덈떎.`);
      throw new Error(`?꾩감泥?諛섎궔?쇱씠 ?꾩감 ?쒖옉???댁쟾?낅땲??`);
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

      // ?뚯옣 1.2 臾대늻??媛먯궗 濡쒓렇: ?꾩감泥?諛섎궔 諛섏텧 (?щ쾿 媛먯궗 ?먯젙: type OUTBOUND)
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
          ? `[?꾩감?먯궛 ?꾩옣 吏곷컲?? 怨좉컼??${cust?.name || '-'}) ?꾩옣?먯꽌 ?꾩감泥?${target.renter || '?꾩감泥?})濡?吏곷컲??泥섎━`
          : `[?꾩감?먯궛 二쇨린??諛섎궔] ?뱀궗 二쇨린?μ뿉???꾩감泥?${target.renter || '?꾩감泥?})濡?諛섎궔 泥섎━`),
        createdAt: new Date().toISOString()
      });

      // ?뚯옣 5.2 以?? CUD ?숆린 寃利?
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('returnRentedAsset ?숆린???ㅽ뙣:', err);
      showErrorModal(`?좑툘 ?꾩감泥?諛섎궔 留덇컧 泥섎━ 以?DB ?숆린???ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n${err.message || err}`, 'DB ?숆린???ㅻ쪟');
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
      showErrorModal(`?좑툘 援ъ긽 誘몄닔湲??깅줉 ?ㅻ쪟:\n${err.message || err.details || JSON.stringify(err)}`, 'DB ?숆린???ㅻ쪟');
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
      showErrorModal(`?좑툘 ?뚮え???덈ぉ ?깅줉 ?ㅻ쪟:\n${err.message || err}`, 'DB ?숆린???ㅻ쪟');
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
      showErrorModal(`?좑툘 ?뚮え???덈ぉ ?섏젙 ?ㅻ쪟:\n${err.message || err}`, 'DB ?숆린???ㅻ쪟');
      throw err;
    }
  };

  const deleteConsumable = async (id: string) => {
    try {
      const hasLogs = db.consumableLogs.some(l => l.consumableId === id);
      const hasVehicleStock = db.mechanicConsumableStocks.some(s => s.consumableId === id && s.stockQty > 0);
      
      if (hasLogs || hasVehicleStock) {
        showErrorModal('?섎텋 ?대젰???덇굅??李⑤웾??遺덉텧???ш퀬媛 ?덉뼱 ??젣?????놁뒿?덈떎. 愿由ъ옄?먭쾶 臾몄쓽?섏뿬 ?⑥쥌 泥섎━?섏꽭??', '??젣 遺덇?');
        throw new Error('??젣 遺덇?');
      }

      db.deleteRow('consumables', id);
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      if (err.message !== '??젣 遺덇?') {
        showErrorModal(`?좑툘 ?뚮え????젣 ?ㅻ쪟:\n${err.message || err}`, 'DB ?숆린???ㅻ쪟');
      }
      throw err;
    }
  };

  const purchaseConsumable = async (data: { modelName: string; qty: number; unit: string; unitPrice: number; supplier: string }) => {
    if (!data.modelName?.trim()) {
      showErrorModal('?뚮え???덈챸???낅젰?댁＜?몄슂.');
      return;
    }
    if (data.qty <= 0) {
      showErrorModal('?낃퀬 ?섎웾? 1媛??댁긽?댁뼱???⑸땲??');
      return;
    }
    if (data.unitPrice < 0) {
      showErrorModal('?④???0???댁긽?댁뼱???⑸땲??');
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
        unit: data.unit || '媛?,
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
      description: '?뚮え??援ъ엯 ?낃퀬',
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const useConsumable = async (data: { consumableId: string; quantity: number; targetAssetId: string; description: string }) => {
    try {
      if (data.quantity <= 0) {
        showErrorModal('?뚮え ?섎웾? 1媛??댁긽?댁뼱???⑸땲??');
        throw new Error('?뚮え ?섎웾? 1媛??댁긽?댁뼱???⑸땲??');
      }
      const cleanQty = Math.max(1, Math.floor(data.quantity));
      const consumable = db.consumables.find(c => c.id === data.consumableId);
      if (!consumable || consumable.stockQty < cleanQty) {
        const msg = `?뚮え???ш퀬媛 遺議깊빀?덈떎. (?꾩옱怨? ${consumable?.stockQty || 0}媛?/ ?붿껌: ${cleanQty}媛?`;
        showErrorModal(`?좑툘 ${msg}`);
        throw new Error(msg);
      }

      db.updateRow<Consumable>('consumables', consumable.id, {
        stockQty: consumable.stockQty - cleanQty,
        updatedAt: new Date().toISOString()
      });

      db.insertRow<ConsumableLog>('consumableLogs', {
        consumableId: consumable.id,
        type: 'OUTBOUND',
        quantity: cleanQty,
        unitPrice: consumable.unitPrice,
        targetAssetId: data.targetAssetId,
        userId: getValidUserId(currentUser?.id),
        actionDate: new Date().toISOString().split('T')[0],
        description: data.description,
        createdAt: new Date().toISOString()
      });

      const asset = db.assets.find(a => a.id === data.targetAssetId);
      if (asset) {
        const cost = consumable.unitPrice * cleanQty;
        db.updateRow<Asset>('assets', asset.id, {
          cumRepairCost: (asset.cumRepairCost || 0) + cost,
          updatedAt: new Date().toISOString()
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 ?뚮え???ъ슜 泥섎━ ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  const transferConsumableToMechanic = async (mechanicId: string, consumableId: string, quantity: number, memo?: string): Promise<void> => {
    try {
      if (quantity <= 0) {
        showErrorModal('遺덉텧 ?섎웾? 1媛??댁긽?댁뼱???⑸땲??');
        throw new Error('遺덉텧 ?섎웾? 1媛??댁긽?댁뼱???⑸땲??');
      }
      const consumable = db.consumables.find(c => c.id === consumableId);
      if (!consumable || consumable.stockQty < quantity) {
        const msg = `蹂몄궗 ?ш퀬媛 遺議깊빀?덈떎. (蹂몄궗 ?꾩옱怨? ${consumable?.stockQty || 0}媛?`;
        showErrorModal(`?좑툘 ${msg}`);
        throw new Error(msg);
      }

      const mechanic = db.users.find(u => u.id === mechanicId);
      const mechanicName = mechanic?.name || '?뺣퉬??;

      // 1. 蹂몄궗 ?ш퀬 李④컧
      db.updateRow<Consumable>('consumables', consumableId, {
        stockQty: consumable.stockQty - quantity,
        updatedAt: new Date().toISOString()
      });

      // 2. 湲곗궗 李⑤웾 ?ш퀬 利앷?
      const existingStock = db.mechanicConsumableStocks.find(s => s.mechanicId === mechanicId && s.consumableId === consumableId);
      if (existingStock) {
        db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', existingStock.id, {
          stockQty: existingStock.stockQty + quantity,
          updatedAt: new Date().toISOString()
        });
      } else {
        const newId = `mcs-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        db.insertRow<MechanicConsumableStock>('mechanicConsumableStocks', {
          id: newId,
          mechanicId,
          consumableId,
          stockQty: quantity,
          updatedAt: new Date().toISOString()
        });
      }

      // 3. ?ш퀬 ?대룞 ?섎텋 濡쒓렇 湲곕줉
      db.insertRow<ConsumableLog>('consumableLogs', {
        consumableId,
        type: 'TRANSFER_TO_VEHICLE',
        quantity,
        unitPrice: consumable.unitPrice,
        userId: currentUser?.id,
        mechanicId,
        fromLocation: '二쇨린???ш퀬',
        toLocation: `${mechanicName} 李⑤웾`,
        actionDate: new Date().toISOString().split('T')[0],
        description: memo || `[李⑤웾 遺덉텧] 二쇨린????${mechanicName} 李⑤웾 ?대룞 (${quantity}媛?`,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 李⑤웾 遺덉텧 泥섎━ ?ㅽ뙣:\n${err?.message || err}`);
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
        showErrorModal('諛섎궔 ?섎웾? 1媛??댁긽?댁뼱???⑸땲??');
        throw new Error('諛섎궔 ?섎웾? 1媛??댁긽?댁뼱???⑸땲??');
      }
      const existingStock = db.mechanicConsumableStocks.find(s => s.mechanicId === mechanicId && s.consumableId === consumableId);
      if (!existingStock || existingStock.stockQty < quantity) {
        const msg = `李⑤웾 蹂댁쑀 ?ш퀬媛 遺議깊빀?덈떎. (李⑤웾 ?꾩옱怨? ${existingStock?.stockQty || 0}媛?`;
        showErrorModal(`?좑툘 ${msg}`);
        throw new Error(msg);
      }

      const consumable = db.consumables.find(c => c.id === consumableId);
      const mechanic = db.users.find(u => u.id === mechanicId);
      const mechanicName = mechanic?.name || '?뺣퉬??;

      // 1. 湲곗궗 李⑤웾 ?ш퀬 李④컧
      db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', existingStock.id, {
        stockQty: existingStock.stockQty - quantity,
        updatedAt: new Date().toISOString()
      });

      // 2. ?좏뭹 ?뺤긽 諛섎궔 vs 怨좏뭹 寃⑸━ 泥섎━
      if (!isDefective) {
        // ?뺤긽 ?좏뭹 諛섎궔: 二쇨린??媛???ш퀬 利앷?
        if (consumable) {
          db.updateRow<Consumable>('consumables', consumableId, {
            stockQty: consumable.stockQty + quantity,
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        // 怨좏뭹(遺덈웾?? 諛섎궔: 二쇨린???좏뭹 媛?⑹옱怨?媛??李⑤떒 諛?怨좏뭹 愿由????collectedParts) 寃⑸━ ?곸옱
        const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const newPartNo = `COL-${todayStr}-${Math.floor(1000 + Math.random() * 9000)}`;
        db.insertRow<CollectedPart>('collectedParts', {
          id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          partNo: newPartNo,
          consumableId,
          modelName: consumable?.modelName || '遺??,
          mechanicId,
          mechanicName,
          quantity,
          disposition,
          status: 'RECEIVED',
          receivedDate: new Date().toISOString().split('T')[0],
          memo: memo || `[怨좏뭹 ?섍굅] ${mechanicName} 李⑤웾 諛섎궔 (${disposition})`,
          createdAt: new Date().toISOString()
        });
      }

      // 3. ?ш퀬 諛섎궔 ?섎텋 濡쒓렇 湲곕줉
      db.insertRow<ConsumableLog>('consumableLogs', {
        consumableId,
        type: 'RETURN_TO_HQ',
        quantity,
        unitPrice: consumable?.unitPrice || 0,
        userId: currentUser?.id,
        mechanicId,
        fromLocation: `${mechanicName} 李⑤웾`,
        toLocation: !isDefective ? '二쇨린???ш퀬' : `怨좏뭹 寃⑸━??(${disposition})`,
        actionDate: new Date().toISOString().split('T')[0],
        description: memo || (!isDefective 
          ? `[二쇨린??諛섎궔] ${mechanicName} 李⑤웾 ??二쇨린???ш퀬 ?뚯닔 (${quantity}媛?`
          : `[怨좏뭹 諛섎궔] ${mechanicName} 李⑤웾 ??怨좏뭹 寃⑸━ (${disposition}, ${quantity}媛?`),
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 蹂몄궗 諛섎궔 泥섎━ ?ㅽ뙣:\n${err?.message || err}`);
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
        showErrorModal('?숈씪???뺣퉬??李⑤웾 媛꾩뿉???대룞?????놁뒿?덈떎.');
        throw new Error('?숈씪???뺣퉬??李⑤웾 媛꾩뿉???대룞?????놁뒿?덈떎.');
      }
      if (quantity <= 0) {
        showErrorModal('?대룞 ?섎웾? 1媛??댁긽?댁뼱???⑸땲??');
        throw new Error('?대룞 ?섎웾? 1媛??댁긽?댁뼱???⑸땲??');
      }

      const fromStock = db.mechanicConsumableStocks.find(s => s.mechanicId === fromMechanicId && s.consumableId === consumableId);
      if (!fromStock || fromStock.stockQty < quantity) {
        const msg = `?묐룄 ?뺣퉬??李⑤웾??蹂댁쑀 ?ш퀬媛 遺議깊빀?덈떎. (?꾩옱怨? ${fromStock?.stockQty || 0}媛?`;
        showErrorModal(`?좑툘 ${msg}`);
        throw new Error(msg);
      }

      const fromUser = db.users.find(u => u.id === fromMechanicId);
      const toUser = db.users.find(u => u.id === toMechanicId);
      const consumable = db.consumables.find(c => c.id === consumableId);

      // 1. ?묐룄 李⑤웾 ?ш퀬 李④컧
      db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', fromStock.id, {
        stockQty: fromStock.stockQty - quantity,
        updatedAt: new Date().toISOString()
      });

      // 2. ?묒닔 李⑤웾 ?ш퀬 利앷?
      const toStock = db.mechanicConsumableStocks.find(s => s.mechanicId === toMechanicId && s.consumableId === consumableId);
      if (toStock) {
        db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', toStock.id, {
          stockQty: toStock.stockQty + quantity,
          updatedAt: new Date().toISOString()
        });
      } else {
        db.insertRow<MechanicConsumableStock>('mechanicConsumableStocks', {
          id: `mcs-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          mechanicId: toMechanicId,
          consumableId,
          stockQty: quantity,
          updatedAt: new Date().toISOString()
        });
      }

      // 3. ?섎텋 濡쒓렇 湲곕줉
      db.insertRow<ConsumableLog>('consumableLogs', {
        consumableId,
        type: 'TRANSFER_TO_VEHICLE',
        quantity,
        unitPrice: consumable?.unitPrice || 0,
        userId: currentUser?.id,
        mechanicId: toMechanicId,
        fromLocation: `${fromUser?.name || '?뺣퉬??} 李⑤웾`,
        toLocation: `${toUser?.name || '?뺣퉬??} 李⑤웾`,
        actionDate: new Date().toISOString().split('T')[0],
        description: memo || `[李⑤웾 媛??듯넻] ${fromUser?.name} 李⑤웾 ??${toUser?.name} 李⑤웾 (${quantity}媛?`,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 李⑤웾 媛?遺???듯넻 泥섎━ ?ㅽ뙣:\n${err?.message || err}`);
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
        if (!mechanicId) throw new Error('李⑤웾 ?ㅼ궗??寃쎌슦 ?대떦 ?뺣퉬?щ? 吏?뺥빐???⑸땲??');
        const mech = db.users.find(u => u.id === mechanicId);
        mechanicName = mech?.name;
        const corpVehicle = db.corporateVehicles.find(v => v.primaryDriverId === mechanicId);
        vehicleNo = corpVehicle?.vehicleNo || (mech as any)?.vehicleNo || '';
      }

      // 1. ?ㅼ궗 留덉뒪???앹꽦
      const newAuditId = `stk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      
      // 2. ?뱀떆 ?꾩궛 ?ш퀬 ?ㅻ깄???앹꽦
      const itemsToInsert: StocktakingAuditItem[] = [];
      let totalSystemQty = 0;
      let totalSystemAmount = 0;

      if (targetType === 'HQ') {
        // 二쇨린???ш퀬: ?꾩껜 consumable 紐⑸줉 ?ㅻ깄??
        db.consumables.forEach(c => {
          const sysQty = c.stockQty || 0;
          const uPrice = c.unitPrice || 0;
          totalSystemQty += sysQty;
          totalSystemAmount += sysQty * uPrice;

          itemsToInsert.push({
            id: `stki-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            auditId: newAuditId,
            consumableId: c.id,
            modelName: c.modelName,
            unit: c.unit || '媛?,
            unitPrice: uPrice,
            systemQty: sysQty,
            actualQty: sysQty,
            diffQty: 0,
            diffAmount: 0
          });
        });
      } else {
        // ?뱀젙 ?뺣퉬??李⑤웾: ?대떦 ?뺣퉬?ъ쓽 蹂댁쑀 遺???먮뒗 ?꾩궗 遺???ㅻ깄??
        const mechStocks = db.mechanicConsumableStocks.filter(s => s.mechanicId === mechanicId);
        const stockMap = new Map<string, number>();
        mechStocks.forEach(s => stockMap.set(s.consumableId, s.stockQty || 0));

        db.consumables.forEach(c => {
          const sysQty = stockMap.get(c.id) || 0;
          const uPrice = c.unitPrice || 0;
          totalSystemQty += sysQty;
          totalSystemAmount += sysQty * uPrice;

          itemsToInsert.push({
            id: `stki-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            auditId: newAuditId,
            consumableId: c.id,
            modelName: c.modelName,
            unit: c.unit || '媛?,
            unitPrice: uPrice,
            systemQty: sysQty,
            actualQty: sysQty,
            diffQty: 0,
            diffAmount: 0
          });
        });
      }

      const newAudit: StocktakingAudit = {
        id: newAuditId,
        auditNo,
        targetType,
        mechanicId,
        mechanicName,
        vehicleNo,
        auditDate: dateStr,
        auditorId: currentUser?.id || 'admin',
        auditorName: currentUser?.name || '?ㅼ궗?대떦??,
        status: 'DRAFT',
        totalSystemQty,
        totalActualQty: totalSystemQty,
        totalDiffQty: 0,
        totalSystemAmount,
        totalActualAmount: totalSystemAmount,
        totalDiffAmount: 0,
        memo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.insertRow<StocktakingAudit>('stocktakingAudits', newAudit);
      itemsToInsert.forEach(item => {
        db.insertRow<StocktakingAuditItem>('stocktakingAuditItems', item);
      });

      await db.awaitPendingWrites();
      refreshAllData();
      return newAudit;
    } catch (err: any) {
      showErrorModal(`?좑툘 ?ㅼ궗 ?꾪몴 ?앹꽦 ?ㅽ뙣:\n${err?.message || err}`);
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
      if (!item) throw new Error('?ㅼ궗 ?덈ぉ??李얠쓣 ???놁뒿?덈떎.');

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

      // 留덉뒪???⑷퀎 媛깆떊
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
      showErrorModal(`?좑툘 ?ㅼ궗 ?덈ぉ ?섎웾 ?섏젙 ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  const confirmStocktakingAudit = async (auditId: string): Promise<void> => {
    try {
      const audit = db.stocktakingAudits.find(a => a.id === auditId);
      if (!audit) throw new Error('?ㅼ궗 ?꾪몴瑜?李얠쓣 ???놁뒿?덈떎.');
      if (audit.status === 'CONFIRMED') throw new Error('?대? ?뺤젙 ?꾨즺???ㅼ궗 ?꾪몴?낅땲??');

      const items = db.stocktakingAuditItems.filter(i => i.auditId === auditId);
      const targetLocation = audit.targetType === 'HQ' ? '二쇨린???ш퀬' : `${audit.mechanicName || '?뺣퉬??} 李⑤웾`;

      // 1. 李⑥씠媛 ?덈뒗 ?덈ぉ?ㅼ뿉 ????꾩궛 ?ш퀬 媛뺤젣 蹂댁젙 & ADJUST ?섎텋 濡쒓렇 諛쒗뻾
      items.forEach(item => {
        if (item.diffQty !== 0) {
          if (audit.targetType === 'HQ') {
            // 蹂몄궗 李쎄퀬 ?꾩궛?ш퀬 媛뺤젣 蹂댁젙
            const c = db.consumables.find(con => con.id === item.consumableId);
            if (c) {
              db.updateRow<Consumable>('consumables', c.id, {
                stockQty: item.actualQty,
                updatedAt: new Date().toISOString()
              });
            }
          } else {
            // ?뱀젙 ?뺣퉬??李⑤웾 ?꾩궛?ш퀬 媛뺤젣 蹂댁젙
            const mStock = db.mechanicConsumableStocks.find(s => s.mechanicId === audit.mechanicId && s.consumableId === item.consumableId);
            if (mStock) {
              db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', mStock.id, {
                stockQty: item.actualQty,
                updatedAt: new Date().toISOString()
              });
            } else {
              db.insertRow<MechanicConsumableStock>('mechanicConsumableStocks', {
                id: `mcs-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                mechanicId: audit.mechanicId!,
                consumableId: item.consumableId,
                stockQty: item.actualQty,
                updatedAt: new Date().toISOString()
              });
            }
          }

          // ADJUST 媛먯궗 濡쒓렇 ?먮룞 ?곸옱
          const reasonText = item.diffReason === 'LOST' ? '留앹떎/?꾨궃' 
            : item.diffReason === 'DAMAGED' ? '?뚯넀/?먭린'
            : item.diffReason === 'UNRECORDED_USAGE' ? '誘멸린濡앺쁽?μ냼紐?
            : item.diffReason === 'SURPLUS' ? '誘몃벑濡앹엵?? : '湲고??ъ쑀';

          db.insertRow<ConsumableLog>('consumableLogs', {
            consumableId: item.consumableId,
            type: 'ADJUST',
            quantity: Math.abs(item.diffQty),
            unitPrice: item.unitPrice,
            userId: currentUser?.id,
            mechanicId: audit.mechanicId,
            fromLocation: targetLocation,
            toLocation: targetLocation,
            actionDate: audit.auditDate,
            description: `[?ㅼ궗 ${item.diffQty > 0 ? '?됱뿬' : '媛먮え'}] ${audit.auditNo} | ${item.modelName} ${item.diffQty > 0 ? `+${item.diffQty}` : item.diffQty}媛?蹂댁젙 (${reasonText}${item.note ? `: ${item.note}` : ''})`,
            createdAt: new Date().toISOString()
          });
        }
      });

      // 2. ?ㅼ궗 ?꾪몴 ?뺤젙 ?꾨즺 泥섎━
      db.updateRow<StocktakingAudit>('stocktakingAudits', auditId, {
        status: 'CONFIRMED',
        confirmedAt: new Date().toISOString(),
        confirmedBy: currentUser?.name || '愿由ъ옄',
        updatedAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 ?ㅼ궗 ?뺤젙 泥섎━ ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  const cancelStocktakingAudit = async (auditId: string): Promise<void> => {
    try {
      const audit = db.stocktakingAudits.find(a => a.id === auditId);
      if (!audit) throw new Error('?ㅼ궗 ?꾪몴瑜?李얠쓣 ???놁뒿?덈떎.');
      if (audit.status === 'CONFIRMED') throw new Error('?대? ?뺤젙???ㅼ궗 ?꾪몴??痍⑥냼?????놁뒿?덈떎.');

      db.updateRow<StocktakingAudit>('stocktakingAudits', auditId, {
        status: 'CANCELLED',
        updatedAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 ?ㅼ궗 ?꾪몴 痍⑥냼 ?ㅽ뙣:\n${err?.message || err}`);
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
      if (!part) throw new Error('?섍굅 怨좏뭹??李얠쓣 ???놁뒿?덈떎.');

      db.updateRow<CollectedPart>('collectedParts', partId, {
        status: actionStatus,
        actionDate: actionStatus === 'COMPLETED' ? new Date().toISOString().split('T')[0] : part.actionDate,
        actionMemo: actionMemo || part.actionMemo
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 怨좏뭹 ?ы썑泥섎━ 媛깆떊 ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  // ??? [?꾩궗 ?뺣퉬 & AS ?⑥씪 臾쇰━ ?듯빀 ?듭떖 鍮꾩쫰?덉뒪 濡쒖쭅 (1-A, 2-B, 3-B, 4-A)] ?????????
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

      // ?뮕 怨꾩빟 諛?1? ?⑤룆怨꾩빟 ?먯궛 ?먮룞 留ㅽ븨 (?ъ옣???뺤젙 1踰??먯튃)
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

      if (resolvedContractId && (!resolvedAssetId || resolvedAssetId === '?꾩옣?뺤씤' || resolvedAssetNo === '?꾩옣?뺤씤')) {
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

      // ?뮕 ?꾨줈紐??곸꽭 二쇱냼(siteAddress) ?먮룞 ??텛??諛?留ㅽ븨 (T留??대퉬 ?곕룞 ?⑥씪 吏꾩떎???먯쿇)
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
        if (resolvedSiteAddress === (data.siteName || data.customerName || '?꾩옣')) {
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
        ? (initialMemo ? `${initialMemo}\n[?꾩옣?꾨줈紐? ${resolvedSiteAddress}]` : `[?꾩옣?꾨줈紐? ${resolvedSiteAddress}]`)
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
        assetNo: resolvedAssetNo || '?꾩옣?뺤씤',
        modelName: resolvedModelName || '怨좎냼?묒뾽?',
        locationDetail: data.locationDetail || (resolvedSiteAddress ? resolvedSiteAddress : ''),
        reporterName: data.reporterName || '',
        reporterContact: data.reporterContact || '',
        issueCategory: data.issueCategory || '湲고?',
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

      // ?? [?⑥씪 ?낅Т ?멸퀎 ?뚯씠?꾨씪?? ?뺣퉬???臾쇰━ ToDo ?곸옱 + 釉뚮줈?쒖틦?ㅽ듃
      await issueHandoverTask({
        category: 'AS_DISPATCH_REPAIR',
        title: `[湲닿툒 AS 異쒕룞] ${newTicket.customerName || '?꾩옣'} (${newTicket.modelName || '?λ퉬'})`,
        content: `利앹긽: ${newTicket.issueCategory || '湲고?'} - ${newTicket.issueDescription || 'AS ?붿껌'} (?꾩옣: ${newTicket.siteName || '-'})`,
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
      showErrorModal(`?좑툘 AS ?묒닔 ?앹꽦 ?ㅽ뙣:\n${err?.message || err}`);
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
      showErrorModal(`?좑툘 AS ?곹깭 蹂寃??ㅽ뙣:\n${err?.message || err}`);
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
      const mechanicName = currentUser?.name || ticket.mechanicName || '?대떦湲곗궗';

      let label = '';
      let newStatus = ticket.status;

      if (eventType === 'CALL_MADE') {
        label = `?뱸 [${timeStr}] ${mechanicName} ?꾩옣 ?듯솕 諛쒖떊 (${detail || ticket.reporterContact || ''})`;
      } else if (eventType === 'TRANSIT_START') {
        label = `?슅 [${timeStr}] ${mechanicName} ${detail || '?대퉬 湲몄븞??} (?꾩옣 ?대룞 ?쒖옉)`;
        if (ticket.status === 'REQUESTED' || ticket.status === 'SCHEDULED') {
          newStatus = 'IN_PROGRESS';
        }
      } else if (eventType === 'ARRIVED') {
        label = `?뱧 [${timeStr}] ${mechanicName} ?꾩옣 ?꾩갑 諛??먭? 李⑹닔`;
        newStatus = 'IN_PROGRESS';
      } else if (eventType === 'COMPLETED') {
        label = `??[${timeStr}] ${mechanicName} ?꾩옣 議곗튂 ?꾨즺 (${detail || ''})`;
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
  }): Promise<void> => {
    try {
      const ticket = db.repairs.find(t => t.id === ticketId);
      if (!ticket) throw new Error('?대떦 ?뺣퉬/AS ?묒닔嫄댁쓣 李얠쓣 ???놁뒿?덈떎.');

      const mechanic = db.users.find(u => u.id === data.mechanicId);
      const mechanicName = mechanic?.name || ticket.mechanicName || '?대떦湲곗궗';

      // 1. ?뚮え??李⑤웾 ?ш퀬 ?좏슚??寃??諛?李④컧
      if (data.partsUsed && data.partsUsed.length > 0) {
        for (const part of data.partsUsed) {
          if (!part.quantity || part.quantity <= 0) {
            throw new Error(`?ъ슜 遺??"${part.modelName}")???섎웾? 1媛??댁긽?댁뼱???⑸땲??`);
          }
          const vehicleStock = db.mechanicConsumableStocks.find(
            s => s.mechanicId === data.mechanicId && s.consumableId === part.consumableId
          );
          const currentQty = vehicleStock?.stockQty || 0;
          if (currentQty < part.quantity) {
            throw new Error(`?좑툘 [李⑤웾 ?ш퀬 遺議? ${mechanicName} 湲곗궗??李⑤웾 ?ш퀬??"${part.modelName}" ?덈ぉ??遺議깊빀?덈떎.\n(?꾩옱 ?곸옱: ${currentQty}媛?/ ?ъ슜 ?꾩슂: ${part.quantity}媛?\n\n[?뚮え??愿由???李⑤웾蹂??대룞?ш퀬] 硫붾돱?먯꽌 二쇨린???ш퀬瑜?李⑤웾?쇰줈 癒쇱? 遺덉텧(?대룞) ?깅줉??二쇱떆湲?諛붾엻?덈떎.`);
          }
        }

        // ?ㅼ젣 李④컧 ?섑뻾
        for (const part of data.partsUsed) {
          const vehicleStock = db.mechanicConsumableStocks.find(
            s => s.mechanicId === data.mechanicId && s.consumableId === part.consumableId
          );
          if (vehicleStock) {
            db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', vehicleStock.id, {
              stockQty: vehicleStock.stockQty - part.quantity,
              updatedAt: new Date().toISOString()
            });

            // ?뚮え??異쒓퀬 濡쒓렇 湲곕줉
            db.insertRow<ConsumableLog>('consumableLogs', {
              consumableId: part.consumableId,
              type: 'OUTBOUND',
              quantity: part.quantity,
              unitPrice: part.unitPrice,
              userId: currentUser?.id,
              mechanicId: data.mechanicId,
              fromLocation: `${mechanicName} 李⑤웾`,
              toLocation: `?꾩옣AS (${ticket.siteName || ''} / ${ticket.assetNo || ''})`,
              actionDate: new Date().toISOString().split('T')[0],
              description: `[?꾩옣AS 議곗튂 ?뚯쭊] ${ticket.assetNo || ''} ?섎━ ?ъ슜 (${ticket.ticketNo || ticket.id})`,
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      // 2. ?щ갑臾??곌퀎 ?곗폆 ?앹꽦 (?좏깮??寃쎌슦)
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
          assetId: ticket.assetId,
          assetNo: ticket.assetNo,
          locationDetail: ticket.locationDetail,
          reporterName: ticket.reporterName,
          reporterContact: ticket.reporterContact,
          issueCategory: ticket.issueCategory,
          issueDescription: `[?щ갑臾??ъ쑀] ${data.revisitReason || '?꾩냽 議곗튂 ?꾩슂'} (???묒닔: ${ticket.issueDescription})`,
          details: `[?щ갑臾??ъ쑀] ${data.revisitReason || '?꾩냽 議곗튂 ?꾩슂'} (???묒닔: ${ticket.issueDescription})`,
          errorCode: ticket.errorCode,
          priority: ticket.priority,
          status: 'SCHEDULED',
          requestDate: new Date().toISOString().split('T')[0],
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
          memo: `?댁쟾 AS ?곗폆(${ticket.ticketNo || ticket.id}) 1李??먭? ???곌퀎 ?앹꽦??,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        revisitRepairId = chainedTicket.id;
      } else if (data.resolutionType === 'GUIDED_END') {
        finalStatus = 'GUIDED';
      }

      // 3. ?꾩옱 ?곗폆 ?꾨즺/醫낃껐 ?낅뜲?댄듃
      const sanitizedBillableAmount = Math.max(0, Number(data.billableAmount) || 0);
      db.updateRow<Repair>('repairs', ticketId, {
        status: finalStatus,
        mechanicId: data.mechanicId,
        assignedMechanicId: data.mechanicId,
        mechanicName,
        actionTaken: data.actionTaken,
        resolutionType: data.resolutionType,
        partsUsed: data.partsUsed || [],
        collectedParts: data.collectedParts || [],
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
        completedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // ?윟 ?좏뻾 AS 異쒕룞 ToDo ?먯옄???먮룞 ?곴퀎
      await clearHandoverTasks({
        entityType: 'REPAIR',
        entityId: ticketId,
        category: 'AS_DISPATCH_REPAIR',
        completedByUserId: currentUser?.id,
        completedByName: currentUser?.name,
        completionAction: `AS_${finalStatus}`
      });

      // ?? 怨좉컼 怨쇱떎 ?좎긽 ?섎━ ??泥?뎄???諛붿씤??ToDo 諛쒗뻾 (留ㅼ텧 ?꾨씫 諛⑹?)
      if (sanitizedBillableAmount > 0) {
        await issueHandoverTask({
          category: 'BILLABLE_REPAIR_BILLING',
          title: `[?좎긽AS 泥?뎄 諛섏쁺] ${ticket.customerName || '怨좉컼??} (??{sanitizedBillableAmount.toLocaleString()}??`,
          content: `怨좉컼 怨쇱떎 ?좎긽 ?섎━鍮???{sanitizedBillableAmount.toLocaleString()}??泥?뎄??諛붿씤???붾쭩 (${ticket.siteName || '?꾩옣'}, ${data.actionTaken || '?섎━'})`,
          targetDept: 'ACCOUNTING',
          priority: 'HIGH',
          actionUrl: '/admin/billing',
          entityType: 'REPAIR',
          entityId: ticketId,
          senderId: currentUser?.id,
          senderName: currentUser?.name
        });
      }

      // ?뙚 [?뚯옣 2.3 以?? ?꾩옣 ?섎━ 遺덈뒫 ?李??쒖븞 ???⑥씪 'EXCHANGE' ?뺣났 諛곗감 ?섎ː 1嫄??먮룞 諛쒗뻾
      if (data.exchangeSuggested) {
        const defaultYard = currentTenant?.yards?.find((y: any) => y.isDefault) || currentTenant?.yards?.[0];
        const originYardAddress = defaultYard ? `${defaultYard.name} (${defaultYard.address || ''})` : (currentTenant?.mainYardAddress || '蹂몄궗 二쇨린??);

        const deliveryId = db.generateNextId('deliveries', db.deliveries);
        db.insertRow<Delivery>('deliveries', {
          id: deliveryId,
          contractId: ticket.contractId,
          type: 'EXCHANGE',
          dispatchCategory: '援먰솚',
          status: 'PENDING',
          requestDate: new Date().toISOString().split('T')[0],
          originAddress: originYardAddress,
          pickupType: 'HQ_YARD',
          destinationAddress: ticket.locationDetail || ticket.siteName || '?꾩옣',
          dropoffType: 'CUSTOMER_SITE',
          deliveryCost: 0,
          memo: `[?꾩옣AS ?李??붿껌] ?뚯닔????먯궛: ${ticket.assetNo || '?꾩옣怨좎옣?λ퉬'} / ?꾩옣: ${ticket.siteName || ''} (${ticket.customerName || ''}) / ?ъ쑀: ${data.actionTaken || '?꾩옣 ?섎━遺덈뒫 ?李?}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // ?? ?李?諛곗감 吏??ToDo 諛쒗뻾
        await issueHandoverTask({
          category: 'DISPATCH_REQUEST',
          title: `[?李?援먰솚 諛곗감] ${ticket.customerName || '怨좉컼??} (${ticket.assetNo || '?λ퉬'})`,
          content: `?꾩옣 ?섎━遺덈뒫 ?李??붿껌. ?좉퇋 ?λ퉬 異쒓퀬 諛?怨좎옣 ?λ퉬 ?뚯닔 ?뺣났 1嫄?諛곗감 泥섎━. (?꾩옣: ${ticket.siteName || '-'})`,
          targetDept: 'DISPATCH',
          priority: 'URGENT',
          actionUrl: '/admin/dispatch',
          entityType: 'DELIVERY',
          entityId: deliveryId,
          senderId: currentUser?.id,
          senderName: currentUser?.name
        });
      }

      // 4. ?먯궛 ?대젰(AssetInOutLog)???뺣퉬 ?ш굔 臾대늻??DB ???
      const targetAssetNo = ticket.assetNo;
      if (targetAssetNo && targetAssetNo !== '?꾩옣?뺤씤' && targetAssetNo !== '?꾩껜?λ퉬') {
        const matchedAsset = db.assets.find(a => a.assetNo === targetAssetNo);
        db.insertRow<AssetInOutLog>('assetInOutLogs', {
          assetId: matchedAsset?.id || ticket.assetId || `asset-${targetAssetNo}`,
          assetNo: targetAssetNo,
          modelName: matchedAsset?.modelName || ticket.locationDetail || '怨좎냼?묒뾽?',
          type: 'REPAIR',
          eventDate: new Date().toISOString().split('T')[0],
          customerId: ticket.customerId,
          customerName: ticket.customerName,
          siteId: ticket.siteId,
          siteName: ticket.siteName,
        });
      }

      // 5. 怨꾩빟 ?대젰(ContractHistory)??AS 諛쒖깮 諛?議곗튂 ?ш굔 臾대늻??DB ???(?묐갑???꾨꼍 異붿쟻??
      if (ticket.contractId) {
        db.insertRow<ContractHistory>('contract_history', {
          id: `ch-as-${ticket.id}-${Date.now()}`,
          contractId: ticket.contractId,
          changeType: 'AS_SERVICE',
          changeDate: new Date().toISOString().split('T')[0],
          description: `[?꾩옣 AS ${finalStatus === 'COMPLETED' ? '?꾨즺' : '議곗튂'}] ${data.actionTaken} (${ticket.assetNo || '?꾩옣?λ퉬'}, ?뺣퉬?? ${mechanicName}${data.billableAmount && data.billableAmount > 0 ? `, ?좎긽?섎━鍮???{data.billableAmount.toLocaleString()}` : ''})`,
          createdAt: new Date().toISOString()
        });
      }

      await db.awaitPendingWrites();
      refreshAllData();

      // ?뱼 ?李??쒖븞 ??諛곗감/異쒓퀬????李④탳泥??뚮┝ 釉뚮줈?쒖틦?ㅽ듃
      if (data.exchangeSuggested) {
        broadcastWorkNotification({
          type: 'EXCHANGE',
          title: '?李?援먯껜 ?섎ː ?깅줉',
          body: `${ticket.customerName || '怨좉컼??} (${ticket.siteName || '?꾩옣'}) ${ticket.assetNo || '?λ퉬'} ?꾩옣?섎━遺덈뒫 ?李⑥슂泥?,
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
      if (!parent) throw new Error('?댁쟾 AS ?곗폆??李얠쓣 ???놁뒿?덈떎.');

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
        issueDescription: `[?щ갑臾? ${revisitReason} (???묒닔: ${parent.issueDescription || parent.details})`,
        details: `[?щ갑臾? ${revisitReason} (???묒닔: ${parent.issueDescription || parent.details})`,
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
        memo: `?곗폆 ${parent.ticketNo || parent.id}?먯꽌 ?щ갑臾??곌퀎 ?앹꽦`,
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
      showErrorModal(`?좑툘 ?щ갑臾??곗폆 ?앹꽦 ?ㅽ뙣:\n${err?.message || err}`);
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
        const site = r.site || '誘몄??뺥쁽??;
        const asset = r.asset_no || '?꾩옣?뺤씤';
        const reqDate = r.date || '2026-08-01';
        const issue = r.issue || (r.raw ? r.raw.slice(0, 100) : '?먭? ?붿껌');
        const dedupeKey = `${site}_${asset}_${reqDate}_${issue.slice(0, 20)}`;

        if (existingRawSet.has(dedupeKey)) return;

        existingRawSet.add(dedupeKey);
        importedCount++;

        const ticketNo = `BAND-${String(5518 - idx).padStart(4, '0')}`;
        const rawText = r.raw || '';
        const isRevisit = rawText.includes('?댁씪諛⑸Ц') || rawText.includes('?щ갑臾?) || rawText.includes('諛⑸Ц?덉젙');
        const isGuided = rawText.includes('?ㅻ챸泥섎━') || rawText.includes('?댁긽?놁쓬') || rawText.includes('臾몄젣?놁쓬');
        const isCompleted = rawText.includes('?꾨즺') || rawText.includes('援먯껜') || rawText.includes('?섎━') || rawText.includes('蹂댁닔');

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

        let category = '湲고?';
        if (issue.includes('諛⑹?遊?) || issue.includes('?묒갑')) category = '諛⑹?遊??묒갑';
        else if (issue.includes('?곸듅') || issue.includes('?섍컯')) category = '?곹븯媛뺣텋??;
        else if (issue.includes('異⑹쟾') || issue.includes('諛고꽣由?)) category = '異⑹쟾/?꾩썝';
        else if (issue.includes('?ㅼ씪') || issue.includes('?꾩쑀')) category = '?ㅼ씪?꾩쑀';
        else if (issue.includes('?ㅻ컯??) || issue.includes('?ㅼ뒪?꾩튂')) category = '?ㅻ컯???ㅼ쐞移?;
        else if (issue.includes('?뚯씠??)) category = '?뚯씠?꾧구由?;
        else if (issue.includes('?먭?')) category = '?먭??붿껌';

        // ?뮕 4-A ?먯튃: 諛대뱶 ?묒꽦?????쒖뒪??users ?대쫫 1:1 ?먮룞 留ㅼ묶
        const authorName = (r.author || '').trim();
        const matchedUser = db.users.find(u => u.name && authorName && (u.name.trim() === authorName || authorName.includes(u.name.trim())));
        const mechanicId = matchedUser?.id || '';
        const mechanicName = matchedUser?.name || authorName || '?뺣퉬湲곗궗';

        // ?뮕 怨좉컼??諛??꾩옣 留ㅼ묶
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

        // 怨꾩빟 議고쉶 (怨좉컼/?꾩옣 湲곗?)
        let matchedContract = db.contracts.find(c => 
          (matchedCustomer && c.customerId === matchedCustomer.id) || 
          (matchedSite && c.siteId === matchedSite.id)
        );

        // ?뮕 5? 留ㅽ듃由?뒪 & ?ъ옣???뺤젙 ?먯튃 1: 愿由щ쾲??誘멸린????1? ?⑤룆 怨꾩빟?대㈃ ?대떦 ?먯궛?쇰줈 ?먮룞 異붿젙 留ㅽ븨
        let finalAssetNo = asset;
        let matchedAsset = db.assets.find(a => a.assetNo && asset && a.assetNo.trim().toUpperCase() === asset.trim().toUpperCase());
        if (!matchedAsset && asset && asset !== '?꾩옣?뺤씤') {
          const cleanNo = asset.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          matchedAsset = db.assets.find(a => a.assetNo && a.assetNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanNo);
        }
        let assetId = matchedAsset?.id || '';

        const currentContract = matchedContract;
        if ((!finalAssetNo || finalAssetNo === '?꾩옣?뺤씤' || finalAssetNo === '?꾩껜?λ퉬') && currentContract) {
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

        // ?뙚 ?먯궛 留덉뒪??湲곗? ?꾩옣 諛?怨좉컼????텛??(Back-tracking)
        if (matchedAsset) {
          if ((!matchedSite || !site || site === '誘몄??뺥쁽?? || site === '?쇰컲 ?꾩옣') && matchedAsset.currentSiteId) {
            const foundSite = db.customerSites.find(s => s.id === matchedAsset.currentSiteId);
            if (foundSite) {
              matchedSite = foundSite;
            }
          }
          if ((!matchedCustomer || !r.contractor || r.contractor === '?꾩옣 ?묐젰?낆껜' || r.contractor === '?묐젰?낆껜') && matchedAsset.currentCustomerId) {
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

        const actionText = r.action || (isCompleted ? '?꾩옣 ?뺣퉬 諛?議곗튂 ?꾨즺' : (isRevisit ? '?듭씪 ?щ갑臾??묒닔' : '?ㅻ챸 諛??덈궡 醫낃껐'));

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
          customerName: matchedCustomer?.name || r.contractor || '?꾩옣 ?묐젰?낆껜',
          siteId: matchedSite?.id || '',
          siteName: matchedSite?.name || site,
          assetId: assetId || undefined,
          assetNo: finalAssetNo || '?꾩옣?뺤씤',
          modelName: matchedAsset?.modelName || '怨좎냼?묒뾽?',
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
          memo: `[諛대뱶 怨쇨굅?대젰 ?먮룞 ?꾪룷??\n?묒꽦?? ${authorName || '湲곗궗'}\n?먮Ц: ${rawText.slice(0, 150)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        newRepairs.push(repairRow);

        // ?뮕 ?먯궛 ?앹븷二쇨린 ?대젰 濡쒓렇(AssetInOutLog) ?숈떆 湲곕줉 (愿由щ쾲?멸? ?앸퀎?섎뒗 ?λ퉬)
        if (finalAssetNo && finalAssetNo !== '?꾩옣?뺤씤' && finalAssetNo !== '?꾩껜?λ퉬') {
          newAssetLogs.push({
            id: `aiog-band-${idx + 1}`,
            assetId: assetId || `asset-${finalAssetNo}`,
            assetNo: finalAssetNo,
            modelName: matchedAsset?.modelName || '怨좎냼?묒뾽?',
            type: 'REPAIR',
            eventDate: reqDate,
            customerName: repairRow.customerName,
            siteName: repairRow.siteName,
            repairId: repairRow.id,
            memo: `[?꾩옣AS] ${issue} ??${actionText} (?뺣퉬?? ${mechanicName})`,
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
      showErrorModal(`?좑툘 諛대뱶 ?곗씠??媛?몄삤湲??ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  const getValidUserId = (id?: string): string => {
    if (id && id !== 'system') {
      const exists = db.users.some(u => u.id === id);
      if (exists) return id;
    }
    return db.users[0]?.id || 'usr-admin';
  };

  const requestConsumablePurchase = async (data: { consumableId?: string; modelName: string; qty: number; unitPrice: number; requestDate: string; sellerName: string }) => {
    const validUserId = getValidUserId(currentUser?.id);
    const newReq = db.insertRow<ConsumablePurchaseRequest>('consumablePurchases', {
      consumableId: data.consumableId || undefined,
      modelName: data.modelName,
      requestedQty: data.qty,
      unitPrice: data.unitPrice,
      requestDate: data.requestDate,
      sellerName: data.sellerName,
      status: 'REQUESTED',
      requesterId: validUserId,
      requesterName: currentUser?.name || '?쒖뒪??,
      receivedQty: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // ?? [?⑥씪 ?낅Т ?멸퀎 ?뚯씠?꾨씪?? 愿由ъ옄/遺?쒖옣?먭쾶 援щℓ 寃곗옱 ToDo 諛쒗뻾
    await issueHandoverTask({
      category: 'CONSUMABLE_PURCHASE_APPROVAL',
      title: `[?뚮え??援щℓ ?뱀씤] ${data.modelName} (${data.qty}EA)`,
      content: `援щℓ ?붿껌: ${data.modelName} ${data.qty}媛?(?④?: ??{data.unitPrice.toLocaleString()}?? 怨듦툒泥? ${data.sellerName})`,
      targetRole: 'MANAGER',
      priority: data.unitPrice * data.qty >= 1000000 ? 'HIGH' : 'NORMAL',
      actionUrl: '/admin/consumable',
      entityType: 'CONSUMABLE',
      entityId: newReq.id,
      senderId: currentUser?.id,
      senderName: currentUser?.name
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const acceptConsumablePurchase = async (id: string) => {
    const validUserId = getValidUserId(currentUser?.id);
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      status: 'ACCEPTED',
      acceptedDate: new Date().toISOString().split('T')[0],
      accepterId: validUserId,
      accepterName: currentUser?.name || '?쒖뒪??,
      updatedAt: new Date().toISOString()
    });

    // ?윟 援щℓ 寃곗옱 ToDo ?먮룞 ?곴퀎
    await clearHandoverTasks({
      entityType: 'CONSUMABLE',
      entityId: id,
      category: 'CONSUMABLE_PURCHASE_APPROVAL',
      completedByUserId: currentUser?.id,
      completedByName: currentUser?.name,
      completionAction: 'PURCHASE_ACCEPTED'
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const completeConsumablePurchase = async (id: string) => {
    const req = db.consumablePurchases.find(p => p.id === id);
    if (!req) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const settlementYm = req.requestDate ? req.requestDate.substring(0, 7) : todayStr.substring(0, 7);
    const effectiveQty = (req.receivedQty && req.receivedQty > 0) ? req.receivedQty : req.requestedQty;
    const totalAmount = effectiveQty * (req.unitPrice || 0);

    // 1. ?붾쭚 留ㅼ엯 ?뺤궛 留덉뒪???덉퐫??(PurchaseSettlement) ?앹꽦
    const settlementId = db.generateNextId('purchaseSettlements', db.purchaseSettlements);
    const settlement = db.insertRow<PurchaseSettlement>('purchaseSettlements', {
      id: settlementId,
      settlementYm,
      settlementType: 'CONSUMABLE',
      vendorName: req.sellerName || '?뚮え??怨듦툒泥?,
      totalAmount,
      paidAmount: 0,
      status: 'CONFIRMED',
      confirmedAt: nowIso,
      confirmedBy: currentUser?.name || req.requesterName || '援щℓ?좎껌??,
      itemCount: 1,
      memo: `[?뚮え??援щℓ?꾧껐] ${req.modelName} ${effectiveQty}媛?(?좎껌?? ${req.requesterName || currentUser?.name || '?대떦??})`,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // 2. ?붾쭚 留ㅼ엯 ?뺤궛 1:1 ?곸꽭 ??ぉ (PurchaseSettlementItem) ?앹꽦
    const settlementItemId = db.generateNextId('purchaseSettlementItems', db.purchaseSettlementItems);
    db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
      id: settlementItemId,
      settlementId: settlement.id,
      sourceType: 'CONSUMABLE_PURCHASE',
      sourceId: req.id,
      itemDescription: `${req.modelName} 횞 ${effectiveQty}媛?(${req.requestDate || todayStr})`,
      quantity: effectiveQty,
      unitPrice: req.unitPrice || 0,
      amount: totalAmount,
      evidenceFileUrl: req.statementFileUrl || undefined,
      createdAt: nowIso
    });

    // 3. ?뚮え??援щℓ?좎껌 ?꾧껐 ?곹깭 諛??곌퀎 ?뺤궛 ID ?낅뜲?댄듃
    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      status: 'COMPLETED',
      completedDate: todayStr,
      completerName: currentUser?.name || '援щℓ?좎껌??,
      settlementId: settlement.id,
      updatedAt: nowIso
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const inboundConsumablePurchase = async (id: string, qty: number, statementFileUrl: string) => {
    const req = db.consumablePurchases.find(p => p.id === id);
    if (!req) return;

    const nextReceivedQty = req.receivedQty + qty;

    db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
      receivedQty: nextReceivedQty,
      statementFileUrl,
      inbounderName: currentUser?.name || '?쒖뒪??,
      updatedAt: new Date().toISOString()
    });

    let consumable = req.consumableId ? db.consumables.find(c => c.id === req.consumableId) : null;
    if (!consumable) {
      consumable = db.consumables.find(c => c.modelName.replace(/\s/g, '') === req.modelName.replace(/\s/g, '')) || null;
    }

    if (consumable) {
      db.updateRow<Consumable>('consumables', consumable.id, {
        stockQty: consumable.stockQty + qty,
        unitPrice: req.unitPrice,
        supplier: req.sellerName,
        updatedAt: new Date().toISOString()
      });
    } else {
      consumable = db.insertRow<Consumable>('consumables', {
        modelName: req.modelName,
        stockQty: qty,
        unit: '媛?,
        unitPrice: req.unitPrice,
        supplier: req.sellerName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      // ?좑툘 FK(Foreign Key) ?꾨컲 諛⑹?: consumables 留덉뒪???앹꽦???먭꺽 DB??癒쇱? 諛섏쁺?섎룄濡?1李??숆린 ?湲?
      try {
        await db.awaitPendingWrites();
      } catch (e) {
        console.warn('Consumable insert pending write warning:', e);
      }
      db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, {
        consumableId: consumable.id
      });
    }

    db.insertRow<ConsumableLog>('consumableLogs', {
      consumableId: consumable.id,
      type: 'INBOUND',
      quantity: qty,
      unitPrice: req.unitPrice,
      supplier: req.sellerName,
      userId: getValidUserId(currentUser?.id),
      actionDate: new Date().toISOString().split('T')[0],
      description: `援щℓ?좎껌 ?곌퀎 ?낃퀬 (利앸튃: ${statementFileUrl.split('/').pop()})`,
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  // 利앸튃 ?뚯씪 Storage ??젣 ??DB URL 珥덇린??
  const clearEvidenceFileUrls = async (ids: string[]): Promise<void> => {
    for (const id of ids) {
      db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, { statementFileUrl: '' });
    }
    await db.awaitPendingWrites();
    refreshAllData();
  };

  // Storage ??젣 ??Drive URL濡?援먯껜
  const updateEvidenceFileUrls = async (updates: { id: string; url: string }[]): Promise<void> => {
    for (const { id, url } of updates) {
      db.updateRow<ConsumablePurchaseRequest>('consumablePurchases', id, { statementFileUrl: url });
    }
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const createContract = async (contractData: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'contractNo'>, assetsList: { assetId?: string; expectedModel?: string; monthlyRentalFee: number; dailyRentalFee: number }[]): Promise<Contract> => {
    const customer = db.customers.find(c => c.id === contractData.customerId);
    if (customer && customer.transactionStatus === 'BLOCKED') {
      showErrorModal('?좑툘 ?대떦 怨좉컼?щ뒗 [嫄곕옒遺덇?] ?곹깭濡??ㅼ젙?섏뼱 ?덉뼱 ?좉퇋 怨꾩빟 ?깅줉??遺덇??ν빀?덈떎.', '怨꾩빟 ?깅줉 ?쒗븳');
      throw new Error('嫄곕옒 遺덇? 怨좉컼?ъ엯?덈떎.');
    }

    const contractNo = generateNextContractNo(contractData.startDate);
    
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

    // ?좑툘 ?몃옒??Foreign Key) ?쒖빟議곌굔 ?꾨컲 諛⑹?: contract媛 Supabase ?먭꺽 DB??癒쇱? 100% ?앹꽦?섎룄濡?1李??숆린 ?湲?
    try {
      await db.awaitPendingWrites();
    } catch (err: any) {
      console.error('Supabase contract insert sync error in saveContract:', err);
      throw err;
    }

    const nowIso = new Date().toISOString();
    assetsList.forEach(item => {
      const insertedCA = db.insertRow<ContractAsset>('contractAssets', {
        contractId: contract.id,
        assetId: item.assetId || undefined,
        expectedModel: item.expectedModel || undefined,
        monthlyRentalFee: item.monthlyRentalFee,
        dailyRentalFee: item.dailyRentalFee,
        startDate: contractData.startDate,
        endDate: contractData.endDate,
        createdAt: nowIso
      });

      if (item.assetId) {
        db.updateRow<Asset>('assets', item.assetId, {
          // ?뮕 ?뚯옣 1.3 以?? 怨꾩빟 泥닿껐 ?쒖젏?먮뒗 RENTED(??ъ쨷)濡?蹂寃쏀븯吏 ?딄퀬 ASSIGNED(異쒓퀬?湲? ?좎?, 異쒓퀬 寃???뱀씤 留덇컧 ?쒖젏??RENTED濡??꾩씠??
          status: 'ASSIGNED',
          currentCustomerId: contractData.customerId,
          currentSiteId: contractData.siteId,
          contractStart: contractData.startDate,
          contractEnd: contractData.endDate,
          monthlyRentalFee: item.monthlyRentalFee,
          dailyRentalFee: item.dailyRentalFee,
          updatedAt: nowIso
        });
        // ??怨좎븘 ?덉퐫??諛⑹?: assetId媛 ?덈뒗 ?щ’ ?앹꽦 ??異쒓퀬寃???섎ː ?먮룞 ?곕룞 ?앹꽦
        db.insertRow<OutboundInspection>('outboundInspections', {
          contractId: contract.id,
          contractAssetId: insertedCA.id,
          assetId: item.assetId,
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }
    });

    db.insertRow<ContractHistory>({
      contractId: contract.id,
      changeType: 'REGISTER',
      changeDate: new Date().toISOString().split('T')[0],
      newEndDate: contractData.endDate,
      description: '怨꾩빟 ?좉퇋 ?깅줉',
      createdAt: new Date().toISOString()
    });

    const today = new Date().toISOString().split('T')[0];
    db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
      type: 'OUTBOUND',
      dispatchCategory: '異쒓퀬',
      status: 'REQUESTED',
      requestDate: today,
      loadingDate: today,
      loadingTimeSlot: '?ㅼ쟾',
      unloadingDate: today,
      unloadingTimeSlot: '?ㅼ쟾',
      deliveryCost: 0,
      isCostSettled: false,
      memo: '?좉퇋 怨꾩빟 泥닿껐???곕Ⅸ 異쒓퀬 ?섎ː',
      closingMemo: '異쒓퀬 ?뚯씠?꾨씪???먮룞 吏?쒓굔',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
    return contract;
  };

  const extendContract = async (contractId: string, newEndDate: string, description: string) => {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) {
      showErrorModal('怨꾩빟 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.');
      return;
    }
    if (!newEndDate) {
      showErrorModal('?곗옣 醫낅즺?쇱쓣 ?낅젰?섏떗?쒖삤.');
      return;
    }
    if (contract.startDate && newEndDate < contract.startDate) {
      showErrorModal(`?곗옣 醫낅즺??${newEndDate})? 怨꾩빟 ?쒖옉??${contract.startDate}) ?댄썑?ъ빞 ?⑸땲??`);
      return;
    }

    const prevEnd = contract.endDate;

    db.updateRow<Contract>('contracts', contractId, {
      endDate: newEndDate,
      status: 'EXTENDED',
      updatedAt: new Date().toISOString()
    });

    const cAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    cAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: newEndDate });
      if (ca.assetId) {
        db.updateRow<Asset>('assets', ca.assetId, {
          contractEnd: newEndDate,
          updatedAt: new Date().toISOString()
        });
      }
    });

    db.insertRow<ContractHistory>({
      contractId,
      changeType: 'EXTEND',
      changeDate: new Date().toISOString().split('T')[0],
      prevEndDate: prevEnd,
      newEndDate,
      description: `怨꾩빟 ?곗옣 泥섎━: ${description}`,
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const shortenContract = async (contractId: string, newEndDate: string, description: string) => {
    const contract = db.contracts.find(c => c.id === contractId);
    if (!contract) {
      showErrorModal('怨꾩빟 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.');
      return;
    }
    if (!newEndDate) {
      showErrorModal('?⑥텞 醫낅즺?쇱쓣 ?낅젰?섏떗?쒖삤.');
      return;
    }
    if (contract.startDate && newEndDate < contract.startDate) {
      showErrorModal(`?⑥텞 醫낅즺??${newEndDate})? 怨꾩빟 ?쒖옉??${contract.startDate}) ?댄썑?ъ빞 ?⑸땲??`);
      return;
    }

    const prevEnd = contract.endDate;

    db.updateRow<Contract>('contracts', contractId, {
      endDate: newEndDate,
      status: 'SHORTENED',
      updatedAt: new Date().toISOString()
    });

    const cAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    cAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: newEndDate });
      if (ca.assetId) {
        db.updateRow<Asset>('assets', ca.assetId, {
          contractEnd: newEndDate,
          updatedAt: new Date().toISOString()
        });
      }
    });

    db.insertRow<ContractHistory>({
      contractId,
      changeType: 'SHORTEN',
      changeDate: new Date().toISOString().split('T')[0],
      prevEndDate: prevEnd,
      newEndDate,
      description: `怨꾩빟 ?⑥텞 泥섎━: ${description}`,
      createdAt: new Date().toISOString()
    });

    db.insertRow<Delivery>('deliveries', {
      contractId: contract.id,
      type: 'INBOUND',
      status: 'REQUESTED',
      requestDate: new Date().toISOString().split('T')[0],
      scheduledDate: newEndDate,
      deliveryCost: 0,
      isCostSettled: false,
      memo: '怨꾩빟 議곌린 ?⑥텞/留뚮즺???곕Ⅸ ?뚯닔 ?섎ː',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const succeedContract = async (contractId: string, successorCustomerId: string, successorContactId: string, successorSiteId: string, successionDate: string, description: string, selectedAssetIds?: string[]) => {
    const oldContract = db.contracts.find(c => c.id === contractId);
    if (!oldContract) {
      showErrorModal('?밴퀎 ???怨꾩빟??李얠쓣 ???놁뒿?덈떎.');
      return;
    }
    if (!successionDate) {
      showErrorModal('?밴퀎?쇱옄瑜??낅젰?섏떗?쒖삤.');
      return;
    }
    if (oldContract.startDate && successionDate < oldContract.startDate) {
      showErrorModal(`?밴퀎?쇱옄(${successionDate})??湲곗〈 怨꾩빟 ?쒖옉??${oldContract.startDate}) ?댄썑?ъ빞 ?⑸땲??`);
      return;
    }
    if (oldContract.endDate && oldContract.endDate !== '誘몄젙' && successionDate > oldContract.endDate) {
      showErrorModal(`?밴퀎?쇱옄(${successionDate})??湲곗〈 怨꾩빟 留뚮즺??${oldContract.endDate}) ?댁쟾?댁뼱???⑸땲??`);
      return;
    }

    const successorCust = db.customers.find(c => c.id === successorCustomerId);
    if (successorCust?.transactionStatus === 'BLOCKED') {
      showErrorModal(`?몄닔 怨좉컼??${successorCust.name})??嫄곕옒?쒗븳(異쒓퀬李⑤떒) ?곹깭?대?濡?怨꾩빟???밴퀎?????놁뒿?덈떎.`);
      return;
    }

    const oldEndDate = oldContract.endDate;
    
    const allCAssets = db.contractAssets.filter(ca => ca.contractId === contractId);
    // Feature 5: selectedAssetIds媛 吏?뺣맂 寃쎌슦 ?좏깮???먯궛留??밴퀎, ?놁쑝硫??꾩껜
    const assetsToSucceed = selectedAssetIds && selectedAssetIds.length > 0
      ? allCAssets.filter(ca => selectedAssetIds.includes(ca.id))
      : allCAssets;
    const assetsToRetain = selectedAssetIds && selectedAssetIds.length > 0
      ? allCAssets.filter(ca => !selectedAssetIds.includes(ca.id))
      : [];

    const nowIsoForUpdate = new Date().toISOString();

    // ?꾩껜 ?밴퀎 ????怨꾩빟 ?⑥텞, 遺遺??밴퀎 ???붿뿬 ?먯궛 湲곗? maxRemainingEndDate 怨꾩궛
    if (assetsToRetain.length === 0) {
      db.updateRow<Contract>('contracts', contractId, {
        endDate: successionDate,
        status: 'SHORTENED',
        updatedAt: nowIsoForUpdate
      });
    } else {
      const hasUndefinedOrMijeong = assetsToRetain.some(ca => !ca.endDate || ca.endDate === '誘몄젙');
      let maxRemainingEndDate = '誘몄젙';
      if (!hasUndefinedOrMijeong) {
        maxRemainingEndDate = assetsToRetain.map(ca => ca.endDate).filter(Boolean).sort().pop() || '誘몄젙';
      }
      db.updateRow<Contract>('contracts', contractId, {
        endDate: maxRemainingEndDate,
        updatedAt: nowIsoForUpdate
      });
    }

    const oldCAssets = assetsToSucceed;
    oldCAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: successionDate });
    });

    db.insertRow<ContractHistory>({
      contractId,
      changeType: 'SHORTEN',
      changeDate: successionDate,
      prevEndDate: oldEndDate,
      newEndDate: successionDate,
      description: assetsToRetain.length > 0
        ? `怨꾩빟 遺遺??밴퀎 ?댁쟾 (${assetsToSucceed.length}? ?밴퀎, ${assetsToRetain.length}? ?붾쪟)`
        : `怨꾩빟 ?밴퀎 ?댁쟾(? 怨좉컼 ?몄닔)???곕Ⅸ ?⑥텞 ?꾨즺`,
      createdAt: new Date().toISOString()
    });

    const oldCustomer = db.customers.find(cust => cust.id === oldContract.customerId);
    const oldCustomerName = oldCustomer ? oldCustomer.name : '-';

    const nextDay = new Date(new Date(successionDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // ?뮕 [?⑥씪 怨꾩빟 ?먯튃 以?? ?묒닔 怨좉컼??+ ?대떦 ?꾩옣??湲곗〈 ?쒖꽦 怨꾩빟 ?먯깋
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
      // 留뚯빟 ?밴퀎 ????먯궛??醫낅즺?쇱씠 湲곗〈 怨꾩빟 留뚮즺?쇰낫??湲몃떎硫?遺紐?怨꾩빟 留뚮즺???숈쟻 ?뺤옣
      const currentTargetEnd = targetContract.endDate;
      if (currentTargetEnd && oldEndDate && (currentTargetEnd === '誘몄젙' || oldEndDate > currentTargetEnd)) {
        db.updateRow<Contract>('contracts', targetContract.id, {
          endDate: oldEndDate,
          updatedAt: new Date().toISOString()
        });
      }
    } else {
      const newContractNo = generateNextContractNo(nextDay);
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
        lateInterestRate: oldContract.lateInterestRate || 0,
        salespersonId: oldContract.salespersonId,
        status: 'ACTIVE',
        predecessorContractId: oldContract.id,
        predecessorContractNo: oldContract.contractNo,
        predecessorCustomerId: oldContract.customerId,
        predecessorCustomerName: oldCustomerName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      // ?좑툘 ?몃옒???쒖빟議곌굔 諛⑹?: contract媛 Supabase???앹꽦?섎룄濡??湲?
      await db.awaitPendingWrites();
    }

    // ?꾩껜 ?밴퀎 ?쒖뿉留???怨꾩빟??SUCCEEDED濡?mark (遺遺??밴퀎 ????怨꾩빟 ACTIVE ?좎?)
    if (assetsToRetain.length === 0) {
      db.updateRow<Contract>('contracts', contractId, {
        successorContractId: targetContract.id,
        status: 'SUCCEEDED'
      });
    } else {
      db.updateRow<Contract>('contracts', contractId, {
        successorContractId: targetContract.id
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
        endDate: oldEndDate,
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

        // ??怨좎븘 ?덉퐫??諛⑹?: ASSIGNED(異쒓퀬?湲? ?곹깭 ?먯궛 ?밴퀎 ???좉퇋 怨꾩빟 湲곗? 異쒓퀬寃???섎ː ?앹꽦
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

    db.insertRow<ContractHistory>({
      contractId: targetContract.id,
      changeType: 'REGISTER',
      changeDate: successionDate,
      newEndDate: oldEndDate,
      description: isTargetExisting
        ? `怨꾩빟 ?밴퀎 湲곗〈怨꾩빟 ?몄엯 ?꾨즺 (?댁쟾 怨꾩빟踰덊샇: ${oldContract.contractNo}): ${description}`
        : `怨꾩빟 ?밴퀎 ?좉퇋怨꾩빟 ?몄닔 ?꾨즺 (?댁쟾 怨꾩빟踰덊샇: ${oldContract.contractNo}): ${description}`,
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  // Feature 6) ?숈씪 怨좉컼 ?꾩옣媛??λ퉬 ?대룞 (Site Transfer / Relocation)
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
      showErrorModal('?대룞 ???泥닿껐 ?먯궛 ?щ’??李얠쓣 ???놁뒿?덈떎.');
      return;
    }

    const sourceContract = db.contracts.find(c => c.id === sourceCA.contractId);
    if (!sourceContract) {
      showErrorModal('??怨꾩빟 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.');
      return;
    }

    if (sourceContract.siteId === targetSiteId) {
      showErrorModal('?꾩옱 ?꾩옣怨??숈씪???꾩옣?쇰줈???대룞?????놁뒿?덈떎.');
      return;
    }

    if (!relocationDate) {
      showErrorModal('?꾩옣 ?대룞 ?쇱옄瑜??낅젰?섏떗?쒖삤.');
      return;
    }

    if (sourceCA.startDate && relocationDate < sourceCA.startDate) {
      showErrorModal(`?대룞?쇱옄(${relocationDate})???λ퉬 怨꾩빟 ?쒖옉??${sourceCA.startDate}) ?댄썑?ъ빞 ?⑸땲??`);
      return;
    }

    const asset = sourceCA.assetId ? db.assets.find(a => a.id === sourceCA.assetId) : null;
    const assetNo = asset?.assetNo || '?λ퉬';
    const modelName = asset?.modelName || sourceCA.expectedModel || '怨좎냼?묒뾽?';
    const sourceSite = db.sites.find(s => s.id === sourceContract.siteId);
    const targetSite = db.sites.find(s => s.id === targetSiteId);
    const sourceSiteName = sourceSite?.name || '1?꾩옣';
    const targetSiteName = targetSite?.name || '2?꾩옣';
    const oldEndDate = sourceCA.endDate;

    const nowIso = new Date().toISOString();

    // 0. ?좎쭨 蹂댁〈: 1?꾩옣? ?대룞???뱀씪源뚯? 泥?뎄(醫낅즺), 2?꾩옣? ?대룞 ?ㅼ쓬 ?좊???媛쒖떆 (??씪 怨듬갚/以묐났 0??
    const getNextDate = (dStr: string): string => {
      const d = new Date(dStr);
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    };
    const relocationStartDate = getNextDate(relocationDate);

    // 1. 1?꾩옣(異쒕컻 怨꾩빟): ?대떦 contractAsset??endDate瑜?relocationDate濡??⑥텞 留덇컧
    db.updateRow<ContractAsset>('contractAssets', sourceCA.id, {
      endDate: relocationDate
    });

    // 1?꾩옣 怨꾩빟 ?대젰??[?꾩옣 ?대룞 異쒓퀬] 湲곕줉
    db.insertRow<ContractHistory>({
      contractId: sourceContract.id,
      changeType: 'SHORTEN',
      changeDate: relocationDate,
      prevEndDate: oldEndDate,
      newEndDate: relocationDate,
      description: `?λ퉬 [${assetNo} / ${modelName}] ?꾩옣媛??대룞 異쒓퀬 (?꾩갑吏: ${targetSiteName}, ?대룞?? ${relocationDate})${reason ? ' - ?ъ쑀: ' + reason : ''}`,
      createdAt: nowIso
    });

    // 1?꾩옣???ㅻⅨ ?쒖꽦 ?먯궛 ?붿뿬 ?щ? 寃??(?⑥씪 ?λ퉬 怨꾩빟 ??遺紐?怨꾩빟 COMPLETED 醫낃껐 泥섎━)
    const remainingSourceCAs = db.contractAssets.filter(ca =>
      ca.contractId === sourceContract.id &&
      ca.id !== sourceCA.id &&
      (!ca.endDate || ca.endDate > relocationDate)
    );

    if (remainingSourceCAs.length === 0) {
      db.updateRow<Contract>('contracts', sourceContract.id, {
        status: 'COMPLETED',
        endDate: relocationDate,
        updatedAt: nowIso
      });
    } else {
      const maxRemainingEndDate = remainingSourceCAs.map(ca => ca.endDate).filter(Boolean).sort().pop();
      if (maxRemainingEndDate && sourceContract.endDate !== maxRemainingEndDate) {
        db.updateRow<Contract>('contracts', sourceContract.id, {
          endDate: maxRemainingEndDate,
          updatedAt: nowIso
        });
      }
    }

    // 2. 2?꾩옣(?꾩갑 怨꾩빟): ?숈씪 怨좉컼 + targetSiteId???쒖꽦 怨꾩빟 ?먯깋
    const existingTargetContract = db.contracts.find(c =>
      c.customerId === sourceContract.customerId &&
      c.siteId === targetSiteId &&
      (c.status === 'ACTIVE' || c.status === 'EXTENDED')
    );

    let destinationContract: Contract;
    let isNewDestinationContract = false;

    if (existingTargetContract) {
      destinationContract = existingTargetContract;
      // 遺紐?怨꾩빟 留뚮즺?쇱씠 ?댁쟾???먯궛蹂대떎 吏㏃쑝硫??뺤옣
      if (oldEndDate && destinationContract.endDate && destinationContract.endDate !== '誘몄젙' && oldEndDate > destinationContract.endDate) {
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
        contactId: sourceContract.contactId,
        siteId: targetSiteId,
        startDate: relocationStartDate,
        endDate: oldEndDate,
        billingDay: sourceContract.billingDay,
        statementClosingDay: sourceContract.statementClosingDay,
        paymentDueDay: sourceContract.paymentDueDay,
        lateInterestRate: sourceContract.lateInterestRate || 0,
        salespersonId: sourceContract.salespersonId,
        status: 'ACTIVE',
        predecessorContractId: sourceContract.id,
        predecessorContractNo: sourceContract.contractNo,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      // ?좑툘 ?몃옒???쒖빟議곌굔 諛⑹?: contract媛 Supabase???앹꽦?섎룄濡??湲?
      await db.awaitPendingWrites();
    }

    // 3. 2?꾩옣 怨꾩빟??contractAssets ?щ’ ?좉퇋 ?쎌엯 (?대룞 ?듭씪遺???쒖옉, ?④? 諛?議곌굔 100% ?먮룞 ?곸냽 - ?뚯옣 2.2)
    db.insertRow<ContractAsset>('contractAssets', {
      contractId: destinationContract.id,
      assetId: sourceCA.assetId,
      monthlyRentalFee: sourceCA.monthlyRentalFee,
      dailyRentalFee: sourceCA.dailyRentalFee,
      startDate: relocationStartDate,
      endDate: oldEndDate,
      createdAt: nowIso
    });

    // 4. 2?꾩옣 怨꾩빟 ?대젰??[?꾩옣 ?대룞 ?꾩엯] 湲곕줉
    db.insertRow<ContractHistory>({
      contractId: destinationContract.id,
      changeType: 'REGISTER',
      changeDate: relocationStartDate,
      newEndDate: oldEndDate,
      description: isNewDestinationContract
        ? `?좉퇋 怨꾩빟 ?앹꽦 - ?꾩옣 ?대룞 ?꾩엯 (異쒕컻吏: ${sourceSiteName}, ?댁쟾 怨꾩빟: ${sourceContract.contractNo}, ?λ퉬: ${assetNo})`
        : `湲곗〈 怨꾩빟 ?몄엯 - ?꾩옣 ?대룞 ?꾩엯 (異쒕컻吏: ${sourceSiteName}, ?댁쟾 怨꾩빟: ${sourceContract.contractNo}, ?λ퉬: ${assetNo})`,
      createdAt: nowIso
    });

    // 5. ?먯궛 留덉뒪??(assets): currentSiteId 2?꾩옣?쇰줈 ?숆린??& contractEnd 媛깆떊
    if (sourceCA.assetId) {
      db.updateRow<Asset>('assets', sourceCA.assetId, {
        currentSiteId: targetSiteId,
        contractStart: relocationStartDate,
        contractEnd: oldEndDate,
        updatedAt: nowIso
      });
    }

    // 6. 諛곗감 ?쒖뒪???곕룞 (needTransport媛 true??寃쎌슦 諛곗감 ?먮룞 諛쒗뻾)
    if (needTransport) {
      const deliveryId = `DEL-${relocationDate.replace(/-/g, '').slice(2)}-${Math.floor(100 + Math.random() * 900)}`;
      const cost = transportCost || 0;
      const isCustPaid = paidBy === 'CUSTOMER';

      db.insertRow<Delivery>('deliveries', {
        id: deliveryId,
        type: 'MOVEMENT',
        dispatchCategory: '?대룞',
        status: 'REQUESTED',
        contractId: destinationContract.id,
        assetIds: sourceCA.assetId || '',
        requestDate: relocationDate,
        scheduledDate: relocationDate,
        loadingDate: relocationDate,
        loadingTimeSlot: '?ㅼ쟾',
        unloadingDate: relocationDate,
        unloadingTimeSlot: '?ㅽ썑',
        originAddress: sourceSite?.address || `${sourceSiteName} (1?꾩옣)`,
        pickupType: 'HQ_YARD',
        destinationAddress: targetSite?.address || `${targetSiteName} (2?꾩옣)`,
        dropoffType: 'SINGLE',
        deliveryCost: cost,
        expectedCost: cost,
        finalCost: cost,
        billableToCustomer: isCustPaid,
        billableCustomerId: isCustPaid ? sourceContract.customerId : undefined,
        isCostSettled: false,
        memo: `[?꾩옣媛??λ퉬 ?대룞] ${sourceSiteName} ??${targetSiteName} (${assetNo} / ${modelName})${reason ? ' | ?ъ쑀: ' + reason : ''}`,
        cargoItems: JSON.stringify([{ modelName, count: 1 }]),
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  /**
   * [?뚯옣 1.2 & 2.2] ?섎━ ?꾨즺 ?λ퉬 ?숈씪 怨꾩빟 ?ы닾??(?뚯닔 ???섎━ ?ъ텧怨?
   * - ?섎굹??怨꾩빟???좎??섎뒗 ?곹솴?먯꽌 怨좎옣 ?뚯닔???숈씪 ?λ퉬瑜??섎━ ?꾨즺 ???숈씪 怨꾩빟???ъ텧怨?
   * - 1李??щ’(?⑥텞 留덇컧) ???섎━ 怨듬갚(臾닿낵湲?蹂댁〈) ??2李??좉퇋 ?щ’(?ы닾?낆씪 媛쒖떆)?쇰줈 遺꾨━ ?몄엯
   * - 怨꾩빟? 遺꾪븷 ?앹꽦?섏? ?딄퀬 湲곗〈 怨꾩빟 ?좎?
   * - ?먯궛 ?곹깭 RENTED ?꾪솚 諛?OUTBOUND 諛곗감 1嫄??먮룞 諛쒗뻾
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
      showErrorModal('?ы닾?????怨꾩빟??李얠쓣 ???놁뒿?덈떎.');
      return;
    }

    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) {
      showErrorModal('?ы닾??????λ퉬瑜?李얠쓣 ???놁뒿?덈떎.');
      return;
    }

    const nowIso = new Date().toISOString();

    // 1. ?④? ?먮룞 ?곸냽: ?대떦 怨꾩빟 ???숈씪 ?λ퉬???댁쟾 ?щ’ ?④? ?먮뒗 ?먯궛 湲곕낯 ?④?
    const prevCA = db.contractAssets.find(ca => ca.contractId === contractId && ca.assetId === assetId);
    const feeMonth = monthlyRentalFee !== undefined ? monthlyRentalFee : (prevCA?.monthlyRentalFee || 600000);
    const feeDay = dailyRentalFee !== undefined ? dailyRentalFee : (prevCA?.dailyRentalFee || Math.round(feeMonth / 30));

    // 2. 留뚮즺??寃곗젙 (遺紐?怨꾩빟 留뚮즺???먮뒗 ?꾨떖諛쏆? 醫낅즺??
    const finalEndDate = expectedEndDate || contract.endDate || '';

    // 3. 遺紐?怨꾩빟 留뚮즺??諛??곹깭 媛깆떊 (醫낅즺 ?곹깭??ㅻ㈃ ACTIVE濡?蹂듭썝 諛?留뚮즺???뺤옣)
    const contractUpdates: Partial<Contract> = {};
    if (contract.status === 'COMPLETED') {
      contractUpdates.status = 'ACTIVE';
    }
    if (finalEndDate && (!contract.endDate || contract.endDate === '誘몄젙' || finalEndDate > contract.endDate)) {
      contractUpdates.endDate = finalEndDate;
    }
    if (Object.keys(contractUpdates).length > 0) {
      db.updateRow<Contract>('contracts', contract.id, {
        ...contractUpdates,
        updatedAt: nowIso
      });
    }

    // 4. 怨꾩빟???덈줈???먯궛 ?щ’(2李??댁슜 ?쒖옉) ?쎌엯
    db.insertRow<ContractAsset>('contractAssets', {
      contractId: contract.id,
      assetId: asset.id,
      monthlyRentalFee: feeMonth,
      dailyRentalFee: feeDay,
      startDate: redeployDate,
      endDate: finalEndDate,
      createdAt: nowIso
    });

    // 5. 怨꾩빟 ?대젰(contractHistory)??[?섎━?꾨즺 ?ы닾?? ADD_ASSET 湲곕줉
    db.insertRow<ContractHistory>({
      contractId: contract.id,
      changeType: 'ADD_ASSET',
      changeDate: redeployDate,
      newEndDate: finalEndDate,
      description: `[?섎━?꾨즺 ?ы닾?? ?λ퉬 [${asset.assetNo} / ${asset.modelName}] ?꾩옣 ?ъ텧怨?(?ш????쒖옉: ${redeployDate})${reason ? ' - ?ъ쑀: ' + reason : ''}`,
      createdAt: nowIso
    });

    // 6. ?먯궛 留덉뒪??(assets): ?곹깭 RENTED ?꾪솚 諛?怨좉컼/?꾩옣/湲곌컙 ?숆린??
    db.updateRow<Asset>('assets', asset.id, {
      status: 'RENTED',
      currentCustomerId: contract.customerId,
      currentSiteId: contract.siteId,
      contractStart: redeployDate,
      contractEnd: finalEndDate,
      updatedAt: nowIso
    });

    // 7. 諛곗감 ?쒖뒪???곕룞: OUTBOUND 諛곗감 1嫄??먮룞 諛쒗뻾
    if (needTransport) {
      const site = db.sites.find(s => s.id === contract.siteId);
      const deliveryId = `DEL-RED-${redeployDate.replace(/-/g, '').slice(2)}-${Math.floor(100 + Math.random() * 900)}`;
      const isCustPaid = paidBy === 'CUSTOMER';

      db.insertRow<Delivery>('deliveries', {
        id: deliveryId,
        type: 'OUTBOUND',
        dispatchCategory: '異쒓퀬',
        status: 'REQUESTED',
        contractId: contract.id,
        assetIds: asset.id,
        requestDate: redeployDate,
        scheduledDate: redeployDate,
        loadingDate: redeployDate,
        loadingTimeSlot: '?ㅼ쟾',
        unloadingDate: redeployDate,
        unloadingTimeSlot: '?ㅽ썑',
        originAddress: '?뱀궗 蹂닿???,
        pickupType: 'HQ_YARD',
        destinationAddress: site?.address || site?.name || '?꾩옣',
        dropoffType: 'SINGLE',
        deliveryCost: transportCost,
        expectedCost: transportCost,
        finalCost: transportCost,
        billableToCustomer: isCustPaid,
        billableCustomerId: isCustPaid ? contract.customerId : undefined,
        isCostSettled: false,
        memo: `[?섎━?꾨즺 ?ы닾??諛곗감] ${asset.assetNo} (${asset.modelName}) ??${site?.name || '?꾩옣'}${reason ? ' | ?ъ쑀: ' + reason : ''}`,
        cargoItems: JSON.stringify([{ modelName: asset.modelName, count: 1 }]),
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  // Feature 4) 媛쒕퀎 ContractAsset 湲곌컙 ?섏젙 (遺遺??곗옣 / 遺遺??⑥텞)
  const updateContractAssetPeriod = async (caId: string, startDate: string, endDate: string, reason: string) => {
    const ca = db.contractAssets.find(c => c.id === caId);
    if (!ca) {
      showErrorModal('?섏젙 ????먯궛 怨꾩빟??李얠쓣 ???놁뒿?덈떎.');
      return;
    }
    if (endDate < startDate) {
      showErrorModal('醫낅즺?쇱? ?쒖옉???댄썑?ъ빞 ?⑸땲??');
      return;
    }

    const prevEnd = ca.endDate;
    const isExtension = prevEnd && endDate > prevEnd;
    const isShortening = prevEnd && endDate < prevEnd;

    // 1. 媛쒕퀎 怨꾩빟 ?먯궛 ?щ’ 湲곌컙 媛깆떊
    db.updateRow<ContractAsset>('contractAssets', caId, {
      startDate,
      endDate,
      updatedAt: new Date().toISOString()
    });

    // 2. ?먯궛 留덉뒪?곗쓽 contractEnd ?숆린??(?뚯옣 1.2: ?먯궛 ?④낵???댁슜)
    if (ca.assetId) {
      db.updateRow<Asset>('assets', ca.assetId, {
        contractEnd: endDate,
        updatedAt: new Date().toISOString()
      });
    }

    // 3. 遺紐?怨꾩빟???꾩껜 湲곌컙 諛??곹깭 ?숆린 蹂댁젙 (???먯튃: ?먯궛?ㅼ쓽 ?⑹쭛??援ш컙 ?먮룞 ?뺤옣)
    const parentContract = db.contracts.find(c => c.id === ca.contractId);
    if (parentContract) {
      const siblingCAs = db.contractAssets.filter(item => item.contractId === ca.contractId && item.id !== caId);
      const allEndDates = [endDate, ...siblingCAs.map(item => item.endDate).filter(Boolean)];
      const maxEndDate = allEndDates.reduce((max, cur) => (cur > max ? cur : max), endDate);
      const allStartDates = [startDate, ...siblingCAs.map(item => item.startDate).filter(Boolean)];
      const minStartDate = allStartDates.reduce((min, cur) => (cur < min ? cur : min), startDate);

      db.updateRow<Contract>('contracts', parentContract.id, {
        startDate: minStartDate,
        endDate: maxEndDate,
        status: isExtension ? 'EXTENDED' : isShortening ? 'SHORTENED' : parentContract.status,
        updatedAt: new Date().toISOString()
      });
    }

    // 4. ?대젰 ???
    db.insertRow<ContractHistory>({
      contractId: ca.contractId,
      changeType: isExtension ? 'EXTEND' : isShortening ? 'SHORTEN' : 'ASSET_PERIOD_CHANGE',
      changeDate: new Date().toISOString().split('T')[0],
      prevEndDate: prevEnd,
      newEndDate: endDate,
      description: `[遺遺?${isExtension ? '?곗옣' : isShortening ? '?⑥텞' : '湲곌컙蹂寃?}] ?먯궛(${ca.assetId || ca.expectedModel}) 湲곌컙 議곗젙: ${startDate} ~ ${endDate}${reason ? ` (?ъ쑀: ${reason})` : ''}`,
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const assignAssetToContract = async (contractAssetId: string, assetId: string) => {
    // ?뮕 1. 濡ㅻ갚???먮낯 ?ㅻ깄??諛깆뾽
    const origCa = db.contractAssets.find(c => c.id === contractAssetId);
    const caSnapshot = origCa ? { ...origCa } : null;

    const origAsset = db.assets.find(a => a.id === assetId);
    const assetSnapshot = origAsset ? { ...origAsset } : null;

    let createdInspectionId: string | null = null;

    try {
      if (!origCa) throw new Error('?대떦 怨꾩빟 ?щ’(contractAsset)??李얠쓣 ???놁뒿?덈떎.');

      let contract = db.contracts.find(c => c.id === origCa.contractId);
      if (!contract && db.isSupabaseConnected()) {
        try {
          await db.pullTableFromSupabase('contracts');
          contract = db.contracts.find(c => c.id === origCa.contractId);
        } catch (e) {}
      }

      if (!origAsset) throw new Error('?좊떦??????λ퉬瑜?李얠쓣 ???놁뒿?덈떎.');

      const nowIso = new Date().toISOString();

      // 1. ContractAsset ?낅뜲?댄듃 (?ㅻЪ ?λ퉬 ID ?좊떦, 湲곗〈 怨꾩빟??expectedModel 蹂댁〈)
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, {
        assetId: assetId,
        expectedModel: origCa.expectedModel || origAsset?.modelName
      });

      // 2. Asset ?곹깭 ?낅뜲?댄듃 (ASSIGNED 異쒓퀬?湲곕줈 ?꾪솚)
      const assetUpdatePayload: Partial<Asset> = {
        status: 'ASSIGNED',
        updatedAt: nowIso
      };
      if (contract?.customerId) assetUpdatePayload.currentCustomerId = contract.customerId;
      if (contract?.siteId) assetUpdatePayload.currentSiteId = contract.siteId;
      if (contract?.startDate) assetUpdatePayload.contractStart = contract.startDate;
      if (contract?.endDate) assetUpdatePayload.contractEnd = contract.endDate;

      db.updateRow<Asset>('assets', assetId, assetUpdatePayload);

      // 3. 異쒓퀬 寃???뺣퉬 ?묒뾽 ?섎ː ?앹꽦
      const createdInsp = db.insertRow<OutboundInspection>('outboundInspections', {
        contractId: origCa.contractId,
        contractAssetId: origCa.id,
        assetId: assetId,
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso
      });
      createdInspectionId = createdInsp.id;

      // 4. Supabase ?먭꺽 DB ?곌린 100% ?꾧껐 ?숆린 ?湲?(?ㅽ뙣 ??catch 釉붾줉?먯꽌 ?먮룞 濡ㅻ갚!)
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('assignAssetToContract error & Rollback:', err);

      // ?뮙 DB ????ㅽ뙣 ??濡쒖뺄 DB 諛?UI State瑜?100% ?댁쟾 ?곹깭濡??먮룞 濡ㅻ갚 (Rollback Execution)!
      if (caSnapshot) {
        db.updateRow<ContractAsset>('contractAssets', contractAssetId, caSnapshot);
      }
      if (assetSnapshot) {
        db.updateRow<Asset>('assets', assetId, assetSnapshot);
      }
      if (createdInspectionId) {
        db.deleteRow('outboundInspections', createdInspectionId);
      await db.awaitPendingWrites();
      }

      refreshAllData(); // 濡ㅻ갚???먮났 ?곹깭瑜?UI??諛섏쁺!

      const errMsg = err?.message || err?.details || JSON.stringify(err);
      showErrorModal(
        `?좑툘 ?λ퉬 ?좊떦 ???以?DB ?숆린???ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n\n` +
        `??[?덈궡]: ????ㅽ뙣濡??명빐 ?λ퉬 ?좊떦 ?곹깭媛 ?댁쟾 誘명븷???곹깭濡??덉쟾?섍쾶 濡ㅻ갚(?먮룞 ?먮났)?섏뿀?듬땲?? ?좊떦 ???紐⑸줉?먯꽌 怨꾩냽 ?묒뾽?섏떎 ???덉뒿?덈떎.\n\n` +
        `??[?ㅽ뙣 ?먯씤]: ${errMsg}`,
        '?λ퉬 ?좊떦 DB ?숆린???ㅻ쪟 (?먮룞 濡ㅻ갚 ?먮났 ?꾨즺)'
      );
      throw err;
    }
  };

  // ?? ?ㅼ쨷 ?λ퉬 ?먯옄???쇨큵 ?좊떦 ?몃옖??뀡 硫붿냼??(以묎컙 由щ젋?붾쭅 諛??덉씠??而⑤뵒???먯쿇 李⑤떒)
  const batchAssignAssetsToContract = async (pairs: { contractAssetId: string; assetId: string }[]) => {
    if (!pairs || pairs.length === 0) return;

    // 濡ㅻ갚???꾩껜 ?ㅻ깄??以鍮?
    const caSnapshots: { id: string; snapshot: ContractAsset }[] = [];
    const assetSnapshots: { id: string; snapshot: Asset }[] = [];
    const createdInspectionIds: string[] = [];

    const nowIso = new Date().toISOString();

    try {
      // 1. ?ъ쟾 寃利?諛??ㅻ깄??諛깆뾽
      for (const pair of pairs) {
        const origCa = db.contractAssets.find(c => c.id === pair.contractAssetId);
        if (!origCa) throw new Error(`怨꾩빟 ?щ’(${pair.contractAssetId})??李얠쓣 ???놁뒿?덈떎.`);
        caSnapshots.push({ id: origCa.id, snapshot: { ...origCa } });

        const origAsset = db.assets.find(a => a.id === pair.assetId);
        if (!origAsset) throw new Error(`????λ퉬(${pair.assetId})瑜?李얠쓣 ???놁뒿?덈떎.`);
        assetSnapshots.push({ id: origAsset.id, snapshot: { ...origAsset } });
      }

      // 2. ?꾩껜 ?щ’ 諛??먯궛 ?쇨큵 硫붾え由??낅뜲?댄듃 (?⑥씪 ?먯옄??諛곗튂)
      for (const pair of pairs) {
        const origCa = db.contractAssets.find(c => c.id === pair.contractAssetId)!;
        const origAsset = db.assets.find(a => a.id === pair.assetId)!;
        const contract = db.contracts.find(c => c.id === origCa.contractId);

        // 2-1. contractAssets ?낅뜲?댄듃 (湲곗〈 怨꾩빟??expectedModel ?덈? 蹂댁〈)
        db.updateRow<ContractAsset>('contractAssets', origCa.id, {
          assetId: origAsset.id,
          expectedModel: origCa.expectedModel || origAsset.modelName
        });

        // 2-2. assets ?낅뜲?댄듃
        const assetUpdatePayload: Partial<Asset> = {
          status: 'ASSIGNED',
          updatedAt: nowIso
        };
        if (contract?.customerId) assetUpdatePayload.currentCustomerId = contract.customerId;
        if (contract?.siteId) assetUpdatePayload.currentSiteId = contract.siteId;
        if (contract?.startDate) assetUpdatePayload.contractStart = contract.startDate;
        if (contract?.endDate) assetUpdatePayload.contractEnd = contract.endDate;

        db.updateRow<Asset>('assets', origAsset.id, assetUpdatePayload);

        // 2-3. 異쒓퀬 寃???섎ː ?앹꽦
        const createdInsp = db.insertRow<OutboundInspection>('outboundInspections', {
          contractId: origCa.contractId,
          contractAssetId: origCa.id,
          assetId: origAsset.id,
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso
        });
        // 2-4. ?뙚 [?⑦궎吏 ?쒕쪟 臾닿껐??: 湲곗〈 ?щ’???ㅻⅨ ?λ퉬媛 諛곗젙?섏뼱 ?덉뿀?붾뜲 援먯껜??寃쎌슦 ToDo 諛쒗뻾
        if (origCa.assetId && origCa.assetId !== origAsset.id) {
          try {
            await checkAndIssuePackageResendTask({
              contractId: origCa.contractId,
              oldAssetId: origCa.assetId,
              newAssetId: origAsset.id,
              reason: '異쒓퀬 ???λ퉬 ?ы븷??援먯껜',
              senderName: '?λ퉬?좊떦?쒖뒪??
            });
          } catch (taskErr) {
            console.warn('怨꾩빟?쒗뙣?ㅼ? ?щ컻??ToDo 諛쒗뻾 寃쎄퀬 (臾댁떆):', taskErr);
          }
        }
      }

      // 3. ??1?뚯쓽 ?먭꺽 DB ?곌린 ?꾧껐 ?숆린 ?湲?& ??1?뚯쓽 ?꾩뿭 由щ젋?붾쭅!
      await db.awaitPendingWrites();
      refreshAllData();

    } catch (err: any) {
      console.error('batchAssignAssetsToContract error & Rollback:', err);

      // ?뮙 ?쇨큵 濡ㅻ갚
      caSnapshots.forEach(item => {
        db.updateRow<ContractAsset>('contractAssets', item.id, item.snapshot);
      });
      assetSnapshots.forEach(item => {
        db.updateRow<Asset>('assets', item.id, item.snapshot);
      });
      createdInspectionIds.forEach(id => {
        db.deleteRow('outboundInspections', id);
      await db.awaitPendingWrites();
      });

      refreshAllData();

      const errMsg = err?.message || err?.details || JSON.stringify(err);
      showErrorModal(`?좑툘 ?쇨큵 ?λ퉬 ?좊떦 以??ㅻ쪟媛 諛쒖깮?섏뿬 紐⑤뱺 ?묒뾽???덉쟾?섍쾶 ?먮났?섏뿀?듬땲??\n\n${errMsg}`, '?쇨큵 ?λ퉬 ?좊떦 ?ㅽ뙣');
      throw err;
    }
  };

  // ?봽 ?λ퉬 ?좊떦 痍⑥냼 硫붿냼??(異쒓퀬 寃?????щ’ ?좊떦 ?댁젣 諛??λ퉬 AVAILABLE 蹂듭썝)
  const unassignAssetFromContract = async (contractAssetId: string) => {
    const origCa = db.contractAssets.find(c => c.id === contractAssetId);
    if (!origCa || !origCa.assetId) return;

    const origAssetId = origCa.assetId;
    const origAsset = db.assets.find(a => a.id === origAssetId);

    const caSnapshot = { ...origCa };
    const assetSnapshot = origAsset ? { ...origAsset } : null;

    try {
      const nowIso = new Date().toISOString();

      // 1. ContractAsset ?먯꽌 assetId 紐낆떆??NULL ?쒓굅 (Supabase DB 諛섏쁺 蹂댁옣)
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, {
        assetId: null as any
      });

      // 2. Asset ?곹깭瑜?AVAILABLE (?꾨?媛?? 濡?蹂듭썝 諛?怨꾩빟 ?곌껐 紐낆떆??NULL ?댁젣
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

      // 3. ?꾩쭅 ?湲?以?PENDING)??異쒓퀬 寃???섎ː嫄??꾩껜 ??젣
      const pendingInsps = db.outboundInspections.filter(
        i => (i.contractAssetId === contractAssetId || (i.contractId === origCa.contractId && i.assetId === origAssetId)) && i.status === 'PENDING'
      );
      pendingInsps.forEach(i => db.deleteRow('outboundInspections', i.id));

      // 4. ?뙚 [?⑦궎吏 ?쒕쪟 臾닿껐??: 怨꾩빟?쒗뙣?ㅼ? 諛쒖넚 ??異쒓퀬 ???λ퉬 ?좊떦 ?댁젣 ??ToDo ?먮룞 諛쒗뻾
      try {
        await checkAndIssuePackageResendTask({
          contractId: origCa.contractId,
          oldAssetId: origAssetId,
          newAssetId: undefined,
          reason: '異쒓퀬 ???λ퉬 ?좊떦 ?댁젣/痍⑥냼',
          senderName: '?λ퉬?좊떦?쒖뒪??
        });
      } catch (taskErr) {
        console.warn('怨꾩빟?쒗뙣?ㅼ? ?щ컻??ToDo 諛쒗뻾 寃쎄퀬 (臾댁떆):', taskErr);
      }

      // 5. DB ?꾧껐 ?숆린 ?湲?& ?꾩뿭 由щ젋?붾쭅
      await db.awaitPendingWrites();
      refreshAllData();

    } catch (err: any) {
      console.error('unassignAssetFromContract error & Rollback:', err);
      // 濡ㅻ갚
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, caSnapshot);
      if (assetSnapshot && origAssetId) {
        db.updateRow<Asset>('assets', origAssetId, assetSnapshot);
      }
      refreshAllData();

      showErrorModal(`?좑툘 ?λ퉬 ?좊떦 痍⑥냼 以??ㅻ쪟媛 諛쒖깮?섏뿬 ?먮났?섏뿀?듬땲??\n${err?.message || err}`, '?좊떦 痍⑥냼 ?ㅽ뙣');
      throw err;
    }
  };

  // ?봽 ?ㅼ쨷 ?λ퉬 ?먯옄???쇨큵 ?좊떦 痍⑥냼 ?몃옖??뀡 硫붿냼??(以묎컙 由щ젋?붾쭅 諛??덉씠??而⑤뵒???먯쿇 李⑤떒)
  const batchUnassignAssetsFromContract = async (contractAssetIds: string[]) => {
    if (!contractAssetIds || contractAssetIds.length === 0) return;

    const caSnapshots: { id: string; snapshot: ContractAsset }[] = [];
    const assetSnapshots: { id: string; snapshot: Asset }[] = [];
    const deletedInspectionIds: { id: string; row: OutboundInspection }[] = [];

    const nowIso = new Date().toISOString();

    try {
      // 1. ?ъ쟾 寃利?諛??ㅻ깄??諛깆뾽
      for (const caId of contractAssetIds) {
        const origCa = db.contractAssets.find(c => c.id === caId);
        if (origCa && origCa.assetId) {
          caSnapshots.push({ id: origCa.id, snapshot: { ...origCa } });
          const origAsset = db.assets.find(a => a.id === origCa.assetId);
          if (origAsset) {
            assetSnapshots.push({ id: origAsset.id, snapshot: { ...origAsset } });
          }
          const pendingInsp = db.outboundInspections.find(
            i => (i.contractAssetId === caId || (i.contractId === origCa.contractId && i.assetId === origCa.assetId)) && i.status === 'PENDING'
          );
          if (pendingInsp) {
            deletedInspectionIds.push({ id: pendingInsp.id, row: { ...pendingInsp } });
          }
        }
      }

      // 2. ?쇨큵 硫붾え由??낅뜲?댄듃 (?⑥씪 ?먯옄??諛곗튂)
      for (const caId of contractAssetIds) {
        const origCa = db.contractAssets.find(c => c.id === caId);
        if (origCa && origCa.assetId) {
          const origAssetId = origCa.assetId;
          db.updateRow<ContractAsset>('contractAssets', caId, {
            assetId: null as any
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
            i => (i.contractAssetId === caId || (i.contractId === origCa.contractId && i.assetId === origAssetId)) && i.status === 'PENDING'
          );
          pendingInsps.forEach(i => {
            deletedInspectionIds.push({ id: i.id, row: { ...i } });
            db.deleteRow('outboundInspections', i.id);
      await db.awaitPendingWrites();
          });
        }
      }

      // 3. ??1?뚯쓽 ?먭꺽 DB ?곌린 ?꾧껐 ?숆린 ?湲?& ??1?뚯쓽 ?꾩뿭 由щ젋?붾쭅!
      await db.awaitPendingWrites();
      refreshAllData();

    } catch (err: any) {
      console.error('batchUnassignAssetsFromContract error & Rollback:', err);
      // ?뮙 ?쇨큵 濡ㅻ갚
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

      showErrorModal(`?좑툘 ?쇨큵 ?λ퉬 ?좊떦 痍⑥냼 以??ㅻ쪟媛 諛쒖깮?섏뿬 紐⑤뱺 ?묒뾽???덉쟾?섍쾶 ?먮났?섏뿀?듬땲??\n\n${err?.message || err}`, '?쇨큵 ?좊떦 痍⑥냼 ?ㅽ뙣');
      throw err;
    }
  };

  // ?뮕 異쒓퀬 吏꾪뻾 以??λ퉬 援먯껜 諛??섎━?꾪솚 ?몃옖??뀡 硫붿냼??(contractAssetId ?먮뒗 contractId 2以??먮룞異붿쟻 吏??
  const exchangeOutboundAsset = async (
    contractAssetIdOrContractId: string,
    oldAssetId: string,
    newAssetId: string,
    reason?: string,
    markOldAsRepairing: boolean = true,
    customPenaltyScore?: number
  ) => {
    // 濡ㅻ갚???ㅻ깄??以鍮?
    const oldAssetOrig = db.assets.find(a => a.id === oldAssetId);
    const newAssetOrig = db.assets.find(a => a.id === newAssetId);
    
    // contractAssetId 吏곸젒 留ㅼ묶 ?먮뒗 contractId + oldAssetId 議고빀?쇰줈 2以??좎뿰 異붿쟻
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
        throw new Error(`援먯껜 ????λ퉬 ?먮뒗 怨꾩빟 ?щ’??李얠쓣 ???놁뒿?덈떎. (援ъ옣鍮? ${oldAssetId ? '?뺤긽' : '?꾨씫'}, ?좎옣鍮? ${newAssetId ? '?뺤긽' : '?꾨씫'}, 怨꾩빟?щ’: ${caOrig ? '?뺤긽' : '?꾨씫'})`);
      }

      const today = new Date().toISOString().split('T')[0];
      const nowIso = new Date().toISOString();

      // 1. 湲곗〈 ?λ퉬: ?섎━?뺣퉬以?REPAIRING) ?좏깮 ??REPAIRING ?꾪솚, ?꾨땲硫??꾨?媛??AVAILABLE) ?좎?!
      // ?뮕 [?꾩궗 ?뺤콉]: 異쒓퀬寃???덈씫 援먯껜 ???ъ쑀 ?좊Т? 臾닿??섍쾶 ?뺣퉬?먯닔 媛??(吏???먯닔 ?먮뒗 湲곕낯 5??
      const targetStatus = markOldAsRepairing ? 'REPAIRING' : 'AVAILABLE';
      const penaltyToAdd = typeof customPenaltyScore === 'number' && !isNaN(customPenaltyScore) ? customPenaltyScore : 5;
      const updatedScore = (Number(oldAssetOrig.maintenanceScore) || 0) + penaltyToAdd;
      
      const cleanReason = reason && reason.trim() ? reason.trim() : '異쒓퀬寃???덈씫 援먯껜(?ъ쑀誘멸린??';
      const oldNote = oldAssetOrig.note || '';
      const appendedNote = oldNote
        ? `${oldNote}\n[異쒓퀬寃??援먯껜(踰뚯젏+${penaltyToAdd}, 珥앹젏:${updatedScore}??] ${today}: ${cleanReason}`
        : `[異쒓퀬寃??援먯껜(踰뚯젏+${penaltyToAdd}, 珥앹젏:${updatedScore}??] ${today}: ${cleanReason}`;

      const oldPayload: Partial<Asset> = {
        status: targetStatus,
        maintenanceScore: updatedScore,
        currentCustomerId: undefined,
        currentSiteId: undefined,
        contractStart: undefined,
        contractEnd: undefined,
        note: appendedNote, // ?뙚 ?먯궛 ?뺣퉬?꾩슂??ぉ(note)?먮쭔 ?뺥솗?????
        // ?뙚 memo(?쇰컲 ?먯궛 鍮꾧퀬: ?꾩감泥?寃곗젣議곌굔 ?????덈? ?ㅼ뿼?쒗궎吏 ?딄퀬 ?먮낯 100% 蹂댁〈!
        updatedAt: nowIso
      };

      db.updateRow<Asset>('assets', oldAssetId, oldPayload);

      // 1-1. ?뙚 [二쇨린???뺣퉬 ?곌퀎]: ?섎━?뺣퉬以??꾪솚 ??二쇨린???뺣퉬 ???repairs) ?곗폆 1:1 ?먮룞 諛쒗뻾 (?뚯옣 1.2 臾대늻?????
      if (markOldAsRepairing) {
        createdRepairId = db.generateNextId('repairs', db.repairs);
        db.insertRow<Repair>('repairs', {
          id: createdRepairId,
          assetId: oldAssetId,
          assetNo: oldAssetOrig.assetNo,
          modelName: oldAssetOrig.modelName,
          contractId: caOrig.contractId,
          customerId: oldAssetOrig.currentCustomerId,
          customerName: db.customers.find(c => c.id === oldAssetOrig.currentCustomerId)?.name || '異쒓퀬 寃?섏쿂',
          siteId: oldAssetOrig.currentSiteId,
          siteName: db.sites.find(s => s.id === oldAssetOrig.currentSiteId)?.name || '二쇨린??,
          requestDate: today,
          status: 'PENDING',
          workCategory: 'YARD_INTERNAL',
          workLocation: 'YARD',
          stockSource: 'YARD_STOCK',
          source: 'OUTBOUND_DEFECT',
          repairType: 'INTERNAL',
          priority: 'URGENT',
          details: `[異쒓퀬寃??遺덈웾 ?뺣퉬 ?묒닔] 援먯껜?ъ쑀: ${cleanReason}\n?泥댁옣鍮? ${newAssetOrig.assetNo} (${newAssetOrig.modelName})`,
          issueDescription: cleanReason,
          totalCost: 0,
          billableToCustomer: false,
          targetAssetStatus: 'REPAIRING',
          degradationScore: penaltyToAdd,
          createdAt: nowIso,
          updatedAt: nowIso
        });

        // ?? 二쇨린???뺣퉬???湲닿툒 ?뺣퉬 ToDo ?먮룞 ?곸옱
        try {
          await issueHandoverTask({
            category: 'OUTBOUND_REPAIR_DEFECT',
            title: `[異쒓퀬 援먯껜 湲닿툒 ?뺣퉬] ${oldAssetOrig.assetNo} (${oldAssetOrig.modelName})`,
            content: `異쒓퀬寃??遺덈웾 援먯껜 (+${penaltyToAdd}??: ${cleanReason} (?泥? ${newAssetOrig.assetNo})`,
            targetDept: 'YARD',
            priority: 'URGENT',
            actionUrl: '/repairs',
            entityType: 'REPAIR',
            entityId: createdRepairId,
            senderId: currentUser?.id,
            senderName: currentUser?.name || '異쒓퀬寃?섏떆?ㅽ뀥'
          });
        } catch (taskErr) {
          console.warn('異쒓퀬 遺덈웾 ?뺣퉬 ToDo 諛쒗뻾 寃쎄퀬 (臾댁떆):', taskErr);
        }
      }

      // 2. ?泥??λ퉬: 諛곗감吏??ASSIGNED)?쇰줈 ?꾪솚 諛?怨꾩빟 ?뺣낫 留ㅽ븨
      db.updateRow<Asset>('assets', newAssetId, {
        status: 'ASSIGNED',
        currentCustomerId: oldAssetOrig.currentCustomerId,
        currentSiteId: oldAssetOrig.currentSiteId,
        contractStart: oldAssetOrig.contractStart,
        contractEnd: oldAssetOrig.contractEnd,
        updatedAt: nowIso
      });

      // 3. 怨꾩빟 ?щ’(contractAssets) assetId 援먯껜
      db.updateRow<ContractAsset>('contractAssets', contractAssetId, {
        assetId: newAssetId,
        expectedModel: newAssetOrig.modelName
      });

      // 4. 異쒓퀬 寃???섎ː嫄?outboundInspections) assetId 援먯껜 (?놁쑝硫??좉퇋 ?앹꽦?섏뿬 寃???꾨씫 諛⑹?)
      if (inspOrig) {
        db.updateRow<OutboundInspection>('outboundInspections', inspOrig.id, {
          assetId: newAssetId,
          note: `[?λ퉬援먯껜] 湲곗〈(${oldAssetOrig.assetNo}) ???泥?${newAssetOrig.assetNo}) | ?ъ쑀: ${reason}`,
          updatedAt: nowIso
        });
      } else {
        db.insertRow<OutboundInspection>('outboundInspections', {
          id: `insp-${contractAssetId}-${Date.now()}`,
          contractId: caOrig.contractId,
          contractAssetId,
          assetId: newAssetId,
          status: 'PENDING',
          note: `[?λ퉬援먯껜] ?泥?${newAssetOrig.assetNo}) ?좉퇋 寃?섏쓽猶?| ?ъ쑀: ${reason}`,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }

      // 4-1. ?뙚 [?꾩궗 ?쒖? ?뚯옣 2.3 ?⑥씪 EXCHANGE 1嫄?諛쒗뻾/?꾪솚 ?먯튃]: 異쒓퀬遺덈웾 援먯껜 ??諛곗감 嫄댁쓣 ?⑥씪 'EXCHANGE'濡?媛깆떊
      const existingDel = db.deliveries.find(d => d.contractId === caOrig.contractId && (d.assetIds?.includes(oldAssetId) || !d.assetIds));
      if (existingDel) {
        db.updateRow<Delivery>('deliveries', existingDel.id, {
          assetIds: newAssetId,
          type: 'EXCHANGE',
          memo: `[異쒓퀬遺덈웾 援먯껜諛곗감 (?뚯옣 2.3)] 援ъ옣鍮?${oldAssetOrig.assetNo}) ???泥댁옣鍮?${newAssetOrig.assetNo}) | ?ъ쑀: ${cleanReason}`,
          updatedAt: nowIso
        });
      }

      // 5. ?먯궛 ?낆텧怨??섎━ ??꾨씪??濡쒓퉭 (?泥??λ퉬???ν썑 異쒓퀬 寃???뱀씤 ??OUTBOUND ?대젰???앹꽦??
      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: oldAssetId,
        assetNo: oldAssetOrig.assetNo,
        modelName: oldAssetOrig.modelName,
        type: 'REPAIR',
        repairId: createdRepairId,
        eventDate: today,
        memo: `[異쒓퀬遺덇? ?섎━?꾪솚] ?泥댁옣鍮?${newAssetOrig.assetNo}) 援먯껜諛곗젙 | ?ъ쑀: ${cleanReason}${createdRepairId ? ` (?뺣퉬?곗폆 ${createdRepairId} ?먮룞諛쒗뻾)` : ''}`,
        createdAt: nowIso
      });

      // 6. ?뙚 [?⑦궎吏 ?쒕쪟 臾닿껐??蹂댁〈]: 怨꾩빟?쒗뙣?ㅼ? 諛쒖넚 ??異쒓퀬 ?먯궛 援먯껜 ??ToDo ?먮룞 諛쒗뻾
      try {
        await checkAndIssuePackageResendTask({
          contractId: caOrig.contractId,
          oldAssetId,
          newAssetId,
          reason,
          senderName: '異쒓퀬寃?섏떆?ㅽ뀥'
        });
      } catch (taskErr) {
        console.warn('怨꾩빟?쒗뙣?ㅼ? ?щ컻??ToDo 諛쒗뻾 寃쎄퀬 (臾댁떆):', taskErr);
      }

      // 7. DB ?꾧껐 ?숆린 ?湲?(?ㅽ뙣 ??catch 釉붾줉?먯꽌 ?먮룞 濡ㅻ갚!)
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      console.error('exchangeOutboundAsset error & Rollback:', err);

      // ?뮙 DB ????ㅽ뙣 ??100% ?ㅻ깄??濡ㅻ갚!
      if (oldSnapshot) db.updateRow('assets', oldAssetId, oldSnapshot);
      await db.awaitPendingWrites();
      if (newSnapshot) db.updateRow('assets', newAssetId, newSnapshot);
      await db.awaitPendingWrites();
      if (caSnapshot) db.updateRow('contractAssets', contractAssetId, caSnapshot);
      await db.awaitPendingWrites();
      if (inspSnapshot && inspOrig) db.updateRow('outboundInspections', inspOrig.id, inspSnapshot);
      await db.awaitPendingWrites();
      if (createdRepairId) db.deleteRow('repairs', createdRepairId);
      await db.awaitPendingWrites();

      refreshAllData();

      const errorMsg = `?좑툘 異쒓퀬 ?λ퉬 援먯껜 泥섎━ 以?DB ?숆린???ㅻ쪟媛 諛쒖깮?덉뒿?덈떎:\n\n??[?덈궡]: ????ㅽ뙣濡??명빐 ?λ퉬 援먯껜 ?묒뾽???덉쟾?섍쾶 ?먮룞 濡ㅻ갚 ?먮났?섏뿀?듬땲??\n\n${err.message || err.details || JSON.stringify(err)}`;
      showErrorModal(errorMsg, '異쒓퀬 ?λ퉬 援먯껜 DB ?숆린???ㅻ쪟');
      throw err;
    }
  };

  const exchangeAsset = async (contractId: string, oldAssetId: string, newAssetId: string, exchangeDate: string) => {
    try {
      const contract = db.contracts.find(c => c.id === contractId);
      if (!contract) {
        showErrorModal('?李?援먯껜 ???怨꾩빟 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.');
        return;
      }

      const caList = db.contractAssets.filter(ca => ca.contractId === contractId && ca.assetId === oldAssetId);
      const ca = caList.find(c => !c.endDate || new Date(c.endDate) >= new Date(exchangeDate));
      if (!ca) {
        showErrorModal('?李????怨꾩빟 ?먯궛 ?щ’??李얠쓣 ???놁뒿?덈떎.');
        return;
      }

      const originalEndDate = ca.endDate;
      const prevDateObj = new Date(exchangeDate);
      prevDateObj.setDate(prevDateObj.getDate() - 1);
      const dayBeforeExchange = prevDateObj.toISOString().split('T')[0];

      // ?뚯옣 4.1: ?꾩옄?곗? 援먯껜 ?꾩씪源뚯? ?쇳븷 留덇컧
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

      // ?뚯옣 4.1: ?꾩옣鍮꾨뒗 援먯껜 ?뱀씪遺??媛???밴퀎
      const newAsset = db.assets.find(a => a.id === newAssetId);
      if (newAsset) {
        db.insertRow<ContractAsset>('contractAssets', {
          contractId: contractId,
          assetId: newAssetId,
          monthlyRentalFee: ca.monthlyRentalFee,
          dailyRentalFee: ca.dailyRentalFee,
          startDate: exchangeDate,
          endDate: originalEndDate || contract.endDate,
          createdAt: new Date().toISOString()
        });

        // ?뚯옣 1.3 以?? 諛곗감 ?④퀎?먯꽌??ASSIGNED(諛곗젙/異쒓퀬?湲? ?곹깭 遺?? 異쒓퀬 寃???뱀씤 留덇컧 ??RENTED ?꾪솚
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

      // ?뚯옣 2.3 以?? ?⑥씪 EXCHANGE 諛곗감 ?섎ː 1嫄?諛쒗뻾
      db.insertRow<Delivery>('deliveries', {
        contractId: contractId,
        type: 'EXCHANGE',
        status: 'REQUESTED',
        requestDate: exchangeDate,
        deliveryCost: 0,
        isCostSettled: false,
        memo: `?λ퉬 援먯껜 ?섎ː (援? ${oldAsset?.assetNo || '誘몄긽'} -> ?? ${newAsset?.assetNo || '誘몄긽'})`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // ?뚯옣 4.2 以?? changeType 'EXCHANGE' 紐낆떆
      db.insertRow<ContractHistory>({
        contractId,
        changeType: 'EXCHANGE',
        changeDate: exchangeDate,
        description: `?λ퉬 援먯껜 ?꾨즺 (援? ${oldAsset?.assetNo || '誘몄긽'} -> ?? ${newAsset?.assetNo || '誘몄긽'})`,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 ?李?援먯껜 泥섎━ 以?DB ?숆린???ㅻ쪟:\n${err?.message || err}`);
      throw err;
    }
  };

  const generateBillingsForMonth = async (billingYm: string, billingDate: string) => {
    try {
      const [year, month] = billingYm.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);

      // ?대떦 ?붿뿉 ?쒖꽦 ?곹깭??怨꾩빟 ?꾩껜 ?먯깋 (怨꾩빟 ?⑥쐞 ?낅┰ ?앹꽦 - E-1 ?먯튃, 留ㅺ컖 怨꾩빟 ?먯쿇 諛곗젣)
      const activeContracts = db.contracts.filter(c => {
        if ((c.contractType || 'RENTAL') !== 'RENTAL') return false; // ?슟 ?먯궛 留ㅺ컖 怨꾩빟(SALE) ?먯쿇 諛곗젣
        if (c.status === 'COMPLETED') return false;
        const contractStart = new Date(c.startDate);
        const contractEnd = c.endDate ? new Date(c.endDate) : null;
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
          // 以묐났 寃쎄퀬??議곗슜??skip (?대? 議댁옱?섎뒗 泥?뎄??
          if (err?.message?.includes('[以묐났 寃쎄퀬]')) continue;
          errors.push(err?.message || String(err));
        }
      }

      await db.awaitPendingWrites();
      refreshAllData();

      if (errors.length > 0) {
        showErrorModal(`?좑툘 ?쇰? 泥?뎄???앹꽦 ?ㅽ뙣 (${errors.length}嫄?:\n\n${errors.slice(0, 5).join('\n')}`, '泥?뎄???앹꽦 ?쇰? ?ㅽ뙣');
      }
    } catch (err: any) {
      showErrorModal(`?좑툘 ?쇨큵 泥?뎄??DB ????ㅽ뙣:\n\n${err?.message || err}`, '泥?뎄???앹꽦 ?ㅽ뙣');
    }
  };

  // 嫄곕옒紐낆꽭??諛쒖넚: UNPAID ??REQUESTED (F-2 ?먯튃)
  const approveBilling = async (billingId: string) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) return;
    if (billing.status === 'UNPAID') {
      // 諛쒖넚 泥섎━: REQUESTED濡??꾪솚
      db.updateRow<Billing>(billingId, {
        status: 'REQUESTED',
        updatedAt: new Date().toISOString()
      });
      // 怨꾩빟?대젰 湲곕줉
      if (billing.contractId) {
        db.insertRow<ContractHistory>({
          contractId: billing.contractId,
          changeType: 'BILLING_SENT',
          changeDate: new Date().toISOString().split('T')[0],
          description: `泥?뎄??諛쒖넚: ${billing.billingYm} / ${billing.totalAmount.toLocaleString()}??(泥?뎄踰덊샇: ${billingId})`,
          createdAt: new Date().toISOString()
        });
      }
    }
    await db.awaitPendingWrites();
    refreshAllData();
  };

  // 泥?뎄 痍⑥냼 (J-1, J-2 ?먯튃)
  // refund=true: ?섎궔 痍⑥냼 + ?낃툑?붿븸 ?뚮㈇ (?섎텋 耳?댁뒪)
  // refund=false: 泥?뎄留?痍⑥냼, ?섎궔쨌?낃툑?붿븸 ?붾쪟 (鍮꾪솚遺?耳?댁뒪 ????泥?뎄???곌껐)
  const cancelBilling = async (billingId: string, refund: boolean = false) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) return;

    const details = db.billingDetails.filter(bd => bd.billingId === billingId);

    // ?좎닔湲댟룸늻?곷젋?덈즺 濡ㅻ갚
    details.forEach(bd => {
      if (bd.itemName === '?좎닔湲??덉튂湲? 李④컧 諛섏쁺') {
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
      // ?몄긽誘몄닔湲??곕룞 ?댁젣 (billedAmount 濡ㅻ갚)
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
      // ?섎텋 耳?댁뒪: ?섎궔 痍⑥냼 + payment_deposit_links ?댁젣
      const linkedPayments = db.payments.filter(p => p.billingId === billingId);
      linkedPayments.forEach(p => {
        db.paymentDepositLinks
          .filter(l => l.paymentId === p.id)
          .forEach(l => db.deleteRow('paymentDepositLinks', l.id));
        db.deleteRow('payments', p.id);
      await db.awaitPendingWrites();
      });
    }
    // 鍮꾪솚遺?耳?댁뒪: ?섎궔쨌?낃툑?붿븸 洹몃?濡??좎? ????泥?뎄 ?앹꽦 ??FIFO濡??먮룞 ?곌껐

    // 怨듯넻: 泥?뎄 ?곸꽭 ??젣 ??泥?뎄 REJECTED 泥섎━ (?꾩쟾 ??젣 ????대젰 蹂댁〈)
    details.forEach(bd => db.deleteRow('billingDetails', bd.id));
    db.updateRow<Billing>(billingId, {
      status: 'REJECTED',
      updatedAt: new Date().toISOString()
    });

    // 怨꾩빟?대젰 湲곕줉
    if (billing.contractId) {
      db.insertRow<ContractHistory>({
        contractId: billing.contractId,
        changeType: 'BILLING_CANCELLED',
        changeDate: new Date().toISOString().split('T')[0],
        description: `泥?뎄 痍⑥냼: ${billing.billingYm} / ${billing.totalAmount.toLocaleString()}??(${refund ? '?섎텋 泥섎━' : '鍮꾪솚遺?泥섎━'}, 泥?뎄踰덊샇: ${billingId})`,
        createdAt: new Date().toISOString()
      });
      // ?뮕 泥?뎄 痍⑥냼 ??怨꾩빟 硫뷀??곗씠???댁쟾 ?곹깭濡?濡ㅻ갚 ?숆린??
      syncContractBillingMilestones(billing.contractId);
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  // ??? ?몄긽誘몄닔湲?CRUD (4?④퀎) ??????????????????????????????????????????????

  /** ?몄긽誘몄닔湲??좉퇋 ?깅줉 */
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

  /** ?몄긽誘몄닔湲???泥?뎄 ?곸꽭 ?곕룞 (?대쾲 ??泥?뎄??湲덉븸 吏?? */
    const linkReceivableToBilling = async (
    billingId: string,
    receivableId: string,
    amount: number,
    displayName?: string
  ) => {
    const rcv = db.receivables.find(r => r.id === receivableId);
    if (!rcv) throw new Error('?몄긽誘몄닔湲???ぉ??李얠쓣 ???놁뒿?덈떎.');

    const remaining = rcv.totalAmount - rcv.billedAmount;
    if (amount > remaining + 1) { // 遺?숈냼?섏젏 ?ㅼ감 ?덉슜
      throw new Error(`泥?뎄 湲덉븸(${amount.toLocaleString()}????誘몄껌援??붿븸(${remaining.toLocaleString()}????珥덇낵?⑸땲??`);
    }

    const newBilled = rcv.billedAmount + amount;
    const newRemaining = rcv.totalAmount - newBilled;
    
    // K-3: 怨좉컼 ?щ챸???뺣낫瑜??꾪븳 媛뺤젣 ?몃옒而??띿뒪???앹꽦
    const trackerText = `[珥?泥?뎄??? ${rcv.totalAmount.toLocaleString()}??/ 湲덊쉶 泥?뎄: ${amount.toLocaleString()}??/ 誘몄껌援??붿븸: ${Math.max(0, newRemaining).toLocaleString()}??`;

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

    // 泥?뎄??珥앹븸 媛깆떊
    const billing = db.billings.find(b => b.id === billingId);
    if (billing) {
      db.updateRow<Billing>(billingId, {
        totalAmount: billing.totalAmount + amount,
        updatedAt: now
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  /** K-2: ?몄긽誘몄닔湲??⑤룆 泥?뎄??諛쒗뻾 (?섍툑 湲곕룞??諛?吏꾩긽怨좉컼 諛⑹뼱) */
  const generateStandaloneBillingForReceivable = async (receivableId: string, reason: string): Promise<string> => {
    const rcv = db.receivables.find(r => r.id === receivableId);
    if (!rcv) throw new Error('?몄긽誘몄닔湲???ぉ??李얠쓣 ???놁뒿?덈떎.');
    if (rcv.status === 'CLEARED') throw new Error('?대? 泥?뎄媛 ?꾨즺??嫄댁엯?덈떎.');
    if (!rcv.customerId) throw new Error('怨좉컼 ?뺣낫媛 ?녿뒗 誘몄닔湲덉? ?⑤룆 泥?뎄?????놁뒿?덈떎.');

    const remaining = rcv.totalAmount - rcv.billedAmount;
    const now = new Date().toISOString();
    const billingYm = now.substring(0, 7);
    const billingDate = now.split('T')[0];

    // 寃곗젙: rcv.type???곕씪 ?곸젅??billingType 留ㅽ븨 (Gap 2 諛⑹뼱)
    let bType: BillingType = 'REPAIR';
    if (rcv.type === 'TRANSPORT') bType = 'TRANSPORT';
    else if (rcv.type === 'CLEANING' || rcv.type === 'REPAIR') bType = 'REPAIR';
    else if (rcv.type === 'VENDOR_CLAIM' || rcv.type === 'OTHER') bType = 'REPAIR';

    const newBilling = db.insertRow<Billing>({
      billingType: bType,
      customerId: rcv.customerId,
      contractId: rcv.contractId || (null as any),
      billingYm,
      billingDate,
      totalAmount: 0, // linkReceivableToBilling??媛깆떊??
      paidAmount: 0,
      status: 'UNPAID',
      createdAt: now,
      updatedAt: now
    });

    const standaloneTitle = `[?⑤룆 泥?뎄 - ${reason}] ${rcv.displayName || rcv.internalDescription}`;
    await linkReceivableToBilling(newBilling.id, rcv.id, remaining, standaloneTitle);
    
    return newBilling.id;
  };

  const getDueContractsForBilling = (targetDate?: string) => {
    const todayStr = targetDate || new Date().toISOString().split('T')[0];
    const [year, month, day] = todayStr.split('-').map(Number);
    const targetYm = todayStr.slice(0, 7);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    const lastDayOfMonth = endOfMonth.getDate();

    // 1. ?좏슚 怨꾩빟 ?먯깋: ?꾨즺?섏? ?딆? ?댁븘?덈뒗 ?뚰깉 怨꾩빟 (留ㅺ컖 怨꾩빟 ?먯쿇 諛곗젣)
    const liveContracts = db.contracts.filter(c => {
      if ((c.contractType || 'RENTAL') !== 'RENTAL') return false; // ?슟 ?먯궛 留ㅺ컖 怨꾩빟(SALE) ?먯쿇 諛곗젣
      if (c.status === 'COMPLETED') return false;
      const cStart = new Date(c.startDate);
      if (cStart > endOfMonth) return false;
      if (c.endDate) {
        const cEnd = new Date(c.endDate);
        if (cEnd < startOfMonth) return false;
      }
      return true;
    });

    const dueList: { contract: Contract; customer: Customer; site?: CustomerSite; billingDay: number; dueReason: string }[] = [];

    liveContracts.forEach(c => {
      const cust = db.customers.find(cu => cu.id === c.customerId);
      if (!cust) return;
      const site = db.sites.find(s => s.id === c.siteId);

      // ?뮕 [Gap 1 諛⑹뼱] ?대? ?대떦 洹?띿썡(targetYm)???좏슚??'?뺢린 ?뚰깉猷?RENTAL)' 泥?뎄?쒓? ?덈뒗吏 ?뺤씤
      // ?섎━鍮?REPAIR), ?대컲鍮?TRANSPORT), ?먯궛留ㅺ컖(ASSET_SALE) ?⑤룆 泥?뎄?쒖? ?꾧꺽 遺꾨━
      const existingBilling = db.billings.find(b => 
        b.contractId === c.id && 
        b.billingYm === targetYm && 
        (b.billingType === 'RENTAL' || !b.billingType) && 
        b.status !== 'REJECTED'
      );
      if (existingBilling) return;

      // 怨좉컼/怨꾩빟??泥?뎄 湲곗???billingDay) ?먮뒗 嫄곕옒紐낆꽭??留덇컧??statementClosingDay)
      const rawBillingDay = c.billingDay || cust.defaultBillingDay || 31;
      const rawStatementDay = c.statementClosingDay || cust.defaultStatementClosingDay || rawBillingDay;
      const effectiveBillingDay = Math.min(rawBillingDay, lastDayOfMonth);
      const effectiveStatementDay = Math.min(rawStatementDay, lastDayOfMonth);
      const triggerDay = Math.min(effectiveBillingDay, effectiveStatementDay);

      // ?뮕 怨꾩빟 ?쒖옉?쇱씠 ?뱀썡 留덇컧??triggerDay)蹂대떎 誘몃옒??寃쎌슦: ?뱀썡 泥?뎄 ??곸씠 ?꾨땲誘濡??쒖쇅 (?듭썡 泥?뎄濡??닿?)
      const closingDateStr = `${year}-${String(month).padStart(2, '0')}-${String(triggerDay).padStart(2, '0')}`;
      if (c.startDate > closingDateStr) {
        return;
      }

      const isDayPassed = day >= triggerDay;
      const isPastMonthContract = new Date(c.startDate) < startOfMonth;

      if (isDayPassed || isPastMonthContract) {
        let reason = '';
        if (day >= triggerDay) {
          reason = `泥?뎄湲곗???留ㅼ썡 ${rawBillingDay}?? ?꾨옒`;
        } else {
          reason = `?꾩썡 ?댁썡 誘몄껌援?怨꾩빟`;
        }

        dueList.push({
          contract: c,
          customer: cust,
          site,
          billingDay: rawBillingDay,
          dueReason: reason
        });
      }
    });

    return dueList;
  };

  /**
   * billingDay 湲곕컲 泥?뎄 湲곌컙 怨꾩궛 (?명꽣酉??먯튃 A-1 ~ A-5, B-1 ~ B-4)
   * - billingDay = 泥?뎄??諛쒗뻾??(?? 25 ???꾩썡26~?뱀썡25)
   * - 泥???/ 留덉?留??щ쭔 ?쇳븷, 以묎컙 ???뺤븸
   * - billingDay > ?붾쭚?대㈃ ?붾쭚濡??먮룞 蹂댁젙
   */
  const calcBillingPeriod = (
    billingYm: string,
    billingDay: number,
    contractStartDate: string,
    contractEndDate?: string
  ) => {
    const [year, month] = billingYm.split('-').map(Number);

    // ?뱀썡 billingDay 蹂댁젙 (A-5, UTC 湲곗?)
    const lastDayOfCurrent = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const effectiveBillingDay = Math.min(billingDay, lastDayOfCurrent);

    // 泥?뎄 湲곌컙 ?? ?뱀썡 billingDay
    const periodEnd = new Date(Date.UTC(year, month - 1, effectiveBillingDay));

    // 泥?뎄 湲곌컙 ?쒖옉: ?꾩썡 (billingDay+1)??
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const lastDayOfPrev = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const prevEffectiveBillingDay = Math.min(billingDay, lastDayOfPrev);
    const periodStart = new Date(Date.UTC(prevYear, prevMonth - 1, prevEffectiveBillingDay + 1));

    // ?ㅼ젣 ?먯궛 ?ъ슜 湲곌컙: 怨꾩빟 startDate 蹂댁젙 (A-2)
    const contractStart = new Date(contractStartDate.includes('T') ? contractStartDate : `${contractStartDate}T00:00:00Z`);
    const actualStart = contractStart > periodStart ? contractStart : periodStart;

    // ?ㅼ젣 ?먯궛 ?ъ슜 湲곌컙: 怨꾩빟 endDate 蹂댁젙 (A-3)
    const contractEnd = contractEndDate ? new Date(contractEndDate.includes('T') ? contractEndDate : `${contractEndDate}T00:00:00Z`) : null;
    const actualEnd = contractEnd && contractEnd < periodEnd ? contractEnd : periodEnd;

    // 泥???/ 留덉?留????먮떒 ???쇳븷 怨꾩궛 ?щ? (B-2)
    const isFirstMonth = contractStart > periodStart && contractStart <= periodEnd;
    const isLastMonth = contractEnd
      ? contractEnd >= periodStart && contractEnd <= periodEnd
      : false;
    const isProRata = isFirstMonth || isLastMonth;

    return { actualStart, actualEnd, periodStart, periodEnd, isProRata };
  };

  /**
   * ?쇳븷 湲덉븸 怨꾩궛 (B-1: 30??怨좎젙, ??씪 湲곗?, 1,000???⑥쐞 諛섏삱由??낃퀎 ?꾩궗 ?쒖?)
   */
  const calcProRataAmount = (monthlyFee: number, dailyFee: number, days: number): number => {
    if (dailyFee > 0) {
      return Math.round((dailyFee * days) / 1000) * 1000;
    }
    return Math.round(((monthlyFee / 30) * days) / 1000) * 1000;
  };

  /**
   * ?뮕 怨꾩빟蹂?吏곸쟾 泥?뎄 留덉씪?ㅽ넠 硫뷀??곗씠???숆린??(?몃━嫄?媛깆떊 諛?諛깊븘)
   * - 理쒓렐 ?뚰깉猷?泥?뎄 諛쒗뻾??(lastBillingDate)
   * - 理쒓렐 泥?뎄 ?쒖옉??(lastBilledPeriodStart)
   * - 理쒓렐 泥?뎄 醫낅즺??(lastBilledPeriodEnd)
   * - 理쒓렐 泥?뎄 洹?띿썡 (lastBilledYm)
   * - ?꾩쟻 諛쒗뻾 泥?뎄 嫄댁닔 (billingCount)
   */
  const syncContractBillingMilestones = (contractId?: string) => {
    const targetContracts = contractId 
      ? db.contracts.filter(c => c.id === contractId) 
      : db.contracts;

    targetContracts.forEach(c => {
      const activeBillings = db.billings
        .filter(b => b.contractId === c.id && b.status !== 'REJECTED')
        .sort((a, b) => (b.billingYm || '').localeCompare(a.billingYm || ''));

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
      const billingDay = c.billingDay || 25;
      const { actualStart, actualEnd } = calcBillingPeriod(
        latestBilling.billingYm,
        billingDay,
        c.startDate,
        c.endDate
      );

      const startIso = actualStart.toISOString().split('T')[0];
      const endIso = actualEnd.toISOString().split('T')[0];

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
      throw new Error(`[怨꾩빟 ?좏삎 ?ㅻ쪟] 怨꾩빟 ${c.contractNo}???먯궛 留ㅺ컖 怨꾩빟(SALE)?낅땲?? ???뺢린 ?뚰깉猷?泥?뎄 ??곸씠 ?꾨떃?덈떎.`);
    }

    // 以묐났 諛쒗뻾 媛먯? (J-3): ?숈씪 怨꾩빟 + ?숈씪 洹?띿썡 ?쒖꽦 泥?뎄 議댁옱 ??throw (遺遺?泥?뎄???쒖쇅)
    const existingActive = db.billings.find(
      b => b.contractId === c.id && b.billingYm === billingYm && b.status !== 'REJECTED' && !b.isPartial
    );
    if (existingActive && !selectedContractAssetIds) {
      throw new Error(`[以묐났 寃쎄퀬] 怨꾩빟 ${c.contractNo}??${billingYm} 泥?뎄?쒓? ?대? 議댁옱?⑸땲??\n?곹깭: ${existingActive.status} / ID: ${existingActive.id}`);
    }

    const cust = db.customers.find(cu => cu.id === c.customerId);
    const billingDay = c.billingDay || cust?.defaultBillingDay || 25;
    const allCAssets = db.contractAssets.filter(ca => ca.contractId === c.id);
    // 遺遺?泥?뎄 ?? ?좏깮???먯궛 ID留??꾪꽣留? ?꾩껜 泥?뎄 ?? ?꾩껜 ?먯궛
    const cAssets = selectedContractAssetIds
      ? allCAssets.filter(ca => selectedContractAssetIds.includes(ca.id))
      : allCAssets;
    const isPartialBilling = !!(selectedContractAssetIds && selectedContractAssetIds.length < allCAssets.length);

    let detailsList: Omit<BillingDetail, 'id' | 'billingId' | 'createdAt'>[] = [];
    let totalAmount = 0;

    // 1. ?먯궛蹂??뚰깉猷?怨꾩궛 (?명꽣酉??먯튃 A, B, C ?듯빀 ?곸슜)
    cAssets.forEach(ca => {
      const { actualStart, actualEnd, isProRata } = calcBillingPeriod(
        billingYm,
        billingDay,
        ca.startDate,
        ca.endDate || c.endDate
      );

      if (actualStart > actualEnd) return; // 泥?뎄 湲곌컙 ???먯궛

      const assetInfo = db.assets.find(a => a.id === ca.assetId);
      const assetName = assetInfo
        ? `${assetInfo.modelName} (愿由щ쾲?? ${assetInfo.assetNo})`
        : '?뚰깉 ?λ퉬';

      let rentalCost = 0;
      let calcDesc = '';

      if (isProRata) {
        // ?쇳븷 怨꾩궛: 30??怨좎젙 (B-1), ??씪 湲곗? (B-4)
        const diffMs = actualEnd.getTime() - actualStart.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
        rentalCost = calcProRataAmount(ca.monthlyRentalFee, ca.dailyRentalFee, days);
        calcDesc = `${actualStart.toISOString().split('T')[0]} ~ ${actualEnd.toISOString().split('T')[0]} ?쇳븷 泥?뎄 (${days}??횞 ${(ca.dailyRentalFee > 0 ? ca.dailyRentalFee : ca.monthlyRentalFee / 30).toLocaleString()}??`;
      } else {
        // 以묎컙 ?? ???뺤븸 (B-2)
        rentalCost = ca.monthlyRentalFee;
        const startStr = actualStart.toISOString().split('T')[0];
        const endStr = actualEnd.toISOString().split('T')[0];
        calcDesc = `${startStr} ~ ${endStr} ?뺢린 ?붾젋?덈즺`;
      }

      if (rentalCost > 0) {
        detailsList.push({
          contractAssetId: ca.id,
          assetId: ca.assetId,
          itemName: `${assetName} ?뚰깉猷?,
          quantity: 1,
          unitPrice: rentalCost,
          amount: rentalCost,
          internalDescription: calcDesc,
          displayName: undefined
        });
        totalAmount += rentalCost;

        if (assetInfo) {
          // 湲곗닔 ?먯튃: 泥?뎄??諛쒗뻾(湲곗닔) ?쒖젏?먮쭔 cumRentalFee ?꾩쟻 ??誘몄닔(誘몃컻?? 湲덉븸 ?덈? ?ы븿 湲덉?
          db.updateRow<Asset>('assets', assetInfo.id, {
            cumRentalFee: (assetInfo.cumRentalFee || 0) + rentalCost,
            updatedAt: new Date().toISOString()
          });
        }
      }
    });

    // 2. ?섎━鍮??먮룞 ?⑹궛 ?쒓굅 (H-1 ?먯튃: ?섎━鍮꾨뒗 ?몄긽誘몄닔湲???μ쑝濡?遺꾨━ 愿由?
    // ???대떦?먭? ?몄긽誘몄닔湲??붾㈃?먯꽌 ?섎룞?쇰줈 泥?뎄???ы븿

    // 3. ?좎닔湲??덉튂湲? 李④컧 諛섏쁺 ??遺遺?泥?뎄媛 ?꾨땶 寃쎌슦?먮쭔 ?먮룞 李④컧 (I-1 ?먯튃)
    let finalBillingAmount = totalAmount;
    if (!isPartialBilling && cust && (cust.prepaidBalance || 0) > 0 && totalAmount > 0) {
      const prepaid = cust.prepaidBalance || 0;
      const applied = Math.min(totalAmount, prepaid);
      if (applied > 0) {
        detailsList.push({
          contractAssetId: undefined,
          itemName: '?좎닔湲??덉튂湲? 李④컧 諛섏쁺',
          quantity: 1,
          unitPrice: -applied,
          amount: -applied,
          internalDescription: `蹂댁쑀 ?좎닔湲?以?${applied.toLocaleString()}???먮룞 李④컧`,
          displayName: undefined
        });
        db.updateRow<Customer>('customers', cust.id, {
          prepaidBalance: prepaid - applied,
          updatedAt: new Date().toISOString()
        } as any);
        finalBillingAmount = totalAmount - applied;
      }
    }

    if (detailsList.length === 0) return null;

    // 4. 泥?뎄???앹꽦 ??珥덇린 ?곹깭 UNPAID (F-2 ?먯튃: 嫄곕옒紐낆꽭??諛쒖넚 ??REQUESTED濡??꾪솚)
    const newBilling = db.insertRow<Billing>({
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

    detailsList.forEach(det => {
      db.insertRow<BillingDetail>('billingDetails', {
        ...det,
        billingId: newBilling.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // ?뮕 怨꾩빟 硫뷀??곗씠???몃━嫄??먮룞 媛깆떊 (理쒓렐 泥?뎄 諛쒗뻾?? ?쒖옉?? 醫낅즺?? 泥?뎄嫄댁닔)
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
        // K-1: 誘몄껌援??몄긽誘몄닔湲?議댁옱 ?щ? 泥댄겕 (?쇨큵 泥?뎄 諛⑹뼱 濡쒖쭅)
        const hasPendingReceivables = db.receivables.some(r => 
          r.contractId === item.contract.id && r.status !== 'CLEARED'
        );

        if (hasPendingReceivables) {
          skippedContracts.push({
            contractId: item.contract.id,
            customerId: item.customer.id,
            reason: '誘몄껌援??몄긽誘몄닔湲?議댁옱'
          });
          continue; // ?대떦 怨꾩빟? 泥?뎄 嫄대꼫? (SKIP)
        }

        const bId = await generateBillingForSingleContract(item.contract.id, ym, todayStr);
        if (bId) createdCount++;
      }

      await db.awaitPendingWrites();
      refreshAllData();
      return { successCount: createdCount, skippedContracts };
    } catch (err: any) {
      showErrorModal(`?좑툘 ?꾨옒 怨꾩빟 泥?뎄 ?쇨큵 ?앹꽦 ?ㅽ뙣:\n\n${err?.message || err}`, '泥?뎄 ?앹꽦 ?ㅻ쪟');
      return { successCount: 0, skippedContracts: [] };
    }
  };

  const regenerateBilling = async (
    billingId: string,
    customDetails?: Omit<BillingDetail, 'id' | 'billingId' | 'createdAt'>[],
    options?: { billingYm?: string; billingDate?: string; memo?: string }
  ): Promise<string> => {
    const oldBilling = db.billings.find(b => b.id === billingId);
    if (!oldBilling) throw new Error('泥?뎄?쒕? 李얠쓣 ???놁뒿?덈떎.');

    // 1. 湲곗〈 泥?뎄??濡ㅻ갚 & ?곹깭 REJECTED 留덇컧
    const oldDetails = db.billingDetails.filter(bd => bd.billingId === billingId);
    oldDetails.forEach(bd => {
      if (bd.itemName === '?좎닔湲??덉튂湲? 李④컧 諛섏쁺') {
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
      // ?뮕 [Gap 4 諛⑹뼱] ?몄긽誘몄닔湲?泥?뎄??濡ㅻ갚
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

    // 湲곗〈 ?곌껐 ?섎━鍮??댁젣
    const linkedRepairs = db.repairs.filter(r => r.billingId === billingId);
    linkedRepairs.forEach(r => {
      db.updateRow<Repair>('repairs', r.id, { billingId: undefined });
    });

    // 湲곗〈 泥?뎄??REJECTED 泥섎━ (媛먯궗 異붿쟻??蹂댁〈)
    db.updateRow<Billing>(billingId, {
      status: 'REJECTED',
      rejectReason: options?.memo || '?섏젙?ы빆 諛섏쁺???곕Ⅸ 湲곗〈 泥?뎄??痍⑥냼 諛??ъ깮??,
      updatedAt: new Date().toISOString()
    });

    // 2. ??泥?뎄???앹꽦
    const newYm = options?.billingYm || oldBilling.billingYm;
    const newDate = options?.billingDate || oldBilling.billingDate || new Date().toISOString().split('T')[0];

    const finalDetails = customDetails && customDetails.length > 0 ? customDetails : oldDetails.map(od => ({
      contractAssetId: od.contractAssetId,
      itemName: od.itemName,
      quantity: od.quantity,
      unitPrice: od.unitPrice,
      amount: od.amount,
      description: od.description
    }));

    const newTotalAmount = finalDetails.reduce((sum, d) => sum + (d.amount || (d.quantity * d.unitPrice)), 0);

    const newBilling = db.insertRow<Billing>({
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

    finalDetails.forEach(det => {
      db.insertRow<BillingDetail>('billingDetails', {
        ...det,
        billingId: newBilling.id,
        createdAt: new Date().toISOString()
      });

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
    });

    // 怨꾩빟?대젰 湲곕줉 (?ъ깮??
    if (oldBilling.contractId) {
      db.insertRow<ContractHistory>({
        contractId: oldBilling.contractId,
        changeType: 'BILLING_REGENERATED',
        changeDate: new Date().toISOString().split('T')[0],
        description: `泥?뎄 ?ъ깮?? ${newYm} / ${newTotalAmount.toLocaleString()}??(湲곗〈 ${billingId} ???좉퇋 ${newBilling.id}, ?ъ쑀: ${options?.memo || '?섏젙?ы빆 諛섏쁺'})`,
        createdAt: new Date().toISOString()
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
    return newBilling.id;
  };

  // v2: 蹂듭닔 ?낃툑嫄??곕룞 ?섎궔 泥섎━
  const receivePayment = async (billingId: string, data: {
    paymentDate: string;
    amount: number;
    method: string;
    memo: string;
    depositLinks?: { bankTransactionId: string; usedAmount: number }[];
  }) => {
    const billing = db.billings.find(b => b.id === billingId);
    if (!billing) {
      showErrorModal('泥?뎄?쒕? 李얠쓣 ???놁뒿?덈떎.');
      return;
    }
    if (!data.amount || data.amount <= 0) {
      showErrorModal('?섎궔 湲덉븸? 1???댁긽?댁뼱???⑸땲??');
      return;
    }

    // Payment 1嫄??앹꽦
    const newPayment = db.insertRow<Payment>('payments', {
      billingId,
      paymentDate: data.paymentDate,
      amount: data.amount,
      method: data.method,
      memo: data.memo,
      createdAt: new Date().toISOString()
    });

    // PaymentDepositLinks N嫄??앹꽦 (?듭옣?낃툑 ?곕룞 ??
    if (data.depositLinks && data.depositLinks.length > 0) {
      for (const link of data.depositLinks) {
        if (link.usedAmount > 0) {
          db.insertRow<PaymentDepositLink>('paymentDepositLinks', {
            paymentId: newPayment.id,
            bankTransactionId: link.bankTransactionId,
            usedAmount: link.usedAmount,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    // Billing.paidAmount / status ?먮룞 媛깆떊 (VAT ?ы븿 珥앹븸 湲곗?)
    const nextPaid = billing.paidAmount + data.amount;
    const supply = billing.totalAmount || 0;
    const grandTotal = supply + Math.round(supply * 0.1);
    let nextStatus: Billing['status'] = 'UNPAID';
    if (nextPaid >= grandTotal) {
      nextStatus = 'PAID';
    } else if (nextPaid > 0) {
      nextStatus = 'PARTIAL';
    }

    db.updateRow<Billing>(billingId, {
      paidAmount: nextPaid,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    });

    // 怨꾩빟?대젰 湲곕줉
    if (billing.contractId) {
      db.insertRow<ContractHistory>({
        contractId: billing.contractId,
        changeType: 'PAYMENT_RECEIVED',
        changeDate: data.paymentDate,
        description: `?섎궔 泥섎━: ${billing.billingYm} / ${data.amount.toLocaleString()}???섎궔 (?꾩쟻: ${nextPaid.toLocaleString()}/${grandTotal.toLocaleString()}?? ?곹깭: ${nextStatus})`,
        createdAt: new Date().toISOString()
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  // ?섎궔 痍⑥냼: Payment ??젣 + ?곌껐??PDL ?꾩껜 ??젣 + Billing.paidAmount 濡ㅻ갚 + ?좎닔湲??섏썝 + 怨꾩빟 ?대젰 蹂댁〈
  const cancelPayment = async (paymentId: string) => {
    const payment = db.payments.find(p => p.id === paymentId);
    if (!payment) return;

    // 1. ?곌껐??PDL 紐⑤몢 ??젣 (?듭옣 ?낃툑?붿븸 ?먮룞 蹂듭썝)
    const linkedLinks = db.paymentDepositLinks.filter(l => l.paymentId === paymentId);
    for (const link of linkedLinks) {
      db.deleteRow('paymentDepositLinks', link.id);
      await db.awaitPendingWrites();
    }

    // 2. ?좎닔湲??곴퀎 ?섎궔 嫄댁씤 寃쎌슦 怨좉컼 ?좎닔湲??붿븸 ?먮룞 ?섏썝
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

    // 3. Payment ??젣
    db.deleteRow('payments', paymentId);
      await db.awaitPendingWrites();

    // 4. Billing paidAmount 諛??곹깭 濡ㅻ갚
    if (billing) {
      const newPaid = Math.max(0, (billing.paidAmount || 0) - payment.amount);
      const bSupply = billing.totalAmount || 0;
      const bGrand = bSupply + Math.round(bSupply * 0.1);
      let newStatus: Billing['status'] = 'UNPAID';
      if (newPaid >= bGrand) newStatus = 'PAID';
      else if (newPaid > 0) newStatus = 'PARTIAL';

      db.updateRow<Billing>(billing.id, {
        paidAmount: newPaid,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // 5. 怨꾩빟 ?대젰(ContractHistory) 臾대늻??湲곕줉
      if (billing.contractId) {
        db.insertRow<ContractHistory>({
          contractId: billing.contractId,
          changeType: 'PAYMENT_CANCELLED',
          changeDate: new Date().toISOString().split('T')[0],
          description: `?섎궔 痍⑥냼 (濡ㅻ갚): ${billing.billingYm} 泥?뎄遺?/ ${payment.amount.toLocaleString()}???섎궔 痍⑥냼 (${payment.method}) (?섎궔???붿븸: ${newPaid.toLocaleString()}?? ?곹깭: ${newStatus})`,
          createdAt: new Date().toISOString()
        });
      }
    }

    refreshAllData();
    await db.awaitPendingWrites();
  };

  // ?뱀젙 泥?뎄?쒖쓽 紐⑤뱺 ?섎궔 ?댁뿭 ?쇨큵 痍⑥냼 諛??꾩쟾 濡ㅻ갚
  const cancelAllPaymentsForBilling = async (billingId: string) => {
    const targetPayments = db.payments.filter(p => p.billingId === billingId);
    for (const p of targetPayments) {
      await cancelPayment(p.id);
    }
  };

  // ?듭옣?낃툑 ?깅줉 (?낃툑?댁뿭?쇰줈 ?섎궔 ?ъ썝 ?깅줉)
  const saveBankDeposit = (data: Omit<BankTransaction, 'id' | 'createdAt' | 'withdrawAmount'>) => {
    db.insertRow<BankTransaction>('bankTransactions', {
      ...data,
      withdrawAmount: 0,
      isDeposit: true,
      createdAt: new Date().toISOString()
    });
    refreshAllData();
  };

  // ?듭옣?낃툑 ??젣 (?곌껐??PaymentDepositLink媛 ?덉쑝硫?李⑤떒)
  const deleteBankDeposit = (txId: string) => {
    const linked = db.paymentDepositLinks.filter(l => l.bankTransactionId === txId);
    if (linked.length > 0) {
      throw new Error(`???낃툑嫄댁뿉 ?곌껐???섎궔 ?댁뿭 ${linked.length}嫄댁씠 議댁옱?⑸땲??\n?섎궔??癒쇱? 痍⑥냼??????젣?섏꽭??`);
    }
    // ??怨좎븘 ?덉퐫??諛⑹?: ?덇굅???⑦꽩 ?섎궔 ?덉퐫??議댁옱 ????젣 李⑤떒
    const legacyPayments = db.payments.filter(p => p.id.startsWith(`pay-matching-${txId}`));
    if (legacyPayments.length > 0) {
      throw new Error(`???낃툑嫄댁뿉 ?곌껐???덇굅???섎궔 湲곕줉 ${legacyPayments.length}嫄댁씠 議댁옱?⑸땲??\n?섎궔??癒쇱? 痍⑥냼??????젣?섏꽭??`);
    }
    db.deleteRow('bankTransactions', txId);
      await db.awaitPendingWrites();
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
    let remainingDeposit = tx.depositAmount;
    const matchedBillingIds: string[] = [];

    if (mode === 'MULTI' && options?.allocations && options.allocations.length > 0) {
      // ?뙚 [MULTI 紐⑤뱶]: ?ъ슜?먭? 吏?뺥븳 泥?뎄?쒕퀎 湲덉븸 諛?媛먯븸 吏곸젒 ?곸슜
      for (const alloc of options.allocations) {
        if (remainingDeposit <= 0 && (!alloc.amount || alloc.amount <= 0)) continue;
        const billing = db.billings.find(b => b.id === alloc.billingId);
        if (!billing) continue;

        const bSup = billing.totalAmount || 0;
        const bGrand = bSup + Math.round(bSup * 0.1);
        const feeAdj = alloc.feeAdjustment || 0;
        const paymentAmount = Math.min(alloc.amount, remainingDeposit);
        remainingDeposit = Math.max(0, remainingDeposit - paymentAmount);

        const payId = `pay-matching-${txId}-${billing.id}`;
        db.insertRow<Payment>('payments', {
          id: payId,
          billingId: billing.id,
          paymentDate: tx.transactionDate.split(' ')[0],
          amount: paymentAmount,
          method: 'BANK_TRANSFER',
          memo: `?ъ슜??遺꾪븷 ?議??섎궔 (${tx.senderName})${feeAdj > 0 ? ` (?섏닔猷?媛먯븸 ??{feeAdj.toLocaleString()})` : ''}`,
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
        db.updateRow<Billing>(billing.id, {
          paidAmount: nextPaid,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        });

        if (billing.contractId) {
          db.insertRow<ContractHistory>({
            contractId: billing.contractId,
            changeType: 'PAYMENT_RECEIVED',
            changeDate: tx.transactionDate.split(' ')[0],
            description: `?섎궔 泥섎━ (?듭옣?議?: ${billing.billingYm} / ${paymentAmount.toLocaleString()}???섎궔 (?꾩쟻: ${nextPaid.toLocaleString()}/${bGrand.toLocaleString()}?? ?곹깭: ${nextStatus})${feeAdj > 0 ? ` (?섏닔猷?媛먯븸 ??{feeAdj.toLocaleString()})` : ''}`,
            createdAt: new Date().toISOString()
          });
        }
        matchedBillingIds.push(billing.id);
      }
    } else if (mode === 'PINPOINT') {
      // ?뙚 [PINPOINT 紐⑤뱶]: ?좏깮???⑥씪 泥?뎄?쒖뿉留??꾩븸 異⑸떦
      const billing = firstBilling;
      const bSup = billing.totalAmount || 0;
      const bGrand = bSup + Math.round(bSup * 0.1);
      const feeAdj = options?.feeAdjustment || 0;
      const unpaidAmount = Math.max(0, bGrand - (billing.paidAmount || 0) - feeAdj);

      const paymentAmount = Math.min(unpaidAmount, remainingDeposit);
      remainingDeposit -= paymentAmount;

      const payId = `pay-matching-${txId}-${billing.id}`;
      db.insertRow<Payment>('payments', {
        id: payId,
        billingId: billing.id,
        paymentDate: tx.transactionDate.split(' ')[0],
        amount: paymentAmount,
        method: 'BANK_TRANSFER',
        memo: `?⑤룆 吏???議??섎궔 (${tx.senderName})${feeAdj > 0 ? ` (?섏닔猷?媛먯븸 ??{feeAdj.toLocaleString()})` : ''}`,
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
      db.updateRow<Billing>(billing.id, {
        paidAmount: nextPaid,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });

      if (billing.contractId) {
        db.insertRow<ContractHistory>({
          contractId: billing.contractId,
          changeType: 'PAYMENT_RECEIVED',
          changeDate: tx.transactionDate.split(' ')[0],
          description: `?섎궔 泥섎━ (?듭옣?議??⑤룆): ${billing.billingYm} / ${paymentAmount.toLocaleString()}???섎궔 (?꾩쟻: ${nextPaid.toLocaleString()}/${bGrand.toLocaleString()}?? ?곹깭: ${nextStatus})${feeAdj > 0 ? ` (?섏닔猷?媛먯븸 ??{feeAdj.toLocaleString()})` : ''}`,
          createdAt: new Date().toISOString()
        });
      }
      matchedBillingIds.push(billing.id);
    } else {
      // ?뙚 [CASCADE 紐⑤뱶]: 怨쇨굅 誘몄닔遺???쒖감 異⑸떦 (?섏닔猷?媛먯븸 ?듭뀡 ?ы븿)
      const activeBillings = db.billings
        .filter(b => b.customerId === customerId && (b.status === 'UNPAID' || b.status === 'PARTIAL'))
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

        const payId = `pay-matching-${txId}-${billing.id}`;
        db.insertRow<Payment>('payments', {
          id: payId,
          billingId: billing.id,
          paymentDate: tx.transactionDate.split(' ')[0],
          amount: paymentAmount,
          method: 'BANK_TRANSFER',
          memo: `${matchingType === 'AUTO' ? '?먮룞' : '?섎룞'} ?쒖감 ?議??섎궔 (${tx.senderName})${feeAdjForThis > 0 ? ` (?섏닔猷?媛먯븸 ??{feeAdjForThis.toLocaleString()})` : ''}`,
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
        db.updateRow<Billing>(billing.id, {
          paidAmount: nextPaid,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        });

        if (billing.contractId) {
          db.insertRow<ContractHistory>({
            contractId: billing.contractId,
            changeType: 'PAYMENT_RECEIVED',
            changeDate: tx.transactionDate.split(' ')[0],
            description: `?섎궔 泥섎━ (${matchingType === 'AUTO' ? '?듭옣?議??먮룞' : '?듭옣?議??쒖감'}): ${billing.billingYm} / ${paymentAmount.toLocaleString()}???섎궔 (?꾩쟻: ${nextPaid.toLocaleString()}/${bGrand.toLocaleString()}?? ?곹깭: ${nextStatus})${feeAdjForThis > 0 ? ` (?섏닔猷?媛먯븸 ??{feeAdjForThis.toLocaleString()})` : ''}`,
            createdAt: new Date().toISOString()
          });
        }

        matchedBillingIds.push(billing.id);
      }
    }

    // 2. ?⑥? 珥덇낵湲??좎닔湲??곷┰ (怨쇰??낃툑 ?꾨꼍 ?섏? 蹂댁〈)
    if (remainingDeposit > 0) {
      const customer = db.customers.find(c => c.id === customerId);
      if (customer) {
        const prevPrepaid = customer.prepaidBalance || 0;
        db.updateRow<Customer>('customers', customerId, {
          prepaidBalance: prevPrepaid + remainingDeposit,
          updatedAt: new Date().toISOString()
        } as any);

        const prepaidPayId = `pay-matching-${txId}-prepaid`;
        // ?좎닔湲?媛???섎궔 ?꾪몴 ?깅줉
        db.insertRow<Payment>('payments', {
          id: prepaidPayId,
          billingId: '',
          paymentDate: tx.transactionDate.split(' ')[0],
          amount: remainingDeposit,
          method: 'BANK_TRANSFER',
          memo: `?듭옣 ?議?留ㅼ묶 珥덇낵 ?좎닔湲??곷┰ (${tx.senderName})`,
          createdAt: new Date().toISOString()
        });

        // ?뙚 ?좎닔湲??꾪몴????댁꽌??PaymentDepositLink瑜??깅줉?섏뿬 ?듭옣 ?낃툑 ?ъ슜 異붿쟻 ?꾨꼍 ?쇱튂??
        db.insertRow<PaymentDepositLink>('paymentDepositLinks', {
          paymentId: prepaidPayId,
          bankTransactionId: txId,
          usedAmount: remainingDeposit,
          createdAt: new Date().toISOString()
        });
      }
    }

    // 3. 嫄곕옒 ?댁뿭 ?곹깭 蹂寃?
    db.updateRow<BankTransaction>('bankTransactions', txId, {
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

    const cleanName = (n: string) => (n || '').replace(/\(二?)|二쇱떇?뚯궗|\s+/g, '').toLowerCase();
    const cleanSender = cleanName(tx.senderName);

    const rule = db.bankMatchingRules.find(r => r.senderName === tx.senderName);
    if (rule) {
      const activeBillings = db.billings.filter(b => 
        b.customerId === rule.customerId && 
        (b.status === 'UNPAID' || b.status === 'PARTIAL')
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
        (b.status === 'UNPAID' || b.status === 'PARTIAL')
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
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const unmatchTransaction = async (txId: string) => {
    const tx = db.bankTransactions.find(t => t.id === txId);
    if (!tx) return;

    // customerId ?앸퀎 (泥?뎄?? 留ㅼ묶洹쒖튃, 嫄곕옒泥???텛??
    const linkedLinks = db.paymentDepositLinks.filter(l => l.bankTransactionId === txId);
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
      const cleanSender = (tx.senderName || '').replace(/\(二?)|二쇱떇?뚯궗|\s+/g, '').toLowerCase();
      customerId = db.customers.find(c => {
        const cClean = (c.name || '').replace(/\(二?)|二쇱떇?뚯궗|\s+/g, '').toLowerCase();
        return cleanSender && cClean && (cleanSender.includes(cClean) || cClean.includes(cleanSender));
      })?.id;
    }

    // 1. paymentDepositLinks 湲곕컲 濡ㅻ갚 (?좉퇋 泥닿퀎)
    linkedLinks.forEach(link => {
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
            db.updateRow<Billing>(billing.id, {
              paidAmount: nextPaid,
              status: nextStatus,
              updatedAt: new Date().toISOString()
            });

            if (billing.contractId) {
              db.insertRow<ContractHistory>({
                contractId: billing.contractId,
                changeType: 'PAYMENT_CANCELLED',
                changeDate: new Date().toISOString().split('T')[0],
                description: `?섎궔 ?議??댁젣: ${billing.billingYm} 泥?뎄遺?/ ${link.usedAmount.toLocaleString()}???섎궔 痍⑥냼 (?붿뿬: ${nextPaid.toLocaleString()}?? ?곹깭: ${nextStatus})`,
                createdAt: new Date().toISOString()
              });
            }
          }
        } else if (pay.id.endsWith('-prepaid') || !pay.billingId) {
          // 珥덇낵 ?좎닔湲??섏썝 李④컧
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

        if (pay.id.startsWith(`pay-matching-${txId}`)) {
          db.deleteRow('payments', pay.id);
      await db.awaitPendingWrites();
        } else {
          const newAmount = Math.max(0, pay.amount - link.usedAmount);
          if (newAmount === 0) {
            db.deleteRow('payments', pay.id);
      await db.awaitPendingWrites();
          } else {
            db.updateRow<Payment>('payments', pay.id, { amount: newAmount, updatedAt: new Date().toISOString() });
          }
        }
      }
      db.deleteRow('paymentDepositLinks', link.id);
      await db.awaitPendingWrites();
    });

    // 2. ?덇굅??ID ?⑦꽩(`pay-matching-${txId}`)?쇰줈 ?붿〈?섎뒗 ?섎궔 ?꾪몴 寃??諛?濡ㅻ갚
    const matchPrefix = `pay-matching-${txId}`;
    const associatedPayments = db.payments.filter(p => p.id.startsWith(matchPrefix));

    associatedPayments.forEach(pay => {
      if (pay.billingId) {
        const billing = db.billings.find(b => b.id === pay.billingId);
        if (billing) {
          const bSup = billing.totalAmount || 0;
          const bGrand = bSup + Math.round(bSup * 0.1);
          const feeAdj = pay.feeAdjustment || 0;
          const nextPaid = Math.max(0, (billing.paidAmount || 0) - pay.amount - feeAdj);
          const nextStatus: Billing['status'] = nextPaid === 0 ? 'UNPAID' : (nextPaid >= bGrand ? 'PAID' : 'PARTIAL');
          db.updateRow<Billing>(billing.id, {
            paidAmount: nextPaid,
            status: nextStatus,
            updatedAt: new Date().toISOString()
          });

          if (billing.contractId) {
            db.insertRow<ContractHistory>({
              contractId: billing.contractId,
              changeType: 'PAYMENT_CANCELLED',
              changeDate: new Date().toISOString().split('T')[0],
              description: `?섎궔 ?議??댁젣(?덇굅??: ${billing.billingYm} 泥?뎄遺?/ ${pay.amount.toLocaleString()}???섎궔 痍⑥냼 (?붿뿬: ${nextPaid.toLocaleString()}?? ?곹깭: ${nextStatus})`,
              createdAt: new Date().toISOString()
            });
          }
        }
      } else if (customerId) {
        const customer = db.customers.find(c => c.id === customerId);
        if (customer) {
          db.updateRow<Customer>('customers', customerId, {
            prepaidBalance: Math.max(0, (customer.prepaidBalance || 0) - pay.amount),
            updatedAt: new Date().toISOString()
          } as any);
        }
      }
      db.deleteRow('payments', pay.id);
      await db.awaitPendingWrites();
    });

    // 3. 嫄곕옒 ?뺣낫 蹂듦뎄
    db.updateRow<BankTransaction>('bankTransactions', txId, {
      matchedBillingId: '',
      matchingType: undefined,
      updatedAt: new Date().toISOString()
    } as any);

    await db.awaitPendingWrites();
    refreshAllData();
  };

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
      await db.awaitPendingWrites();
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
    await db.awaitPendingWrites();
    refreshAllData();
  };

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
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const addLeaveUsage = async (usage: Omit<LeaveUsage, 'id' | 'createdAt'>) => {
    const newLeave = db.insertRow<LeaveUsage>('leaveUsages', {
      ...usage,
      createdAt: new Date().toISOString()
    } as any);

    // ?? [?⑥씪 ?낅Т ?멸퀎 ?뚯씠?꾨씪?? 遺?쒖옣?먭쾶 ?닿? ?뱀씤 ToDo 諛쒗뻾
    const applicant = db.users.find(u => u.id === usage.userId);
    await issueHandoverTask({
      category: 'LEAVE_OT_APPROVAL',
      title: `[?닿? ?뱀씤 ?붾쭩] ${applicant?.name || '?꾩쭅??} (${usage.leaveType || '?곗감'})`,
      content: `${applicant?.name || '?꾩쭅??} ?닿? ?좎껌 (${usage.startDate} ~ ${usage.endDate}, ${usage.usedDays}??. ?ъ쑀: ${usage.reason || '-'}`,
      targetRole: 'MANAGER',
      priority: 'NORMAL',
      actionUrl: '/admin/leave_management',
      entityType: 'LEAVE',
      entityId: newLeave.id,
      senderId: currentUser?.id,
      senderName: currentUser?.name
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const deleteLeaveUsage = async (id: string) => {
    db.deleteRow('leaveUsages', id);
      await db.awaitPendingWrites();
    await clearHandoverTasks({
      entityType: 'LEAVE',
      entityId: id,
      completionAction: 'LEAVE_DELETED'
    });
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const addOvertimeRecord = async (record: Omit<OvertimeRecord, 'id' | 'createdAt'>) => {
    const newOt = db.insertRow<OvertimeRecord>('overtimeRecords', {
      ...record,
      createdAt: new Date().toISOString()
    } as any);

    const applicant = db.users.find(u => u.id === record.userId);
    await issueHandoverTask({
      category: 'LEAVE_OT_APPROVAL',
      title: `[珥덇낵洹쇰Т ?뱀씤 ?붾쭩] ${applicant?.name || '?꾩쭅??} (${record.hours}?쒓컙)`,
      content: `${applicant?.name || '?꾩쭅??} ?곗옣/?쇨컙 洹쇰Т ?좎껌 (${record.startDateTime?.substring(0, 10)}, ${record.hours}?쒓컙). ?ъ쑀: ${record.workDetail || '-'}`,
      targetRole: 'MANAGER',
      priority: 'NORMAL',
      actionUrl: '/admin/ot_management',
      entityType: 'OT',
      entityId: newOt.id,
      senderId: currentUser?.id,
      senderName: currentUser?.name
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const deleteOvertimeRecord = async (id: string) => {
    db.deleteRow('overtimeRecords', id);
      await db.awaitPendingWrites();
    await clearHandoverTasks({
      entityType: 'LEAVE',
      entityId: id,
      completionAction: 'OT_DELETED'
    });
    await db.awaitPendingWrites();
    refreshAllData();
  };

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
    await db.awaitPendingWrites();
    refreshAllData();
  };

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
    db.updateRow<Delivery>('deliveries', deliveryId, {
      scheduledDate: dispatchData.scheduledDate,
      transportCompany: dispatchData.transportCompany,
      vehicleType: dispatchData.vehicleType,
      vehicleNo: dispatchData.vehicleNo,
      driverName: dispatchData.driverName,
      driverContact: dispatchData.driverContact,
      deliveryCost: dispatchData.deliveryCost,
      vehicles: dispatchData.vehiclesJson,
      status: 'DISPATCHED',
      updatedAt: new Date().toISOString()
    });
    refreshAllData();

    // ?뱼 諛곗감 ?꾨즺 ??愿??遺???곸뾽/異쒓퀬/愿由?寃쎌쁺)???뚮┝ 釉뚮줈?쒖틦?ㅽ듃
    const dObj = db.deliveries.find(d => d.id === deliveryId);
    const dContract = dObj?.contractId ? db.contracts.find(c => c.id === dObj.contractId) : null;
    const dCust = dContract ? db.customers.find(c => c.id === dContract.customerId)?.name : '';
    const dSite = dContract ? db.sites.find(s => s.id === dContract.siteId)?.name : '';
    broadcastWorkNotification({
      type: 'DISPATCH',
      title: '諛곗감 ?꾨즺 ?덈궡',
      body: `${dCust || '?꾩옣'} (${dSite || '諛곗감'}) ${dispatchData.driverName || '湲곗궗'} (${dispatchData.vehicleType || '?붾Ъ'}) 諛곗감 ?꾨즺`,
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

    db.updateRow<Delivery>('deliveries', deliveryId, {
      status: 'COMPLETED',
      updatedAt: new Date().toISOString()
    });

    const contract = delivery.contractId ? db.contracts.find(c => c.id === delivery.contractId) : null;
    const customer = contract ? db.customers.find(c => c.id === contract.customerId) : null;
    const site = contract ? db.sites.find(s => s.id === contract.siteId) : null;

    // INBOUND (?뚯닔) ?꾨즺 ???λ퉬瑜??湲곗쨷(AVAILABLE)?쇰줈 蹂듭썝 諛?怨꾩빟 ?꾨즺 泥섎━
    if (delivery.type === 'INBOUND' && delivery.contractId) {
      const cAssets = db.contractAssets.filter(ca => ca.contractId === delivery.contractId);
      cAssets.forEach(ca => {
        if (ca.assetId) {
          const asset = db.assets.find(a => a.id === ca.assetId);
          db.updateRow<Asset>('assets', ca.assetId, {
            status: 'AVAILABLE',
            currentCustomerId: '',
            currentSiteId: '',
            contractStart: '',
            contractEnd: '',
            monthlyRentalFee: 0,
            dailyRentalFee: 0,
            updatedAt: new Date().toISOString()
          });

          if (asset) {
            // ?낃퀬 ?대젰 異붽? (湲곕낯 ?먯닔 0, ?뱀씠?ы빆 ?놁쓬)
            db.insertRow<AssetInOutLog>('assetInOutLogs', {
              assetId: asset.id,
              assetNo: asset.assetNo,
              modelName: asset.modelName,
              type: 'INBOUND',
              eventDate: new Date().toISOString().split('T')[0],
              customerId: contract?.customerId,
              customerName: customer?.name || '',
              siteId: contract?.siteId,
              siteName: site?.name || '',
              deliveryId: deliveryId,
              maintenanceScore: asset.maintenanceScore || 0,
              memo: '?쇰컲 諛곗감 諛섎궔 ?낃퀬',
              createdAt: new Date().toISOString()
            });
          }
        }
      });

      db.updateRow<Contract>('contracts', delivery.contractId, {
        status: 'COMPLETED',
        updatedAt: new Date().toISOString()
      });
    }

    // OUTBOUND (異쒓퀬) ?꾨즺 ??怨꾩빟 ?쒖꽦??諛?異쒓퀬 ?대젰 ?앹꽦
    if (delivery.type === 'OUTBOUND' && delivery.contractId) {
      if (contract && contract.status !== 'COMPLETED') {
        db.updateRow<Contract>('contracts', delivery.contractId, {
          status: 'ACTIVE',
          updatedAt: new Date().toISOString()
        });

        // OUTBOUND 濡쒓렇 異붽? (以묐났 諛⑹? 媛??
        const cAssets = db.contractAssets.filter(ca => ca.contractId === delivery.contractId);
        cAssets.forEach(ca => {
          if (ca.assetId) {
            const asset = db.assets.find(a => a.id === ca.assetId);
            if (asset) {
              const alreadyLogged = db.assetInOutLogs.some(
                l => l.assetId === asset.id && l.type === 'OUTBOUND' && l.deliveryId === deliveryId
              );
              if (!alreadyLogged) {
                db.insertRow<AssetInOutLog>('assetInOutLogs', {
                  assetId: asset.id,
                  assetNo: asset.assetNo,
                  modelName: asset.modelName,
                  type: 'OUTBOUND',
                  eventDate: delivery.scheduledDate || new Date().toISOString().split('T')[0],
                  customerId: contract.customerId,
                  customerName: customer?.name || '',
                  siteId: contract.siteId,
                  siteName: site?.name || '',
                  deliveryId: deliveryId,
                  createdAt: new Date().toISOString()
                });
              }
            }
          }
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

      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: asset.id,
        assetNo: asset.assetNo,
        modelName: asset.modelName,
        type: 'INBOUND',
        eventDate: actualReturnDate,
        customerId: contract?.customerId || '',
        customerName: customer?.name || '',
        siteId: contract?.siteId || '',
        siteName: site?.name || '',
        deliveryId: deliveryId,
        maintenanceScore: review.maintenanceScore,
        memo: review.memo,
        createdAt: new Date().toISOString()
      });

      if (review.status === 'REPAIRING') {
        db.insertRow<Repair>('repairs', {
          assetId: asset.id,
          details: `?낃퀬 寃?????깅줉?? ${review.memo}`,
          status: 'PENDING',
          requestDate: actualReturnDate,
          totalCost: 0,
          billableToCustomer: false,
          isCustomerFault: true,
          faultImageUrl: review.faultImageUrl || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });

    if (delivery.contractId) {
      const isExchange = delivery.type === 'EXCHANGE' || delivery.dispatchCategory === '援먰솚';
      const reviewedAssetIds = reviews.map(r => r.assetId);
      const cAssets = db.contractAssets.filter(ca => ca.contractId === delivery.contractId);

      if (isExchange) {
        // 援먰솚(EXCHANGE) 諛곗감: 怨꾩빟? 怨꾩냽 吏꾪뻾(ACTIVE)?섎?濡??꾨즺?쒗궎吏 ?딆쓬
        // ?뚯닔 寃?섎맂 ?λ퉬 ?щ’留?RETURNED 泥섎━ (?李⑤줈 ?ъ엯???λ퉬??怨꾩냽 RENTED ?좎?)
        cAssets.forEach(ca => {
          if (ca.assetId && reviewedAssetIds.includes(ca.assetId)) {
            db.updateRow<ContractAsset>('contractAssets', ca.id, {
              status: 'RETURNED',
              actualReturnDate: ca.actualReturnDate || actualReturnDate,
              updatedAt: new Date().toISOString()
            });
          }
        });
      } else {
        // ?쇰컲 ?낃퀬/諛섎궔 諛곗감: 寃?섎맂 ?먯궛 ?щ’ RETURNED 泥섎━
        cAssets.forEach(ca => {
          if (reviewedAssetIds.length === 0 || (ca.assetId && reviewedAssetIds.includes(ca.assetId))) {
            db.updateRow<ContractAsset>('contractAssets', ca.id, {
              status: 'RETURNED',
              actualReturnDate: ca.actualReturnDate || actualReturnDate,
              updatedAt: new Date().toISOString()
            });
          }
        });

        // 怨꾩빟???⑥? ???泥닿껐 ?먯궛 ?щ’???덈뒗吏 ?뺤씤
        const remainingActiveAssets = cAssets.filter(ca => 
          !(ca.assetId && reviewedAssetIds.includes(ca.assetId)) && ca.status !== 'RETURNED'
        );

        // 紐⑤뱺 ?λ퉬媛 ?뚯닔 ?꾨즺?섏뿀???뚮쭔 怨꾩빟??COMPLETED濡?醫낅즺
        if (remainingActiveAssets.length === 0) {
          db.updateRow<Contract>('contracts', delivery.contractId, {
            status: 'COMPLETED',
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  // ?뮕 [?ъ옣??吏?? ?낃퀬 ?깅줉 (?낃퀬踰덊샇, ?섏쐞踰덊샇 INB-XXXX-01, 利앹긽蹂??ъ쭊 諛??먯궛?뺣퉬?섎━ ?먮룞?곕룞, 遺덈웾 ??REPAIRING ?꾪솚)
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
    if (!asset) throw new Error('?대떦 ?먯궛??李얠쓣 ???놁뒿?덈떎.');

    // ???以묒씤 怨꾩빟 ?먯궛 ?먯깋 (?좎뿰 留ㅼ묶: RENTED ?곗꽑 ?먯깋 ??誘몃컲??泥닿껐 怨꾩빟 ?ш큵 ?먯깋)
    const ca = db.contractAssets.find(c => c.assetId === data.assetId && c.status === 'RENTED') ||
               db.contractAssets.find(c => c.assetId === data.assetId && c.status !== 'RETURNED') ||
               db.contractAssets.find(c => c.assetId === data.assetId);
    const contract = ca ? db.contracts.find(ct => ct.id === ca.contractId) : null;
    const customer = contract ? db.customers.find(cu => cu.id === contract.customerId) : null;
    const site = contract ? db.sites.find(s => s.id === contract.siteId) : null;

    const score = data.maintenanceScore || 0;
    const hasDefect = score > 0 || (data.defects && data.defects.length > 0) || Boolean(data.otherDefectText);
    // ?먯궛 ?곹깭: ?먯닔 0?먯씠怨?寃고븿 ?놁쑝硫?AVAILABLE(?꾨?媛??, ?댁긽 ??REPAIRING(?뺣퉬以? ?먮뒗 ?꾨떖??targetAssetStatus
    const nextAssetStatus: Asset['status'] = data.targetAssetStatus || (!hasDefect ? 'AVAILABLE' : 'REPAIRING');

    // ?뮕 [?낃퀬 踰덊샇 梨꾨쾲]
    const assignedInboundNo = data.inboundNo || db.generateNextId('inboundNo', db.assetInOutLogs as any);

    // ?뮕 [遺덈웾 利앹긽 ?섏쐞 踰덊샇 寃고빀 (?? INB-20260809-001-01)]
    const processedDefects: InboundDefectDetail[] = (data.defects || []).map((d, idx) => ({
      ...d,
      subNo: d.subNo || `${assignedInboundNo}-${String(idx + 1).padStart(2, '0')}`
    }));

    const defectsJsonStr = processedDefects.length > 0 ? JSON.stringify(processedDefects) : undefined;
    const defectSummary = processedDefects.map(d => `[${d.subNo}] ${d.checkitemName}(+${d.score}??`).join(', ');
    const fullDefectSummary = [defectSummary, data.otherDefectText ? `[湲고?] ${data.otherDefectText}` : ''].filter(Boolean).join(' | ');

    // 1. ?먯궛 留덉뒪??媛깆떊 (?뺣퉬?꾩슂??ぉ note ???
    db.updateRow<Asset>('assets', asset.id, {
      status: nextAssetStatus,
      maintenanceScore: score,
      note: hasDefect ? fullDefectSummary : (score === 0 ? '?뺤긽 ?낃퀬 ?먭? ?꾨즺' : asset.note),
      currentCustomerId: '',
      currentSiteId: '',
      contractStart: '',
      contractEnd: '',
      updatedAt: new Date().toISOString()
    });

    // 2. 怨꾩빟 ?먯궛 諛섎궔 媛깆떊
    if (ca) {
      db.updateRow<ContractAsset>('contractAssets', ca.id, {
        status: 'RETURNED',
        actualReturnDate: data.returnDate,
        updatedAt: new Date().toISOString()
      });
    }

    // 3. ?먯궛 ?뺣퉬?섎━ ????곕룞 (寃고븿 諛쒖깮 ???먮룞 PENDING ?뺣퉬 嫄?諛쒗뻾)
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
        customerName: customer?.name || '?낃퀬 ?먭?泥?,
        siteId: site?.id,
        siteName: site?.name || '二쇨린??,
        requestDate: data.returnDate,
        status: 'PENDING',
        workCategory: 'YARD_INTERNAL',
        workLocation: 'YARD',
        source: 'INBOUND_INSPECTION',
        details: `?낃퀬寃???먮룞 ?뺣퉬 ?묒닔: ${assignedInboundNo}\n?뺣퉬 ?꾩슂 ??ぉ: ${fullDefectSummary}\n鍮꾧퀬: ${data.memo || '?댁긽 臾?}`,
        totalCost: 0,
        billableToCustomer: false,
        inboundNo: assignedInboundNo,
        defectsJson: defectsJsonStr,
        evidenceImages: data.photos || [],
        targetAssetStatus: 'REPAIRING',
        inspectionItemCode: processedDefects.length > 0 ? processedDefects.map(d => d.checkitemId).join(',') : undefined,
        degradationScore: score,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // ?? [?⑥씪 ?낅Т ?멸퀎 ?뚯씠?꾨씪?? 二쇨린???뺣퉬????낃퀬 ?뺣퉬 ToDo ?곸옱
      await issueHandoverTask({
        category: 'INBOUND_REPAIR_DEFECT',
        title: `[?낃퀬 ?λ퉬 ?뺣퉬] ${asset.assetNo} (${asset.modelName})`,
        content: `?낃퀬 寃고븿 諛쒓껄 (+${score}??: ${fullDefectSummary || '?뺣퉬 ?붾쭩'}`,
        targetDept: 'YARD',
        priority: score >= 5 ? 'HIGH' : 'NORMAL',
        actionUrl: '/repairs',
        entityType: 'REPAIR',
        entityId: repairId,
        senderId: currentUser?.id,
        senderName: currentUser?.name
      });
    }

    // ?윟 ?뚯닔 諛곗감 諛?愿???좏뻾 ToDo ?먮룞 ?곴퀎
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

    // 4. ?먯궛 ?낆텧怨??대젰 臾대늻??湲곕줉 (INBOUND)
    db.insertRow<AssetInOutLog>('assetInOutLogs', {
      assetId: asset.id,
      assetNo: asset.assetNo,
      modelName: asset.modelName,
      type: 'INBOUND',
      inboundNo: assignedInboundNo,
      eventDate: data.returnDate,
      customerId: customer?.id || '',
      customerName: customer?.name || '',
      siteId: site?.id || '',
      siteName: site?.name || '',
      repairId: createdRepairId,
      maintenanceScore: score,
      defectsJson: defectsJsonStr,
      memo: data.memo || (hasDefect ? `遺덈웾 ?낃퀬 ?깅줉 (${fullDefectSummary})` : '?뺤긽 ?낃퀬 ?깅줉 ?꾧껐'),
      createdAt: new Date().toISOString()
    });

    await db.awaitPendingWrites();
    refreshAllData();
  };

  // ?뮕 [?ъ옣??吏?? ?낃퀬 痍⑥냼 濡ㅻ갚 (?대㉫?먮윭 蹂듭썝 諛?INBOUND_CANCEL ?덉뒪?좊━ 臾대늻?????
  const cancelInboundAsset = async (logId: string, cancelReason?: string) => {
    const log = db.assetInOutLogs.find(l => l.id === logId && l.type === 'INBOUND');
    if (!log) throw new Error('?대떦 ?낃퀬 ?대젰 濡쒓렇瑜?李얠쓣 ???녾굅???대? 痍⑥냼??嫄댁엯?덈떎.');

    const asset = db.assets.find(a => a.id === log.assetId);
    if (!asset) throw new Error('?곌? ?먯궛??李얠쓣 ???놁뒿?덈떎.');

    // 1. ?먯궛 ?곹깭 RENTED(??ъ쨷)濡?蹂듭썝
    db.updateRow<Asset>('assets', asset.id, {
      status: 'RENTED',
      currentCustomerId: log.customerId || asset.currentCustomerId,
      currentSiteId: log.siteId || asset.currentSiteId,
      updatedAt: new Date().toISOString()
    });

    // 2. 怨꾩빟 泥닿껐 ?먯궛 RENTED(??ъ쨷)濡?蹂듭썝
    const ca = db.contractAssets.find(c => c.assetId === asset.id);
    if (ca) {
      db.updateRow<ContractAsset>('contractAssets', ca.id, {
        status: 'RENTED',
        actualReturnDate: undefined,
        updatedAt: new Date().toISOString()
      });
    }

    // 3. 湲곗〈 ?ㅻ벑濡??낃퀬 濡쒓렇 ??젣 諛?怨꾩빟 ?대젰??濡ㅻ갚 濡쒓렇 臾대늻???앹꽦
    db.deleteRow('assetInOutLogs', logId);
      await db.awaitPendingWrites();

    if (ca?.contractId) {
      db.insertRow<ContractHistory>({
        contractId: ca.contractId,
        changeType: 'TERMINATE',
        changeDate: new Date().toISOString().split('T')[0],
        description: `[?낃퀬 痍⑥냼 濡ㅻ갚] ?먯궛(${asset.assetNo}) ?ㅻ벑濡??낃퀬 痍⑥냼 ????ъ쨷(RENTED) 蹂듭썝 (?ъ쑀: ${cancelReason || '?ъ슜???대㉫?먮윭 ?낃퀬 痍⑥냼'})`,
        createdAt: new Date().toISOString()
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const registerRepair = async (repairData: Partial<Repair>, usedConsumables: { consumableId: string; quantity: number }[]) => {
    const repairId = repairData.id || db.generateNextId('repairs', db.repairs);
    const totalRepairCost = repairData.totalCost ?? 0;
    const maintenanceType = repairData.maintenanceType || (repairData.repairType === 'EXTERNAL' ? 'EXTERNAL' : 'INHOUSE_REPAIR');
    const repairStatus = repairData.status || 'COMPLETED';

    const targetAsset = db.assets.find(a => a.id === repairData.assetId);
    let resolvedCustomerName = repairData.customerName || '';
    let resolvedSiteName = repairData.siteName || '';
    let resolvedContractId = repairData.contractId;

    // ??ъ쨷 ?λ퉬??寃쎌슦 ?꾩옱 怨꾩빟??怨좉컼???꾩옣 ?먮룞 留ㅽ븨
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
        assetNo: targetAsset?.assetNo || repairData.assetNo || '?꾩옣?뺤씤',
        modelName: targetAsset?.modelName || repairData.modelName || '怨좎냼?묒뾽?',
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

    // ?뚮え???ш퀬 李④컧: 二쇨린???뺣퉬(YARD)?닿굅??stockSource媛 YARD_STOCK/CENTRAL_HQ??寃쎌슦 二쇨린???ш퀬?먯꽌 ?곗꽑 李④컧
    const isYardDepotRepair = repairData.workLocation === 'YARD' || repairData.stockSource === 'YARD_STOCK' || repairData.stockSource === 'CENTRAL_HQ' || maintenanceType === 'INHOUSE_REPAIR';
    const effectiveMechanicId = repairData.mechanicId || currentUser?.id;
    const mechanic = db.users.find(u => u.id === effectiveMechanicId);
    const mechanicName = mechanic?.name || '?뺣퉬??;

    usedConsumables.forEach(uc => {
      const consumable = db.consumables.find(c => c.id === uc.consumableId);
      if (!consumable) return;

      const mechanicStock = (!isYardDepotRepair && effectiveMechanicId)
        ? db.mechanicConsumableStocks.find(s => s.mechanicId === effectiveMechanicId && s.consumableId === uc.consumableId)
        : null;

      if (mechanicStock && mechanicStock.stockQty >= uc.quantity) {
        // 1. 湲곗궗 李⑤웾 ?ш퀬?먯꽌 李④컧 (?꾩옣 異쒖옣 AS??寃쎌슦)
        db.updateRow<MechanicConsumableStock>('mechanicConsumableStocks', mechanicStock.id, {
          stockQty: mechanicStock.stockQty - uc.quantity,
          updatedAt: new Date().toISOString()
        });

        db.insertRow<ConsumableLog>('consumableLogs', {
          consumableId: consumable.id,
          type: 'OUTBOUND',
          quantity: uc.quantity,
          unitPrice: consumable.unitPrice,
          targetAssetId: repairData.assetId,
          userId: currentUser?.id,
          mechanicId: effectiveMechanicId,
          fromLocation: `${mechanicName} 李⑤웾`,
          toLocation: `?꾩옣 ?λ퉬(${targetAsset?.assetNo || 'N/A'})`,
          actionDate: repairData.repairDate || new Date().toISOString().split('T')[0],
          description: `[李⑤웾?ш퀬 ?뚯쭊] ?뺣퉬(${repairId}) ${mechanicName} 李⑤웾?먯꽌 ?꾩옣 ?ъ엯`,
          createdAt: new Date().toISOString()
        });
      } else {
        // 2. 二쇨린???ш퀬?먯꽌 李④컧 (二쇨린???뺣퉬 ?먮뒗 蹂몄궗 遺덉텧)
        const nextQty = Math.max(0, (consumable.stockQty || 0) - uc.quantity);
        db.updateRow<Consumable>('consumables', consumable.id, {
          stockQty: nextQty,
          updatedAt: new Date().toISOString()
        });

        db.insertRow<ConsumableLog>('consumableLogs', {
          consumableId: consumable.id,
          type: 'OUTBOUND',
          quantity: uc.quantity,
          unitPrice: consumable.unitPrice,
          targetAssetId: repairData.assetId,
          userId: currentUser?.id,
          fromLocation: '二쇨린???ш퀬',
          toLocation: `二쇨린???λ퉬(${targetAsset?.assetNo || 'N/A'})`,
          actionDate: repairData.repairDate || new Date().toISOString().split('T')[0],
          description: `[二쇨린???ш퀬 ?ъ엯] ?뺣퉬(${repairId}) 二쇨린???섎━ 遺???ъ엯`,
          createdAt: new Date().toISOString()
        });
      }

      db.insertRow<RepairConsumable>('repairConsumables', {
        repairId,
        consumableId: uc.consumableId,
        quantity: uc.quantity,
        unitPrice: consumable.unitPrice,
        cost: consumable.unitPrice * uc.quantity
      });
    });

    // ?룢截??먯궛 ?곹깭 ?쇱씠?꾩궗?댄겢 臾댁솢怨??뺥빀??蹂댁옣 (?뚯옣 移댄뀒怨좊━ 1.2, 1.3)
    if (targetAsset) {
      const isRentedAsset = targetAsset.status === 'RENTED';
      const isFieldAS = maintenanceType === 'EMERGENCY_AS' || maintenanceType === 'PREVENTIVE';

      let nextAssetStatus: Asset['status'] = targetAsset.status;
      let nextMaintenanceScore = targetAsset.maintenanceScore || 0;

      if (isRentedAsset && isFieldAS) {
        // ?슚 ?꾨?以??꾩옣 異쒖옣?뺣퉬: ?λ퉬???꾩옣??怨꾩냽 ?덉쑝誘濡?'RENTED' ?곹깭 100% 蹂댁〈!
        nextAssetStatus = 'RENTED';
        if (repairStatus === 'COMPLETED') {
          nextMaintenanceScore = 0; // ?뺣퉬 ?꾨즺 ???댁긽臾?由ъ뀑
        }
      } else if (repairData.targetAssetStatus) {
        // ?뙚 二쇨린???뺣퉬 ?먯젙 紐낆떆???꾩씠 (AVAILABLE, REPAIRING ??
        nextAssetStatus = repairData.targetAssetStatus;
        if (nextAssetStatus === 'AVAILABLE') {
          nextMaintenanceScore = 0; // ?꾨?媛??蹂듦? ???뺣퉬?먯닔 珥덇린??
        }
      } else if (repairStatus === 'COMPLETED' && (targetAsset.status === 'REPAIRING' || targetAsset.status === 'RENTED_RETURNED')) {
        // 湲곕낯媛? ?낃퀬寃???섎━以??λ퉬???뺣퉬 ?꾨즺 ??AVAILABLE濡??먮룞 ?꾩씠
        nextAssetStatus = 'AVAILABLE';
        nextMaintenanceScore = 0;
      }

      let nextNote = targetAsset.note;
      if (repairStatus === 'COMPLETED' && nextAssetStatus === 'AVAILABLE') {
        const dateTag = repairData.repairDate || new Date().toISOString().split('T')[0];
        const detailSnippet = repairData.details ? repairData.details.slice(0, 30) : '?먭? ?꾨즺';
        nextNote = `[?뺣퉬?꾨즺 ${dateTag}] ${detailSnippet}`;
      }

      db.updateRow<Asset>('assets', targetAsset.id, {
        status: nextAssetStatus,
        maintenanceScore: nextMaintenanceScore,
        cumRepairCost: (targetAsset.cumRepairCost || 0) + totalRepairCost,
        note: nextNote,
        updatedAt: new Date().toISOString()
      });

      // ?뺣퉬 ?섎━ ?대젰 濡쒓렇 (AssetInOutLog) 臾대늻??湲곕줉
      const typeLabel = maintenanceType === 'EMERGENCY_AS' ? '湲닿툒異쒖옣?뺣퉬' :
        maintenanceType === 'PREVENTIVE' ? '?뺢린?덈갑?뺣퉬' :
        maintenanceType === 'EXTERNAL' ? '?몄＜?뺣퉬' : '?쇱쟻?μ옄?ъ젙鍮?;

      let memoText = `[${typeLabel}] `;
      if (repairStatus === 'COMPLETED') {
        memoText += `?뺣퉬 ?꾨즺 (鍮꾩슜: ${totalRepairCost.toLocaleString()}?? ???먯궛?곹깭 [${nextAssetStatus}] ?꾩씠: ${repairData.details || ''}`;
      } else if (repairStatus === 'UNRESOLVED') {
        memoText += `誘몄셿猷?(${repairData.unresolvedReason || '?ъ쑀誘멸린??}, ?꾩냽: ${repairData.nextAction || '?놁쓬'}): ${repairData.details || ''}`;
      } else {
        memoText += `?뺣퉬 吏꾪뻾以?(?ㅼ?以? ${repairData.scheduleDate || repairData.requestDate}): ${repairData.details || ''}`;
      }

      db.insertRow<AssetInOutLog>('assetInOutLogs', {
        assetId: targetAsset.id,
        assetNo: targetAsset.assetNo,
        modelName: targetAsset.modelName,
        type: 'REPAIR',
        eventDate: repairData.repairDate || repairData.requestDate || new Date().toISOString().split('T')[0],
        repairId: repairId,
        inboundNo: repairData.inboundNo,
        maintenanceScore: nextMaintenanceScore,
        memo: memoText,
        createdAt: new Date().toISOString()
      });
    }

    // ?뱶 怨꾩빟 ?대젰(ContractHistory) 臾대늻????꾨씪???먮룞 ?곕룞
    if (resolvedContractId && repairStatus === 'COMPLETED') {
      db.insertRow<ContractHistory>('contract_history', {
        id: `ch-rep-${repairId}-${Date.now()}`,
        contractId: resolvedContractId,
        changeType: 'AS_SERVICE',
        changeDate: repairData.repairDate || repairData.requestDate || new Date().toISOString().split('T')[0],
        description: `[?꾩옣 ?뺣퉬/AS ?꾨즺] ${repairData.details || '?뺣퉬 ?꾨즺'} (${targetAsset ? `?λ퉬: ${targetAsset.assetNo}` : '?꾩옣?뺤씤'}${mechanicName ? `, ?뺣퉬?? ${mechanicName}` : ''}${totalRepairCost > 0 ? `, 鍮꾩슜: ??{totalRepairCost.toLocaleString()}` : ''})`,
        createdAt: new Date().toISOString()
      });
    }

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

    // ?뙚 ?먯궛 ?곹깭 ?꾩씠 紐낆떆??吏??
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
          memo: `[二쇨린???뺣퉬 ?곹깭 媛깆떊] ${status} ???먯궛?곹깭 [${targetAssetStatus}] ?꾩씠`,
          createdAt: new Date().toISOString()
        });
      }
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const saveTransportDataOnFly = (companyName: string, driverName: string, contact: string, vehicleNo: string, vehicleType: string) => {
    if (!companyName && !driverName) return;

    let companyId = '';
    
    // 1. ?댁넚?낆껜 泥섎━
    if (companyName) {
      const existingCompany = db.transportCompanies.find(c => c.name === companyName);
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const newCompany = db.insertRow<TransportCompany>('transportCompanies', {
          name: companyName,
          businessNo: '',
          contact: contact || '',
          memo: '?먮룞 異붽???,
          createdAt: new Date().toISOString()
        });
        companyId = newCompany.id;
      }
    }

    // 2. 湲곗궗 泥섎━
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
      await db.awaitPendingWrites();
    refreshAllData();
  };

  const saveVendor = async (vendor: Vendor): Promise<void> => {
    try {
      const existing = db.vendors.find(v => v.id === vendor.id);
      if (existing) {
        db.updateRow('vendors', vendor.id, vendor);
      await db.awaitPendingWrites();
      } else {
        db.insertRow('vendors', vendor);
      await db.awaitPendingWrites();
      }
      // Supabase 鍮꾨룞湲??곌린 ???꾨즺 ?湲?諛??먮윭 ?꾪뙆
      if (db.pendingWrites.length > 0) {
        await db.awaitPendingWrites();
      }
      refreshAllData();
    } catch (err: any) {
      console.error('saveVendor error:', err);
      throw err;
    }
  };

  const deleteVendor = (id: string) => {
    // ??怨좎븘 ?덉퐫??諛⑹?: ?곌? ?먯궛 ?먮뒗 留ㅼ엯 ?뺤궛嫄댁씠 ?덉쑝硫???젣 李⑤떒
    const linkedAssets = db.assets.filter(a => a.vendorId === id);
    const linkedSettlements = db.purchaseSettlements.filter(s => s.vendorId === id);
    if (linkedAssets.length > 0 || linkedSettlements.length > 0) {
      showErrorModal(
        `?좑툘 ?대떦 留ㅼ엯泥섎? ??젣?????놁뒿?덈떎.\n\n` +
        (linkedAssets.length > 0 ? `???곌껐???먯궛: ${linkedAssets.length}?\n` : '') +
        (linkedSettlements.length > 0 ? `???곌껐??留ㅼ엯 ?뺤궛嫄? ${linkedSettlements.length}嫄?n` : '') +
        `\n?곌껐???먯궛/?뺤궛??癒쇱? ?댁젣??????젣?섏떗?쒖삤.`,
        '留ㅼ엯泥???젣 遺덇?'
      );
      return;
    }
    db.deleteRow('vendors', id);
      await db.awaitPendingWrites();
    refreshAllData();
  };

  // ?뮕 ?꾩궗 留ㅼ엯泥?嫄곕옒媛쒖떆??諛?留ㅼ엯?꾩쟻嫄곕옒???쇨큵 ?ъ쭛怨??숆린???ы띁 (?뚯옣 4.1, 5.2)
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

  // ??1???뱀궗?먯궛 媛먭??곴컖 寃곗궛 留덇컧 ?ㅽ뻾 (?붾쭚 ?섎룄???ㅽ뻾)
  const executeMonthlyDepreciation = async (depreciationYm: string, note?: string) => {
    const existing = db.depreciationLogs.find(l => l.depreciationYm === depreciationYm);
    if (existing) {
      throw new Error(`?대? [${depreciationYm}] ?곗썡??媛먭??곴컖 寃곗궛 留덇컧???꾨즺?섏뿀?듬땲?? (留덇컧 泥섎━?쇱떆: ${existing.executedAt.substring(0, 10)})`);
    }

    const ownedAssets = db.assets.filter(a => a.ownerType === 'OWNED');
    let totalDepnSum = 0;
    let updatedCount = 0;
    const nowIso = new Date().toISOString();

    // 留덇컧 ?곗썡??留먯씪 ?쒖젏 Date ?앹꽦 (?? '2026-08' -> 2026??8??31??23:59:59)
    const [ymYear, ymMonth] = depreciationYm.split('-').map(Number);
    const closingDate = new Date(ymYear, ymMonth, 0, 23, 59, 59, 999); // ?대떦 ?붿쓽 留덉?留???

    for (const asset of ownedAssets) {
      const cost = asset.acquisitionPrice || 0;
      if (cost <= 0 || !asset.acquisitionDate || !asset.depreciationMonths || asset.depreciationMonths <= 0) {
        continue;
      }

      // 1. 痍⑤뱷?쇱옄 寃利? 留덇컧 ?곗썡 留먯씪蹂대떎 誘몃옒??痍⑤뱷???먯궛? ?뱀썡 ?곴컖 ????쒖쇅
      const acqDate = new Date(asset.acquisitionDate);
      if (isNaN(acqDate.getTime()) || acqDate > closingDate) {
        continue;
      }

      // 2. 留ㅺ컖 ?щ? 諛?留ㅺ컖?쇱옄 寃利? 留ㅺ컖 ?곹깭?닿굅??留ㅺ컖?쇱씠 留덇컧 ?곗썡 ?댁쟾/?뱀썡??寃쎌슦 ?곴컖 ?뺤? 泥섎━
      if (asset.status === 'SOLD' || asset.disposalDate) {
        const dispDateStr = asset.disposalDate ? asset.disposalDate.substring(0, 7) : '';
        // ?대? 留덇컧 ?곗썡 ?댁쟾?대굹 ?뱀썡 ?댁쟾??留ㅺ컖???먯궛? 媛먭??곴컖 諛쒖깮 以묐떒
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

      // 3. 痍⑤뱷??acqDate)遺??留덇컧?곗썡 留먯씪(closingDate)源뚯???寃쎄낵 媛쒖썡???뺣? ?곗텧
      let yearsDiff = closingDate.getFullYear() - acqDate.getFullYear();
      let monthsDiff = closingDate.getMonth() - acqDate.getMonth();
      let totalElapsedMonths = yearsDiff * 12 + monthsDiff + 1; // 痍⑤뱷?뱀썡 ?ы븿

      if (totalElapsedMonths < 1) totalElapsedMonths = 1;

      // 留ㅺ컖 ?먯궛? 留ㅺ컖 ?쒖젏源뚯???寃쎄낵?붿닔濡?罹??쒗븳
      if ((asset.status === 'SOLD' || asset.disposalDate) && asset.disposalDate) {
        const dispDate = new Date(asset.disposalDate);
        if (!isNaN(dispDate.getTime()) && dispDate <= closingDate) {
          let dispYears = dispDate.getFullYear() - acqDate.getFullYear();
          let dispMonths = dispDate.getMonth() - acqDate.getMonth();
          totalElapsedMonths = Math.max(1, dispYears * 12 + dispMonths + 1);
        }
      }

      // ?댁슜?붿닔 罹??쒗븳
      const effectiveElapsed = Math.min(totalElapsedMonths, asset.depreciationMonths);

      // ?대쾲 留덇컧 ?곗썡 ?쒖젏??紐⑺몴 ?꾩쟻?곴컖??(IFRS ?뺤븸踰??뺣? ?곗텧)
      const targetAccum = Math.min(depreciableAmount, Math.round(monthlyDepn * effectiveElapsed));

      const currentAccum = asset.accumDepreciation || 0;

      // ?뱀썡 諛섏쁺??媛먭??곴컖鍮?= 紐⑺몴 ?꾩쟻?곴컖??- 湲곗〈 ?꾩쟻?곴컖??
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
      note: note || `[${depreciationYm}] ?붾쭚 ?뱀궗?먯궛 媛먭??곴컖 寃곗궛 留덇컧 ?꾨즺`,
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

  // ?????????????????????????????????????????????????????????
  // ?붾쭚 留ㅼ엯 ?뺤궛 愿??Mutators
  // ?????????????????????????????????????????????????????????

  /** ?뱀썡 ?댁넚猷?+ ?뚮え??留ㅼ엯 + ?꾩감?먯궛 ?꾩감猷?+ ?몄＜ ?뺣퉬鍮??먮룞 吏묎퀎 ??PurchaseSettlement ?앹꽦 */
  const generateMonthlyPurchaseSettlements = async (ym: string): Promise<{ transport: number; consumable: number; lease: number; repair: number }> => {
    const nowIso = new Date().toISOString();
    let transportCount = 0;
    let consumableCount = 0;
    let leaseCount = 0;

    // ???댁넚猷?吏묎퀎 ???뱀썡 DELIVERED 諛곗감 以?誘몄젙??嫄?
    const deliveriesOfMonth = db.deliveries.filter(d => {
      const dateStr = d.unloadingDate || d.scheduledDate || d.requestDate;
      return dateStr?.startsWith(ym) &&
        d.status === 'DELIVERED' &&
        d.reconciliationStatus !== 'PAID' &&
        (d.deliveryCostConfirmed || 0) > 0;
    });

    // ?댁넚?щ퀎 洹몃（??
    const transportGroups = new Map<string, typeof deliveriesOfMonth>();
    deliveriesOfMonth.forEach(d => {
      const key = d.transportCompany || '誘몄????댁넚??;
      if (!transportGroups.has(key)) transportGroups.set(key, []);
      transportGroups.get(key)!.push(d);
    });

    for (const [vendorName, items] of transportGroups.entries()) {
      // ?대? ?숈씪 ?뺤궛???댁넚???뺤궛嫄댁씠 ?덉쑝硫??ㅽ궢
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
          itemDescription: `諛곗감 ${d.id} / ${d.dispatchCategory || d.type} (${d.unloadingDate || d.scheduledDate || d.requestDate})`,
          quantity: 1,
          unitPrice: d.deliveryCostConfirmed || d.deliveryCost || 0,
          amount: d.deliveryCostConfirmed || d.deliveryCost || 0,
          evidenceFileUrl: d.statementFileUrl,
          createdAt: nowIso
        });
      });
      transportCount++;
    }

    // ???뚮え??留ㅼ엯 吏묎퀎 ???뱀썡 COMPLETED / ?낃퀬 ?꾨즺 援щℓ?좎껌 以?誘몄젙??嫄?
    const existingConsumableSettlementSourceIds = new Set(
      db.purchaseSettlementItems
        .filter(i => i.sourceType === 'CONSUMABLE_PURCHASE')
        .map(i => i.sourceId)
    );

    const purchasesOfMonth = db.consumablePurchases.filter(p => {
      if (existingConsumableSettlementSourceIds.has(p.id)) return false;
      const isFinished = p.status === 'COMPLETED' || p.receivedQty > 0;
      if (!isFinished) return false;
      const rawDate = p.completedDate || p.requestDate || p.createdAt || '';
      const normDate = rawDate.replace(/\./g, '-');
      return normDate.startsWith(ym);
    });

    // ?먮ℓ泥섎퀎 洹몃（??
    const consumableGroups = new Map<string, typeof purchasesOfMonth>();
    purchasesOfMonth.forEach(p => {
      const key = p.sellerName || '誘몄????먮ℓ泥?;
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

      items.forEach(p => {
        db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
          settlementId: settlement.id,
          sourceType: 'CONSUMABLE_PURCHASE',
          sourceId: p.id,
          itemDescription: `${p.modelName} 횞 ${p.requestedQty}媛?(${p.completedDate || p.requestDate})`,
          quantity: p.requestedQty,
          unitPrice: p.unitPrice,
          amount: p.requestedQty * p.unitPrice,
          evidenceFileUrl: p.statementFileUrl,
          createdAt: nowIso
        });
      });
      consumableCount++;
    }

    // ???꾩감?먯궛(ownerType === 'RENTED') ?꾩감猷?吏묎퀎 諛??먮룞 ?뺤궛 ?앹꽦
    const rentedAssetsOfMonth = db.assets.filter(a => {
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
      const vendorName = vendor?.name || aList[0]?.renter || '?λ퉬 ?꾩감泥?;
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

      aList.forEach(a => {
        db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
          settlementId,
          sourceType: 'EQUIPMENT_LEASE',
          sourceId: a.id,
          itemDescription: `?λ퉬?꾩감: ${a.assetNo} (${a.modelName})`,
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

    // ??[?좉퇋 異붽?] ?몄＜ ?뺣퉬鍮?吏묎퀎 ???뺣퉬?섎━(Repairs)?먯꽌 repairType === 'EXTERNAL'?닿퀬 status === 'COMPLETED'???몄＜ ?뺣퉬 嫄??섏쭛
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
      const vendorName = vendor?.name || '?몄＜ ?뺣퉬?낆껜';
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

      rList.forEach(r => {
        const asset = db.assets.find(a => a.id === r.assetId);
        db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
          settlementId,
          sourceType: 'REPAIR' as any,
          sourceId: r.id,
          itemDescription: `?몄＜ ?뺣퉬 ${asset?.assetNo || '?먯궛'} ${r.details.slice(0, 30)}`,
          quantity: 1,
          unitPrice: r.totalCost || 0,
          amount: r.totalCost || 0,
          evidenceFileUrl: r.estimateFileUrl || r.faultImageUrl,
          createdAt: nowIso
        });

        // repair??purchaseBillId ?곌껐
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
      confirmedBy: currentUser?.name || '?쒖뒪??
    });
    if (settlement) {
      triggerVendorPurchaseMetric(
        settlement.vendorId || settlement.vendorName || '',
        settlement.totalAmount || 0,
        settlement.paymentDate || (settlement.settlementYm ? `${settlement.settlementYm}-01` : undefined)
      );
    }
    await db.awaitPendingWrites();
    refreshAllData();
  };

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

    // SettlementPaymentLog 吏湲??대젰 ?덉퐫??1:N 蹂닿? (Audit Trail)
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

    // ?곌껐??諛곗감 嫄??곹깭 PAID ?곕룞
    if (newStatus === 'PAID' && settlement.settlementType === 'TRANSPORT') {
      const items = db.purchaseSettlementItems.filter(i => i.settlementId === id && i.sourceType === 'DELIVERY');
      items.forEach(item => {
        db.updateRow<Delivery>('deliveries', item.sourceId, {
          reconciliationStatus: 'PAID',
          paymentCompletedAt: new Date().toISOString()
        });
      });
    }

    await db.awaitPendingWrites();
    refreshAllData();
  };

  const savePurchaseSettlement = async (settlement: Partial<PurchaseSettlement>): Promise<void> => {
    if (!settlement.id) return;
    db.updateRow<PurchaseSettlement>('purchaseSettlements', settlement.id, {
      ...settlement,
      updatedAt: new Date().toISOString()
    });
    await db.awaitPendingWrites();
    refreshAllData();
  };

  // ?? ?붾쭚 媛먭??곴컖 寃곗궛 痍⑥냼 (濡ㅻ갚) ??
  const cancelMonthlyDepreciation = async (depreciationYm: string): Promise<void> => {
    try {
      const log = db.depreciationLogs.find(l => l.depreciationYm === depreciationYm);
      if (!log) {
        throw new Error(`[${depreciationYm}] ?곗썡??媛먭??곴컖 寃곗궛 ?대젰??議댁옱?섏? ?딆뒿?덈떎.`);
      }

      // 1. ?대떦 ?곗썡??DepreciationLog ??젣
      db.deleteRow('depreciationLogs', log.id);
      await db.awaitPendingWrites();

      // 2. ?댁쟾 ?곗썡(1媛쒖썡 ????留먯씪 ?쒖젏?쇰줈 媛??먯궛??媛먭??곴컖 ?ш퀎??諛?濡ㅻ갚
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
      showErrorModal(`?좑툘 媛먭??곴컖 寃곗궛 痍⑥냼 ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  // ?? ????꾨즺 諛곗감 ???붾쭚 留ㅼ엯 ?뺤궛 ?먮룞 吏묎퀎 ??
  const convertReconciledDeliveriesToSettlement = async (settlementYm: string, transportCompanyId?: string): Promise<number> => {
    try {
      const targetDeliveries = db.deliveries.filter(d => {
        const dDate = d.loadingDate || d.scheduledDate || d.requestDate || d.createdAt.split('T')[0];
        const matchYm = dDate.startsWith(settlementYm);
        const matchStatus = d.reconciliationStatus === 'RECONCILED' || d.reconciliationStatus === 'MATCHED';
        const matchComp = !transportCompanyId || d.transportCompany === transportCompanyId;
        return matchYm && matchStatus;
      });

      if (targetDeliveries.length === 0) return 0;

      // ?댁넚?щ퀎 洹몃９??
      const compGroups = new Map<string, Delivery[]>();
      targetDeliveries.forEach(d => {
        const comp = d.transportCompany || '湲고? ?댁넚??;
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

        // ?꾩씠???쎌엯 諛?諛곗감 ?곹깭 媛깆떊
        dList.forEach(d => {
          const cost = d.deliveryCostConfirmed || d.deliveryCost || 0;
          db.insertRow<PurchaseSettlementItem>('purchaseSettlementItems', {
            settlementId,
            sourceType: 'DELIVERY',
            sourceId: d.id,
            itemDescription: `[諛곗감 ?대컲鍮? ${d.originAddress || '?곸감吏'} ??${d.destinationAddress || '?섏감吏'} (${d.vehicleType || '李⑤웾'})`,
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
      showErrorModal(`?좑툘 留ㅼ엯 ?뺤궛 ?닿? ?ㅻ쪟:\n${err?.message || err}`);
      throw err;
    }
  };

  // ?? 怨좉컼 怨쇱떎 ?섎━鍮?泥?뎄???곕룞 ??
  const linkRepairToBilling = async (repairId: string, billingId: string): Promise<void> => {
    try {
      db.updateRow<Repair>('repairs', repairId, {
        billingId,
        updatedAt: new Date().toISOString()
      });

      // ?윟 ?좎긽 ?섎━鍮?泥?뎄 ToDo ?먮룞 ?곴퀎
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
      showErrorModal(`?좑툘 ?섎━鍮?泥?뎄 ?곕룞 ?ㅽ뙣:\n${err?.message || err}`);
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
      showErrorModal(`?좑툘 ?섎━鍮?泥?뎄 ?곕룞 ?댁젣 ?ㅽ뙣:\n${err?.message || err}`);
    }
  };

  // ?? 怨좉컼 怨쇱떎 ?섎━鍮??곸뾽 泥?뎄 硫댁젣 泥섎━ ??
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

      // ?윟 ?좎긽 ?섎━鍮?泥?뎄 ToDo ?먮룞 ?곴퀎 (?곸뾽 硫댁젣 ?꾨즺)
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
      showErrorModal(`?좑툘 ?섎━鍮??곸뾽 硫댁젣 泥섎━ ?ㅽ뙣:\n${err?.message || err}`);
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
      showErrorModal(`?좑툘 ?섎━鍮??곸뾽 硫댁젣 痍⑥냼 ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  // ?? 怨좉컼 遺???댁넚猷?泥?뎄???곕룞 諛??곸뾽 硫댁젣 ??
  const linkDeliveryToBilling = async (deliveryId: string, billingId: string): Promise<void> => {
    try {
      db.updateRow<Delivery>('deliveries', deliveryId, {
        billingId,
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 ?댁넚猷?泥?뎄 ?곕룞 ?ㅽ뙣:\n${err?.message || err}`);
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
      showErrorModal(`?좑툘 ?댁넚猷?泥?뎄 ?곕룞 ?댁젣 ?ㅽ뙣:\n${err?.message || err}`);
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
      showErrorModal(`?좑툘 ?댁넚猷??곸뾽 硫댁젣 泥섎━ ?ㅽ뙣:\n${err?.message || err}`);
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
      showErrorModal(`?좑툘 ?댁넚猷??곸뾽 硫댁젣 痍⑥냼 ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  // ?? ?좎닔湲?(?덉튂湲? 愿由???
  const chargePrepaidBalance = async (customerId: string, amount: number, memo?: string): Promise<void> => {
    try {
      const customer = db.customers.find(c => c.id === customerId);
      if (!customer) throw new Error('怨좉컼?щ? 李얠쓣 ???놁뒿?덈떎.');
      if (amount <= 0) throw new Error('?좏슚??湲덉븸???낅젰?섏떗?쒖삤.');

      const nextBal = (customer.prepaidBalance || 0) + amount;
      db.updateRow<Customer>('customers', customerId, {
        prepaidBalance: nextBal
      });

      db.insertRow<PrepaidTransaction>('prepaidTransactions', {
        customerId,
        type: 'CHARGE',
        amount,
        balanceAfter: nextBal,
        memo: memo || '?좎닔湲??덉튂湲? 異⑹쟾/?낃툑',
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 ?좎닔湲?異⑹쟾 ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  const applyPrepaidBalanceForBilling = async (billingId: string, amount: number, memo?: string): Promise<void> => {
    try {
      if (!amount || amount <= 0) {
        throw new Error('?곴퀎??湲덉븸? 1???댁긽?댁뼱???⑸땲??');
      }
      const billing = db.billings.find(b => b.id === billingId);
      if (!billing) throw new Error('泥?뎄?쒕? 李얠쓣 ???놁뒿?덈떎.');
      const customer = db.customers.find(c => c.id === billing.customerId);
      if (!customer) throw new Error('怨좉컼?щ? 李얠쓣 ???놁뒿?덈떎.');

      const currentBal = customer.prepaidBalance || 0;
      if (currentBal < amount) {
        throw new Error(`?좎닔湲??붿븸??遺議깊빀?덈떎. (?꾩옱 ?붿븸: ??{currentBal.toLocaleString()}?? ?붿껌?? ??{amount.toLocaleString()}??`);
      }

      const bSup = billing.totalAmount || 0;
      const bGrand = bSup + Math.round(bSup * 0.1);
      const unpaid = Math.max(0, bGrand - (billing.paidAmount || 0));
      if (amount > unpaid) {
        throw new Error(`泥?뎄??誘몄닔湲???{unpaid.toLocaleString()}????珥덇낵?섏뿬 ?곴퀎?????놁뒿?덈떎.`);
      }

      // 1. 怨좉컼 ?좎닔湲??붿븸 李④컧
      const nextBal = currentBal - amount;
      db.updateRow<Customer>('customers', customer.id, {
        prepaidBalance: nextBal
      });

      // 2. ?섎궔 (Payment) ?덉퐫???앹꽦
      const paymentId = `pay-prepaid-${Date.now()}`;
      db.insertRow<Payment>('payments', {
        id: paymentId,
        billingId,
        paymentDate: new Date().toISOString().split('T')[0],
        amount,
        method: 'PREPAID',
        memo: memo || `?좎닔湲??덉튂湲? ?곴퀎 ?섎궔 (?붿뿬 ?좎닔湲? ??{nextBal.toLocaleString()}??`,
        createdAt: new Date().toISOString()
      });

      // 3. 泥?뎄???섎궔??諛??곹깭 媛깆떊 (VAT ?ы븿 珥앹븸 湲곗?)
      const newPaid = billing.paidAmount + amount;
      const newStatus = newPaid >= bGrand ? 'PAID' : 'PARTIAL';
      db.updateRow<Billing>(billingId, {
        paidAmount: newPaid,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // 4. ?좎닔湲??ъ슜 ?대젰 湲곕줉
      db.insertRow<PrepaidTransaction>('prepaidTransactions', {
        customerId: customer.id,
        type: 'USE_FOR_BILLING',
        amount,
        balanceAfter: nextBal,
        billingId,
        paymentId,
        memo: memo || `泥?뎄??${billing.billingYm}) ?좎닔湲??곴퀎 ?섎궔`,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 ?좎닔湲??곴퀎 ?섎궔 ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  const refundPrepaidBalance = async (customerId: string, amount: number, memo?: string): Promise<void> => {
    try {
      if (!amount || amount <= 0) {
        throw new Error('?섎텋??湲덉븸? 1???댁긽?댁뼱???⑸땲??');
      }
      const customer = db.customers.find(c => c.id === customerId);
      if (!customer) throw new Error('怨좉컼?щ? 李얠쓣 ???놁뒿?덈떎.');
      const currentBal = customer.prepaidBalance || 0;
      if (currentBal < amount) {
        throw new Error(`?섎텋 ?붿껌 湲덉븸???좎닔湲??붿븸??珥덇낵?⑸땲?? (?붿븸: ??{currentBal.toLocaleString()}??`);
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
        memo: memo || '?좎닔湲??덉튂湲? ?섎텋 泥섎━',
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 ?좎닔湲??섎텋 ?ㅽ뙣:\n${err?.message || err}`);
      throw err;
    }
  };

  // ?? ?곗껜 議곗튂 諛??낃툑 ?쎌냽 愿由???
  const saveDelinquencyAction = async (action: Omit<DelinquencyActionLog, 'id' | 'createdAt'>): Promise<void> => {
    try {
      db.insertRow<DelinquencyActionLog>('delinquencyActionLogs', {
        ...action,
        createdAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      refreshAllData();
    } catch (err: any) {
      showErrorModal(`?좑툘 ?곗껜 議곗튂?ы빆 ????ㅽ뙣:\n${err?.message || err}`);
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
      showErrorModal(`?좑툘 ?낃툑 ?쎌냽 ?곹깭 蹂寃??ㅽ뙣:\n${err?.message || err}`);
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

    refreshAllData();
    if (db.isSupabaseConnected() && db.pendingWrites.length > 0) {
      try {
        await db.pendingWrites[db.pendingWrites.length - 1];
      } catch (err) {
        console.error('Supabase write error:', err);
      }
    }
  };

  // ============================================================
  // 踰뺤씤 李⑤웾 諛?李⑤웾?댄뻾?쇱?/二쇱쑀 ?곸닔利?Mutators (Corporate Fleet & Logs)
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
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const deleteCorporateVehicle = async (id: string): Promise<void> => {
    // ??怨좎븘 ?덉퐫??諛⑹?: 李⑤웾 ??젣 ???곌? ?댄뻾?쇱?, 二쇱쑀 湲곕줉 cascade ??젣
    const linkedOpLogs = db.vehicleOperationLogs.filter(l => l.vehicleId === id);
    linkedOpLogs.forEach(l => db.deleteRow('vehicleOperationLogs', l.id));
    const linkedFuelLogs = db.vehicleFuelLogs.filter(l => l.vehicleId === id);
    linkedFuelLogs.forEach(l => db.deleteRow('vehicleFuelLogs', l.id));
    db.deleteRow('corporateVehicles', id);
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const registerVehicleOperationLog = async (logData: Omit<VehicleOperationLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<VehicleOperationLog> => {
    const now = new Date().toISOString();
    const driveDistance = Math.max(0, (logData.arrivalMileage || 0) - (logData.departureMileage || 0));
    const newLog = db.insertRow<VehicleOperationLog>('vehicleOperationLogs', {
      ...logData,
      driveDistance: logData.driveDistance !== undefined ? logData.driveDistance : driveDistance,
      createdAt: now,
      updatedAt: now
    }) as VehicleOperationLog;

    // 李⑤웾???꾩옱 ?꾩쟻 二쇳뻾嫄곕━ ?먮룞 ?낅뜲?댄듃 (?꾩갑 嫄곕━媛 ????寃쎌슦)
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
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const deleteVehicleOperationLog = async (id: string): Promise<void> => {
    db.deleteRow('vehicleOperationLogs', id);
    await db.awaitPendingWrites();
    refreshAllData();
  };

  const registerVehicleFuelLog = async (fuelData: Omit<VehicleFuelLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<VehicleFuelLog> => {
    const now = new Date().toISOString();
    const fuelUnitPrice = fuelData.fuelUnitPrice || (fuelData.fuelVolume > 0 ? Math.round(fuelData.fuelAmount / fuelData.fuelVolume) : 0);
    
    // 吏곸쟾 二쇱쑀 ?鍮??곕퉬 ?먮룞 怨꾩궛 (?숈씪 李⑤웾??吏곸쟾 二쇱쑀 湲곕줉 寃??
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

    // 李⑤웾???꾩옱 ?꾩쟻 二쇳뻾嫄곕━ ?먮룞 ?낅뜲?댄듃
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
    await db.awaitPendingWrites();
    refreshAllData();
  };

  // ?녷븺 ?몄뇙 ??& ?ㅽ뀒?댁뀡 愿由??≪뀡
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

  // ??? ?ㅻ쪟 ?좉퀬 愿由?(3?④퀎 ?쇱씠?꾩궗?댄겢 & ?뚯씪泥⑤?) ???
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
      reporterName: reportData.reporterName || currentUser?.name || '?쒖뒪?쒖궗?⑹옄',
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
    const updates: Partial<ErrorReport> = {
      status: 'IN_PROGRESS',
      receiverId: currentUser?.id || 'usr-admin',
      receiverName: currentUser?.name || '愿由ъ옄',
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
    const updates: Partial<ErrorReport> = {
      status: 'COMPLETED',
      resolverId: currentUser?.id || 'usr-admin',
      resolverName: currentUser?.name || '愿由ъ옄',
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
      resolutionNote: reason ? `[痍⑥냼 ?ъ쑀]: ${reason}` : '?좉퀬???붿껌 ?먮뒗 以묐났 嫄?痍⑥냼',
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

  return (
    <AppContext.Provider value={{ receivables: db.receivables as any[], refreshReceivables: () => {}, 
      currentUser, theme, toggleTheme, login, logout, switchUser, hasPermission, showErrorModal,
      tenants, currentTenant, setCurrentTenantId, saveTenant,
      addTenantWorkplace, updateTenantWorkplace, deleteTenantWorkplace,
      addTenantYard, updateTenantYard, deleteTenantYard, setDefaultYard,
      errorReports, addErrorReport, receiveErrorReport, completeErrorReport, cancelErrorReport, reopenErrorReport, deleteErrorReport,
      users, permissions, customers, contacts, sites, products, assets, consumables, consumableLogs, consumablePurchases, mechanicConsumableStocks, contracts, contractAssets, contractHistory, deliveries, billings, billingDetails, payments, paymentDepositLinks, repairs, repairConsumables, transportCompanies, transportDrivers, transportNegotiations, subleaseNegotiations, todos,
      stocktakingAudits, stocktakingAuditItems, collectedParts,
      bankTransactions, bankMatchingRules, bankInitialBalances, assetInOutLogs, vendors, googleConfigs, cashFlowSnapshots, outboundInspections, depreciationLogs,
      purchaseSettlements, purchaseSettlementItems, settlementPaymentLogs: db.settlementPaymentLogs, externalLeases, inspectionChecklistItems,
      equipmentManuals, saveEquipmentManual, deleteEquipmentManual,
      standardOptions, saveStandardOption, deleteStandardOption,
      customRoles, rolePermissions, saveCustomRole, deleteCustomRole, saveRolePermissions, assignUserRole,
      annualLeaveQuotas, leaveUsages, overtimeRecords, payrollClosings, prepaidTransactions, delinquencyActionLogs, legalNoticeLogs, legalNoticeTemplates, saveLegalNoticeLog, saveLegalNoticeTemplate,
      corporateVehicles, vehicleOperationLogs, vehicleFuelLogs, registerCorporateVehicle, updateCorporateVehicle, deleteCorporateVehicle, registerVehicleOperationLog, updateVehicleOperationLog, deleteVehicleOperationLog, registerVehicleFuelLog, deleteVehicleFuelLog,
      refreshAllData, fullRefreshFromServer, executeMonthlyDepreciation, loadTablesForMenu, updatePermissions, saveUser, saveCustomer, saveContact, deleteContact, saveSite, deleteSite, saveProduct, saveAsset, updateGoogleConfig,
      saveCashFlowSnapshot, deleteCashFlowSnapshot, saveVendor, deleteVendor, recalculateAllVendorMetrics, saveBankInitialBalance, saveInspectionChecklistItem, deleteInspectionChecklistItem,
      updateAnnualLeaveQuota, addLeaveUsage, deleteLeaveUsage, addOvertimeRecord, deleteOvertimeRecord, setPayrollClosingStatus,
      acquireAsset, batchAcquireAssets, disposeAsset, executeAssetSale, registerRentedAsset, returnRentedAsset, createVendorClaimReceivable, changeAssetStatus, registerInboundAsset, cancelInboundAsset,
      purchaseConsumable, useConsumable, transferConsumableToMechanic, returnConsumableToHq, transferConsumableBetweenMechanics, addConsumable, updateConsumable, deleteConsumable,
      createStocktakingAudit, updateStocktakingItem, confirmStocktakingAudit, cancelStocktakingAudit, processCollectedPart,
      requestConsumablePurchase, acceptConsumablePurchase, completeConsumablePurchase, inboundConsumablePurchase, clearEvidenceFileUrls, updateEvidenceFileUrls,
      createContract, extendContract, shortenContract, succeedContract, exchangeAsset, updateContractAssetPeriod, relocateContractAsset, redeployRepairedAsset,
      assignAssetToContract, batchAssignAssetsToContract, unassignAssetFromContract, batchUnassignAssetsFromContract, exchangeOutboundAsset,
      saveSmartDispatch, saveSmartReturn,
      completeTodo, issueExecutiveDirective, resolveExecutiveDirective, cancelExecutiveDirective,
      generateBillingsForMonth, getDueContractsForBilling, generateDueBillings, generateBillingForSingleContract, regenerateBilling, approveBilling, cancelBilling, receivePayment, cancelPayment, cancelAllPaymentsForBilling, saveBankDeposit, deleteBankDeposit,
      addReceivable, generateStandaloneBillingForReceivable, linkReceivableToBilling,
      uploadBankTransactions, matchTransactionManual, batchAutoMatchTransactions, unmatchTransaction, saveMatchingRule, deleteMatchingRule,
      dispatchDelivery, settleDeliveryCost, completeDelivery, completeInboundDelivery,
      registerRepair, updateRepairStatus,
      // ?꾩옣 AS 愿由?(?⑥씪 臾쇰━ ?뚯씠釉?repairs 酉??쒓났)
      fieldAsTickets: repairs.filter(r => r.workCategory === 'FIELD_AS' || r.source === 'BAND_IMPORT' || r.source === 'SALES_REQUEST'),
      createFieldAsTicket,
      updateFieldAsTicketStatus,
      completeFieldAsTicket,
      createRevisitAsTicket,
      importBandAsHistory,
      logFieldAsTimelineEvent,
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
      setNavigationPayload
    }}>
      {children}
      <ErrorModal
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
      />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

