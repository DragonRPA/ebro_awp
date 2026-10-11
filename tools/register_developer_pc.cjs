#!/usr/bin/env node
/**
 * tools/register_developer_pc.cjs
 * Cross-platform Node.js companion script for eBro Developer PC Registration
 */

const os = require('os');
const crypto = require('crypto');
const https = require('https');
const { exec } = require('child_process');

const SUPABASE_URL = 'https://nyfashwbdcepncpdwpdb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM';
const DEFAULT_MASTER_KEY = 'ebro-dev-master-2026!';
const EMERGENCY_BREAK_GLASS_KEY = 'ebro-breakglass-recovery-2026!';
const VAULT_CIPHER_KEY = 0x4f;
const VAULT_PREFIX = '__EBRO_ENC__v1__';

function getPhysicalMacAddresses() {
  const ifaces = os.networkInterfaces();
  const macs = [];
  for (const [name, arr] of Object.entries(ifaces)) {
    for (const i of arr) {
      if (!i.internal && i.mac && i.mac !== '00:00:00:00:00:00') {
        const formatted = i.mac.toUpperCase().replace(/:/g, '-');
        if (!macs.includes(formatted)) {
          macs.push({ mac: formatted, name: `${name} (${i.family})` });
        }
      }
    }
  }
  return macs;
}

function encryptSecret(plainText) {
  if (!plainText) return '';
  try {
    const utf8 = unescape(encodeURIComponent(plainText));
    const chars = [];
    for (let i = 0; i < utf8.length; i++) {
      chars.push(utf8.charCodeAt(i) ^ (VAULT_CIPHER_KEY + (i % 7)));
    }
    const b64 = Buffer.from(String.fromCharCode(...chars), 'binary').toString('base64');
    const checksum = crypto.createHash('sha256').update(plainText).digest('hex').slice(0, 8);
    return `${VAULT_PREFIX}${checksum}__${b64}`;
  } catch (e) {
    return plainText;
  }
}

async function makeSupabaseRequest(path, method, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    };

    const req = https.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('========================================================================');
  console.log('  🛡️  eBro ERP - 개발자 공인 PC 등록 CLI (Cross-Platform)');
  console.log('========================================================================');

  const macs = getPhysicalMacAddresses();
  if (macs.length === 0) {
    console.error('❌ 유효한 물리적 네트워크 어댑터(MAC 주소)를 찾을 수 없습니다.');
    process.exit(1);
  }

  const primaryMac = macs[0].mac;
  const hostname = os.hostname();
  const platform = os.platform() === 'win32' ? 'Win32/x86_64' : `${os.platform()}/${os.arch()}`;
  const cores = os.cpus().length;

  console.log(`  • 컴퓨터 이름: ${hostname}`);
  console.log(`  • 운영체제  : ${platform}`);
  console.log(`  • CPU 코어수: ${cores} Cores`);
  console.log(`  • 주 MAC 주소: ${primaryMac} (${macs[0].name})`);

  const deviceId = `DEV-PC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${primaryMac.replace(/-/g, '').slice(-6)}`;
  const fingerprint = `HW-${crypto.createHash('sha256').update(`${hostname}:${primaryMac}:${cores}:${platform}`).digest('hex').slice(0, 8).toUpperCase()}-${cores}C`;
  const nowIso = new Date().toISOString();

  // 기존 등록 여부 확인
  console.log('\n[Supabase DB] 기존 등록 기기 조회 중...');
  const existing = await makeSupabaseRequest(`/rest/v1/developer_authorized_devices?macAddress=eq.${primaryMac}&select=id`);
  let finalId = deviceId;
  if (Array.isArray(existing.data) && existing.data.length > 0) {
    finalId = existing.data[0].id;
    console.log(`➔ 이미 등록된 단말기 식별됨 (ID: ${finalId}). 상태를 ACTIVE로 갱신합니다.`);
  }

  const payload = {
    id: finalId,
    developerId: 'sys-admin',
    developerName: '대표 개발자 (시스템 총괄)',
    machineName: hostname,
    macAddress: primaryMac,
    hardwareFingerprint: fingerprint,
    platform: platform,
    status: 'ACTIVE',
    isPrimary: false,
    emergencyBreakGlassUsed: false,
    note: '개발자 PC 등록 스크립트(register_developer_pc.cjs)를 통한 등록 (중앙 플랫폼)',
    registeredAt: nowIso,
    lastVerifiedAt: nowIso
  };

  console.log('[Supabase DB] developer_authorized_devices 테이블에 업서트 중...');
  const res = await makeSupabaseRequest('/rest/v1/developer_authorized_devices', 'POST', payload, {
    'Prefer': 'resolution=merge-duplicates,return=representation'
  });

  if (res.status >= 200 && res.status < 300) {
    console.log('✅ [성공] Supabase DB에 공인 개발자 단말기로 영구 저장되었습니다!');
    const tokenPayload = JSON.stringify({
      id: finalId,
      deviceId: finalId,
      macAddress: primaryMac,
      hardwareFingerprint: fingerprint,
      status: 'ACTIVE',
      sealedAt: nowIso
    });
    const encToken = encryptSecret(tokenPayload);
    const bindUrl = `http://localhost:5174/?dev_bind_id=${encodeURIComponent(finalId)}&dev_token=${encodeURIComponent(encToken)}&dev_mac=${encodeURIComponent(primaryMac)}`;

    console.log('\n========================================================================');
    console.log(`🎉 [공인 완료] PC: ${hostname} (MAC: ${primaryMac})`);
    console.log(`🌐 즉시 브라우저 바인딩 URL: ${bindUrl}`);
    console.log('========================================================================\n');
  } else {
    console.error('❌ Supabase 저장 실패:', res);
  }
}

main().catch(console.error);
