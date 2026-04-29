// 카카오 스키마(migration 005) 적용 검증
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  raw.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  });
  return env;
}

(async () => {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const checks = [
    { name: 'admin_users.kakao_id', q: () => supabase.from('admin_users').select('kakao_id').limit(1) },
    { name: 'admin_users.profile_image_url', q: () => supabase.from('admin_users').select('profile_image_url').limit(1) },
    { name: 'teams.kakao_id', q: () => supabase.from('teams').select('kakao_id').limit(1) },
    { name: 'teams.profile_image_url', q: () => supabase.from('teams').select('profile_image_url').limit(1) },
    { name: 'stores.kakao_id', q: () => supabase.from('stores').select('kakao_id').limit(1) },
    { name: 'stores.profile_image_url', q: () => supabase.from('stores').select('profile_image_url').limit(1) },
    { name: 'kakao_pending_signups 테이블', q: () => supabase.from('kakao_pending_signups').select('id').limit(1) },
  ];

  console.log('=== Kakao 스키마 검증 (migration 005) ===\n');
  let allOk = true;
  for (const c of checks) {
    const { error } = await c.q();
    if (error) {
      console.log(`❌ ${c.name}: ${error.code || ''} ${error.message}`);
      allOk = false;
    } else {
      console.log(`✓  ${c.name}`);
    }
  }
  console.log(allOk ? '\n✅ 카카오 스키마 적용됨' : '\n⚠️  migration 005 미적용 — 실행 필요');

  console.log('\n=== .env.local 카카오 설정 ===');
  console.log(`  NEXT_PUBLIC_KAKAO_REST_API_KEY: ${env.NEXT_PUBLIC_KAKAO_REST_API_KEY ? '설정됨' : '❌ 비어있음'}`);
  console.log(`  KAKAO_CLIENT_SECRET:           ${env.KAKAO_CLIENT_SECRET ? '설정됨' : '(선택사항, 비어있음)'}`);
  console.log(`  NEXT_PUBLIC_KAKAO_REDIRECT_URI: ${env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || '❌ 비어있음'}`);
})();
