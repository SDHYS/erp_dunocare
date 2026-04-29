-- ============================================================
-- 매장 장비 필드 확장
-- 엑셀 샘플 분석 결과: 현장에서 자주 다루는 장비 반영
-- ============================================================

-- 기존: coffee_machine, grinder, ice_maker, dispenser, etc (5개)
-- 추가: 온수기, 냉장고, 오븐, 아이스크림기계, 정수기 (5개 더)

ALTER TABLE stores ADD COLUMN IF NOT EXISTS water_heater TEXT DEFAULT '';          -- 온수기
ALTER TABLE stores ADD COLUMN IF NOT EXISTS refrigerator TEXT DEFAULT '';          -- 냉장고 (테이블·입식 포함)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS oven TEXT DEFAULT '';                  -- 오븐
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ice_cream_machine TEXT DEFAULT '';     -- 아이스크림기계
ALTER TABLE stores ADD COLUMN IF NOT EXISTS water_filter TEXT DEFAULT '';          -- 정수기 / 전처리 필터
