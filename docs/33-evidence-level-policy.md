# docs/33-evidence-level-policy.md — 성분 근거 수준 정책

최종 갱신: 2026-07-13  
상태: **운영 정책 (설계)**  
저장 테이블: `ingredient_evidence` (`docs/31-search-to-verified-data-model.md`)

---

## 1. 목적

성분과 피부 고민 사이의 **논문·가이드라인 근거**를 저장·표시하는 기준을 정의한다.

- 제품 전체 효능을 단정하지 않는다.  
- 논문 1건으로 추천을 확정하지 않는다.  
- `evidence_level`(근거 강도)과 `review_status`(관리자 검토)를 **분리**한다.  
- 의약품 연구와 화장품 연구를 **구분**한다.

---

## 2. evidence_level 값

권장 enum (text CHECK 후보):

| level | 코드 | 설명 |
|-------|------|------|
| 1 (높음) | `systematic_review` | 체계적 문헌고찰 / 메타분석 |
| 2 | `randomized_controlled_trial` | 무작위 대조 시험 (RCT) |
| 3 | `controlled_clinical_study` | 대조가 있는 임상·인체적용시험 (비무작위 포함) |
| 4 | `observational_study` | 관찰 연구·코호트·환자-대조 |
| 5 | `in_vitro` | 시험관·세포·조직 실험 |
| 6 | `expert_guideline` | 학회·규제·전문가 가이드라인 |
| 7 (낮음) | `manufacturer_claim` | 제조사·마케팅 클레임 (단독 근거 불가) |

보조 필드:

- `evidence_type`: `cosmetic_study` | `drug_study` | `guideline` | `claim`  
- `review_status`: `pending` | `approved` | `rejected` | `needs_review`  
- `conflict_of_interest`: `none` | `disclosed` | `unknown` | `high`

---

## 3. 높은 근거 vs 낮은 근거

### 상대적으로 높은 근거

- systematic_review  
- RCT (인체, 관련 고민·제형에 가까운 경우)  
- 잘 설계된 controlled clinical study  
- 독립적 expert guideline  

**조건**: 대상 인구·농도·제형·사용 기간이 화장품 사용 맥락과 비교 가능해야 한다.

### 상대적으로 낮은 근거

- observational_study (교란 요인 큼)  
- in_vitro (임상 효과로 직접 번역 금지)  
- manufacturer_claim  
- 동물 실험만 있는 경우 (별도 표기, 인체 효과 단정 금지)  
- 이해상충 `high`이면서 독립 재현 없는 단일 연구  

---

## 4. 의약품 연구 vs 화장품 연구

| 구분 | evidence_type | 운영 규칙 |
|------|---------------|-----------|
| 의약품·처방 농도 연구 | `drug_study` | 화장품 농도/제형과 다르면 **직접 효능 주장 금지**. “의약품 연구에서 보고됨” 수준으로만 표시 |
| 화장품·화장품 원료 인체적용 | `cosmetic_study` | 농도·제형·기간을 기록 후 성분–고민 근거로 사용 |
| 가이드라인 | `guideline` | 의료 경계·주의에 우선 활용 |
| 제조사 클레임 | `claim` | evidence_level=`manufacturer_claim`, 단독으로 추천 근거 불가 |

홍조·심한 염증·통증·진물·지속 악화 등 **medical_boundary** 해당 고민은 제품 추천보다 전문가 상담 분기를 우선한다 (`skin_concerns.medical_boundary`).

---

## 5. 농도·제형·기간 차이 처리

저장 필수(가능하면):

- `concentration`  
- `formulation`  
- `usage_frequency`  
- `study_duration`  
- `population`  

평가 규칙:

1. 연구 농도가 제품 표기 농도와 크게 다르면 **근거 적용 범위를 축소**하거나 `needs_review`.  
2. 경구·주사 제형을 국소 화장품에 그대로 적용하지 않는다.  
3. 단기 연구 결과를 장기 효과로 확장하지 않는다.  
4. 단일 성분 연구를 복합 전성분 제품 전체 효과로 확장하지 않는다.  
5. 사용 부위가 다르면(예: 전신 vs 안면) 적용 제한을 `outcome_summary`에 명시한다.

---

## 6. 이해상충 (conflict of interest)

| 값 | 의미 | 표시 |
|----|------|------|
| none | 명시적 이해상충 없음 | 정상 |
| disclosed | 공개된 후원·이해관계 | 사용자/관리자에 표시 |
| unknown | 확인 불가 | 낮은 신뢰로 취급 |
| high | 제조사 직접 후원·비공개 등 고위험 | 단독 근거로 승인 금지 권장 |

`conflict_of_interest = high` + 독립 재현 없음 → `review_status`는 approved 지양, needs_review 또는 rejected.

---

## 7. 저장 메타데이터 (필수에 가깝게)

`ingredient_evidence`에 함께 둔다:

- PMID 또는 DOI (최소 하나 권장; claim은 URL)  
- study_design / evidence_level  
- population, concentration, formulation, study_duration  
- outcome_summary (과장 없는 요약)  
- conflict_of_interest  
- reviewed_at, review_status  
- source_url  

레거시 `ingredients.paper_1_*`는 UI 호환용. **정본은 ingredient_evidence**.

---

## 8. 추천 엔진과의 경계

1. Evidence는 **성분–고민 매칭 힌트**이지 제품 점수 확정이 아니다.  
2. `review_status != approved`인 evidence는 추천 근거로 쓰지 않는다.  
3. `manufacturer_claim`만 있는 성분은 핵심 효능 문구에 사용하지 않는다.  
4. 제품 published 게이트는 판매·전성분·안전·관리자 승인이 우선이며, evidence는 그 다음이다.  
5. 가짜 PMID/DOI·존재하지 않는 논문 생성 금지.

---

## 9. 관리자 검토 체크리스트 (요약)

- [ ] 의약품/화장품 구분 표기  
- [ ] 농도·제형·기간 기록  
- [ ] 고민(code)과 outcome 일치  
- [ ] COI 확인  
- [ ] PMID/DOI 또는 공식 URL 실재  
- [ ] 제품 전체 효능 문장으로 오용되지 않음  
- [ ] evidence_level과 review_status 각각 설정
