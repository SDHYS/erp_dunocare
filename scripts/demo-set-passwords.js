// 데모용 비밀번호 일괄 설정 (정책 우회 — service_role 직접 DB 쓰기)
// ⚠️ 데모 종료 후 반드시 강한 비밀번호로 재설정할 것
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  raw.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i === -1) return;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
  return env;
}

(async () => {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const DEMO_PW = '0000';
  const targets = ['sadmin@dunocare.com', 'admin1@dunocare.com'];

  const hash = await bcrypt.hash(DEMO_PW, 10);

  for (const loginId of targets) {
    const { data, error } = await supabase
      .from('admin_users')
      .update({ password_hash: hash })
      .eq('login_id', loginId)
      .select('login_id, name, tier');
    if (error) { console.error(`${loginId} 실패:`, error); continue; }
    if (!data?.length) { console.log(`${loginId} — 계정 없음`); continue; }
    console.log(`✔ ${data[0].login_id} (${data[0].name}, ${data[0].tier}) → 비밀번호 ${DEMO_PW}`);
  }

  // 활성 세션은 모두 무효화 — 새 비번으로 재로그인 강제
  for (const loginId of targets) {
    const { data: admin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('login_id', loginId)
      .maybeSingle();
    if (admin) {
      await supabase.from('app_sessions').delete().eq('admin_id', admin.id);
    }
  }
  console.log('\n활성 세션 무효화 완료. 데모 시작 시 새로 로그인됩니다.');
})();
