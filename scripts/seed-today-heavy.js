// 오늘 날짜에 많은 일정 몰아서 시드 (overflow "+N건" 동작 확인용)
// 실행: node scripts/seed-today-heavy.js

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

  const today = new Date().toISOString().slice(0, 10);

  // 오늘 기존 일정 삭제
  const { error: delErr } = await supabase.from('schedules').delete().eq('date', today);
  if (delErr) console.error('삭제 경고:', delErr.message);

  const TEAMS = ['짱구', '임영민', '나석희', '문석호', '제이미랩'];
  const STORES = [
    '컴포즈 만수중앙점', '빽다방 철산역점', '메가 서울은빛초점',
    '스타벅스 강남점', '이디야 홍대점', '컴포즈 일동점', '메가 수락중앙점'
  ];
  const REQUESTS = ['배관 스케일링', '에어컨청소', '커피머신 수리', '제빙기 청소', '매장 마감청소', '수전 교체', '글라인더 수리'];

  // 오늘 7건 생성 (오전 3 / 오후 4)
  const times = ['09:00', '10:30', '11:45', '13:00', '14:30', '16:00', '17:15'];
  const entries = times.map((time, i) => ({
    date: today,
    store_name: STORES[i],
    request: REQUESTS[i],
    maintenance_time: time,
    cost: 110000 + i * 55000,
    progress_status: ['접수', '배정중', '진행중', '진행완료'][i % 4],
    assignee: TEAMS[i % TEAMS.length],
  }));

  const { error: insErr, count } = await supabase.from('schedules').insert(entries, { count: 'exact' });
  if (insErr) {
    console.error('생성 실패:', insErr.message);
    process.exit(1);
  }
  console.log(`✔ ${today} 에 ${count ?? entries.length}건 생성 (4건 초과 → "+N건" 표시 확인용)`);
})();
