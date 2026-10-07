// scripts/publish_to_github_releases.cjs
const https = require('https');
const fs = require('fs');
const path = require('path');

const { execSync } = require('child_process');

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const out = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8'
    });
    const m = out.match(/password=(.+)/);
    return m ? m[1].trim() : '';
  } catch (e) {
    return '';
  }
}

const GITHUB_TOKEN = getGitHubToken();
const REPO = 'DragonRPA/ebro_awp';
const TAG = 'agent-v2.0.0';

function githubRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          resolve({ statusCode: res.statusCode, data: json, raw: data });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) req.write(body);
      else if (typeof body === 'string') req.write(body);
      else req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function getOrCreateRelease() {
  console.log(`🔍 Checking release for tag ${TAG}...`);
  const getRes = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${REPO}/releases/tags/${TAG}`,
    method: 'GET',
    headers: {
      'User-Agent': 'ebro-deployer',
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (getRes.statusCode === 200) {
    console.log(`✅ Existing release found: ID ${getRes.data.id}`);
    return getRes.data;
  }

  console.log(`🚀 Creating new release for tag ${TAG}...`);
  const createRes = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${REPO}/releases`,
    method: 'POST',
    headers: {
      'User-Agent': 'ebro-deployer',
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    }
  }, {
    tag_name: TAG,
    target_commitish: 'main',
    name: 'eBro AI Agent v2.0.0 Production Release',
    body: 'eBro AI Agent v2.0.0 (Tenant-specific Installers with Source Code Protection and High-Speed Global CDN)',
    draft: false,
    prerelease: false
  });

  if (createRes.statusCode !== 201 && createRes.statusCode !== 200) {
    throw new Error(`Failed to create release: HTTP ${createRes.statusCode} - ${createRes.raw}`);
  }

  console.log(`✅ Release created: ID ${createRes.data.id}`);
  return createRes.data;
}

async function uploadAsset(releaseId, localPath, fileName) {
  const stat = fs.statSync(localPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
  console.log(`\n📤 Uploading ${fileName} (${sizeMB} MB) to GitHub Releases...`);

  // 먼저 기존 동일 이름 asset이 있으면 삭제
  const assetsRes = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${REPO}/releases/${releaseId}/assets`,
    method: 'GET',
    headers: {
      'User-Agent': 'ebro-deployer',
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (Array.isArray(assetsRes.data)) {
    const existing = assetsRes.data.find(a => a.name === fileName);
    if (existing) {
      console.log(`  🗑️ Deleting existing asset ${existing.id}...`);
      await githubRequest({
        hostname: 'api.github.com',
        path: `/repos/${REPO}/releases/assets/${existing.id}`,
        method: 'DELETE',
        headers: {
          'User-Agent': 'ebro-deployer',
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
    }
  }

  const fileBuffer = fs.readFileSync(localPath);

  return new Promise((resolve, reject) => {
    const uploadUrl = `https://uploads.github.com/repos/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;
    const parsed = new URL(uploadUrl);

    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'User-Agent': 'ebro-deployer',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/vnd.microsoft.portable-executable',
        'Content-Length': fileBuffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          try {
            const assetJson = JSON.parse(data);
            console.log(`  ✅ ${fileName} uploaded successfully! Download URL: ${assetJson.browser_download_url}`);
            resolve(assetJson);
          } catch (e) {
            resolve({ raw: data });
          }
        } else {
          reject(new Error(`Upload failed HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

async function main() {
  const release = await getOrCreateRelease();
  const dir = path.join(__dirname, '..', 'public', 'downloads');

  const files = [
    'eBroAgent_Setup.exe'
  ];

  for (const f of files) {
    const fullPath = path.join(dir, f);
    if (fs.existsSync(fullPath)) {
      await uploadAsset(release.id, fullPath, f);
    }
  }

  console.log('\n🎉 All tenant installers uploaded to GitHub Releases CDN successfully!');
}

main().catch(err => {
  console.error('Fatal deployment error:', err);
  process.exit(1);
});
