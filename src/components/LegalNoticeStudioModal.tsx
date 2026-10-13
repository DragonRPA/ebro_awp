import React, { useState } from 'react';
import { FileText, Save, Printer } from 'lucide-react';
import { Customer, Tenant } from '../services/db';

interface LegalNoticeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  noticeTargetDel: any;
  customer?: Customer;
  currentTenant?: Tenant | null;
  todayStr: string;
  initialTitle: string;
  initialDeadlineDays: number;
  initialContent: string;
  initialTrackingNo: string;
  onSaveTemplate: (content: string) => Promise<void>;
  onSubmitNotice: (payload: {
    noticeTitle: string;
    noticeDeadlineDays: number;
    noticeCustomContent: string;
    noticeTrackingNo: string;
  }) => Promise<void>;
}

export const LegalNoticeStudioModal: React.FC<LegalNoticeStudioModalProps> = ({
  isOpen,
  onClose,
  noticeTargetDel,
  customer,
  currentTenant,
  todayStr,
  initialTitle,
  initialDeadlineDays,
  initialContent,
  initialTrackingNo,
  onSaveTemplate,
  onSubmitNotice
}) => {
  // 모달 자체 독립 로컬 상태 (대형 연체 대장의 매 타이핑 리렌더링 차단)
  const [title, setTitle] = useState(initialTitle);
  const [deadlineDays, setDeadlineDays] = useState(initialDeadlineDays);
  const [customContent, setCustomContent] = useState(initialContent);
  const [trackingNo, setTrackingNo] = useState(initialTrackingNo);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !noticeTargetDel) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmitNotice({
        noticeTitle: title,
        noticeDeadlineDays: deadlineDays,
        noticeCustomContent: customContent,
        noticeTrackingNo: trackingNo
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTemplateClick = async () => {
    await onSaveTemplate(customContent);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          width: '95%',
          maxWidth: '1100px',
          height: '90vh',
          backgroundColor: 'var(--bg-card)',
          margin: 0,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
                backgroundColor: '#f3e8ff',
                color: '#7e22ce'
              }}
            >
              경영진 전결
            </span>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 800,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileText size={17} color="#7e22ce" /> 내용증명 / 법적 최고장 작성 스튜디오
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>

        {/* 2열 스튜디오 본체: 좌측 편집기 / 우측 A4 미리보기 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 1fr',
            gap: '14px',
            flex: 1,
            minHeight: 0
          }}
        >
          {/* [좌측] 내용증명 편집기 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-app)',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px'
              }}
            >
              <div>
                수신 거래처: <strong>{noticeTargetDel.customerName}</strong>
              </div>
              <div>
                대표이사: <strong>{customer?.representative || '대표이사'}</strong> 귀하
              </div>
              <div>
                연체 총액:{' '}
                <strong style={{ color: 'var(--danger)' }}>
                  ₩{noticeTargetDel.totalOverdueAmount.toLocaleString()}원
                </strong>
              </div>
              <div>
                약정 결제일: <strong>{noticeTargetDel.paymentDueConditionText}</strong> (
                {noticeTargetDel.overdueDays}일 도과)
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '3px'
                }}
              >
                문서 제목
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '12px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  fontWeight: 700
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: '3px'
                  }}
                >
                  변제 최고 기한 (도달일로부터)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(Math.max(1, Number(e.target.value)))}
                    style={{ width: '80px', padding: '5px', fontSize: '12px', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '12px' }}>일 이내</span>
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: '3px'
                  }}
                >
                  우체국 등기번호 (발송 후 입력)
                </label>
                <input
                  type="text"
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  placeholder="예: 13자리 등기번호"
                  style={{ width: '100%', padding: '5px 8px', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '3px'
                }}
              >
                <label style={{ fontSize: '11.5px', fontWeight: 700 }}>
                  내용증명 본문 (자유 편집 가능)
                </label>
                <button
                  data-hs-trigger="Save"
                  type="button"
                  className="btn-secondary"
                  onClick={handleSaveTemplateClick}
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    color: 'var(--primary)'
                  }}
                >
                  <Save size={11} /> 기본 서식으로 저장
                </button>
              </div>
              <textarea
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                rows={12}
                style={{
                  width: '100%',
                  flex: 1,
                  padding: '10px',
                  fontSize: '11.5px',
                  lineHeight: '1.6',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          {/* [우측] A4 인쇄 규격 미리보기 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>A4 우체국 내용증명 규격 미리보기 (여백 20mm)</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => window.print()}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Printer size={12} /> 인쇄 / PDF 출력
              </button>
            </div>

            <div
              id="legal-notice-print-area"
              style={{
                flex: 1,
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                padding: '24px 28px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                overflowY: 'auto',
                fontSize: '11px',
                lineHeight: '1.6',
                fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif"
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '18px',
                  fontWeight: 900,
                  letterSpacing: '4px',
                  textDecoration: 'underline',
                  marginBottom: '20px'
                }}
              >
                최 고 장 (내 용 증 명)
              </div>

              {/* 수신인 / 발신인 상자 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '10px'
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      borderBottom: '1px dashed #cbd5e1',
                      paddingBottom: '3px',
                      marginBottom: '4px'
                    }}
                  >
                    [수 신 인]
                  </div>
                  <div>
                    상 호: <strong>{noticeTargetDel.customerName}</strong>
                  </div>
                  <div>
                    대 표 자: <strong>{customer?.representative || '대표이사'}</strong> 귀하
                  </div>
                  <div>사업자번호: {customer?.bizRegNo || '-'}</div>
                  <div>주 소: {customer?.address || '사업장 소재지'}</div>
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      borderBottom: '1px dashed #cbd5e1',
                      paddingBottom: '3px',
                      marginBottom: '4px'
                    }}
                  >
                    [발 신 인]
                  </div>
                  <div>
                    상 호:{' '}
                    <strong>
                      {currentTenant?.corporateName ||
                        currentTenant?.tradeName ||
                        '주식회사 임대인'}
                    </strong>
                  </div>
                  <div>
                    대 표 자:{' '}
                    <strong>{currentTenant?.representativeName || '대표자'}</strong> (직인생략/날인)
                  </div>
                  <div>등록번호: {currentTenant?.businessNumber || '138-81-83251'}</div>
                  <div>
                    주 소:{' '}
                    {currentTenant?.businessAddress ||
                      (currentTenant as any)?.address ||
                      '사업장 소재지'}
                  </div>
                  <div>전화번호: {currentTenant?.tel || '031-334-5296'}</div>
                </div>
              </div>

              <div
                style={{
                  fontWeight: 800,
                  fontSize: '12px',
                  marginBottom: '12px',
                  backgroundColor: 'var(--bg-app)',
                  padding: '6px 8px',
                  borderLeft: '4px solid #0f172a'
                }}
              >
                제 목: {title}
              </div>

              {/* 본문 */}
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.7',
                  marginBottom: '24px'
                }}
              >
                {customContent}
              </div>

              {/* 말미 직인 날인란 */}
              <div style={{ textAlign: 'right', marginTop: '30px', paddingRight: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                  {todayStr.split('-')[0]}년 {todayStr.split('-')[1]}월 {todayStr.split('-')[2]}일
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 900,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>
                    {currentTenant?.corporateName || '주식회사 임대인'} 대표이사{' '}
                    {currentTenant?.representativeName || '대표자'}
                  </span>
                  <span
                    style={{
                      border: '2px solid #dc2626',
                      color: 'var(--danger)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800
                    }}
                  >
                    (인)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 바 */}
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            발송 승인 시 내용증명 발송 이력(`legalNoticeLogs`) 및 고객 타임라인에 보존됩니다.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={isSubmitting}
              onClick={onClose}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              취소
            </button>
            <button
              data-hs-trigger="Save"
              type="button"
              className="btn-primary"
              disabled={isSubmitting}
              onClick={handleSubmit}
              style={{
                padding: '6px 16px',
                fontSize: '12px',
                backgroundColor: '#7e22ce',
                borderColor: '#7e22ce'
              }}
            >
              {isSubmitting ? '처리 중...' : '내용증명 발송 승인 및 이력 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
