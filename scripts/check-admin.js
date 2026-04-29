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

  // app_sessions 컬럼 확인을 위해 dummy insert (롤백)
  console.log('=== app_sessions schema test ===');
  const testRes = await supabase.from('app_sessions').insert({
    user_role: 'admin',
    user_name: '__test__',
    token: '__test_token_will_delete__' + Date.now(),
    expires_at: new Date(Date.now() + 60000).toISOString(),
    admin_tier: 'admin',
  });
  console.log('with admin_tier:', testRes.error || 'OK');

  // cleanup
  await supabase.from('app_sessions').delete().eq('user_name', '__test__');

  // tier 컬럼 확인
  const { data, error } = await supabase
    .from('admin_users')
    .select('login_id, tier, is_super')
    .eq('login_id', 'devad@min.hi')
    .maybeSingle();
  console.log('=== devad@min.hi row ===');
  console.log(data, error);
})();
