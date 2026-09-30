// src/components/PrivacyPolicyModal.tsx
// 대한민국 개인정보 보호법 제30조(개인정보 처리방침의 수립 및 공개), 제29조(안전조치의무), 안전성 확보조치 기준 제8조 준수 모달
import React, { useState } from 'react';
import { X, ShieldCheck, Edit2, Save, UserCheck, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Tenant, TenantPrivacyOfficer } from '../services/db';

interface PrivacyPolicyModalProps {
  isOpen?: boolean;
  onClose: () => void;
  tenant?: Tenant;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen = true, onClose, tenant: propTenant }) => {
  const { currentTenant, saveTenant, currentUser, hasPermission, showErrorModal } = useApp();
  const activeTenant = propTenant || currentTenant;

  // 권한: 최고관리자(admin), ADMIN 역할 또는 인사/권한 설정 권한자
  const canEdit = currentUser?.role === 'ADMIN' || 
                  currentUser?.loginId === 'admin' || 
                  hasPermission('organization', 'save') || 
                  hasPermission('permission', 'save');

  // 테넌트 회사명 및 비즈니스 종목
  const companyName = activeTenant?.tradeName || activeTenant?.corporateName || activeTenant?.displayName || '(주)기연리프트';
  const businessItem = activeTenant?.businessItem || '고소작업대 렌탈';

  // 현재 테넌트의 개인정보 보호책임자 정보
  const currentOfficer: TenantPrivacyOfficer = activeTenant?.privacyOfficer || {
    name: activeTenant?.privacyOfficerName || activeTenant?.representativeName || '대표이사 / 관리부 총괄',
    position: activeTenant?.privacyOfficerPosition || '대표이사 / 관리부 총괄',
    department: activeTenant?.privacyOfficerDepartment || `${companyName} 경영진`,
    phone: activeTenant?.privacyOfficerPhone || activeTenant?.tel || '031-334-5295',
    email: activeTenant?.privacyOfficerEmail || activeTenant?.email || activeTenant?.taxEmail || '사내 관리부 (시스템 문의)',
    updatedAt: activeTenant?.updatedAt
  };

  // 책임자 정보 수정 모드 상태
  const [isEditingOfficer, setIsEditingOfficer] = useState(false);
  const [officerForm, setOfficerForm] = useState<TenantPrivacyOfficer>({
    name: currentOfficer.name || '',
    position: currentOfficer.position || '',
    department: currentOfficer.department || '',
    phone: currentOfficer.phone || '',
    email: currentOfficer.email || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  if (!isOpen) return null;

  // 책임자 수정 모드 시작
  const handleStartEdit = () => {
    setOfficerForm({
      name: currentOfficer.name || '',
      position: currentOfficer.position || '',
      department: currentOfficer.department || '',
      phone: currentOfficer.phone || '',
      email: currentOfficer.email || ''
    });
    setIsEditingOfficer(true);
    setSaveSuccessMsg(false);
  };

  // 책임자 정보 저장
  const handleSaveOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerForm.name.trim()) {
      alert('개인정보 보호책임자 성명을 입력해 주세요.');
      return;
    }
    if (!activeTenant?.id) {
      alert('활성화된 테넌트 정보가 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const updatedOfficer: TenantPrivacyOfficer = {
        name: officerForm.name.trim(),
        position: (officerForm.position || '').trim() || '개인정보 보호책임자',
        department: (officerForm.department || '').trim() || `${companyName} 경영진`,
        phone: (officerForm.phone || '').trim() || activeTenant.tel || '',
        email: (officerForm.email || '').trim() || activeTenant.email || '',
        updatedAt: nowIso
      };

      await saveTenant({
        id: activeTenant.id,
        privacyOfficer: updatedOfficer,
        privacyOfficerName: updatedOfficer.name,
        privacyOfficerPosition: updatedOfficer.position,
        privacyOfficerDepartment: updatedOfficer.department,
        privacyOfficerPhone: updatedOfficer.phone,
        privacyOfficerEmail: updatedOfficer.email,
        updatedAt: nowIso
      });

      setIsEditingOfficer(false);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (err: any) {
      showErrorModal(`개인정보 보호책임자 저장 실패: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        color: 'var(--text-main, #0f172a)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* 모달 헤더 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary, #f8fafc)',
          borderRadius: '12px 12px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <ShieldCheck size={20} color="var(--primary, #4f46e5)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
              개인정보 처리방침
            </h3>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {companyName}
            </span>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: 'var(--success)', fontWeight: 600 }}>
              법 제29조 / 안전성 고시 제8조 준수
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #64748b)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 (스크롤) */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          fontSize: '13px',
          lineHeight: '1.65',
          color: 'var(--text-secondary, #334155)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* 서두: 테넌트 회사명 연동 (이미지 1 요구사항) */}
          <p style={{ margin: 0, fontWeight: 500 }}>
            <strong>{companyName}</strong>(이하 &apos;당사&apos;)는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.
          </p>

          <section style={{ borderTop: '1px solid var(--border-color, #f1f5f9)', paddingTop: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '8px' }}>
              제1조 (개인정보의 처리 목적)
            </h4>
            <p style={{ margin: 0 }}>
              당사는 {businessItem} 계약 체결 및 이행, 장비 출고·회수 배차 운송, 현장 AS 정비 및 정산, 세금계산서 발행, 임직원 인사·노무 관리 등의 목적으로 최소한의 개인정보를 처리합니다.
            </p>
          </section>

          <section style={{ borderTop: '1px solid var(--border-color, #f1f5f9)', paddingTop: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '8px' }}>
              제2조 (처리하는 개인정보 항목 및 주민등록번호 미수집 원칙)
            </h4>
            <div style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                주민등록번호 미수집 원칙 (개인정보 보호법 제24조의2 준수)
              </div>
              <p style={{ margin: 0, fontSize: '12px' }}>
                당사는 법률·대통령령에 구체적 수집 근거가 없는 경우 주민등록번호를 일체 수집·보관하지 않으며, 운송기사 및 거래처의 본인 확인 시 <strong>생년월일(YYMMDD)</strong>만을 제한적으로 수집합니다.
              </p>
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>고객사/거래처</strong>: 대표자 성명, 담당자 성명, 직급, 유무선 전화번호, 전자세금계산서 이메일, 현장 주소</li>
              <li><strong>매입처/운송사</strong>: 상호, 대표자명, 담당자 연락처, 지급 계좌번호(은행명, 계좌번호, 예금주)</li>
              <li><strong>운송기사</strong>: 기사 성명, 연락처, 생년월일, 차량번호, 차종/톤수</li>
              <li><strong>임직원</strong>: 성명, 사번/ID, 비밀번호(일방향 해시 암호화), 소속부서({companyName}), 직급, 연락처, 입사일</li>
            </ul>
          </section>

          <section style={{ borderTop: '1px solid var(--border-color, #f1f5f9)', paddingTop: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '8px' }}>
              제3조 (개인정보의 안전성 확보조치 - 법 제29조 준수)
            </h4>
            <p style={{ margin: 0, marginBottom: '6px' }}>
              당사는 개인정보의 분실·도난·유출·위조·변조 또는 훼손을 방지하기 위하여 다음 각 호의 기술적·관리적 보호조치를 이행하고 있습니다:
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>접근 권한 관리</strong>: 사용자 역할 및 직무별 세부 메뉴 권한 통제(RBAC) 적용</li>
              <li><strong>비밀번호 일방향 암호화</strong>: 사용자 비밀번호는 복호화 불가능한 안전한 일방향 해시 함수로 암호화 보관</li>
              <li><strong>개인정보 마스킹 출력</strong>: 일반 직원의 엑셀 다운로드 및 화면 표출 시 전화번호, 이메일, 계좌번호 등 개인정보 자동 마스킹 적용 (경영진 및 개발자 전용 전체 정보 분리)</li>
              <li><strong>전송 구간 암호화</strong>: 전송 구간 SSL/TLS 보안 프로토콜 상시 적용</li>
            </ul>
          </section>

          <section style={{ borderTop: '1px solid var(--border-color, #f1f5f9)', paddingTop: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '8px' }}>
              제4조 (개인정보 접속기록의 보관 및 점검 - 안전성 확보조치 기준 제8조 준수)
            </h4>
            <p style={{ margin: 0, marginBottom: '6px' }}>
              당사는 개인정보취급자가 개인정보처리시스템에 접속하여 수행한 모든 업무 내역을 법정 기준에 따라 보관·관리합니다:
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>접속기록 항목</strong>: 접속자 계정(사번/성명), 접속일시, 접속지(IP), 수행업무(로그인/로그아웃, 조회, 수정, 삭제, 엑셀 다운로드), 대상 정보주체 식별정보, 마스킹 여부</li>
              <li><strong>보관 기간</strong>: 개인정보 접속기록(Privacy Access Log)은 <strong>최소 1년 이상(고유식별정보 처리 시 2년 이상)</strong> 위·변조 방지 보관</li>
              <li><strong>정기 점검</strong>: 개인정보 보호책임자는 <strong>반기별 1회 이상</strong> 접속기록을 점검하여 비인가 접근 및 개인정보 다운로드 사유를 감사·기록</li>
            </ul>
          </section>

          {/* 제5조: 테넌트별 개인정보 보호책임자 동적 연동 및 인라인 수정 (이미지 2 요구사항) */}
          <section style={{ borderTop: '1px solid var(--border-color, #f1f5f9)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main, #0f172a)', margin: 0 }}>
                제5조 (개인정보 보호책임자 및 권익침해 구제)
              </h4>
              {canEdit && !isEditingOfficer && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                  title="현재 테넌트의 개인정보 보호책임자 정보를 수정합니다"
                >
                  <Edit2 size={12} />
                  책임자 정보 수정
                </button>
              )}
            </div>

            {saveSuccessMsg && (
              <div style={{
                marginBottom: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: 'var(--success)',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle2 size={14} />
                테넌트({companyName})의 개인정보 보호책임자 정보가 DB에 정상 저장되었습니다.
              </div>
            )}

            {isEditingOfficer ? (
              /* 관리자 전용 책임자 수정 폼 */
              <form onSubmit={handleSaveOfficer} style={{
                backgroundColor: 'var(--bg-secondary, #f8fafc)',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1.5px solid var(--primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={14} />
                  [{companyName}] 개인정보 보호책임자 정보 설정
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      성명 *
                    </label>
                    <input
                      type="text"
                      value={officerForm.name}
                      onChange={e => setOfficerForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="예: 이수용"
                      required
                      style={{ fontSize: '12.5px', padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      직책 / 직급
                    </label>
                    <input
                      type="text"
                      value={officerForm.position}
                      onChange={e => setOfficerForm(prev => ({ ...prev, position: e.target.value }))}
                      placeholder="예: 대표이사 / 관리부 총괄"
                      style={{ fontSize: '12.5px', padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      소속 부서 / 조직
                    </label>
                    <input
                      type="text"
                      value={officerForm.department}
                      onChange={e => setOfficerForm(prev => ({ ...prev, department: e.target.value }))}
                      placeholder={`예: ${companyName} 경영진`}
                      style={{ fontSize: '12.5px', padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      대표 연락처 (전화번호)
                    </label>
                    <input
                      type="text"
                      value={officerForm.phone}
                      onChange={e => setOfficerForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="예: 031-334-5295"
                      style={{ fontSize: '12.5px', padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      문의 및 불만처리 (부서/이메일)
                    </label>
                    <input
                      type="text"
                      value={officerForm.email}
                      onChange={e => setOfficerForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="예: 사내 관리부 (giyeonlift@naver.com)"
                      style={{ fontSize: '12.5px', padding: '6px 10px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditingOfficer(false)}
                    className="btn btn-secondary"
                    style={{ fontSize: '11.5px', padding: '4px 10px' }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn btn-primary"
                    style={{ fontSize: '11.5px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Save size={12} />
                    {isSaving ? '저장 중...' : '책임자 정보 저장'}
                  </button>
                </div>
              </form>
            ) : (
              /* 책임자 정보 뷰 (이미지 2 연동) */
              <div style={{
                backgroundColor: 'var(--bg-secondary, #f8fafc)',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px', fontSize: '13px' }}>
                  개인정보 보호책임자
                </div>
                <div>• 성명: <strong>{currentOfficer.name || '대표이사 / 관리부 총괄'}</strong></div>
                <div>• 소속/직책: {currentOfficer.department ? `${currentOfficer.department} · ` : ''}{currentOfficer.position || '경영진'}</div>
                <div>• 문의 및 불만처리: {currentOfficer.email || '사내 관리부'}{currentOfficer.phone ? ` (연락처: ${currentOfficer.phone})` : ''}</div>
              </div>
            )}
          </section>
        </div>

        {/* 모달 하단 버튼 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: 'var(--bg-secondary, #f8fafc)',
          borderRadius: '0 0 12px 12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 18px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary, #4f46e5)',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
