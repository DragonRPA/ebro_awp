const fs = require('fs');

// 1. Customers.tsx
let cust = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const oldBtnCust = `<Edit2 size={12} /> 고객사 수정
                      </button>
                    )}`;
const newBtnCust = `<Edit2 size={12} /> 고객사 수정
                      </button>
                    )}
                    {activeCustomer.businessCertFileUrl && (
                      <button
                        type="button"
                        onClick={() => window.open(activeCustomer.businessCertFileUrl, '_blank')}
                        style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', border: '1px solid #0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', fontWeight: 600, cursor: 'pointer' }}
                        title="등록된 사업자등록증 사본 열람"
                      >
                        <FileText size={12} /> 사업자등록증 보기
                      </button>
                    )}`;
if (cust.includes(oldBtnCust)) {
  cust = cust.replace(oldBtnCust, newBtnCust);
  fs.writeFileSync('src/pages/Customers.tsx', cust);
  console.log('Customers.tsx updated.');
} else {
  console.log('Could not find anchor in Customers.tsx');
}
