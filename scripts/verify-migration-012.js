// Migration 012 적용 검증
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
    {
      name: 'admin_users.tier',
      run: () => supabase.from('admin_users').select('tier').limit(1),
    },
    {
      name: 'app_sessions.admin_tier',
      run: () => supabase.from('app_sessions').select('admin_tier').limit(1),
    },
    {
      name: 'app_sessions.admin_id',
      run: () => supabase.from('app_sessions').select('admin_id').limit(1),
    },
    {
      name: 'schedules.prepaid_amount',
      run: () => supabase.from('schedules').select('prepaid_amount').limit(1),
    },
    {
      name: 'schedules.paid_at',
      run: () => supabase.from('schedules').select('paid_at').limit(1),
    },
    {
      name: 'login_throttle 테이블',
      run: () => supabase.from('login_throttle').select('id').limit(1),
    },
  ];

  console.log('=== Migration 012 검증 ===\n');
  let allOk = true;
  for (const check of checks) {
    const { error } = await check.run();
    if (error) {
      console.log(`❌ ${check.name}: ${error.code || ''} ${error.message}`);
      allOk = false;
    } else {
      console.log(`✓  ${check.name}`);
    }
  }

  console.log('');
  console.log('=== admin_users 의 tier 분포 ===');
  const { data } = await supabase.from('admin_users').select('login_id, name, tier').order('login_id');
  data?.forEach(u => console.log(`  ${u.login_id} | ${u.name} | tier=${u.tier || '(없음)'}`));

  console.log('');
  console.log('=== settlement_status / owner_invoice CHECK 검증 ===');
  // 정산중 / 발행중 row 가 남아있는지 확인
  const { data: oldSettling } = await supabase.from('schedules').select('id').eq('settlement_status', '정산중');
  const { data: oldIssuing } = await supabase.from('schedules').select('id').eq('owner_invoice', '발행중');
  console.log(`  정산중 잔여: ${oldSettling?.length ?? 0}건`);
  console.log(`  발행중 잔여: ${oldIssuing?.length ?? 0}건`);

  console.log('');
  console.log(allOk ? '✅ 모든 컬럼·테이블 적용됨' : '⚠️  일부 항목 누락 — Supabase SQL Editor 에서 migrations/012_security_compliance.sql 재실행 필요');
})();
