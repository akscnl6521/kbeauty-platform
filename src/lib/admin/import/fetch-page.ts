import "server-only";

import {
  assertPublicHttpsUrlShape,
  assertResolvedPublicHost,
  assertSafePublicHttpsUrl,
} from "@/lib/admin/import/ssrf";

const USER_AGENT =
  "KBeautyMatchBot/1.0 (+https://kbeauty-match.local; admin-discovery-import)";
const MAX_REDIRECTS = 3;
const MAX_BYTES = 1_500_000;
const PER_URL_TIMEOUT_MS = 8_000;

export type FetchPageResult =
  | {
      ok: true;
      finalUrl: string;
      contentType: string;
      html: string;
    }
  | {
      ok: false;
      code:
        | "INVALID_URL"
        | "UNSAFE_URL"
        | "FETCH_TIMEOUT"
        | "FETCH_FAILED"
        | "PAGE_TOO_LARGE";
      message: string;
    };

async function readBodyLimited(
  res: Response,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; code: "PAGE_TOO_LARGE" }> {
  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    return { ok: false, code: "PAGE_TOO_LARGE" };
  }

  if (!res.body) {
    const text = await res.text();
    if (text.length > maxBytes) return { ok: false, code: "PAGE_TOO_LARGE" };
    return { ok: true, text };
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return { ok: false, code: "PAGE_TOO_LARGE" };
    }
    chunks.push(value);
  }

  const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { ok: true, text: merged.toString("utf8") };
}

/**
 * Fetch a public HTTPS HTML page with redirect + SSRF checks.
 */
export async function fetchPublicHtmlPage(
  rawUrl: string,
  options?: { timeoutMs?: number }
): Promise<FetchPageResult> {
  const timeoutMs = options?.timeoutMs ?? PER_URL_TIMEOUT_MS;

  let current = await assertSafePublicHttpsUrl(rawUrl);
  if (!current.ok) {
    return { ok: false, code: current.code, message: current.message };
  }

  let href = current.normalizedHref;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko,en;q=0.8",
        },
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location");
        if (!location) {
          return {
            ok: false,
            code: "FETCH_FAILED",
            message: "리다이렉트 위치를 확인할 수 없습니다.",
          };
        }
        if (redirectCount >= MAX_REDIRECTS) {
          return {
            ok: false,
            code: "FETCH_FAILED",
            message: "리다이렉트가 너무 많습니다.",
          };
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(location, href);
        } catch {
          return {
            ok: false,
            code: "INVALID_URL",
            message: "리다이렉트 URL이 올바르지 않습니다.",
          };
        }

        const shape = assertPublicHttpsUrlShape(nextUrl.href);
        if (!shape.ok) {
          return { ok: false, code: shape.code, message: shape.message };
        }
        const resolved = await assertResolvedPublicHost(shape.url.hostname);
        if (!resolved.ok) {
          return { ok: false, code: resolved.code, message: resolved.message };
        }
        href = shape.normalizedHref;
        continue;
      }

      if (!res.ok) {
        return {
          ok: false,
          code: "FETCH_FAILED",
          message: "페이지를 가져오지 못했습니다.",
        };
      }

      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (
        contentType &&
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml") &&
        !contentType.includes("text/plain")
      ) {
        return {
          ok: false,
          code: "FETCH_FAILED",
          message: "HTML 페이지가 아닙니다.",
        };
      }

      const body = await readBodyLimited(res, MAX_BYTES);
      if (!body.ok) {
        return {
          ok: false,
          code: "PAGE_TOO_LARGE",
          message: "페이지가 너무 큽니다.",
        };
      }

      return {
        ok: true,
        finalUrl: href,
        contentType,
        html: body.text,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          ok: false,
          code: "FETCH_TIMEOUT",
          message: "요청 시간이 초과되었습니다.",
        };
      }
      return {
        ok: false,
        code: "FETCH_FAILED",
        message: "페이지를 가져오지 못했습니다.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    code: "FETCH_FAILED",
    message: "페이지를 가져오지 못했습니다.",
  };
}

export const IMPORT_FETCH_LIMITS = {
  maxRedirects: MAX_REDIRECTS,
  maxBytes: MAX_BYTES,
  perUrlTimeoutMs: PER_URL_TIMEOUT_MS,
  maxBatchUrls: 50,
  maxBatchTimeoutMs: 60_000,
};
