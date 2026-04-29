// 목데이터 시드: 팀(기사) 5개 + 매장 11개 + 다양한 일정 (3개월에 걸쳐, 모든 상태 포함)
// 실행: node scripts/seed-mock-data.js
//
// 주의: 이전 달 / 이번 달 / 다음 달의 기존 schedules 는 모두 삭제하고 덮어씁니다.
//
// 2026-04 갱신:
//   - settlement_status 이진(정산대기/정산완료)
//   - owner_invoice / partner_settlement 이진(미발행/발행완료)
//   - prepaid_amount, paid_at 컬럼 채우기
//   - work_result 채우기

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

const TEAMS = [
  { name: '짱구',   contact: '010-1234-5678', address: '서울 송파구',  business_type: 'freelancer', settlement_type: 'simple',   tax_rate: 3.3, duno_fee_rate: 20 },
  { name: '임영민', contact: '010-2345-6789', address: '경기 부천시',  business_type: 'freelancer', settlement_type: 'simple',   tax_rate: 3.3, duno_fee_rate: 15 },
  { name: '나석희', contact: '010-3456-7890', address: '서울 강남구',  business_type: 'business',   settlement_type: 'max_care', vat_rate: 10, agency_fee_rate: 20, tax_rate: 3.3 },
  { name: '문석호', contact: '010-4567-8901', address: '경기 안산시',  business_type: 'freelancer', settlement_type: 'simple',   tax_rate: 3.3, duno_fee_rate: 18 },
  { name: '제이미랩', contact: '010-5678-9012', address: '서울 마포구', business_type: 'business',   settlement_type: 'custom',   vat_rate: 10, agency_fee_rate: 15, duno_fee_rate: 10, tax_rate: 3.3 }, // 복합형 추가
];

const STORES = [
  { name: '컴포즈 만수중앙점',     address: '인천 남동구 만수동',  contact: '032-111-1111' },
  { name: '빽다방 철산역점',       address: '경기 광명시 철산동',  contact: '02-222-2222' },
  { name: '메가 서울은빛초점',     address: '서울 강북구 미아동',  contact: '02-333-3333' },
  { name: '스타벅스 강남점',       address: '서울 강남구 역삼동',  contact: '02-444-4444' },
  { name: '이디야 홍대점',         address: '서울 마포구 서교동',  contact: '02-555-5555' },
  { name: '컴포즈 일동점',         address: '경기 의정부시 일동',  contact: '031-666-6666' },
  { name: '빽다방 옥길호반점',     address: '경기 부천시 옥길동',  contact: '032-777-7777' },
  { name: '청라심곡천점',          address: '인천 서구 청라동',    contact: '032-888-8888' },
  { name: '메가 수락중앙점',       address: '서울 노원구 상계동',  contact: '02-999-9999' },
  { name: '더벤티 부천상일로',     address: '경기 부천시 상동',    contact: '032-101-0101' },
  { name: '오레시피 반찬가게',     address: '서울 송파구 잠실동',  contact: '02-202-0202' },
];

const REQUESTS = [
  '배관 스케일링', '에어컨청소 1대', '에어컨청소 2대', '커피머신 수리',
  '글라인더 수리', '제빙기 청소', '디스펜서 교체', '매장 마감청소',
  '테이블 설치', '수전 교체', '냉장고 점검', '바닥 왁스 시공',
];

const WORK_RESULTS = [
  '정상 완료. 부품 1개 교체.',
  '정상 완료. 추가 사항 없음.',
  '필터 교체 + 청소 완료.',
  '베어링 교체 후 시운전 정상.',
  '실리콘 코킹 재시공 완료.',
  '계측 후 압력 정상 확인.',
  '청소 + 살균 처리 완료.',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function weightedPick(items) {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r < 0) return v;
  }
  return items[items.length - 1][0];
}
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

(async () => {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 범위: 지난 달 1일 ~ 다음 달 말일
  const rangeStart = new Date(year, month - 2, 1);
  const rangeEnd   = new Date(year, month + 1, 0);
  const fromStr = ymd(rangeStart);
  const toStr   = ymd(rangeEnd);

  // ─── 1. 팀 upsert ───
  const { data: existingTeams } = await supabase.from('teams').select('id, name');
  const existingNames = new Set((existingTeams || []).map(t => t.name));
  const teamsToCreate = TEAMS.filter(t => !existingNames.has(t.name));
  if (teamsToCreate.length > 0) {
    const { error } = await supabase.from('teams').insert(teamsToCreate);
    if (error) console.error('팀 생성 실패:', error.message);
    else console.log(`✔ 팀 ${teamsToCreate.length}개 생성`);
  } else {
    console.log('ℹ 팀 이미 존재 (업데이트는 별도 스크립트 필요)');
  }

  // ─── 2. 매장 upsert ───
  const { data: existingStores, error: storeListErr } = await supabase.from('stores').select('id, name');
  if (storeListErr) {
    console.log('ℹ stores 테이블 미적용 — skip');
  } else {
    const existingStoreNames = new Set((existingStores || []).map(s => s.name));
    const storesToCreate = STORES.filter(s => !existingStoreNames.has(s.name));
    if (storesToCreate.length > 0) {
      const { error } = await supabase.from('stores').insert(storesToCreate);
      if (error) console.error('매장 생성 실패:', error.message);
      else console.log(`✔ 매장 ${storesToCreate.length}개 생성`);
    } else {
      console.log('ℹ 매장 이미 존재');
    }
  }

  // ─── 3. 범위 내 기존 일정 삭제 ───
  const { error: delErr } = await supabase
    .from('schedules')
    .delete()
    .gte('date', fromStr)
    .lte('date', toStr);
  if (delErr) console.error('기존 일정 삭제 실패:', delErr.message);
  else console.log(`✔ ${fromStr} ~ ${toStr} 기존 일정 삭제`);

  // ─── 4. 다양한 일정 생성 ───
  const entries = [];
  const totalDays = Math.floor((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1;
  const targetCount = 60;

  for (let i = 0; i < targetCount; i++) {
    const dayOffset = Math.floor(Math.random() * totalDays);
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + dayOffset);
    const dateStr = ymd(d);

    const isMorning = Math.random() < 0.35;
    const hour   = isMorning ? 8 + Math.floor(Math.random() * 4) : 12 + Math.floor(Math.random() * 6);
    const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
    const time   = `${pad(hour)}:${pad(minute)}`;

    // 진행 상태 분포 (현실적 분포)
    const status = weightedPick([
      ['접수', 10],
      ['배정중', 8],
      ['진행중', 15],
      ['진행완료', 25],
      ['일정연기', 3],
      ['취소', 2],
    ]);

    const isCompleted = status === '진행완료';
    const isCanceled  = status === '취소';
    const cost        = [110000, 165000, 220000, 275000, 330000, 440000][Math.floor(Math.random() * 6)];
    const partsCost   = Math.random() < 0.25 ? Math.floor(Math.random() * 50000) + 10000 : 0;
    // 선지급: 5% 확률로 일부 케이스에 선지급 발생 (다인 엑셀처럼)
    const prepaid     = Math.random() < 0.05 ? Math.floor(Math.random() * 1500000) + 100000 : 0;

    // 정산 상태(이진): 진행완료만 정산 진행 가능
    const settlementStatus = isCompleted
      ? weightedPick([['정산대기', 5], ['정산완료', 5]])
      : '정산대기';

    // 송금일: 정산완료 일 때만, 작업일 +3~14일 후
    let paidAt = null;
    if (settlementStatus === '정산완료') {
      const offset = 3 + Math.floor(Math.random() * 12);
      const p = new Date(d);
      p.setDate(p.getDate() + offset);
      paidAt = ymd(p);
    }

    // 계산서(이진): 정산완료 케이스에서만 발행 케이스 발생
    const ownerInvoice = settlementStatus === '정산완료'
      ? weightedPick([['미발행', 3], ['발행완료', 7]])
      : '미발행';
    const partnerSettlement = settlementStatus === '정산완료'
      ? weightedPick([['미발행', 4], ['발행완료', 6]])
      : '미발행';

    // 결제 (4-state: 결제중/결제완료/취소/미결제 — 변경 안 됨)
    const payment = isCompleted
      ? weightedPick([['결제완료', 7], ['결제중', 2], ['미결제', 1]])
      : isCanceled
        ? '취소'
        : weightedPick([['미결제', 5], ['결제중', 2]]);

    // 만족도: 진행완료만 응답 가능
    const satisfaction = isCompleted
      ? weightedPick([['매우만족', 4], ['만족', 5], ['보통', 2], ['불만', 1], ['미응답', 1]])
      : '미응답';

    // 작업결과: 진행완료만 채움
    const workResult = isCompleted ? pick(WORK_RESULTS) : '';

    entries.push({
      date: dateStr,
      store_name: pick(STORES).name,
      request: pick(REQUESTS),
      maintenance_time: time,
      cost,
      personal_parts_cost: partsCost,
      prepaid_amount: prepaid,
      paid_at: paidAt,
      progress_status: status,
      assignee: isCanceled ? '' : pick(TEAMS).name,
      work_result: workResult,
      payment,
      settlement_status: settlementStatus,
      owner_invoice: ownerInvoice,
      partner_settlement: partnerSettlement,
      satisfaction,
      field_manager: '',
      notes: '',
    });
  }

  // 신규 컬럼이 없는 환경 폴백
  let insRes = await supabase.from('schedules').insert(entries, { count: 'exact' });
  if (insRes.error && /column .* does not exist|Could not find/.test(insRes.error.message || '')) {
    console.log('ℹ 일부 컬럼 미적용 — 신규 컬럼 빼고 재시도');
    const minimal = entries.map(({ prepaid_amount, paid_at, work_result, partner_settlement, ...rest }) => rest);
    insRes = await supabase.from('schedules').insert(minimal, { count: 'exact' });
  }
  if (insRes.error) {
    console.error('일정 생성 실패:', insRes.error.message);
    process.exit(1);
  }

  // ─── 5. 통계 ───
  const stats = {
    progress: {},
    settlement: {},
    invoice: {},
    payment: {},
    prepaidCount: 0,
    paidAtCount: 0,
  };
  entries.forEach(e => {
    stats.progress[e.progress_status]   = (stats.progress[e.progress_status] || 0) + 1;
    stats.settlement[e.settlement_status] = (stats.settlement[e.settlement_status] || 0) + 1;
    stats.invoice[e.owner_invoice]       = (stats.invoice[e.owner_invoice] || 0) + 1;
    stats.payment[e.payment]              = (stats.payment[e.payment] || 0) + 1;
    if (e.prepaid_amount > 0) stats.prepaidCount++;
    if (e.paid_at) stats.paidAtCount++;
  });

  console.log(`\n✔ ${fromStr} ~ ${toStr} 일정 ${insRes.count ?? entries.length}건 생성\n`);
  console.log('진행 상태:', Object.entries(stats.progress).map(([k, v]) => `${k}=${v}`).join(', '));
  console.log('정산 상태:', Object.entries(stats.settlement).map(([k, v]) => `${k}=${v}`).join(', '));
  console.log('계산서:    ', Object.entries(stats.invoice).map(([k, v]) => `${k}=${v}`).join(', '));
  console.log('결제:      ', Object.entries(stats.payment).map(([k, v]) => `${k}=${v}`).join(', '));
  console.log(`선지급:     ${stats.prepaidCount}건`);
  console.log(`송금일 기록: ${stats.paidAtCount}건`);
  console.log('\n브라우저에서 일정 관리 / 운영 현황 / 정산 관리 페이지 새로고침하면 표시됩니다.');
})();
