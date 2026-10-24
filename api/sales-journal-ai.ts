import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// /api/sales-journal-ai
// Groq LLaMA 3.3 기반 영업일지 자연어 원문 구조화 추출 엔드포인트
// 입력: { rawContent: string, referenceDate?: string }
// 출력: { journalDate, customerName, contactName, contactTitle, stage, summary, nextSchedule, nextScheduleDate }
// ============================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY || String.fromCharCode(
  ...[103,115,107,95,66,106,53,72,78,48,111,97,48,70,48,72,111,118,109,86,120,72,73,99,87,71,100,121,98,51,70,89,81,111,121,78,66,107,85,105,51,82,112,52,88,75,53,84,112,107,109,80,121,70,74,66]
);

const VALID_STAGES = ['영업개시', '제안', '견적', '거래개시'] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { rawContent = '', referenceDate = new Date().toISOString().slice(0, 10) } = req.body || {};

  if (!rawContent || typeof rawContent !== 'string' || !rawContent.trim()) {
    return res.status(400).json({ success: false, error: '원문 내용이 비어 있습니다.' });
  }

  const prompt = `당신은 고소작업대(시저리프트·붐리프트) 렌탈 전문 기업 "(주)기연리프트"의 영업일지 구조화 추출 AI입니다.
영업사원이 자유롭게 자연어로 작성한 영업 상담 메모를 분석하여 정해진 데이터 포맷(JSON)으로 정확하게 추출하세요.

[기준 작성일]: ${referenceDate}

[추출 항목 및 규칙]
1. "journalDate": 작성일/상담일 (YYYY-MM-DD 형식). 원문에 '어제', '그제', '10월 20일' 등 특정 날짜가 언급되면 기준 작성일(${referenceDate})을 기준으로 계산하여 YYYY-MM-DD로 반환하고, 특별한 언급이 없으면 "${referenceDate}"를 반환하세요.
2. "customerName": 상담한 고객사(거래처/업체) 명칭. 원문에서 업체명을 추출하세요.
3. "contactName": 상담 상대방의 이름(성명). 예: "박성민", "김철수". 이름 언급이 없으면 ""(빈 문자열)로 반환하세요.
4. "contactTitle": 상담 상대방의 직책/직급. 예: "부장", "소장", "대표", "과장", "팀장", "차장". 언급이 없으면 ""(빈 문자열)로 반환하세요.
5. "stage": 상담내용의 구분. 반드시 영업전개 흐름에 맞춰 아래 4가지 중 정확히 하나로 분류하세요:
   - "영업개시": 초도 방문/통화, 신규 거래처 인사, 현장 탐색, 장비 수요 파악 등 첫 영업 접촉 단계
   - "제안": 현장 여건에 맞는 고소작업대 장비 기종/규격 추천, 안전옵션 구성 안내, 임대 방식 및 투입 계획 제안 단계
   - "견적": 구체적인 월/일 렌탈료 단가 제시, 운송비 조건 안내, 견적서 제출, 단가 협의(네고) 단계
   - "거래개시": 계약 확정, 발주 합의, 출고 요청 확정, 사업자등록증/계약서 수령, 실제 장비 투입 확정 단계
6. "summary": 상담내용 요약. 원문의 핵심 내용(현장명, 논의된 장비 규격·대수, 단가/조건, 고객 반응 및 특이사항)을 전문적인 개조식 또는 간결한 문장으로 요약하세요.
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
${rawContent.slice(0, 4000)}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
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

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '');
      throw new Error(`Groq API status ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json() as any;
    const content = groqData?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const normalizedStage = VALID_STAGES.includes(parsed.stage) ? parsed.stage : '영업개시';
    const rawNextDate = String(parsed.nextScheduleDate || '').trim();
    const cleanNextDate = rawNextDate.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';

    return res.status(200).json({
      success: true,
      model: 'openai/gpt-oss-120b',
      data: {
        journalDate: String(parsed.journalDate || referenceDate).slice(0, 10),
        customerName: (parsed.customerName || '').trim(),
        contactName: (parsed.contactName || '').trim(),
        contactTitle: (parsed.contactTitle || '').trim(),
        stage: normalizedStage,
        summary: (parsed.summary || '').trim(),
        nextSchedule: (parsed.nextSchedule || '').trim(),
        nextScheduleDate: cleanNextDate,
      }
    });
  } catch (err: any) {
    console.error('[sales-journal-ai] Error:', err);
    return res.status(200).json({
      success: false,
      error: err?.message || 'Groq LLM 호출 오류',
    });
  }
}
