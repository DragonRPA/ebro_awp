// src/data/modalManuals.ts
// 전사 팝업(모달) 전용 표준 업무 매뉴얼 및 활성 모달 DOM 자동 감지 엔진 (SSOT)
import type { ManualPage, ManualAnnotationItem } from '../types/manual';

/**
 * 팝업(모달) 전용 표준 매뉴얼 레지스트리
 * 모달이 열려 있는 상태에서 Ctrl+M을 누르면 해당 모달의 목적, 입력 체크포인트, 종단 액션을 오버레이로 즉시 안내
 */
export const MODAL_MANUAL_REGISTRY: Record<string, {
  modalId: string;
  modalName: string;
  category: string;
  keywords: string[];
  annotations: ManualAnnotationItem[];
}> = {
  // ── 1. 고객사 / 현장 등록 모달 ──
  modal_customer_register: {
    modalId: 'modal_customer_register',
    modalName: '고객사 및 현장 등록·수정',
    category: '고객',
    keywords: ['고객사', '신규 고객사', '거래처', '현장 등록', '고객 등록', '고객 수정'],
    annotations: [
      {
        seq: 1,
        selector: 'input[name*="company"], input[name*="name"], input[placeholder*="상호"], input[placeholder*="고객"], .card h3',
        type: 'callout',
        label: '상호명 및 기본 정보',
        description: '법인/개인 상호명과 대표자명을 정확히 기재합니다. 홈택스 조회 전 필수 입력 항목입니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[name*="biz"], input[placeholder*="사업자"], button:contains("홈택스"), button:contains("검증"), button:contains("조회")',
        type: 'stamp',
        label: '사업자번호 및 홈택스 검증',
        description: '10자리 사업자등록번호 입력 후 국세청 실시간 휴폐업 및 과세 유형을 검증합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'input[name*="phone"], input[name*="contact"], input[placeholder*="연락처"], input[placeholder*="휴대폰"]',
        type: 'stamp',
        label: '전자계약 및 세금계산서 수신처',
        description: '계약서 발송 알림톡 수신 휴대폰 및 전자세금계산서 수신 이메일을 지정합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button[type="submit"], button.btn-primary:contains("저장"), button.btn-primary:contains("등록")',
        type: 'click_ripple',
        label: '거래처 정보 저장',
        description: '거래처 및 현장 마스터에 즉시 저장되며, 이후 계약 체결 및 배차 대상으로 바인딩됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 2. EXCHANGE 대차 교체 의뢰 모달 ──
  modal_exchange_order: {
    modalId: 'modal_exchange_order',
    modalName: 'EXCHANGE 대차 교체 의뢰',
    category: '계약/배차',
    keywords: ['EXCHANGE', '대차 교체', '대차', '교체 의뢰', '교환 배차'],
    annotations: [
      {
        seq: 1,
        selector: '.exchange-target, [data-mid*="prev"], table, .card h3',
        type: 'callout',
        label: '회수 대상 전자산 및 현장 정보',
        description: '현장에서 고장/점검으로 반납되는 전자산 번호와 계약 제원을 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'select[name*="model"], select[name*="spec"], input[name*="spec"], select',
        type: 'stamp',
        label: '대차 요구 제원 (동일/동등)',
        description: '헌장 2.1 영업 R&R에 의거 영업은 개별 자산번호가 아닌 동등 제원 요구만 등록합니다. (단가·청구조건 100% 자동 상속)',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'textarea, input[placeholder*="사유"], input[placeholder*="메모"]',
        type: 'stamp',
        label: '대차 사유 및 현장 특이사항',
        description: '배차 및 주기장 담당자가 파악할 고장 증상과 상하차 현장 진입 조건을 기재합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button[type="submit"], button:contains("의뢰"), button.btn-primary:contains("교체"), button.btn-primary',
        type: 'click_ripple',
        label: '단일 EXCHANGE 1건 배차 발행 (헌장 2.3)',
        description: '출고/입고를 분할하지 않고 1건의 왕복 교환 배차(EXCHANGE)로 즉시 배차 대장에 인입됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 3. 계약 변경 / 연장 / 승계 모달 ──
  modal_contract_amendment: {
    modalId: 'modal_contract_amendment',
    modalName: '계약 변경(기간 연장 / 단가 조정 / 계약 승계)',
    category: '계약',
    keywords: ['계약 변경', '기간 연장', '계약 연장', '계약 승계', '승계 처리', '단가 변경'],
    annotations: [
      {
        seq: 1,
        selector: 'select[name*="type"], [data-mid*="type"], .card h3',
        type: 'callout',
        label: '계약 변경 유형 선택',
        description: '기간 연장, 렌탈 단가 조정, 계약 승계(양도/양수) 중 진행할 변경 유형을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[type="date"], input[name*="date"], input[name*="endDate"]',
        type: 'stamp',
        label: '변경 종료일자 / 연장 일수',
        description: '새로운 계약 만료일을 지정합니다. 청구서 마감 스케줄이 연장일자에 맞추어 재계산됩니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'input[name*="rate"], input[name*="price"], input[placeholder*="단가"], input[placeholder*="금액"]',
        type: 'stamp',
        label: '월 렌탈료 및 일할 계산 단가',
        description: '자산별 매출 기여액 정밀 일할 계산(헌장 4.1)을 위한 일할 기준 단가를 검토합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button[type="submit"], button:contains("승계"), button.btn-primary:contains("저장"), button.btn-primary',
        type: 'click_ripple',
        label: '계약 변경 이력 무누락 저장',
        description: '계약 마스터 및 타임라인에 변경 이력이 영구 보존되며, 승계 시 후속 채권 주체가 자동 전환됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 4. 출고 검수 승인 모달 ──
  modal_outbound_inspection: {
    modalId: 'modal_outbound_inspection',
    modalName: '출고 검수 승인 스튜디오',
    category: '출고/반납',
    keywords: ['출고 검수', '출고 검수 승인', '출고 승인'],
    annotations: [
      {
        seq: 1,
        selector: '.asset-header, [data-mid*="asset"], .card h3, table',
        type: 'callout',
        label: '배차 자산번호 및 제원 확인',
        description: '상차 대상 장비의 자산번호, 시리얼, 제원 일치 여부를 육안 대조합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[type="checkbox"], .checklist-container, table tr',
        type: 'stamp',
        label: '안전 장치 및 동작 필수 점검',
        description: '과상승 방지봉, 리밋 스위치, 경광등, 조작반, 배터리 충전 상태를 100% 필수 체크합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'input[type="file"], .photo-upload-box, button:contains("사진")',
        type: 'stamp',
        label: '주기장 상차 증빙 사진 등록',
        description: '상차 전 4면 외관 및 계기판 사진을 등록하여 향후 파손 분쟁을 원천 차단합니다.',
        badgeColor: '#D97706',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button.btn-primary:contains("승인"), button.btn-primary:contains("출고"), button[type="submit"]',
        type: 'click_ripple',
        label: '출고 승인 ➔ 자산상태 RENTED(대여중) 전환',
        description: '헌장 1.3 원칙에 따라 검수 승인 완료 즉시 자산 상태가 대여중(RENTED)으로 전환 마감됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 5. 반납 검수 승인 모달 ──
  modal_inbound_inspection: {
    modalId: 'modal_inbound_inspection',
    modalName: '반납/입고 검수 승인 스튜디오',
    category: '출고/반납',
    keywords: ['반납 검수', '반납 승인', '입고 검수', '반납 처리'],
    annotations: [
      {
        seq: 1,
        selector: 'input[name*="hour"], input[placeholder*="아워"], .card h3',
        type: 'callout',
        label: '입고 아워미터(Hour Meter) 검수',
        description: '현장 가동 총 시간을 기록하여 엔진/배터리 소모 주기 및 잔여 정비 주기를 업데이트합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'select[name*="defect"], select[name*="fault"], input[type="checkbox"]',
        type: 'stamp',
        label: '외관 파손 및 고객 과실 귀책 판정',
        description: '타이어 찢김, 발판 찌그러짐, 페인트 오염 등 고객 과실(PAID_BY_CUSTOMER) 여부를 판단합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button.btn-primary:contains("승인"), button.btn-primary:contains("반납"), button[type="submit"]',
        type: 'click_ripple',
        label: '반납 승인 (임대가능 또는 정비 입고 전환)',
        description: '결함이 없으면 AVAILABLE(임대가능), 수리가 필요하면 REPAIRING(정비중)으로 안전하게 분기 전이됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 6. 수동 배차 신규 생성 모달 ──
  modal_dispatch_manual: {
    modalId: 'modal_dispatch_manual',
    modalName: '수동 배차 신규 생성',
    category: '배차',
    keywords: ['수동 배차', '수동 배차 신규 생성', '배차 생성'],
    annotations: [
      {
        seq: 1,
        selector: 'select, [data-mid*="category"], .card h3',
        type: 'callout',
        label: '배차 구분 선택',
        description: '출고, 입고, 교환, 반납, 정비, 이동 등 비즈니스 배차 목적을 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[placeholder*="상차"], input[placeholder*="출발"]',
        type: 'stamp',
        label: '상차지 (출발지 주기장/현장)',
        description: '장비가 상차될 출발지 주소와 현장 담당자 연락처를 입력합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'input[placeholder*="하차"], input[placeholder*="도착"]',
        type: 'stamp',
        label: '하차지 (도착지 현장/주기장)',
        description: '장비가 도착할 하차지 주소 및 현장 작업 조건을 입력합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button.btn-primary:contains("저장"), button.btn-primary:contains("생성")',
        type: 'click_ripple',
        label: '배차 대장 즉시 등록',
        description: '배차 대장에 미배정 상태로 등록되어 기사 배정 파이프라인으로 연결됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 7. 배차 운송료 금액 수정 모달 ──
  modal_dispatch_cost_edit: {
    modalId: 'modal_dispatch_cost_edit',
    modalName: '배차 운송료 금액 수정',
    category: '배차/정산',
    keywords: ['운송료 금액 수정', '운송료 수정', '배차 운송료 금액 수정', '운송료 변경'],
    annotations: [
      {
        seq: 1,
        selector: 'input[type="number"], input[placeholder*="금액"], .card h3',
        type: 'callout',
        label: '조정 운송료 실금액 입력',
        description: '경유지 추가, 대기료 가산, 야간 할증 등이 반영된 최종 운송료를 입력합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[placeholder*="사유"], textarea',
        type: 'stamp',
        label: '운송료 수정 사유 기재',
        description: '월말 운송료 대사(Audit) 시 증빙으로 활용될 변동 사유를 명시합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button.btn-primary:contains("저장"), button.btn-primary:contains("수정")',
        type: 'click_ripple',
        label: '배차 실운송료 DB 동기화 저장',
        description: 'deliveries 테이블의 운송료 및 정산 데이터가 즉시 갱신됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 8. 배차 기사 배정 및 수정 스튜디오 모달 ──
  modal_dispatch_detail: {
    modalId: 'modal_dispatch_detail',
    modalName: '배차 수정 및 운송 기사 배정',
    category: '배차',
    keywords: ['기사 배정', '배차 배정', '배차 수정', '배차 상세'],
    annotations: [
      {
        seq: 1,
        selector: 'select[name*="carrier"], select[name*="driver"], [data-mid*="driver"]',
        type: 'callout',
        label: '지입/외주 운송 기사 선택',
        description: '톤수 규격(5톤 축차, 3.5톤 등) 및 주기장 접근 기사를 선택하여 배정합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[name*="cost"], input[placeholder*="운송료"], select[name*="paidBy"]',
        type: 'stamp',
        label: '운송비 금액 및 지급/청구 주체',
        description: '당사 부담(OURS), 고객 청구(CUSTOMER), 거래처 부담(VENDOR) 귀속선을 명확히 지정합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button.btn-primary:contains("배정"), button.btn-primary:contains("확정"), button[type="submit"]',
        type: 'click_ripple',
        label: '배차 확정 및 기사 카톡/문자 발송',
        description: '배차가 확정되어 기사에게 상하차지 주소 및 장비 제원이 자동 전송됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 9. 정비 조치 및 부품 투입 모달 ──
  modal_repair_execution: {
    modalId: 'modal_repair_execution',
    modalName: '정비 조치 및 부품 투입',
    category: '정비',
    keywords: ['정비 조치', '부품 투입', '정비 완료', '수리 조치', '정비 등록'],
    annotations: [
      {
        seq: 1,
        selector: 'select[name*="type"], .repair-type, .card h3',
        type: 'callout',
        label: '정비 유형 (자체정비 vs 외주수리)',
        description: '주기장 자체 정비 또는 외주 정비공장 위탁 여부를 선택합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'button:contains("부품"), select[name*="part"], input[name*="qty"]',
        type: 'stamp',
        label: '투입 부품 및 소모품 재고 불출',
        description: '솔레노이드, 배터리, 유압호스 등 투입된 소모품 수량을 기록하여 재고에서 자동 차감합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'select[name*="paidBy"], input[placeholder*="수리비"], input[placeholder*="공임"]',
        type: 'stamp',
        label: '수리비 청구 구분 (유상 청구 vs 당사 부담)',
        description: '고객 과실 파손인 경우 유상 수리비 청구(REPAIR_BILLING) 결재선으로 연계됩니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button.btn-primary:contains("완료"), button.btn-primary:contains("저장"), button[type="submit"]',
        type: 'click_ripple',
        label: '정비 완료 및 AVAILABLE(임대가능) 복원',
        description: '장비 정비 점수가 0점으로 복원되며 자산 상태가 즉시 임대가능으로 전환됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 10. 현장 AS 접수 및 출동 지시 모달 ──
  modal_field_as_dispatch: {
    modalId: 'modal_field_as_dispatch',
    modalName: '현장 AS 긴급 접수 및 출동 지시',
    category: '정비/현장AS',
    keywords: ['현장 AS', 'AS 접수', '출동 지시', '긴급 출동'],
    annotations: [
      {
        seq: 1,
        selector: 'select[name*="asset"], [data-mid*="asset"], .card h3',
        type: 'callout',
        label: '고장 현장 및 계약 장비 식별',
        description: '고장이 접수된 고객사 현장과 가동 중인 자산번호를 매핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'textarea, input[placeholder*="증상"], input[placeholder*="고장"]',
        type: 'stamp',
        label: '고장 증상 및 안전 조치',
        description: '상승 불가, 주행 불량, 누유 등 현장 증상과 작업자 안전 대피 여부를 기록합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'select[name*="tech"], select[name*="priority"]',
        type: 'stamp',
        label: '출동 서비스 기사 및 우선순위 지정',
        description: '인근 AS 서비스 차량 및 긴급(1시간 이내 도착) 여부를 지정합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button.btn-primary:contains("출동"), button.btn-primary:contains("지시"), button[type="submit"]',
        type: 'click_ripple',
        label: '현장 AS 출동 지령 발령',
        description: 'AS 기사에게 실시간 위치 알림이 전송되고 대시보드 긴급 ToDo에 등록됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 11. 청구 면제 / 감면 신청 모달 ──
  modal_billing_waiver: {
    modalId: 'modal_billing_waiver',
    modalName: '청구 면제 및 감면 신청',
    category: '정산',
    keywords: ['청구 면제', '감면 신청', '면제 신청', '청구 감면'],
    annotations: [
      {
        seq: 1,
        selector: 'input[type="number"], input[placeholder*="면제"], .card h3',
        type: 'callout',
        label: '면제/감면 신청 금액',
        description: '월 렌탈료 또는 운송비, 수리비 중 면제할 금액을 정확히 산정하여 입력합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'textarea, input[placeholder*="사유"]',
        type: 'stamp',
        label: '면제 사유 (영업 특약 / 장비 결함 보상)',
        description: '결재권자가 판단할 수 있도록 현장 귀책 사유 및 영업 협의 내용을 상세 기재합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button.btn-primary:contains("면제"), button.btn-primary:contains("신청"), button[type="submit"]',
        type: 'click_ripple',
        label: '결재 상신 및 승인 요청',
        description: '전결 티어 결재선에 연계되며, 결재 완료 전까지 매출 채권에서 임의 탕감되지 않습니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 12. 통장 입금 1:1 수기 대사 매칭 모달 ──
  modal_bank_matching: {
    modalId: 'modal_bank_matching',
    modalName: '통장 입금 1:1 수기 대사 매칭',
    category: '정산',
    keywords: ['통장 입금', '수기 대사', '수기 매칭', '1:1 매칭', '입금 대사', '외상매출금 수납'],
    annotations: [
      {
        seq: 1,
        selector: '.deposit-info, div[style*="font-weight"], .card h3',
        type: 'callout',
        label: '실제 통장 입금 내역 (스크래핑 원본)',
        description: '입금일시, 통장 적요(입금자명), 실 입금 금액을 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[placeholder*="검색"], table tr, input[type="radio"]',
        type: 'stamp',
        label: '매칭 대상 미수금 청구서 선택',
        description: '거래처 상호 및 청구 연월을 검색하여 수납 상계할 외상매출금 1건을 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'input[type="number"], input[placeholder*="수납"]',
        type: 'stamp',
        label: '수납액 입력 (일부 수납 지원)',
        description: '전액 수납 또는 일부 잔액 수납액을 입력하여 외상 잔액을 실시간 차감 계산합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button.btn-primary:contains("확정"), button.btn-primary:contains("매칭"), button[type="submit"]',
        type: 'click_ripple',
        label: '1:1 매칭 확정 ➔ 수납 완료 전이',
        description: '통장 입금과 매출 청구가 1:1로 확정 바인딩되며 영수증 발행 가능 상태로 전환됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 13. 독촉장 및 최고장 발송 모달 ──
  modal_delinquency_notice: {
    modalId: 'modal_delinquency_notice',
    modalName: '독촉장 및 최고장 발송',
    category: '정산/채권',
    keywords: ['독촉장', '최고장', '연체 통보', '내용증명'],
    annotations: [
      {
        seq: 1,
        selector: '.delinquency-summary, .card h3',
        type: 'callout',
        label: '연체 채권 내역 검토',
        description: '거래처의 누적 연체 일수와 연체 원금, 지연 손해금을 일괄 검토합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'select[name*="channel"], input[type="radio"]',
        type: 'stamp',
        label: '발송 수단 선택 (알림톡/문자/우편내용증명)',
        description: '사법적 증빙 효력에 따라 카카오 알림톡 또는 등기 우편 최고장 양식을 선택합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button.btn-primary:contains("발송"), button[type="submit"]',
        type: 'click_ripple',
        label: '독촉장 정식 발송 및 이력 영구 기록',
        description: '고객사에 정식 발송되며 채권 추심 타임라인에 발송 시각 및 전문이 영구 보존됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 14. 엑셀 데이터 업로드 모달 ──
  modal_excel_upload: {
    modalId: 'modal_excel_upload',
    modalName: '엑셀 데이터 일괄 업로드',
    category: '전사 공통',
    keywords: ['엑셀 업로드', '엑셀 일괄 등록', '일괄 업로드', '파일 업로드'],
    annotations: [
      {
        seq: 1,
        selector: 'input[type="file"], button:contains("파일 선택"), .card h3',
        type: 'callout',
        label: '표준 서식 엑셀 파일 선택',
        description: '시스템 표준 템플릿(.xlsx)에 맞추어 작성된 파일을 선택하여 로드합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'table, .preview-table, .validation-box',
        type: 'stamp',
        label: '데이터 사전 무결성 검증 (Preview)',
        description: '필수 컬럼 누락, 데이터 형식 오류, 중복 키 여부를 사전에 100% 검증합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button.btn-primary:contains("업로드"), button.btn-primary:contains("저장")',
        type: 'click_ripple',
        label: 'DB 일괄 원자적 저장 (Batch Insert)',
        description: '검증 완료된 행들을 DB에 원자적으로 일괄 적재하며 오류 발생 시 자동 롤백됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 15. 결재 합의 및 승인/반려 모달 ──
  modal_approval_action: {
    modalId: 'modal_approval_action',
    modalName: '결재 합의 및 승인/반려',
    category: '전자결재',
    keywords: ['결재', '승인/반려', '결재 합의', '전결', '승인 처리'],
    annotations: [
      {
        seq: 1,
        selector: '.approval-info, .card h3',
        type: 'callout',
        label: '상신 안건 내용 및 첨부 증빙 검토',
        description: '상신자, 기안 부서, 금액, 첨부 문서 등 결재 상신 컨텍스트를 검토합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'textarea, input[placeholder*="의견"], input[placeholder*="사유"]',
        type: 'stamp',
        label: '결재 심사 의견 기재',
        description: '승인 조건 또는 반려 사유를 구체적으로 명시하여 기안자에게 피드백합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button:contains("승인"), button.btn-primary',
        type: 'click_ripple',
        label: '최종 승인 (전결 또는 차기 결재선 이관)',
        description: '본인 티어가 전결 티어를 충족하면 즉시 최종 APPROVED 마감되며, 미달 시 차기 티어로 승계됩니다.',
        badgeColor: '#059669',
        positionHint: 'top',
        spotlight: true,
      },
      {
        seq: 4,
        selector: 'button:contains("반려"), button.btn-danger',
        type: 'click_ripple',
        label: '결재 반려 (REJECTED)',
        description: '안건이 즉시 반려 처리되며 기안자의 ToDo 피드에 반려 사유가 반환됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 16. 사업자등록증 OCR 및 홈택스 검증 모달 ──
  modal_business_license: {
    modalId: 'modal_business_license',
    modalName: '사업자등록증 AI OCR 및 홈택스 검증',
    category: '고객/매입처',
    keywords: ['사업자등록증', '사업자등록증 검증', '홈택스 검증', 'NTS', '휴폐업 검증'],
    annotations: [
      {
        seq: 1,
        selector: 'input[type="file"], .ocr-dropzone, .card h3',
        type: 'callout',
        label: '사업자등록증 사본 업로드',
        description: 'JPG, PNG, PDF 형식의 사업자등록증 파일을 드래그 또는 선택하여 로드합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[name*="name"], input[name*="ceo"], input[name*="biz"]',
        type: 'stamp',
        label: 'AI 자동 추출 필드 검수',
        description: 'OCR 엔진이 자동 추출한 상호명, 등록번호, 대표자, 개업일자를 육안 검증합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button:contains("국세청"), button:contains("홈택스"), button:contains("조회")',
        type: 'stamp',
        label: '국세청 실시간 상태 조회',
        description: '홈택스 API와 통신하여 계속사업자 여부 및 일반/간이과세 구분을 실시간 확인합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button.btn-primary:contains("반영"), button.btn-primary:contains("저장")',
        type: 'click_ripple',
        label: '거래처 마스터 자동 반영',
        description: '검증된 정품 사업자 정보와 첨부 사본이 거래처 마스터에 영구 보존됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 17. 주기장 / 현장 기상 및 풍속 상세 모달 ──
  modal_destination_weather: {
    modalId: 'modal_destination_weather',
    modalName: '현장 기상 및 고소작업 풍속 안전 기준',
    category: '안전/작업환경',
    keywords: ['날씨', '기상', '풍속', '작업 안전', '기상 정보', 'DestinationWeather'],
    annotations: [
      {
        seq: 1,
        selector: '.wind-speed, [data-mid*="wind"], .card h3',
        type: 'callout',
        label: '실시간 풍속(m/s) 및 돌풍 지수',
        description: '현장 실시간 풍속을 확인합니다. 고소작업대 표준 안전 수칙상 10m/s 이상 시 작업이 금지됩니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: '.weather-details, .rain-forecast, table',
        type: 'stamp',
        label: '강수 확률 및 노면 결빙 상태',
        description: '비/눈 예보 시 상하차 작업 시 슬립(미끄러짐) 사고 방지를 위한 체인/고임목 장착 여부를 점검합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button:contains("확인"), button:contains("닫기")',
        type: 'click_ripple',
        label: '안전 수칙 확인 완료',
        description: '현장 기상 요건을 숙지하고 작업을 계속 진행합니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: false,
      },
    ],
  },

  // ── 18. 신규 자산 취득 등록 모달 ──
  modal_asset_acquisition: {
    modalId: 'modal_asset_acquisition',
    modalName: '신규 자산 취득 등록',
    category: '자산',
    keywords: ['신규 자산', '자산 취득', '장비 등록', '자산 등록'],
    annotations: [
      {
        seq: 1,
        selector: 'input[name*="asset"], input[placeholder*="자산번호"], .card h3',
        type: 'callout',
        label: '자산 관리 번호 (사번식 식별자)',
        description: '회사 고유 자산번호(예: SJ-001) 및 차대번호(Serial Number)를 기재합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'select[name*="model"], select[name*="maker"], input[name*="spec"]',
        type: 'stamp',
        label: '제조사·모델명 및 최대 작업높이',
        description: 'Skyjack, Genie 등 제조사와 최대 작업높이(미터 규격)를 지정합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'input[type="date"], input[name*="acquisition"], input[placeholder*="취득가"]',
        type: 'stamp',
        label: '취득일자 및 취득가액',
        description: '감가상각 계산 및 자산 건전성 관리를 위한 장부가액을 입력합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'button.btn-primary:contains("저장"), button.btn-primary:contains("등록")',
        type: 'click_ripple',
        label: '자산 마스터 등록 ➔ AVAILABLE(임대가능) 인입',
        description: '자산 대장에 즉시 신규 자산으로 등록되어 계약 출고 대기군에 편성됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

  // ── 19. 매입처 등록 및 수정 모달 ──
  modal_vendor_register: {
    modalId: 'modal_vendor_register',
    modalName: '매입처(협력사) 등록 및 수정',
    category: '매입처',
    keywords: ['매입처', '매입처 등록', '매입처 정보 수정', '협력사'],
    annotations: [
      {
        seq: 1,
        selector: 'input[name*="name"], input[placeholder*="상호"], .card h3',
        type: 'callout',
        label: '매입처 상호 및 업종 구분',
        description: '운송사, 부품사, 외주수리공장 등 매입처 유형과 정식 상호명을 입력합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[name*="biz"], input[placeholder*="사업자"]',
        type: 'stamp',
        label: '사업자번호 및 지급 계좌',
        description: '세금계산서 발행 사업자번호와 운송비/물품대금 지급용 통장 계좌를 등록합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'button.btn-primary:contains("저장"), button.btn-primary:contains("등록")',
        type: 'click_ripple',
        label: '매입처 마스터 저장',
        description: '배차 지입사 및 부품 매입처로 지정 가능하도록 즉시 등록됩니다.',
        badgeColor: '#E53935',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },

    // ── 외상미수금 등록 모달 ──
  modal_receivable_create: {
    modalId: 'modal_receivable_create',
    modalName: '외상미수금 등록',
    category: '외상/채권',
    keywords: ['외상미수금', '외상미수금 등록', '외상 등록', '외상매출금 등록', '미수금 등록'],
    annotations: [
      {
        seq: 1,
        selector: '[data-mid="rec-modal-occurred-date"]',
        type: 'stamp',
        label: '발생일자 설정',
        description: '외상미수금이 실제 발생한 날짜(수리 완료일/운송 배차일/현장 사고일)를 지정합니다. 기본값으로 오늘 날짜가 자동 세팅됩니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="rec-modal-search-box"]',
        type: 'stamp',
        label: '계약·고객사·현장 검색',
        description: '고객사 상호, 한글 초성(예: "ㅅㅅ"), 계약번호(예: C202603-XXXX), 현장명을 입력하여 하위 3단 드롭다운을 실시간 필터링합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: '[data-mid="rec-modal-cust-select"]',
        type: 'click_ripple',
        label: '고객사 필터·선택',
        description: '외상 채권을 귀속시킬 대상 고객사를 선택합니다. 선택 즉시 해당 거래처의 현재 유효한 계약과 현장 목록만 자동 추려집니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 4,
        selector: '[data-mid="rec-modal-site-select"]',
        type: 'click_ripple',
        label: '계약 현장 선택',
        description: '외상 비용이 발생한 구체적인 현장을 선택합니다. 특정 현장을 선택하면 해당 현장에 매핑된 계약번호가 자동 연동됩니다.',
        badgeColor: '#0D9488',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 5,
        selector: '[data-mid="rec-modal-contract-select"]',
        type: 'click_ripple',
        label: '계약번호 선택',
        description: '특정 렌탈 계약서에 종속시켜 차기 렌탈료와 합산 청구하려면 계약번호를 선택하고, 업체 공통 채권으로 남기려면 [계약 미지정 (고객사 공통)]을 유지합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 6,
        selector: '[data-mid="rec-modal-cost-type"]',
        type: 'stamp',
        label: '비용 유형 선택',
        description: '수리비(파손/부품교체), 운송료(추가/단독 배차), 청소비/세차비, 기타 부대비용 중 발생 사유에 맞는 회계 계정 유형을 선택합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="rec-modal-total-amount"]',
        type: 'stamp',
        label: '외상 총액 입력',
        description: '고객사에 청구할 총 외상 금액(원 단위)을 숫자로 정확히 입력합니다.',
        badgeColor: '#E11D48',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 8,
        selector: '[data-mid="rec-modal-internal-desc"]',
        type: 'stamp',
        label: '내부 기재명 (실제 내역) 작성',
        description: '사내 정비/운송 장부에 무누락 보존될 실제 발생 상세 내역(예: "스카이잭 3219 현장 파손 수리비 (조이스틱 교체)")을 필수 입력합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 9,
        selector: '[data-mid="rec-modal-display-name"]',
        type: 'stamp',
        label: '명세서 표기명 (고객 노출용)',
        description: "거래처에 '파손' 등 민감한 표현을 노출하지 않고 명세서에 표기할 대체 품목명(예: 렌탈 장비 정비료)을 선택적으로 입력합니다. (미입력 시 내부 기재명 사용)",
        badgeColor: '#6366F1',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 10,
        selector: '[data-mid="rec-modal-submit-btn"]',
        type: 'click_ripple',
        label: '[외상 등록 완료] 최종 저장',
        description: '입력된 모든 항목을 검증하고 DB에 외상 채권을 영구 저장합니다. 등록된 미수금은 외상매출금 대장에 등재되며 차기 청구서에 자동 합산됩니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]
  },

    // ── 20. 일반 팝업(모달) 공통 폴백 매뉴얼 ──
  modal_generic_dialog: {
    modalId: 'modal_generic_dialog',
    modalName: '팝업 다이얼로그 업무 가이드',
    category: '팝업 공통',
    keywords: [],
    annotations: [
      {
        seq: 1,
        selector: 'h1, h2, h3, h4, .card-title, strong, [data-mid*="title"]',
        type: 'callout',
        label: '팝업 업무 목표 및 헤더 확인',
        description: '현재 실행된 팝업의 핵심 업무 목적과 조치 대상을 확인합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 2,
        selector: 'input[type="date"], input[type="month"], select:first-of-type, input:first-of-type',
        type: 'stamp',
        label: '기본 일자 및 분류 항목 지정',
        description: '업무 기준 일자 또는 분류 카테고리를 먼저 선택하여 작업 범위를 스코핑합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 3,
        selector: 'input[placeholder*="검색"], select:nth-of-type(2), [data-mid*="search"]',
        type: 'stamp',
        label: '대상 식별 및 검색 선택',
        description: '거래처, 장비, 계약 등 처리 대상 데이터를 검색하거나 드롭다운에서 선택합니다.',
        badgeColor: '#2563EB',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: 'input[type="number"], input[placeholder*="금액"], input[placeholder*="수량"]',
        type: 'stamp',
        label: '핵심 수치 및 금액/수량 입력',
        description: '비용, 수량, 단가 등 회계 및 자산 변동 수치를 정확히 입력합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 5,
        selector: 'textarea, input[placeholder*="내역"], input[placeholder*="사유"], input[placeholder*="메모"]',
        type: 'stamp',
        label: '상세 사유 및 비고/메모 기재',
        description: '발생 원인, 처리 사유, 전달사항을 무누락 기록하여 감사 추적성을 확보합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: 'button[type="submit"], button.btn-primary, button:contains("저장"), button:contains("완료"), button:contains("확인")',
        type: 'click_ripple',
        label: '최종 완결 액션 (저장 / 승인)',
        description: '모든 입력값의 정합성을 검증한 후 최종 확정 버튼을 눌러 비즈니스 이벤트를 완결합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      },
    ],
  },
};

/**
 * 팝업 제목(텍스트)으로부터 가장 적합한 모달 매뉴얼 키 매핑
 */
export function matchModalKeyFromTitle(title: string): string {
  if (!title) return 'modal_generic_dialog';
  const cleanTitle = title.replace(/[^\w\s가-힣]/g, ' ').trim().toLowerCase();

  for (const [key, def] of Object.entries(MODAL_MANUAL_REGISTRY)) {
    if (key === 'modal_generic_dialog') continue;
    for (const kw of def.keywords) {
      if (cleanTitle.includes(kw.toLowerCase())) {
        return key;
      }
    }
  }

  return 'modal_generic_dialog';
}

/**
 * 현재 브라우저 DOM 상에 열려있는 최상위 모달 요소 탐색
 * - position: fixed / absolute
 * - 뷰포트를 채우는 백드롭 또는 높은 z-index
 * - 매뉴얼 자체 UI([data-manual-ui="true"])는 엄격히 제외
 */
export function detectActiveModalElement(): { modalEl: HTMLElement; title: string; modalKey: string } | null {
  if (typeof document === 'undefined') return null;

  // 전체 DOM에서 fixed/absolute 요소들 중 백드롭이나 다이얼로그 탐색
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('div, section, dialog'));
  const foundModals: { el: HTMLElement; zIndex: number; title: string }[] = [];

  for (const el of candidates) {
    // 매뉴얼 자체 UI 제외
    if (el.closest('[data-manual-ui="true"]') || el.getAttribute('data-manual-ui') === 'true') continue;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

    const pos = style.position;
    if (pos !== 'fixed' && pos !== 'absolute') continue;

    const rect = el.getBoundingClientRect();
    const isFullScreenBackdrop = (rect.width >= window.innerWidth * 0.7 && rect.height >= window.innerHeight * 0.7);
    const zIndexVal = parseInt(style.zIndex, 10) || 0;
    const bg = style.backgroundColor || '';
    const hasBackdropBg = bg.includes('rgba') || bg.includes('rgb(0, 0, 0)') || style.backdropFilter !== 'none';

    const isExplicitDialog = el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true';
    const isModalClass = el.className && typeof el.className === 'string' && (
      el.className.includes('modal') || el.className.includes('dialog')
    );

    // 조건 충족 시 모달로 판정
    if ((isFullScreenBackdrop && (hasBackdropBg || zIndexVal >= 100)) || isExplicitDialog || (isModalClass && zIndexVal >= 100)) {
      // 모달 내부 제목 텍스트 탐색
      const titleEl = el.querySelector('h1, h2, h3, h4, .card-title, [data-mid*="title"], strong, b');
      let title = titleEl ? (titleEl as HTMLElement).innerText.trim() : '';
      if (!title) {
        const boldText = el.querySelector('div[style*="fontWeight"], div[style*="font-weight"]');
        if (boldText) title = (boldText as HTMLElement).innerText.trim().slice(0, 40);
      }
      foundModals.push({ el, zIndex: zIndexVal, title });
    }
  }

  if (foundModals.length === 0) return null;

  // 가장 높은 z-index (화면 최상단) 모달 선택
  foundModals.sort((a, b) => b.zIndex - a.zIndex);
  const topModal = foundModals[0];
  const modalKey = matchModalKeyFromTitle(topModal.title);

  return {
    modalEl: topModal.el,
    title: topModal.title || '팝업(모달)',
    modalKey,
  };
}

/**
 * 모달 매뉴얼 키에 해당하는 ManualPage 데이터 반환
 */
export function getModalManualPage(modalKey: string, customTitle?: string): ManualPage {
  const def = MODAL_MANUAL_REGISTRY[modalKey] || MODAL_MANUAL_REGISTRY['modal_generic_dialog'];
  return {
    pageId: def.modalId,
    pageTitle: customTitle || def.modalName,
    version: 5,
    items: def.annotations,
  };
}

/**
 * 💡 [전사 표준] 현재 화면의 실행 컨텍스트(활성 모달, 활성 서브뷰/탭, 기본 메뉴)를 동적으로 실시간 감지
 * @param baseMenuId 현재 상위 메뉴 ID (예: 'contract', 'billing')
 * @param defaultTitle 현재 상위 메뉴명 (예: '계약 관리', '청구 / 수납 관리')
 */
export function detectCurrentContext(baseMenuId: string, defaultTitle?: string): {
  pageId: string;
  pageTitle: string;
  isModal: boolean;
  rootEl: HTMLElement | null;
} {
  if (typeof document === 'undefined') {
    return { pageId: baseMenuId, pageTitle: defaultTitle || baseMenuId, isModal: false, rootEl: null };
  }

  // 1. 최우선 순위: 화면에 열려있는 팝업/모달 감지
  const activeModal = detectActiveModalElement();
  if (activeModal) {
    return {
      pageId: activeModal.modalKey,
      pageTitle: activeModal.title,
      isModal: true,
      rootEl: activeModal.modalEl,
    };
  }

  // 2. 현재 화면에 표시(visible) 중인 서브뷰 감지 ([data-subview])
  const subviewEls = Array.from(document.querySelectorAll<HTMLElement>('[data-subview]'));
  for (const el of subviewEls) {
    // 매뉴얼 자체 UI 배제
    if (el.closest('[data-manual-ui="true"]') || el.getAttribute('data-manual-ui') === 'true') continue;
    // 실제 화면에 노출 중인 서브뷰인지 검사
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const isVisible = (el.offsetParent !== null || rect.height > 0) && style.display !== 'none' && style.visibility !== 'hidden';
    if (isVisible) {
      const subviewId = el.getAttribute('data-subview');
      const subviewTitle = el.getAttribute('data-subview-title') || defaultTitle || baseMenuId;
      if (subviewId) {
        return {
          pageId: subviewId,
          pageTitle: subviewTitle,
          isModal: false,
          rootEl: el,
        };
      }
    }
  }

  // 3. 기본 메뉴 ID 폴백
  return {
    pageId: baseMenuId,
    pageTitle: defaultTitle || baseMenuId,
    isModal: false,
    rootEl: null,
  };
}
