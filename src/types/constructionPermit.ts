// src/types/constructionPermit.ts
// 국토교통부 세움터 건축행정 + V-World 도로망 + 국토안전관리원 CSI 표준 데이터 모델

export interface RoadAccessInfo {
  roadName: string; // 접면 도로명 (예: 남양중앙로)
  roadWidth: number; // 도로 폭(m) (예: 12m)
  lanes: number; // 차로수 (예: 4차로)
  roadRank: '광로/대로' | '중로' | '소로' | '이면도로/골목길'; // 도로 등급
  truckFeasibility: 'TRAILER_ALLOWED' | 'LARGE_ALLOWED' | 'MID_ONLY' | 'SMALL_ONLY_WARNING';
  turnaroundSpace: boolean; // 트럭 회차 공간 확보 여부
  warningMessage?: string; // 배차 주의 메모
}

export interface CsiSafetyInfo {
  safetyPlanRequired: boolean; // 안전관리계획 수립 법정 의무 현장 (10층 이상 또는 지하 10m 이상)
  safetyRiskGrade: 'HIGH' | 'MEDIUM' | 'LOW'; // 공사 위험도 등급
  requiredSafetyOptions: string[]; // 고소작업대 필수 탑재 안전장치
  documentRequirements: string[]; // 현장 제출 필수 서류
  accidentHistoryWarning?: boolean; // 안전관리 주의보
}

export interface ConstructionPermitItem {
  id: string;
  mgmtNo: string; // 인허가 관리번호 (mgmPmsrgstPk)
  permitKind: '신축' | '증축' | '대수선' | '용도변경';
  siteAddress: string; // 지번 주소
  siteRoadAddress?: string; // 도로명 주소
  sido: string; // 시도
  sigungu: string; // 시군구
  bjdong: string; // 읍면동
  bunji?: string;
  projectName: string; // 건물명/사업명
  mainUse: string; // 주용도
  subUse?: string; // 세부용도
  structure: string; // 구조
  plotArea: number; // 대지면적(㎡)
  archArea: number; // 건축면적(㎡)
  totArea: number; // 연면적(㎡)
  groundFloors: number; // 지상층수
  underFloors: number; // 지하층수
  height?: number; // 높이(m)
  permitDate: string; // 허가일자 (YYYY-MM-DD)
  startPlanDate?: string; // 착공예정일
  actualStartDate?: string; // 실제착공일
  expectedEndDate: string; // 준공예정일
  builderName: string; // 시공사
  builderPhone?: string; // 현장연락처
  clientName: string; // 건축주
  supervisorName?: string; // 감리자
  dataSource: 'PUBLIC_API_REALTIME' | 'PRESET_DATASET'; // 데이터 출처
  
  // V-World 도로망 & CSI 안전망 연동 데이터
  roadAccess: RoadAccessInfo;
  csiSafety: CsiSafetyInfo;

  // AI 공정 추정 및 스코어링 필드
  progressStage: 'PERMITTED' | 'FOUNDATION' | 'STRUCTURE' | 'FINISHING' | 'COMPLETED';
  progressRate: number; // 추정 공정률 (%)
  elapsedDays: number; // 착공 후 경과일
  totalDays: number; // 총 예정공기(일)
  awpRecommendationScore: 'HIGH' | 'MID' | 'LOW'; // 고소작업대 추천도
  awpGoldenTime: boolean; // 고소작업대 골든타임 여부 (마감/설비 투입 최적기)
  recommendedEquipment: string[]; // 추천 장비
  estimatedAwpUnits: number; // 예상 소요 대수
  leadStatus?: 'UNTOUCHED' | 'CONTACTED' | 'REGISTERED';
}
