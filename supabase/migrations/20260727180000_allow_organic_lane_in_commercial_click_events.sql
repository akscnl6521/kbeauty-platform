-- Staging only: allow `commercial_click_events.lane` to record non-paid lanes.
--
-- 왜 필요한가
-- ------------------------------------------------------------------
-- §38.8 은 «병원 상담 클릭» 과 «병원 리드» 를 지표로 요구한다. 그런데 지금
-- 이 테이블의 lane 은 'affiliate' 와 'sponsored' 두 가지뿐이다.
--
-- 실제 병원 데이터(dermatology_institution_candidates, 1,917행)에는 제휴·광고
-- 관계를 나타내는 컬럼이 아예 없다. 전부 지리 기반 organic 노출이다.
-- 그 클릭을 'affiliate' 로 적으면 **존재하지 않는 상업 관계를 기록하는 것**이고,
-- MASTER_PLAN §39.1(Organic 추천은 광고비·수수료를 입력 변수로 쓰지 않는다)과
-- 정면으로 충돌한다. 수익 대시보드에서도 제휴 매출로 집계돼 버린다.
--
-- 코드 쪽 어휘는 이미 넓다 — src/lib/commercial/commerceLabels.ts 의
-- COMMERCE_LANE_LABELS_KO 에 organic · partner_clinic 이 이미 있다.
-- 좁은 것은 DB CHECK 뿐이다.
--
-- 무엇을 바꾸는가
-- ------------------------------------------------------------------
-- lane 허용값에 'organic' 과 'partner_clinic' 을 추가한다.
--
--   organic        — 유료 관계가 없는 노출·클릭 (지금의 병원 목록 전부)
--   partner_clinic — 실제 제휴 계약이 있는 의료기관 (아직 0건)
--
-- 기존 행은 건드리지 않는다. 컬럼 추가·삭제도 없다. 되돌리려면 CHECK 를
-- 원래대로 되돌리면 되고, 그 전에 새 lane 값을 쓴 행이 있는지 확인해야 한다.
--
-- 적용 후에도 «유료» 와 «무료» 는 계속 분리된다 — 수익 집계는 lane 으로
-- 가르므로, organic 클릭이 제휴 매출에 섞이지 않는다.
--
-- 재실행 안전: 제약을 지우고 다시 만든다.

ALTER TABLE public.commercial_click_events
  DROP CONSTRAINT IF EXISTS commercial_click_events_lane_chk;

ALTER TABLE public.commercial_click_events
  ADD CONSTRAINT commercial_click_events_lane_chk CHECK (
    lane IN ('affiliate', 'sponsored', 'organic', 'partner_clinic')
  );
