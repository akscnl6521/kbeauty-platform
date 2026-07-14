"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { parseIngredientList } from "@/lib/pipeline/ingredient-normalize";
import { extractKeyIngredientsFromFullList } from "@/lib/catalog/keyIngredients";
import {
  normalizeManualSlug,
  slugifyBrandAndName,
} from "@/lib/admin/productSlug";

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "serum", label: "세럼" },
  { value: "ampoule", label: "앰플" },
  { value: "toner", label: "토너" },
  { value: "cream", label: "크림" },
  { value: "foam_cleanser", label: "거품 클렌저" },
  { value: "essence", label: "에센스" },
  { value: "sunscreen", label: "선크림" },
  { value: "sheet_mask", label: "시트 마스크" },
  { value: "eye_cream", label: "아이크림" },
  { value: "lip_balm", label: "립밤" },
];

const USAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "face", label: "얼굴" },
  { value: "eye", label: "눈가" },
  { value: "lip", label: "입술" },
  { value: "body", label: "바디" },
  { value: "hair", label: "헤어" },
  { value: "multi", label: "여러 부위" },
];

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Props = {
  existingBrands: string[];
};

export function CreateProductForm({ existingBrands }: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brandMode, setBrandMode] = useState<"select" | "custom">(
    existingBrands.length > 0 ? "select" : "custom"
  );
  const [brandSelect, setBrandSelect] = useState(existingBrands[0] ?? "");
  const [brandCustom, setBrandCustom] = useState("");
  const [name, setName] = useState("");
  const [nameKo, setNameKo] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState("serum");
  const [usageArea, setUsageArea] = useState("face");
  const [description, setDescription] = useState("");
  const [officialProductUrl, setOfficialProductUrl] = useState("");
  const [fullIngredientsText, setFullIngredientsText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [slugBusy, setSlugBusy] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugConflictId, setSlugConflictId] = useState<number | null>(null);

  const brand =
    brandMode === "select" ? brandSelect.trim() : brandCustom.trim();

  useEffect(() => {
    if (slugTouched) return;
    setSlug(slugifyBrandAndName(brand, name));
  }, [brand, name, slugTouched]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const ingredientPreview = useMemo(() => {
    const parsed = parseIngredientList(fullIngredientsText);
    const keyHits = extractKeyIngredientsFromFullList(
      parsed.normalized.map((t) => ({
        token: t.token,
        normalizedName: t.normalizedName,
        order: t.order ?? 0,
      }))
    );
    return {
      count: parsed.normalized.length,
      keyNames: keyHits.map((h) => h.tokenFromList),
    };
  }, [fullIngredientsText]);

  useEffect(() => {
    const normalized = normalizeManualSlug(slug);
    if (!normalized) {
      setSlugAvailable(null);
      setSlugConflictId(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSlugBusy(true);
      try {
        const res = await fetch(
          `/api/admin/products/slug-check?slug=${encodeURIComponent(normalized)}`
        );
        const json = (await res.json()) as {
          ok?: boolean;
          data?: {
            available?: boolean;
            existingProductId?: number | null;
          };
        };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setSlugAvailable(null);
          setSlugConflictId(null);
          return;
        }
        setSlugAvailable(json.data?.available ?? null);
        setSlugConflictId(
          json.data?.available ? null : (json.data?.existingProductId ?? null)
        );
      } catch {
        if (!cancelled) {
          setSlugAvailable(null);
          setSlugConflictId(null);
        }
      } finally {
        if (!cancelled) setSlugBusy(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug]);

  function onImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageError(null);
    if (!file) {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImageFile(null);
      setImagePreviewUrl(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImageError("jpeg, png, webp, gif 이미지만 선택할 수 있습니다.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("이미지 크기는 최대 5MB까지 가능합니다.");
      e.target.value = "";
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current || loading) return;

    setError(null);

    if (!brand) {
      setError("브랜드를 선택하거나 입력해 주세요.");
      return;
    }
    if (!name.trim()) {
      setError("제품명을 입력해 주세요.");
      return;
    }
    const finalSlug = normalizeManualSlug(slug) || slugifyBrandAndName(brand, name);
    if (!finalSlug) {
      setError("제품 주소(slug)를 입력해 주세요.");
      return;
    }
    if (slugAvailable === false) {
      setError(
        `이미 사용 중인 제품 주소입니다${
          slugConflictId != null ? ` (제품 ID ${slugConflictId})` : ""
        }. 다른 slug로 바꿔 주세요.`
      );
      return;
    }
    if (ingredientPreview.count === 0) {
      setError("전성분을 쉼표 또는 줄바꿈으로 붙여넣어 주세요.");
      return;
    }
    if (imageError) {
      setError(imageError);
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    const data = new FormData();
    data.set("brand", brand);
    data.set("name", name.trim());
    if (nameKo.trim()) data.set("nameKo", nameKo.trim());
    data.set("slug", finalSlug);
    data.set("category", category);
    data.set("usageArea", usageArea);
    if (description.trim()) data.set("description", description.trim());
    if (officialProductUrl.trim()) {
      data.set("officialProductUrl", officialProductUrl.trim());
    }
    data.set("fullIngredientsText", fullIngredientsText);
    data.set("publishForPreview", "true");
    if (imageFile) data.set("image", imageFile);

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        body: data,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        data?: { productId?: number };
        error?: { message?: string; productId?: number };
      };
      if (!res.ok || !json.ok) {
        setError(
          json.error?.message ||
            (json.error?.productId
              ? `이미 등록된 제품입니다 (ID ${json.error.productId}).`
              : "등록에 실패했습니다.")
        );
        return;
      }
      const id = json.data?.productId;
      if (id == null) {
        setError("등록은 되었지만 제품 ID를 받지 못했습니다.");
        return;
      }
      router.push(`/admin/products/new/complete?id=${id}`);
    } catch {
      setError("네트워크 오류로 등록에 실패했습니다. 입력 내용은 그대로 유지됩니다.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-xl border border-[#E8DFD8] bg-white p-5 sm:p-6"
      noValidate
    >
      <div className="rounded-lg bg-[#F7F1EC] px-3 py-2 text-xs text-gray-700">
        <span className="font-semibold text-[#8B6914]">필수</span> 표시가 있는
        항목만 채우면 등록할 수 있습니다. 나머지 항목은 선택입니다.
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-900">
          브랜드 <span className="text-red-600">*</span>
        </legend>
        {existingBrands.length > 0 ? (
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="brandMode"
                checked={brandMode === "select"}
                onChange={() => setBrandMode("select")}
              />
              기존 브랜드 선택
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="brandMode"
                checked={brandMode === "custom"}
                onChange={() => setBrandMode("custom")}
              />
              새 브랜드 입력
            </label>
          </div>
        ) : null}
        {brandMode === "select" && existingBrands.length > 0 ? (
          <select
            value={brandSelect}
            onChange={(e) => setBrandSelect(e.target.value)}
            className="w-full rounded border border-[#E8DFD8] px-3 py-2 text-sm"
            required
          >
            {existingBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={brandCustom}
            onChange={(e) => setBrandCustom(e.target.value)}
            className="w-full rounded border border-[#E8DFD8] px-3 py-2 text-sm"
            placeholder="예: COSRX"
            required
          />
        )}
      </fieldset>

      <label className="block text-sm">
        <span className="font-medium text-gray-900">
          제품명 <span className="text-red-600">*</span>
        </span>
        <span className="mt-0.5 block text-xs text-gray-500">
          공식 영문/원문 제품명을 권장합니다.
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded border border-[#E8DFD8] px-3 py-2"
          placeholder="Advanced Snail 96 Mucin Power Essence"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-gray-900">제품명 (한국어)</span>
        <span className="mt-0.5 block text-xs text-gray-500">선택</span>
        <input
          value={nameKo}
          onChange={(e) => setNameKo(e.target.value)}
          className="mt-1 w-full rounded border border-[#E8DFD8] px-3 py-2"
          placeholder="어드밴스드 스네일 96 뮤신 파워 에센스"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-gray-900">
          제품 주소 (slug) <span className="text-red-600">*</span>
        </span>
        <span className="mt-0.5 block text-xs text-gray-500">
          제품명 입력 시 자동 생성됩니다. 필요하면 직접 수정할 수 있습니다.
        </span>
        <input
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          onBlur={() => setSlug(normalizeManualSlug(slug))}
          required
          className="mt-1 w-full rounded border border-[#E8DFD8] px-3 py-2 font-mono text-sm"
          placeholder="cosrx-advanced-snail-96-mucin-power-essence"
        />
        <span className="mt-1 block text-xs">
          {slugBusy ? (
            <span className="text-gray-500">중복 확인 중…</span>
          ) : slugAvailable === false ? (
            <span className="text-red-700">
              이미 사용 중인 주소입니다
              {slugConflictId != null ? ` (제품 ID ${slugConflictId})` : ""}.
            </span>
          ) : slugAvailable === true ? (
            <span className="text-emerald-700">사용 가능한 주소입니다.</span>
          ) : (
            <span className="text-gray-500">영문·숫자·하이픈만 사용합니다.</span>
          )}
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-gray-900">
            카테고리 <span className="text-red-600">*</span>
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="mt-1 w-full rounded border border-[#E8DFD8] px-3 py-2"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-900">
            사용 부위 <span className="text-red-600">*</span>
          </span>
          <select
            value={usageArea}
            onChange={(e) => setUsageArea(e.target.value)}
            required
            className="mt-1 w-full rounded border border-[#E8DFD8] px-3 py-2"
          >
            {USAGE_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-gray-900">제품 설명</span>
        <span className="mt-0.5 block text-xs text-gray-500">
          선택 · 과장된 효능 표현은 피해 주세요.
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-[#E8DFD8] px-3 py-2"
          placeholder="공식 제품 설명 요약"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-gray-900">공식 제품 페이지 주소</span>
        <span className="mt-0.5 block text-xs text-gray-500">선택</span>
        <input
          type="url"
          value={officialProductUrl}
          onChange={(e) => setOfficialProductUrl(e.target.value)}
          className="mt-1 w-full rounded border border-[#E8DFD8] px-3 py-2"
          placeholder="https://..."
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-gray-900">
          전성분 <span className="text-red-600">*</span>
        </span>
        <span className="mt-0.5 block text-xs text-gray-500">
          쉼표 또는 줄바꿈으로 붙여넣기
        </span>
        <textarea
          value={fullIngredientsText}
          onChange={(e) => setFullIngredientsText(e.target.value)}
          required
          rows={7}
          className="mt-1 w-full rounded border border-[#E8DFD8] px-3 py-2 font-mono text-xs"
          placeholder={"Water, Glycerin, Niacinamide\n또는 한 줄에 하나씩"}
        />
        <div className="mt-2 rounded-lg border border-[#E8DFD8] bg-[#FAF7F5] px-3 py-2 text-sm text-gray-800">
          <p>
            인식된 전성분{" "}
            <span className="font-semibold tabular-nums">
              {ingredientPreview.count}
            </span>
            개
          </p>
          <p className="mt-1 text-xs text-gray-600">
            등록 전 예상 주요 성분
            {ingredientPreview.keyNames.length === 0
              ? ": 아직 없음"
              : ` (${ingredientPreview.keyNames.length}개)`}
          </p>
          {ingredientPreview.keyNames.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-xs text-gray-800">
              {ingredientPreview.keyNames.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </label>

      <div className="space-y-2 text-sm">
        <p className="font-medium text-gray-900">
          대표 이미지 <span className="text-red-600">*</span>
        </p>
        <p className="text-xs text-gray-500">
          jpeg / png / webp / gif · 최대 5MB · 선택 즉시 미리보기
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onImageChange}
          className="block w-full text-sm"
          required={!imageFile}
        />
        {imageError ? (
          <p className="text-xs text-red-700">{imageError}</p>
        ) : null}
        {imagePreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePreviewUrl}
            alt="선택한 제품 이미지 미리보기"
            className="mt-2 max-h-56 w-full rounded-lg border border-[#E8DFD8] object-contain bg-[#FAF7F5]"
          />
        ) : (
          <p className="text-xs text-gray-500">아직 선택한 이미지가 없습니다.</p>
        )}
      </div>

      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-600" aria-live="polite">
          제품을 등록하는 중입니다. 잠시만 기다려 주세요…
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || slugAvailable === false}
        className="w-full rounded bg-[#8B6914] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {loading ? "등록 중…" : "제품 등록"}
      </button>
    </form>
  );
}
