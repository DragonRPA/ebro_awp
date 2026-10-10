// src/components/manual/MenuBriefingBox.tsx
// 전사 51개 메뉴 및 모달 매뉴얼 활성화 시 화면에 표시되는 상단 기능 목적 브리핑 텍스트박스
// 전사 시스템 개발 표준 헌장 준수: 무수식어 건조 UI, 기능 목적(Terminal Objective) 명시, 주요 조작 버튼/모달 목록 노출
import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, X, Sparkles, Layers, ExternalLink, Workflow, BookOpen } from 'lucide-react';
import { getMenuBriefingSummary, type MenuBriefingSummary } from '../../utils/menuSpecMarkdown';
import { getStepBadgeColor } from './manualPalette';

export interface MenuBriefingBoxProps {
  pageId: string;
  pageTitle: string;
  isModal?: boolean;
  activeProcessId?: string | null;
  onSelectProcess?: (processId: string | null) => void;
  onSelectSeq: (seq: number) => void;
  onOpenSpecDoc: () => void;
  onClose?: () => void;
  zIndex?: number;
}

export const MenuBriefingBox: React.FC<MenuBriefingBoxProps> = ({
  pageId,
  pageTitle,
  isModal,
  activeProcessId = null,
  onSelectProcess,
  onSelectSeq,
  onOpenSpecDoc,
  onClose,
  zIndex = 200010,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const summary: MenuBriefingSummary | null = getMenuBriefingSummary(pageId) || {
    menuId: pageId,
    title: pageTitle || pageId,
    dept: isModal ? '팝업' : '시스템',
    objective: '본 메뉴의 표준 업무 프로세스 및 핵심 제원을 조회·관리하는 작업대입니다.',
    buttons: [],
    subTabs: [],
    modals: [],
    processes: [],
  };

  const processes = summary.processes || [];
  const activeProcess = activeProcessId ? processes.find(p => p.processId === activeProcessId) : null;

  const isDesktop = typeof window !== 'undefined' && window.innerWidth > 1024;
  const leftPos = isDesktop ? 280 : 16;

  // 1. 최소화(접힘) 상태 뷰
  if (isMinimized) {
    return (
      <div
        data-manual-ui="true"
        style={{
          position: 'fixed',
          top: '76px',
          left: `${leftPos}px`,
          zIndex,
          pointerEvents: 'all',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--primary)',
          borderRadius: '24px',
          padding: '6px 14px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          🎯 {summary.title}
          {activeProcess && (
            <span style={{ color: '#2563EB', fontWeight: 700, fontSize: '11.5px' }}>
              · {activeProcess.title}
            </span>
          )}
        </span>
        {activeProcess ? (
          <span style={{
            fontSize: '11px',
            backgroundColor: 'rgba(37,99,235,0.12)',
            color: '#2563EB',
            padding: '2px 7px',
            borderRadius: '10px',
            fontWeight: 700,
          }}>
            단위업무 {activeProcess.stepCount}단계
          </span>
        ) : summary.buttons.length > 0 ? (
          <span style={{
            fontSize: '11px',
            backgroundColor: 'rgba(59,130,246,0.12)',
            color: 'var(--primary)',
            padding: '2px 7px',
            borderRadius: '10px',
            fontWeight: 700,
          }}>
            기본 {summary.buttons.length}단계
          </span>
        ) : null}
        <button
          onClick={onOpenSpecDoc}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '2px 8px',
            backgroundColor: 'var(--bg-app)',
            color: 'var(--primary)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
          title="기능 정의서 열람 및 편집"
        >
          <FileText size={12} />
          <span>정의서</span>
        </button>
        <button
          onClick={() => setIsMinimized(false)}
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="브리핑 카드 펼치기"
        >
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

  // 2. 전체 펼침 상태 뷰
  return (
    <div
      data-manual-ui="true"
      style={{
        position: 'fixed',
        top: '76px',
        left: `${leftPos}px`,
        width: '450px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 150px)',
        backgroundColor: 'var(--bg-card)',
        border: '1.5px solid var(--primary)',
        borderRadius: '12px',
        boxShadow: '0 10px 32px rgba(0,0,0,0.28)',
        zIndex,
        pointerEvents: 'all',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 카드 헤더 */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <span style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            backgroundColor: 'rgba(59,130,246,0.12)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            flexShrink: 0,
          }}>
            🎯
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '13.5px',
                fontWeight: 800,
                color: 'var(--text-main)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {summary.title}
              </span>
              <span style={{
                fontSize: '10.5px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                {summary.dept}
              </span>
            </div>
          </div>
        </div>

        {/* 상단 우측 버튼군 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={onOpenSpecDoc}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              border: '1px solid var(--primary)',
              borderRadius: '6px',
              padding: '3px 8px',
              backgroundColor: 'rgba(59,130,246,0.08)',
              color: 'var(--primary)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="기능 정의서 열람 및 편집"
          >
            <FileText size={12} />
            <span>기능 정의서</span>
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="접기 (최소화)"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => {
              if (onClose) onClose();
              else setIsDismissed(true);
            }}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="브리핑 닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 단위업무 워크플로우 탭 선택기 (프로세스가 존재하는 경우) */}
      {processes.length > 0 && (
        <div style={{
          padding: '8px 14px',
          backgroundColor: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Workflow size={12} color="#2563EB" />
              <span>업무 모드 선택 ({processes.length}개 단위업무)</span>
            </span>
            <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
              클릭 시 화면 단계 가이드 즉시 전환
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            <button
              type="button"
              onClick={() => onSelectProcess?.(null)}
              style={{
                padding: '3px 8px',
                borderRadius: '12px',
                border: !activeProcessId ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: !activeProcessId ? 'rgba(59,130,246,0.12)' : 'var(--bg-card)',
                color: !activeProcessId ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: !activeProcessId ? 800 : 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>📋 화면 기본 안내</span>
            </button>
            {processes.map(proc => {
              const isSelected = activeProcessId === proc.processId;
              return (
                <button
                  key={proc.processId}
                  type="button"
                  onClick={() => onSelectProcess?.(proc.processId)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'rgba(59,130,246,0.18)' : 'var(--bg-card)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  title={`${proc.title} (${proc.stepCount}단계): ${proc.description}`}
                >
                  <span>🔄 {proc.title}</span>
                  <span style={{
                    fontSize: '9.5px',
                    padding: '1px 5px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-app)',
                    color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                    fontWeight: 700,
                  }}>
                    {proc.stepCount}단계
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 카드 스크롤 본문 */}
      <div style={{
        padding: '12px 14px',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        fontSize: '12.5px',
        lineHeight: 1.5,
      }}>
        {/* A. 단위업무 활성 모드 뷰 */}
        {activeProcess ? (
          <>
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--primary)',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <Workflow size={12} color="var(--primary)" />
                <span>단위업무 절차: {activeProcess.title}</span>
              </div>
              <div style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderLeft: '4px solid #2563EB',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'var(--text-main)',
                fontWeight: 600,
                lineHeight: 1.5,
              }}>
                {activeProcess.description}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--text-muted)',
                marginBottom: '6px',
              }}>
                수행 단계 ({activeProcess.steps.length}단계) · 클릭 시 화면 내 위치 강조
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {activeProcess.steps.map(s => {
                  const sColor = getStepBadgeColor(s.seq, s.badgeColor);
                  return (
                    <button
                      key={s.seq}
                      onClick={() => onSelectSeq(s.seq)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        border: `1.5px solid ${sColor}`,
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                      }}
                      title={`[${s.seq}단계] ${s.label}: ${s.description}`}
                    >
                      <span style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: sColor,
                        color: '#FFFFFF',
                        border: '1.5px solid #FFFFFF',
                        boxShadow: `0 0 0 1px ${sColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10.5px',
                        fontWeight: 900,
                        flexShrink: 0,
                      }}>
                        {s.seq}
                      </span>
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* B. 화면 기본 안내 모드 뷰 */
          <>
            {/* 1. 업무 기능 목적 (Terminal Objective) */}
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--text-muted)',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>업무 기능 목적</span>
                {summary.archetype && (
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--primary)' }}>
                    · {summary.archetype}
                  </span>
                )}
              </div>
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderLeft: '3.5px solid var(--primary)',
                padding: '8px 10px',
                borderRadius: '4px',
                fontSize: '12px',
                color: 'var(--text-main)',
                fontWeight: 600,
                lineHeight: 1.45,
              }}>
                {summary.objective}
              </div>
            </div>

            {/* 2. 주요 조작 단계 목록 */}
            {summary.buttons.length > 0 && (
              <div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}>
                  화면 구성 요소 ({summary.buttons.length}개) · 클릭 시 화면 내 위치 강조
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {summary.buttons.map(b => {
                    const bColor = getStepBadgeColor(b.seq, b.color);
                    return (
                      <button
                        key={b.seq}
                        onClick={() => onSelectSeq(b.seq)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          border: `1.5px solid ${bColor}`,
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                        }}
                        title={`[${b.seq}단계] ${b.label} 화면 위치로 이동 및 상세 보기`}
                      >
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: bColor,
                          color: '#FFFFFF',
                          border: '1.5px solid #FFFFFF',
                          boxShadow: `0 0 0 1px ${bColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10.5px',
                          fontWeight: 900,
                          flexShrink: 0,
                        }}>
                          {b.seq}
                        </span>
                        <span>{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. 하위 탭 구성 (있는 경우) */}
            {summary.subTabs.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  하위 탭 구성 ({summary.subTabs.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {summary.subTabs.map(t => (
                    <span
                      key={t}
                      style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      📌 {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 4. 연동 모달 (있는 경우) */}
            {summary.modals.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  연동 모달 워크플로우 ({summary.modals.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {summary.modals.map(m => (
                    <span
                      key={m}
                      style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      🖼️ {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 카드 하단 액션 툴바 */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              if ((window as any).__APP_CONTEXT__?.setActiveTab) {
                (window as any).__APP_CONTEXT__.setActiveTab('operations_manual');
                if (onClose) onClose();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              border: 'none',
              background: 'none',
              color: '#059669',
              fontSize: '11.5px',
              fontWeight: 800,
              cursor: 'pointer',
              padding: 0,
            }}
            title="도구 및 다운로드 > 업무매뉴얼 화면으로 바로 이동하여 전사 51개 메뉴 및 184개 단위업무 전체 편람 열람"
          >
            <BookOpen size={13} />
            <span>📖 전사 업무매뉴얼 열람 ➔</span>
          </button>

          <button
            type="button"
            onClick={onOpenSpecDoc}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              border: 'none',
              background: 'none',
              color: 'var(--primary)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
            }}
            title="기능 정의서 열람 및 편집"
          >
            <FileText size={13} />
            <span>기능 정의서</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '3px 8px',
            backgroundColor: 'var(--bg-app)',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          화면 조작 복귀 (접기)
        </button>
      </div>
    </div>
  );
};
