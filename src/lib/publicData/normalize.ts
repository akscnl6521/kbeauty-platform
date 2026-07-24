/**
 * XML / JSON response normalization for data.go.kr / HIRA payloads.
 */

import type {
  NormalizedPublicDataBody,
  NormalizedPublicDataItem,
  NormalizedPublicDataResponse,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function scalarToItemValue(
  value: unknown,
): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object") {
    const rec = asRecord(value);
    if (!rec) return null;
    // Common XML→JSON wrappers: { _: "text" } or { "#text": "..." }
    const text = firstString(rec._, rec["#text"], rec.$t);
    return text;
  }
  return null;
}

function normalizeItem(raw: unknown): NormalizedPublicDataItem {
  const rec = asRecord(raw);
  if (!rec) return {};
  const out: NormalizedPublicDataItem = {};
  for (const [k, v] of Object.entries(rec)) {
    if (k === "$" || k === "attributes") continue;
    out[k] = scalarToItemValue(v);
  }
  return out;
}

function extractItems(body: Record<string, unknown> | null): unknown[] {
  if (!body) return [];
  const itemsNode = body.items ?? body.item;
  if (Array.isArray(itemsNode)) return itemsNode;
  const itemsRec = asRecord(itemsNode);
  if (!itemsRec) {
    if (itemsNode && typeof itemsNode === "object") return [itemsNode];
    return [];
  }
  const inner = itemsRec.item;
  if (Array.isArray(inner)) return inner;
  if (inner && typeof inner === "object") return [inner];
  // Some payloads put fields directly under items
  if (Object.keys(itemsRec).length > 0 && !("item" in itemsRec)) {
    return [itemsRec];
  }
  return [];
}

function unwrapResponseRoot(parsed: unknown): {
  header: Record<string, unknown> | null;
  body: Record<string, unknown> | null;
} {
  const root = asRecord(parsed);
  if (!root) return { header: null, body: null };
  const response = asRecord(root.response) ?? root;
  const header =
    asRecord(response.header) ??
    asRecord(response.Header) ??
    asRecord(root.header) ??
    null;
  const body =
    asRecord(response.body) ??
    asRecord(response.Body) ??
    asRecord(root.body) ??
    null;
  return { header, body };
}

/**
 * Minimal XML → nested object for data.go.kr style documents.
 * Handles repeated sibling tags as arrays.
 */
export function parseXmlToObject(xml: string): Record<string, unknown> {
  const cleaned = xml
    .replace(/<\?xml[\s\S]*?\?>/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  type Node = { tag: string; children: Array<Node | string>; attrs: Record<string, string> };
  const root: Node = { tag: "#root", children: [], attrs: {} };
  const stack: Node[] = [root];
  const tagRe = /<\/?([A-Za-z_][\w.\-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(cleaned))) {
    if (m[3] != null) {
      const text = m[3].replace(/\s+/g, " ").trim();
      if (text) stack[stack.length - 1]!.children.push(text);
      continue;
    }
    const tag = m[1]!;
    const attrsRaw = m[2] ?? "";
    const isClose = m[0].startsWith("</");
    const selfClosing = /\/>\s*$/.test(m[0]);
    if (isClose) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    const attrRe = /([A-Za-z_][\w.\-]*)\s*=\s*"([^"]*)"/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrsRaw))) {
      attrs[am[1]!] = am[2]!;
    }
    const node: Node = { tag, children: [], attrs };
    stack[stack.length - 1]!.children.push(node);
    if (!selfClosing) stack.push(node);
  }

  function nodeToValue(node: Node): unknown {
    const textParts = node.children.filter((c): c is string => typeof c === "string");
    const childNodes = node.children.filter((c): c is Node => typeof c !== "string");
    if (childNodes.length === 0) {
      return textParts.join("").trim();
    }
    const obj: Record<string, unknown> = {};
    if (Object.keys(node.attrs).length > 0) obj.$ = node.attrs;
    for (const child of childNodes) {
      const val = nodeToValue(child);
      if (child.tag in obj) {
        const prev = obj[child.tag];
        obj[child.tag] = Array.isArray(prev) ? [...prev, val] : [prev, val];
      } else {
        obj[child.tag] = val;
      }
    }
    if (textParts.length > 0) {
      const t = textParts.join("").trim();
      if (t) obj._ = t;
    }
    return obj;
  }

  const out: Record<string, unknown> = {};
  for (const child of root.children) {
    if (typeof child === "string") continue;
    out[child.tag] = nodeToValue(child);
  }
  return out;
}

export function normalizePublicDataPayload(
  rawText: string,
  preferredFormat?: "json" | "xml" | "fixture",
): NormalizedPublicDataResponse {
  const trimmed = rawText.trim();
  let parsed: unknown;
  let format: "json" | "xml" | "fixture" = preferredFormat ?? "json";

  if (preferredFormat === "fixture") {
    parsed = JSON.parse(trimmed);
    format = "fixture";
  } else if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    parsed = JSON.parse(trimmed);
    format = "json";
  } else if (trimmed.startsWith("<")) {
    parsed = parseXmlToObject(trimmed);
    format = "xml";
  } else {
    // Try JSON first, then XML
    try {
      parsed = JSON.parse(trimmed);
      format = "json";
    } catch {
      parsed = parseXmlToObject(trimmed);
      format = "xml";
    }
  }

  const { header, body } = unwrapResponseRoot(parsed);
  const resultCode = firstString(
    header?.resultCode,
    header?.RESULT_CODE,
    header?.code,
  );
  const resultMsg = firstString(
    header?.resultMsg,
    header?.RESULT_MSG,
    header?.msg,
    header?.message,
  );

  const items = extractItems(body).map(normalizeItem);
  const normalizedBody: NormalizedPublicDataBody = {
    items,
    pageNo: toNullableNumber(body?.pageNo ?? body?.pageIndex),
    numOfRows: toNullableNumber(body?.numOfRows ?? body?.numOfRow),
    totalCount: toNullableNumber(body?.totalCount ?? body?.totalCnt),
    rawFormat: format,
  };

  const ok =
    resultCode == null ||
    resultCode === "00" ||
    resultCode === "0" ||
    resultCode.toLowerCase() === "normal" ||
    resultCode.toLowerCase() === "ok";

  return {
    header: { resultCode, resultMsg },
    body: normalizedBody,
    ok: ok && (resultMsg == null || !/SERVICE.?KEY|AUTH|FORBIDDEN|UNAUTHORIZED/i.test(resultMsg)),
  };
}

export function isAuthFailureResponse(
  normalized: NormalizedPublicDataResponse,
): boolean {
  const code = (normalized.header.resultCode ?? "").toLowerCase();
  const msg = (normalized.header.resultMsg ?? "").toLowerCase();
  if (/auth|unauthorized|forbidden|service.?key|invalid.?key|등록되지|인증/.test(msg)) {
    return true;
  }
  if (["01", "03", "99", "unauthorized", "forbidden"].includes(code)) {
    // 01 often = application error; only treat as auth when message hints key issues
    if (code === "01" || code === "03" || code === "99") {
      return /service.?key|auth|key|인증|권한/.test(msg);
    }
    return true;
  }
  return false;
}

export function isRateLimitResponse(
  httpStatus: number | null,
  normalized: NormalizedPublicDataResponse | null,
): boolean {
  if (httpStatus === 429 || httpStatus === 503) return true;
  const msg = (normalized?.header.resultMsg ?? "").toLowerCase();
  return /rate.?limit|too many|초과|트래픽|throttl|limit.?exceed/.test(msg);
}
