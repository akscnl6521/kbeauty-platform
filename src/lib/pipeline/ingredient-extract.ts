/**
 * Extract official full-ingredients text from HTML (no script execution).
 */

import { createHash } from "node:crypto";

const SECTION_LABELS =
  /(full\s*)?ingredients?|ingredient\s*list|inci|전성분|성분표|성분|配合成分|全成分/i;

export type IngredientExtraction = {
  fullIngredientsText: string | null;
  keyIngredients: string[];
  method: string;
  confidence: number;
  rawHash: string | null;
  reasons: string[];
};

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function cleanIngredientBlob(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim()
    .slice(0, 8000);
}

/**
 * Pull ingredients from JSON-LD Product additionalProperty / description patterns.
 */
function fromJsonLd(html: string): string | null {
  const scripts = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!scripts) return null;
  for (const block of scripts) {
    const raw = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    try {
      const data = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const obj = node as Record<string, unknown>;
        const props = obj.additionalProperty;
        if (Array.isArray(props)) {
          for (const p of props) {
            if (!p || typeof p !== "object") continue;
            const prop = p as Record<string, unknown>;
            const name = String(prop.name ?? "");
            if (SECTION_LABELS.test(name) && typeof prop.value === "string") {
              const v = cleanIngredientBlob(prop.value);
              if (v.length > 20) return v;
            }
          }
        }
      }
    } catch {
      /* ignore bad json-ld */
    }
  }
  return null;
}

/**
 * Heuristic: label followed by a paragraph / list of comma-separated INCI-like text.
 */
function fromLabeledSections(html: string): string | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!SECTION_LABELS.test(line) || line.length > 80) continue;
    const chunk: string[] = [];
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      const next = lines[j]!;
      if (SECTION_LABELS.test(next) && next.length < 40) break;
      if (/^(how to|usage|directions|주의|사용법)/i.test(next)) break;
      chunk.push(next);
      const joined = chunk.join(" ");
      if ((joined.match(/,/g) ?? []).length >= 4 || joined.length > 180) {
        return cleanIngredientBlob(joined);
      }
    }
  }
  return null;
}

export function extractIngredientsFromHtml(html: string): IngredientExtraction {
  const reasons: string[] = [];
  let full: string | null = fromJsonLd(html);
  let method = "none";
  let confidence = 0;

  if (full) {
    method = "jsonld_additionalProperty";
    confidence = 0.85;
    reasons.push("JSON-LD additionalProperty");
  } else {
    full = fromLabeledSections(html);
    if (full) {
      method = "html_labeled_section";
      confidence = 0.7;
      reasons.push("labeled ingredients section");
    }
  }

  // Key ingredients: short list near "key ingredients" — never invent
  const keyIngredients: string[] = [];
  const keyMatch = html.match(
    /key\s*ingredients?[^<]{0,40}<\/[^>]+>([\s\S]{0,500}?)<\//i
  );
  if (keyMatch?.[1]) {
    const blob = cleanIngredientBlob(keyMatch[1].replace(/<[^>]+>/g, " "));
    for (const part of blob.split(/[,;]/)) {
      const t = part.trim();
      if (t.length > 2 && t.length < 60) keyIngredients.push(t);
      if (keyIngredients.length >= 8) break;
    }
  }

  return {
    fullIngredientsText: full,
    keyIngredients,
    method,
    confidence,
    rawHash: full ? hashText(full) : null,
    reasons: full ? reasons : ["전성분 섹션 미검출"],
  };
}
