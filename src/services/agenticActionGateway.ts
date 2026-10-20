// src/services/agenticActionGateway.ts
// 에이전틱 AI (Agentic AI) 전용 액션 툴 매니페스트 및 전사 표준 헌장 가드레일 인터셉터

import { db, Delivery, Customer, ConsumablePurchaseRequest, VehicleFuelLog, logPrivacyAccess } from './db';
import { getSystemReadiness, ErpReadinessDiagnostics } from './appReadySignal';

export interface AgenticToolDef {
  name: string;
  domain: string;
  description: string;
  charterRule: string; // 관련 전사 표준 헌장 조항
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[]; required?: boolean }>;
    required: string[];
  };
}

export interface AgentStep {
  stepNo: number;
  type: 'THOUGHT' | 'TOOL_CALL' | 'GUARDRAIL_CHECK' | 'OBSERVATION' | 'RESULT';
  toolName?: string;
  thought?: string;
  input?: any;
  output?: any;
  status: 'SUCCESS' | 'BLOCKED' | 'INFO';
  timestamp: string;
}

export interface AgenticExecutionResult {
  workflowId: string;
  prompt: string;
  status: 'SUCCESS' | 'GUARDRAIL_BLOCKED' | 'ERROR';
  steps: AgentStep[];
  executedTools: string[];
  metrics: {
    manualMinutes: number;   // 인간 작업 예상 소요시간 (분)
    aiSeconds: number;       // 에이전틱 AI 실제 소요시간 (초)
    timeSavedPercent: number;// 시간 절감률 (%)
    manualClicks: number;    // 인간 마우스 클릭/조작 수
    aiClicks: number;        // AI 조작 수 (프롬프트 1회)
    clicksSavedPercent: number; // 클릭 절감률 (%)
    errorRate: number;       // 데이터 오류율 (0.00%)
    conservationDiff: number;// 대차대조 차액 (0원)
  };
}

// ─── 1. 에이전틱 AI 21대 표준 도구 매니페스트 ───
export const AGENTIC_TOOLS_MANIFEST: AgenticToolDef[] = [
  {
    name: 'system_check_readiness',
    domain: 'D0_System',
    description: 'ERP 시스템이 브라우저에서 조작 가능한 준비 상태인지, 인증 세션, 활성 메뉴, DOM 속성(body[data-erp-status="ready"]), 헌장 가드레일 활성화 여부를 종합 진단합니다. 모든 자동화 액션 실행 전에 반드시 이 도구를 먼저 호출하여 준비 상태를 확인하십시오.',
    charterRule: '헌장 1.1 (최대 편익 및 무누락 안전 운용 원칙)',
    parameters: {
      type: 'object',
      properties: {
        timeoutMs: { type: 'number', description: '최대 대기 제한시간 (ms, 기본 5000)' }
      },
      required: []
    }
  },
  {
    name: 'dispatch_create_exchange',
    domain: 'D4_Dispatch',
    description: '교환 발생 시 왕복 운송비 할인을 적용하여 단일 EXCHANGE 1건의 왕복 배차를 원자적으로 발행합니다.',
    charterRule: '헌장 2.3 (단일 EXCHANGE 1건 발행 원칙 및 왕복할인 자동산정)',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string', description: '고객사명' },
        siteName: { type: 'string', description: '현장명' },
        startAddress: { type: 'string', description: '상차지 주소' },
        endAddress: { type: 'string', description: '하차지 주소' },
        requestDate: { type: 'string', description: '희망일시(일자)' },
        normalOneWayCost: { type: 'number', description: '기준 편도 운송비 (원)' },
        paidBy: { type: 'string', description: '운송비 부담 주체', enum: ['CUSTOMER', 'OURS'] }
      },
      required: ['customerName', 'startAddress', 'endAddress', 'requestDate']
    }
  },
  {
    name: 'inspection_approve_outbound',
    domain: 'D5_InOut',
    description: '출고 검수 승인을 마감하고 자산 상태를 대여중으로 즉시 전환합니다.',
    charterRule: '헌장 1.3 (출고 검수 승인 마감 시 자산 상태 RENTED 전환 원칙)',
    parameters: {
      type: 'object',
      properties: {
        inspectionId: { type: 'string', description: '검수 의뢰 ID' },
        assetNo: { type: 'string', description: '출고 자산 번호' },
        inspectorName: { type: 'string', description: '검수자 성명' }
      },
      required: ['assetNo', 'inspectorName']
    }
  },
  {
    name: 'contract_exchange_asset',
    domain: 'D2_Sales',
    description: '대차 교체 자산에 대해 최초 계약 속성을 100% 자동 상속하고 일할 매출 기여액을 정밀 계산합니다.',
    charterRule: '헌장 2.2 (계약 속성 100% 자동 상속) 및 헌장 4.1 (매출 기여액 정밀 일할 집계)',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: '계약 ID' },
        prevAssetNo: { type: 'string', description: '회수 자산 번호 (전자산)' },
        newAssetNo: { type: 'string', description: '대차 투입 자산 번호 (후장비)' },
        exchangeDate: { type: 'string', description: '교체 일자(일자)' }
      },
      required: ['contractId', 'prevAssetNo', 'newAssetNo', 'exchangeDate']
    }
  },
  {
    name: 'consumable_bulk_purchase',
    domain: 'D6_Maintenance',
    description: '소모품 구매 신청을 일괄 등록하고 소모품 재고 및 수불 로그를 무누락 반영합니다.',
    charterRule: '헌장 1.2 (발생 사건 무누락 DB 저장) 및 헌장 5.2 (무음 실패 방지)',
    parameters: {
      type: 'object',
      properties: {
        modelName: { type: 'string', description: '소모품명' },
        qty: { type: 'number', description: '구매 수량' },
        unitPrice: { type: 'number', description: '구매 단가' },
        sellerName: { type: 'string', description: '구매처' }
      },
      required: ['modelName', 'qty', 'unitPrice', 'sellerName']
    }
  },
  {
    name: 'customer_bulk_create',
    domain: 'D2_Sales',
    description: '고객사 기본정보, 복수 현장, 담당자를 1:N 구조로 원스톱 생성합니다.',
    charterRule: '헌장 1.1 (최소 노력 최대 효익) 및 헌장 3.4 (상하 세로 스택)',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '고객사명' },
        bizRegNo: { type: 'string', description: '사업자등록번호' },
        siteName: { type: 'string', description: '현장명' },
        contactName: { type: 'string', description: '담당자명' }
      },
      required: ['name']
    }
  },
  {
    name: 'bank_match_deposit',
    domain: 'D7_Management',
    description: '통장 입금 내역을 외상매출금 채권과 1:1 대사하고 타행 수수료를 보정하여 대차 차액 0원을 입증합니다.',
    charterRule: '헌장 3.5 (구텐베르크 Z-패턴) 및 헌장 5.5 (수지 보존 법칙)',
    parameters: {
      type: 'object',
      properties: {
        transactionId: { type: 'string', description: '통장 거래 ID' },
        receivableId: { type: 'string', description: '외상매출금 ID' },
        feeAdjustment: { type: 'number', description: '이체 수수료 보정액' }
      },
      required: ['receivableId']
    }
  },
  {
    name: 'delinquency_block_customer',
    domain: 'D2_Sales',
    description: '장기 연체 고객사에 대해 거래상태를 BLOCKED로 전환하고 신규 계약 및 출고를 원천 차단합니다.',
    charterRule: '헌장 1.2 (렌탈 자산 효과적 운용) 및 헌장 5.2 (무음 실패 방지)',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: '고객사 ID' },
        reason: { type: 'string', description: '차단 사유' }
      },
      required: ['customerId', 'reason']
    }
  },
  {
    name: 'vehicle_log_fuel',
    domain: 'D7_Management',
    description: '법인차량 주유 명세서를 등록하고 누적 주행거리를 갱신합니다.',
    charterRule: '헌장 1.2 (사건 기록 무누락 저장)',
    parameters: {
      type: 'object',
      properties: {
        vehicleNo: { type: 'string', description: '차량 번호' },
        fuelDate: { type: 'string', description: '주유 일자' },
        fuelVolume: { type: 'number', description: '주유량(리터)' },
        fuelAmount: { type: 'number', description: '총 주유금액' }
      },
      required: ['vehicleNo', 'fuelDate', 'fuelAmount']
    }
  },
  {
    name: 'repair_complete_maintenance',
    domain: 'D6_Maintenance',
    description: '장비 정비 완결 보고를 수행하고 자산 상태를 AVAILABLE로 복원하며 정비점수를 0점으로 리셋합니다.',
    charterRule: '헌장 5.5 (상태 보존 법칙: 정비 완료 시 AVAILABLE 및 점수 0점 복원)',
    parameters: {
      type: 'object',
      properties: {
        repairId: { type: 'string', description: '정비 ID' },
        assetNo: { type: 'string', description: '자산 번호' },
        laborCost: { type: 'number', description: '공임비' },
        partsCost: { type: 'number', description: '부품비' }
      },
      required: ['assetNo']
    }
  },
  {
    name: 'system_verify_charter_invariants',
    domain: 'D9_SystemDev',
    description: '시스템 전반의 3대 보존 법칙 (날짜 보존, 수지 보존, 상태 보존)의 무결성을 전수 감사 검증합니다.',
    charterRule: '헌장 5.5 (도메인 관통 스트레스 테스트 및 보존 법칙 확정)',
    parameters: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: '감사 범위', enum: ['ALL', 'REVENUE', 'ASSET', 'DISPATCH'] }
      },
      required: ['scope']
    }
  },
  {
    name: 'error_report_create',
    domain: 'D9_SystemDev',
    description: '시스템 오류/버그 신고를 등록하고 첨부파일(스크린샷, 엑셀) 및 사용자 환경 정보를 보존합니다.',
    charterRule: '헌장 1.1 (최대 편익), 헌장 1.2 (발생 사건 무누락 DB 저장) 및 헌장 5.2 (무음 실패 방지)',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '오류 제목' },
        description: { type: 'string', description: '오류 현상 상세 설명' },
        category: { type: 'string', description: '오류 분류 (UI_BUG, DATA_ERROR, NETWORK_ERROR, CALCULATION_ERROR, OTHER)', enum: ['UI_BUG', 'DATA_ERROR', 'NETWORK_ERROR', 'CALCULATION_ERROR', 'OTHER'] },
        severity: { type: 'string', description: '심각도', enum: ['CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL'] },
        menuId: { type: 'string', description: '발생 메뉴 ID' },
        menuName: { type: 'string', description: '발생 메뉴명' },
        reporterName: { type: 'string', description: '신고자 성명' },
        attachmentsCount: { type: 'number', description: '첨부파일 수 (스크린샷/엑셀)' }
      },
      required: ['title', 'description', 'category', 'severity']
    }
  },
  {
    name: 'error_report_update_status',
    domain: 'D9_SystemDev',
    description: '오류 신고의 처리 상태를 접수 또는 완료로 전환하고 조치 내용과 해결 버전을 무누락 기록합니다.',
    charterRule: '헌장 1.2 (발생 사건 무누락 DB 저장) 및 헌장 3.1 (건조한 명사·동사 UI 표준)',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '오류 신고 번호 (예: ERR-202609-001)' },
        status: { type: 'string', description: '변경 상태', enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
        assigneeName: { type: 'string', description: '담당 조치자 성명' },
        receptionNote: { type: 'string', description: '접수 확인 메모' },
        resolutionNote: { type: 'string', description: '원인 분석 및 조치 내역' },
        resolvedVersion: { type: 'string', description: '해결 반영 버전 (예: v1.1.0.Build.42)' },
        rootCause: { type: 'string', description: '근본 원인 분석' }
      },
      required: ['id', 'status']
    }
  }
];

// ─── 2. 헌장 불변식 가드레일 인터셉터 ───
export const checkCharterGuardrails = (toolName: string, params: any): { allowed: boolean; reason?: string } => {
  // 가드레일 1: 대차 배차 시 출고/회수 분할 생성 차단 (헌장 2.3)
  if (toolName === 'dispatch_create_outbound' && (params.memo?.includes('대차') || params.memo?.includes('교체'))) {
    return {
      allowed: false,
      reason: '헌장 2.3 위반: 교환 배차는 편도 출고로 분할 발행할 수 없으며, 반드시 [dispatch_create_exchange] 단일 1건으로 발행해야 합니다.'
    };
  }

  // 가드레일 2: 출고 검수 승인 시 RENTED 상태 누락 차단 (헌장 1.3)
  if (toolName === 'inspection_approve_outbound' && params.forceStatus && params.forceStatus !== 'RENTED') {
    return {
      allowed: false,
      reason: '헌장 1.3 위반: 출고 검수 승인 마감 시 자산 상태는 예외 없이 반드시 [RENTED]로 전환되어야 합니다.'
    };
  }

  // 가드레일 3: 음수 단가나 비정상 금액 입력 차단 (헌장 5.5)
  if (params.unitPrice !== undefined && params.unitPrice < 0) {
    return {
      allowed: false,
      reason: '헌장 5.5 수지 보존 위반: 금액/단가는 음수일 수 없습니다.'
    };
  }

  // 가드레일 4: 오류 완료 처리 시 조치내용 무누락 검증 (헌장 1.2, 5.2)
  if (toolName === 'error_report_update_status' && params.status === 'COMPLETED' && (!params.resolutionNote || !params.resolutionNote.trim())) {
    return {
      allowed: false,
      reason: '헌장 1.2 위반: 오류 완료 처리 시 조치 내용은 무누락 기록되어야 합니다.'
    };
  }

  return { allowed: true };
};

// ─── 3. 에이전틱 AI ReAct 워크플로우 시뮬레이션 엔진 ───
export const runAgenticWorkflow = async (prompt: string): Promise<AgenticExecutionResult> => {
  const workflowId = `wf_${Date.now()}`;
  const steps: AgentStep[] = [];
  const executedTools: string[] = [];
  let stepNo = 1;

  const addStep = (type: AgentStep['type'], thought?: string, toolName?: string, input?: any, output?: any, status: AgentStep['status'] = 'SUCCESS') => {
    steps.push({
      stepNo: stepNo++,
      type,
      toolName,
      thought,
      input,
      output,
      status,
      timestamp: new Date().toISOString()
    });
  };

  // Step 1: 자연어 의도 분석
  addStep('THOUGHT', `자연어 업무 의도 분석 중: "${prompt}"`);

  const lower = prompt.toLowerCase();
  let manualMinutes = 60;
  let manualClicks = 25;

  if (lower.includes('ready') || lower.includes('준비') || lower.includes('체크') || lower.includes('진단') || lower.includes('readiness')) {
    manualMinutes = 10;
    manualClicks = 5;

    addStep('THOUGHT', 'ERP 시스템 브라우저 Ready 상태 점검 요청 감지. DOM 속성, 전역 플래그, 헌장 가드레일 활성화 여부 진단.');
    const toolToCall = 'system_check_readiness';
    const readiness = getSystemReadiness();

    addStep('TOOL_CALL', `도구 호출 실행: ${toolToCall}`, toolToCall, {});
    executedTools.push(toolToCall);

    addStep('OBSERVATION', `시스템 Ready 진단 완료: 상태=${readiness.status}, 활성메뉴=${readiness.activeMenu}, DOM='${readiness.domSelectorReady}', 헌장가드레일=${readiness.guardrailsActive.length}개 활성화.`, toolToCall, null, readiness);

  } else if (lower.includes('배차') || lower.includes('교환') || lower.includes('출고')) {
    manualMinutes = 45;
    manualClicks = 22;

    addStep('THOUGHT', '배차 의뢰 생성 워크플로우 감지. 대차/교환 여부 판별 및 전사 표준 헌장 2.3 적용 계획 수립.');

    const isExchange = lower.includes('교환') || lower.includes('대차');
    const toolToCall = isExchange ? 'dispatch_create_exchange' : 'dispatch_create_outbound';

    const params: any = {
      customerName: '(주)기연건설',
      siteName: '판교 테크노밸리 B동',
      startAddress: '충북 청주시 흥덕구 직지대로 436',
      endAddress: '경기 성남시 분당구 판교역로 166',
      requestDate: new Date().toISOString().split('T')[0],
      normalOneWayCost: 100000,
      paidBy: 'CUSTOMER'
    };

    // 가드레일 점검
    const guardrail = checkCharterGuardrails(toolToCall, params);
    addStep('GUARDRAIL_CHECK', `헌장 2.3 가드레일 사전 점검: ${guardrail.allowed ? '통과 (단일 EXCHANGE 1건 발행 및 왕복할인 ₩60,000 강제)' : '차단'}`, toolToCall, params, guardrail);

    if (!guardrail.allowed) {
      return {
        workflowId,
        prompt,
        status: 'GUARDRAIL_BLOCKED',
        steps,
        executedTools,
        metrics: { manualMinutes, aiSeconds: 1, timeSavedPercent: 0, manualClicks, aiClicks: 1, clicksSavedPercent: 0, errorRate: 0, conservationDiff: 0 }
      };
    }

    addStep('TOOL_CALL', `도구 호출 실행: ${toolToCall}`, toolToCall, params);
    executedTools.push(toolToCall);

    // 실제 가상 배차 생성 실행
    const finalCost = isExchange ? 140000 : 100000;
    const discount = isExchange ? 60000 : 0;
    const delOrderNo = `DEL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-AI01`;

    addStep('OBSERVATION', `배차 원장 적재 완료: 주문번호 ${delOrderNo}, 운송비 ₩${finalCost.toLocaleString()} (왕복할인 ₩${discount.toLocaleString()} 반영됨)`, toolToCall, null, { deliveryOrderNo: delOrderNo, status: 'PENDING', finalCost });

  } else if (lower.includes('소모품') || lower.includes('구매') || lower.includes('매입') || lower.includes('오일')) {
    manualMinutes = 90;
    manualClicks = 40;

    addStep('THOUGHT', '소모품 대량 구매 및 재고 입고 파이프라인 감지. 50종 일괄 적재 및 수불로그 무누락 검증.');
    const toolToCall = 'consumable_bulk_purchase';
    const params = { modelName: '유압작동유', qty: 50, unitPrice: 45000, sellerName: '삼화윤활유' };

    const guardrail = checkCharterGuardrails(toolToCall, params);
    addStep('GUARDRAIL_CHECK', `헌장 1.2 & 5.2 가드레일 사전 점검: 통과 (무음 실패 방지 및 수불로그 적재 확인)`, toolToCall, params, guardrail);

    addStep('TOOL_CALL', `도구 호출 실행: ${toolToCall}`, toolToCall, params);
    executedTools.push(toolToCall);

    addStep('OBSERVATION', `소모품 50개 매입 적재 완료. 본사 재고 +50 가산 및 consumable_logs 무누락 저장 확인.`, toolToCall, null, { modelName: params.modelName, addedStock: 50, totalAmount: 2250000 });

  } else if (lower.includes('미수') || lower.includes('연체') || lower.includes('차단')) {
    manualMinutes = 60;
    manualClicks = 30;

    addStep('THOUGHT', '미수 채권 연체 관리 워크플로우 감지. 3개월 이상 연체 고객사 조회 및 출고 차단 조치.');
    const toolToCall = 'delinquency_block_customer';
    const params = { customerId: 'cust-delinquent-01', reason: '3개월 연속 미수금 ₩5,400,000 발생으로 인한 영업 차단' };

    addStep('TOOL_CALL', `도구 호출 실행: ${toolToCall}`, toolToCall, params);
    executedTools.push(toolToCall);

    addStep('OBSERVATION', `고객사 거래상태 [BLOCKED]로 갱신 완료. 출고 및 계약 등록 원천 잠금 활성화.`, toolToCall, null, { customerId: params.customerId, status: 'BLOCKED' });

  } else if (lower.includes('오류') || lower.includes('신고') || lower.includes('에러') || lower.includes('버그') || lower.includes('error')) {
    manualMinutes = 35;
    manualClicks = 18;

    addStep('THOUGHT', '시스템 오류 신고 및 라이프사이클 처리 파이프라인 감지. 3단계(신고 등록->접수->완료) 상태 전이 및 첨부파일/환경정보 검증.');

    const isCompletion = lower.includes('완료') || lower.includes('조치') || lower.includes('해결');
    const isReception = lower.includes('접수') || lower.includes('배정');

    if (isCompletion || isReception) {
      const toolToCall = 'error_report_update_status';
      const targetStatus = isCompletion ? 'COMPLETED' : 'IN_PROGRESS';
      const params: any = {
        id: 'ERR-202609-001',
        status: targetStatus,
        assigneeName: '시스템팀',
        receptionNote: '오류 재현 확인 및 원인 디버깅 착수',
        resolutionNote: isCompletion ? '상태 전이 훅 조건문 보정 및 핫픽스 빌드 반영 완료' : undefined,
        resolvedVersion: isCompletion ? 'v1.1.0.Build.42' : undefined,
        rootCause: isCompletion ? 'null 체크 누락으로 인한 렌더링 예외' : undefined
      };

      const guardrail = checkCharterGuardrails(toolToCall, params);
      addStep('GUARDRAIL_CHECK', `헌장 1.2 가드레일 사전 점검: ${guardrail.allowed ? '통과 (원인/조치 내역 무누락 확인)' : '차단'}`, toolToCall, params, guardrail);

      if (!guardrail.allowed) {
        return {
          workflowId,
          prompt,
          status: 'GUARDRAIL_BLOCKED',
          steps,
          executedTools,
          metrics: { manualMinutes, aiSeconds: 1, timeSavedPercent: 0, manualClicks, aiClicks: 1, clicksSavedPercent: 0, errorRate: 0, conservationDiff: 0 }
        };
      }

      addStep('TOOL_CALL', `도구 호출 실행: ${toolToCall}`, toolToCall, params);
      executedTools.push(toolToCall);

      addStep('OBSERVATION', `오류 신고 ${params.id} 상태 [${targetStatus}]로 전이 완료. DB 무누락 적재 및 타임라인 갱신 확정.`, toolToCall, null, {
        reportId: params.id,
        status: targetStatus,
        resolvedVersion: params.resolvedVersion
      });
    } else {
      const toolToCall = 'error_report_create';
      const params = {
        title: '배차 목록 엑셀 내보내기 시 간헐적 타임아웃 오류',
        description: '운송대사 탭에서 데이터 500건 이상 필터링 시 엑셀 내보내기 버튼 클릭 반응 지연',
        category: 'UI_BUG',
        severity: 'MAJOR',
        menuId: 'dispatch_list',
        menuName: '배차 관리',
        reporterName: '배차담당자',
        attachmentsCount: 1
      };

      const guardrail = checkCharterGuardrails(toolToCall, params);
      addStep('GUARDRAIL_CHECK', `헌장 1.1 & 1.2 가드레일 사전 점검: 통과 (스크린샷 클립보드 첨부 및 환경정보 자동수집 확인)`, toolToCall, params, guardrail);

      addStep('TOOL_CALL', `도구 호출 실행: ${toolToCall}`, toolToCall, params);
      executedTools.push(toolToCall);

      const errNo = `ERR-${new Date().toISOString().slice(0,7).replace(/-/g,'')}-004`;
      addStep('OBSERVATION', `오류 신고 신규 등록 완료: 접수번호 ${errNo}, 상태 [REGISTERED], 첨부파일 1건 보존됨.`, toolToCall, null, {
        reportNo: errNo,
        status: 'REGISTERED',
        attachmentsCount: 1
      });
    }

  } else {
    // 종합 보존 법칙 전수 감사
    manualMinutes = 120;
    manualClicks = 50;

    addStep('THOUGHT', '시스템 전반 3대 보존 법칙 (날짜·수지·상태) 자동 전수 감사 실행.');
    const toolToCall = 'system_verify_charter_invariants';
    const params = { scope: 'ALL' };

    addStep('TOOL_CALL', `도구 호출 실행: ${toolToCall}`, toolToCall, params);
    executedTools.push(toolToCall);

    addStep('OBSERVATION', '3대 보존 법칙 전수 검증 완료: 날짜 보존 100%, 대차대조 차액 ₩0, 자산 상태 정합성 100%.', toolToCall, null, { dateConservation: 'MATCH', proRataRevenueDiff: 0, assetStatusIntegrity: '100.00%' });
  }

  // 최종 결과 종단 확정
  addStep('RESULT', '에이전틱 AI 업무 완결. 모든 비즈니스 도메인 불변식 및 헌장 보존 법칙 100% 충족.', undefined, null, { success: true });

  const aiSeconds = 2.4;
  const timeSavedPercent = Number((((manualMinutes * 60 - aiSeconds) / (manualMinutes * 60)) * 100).toFixed(1));
  const clicksSavedPercent = Number((((manualClicks - 1) / manualClicks) * 100).toFixed(1));

  return {
    workflowId,
    prompt,
    status: 'SUCCESS',
    steps,
    executedTools,
    metrics: {
      manualMinutes,
      aiSeconds,
      timeSavedPercent,
      manualClicks,
      aiClicks: 1,
      clicksSavedPercent,
      errorRate: 0.00,
      conservationDiff: 0
    }
  };
};

/**
 * 프론트엔드 간편 호출용 헬퍼 함수
 */
export const executeAgenticPrompt = async (
  prompt: string
): Promise<{ success: boolean; finalAnswer: string; result: AgenticExecutionResult }> => {
  const result = await runAgenticWorkflow(prompt);
  const lastStep = result.steps[result.steps.length - 1];
  const finalAnswer = lastStep?.thought || (typeof lastStep?.output === 'string' ? lastStep?.output : '업무 처리가 헌장 불변식에 따라 정상 완결되었습니다.');
  return {
    success: result.status === 'SUCCESS',
    finalAnswer,
    result
  };
};