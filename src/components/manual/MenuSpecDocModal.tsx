// src/components/manual/MenuSpecDocModal.tsx
// 전사 메뉴 기능 정의서 (.md) 뷰어 & 편집기 모달
// 마크다운 열람, 실시간 편집/저장, MD 파일 다운로드, MCP 에이전트 연동 지원
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  FileText, Edit3, Eye, Copy, Check, Download, RotateCcw, Save, X, Sparkles, Terminal
} from 'lucide-react';
import {
  loadMenuSpecMarkdown,
  saveMenuSpecMarkdown,
  generateDefaultMenuSpecMarkdown
} from '../../utils/menuSpecMarkdown';

interface MenuSpecDocModalProps {
  isOpen: boolean;
  menuId: string;
  menuTitle?: string;
  onClose: () => void;
}

/**
 * 표준 경량 마크다운 렌더러 (별도 무거운 의존성 없이 H1~H4, 인용문, 불릿, 인라인 코드, 강조 완벽 지원)
 */
function renderMarkdownToHtml(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  lines.forEach((line, idx) => {
    // 코드 블록 토글
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${idx}`} style={{
            backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)',
            padding: '12px 14px', borderRadius: '8px', fontSize: '12px',
            fontFamily: 'Consolas, monospace', overflowX: 'auto', margin: '8px 0',
            color: 'var(--text-main)', lineHeight: 1.5
          }}>
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    const trimmed = line.trim();

    // H1
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={idx} style={{
          fontSize: '20px', fontWeight: 900, color: 'var(--primary)',
          borderBottom: '2px solid var(--border-color)', paddingBottom: '8px',
          marginTop: '20px', marginBottom: '14px', letterSpacing: '-0.3px'
        }}>
          {line.replace('# ', '')}
        </h1>
      );
      return;
    }

    // H2
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={idx} style={{
          fontSize: '15.5px', fontWeight: 800, color: 'var(--text-main)',
          borderBottom: '1px solid var(--border-color)', paddingBottom: '6px',
          marginTop: '18px', marginBottom: '10px'
        }}>
          {line.replace('## ', '')}
        </h2>
      );
      return;
    }

    // H3
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={idx} style={{
          fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)',
          marginTop: '12px', marginBottom: '6px'
        }}>
          {line.replace('### ', '')}
        </h3>
      );
      return;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} style={{
          borderLeft: '4px solid var(--primary)', padding: '8px 12px',
          margin: '10px 0', backgroundColor: 'rgba(59,130,246,0.06)',
          borderRadius: '0 8px 8px 0', fontSize: '13px', fontStyle: 'italic',
          color: 'var(--text-secondary)'
        }}>
          {line.replace(/^>\s*/, '')}
        </blockquote>
      );
      return;
    }

    // Unordered List (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s+/, '');
      elements.push(
        <li key={idx} style={{
          fontSize: '13px', lineHeight: 1.7, marginLeft: '20px',
          color: 'var(--text-secondary)', marginBottom: '3px'
        }}>
          {parseInlineFormatting(content)}
        </li>
      );
      return;
    }

    // 빈 줄
    if (!trimmed) {
      elements.push(<div key={idx} style={{ height: '6px' }} />);
      return;
    }

    // 일반 문단
    elements.push(
      <p key={idx} style={{
        fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)',
        margin: '4px 0', wordBreak: 'keep-all'
      }}>
        {parseInlineFormatting(line)}
      </p>
    );
  });

  return elements;
}

/**
 * 인라인 마크다운 (굵게 **text**, 인라인 코드 `code`) 파싱
 */
function parseInlineFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} style={{ fontWeight: 800, color: 'var(--text-main)' }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={match.index} style={{
          backgroundColor: 'rgba(59,130,246,0.12)', color: 'var(--primary)',
          padding: '1px 5px', borderRadius: '4px', fontSize: '12px',
          fontFamily: 'Consolas, monospace', fontWeight: 600
        }}>
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export const MenuSpecDocModal: React.FC<MenuSpecDocModalProps> = ({
  isOpen,
  menuId,
  menuTitle,
  onClose,
}) => {
  const [markdown, setMarkdown] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setIsEditing(false);
    loadMenuSpecMarkdown(menuId).then(content => {
      setMarkdown(content);
      setLoading(false);
    });
  }, [isOpen, menuId]);

  if (!isOpen) return null;

  // 복사 핸들러
  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 파일 다운로드 핸들러
  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${menuId}_기능정의서.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 기본값 초기화 핸들러
  const handleResetToDefault = () => {
    if (!window.confirm('작성 중인 내용을 지우고 표준 템플릿 기본값으로 되돌리시겠습니까?')) return;
    const def = generateDefaultMenuSpecMarkdown(menuId);
    setMarkdown(def);
  };

  // 저장 핸들러
  const handleSave = async () => {
    setSaving(true);
    const ok = await saveMenuSpecMarkdown(menuId, markdown);
    setSaving(false);
    if (ok) {
      setSaveSuccessMsg('기능 정의서가 DB에 성공적으로 저장되었습니다!');
      setIsEditing(false);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } else {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const content = (
    <div
      data-manual-ui="true"
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 250000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '940px', maxWidth: 'calc(100vw - 32px)',
          height: '88vh', maxHeight: '900px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* 모달 상단 툴바 */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'var(--bg-body)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '32px', height: '32px', borderRadius: '8px',
              backgroundColor: 'rgba(59,130,246,0.12)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <FileText size={18} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                  기능 정의서: {menuTitle || menuId}
                </h3>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                  backgroundColor: 'rgba(59,130,246,0.15)', color: 'var(--primary)', fontFamily: 'monospace'
                }}>
                  {menuId}.md
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                메뉴 목적 · 버튼/모달 기능 정의 · 헌장 준수 · MCP 에이전트 연동 명세
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 보기 / 편집 토글 */}
            <div style={{
              display: 'flex', backgroundColor: 'var(--bg-card)', borderRadius: '8px',
              border: '1px solid var(--border-color)', padding: '2px'
            }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  backgroundColor: !isEditing ? 'var(--primary)' : 'transparent',
                  color: !isEditing ? '#fff' : 'var(--text-secondary)'
                }}
              >
                <Eye size={13} />
                <span>열람 뷰어</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  backgroundColor: isEditing ? 'var(--primary)' : 'transparent',
                  color: isEditing ? '#fff' : 'var(--text-secondary)'
                }}
              >
                <Edit3 size={13} />
                <span>직접 편집</span>
              </button>
            </div>

            {/* 복사 버튼 */}
            <button
              type="button"
              onClick={handleCopy}
              title="마크다운 텍스트 복사"
              style={{
                padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
              <span>{copied ? '복사됨' : 'MD 복사'}</span>
            </button>

            {/* 다운로드 버튼 */}
            <button
              type="button"
              onClick={handleDownload}
              title=".md 파일로 다운로드"
              style={{
                padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <Download size={14} />
              <span>다운로드</span>
            </button>

            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 저장 성공 알림 배너 */}
        {saveSuccessMsg && (
          <div style={{
            backgroundColor: '#059669', color: '#fff', padding: '8px 16px',
            fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <Check size={16} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* 모달 본문 영역 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', backgroundColor: 'var(--bg-card)' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              기능 정의서를 불러오는 중입니다...
            </div>
          ) : isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  마크다운 문법을 사용하여 메뉴의 목적, 버튼 기능, 모달 스펙을 직접 수정할 수 있습니다.
                </span>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  style={{
                    border: 'none', background: 'none', color: '#D97706', fontSize: '11.5px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <RotateCcw size={12} />
                  <span>기본 템플릿으로 되돌리기</span>
                </button>
              </div>
              <textarea
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                style={{
                  flex: 1, width: '100%', minHeight: '440px',
                  backgroundColor: 'var(--bg-body)', color: 'var(--text-main)',
                  border: '1px solid var(--border-color)', borderRadius: '10px',
                  padding: '16px', fontSize: '13px', lineHeight: 1.6,
                  fontFamily: 'Consolas, monospace', resize: 'none', outline: 'none'
                }}
              />
            </div>
          ) : (
            <div style={{ maxWidth: '840px', margin: '0 auto' }}>
              {/* MCP 연동 정보 배너 */}
              <div style={{
                marginBottom: '18px', padding: '10px 14px', borderRadius: '10px',
                backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <Terminal size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--primary)', fontWeight: 800 }}>MCP & AI Agent Grounding 명세: </strong>
                  이 마크다운은 AI 에이전트가 본 메뉴를 조작할 때 업무 목적과 R&R 헌장을 준수하도록 주입되는 단일 진실 원천(SSOT) 명세입니다.
                </div>
              </div>

              {/* 렌더링된 마크다운 본문 */}
              {renderMarkdownToHtml(markdown)}
            </div>
          )}
        </div>

        {/* 모달 하단 푸터 바 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-body)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            글자 수: {markdown.length.toLocaleString()}자 · 줄 수: {markdown.split('\n').length}줄
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{
                    padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)',
                    fontSize: '12.5px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '7px 18px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'var(--primary)', color: '#fff',
                    fontSize: '12.5px', fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
                  }}
                >
                  <Save size={14} />
                  <span>{saving ? '저장 중...' : '변경사항 저장'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '7px 18px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)', color: 'var(--text-main)',
                  fontSize: '12.5px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};
