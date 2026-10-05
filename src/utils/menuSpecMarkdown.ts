// src/utils/menuSpecMarkdown.ts
// 전사 51개 메뉴 및 모달의 기능 목적, 버튼 목록, 모달 스펙을 정의하는 Markdown(MD) 엔진
// 인앱 뷰어/편집기 및 미래 MCP (Model Context Protocol) 에이전트 자율 연동 Grounding 지원
import { supabase } from '../services/db';
import { ALL_MENU_MANUALS, getMenuManual } from '../data/allMenuManuals';
import { MODAL_MANUAL_REGISTRY } from '../data/modalManuals';

const TENANT_ID = 'default';

export interface ProcessSummary {
  processId: string;
  title: string;
  description: string;
  stepCount: number;
  steps: { seq: number; label: string; description: string; type: string; badgeColor?: string }[];
}

export interface MenuBriefingSummary {
  menuId: string;
  title: string;
  dept: string;
  archetype?: string;
  objective: string;
  buttons: { seq: number; label: string; color: string }[];
  subTabs: string[];
  modals: string[];
  processes: ProcessSummary[];
}

/**
 * 인앱 오버레이 상단 브리핑 텍스트박스용 요약 데이터 추출
 */
export function getMenuBriefingSummary(menuId: string): MenuBriefingSummary | null {
  // 1. 모달 팝업인 경우
  if (menuId.startsWith('modal_')) {
    const modalDef = MODAL_MANUAL_REGISTRY[menuId];
    if (!modalDef) return null;
    return {
      menuId,
      title: modalDef.modalName,
      dept: modalDef.category,
      archetype: '팝업 / 다이얼로그 (전용 팝업 창구)',
      objective: `${modalDef.modalName} 팝업은 특정 비즈니스 이벤트 발생 시 세부 제원 입력 및 즉시 승인/검증을 완결하는 전용 창구입니다.`,
      buttons: modalDef.annotations.map(a => ({ seq: a.seq, label: a.label, color: a.badgeColor })),
      subTabs: [],
      modals: [],
      processes: [],
    };
  }

  // 2. 일반 메뉴인 경우
  const manual = getMenuManual(menuId);
  if (!manual) {
    return {
      menuId,
      title: menuId,
      dept: '공통',
      objective: '본 메뉴는 시스템 표준 업무 프로세스를 처리하는 작업대입니다.',
      buttons: [],
      subTabs: [],
      modals: [],
      processes: [],
    };
  }

  return {
    menuId: manual.menuId,
    title: manual.menuName,
    dept: `${manual.groupName} · ${manual.department}`,
    archetype: manual.archetype,
    objective: manual.objective,
    buttons: manual.annotations.map(a => ({ seq: a.seq, label: a.label, color: a.badgeColor })),
    subTabs: (manual.subTabs || []).map(t => t.tabName),
    modals: (manual.modalWorkflows || []).map(m => m.modalName),
    processes: ((manual as any).processes || []).map((p: any) => ({
      processId: p.processId,
      title: p.title,
      description: p.description,
      stepCount: (p.steps || []).length,
      steps: (p.steps || []).map((s: any) => ({
        seq: s.seq,
        label: s.label,
        description: s.description,
        type: s.type,
        badgeColor: s.badgeColor,
      }))
    })),
  };
}

/**
 * 특정 메뉴 ID에 대한 표준 기능 정의서 Markdown 자동 생성
 */
export function generateDefaultMenuSpecMarkdown(menuId: string): string {
  // 1. 모달 팝업인 경우
  if (menuId.startsWith('modal_')) {
    const modalDef = MODAL_MANUAL_REGISTRY[menuId];
    if (!modalDef) {
      return `# [기능 정의서] 모달 팝업 (${menuId})\n\n정의된 모달 스펙이 없습니다.`;
    }

    const buttonList = modalDef.annotations
      .map(a => `- **[${a.seq}] ${a.label}** (${a.type}): ${a.description}`)
      .join('\n');

    return `# [기능 정의서] ${modalDef.modalName} (${modalDef.modalId})

## 1. 개요 및 비즈니스 목적
- **모달 식별자**: \`${modalDef.modalId}\`
- **업무 카테고리**: ${modalDef.category}
- **자동 감지 키워드**: ${modalDef.keywords.map(k => `\`${k}\``).join(', ')}

### 🎯 업무 목적
${modalDef.modalName}은 시스템 업무 흐름 중 특정 이벤트가 발생했을 때 독립된 팝업 창구로 진입하여, 필수 체크포인트를 검증하고 단일 완결 액션(승인, 등록, 저장 등)을 완결하는 전용 스튜디오입니다.

## 2. 화면 주요 컨트롤 및 입력/검증 필드
${buttonList}

## 3. 인공지능 에이전트 자율 연동 가이드
- **작동 원칙**: 모달이 DOM 상에 활성화(\`detectActiveModalElement\`)된 상태에서만 조작이 가능합니다.
- **방어 차단**: 필수 입력값이 미충족되었거나 검증이 실패한 경우 최종 완결 버튼이 비활성화되거나 경고 모달이 표출됩니다.
- **사후 상태 전이**: 완결 버튼 클릭 시 모달이 닫히며 상위 원장 및 이력 DB에 즉시 동기화 적재됩니다.
`;
  }

  // 2. 일반 메뉴인 경우
  const manual = getMenuManual(menuId);
  if (!manual) {
    return `# [기능 정의서] ${menuId}\n\n등록된 메뉴 매뉴얼 명세가 없습니다.`;
  }

  // 주요 버튼 및 기능 목록
  const buttonsSection = manual.annotations.length > 0
    ? manual.annotations
        .map(a => `- **[${a.seq}] \`${a.label}\`** (${a.type})\n  - **기능 설명**: ${a.description}\n  - **대상 셀렉터**: \`${a.selector}\`\n  - **안내 힌트**: ${a.positionHint || '자동'}`)
        .join('\n')
    : '- 등록된 주요 버튼 항목이 없습니다.';

  // 서브탭 목록
  const subTabsSection = manual.subTabs && manual.subTabs.length > 0
    ? manual.subTabs
        .map(t => `### 📌 하위 탭: ${t.tabName} (\`${t.tabId}\`)\n- **탭 목적**: ${t.purpose}\n- **핵심 액션**: ${t.keyActions.map(a => `\`${a}\``).join(', ')}`)
        .join('\n\n')
    : '- 하위 탭이 없는 단일 화면입니다.';

  // 모달 워크플로우
  const modalsSection = manual.modalWorkflows && manual.modalWorkflows.length > 0
    ? manual.modalWorkflows
        .map(m => `### 🖼️ 연동 모달: ${m.modalName}\n- **트리거 버튼**: \`${m.triggerButton}\`\n- **핵심 입력/검토 필드**: ${m.keyFields.map(f => `\`${f}\``).join(', ')}\n- **최종 종단 액션**: \`${m.terminalAction}\`\n- **사후 상태 전이**: ${m.afterStateTransition}`)
        .join('\n\n')
    : '- 연동된 전용 모달 워크플로우가 없습니다.';

  // 단위업무 절차
  const processesSection = (manual as any).processes && (manual as any).processes.length > 0
    ? (manual as any).processes
        .map((p: any) => {
          const stepList = (p.steps || [])
            .map((s: any) => `  ${s.seq}. **${s.label}**: ${s.description}`)
            .join('\n');
          return `### 🔄 단위업무: ${p.title} (\`${p.processId}\`)\n- **업무 목적**: ${p.description}\n- **수행 절차 (${p.steps?.length || 0}단계)**:\n${stepList}`;
        })
        .join('\n\n')
    : '- 등록된 별도 단위업무 절차형 프로세스가 없습니다.';

  // 인지 및 조작 시퀀스
  const seqSection = manual.cognitiveSequence.map(s => `- ${s}`).join('\n');

  // 표준 헌장 준수
  const rulesSection = manual.rulesCompliance.map(r => `- ${r}`).join('\n');

  // 주의사항
  const precautionsSection = manual.precautions.map(p => `- ${p}`).join('\n');

  return `# [기능 정의서] ${manual.menuName} (${manual.menuId})

## 1. 기본 메타데이터
- **메뉴 식별자(ID)**: \`${manual.menuId}\`
- **상위 그룹**: ${manual.groupName} (\`${manual.groupId}\`)
- **담당 부서**: ${manual.department}
- **UI 아키타입**: ${manual.archetype}

## 2. 업무 기능 목적
> **"${manual.objective}"**

### 📋 시작 전제 조건 및 범위 정보
${manual.scopeInfo}

## 3. 단위업무 절차
${processesSection}

## 4. 화면 주요 버튼 및 기능 목록
${buttonsSection}

## 5. 하위 탭 구성 및 상세 역할
${subTabsSection}

## 6. 연동 팝업 및 창구 기능
${modalsSection}

## 7. 인지 및 조작 순서 (1-Way 동선)
${seqSection}

## 8. 최종 완결 확정 결과
- ${manual.auditResult}

## 9. 전사 시스템 개발 표준 헌장 준수
${rulesSection}

## 10. 현장 물리적 마찰 방지 및 주의사항
${precautionsSection}

## 11. 인공지능 에이전트 자율 연동 가이드
- **에이전트 역할 권장**: 본 메뉴의 작업을 대리 수행하는 AI 에이전트는 본 명세서의 **[2. 업무 기능 목적]**과 **[9. 헌장 준수]**를 절대적 제약조건으로 준수해야 합니다.
- **R&R 엄격 준수**: 타 부서 권한(예: 영업사원의 자산번호 강제 지정, 배차담당자의 계약 단가 조작 등) 침해 액션을 절대 발행하지 않습니다.
- **보존 법칙 확인**: 날짜 보존, 수지 보존, 상태 보존의 3대 법칙을 확인한 후 종단 완결 버튼을 호출해야 합니다.
`;
}

/**
 * 특정 메뉴의 마크다운 기능 정의서 로드 (DB 커스텀 편집본 우선, 없으면 기본 생성)
 */
export async function loadMenuSpecMarkdown(menuId: string): Promise<string> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('manual_annotations')
        .select('annotations')
        .eq('tenant_id', TENANT_ID)
        .eq('page_id', menuId)
        .single();

      if (!error && data?.annotations) {
        const ann = data.annotations as any;
        if (ann.specDocMarkdown && typeof ann.specDocMarkdown === 'string' && ann.specDocMarkdown.trim()) {
          return ann.specDocMarkdown;
        }
      }
    } catch (err) {
      console.warn('[menuSpecMarkdown] Failed to load spec markdown from DB:', err);
    }
  }

  // DB에 커스텀 편집본이 없으면 SSOT 기반 마크다운 자동 생성 반환
  return generateDefaultMenuSpecMarkdown(menuId);
}

/**
 * 특정 메뉴의 마크다운 기능 정의서 저장 (DB manual_annotations 내 영구 보존)
 */
export async function saveMenuSpecMarkdown(menuId: string, markdown: string, updatedBy?: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    // 1. 기존 레코드 조회
    const { data } = await supabase
      .from('manual_annotations')
      .select('annotations, page_title, version')
      .eq('tenant_id', TENANT_ID)
      .eq('page_id', menuId)
      .single();

    const manual = getMenuManual(menuId);
    const pageTitle = data?.page_title || manual?.menuName || menuId;
    const version = (data?.version || 1) + 1;
    const currentAnnotations = data?.annotations || { pageId: menuId, pageTitle, items: manual?.annotations || [] };

    // 2. specDocMarkdown 필드 병합하여 upsert
    const updatedAnnotations = {
      ...currentAnnotations,
      specDocMarkdown: markdown,
    };

    const { error } = await supabase
      .from('manual_annotations')
      .upsert({
        tenant_id: TENANT_ID,
        page_id: menuId,
        page_title: pageTitle,
        version,
        annotations: updatedAnnotations,
        updated_by: updatedBy || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,page_id' });

    if (error) {
      console.error('[menuSpecMarkdown] Save error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[menuSpecMarkdown] Unexpected save error:', err);
    return false;
  }
}

// 🤖 MCP (Model Context Protocol) 및 브라우저 콘솔 자율 연동 헬퍼 글로벌 등록
if (typeof window !== 'undefined') {
  (window as any).__GET_MENU_SPEC_MARKDOWN__ = loadMenuSpecMarkdown;
  (window as any).__SAVE_MENU_SPEC_MARKDOWN__ = saveMenuSpecMarkdown;
  (window as any).__GET_MENU_BRIEFING_SUMMARY__ = getMenuBriefingSummary;
  (window as any).__GENERATE_DEFAULT_MENU_SPEC__ = generateDefaultMenuSpecMarkdown;
}
