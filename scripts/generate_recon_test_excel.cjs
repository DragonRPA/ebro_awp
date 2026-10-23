const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function createExcelFiles() {
  const rootDir = path.join(__dirname, '..');
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. 경기화물운송 2026년 10월 거래명세서
  const gyeonggiRows = [
    ['[거래명세서] 경기화물운송(주) - 2026년 10월 운송료 청구 내역서'],
    ['귀하: eBroAWP 렌탈', '', '사업자등록번호: 124-86-11223', '', '대표자: 김경기', '', '연락처: 031-355-7700'],
    [],
    ['일자', '업체명', '현장명', '상차지', '하차지', '차종', '기사명', '운송비', '비고'],
    [
      '2026-10-02',
      '삼성물산 건설부문',
      '평택 고덕 반도체 P4 신축현장',
      '화성 남양 주기장',
      '경기도 평택시 고덕면 고덕국제대로 77',
      '5T',
      '김철수',
      180000,
      'GS-1930 2대 정상출고'
    ],
    [
      '2026-10-05',
      '현대엔지니어링 / 대우건설',
      '화성 동탄 물류센터 외 수원 광교 2곳',
      '화성 남양 주기장',
      '화성 동탄 물류센터 ➔ 수원 광교 데이터센터',
      '5T 축차',
      '박영수',
      290000,
      '동탄-광교 2곳 하차 경유지 할증 (+40,000원)'
    ],
    [
      '2026-10-08',
      '지에스건설',
      '인천 송도 바이오클러스터 2공구',
      '화성 남양 주기장',
      '인천광역시 연수구 송도동 첨단대로 305',
      '3.5T',
      '이민호',
      200000,
      'SJ3219 2대 출고'
    ],
    [
      '2026-10-12',
      '포스코이앤씨',
      '용인 원삼 반도체클러스터 1공구',
      '화성 남양 주기장',
      '경기도 용인시 처인구 원삼면 죽능리 500',
      '5T',
      '김철수',
      250000,
      '보안게이트 출입 대기 2시간 (현장 대기료 +30,000원)'
    ],
    [
      '2026-10-15',
      '에스케이에코플랜트 / 삼성물산',
      '이천 하이닉스 M16 외 평택 고덕 합짐',
      '화성 남양 주기장',
      '이천 하이닉스 M16 ➔ 평택 고덕 반도체 P4',
      '5T 축차',
      '박영수',
      320000,
      '이천-평택 합짐 운송 (JCPT0807AC 2대)'
    ],
    [
      '2026-10-18',
      '현대엔지니어링',
      '화성 동탄 물류센터 신축현장',
      '화성 남양 주기장',
      '경기도 화성시 동탄면 동탄산단로 120',
      '2.5T 셀프',
      '정우성',
      280000,
      '장비 교환 왕복 운송 (출고+회수)'
    ],
    [
      '2026-10-20',
      '대림건설(타사오청구)',
      '안산 반월공단 물류창고',
      '화성 남양 주기장',
      '경기도 안산시 단원구 성곡동 600',
      '5T',
      '김철수',
      170000,
      '전대 원사 직접회수건 또는 타사 오청구 건 (검토요망)'
    ],
    [],
    ['합계', '', '', '', '', '', '', 1690000, '공급가액 합계 (부가세 별도)']
  ];

  const wbGyeonggi = XLSX.utils.book_new();
  const wsGyeonggi = XLSX.utils.aoa_to_sheet(gyeonggiRows);
  wsGyeonggi['!cols'] = [
    { wch: 13 },
    { wch: 24 },
    { wch: 30 },
    { wch: 18 },
    { wch: 36 },
    { wch: 11 },
    { wch: 10 },
    { wch: 14 },
    { wch: 42 }
  ];
  XLSX.utils.book_append_sheet(wbGyeonggi, wsGyeonggi, '2026년10월_거래명세서');

  const gyeonggiFileName = '운송료대사_테스트_거래명세서_경기화물운송_2026년10월.xlsx';
  XLSX.writeFile(wbGyeonggi, path.join(rootDir, gyeonggiFileName));
  XLSX.writeFile(wbGyeonggi, path.join(publicDir, gyeonggiFileName));
  console.log(`✅ 생성 완료: ${gyeonggiFileName}`);

  // 2. 엘제이운송 2026년 10월 거래명세서
  const ljRows = [
    ['[거래명세서] 엘제이운송 - 2026년 10월 운송료 청구 내역서'],
    ['귀하: eBroAWP 렌탈', '', '사업자등록번호: 135-81-88990', '', '대표자: 이엘제이', '', '연락처: 031-681-4455'],
    [],
    ['일자', '업체명', '현장명', '상차지', '하차지', '차종', '기사명', '운송비', '비고'],
    [
      '2026-10-06',
      '지에스건설',
      '인천 송도 바이오클러스터 2공구',
      '화성 남양 주기장',
      '인천광역시 연수구 송도동 첨단대로 305',
      '5T',
      '최동훈',
      190000,
      '1230ES 2대 정상출고'
    ],
    [
      '2026-10-14',
      '삼성물산 / 현대엔지니어링',
      '평택 고덕 반도체 P4 외 화성 동탄 합짐',
      '화성 남양 주기장',
      '평택 고덕 반도체 P4 ➔ 화성 동탄 물류센터',
      '5T 축차',
      '강백호',
      290000,
      '평택-동탄 2곳 하차 경유지 할증 (+30,000원)'
    ],
    [],
    ['합계', '', '', '', '', '', '', 480000, '공급가액 합계 (부가세 별도)']
  ];

  const wbLj = XLSX.utils.book_new();
  const wsLj = XLSX.utils.aoa_to_sheet(ljRows);
  wsLj['!cols'] = [
    { wch: 13 },
    { wch: 24 },
    { wch: 32 },
    { wch: 18 },
    { wch: 36 },
    { wch: 11 },
    { wch: 10 },
    { wch: 14 },
    { wch: 42 }
  ];
  XLSX.utils.book_append_sheet(wbLj, wsLj, '2026년10월_거래명세서');

  const ljFileName = '운송료대사_테스트_거래명세서_엘제이운송_2026년10월.xlsx';
  XLSX.writeFile(wbLj, path.join(rootDir, ljFileName));
  XLSX.writeFile(wbLj, path.join(publicDir, ljFileName));
  console.log(`✅ 생성 완료: ${ljFileName}`);
}

createExcelFiles();
