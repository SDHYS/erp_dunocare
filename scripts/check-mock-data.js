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

  // schedules 의 store_name / assignee 분포
  const { data: schedules } = await supabase.from('schedules').select('store_name, assignee').limit(500);
  const storeNames = new Set();
  const assignees = new Set();
  schedules?.forEach(s => {
    if (s.store_name) storeNames.add(s.store_name);
    if (s.assignee) assignees.add(s.assignee);
  });

  console.log('=== schedules 에 있는 store_name 목록 ===');
  [...storeNames].sort().forEach(n => console.log('  ' + n));

  console.log('\n=== schedules 에 있는 assignee(팀명) 목록 ===');
  [...assignees].sort().forEach(n => console.log('  ' + n));

  // 카카오 가입한 store/team 확인
  const { data: kakaoStores } = await supabase.from('stores').select('id, name, kakao_id').not('kakao_id', 'is', null);
  const { data: kakaoTeams } = await supabase.from('teams').select('id, name, kakao_id').not('kakao_id', 'is', null);

  console.log('\n=== 카카오로 가입한 매장 ===');
  kakaoStores?.forEach(s => console.log(`  ${s.name} (id=${s.id})`));

  console.log('\n=== 카카오로 가입한 팀 ===');
  kakaoTeams?.forEach(t => console.log(`  ${t.name} (id=${t.id})`));
})();
