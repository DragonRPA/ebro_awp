// src/mobile/components/PwaInstallBanner.tsx
import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, MoreVertical } from 'lucide-react';

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIPad, setIsIPad] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. 홈 화면 단독 앱(Standalone) 실행 여부 확인
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // 2. 기기 판별 (iOS/iPadOS vs Android)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIPadOS = /ipad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(userAgent);
    setIsIPad(isIPadOS);
    setIsAndroid(isAndroidDevice);

    // 3. 안드로이드 beforeinstallprompt 이벤트 캡처
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 이미 독립 실행 중이거나 사용자가 닫았으면 배너 숨김
  if (isStandalone || isDismissed) {
    return null;
  }

  // 설치 버튼 클릭 핸들러
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // 크롬/웨일 등 브라우저 기본 네이티브 설치 프롬프트 직접 호출
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsDismissed(true);
      }
    } else {
      // 브라우저 프롬프트가 아직 준비되지 않은 경우 기기 맞춤 가이드 모달 표출
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* ── 1. 상단 슬림 설치 배너 (인라인 스타일 100% 보장) ── */}
      <div style={{
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        fontSize: '12px',
        color: '#f8fafc',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        zIndex: 40,
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Smartphone size={17} color="#60a5fa" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '13px', color: '#ffffff', lineHeight: 1.2 }}>
              홈 화면 바로가기 추가
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              가용 재고 조회 화면 단독 실행
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleInstallClick}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '12px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Download size={14} />
            <span>설치</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            style={{
              padding: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── 2. 기기별 맞춤 홈 화면 추가 가이드 모달 (Fixed 화면 중앙 오버레이) ── */}
      {showGuideModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 99999
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '20px',
            padding: '20px',
            maxWidth: '350px',
            width: '100%',
            color: '#f8fafc',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                <Smartphone size={18} color="#60a5fa" />
                <span>홈 화면 앱 추가 방법</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
              브라우저 메뉴를 통해 홈 화면에 추가하시면 전체화면 단독 앱으로 사용하실 수 있습니다.
            </p>

            {/* 단계별 가이드 박스 (Android vs iOS 맞춤 분기) */}
            <div style={{
              backgroundColor: '#020617',
              border: '1px solid #1e293b',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {isAndroid ? (
                // 안드로이드 (크롬 / 삼성인터넷 / 웨일 등)
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: '#60a5fa',
                      fontWeight: '800',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      1
                    </div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>
                      브라우저 우측 상단의 <strong style={{ color: '#60a5fa' }}><MoreVertical size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> 메뉴(점 세 개)</strong>를 터치합니다.
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: '#60a5fa',
                      fontWeight: '800',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      2
                    </div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>
                      메뉴에서 <strong style={{ color: '#34d399' }}>[앱 설치]</strong> 또는 <strong style={{ color: '#34d399' }}>[홈 화면에 추가]</strong>를 선택합니다.
                    </div>
                  </div>
                </>
              ) : (
                // iOS 사파리 등
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: '#60a5fa',
                      fontWeight: '800',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      1
                    </div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>
                      {isIPad ? (
                        <>사파리 브라우저 <strong>상단 우측 툴바</strong>의 <strong style={{ color: '#60a5fa' }}><Share size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> 공유</strong> 아이콘을 터치합니다.</>
                      ) : (
                        <>사파리 브라우저 <strong>하단 메뉴바</strong>의 <strong style={{ color: '#60a5fa' }}><Share size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> 공유</strong> 아이콘을 터치합니다.</>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: '#60a5fa',
                      fontWeight: '800',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      2
                    </div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>
                      메뉴를 스크롤하여 <strong style={{ color: '#34d399' }}><PlusSquare size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> 홈 화면에 추가</strong>를 선택합니다.
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)'
              }}
            >
              확인 완료
            </button>
          </div>
        </div>
      )}
    </>
  );
};
