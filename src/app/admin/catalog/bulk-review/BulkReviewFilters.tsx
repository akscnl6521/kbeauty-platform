export function BulkReviewFilters({
  brand,
  domain,
  status,
  missing,
}: {
  brand: string;
  domain: string;
  status: string;
  missing: string;
}) {
  return (
    <form
      method="get"
      className="mb-4 grid gap-3 rounded-xl border border-[#E8DFD8] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <label className="text-xs text-gray-600">
        브랜드
        <input
          name="brand"
          defaultValue={brand}
          className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-xs text-gray-600">
        도메인
        <select
          name="domain"
          defaultValue={domain}
          className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
        >
          <option value="">전체</option>
          <option value="face_skincare">face_skincare</option>
          <option value="sun_care">sun_care</option>
          <option value="base_makeup">base_makeup</option>
          <option value="lip_color">lip_color</option>
          <option value="eye_makeup">eye_makeup</option>
          <option value="scalp_care">scalp_care</option>
          <option value="hair_care">hair_care</option>
          <option value="body_care">body_care</option>
          <option value="beauty_tools">beauty_tools</option>
        </select>
      </label>
      <label className="text-xs text-gray-600">
        상태
        <select
          name="status"
          defaultValue={status}
          className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
        >
          <option value="">전체</option>
          <option value="needs_review">needs_review</option>
          <option value="data_complete">data_complete</option>
        </select>
      </label>
      <label className="text-xs text-gray-600">
        누락
        <select
          name="missing"
          defaultValue={missing}
          className="mt-1 w-full rounded border border-[#E8DFD8] px-2 py-1.5 text-sm"
        >
          <option value="">전체</option>
          <option value="inci">전성분 누락</option>
          <option value="image">이미지 누락</option>
          <option value="pdp">공식 PDP 미확인</option>
          <option value="source_conflict">출처 충돌</option>
        </select>
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          className="w-full rounded bg-[#8B4513] px-3 py-2 text-sm font-semibold text-white"
        >
          필터 적용
        </button>
      </div>
    </form>
  );
}
