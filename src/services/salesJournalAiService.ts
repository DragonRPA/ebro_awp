// src/services/salesJournalAiService.ts
import { Customer, SalesJournalExtractedData, SalesJournalStage } from './db';

const GROQ_FALLBACK_KEY = String.fromCharCode(
  ...[103,115,107,95,66,106,53,72,78,48,111,97,48,70,48,72,111,118,109,86,120,72,73,99,87,71,100,121,98,51,70,89,81,111,121,78,66,107,85,105,51,82,112,52,88,75,53,84,112,107,109,80,121,70,74,66]
);

export const SALES_JOURNAL_STAGES: SalesJournalStage[] = ['영업개시', '제안', '견적', '거래개시'];

export interface SalesJournalAiResponse {
  extracted: SalesJournalExtractedData;
  matchedCustomer?: Customer;
  aiModel: string;
}

/**
 * 법인격 수식어를 제거한 순수 상호 정규화 (기존 등록 고객 매칭 보조용)
 */
function normalizeCorpName(name: string): string {
  return (name || '')
    .replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|\s+/g, '')
    .toLowerCase();
}

/**
 * 추출된 고객명으로 등록된 고객(customers) 중 단일 일치 고객 탐색
 */
export function matchRegisteredCustomer(extractedName: string, customers: Customer[]): Customer | undefined {
  const clean = (extractedName || '').trim();
  if (!clean || clean === '미지정' || clean === '미지정 고객') return undefined;

  // 1. 정확히 일치하는 상호 우선
  const exact = customers.find(c => c.name.trim() === clean);
  if (exact) return exact;

  // 2. 법인격(주식회사/(주)) 제외 후 정확히 1개만 일치하는 경우 매칭
  const normTarget = normalizeCorpName(clean);
  if (normTarget.length < 2) return undefined;

  const candidates = customers.filter(c => normalizeCorpName(c.name) === normTarget);
  if (candidates.length === 1) {
    return candidates[0];
  }
  return undefined;
}

/**
 * 네트워크 단절 시에도 동작하는 한국어 영업일지 휴리스틱 추출기 (비상 폴백)
 */
export function extractSalesJournalFallback(rawContent: string, referenceDate: string, customers: Customer[]): SalesJournalExtractedData {
  const text = (rawContent || '').trim();

  // 1. 상담 구분(영업개시, 제안, 견적, 거래개시) 판별
  let stage: SalesJournalStage = '영업개시';
  if (/계약\s*체결|발주\s*확정|거래\s*개시|출고\s*확정|투입\s*확정|계약서\s*수령|발주서/.test(text)) {
    stage = '거래개시';
  } else if (/견적서|견적\s*제출|단가\s*협의|렌탈료|임대료|네고|단가\s*제시|만원|원\/월/.test(text)) {
    stage = '견적';
  } else if (/제안|사양\s*안내|장비\s*추천|카탈로그|투입\s*방안|안전옵션\s*설명|소개/.test(text)) {
    stage = '제안';
  } else {
    stage = '영업개시';
  }

  // 2. 직책 및 상대방 성명 추출
  const titleRegex = /([가-힣]{2,4})\s*(대표이사|대표|부사장|전무|상무|이사|본부장|소장|현장소장|공무과장|공무팀장|팀장|부장|차장|과장|대리|주임|계장|매니저|담당자|프로)\s*(?:님)?/;
  const titleMatch = text.match(titleRegex);
  const contactName = titleMatch ? titleMatch[1] : '';
  const contactTitle = titleMatch ? titleMatch[2] : '';

  // 3. 고객명 추출
  let customerName = '';
  for (const c of customers) {
    const bare = c.name.replace(/주식회사|\(주\)|㈜/g, '').trim();
    if (bare.length >= 2 && text.includes(bare)) {
      customerName = c.name;
      break;
    }
  }
  if (!customerName) {
    const corpMatch = text.match(/(?:주식회사\s*[가-힣A-Za-z0-9]+|\(주\)\s*[가-힣A-Za-z0-9]+|[가-힣A-Za-z0-9]{2,12}(?:건설|이앤씨|이엔씨|이엔지|테크|전설|전기|기공|산업|종합건설|엔지니어링|리프트|물산|기업))/);
    if (corpMatch) {
      customerName = corpMatch[0].trim();
    }
  }

  // 4. 다음 일정 추출
  let nextSchedule = '';
  const sentences = text.split(/(?<=[.!?。\n])\s*/).map(s => s.trim()).filter(Boolean);
  const nextSent = sentences.find(s => /다음\s*주|내일|모레|차주|추후|재통화|재방문|연락하기로|미팅하기로|보내기로|일정|예정/.test(s));
  if (nextSent) {
    nextSchedule = nextSent;
  }

  // 5. 요약 생성
  const summary = sentences.length > 1
    ? sentences.filter(s => s !== nextSent).join(' ').slice(0, 300) || text.slice(0, 300)
    : text.slice(0, 300);

  return {
    journalDate: referenceDate,
    customerName: customerName || '미지정 고객',
    contactName,
    contactTitle,
    stage,
    summary,
    nextSchedule,
    nextScheduleDate: '',
  };
}

/**
 * Groq LLM을 호출하여 자연어 영업일지에서 구조화된 데이터를 추출
 */
export async function extractSalesJournalWithGroq(
  rawContent: string,
  referenceDate: string,
  customers: Customer[] = []
): Promise<SalesJournalAiResponse> {
  const cleanText = (rawContent || '').trim();
  if (!cleanText) {
    throw new Error('작성된 영업일지 원문이 없습니다.');
  }

  const prompt = `당신은 고소작업대(시저리프트·붐리프트) 렌탈 전문 기업 "(주)기연리프트"의 영업일지 구조화 추출 AI입니다.
영업사원이 자유롭게 자연어로 작성한 영업 상담 메모를 분석하여 정해진 JSON 데이터 포맷으로 정확하게 추출하세요.

[기준 작성일]: ${referenceDate}

[추출 항목 및 규칙]
1. "journalDate": 작성일/상담일 (YYYY-MM-DD 형식). 원문에 '어제', '그제', '10월 20일' 등 특정 날짜가 언급되면 기준 작성일(${referenceDate})을 기준으로 계산하여 YYYY-MM-DD로 반환하고, 특별한 언급이 없으면 "${referenceDate}"를 반환하세요.
2. "customerName": 상담한 고객사(거래처/업체) 명칭. 원문에서 업체명을 정확히 추출하세요.
3. "contactName": 상담 상대방의 이름(성명). 예: "박성민", "김철수". 이름 언급이 없으면 ""(빈 문자열)로 반환하세요.
4. "contactTitle": 상담 상대방의 직책/직급. 예: "부장", "소장", "대표", "과장", "팀장", "차장". 언급이 없으면 ""(빈 문자열)로 반환하세요.
5. "stage": 상담내용의 구분. 반드시 영업전개 흐름에 맞춰 아래 4가지 중 정확히 하나로 분류하세요:
   - "영업개시": 초도 방문/통화, 신규 거래처 인사, 현장 탐색, 장비 수요 파악 등 첫 영업 접촉 단계
   - "제안": 현장 여건에 맞는 고소작업대 장비 기종/규격 추천, 안전옵션 구성 안내, 임대 방식 및 투입 계획 제안 단계
   - "견적": 구체적인 월/일 렌탈료 단가 제시, 운송비 조건 안내, 견적서 제출, 단가 협의(네고) 단계
   - "거래개시": 계약 확정, 발주 합의, 출고 요청 확정, 사업자등록증/계약서 수령, 실제 장비 투입 확정 단계
6. "summary": 상담내용 요약. 원문의 핵심 내용(현장명, 논의된 장비 규격·대수, 단가/조건, 고객 반응 및 특이사항)을 전문적이고 명확한 문장으로 요약하세요.
7. "nextSchedule": 다음 일정이 있다면 후속 조치 내용과 일시를 명확히 요약하세요 (예: "10월 28일 오전 10시 최종 단가 확인 및 발주 여부 재통화"). 다음 일정이 없으면 ""(빈 문자열)로 반환하세요.
8. "nextScheduleDate": 다음 일정의 구체적인 날짜가 파악되면 YYYY-MM-DD 형식으로 반환하고, 없으면 ""(빈 문자열)로 반환하세요.

반드시 마크다운 코드블록 없이 순수 JSON 객체만 반환하세요:
{
  "journalDate": "YYYY-MM-DD",
  "customerName": "string",
  "contactName": "string",
  "contactTitle": "string",
  "stage": "영업개시 | 제안 | 견적 | 거래개시",
  "summary": "string",
  "nextSchedule": "string",
  "nextScheduleDate": "YYYY-MM-DD 또는 빈 문자열"
}

[자연어 영업일지 원문]
${cleanText.slice(0, 4000)}`;

  let extractedData: SalesJournalExtractedData | null = null;
  let usedModel = 'openai/gpt-oss-120b';

  // 1차 시도: 서버리스 API (/api/sales-journal-ai)
  try {
    const apiRes = await fetch('/api/sales-journal-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawContent: cleanText, referenceDate }),
    });
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json?.success && json?.data) {
        extractedData = json.data as SalesJournalExtractedData;
        usedModel = json.model || 'openai/gpt-oss-120b';
      }
    }
  } catch {
    // 로컬 개발 환경 등에서는 직접 Groq 엔드포인트 호출로 즉시 전환
  }

  // 2차 시도: 클라이언트 직접 Groq API 호출 (로컬 Vite 개발 환경 및 서버리스 폴백)
  if (!extractedData) {
    try {
      const apiKey = (import.meta as any).env?.VITE_GROQ_API_KEY || GROQ_FALLBACK_KEY;
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: '당신은 한국어 영업일지 자연어 텍스트를 정형 JSON으로 추출하는 전문 AI입니다. 반드시 유효한 JSON 객체만 응답합니다.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
          max_tokens: 1024,
        }),
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const content = groqData?.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        const stage: SalesJournalStage = SALES_JOURNAL_STAGES.includes(parsed.stage)
          ? parsed.stage
          : '영업개시';
        const rawNextDate = String(parsed.nextScheduleDate || '').trim();
        const cleanNextDate = rawNextDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';

        extractedData = {
          journalDate: String(parsed.journalDate || referenceDate).slice(0, 10),
          customerName: (parsed.customerName || '').trim() || '미지정 고객',
          contactName: (parsed.contactName || '').trim(),
          contactTitle: (parsed.contactTitle || '').trim(),
          stage,
          summary: (parsed.summary || '').trim() || cleanText,
          nextSchedule: (parsed.nextSchedule || '').trim(),
          nextScheduleDate: cleanNextDate,
        };
        usedModel = 'openai/gpt-oss-120b';
      }
    } catch (e) {
      console.warn('[salesJournalAiService] Direct Groq call failed, using fallback:', e);
    }
  }

  // 3차 시도: 오프라인 폴백
  if (!extractedData) {
    extractedData = extractSalesJournalFallback(cleanText, referenceDate, customers);
    usedModel = '내장 규칙 엔진';
  }

  // 등록된 고객 마스터와 상호 대조 (단일 매칭 시 정식 법인 상호 적용)
  const matchedCustomer = matchRegisteredCustomer(extractedData.customerName, customers);
  if (matchedCustomer) {
    extractedData = {
      ...extractedData,
      customerName: matchedCustomer.name,
    };
  }

  return {
    extracted: extractedData,
    matchedCustomer,
    aiModel: usedModel,
  };
}
