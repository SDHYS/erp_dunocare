-- ============================================================
-- 확장 가능한 필드: 매장 추가 장비 + 정비이력 추가 항목
-- JSONB로 자유롭게 키-값 쌍 보관 (기본 고정 필드 외 추가 입력 지원)
-- ============================================================

-- 매장의 추가 장비 (기본 10개 외)
-- 예: [{"name": "와플기계", "detail": "Cuisinart WAF-F20"}, {"name": "핫도그기계", "detail": "LA-100"}]
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS extra_equipments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 정비이력의 추가 항목 (기본 10개 외)
ALTER TABLE store_maintenance_logs
  ADD COLUMN IF NOT EXISTS extra_items JSONB NOT NULL DEFAULT '[]'::jsonb;
