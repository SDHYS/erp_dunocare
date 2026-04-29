// 데이터 무결성 종합 검증 + 제이미랩을 custom 타입으로 업데이트
// 실행: node scripts/verify-data-integrity.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

  // 0. 제이미랩을 custom 타입으로 업데이트 (이미 존재하는 경우)
  const { error: updErr } = await supabase
    .from('teams')
    .update({
      settlement_type: 'custom',
      vat_rate: 10,
      agency_fee_rate: 15,
      duno_fee_rate: 10,
      tax_rate: 3.3,
    })
    .eq('name', '제이미랩');
  if (updErr) console.warn('제이미랩 업데이트 경고:', updErr.message);
  else console.log('✔ 제이미랩 → custom (복합형) 정산 타입으로 갱신');

  console.log('\n=== 데이터 무결성 검증 ===\n');

  // 1. teams 검증
  const { data: teams } = await supabase.from('teams').select('id, name, settlement_type, vat_rate, agency_fee_rate, duno_fee_rate, tax_rate').order('name');
  console.log(`✓ teams: ${teams?.length ?? 0}개`);
  const typeDist = {};
  teams?.forEach(t => {
    typeDist[t.settlement_type || 'null'] = (typeDist[t.settlement_type || 'null'] || 0) + 1;
  });
  console.log(`  타입 분포: ${Object.entries(typeDist).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // 2. stores 검증
  const { data: stores } = await supabase.from('stores').select('id, name, kakao_id');
  console.log(`✓ stores: ${stores?.length ?? 0}개 (카카오 가입: ${stores?.filter(s => s.kakao_id).length ?? 0}개)`);

  // 3. admin_users 검증
  const { data: admins } = await supabase.from('admin_users').select('id, login_id, name, tier').order('login_id');
  console.log(`✓ admin_users: ${admins?.length ?? 0}개`);
  admins?.forEach(a => console.log(`    - ${a.login_id} | ${a.name} | tier=${a.tier}`));

  // 4. schedules 검증
  const { data: schedules } = await supabase.from('schedules').select('*');
  console.log(`\n✓ schedules: ${schedules?.length ?? 0}건`);

  const checks = {
    progress: {},
    settlement: {},
    invoice: {},
    payment: {},
    satisfaction: {},
  };
  const issues = [];

  schedules?.forEach(s => {
    checks.progress[s.progress_status]   = (checks.progress[s.progress_status] || 0) + 1;
    checks.settlement[s.settlement_status] = (checks.settlement[s.settlement_status] || 0) + 1;
    checks.invoice[s.owner_invoice]       = (checks.invoice[s.owner_invoice] || 0) + 1;
    checks.payment[s.payment]              = (checks.payment[s.payment] || 0) + 1;
    checks.satisfaction[s.satisfaction]   = (checks.satisfaction[s.satisfaction] || 0) + 1;

    // 비즈니스 룰 검증
    if (!['정산대기', '정산완료'].includes(s.settlement_status)) {
      issues.push(`row ${s.id}: settlement_status=${s.settlement_status} (이진 위반)`);
    }
    if (!['미발행', '발행완료'].includes(s.owner_invoice)) {
      issues.push(`row ${s.id}: owner_invoice=${s.owner_invoice} (이진 위반)`);
    }
    if (!['미발행', '발행완료'].includes(s.partner_settlement)) {
      issues.push(`row ${s.id}: partner_settlement=${s.partner_settlement} (이진 위반)`);
    }
    // 정산완료인데 송금일 없음 → 경고
    if (s.settlement_status === '정산완료' && !s.paid_at) {
      issues.push(`row ${s.id}: 정산완료 인데 paid_at 비어있음`);
    }
    // 정산완료인데 진행완료 아님
    if (s.settlement_status === '정산완료' && s.progress_status !== '진행완료') {
      issues.push(`row ${s.id}: 정산완료 인데 progress=${s.progress_status} (보통 진행완료여야 함)`);
    }
    // 만족도 응답 있는데 진행완료 아님
    if (s.satisfaction !== '미응답' && s.progress_status !== '진행완료') {
      issues.push(`row ${s.id}: 만족도=${s.satisfaction} 인데 progress=${s.progress_status}`);
    }
    // 취소인데 assignee 있음
    if (s.progress_status === '취소' && s.assignee) {
      // 비즈 정책상 OK 일 수도 — 정보용으로만
    }
    // cost 음수
    if (s.cost < 0 || s.personal_parts_cost < 0 || (s.prepaid_amount ?? 0) < 0) {
      issues.push(`row ${s.id}: 음수 금액 발견`);
    }
  });

  console.log(`  진행 상태:  ${Object.entries(checks.progress).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  정산 상태:  ${Object.entries(checks.settlement).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  계산서:     ${Object.entries(checks.invoice).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  결제:       ${Object.entries(checks.payment).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  만족도:     ${Object.entries(checks.satisfaction).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // 신규 컬럼 채워짐 확인
  const prepaidCnt = schedules?.filter(s => (s.prepaid_amount || 0) > 0).length ?? 0;
  const paidAtCnt  = schedules?.filter(s => s.paid_at).length ?? 0;
  console.log(`  선지급 보유:    ${prepaidCnt}건`);
  console.log(`  송금일 기록:    ${paidAtCnt}건`);

  // 5. 외래 무결성: assignee 가 teams.name 에 모두 있는가
  const teamNames = new Set(teams?.map(t => t.name) || []);
  const orphanAssignees = new Set();
  schedules?.forEach(s => {
    if (s.assignee && !teamNames.has(s.assignee)) orphanAssignees.add(s.assignee);
  });
  if (orphanAssignees.size > 0) {
    console.log(`\n⚠ teams 에 없는 assignee 발견: ${[...orphanAssignees].join(', ')}`);
  } else {
    console.log(`\n✓ 모든 assignee 가 teams 테이블에 매칭됨`);
  }

  // 6. 외래 무결성: store_name 이 stores.name 에 모두 있는가 (store role 마스킹 정확성용)
  const storeNames = new Set(stores?.map(s => s.name) || []);
  const orphanStores = new Set();
  schedules?.forEach(s => {
    if (s.store_name && !storeNames.has(s.store_name)) orphanStores.add(s.store_name);
  });
  if (orphanStores.size > 0) {
    console.log(`⚠ stores 에 없는 store_name: ${[...orphanStores].join(', ')}`);
  } else {
    console.log(`✓ 모든 store_name 이 stores 테이블에 매칭됨`);
  }

  // 7. app_sessions 정리 상태
  const { data: sessions } = await supabase.from('app_sessions').select('id, user_role, expires_at');
  const now = new Date();
  const expired = sessions?.filter(s => new Date(s.expires_at) < now).length ?? 0;
  const active  = (sessions?.length ?? 0) - expired;
  console.log(`\n✓ app_sessions: 활성 ${active}건 / 만료 ${expired}건`);

  console.log(`\n==================================================`);
  if (issues.length === 0) {
    console.log('✅ 데이터 무결성 검증 통과');
  } else {
    console.log(`⚠ ${issues.length}개 이슈 발견:`);
    issues.slice(0, 10).forEach(i => console.log(`  - ${i}`));
    if (issues.length > 10) console.log(`  ... 외 ${issues.length - 10}건`);
  }
})();
