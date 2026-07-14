/**
 * Offline checks for product bulk spreadsheet helpers (no DB writes).
 */
import { parseProductBulkSpreadsheet } from "../src/lib/admin/product-bulk/parseSpreadsheet";
import { resolveBulkSlug } from "../src/lib/admin/product-bulk/cells";
import { parseIngredientList } from "../src/lib/pipeline/ingredient-normalize";
import { extractKeyIngredientsFromFullList } from "../src/lib/catalog/keyIngredients";
import * as XLSX from "xlsx";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const csv = Buffer.from(
  [
    "brand,product_name,slug,category,target_areas,full_ingredients,description,image_filename",
    'BrandA,Product One,,serum,face,"Water, Glycerin, Niacinamide",Desc one,a.jpg',
    "BrandB,Product Two,brandb-product-two,cream,face,Water Glycerin,Desc three,",
  ].join("\n"),
  "utf8"
);

const rows = parseProductBulkSpreadsheet(csv, "t.csv");
assert(rows.length === 2, `row count got ${rows.length}`);
assert(
  rows[0].slug === resolveBulkSlug("BrandA", "Product One", ""),
  `auto slug got ${rows[0].slug}`
);
assert(rows[1].slug === "brandb-product-two", "manual slug");

const ingredients = parseIngredientList(rows[0].fullIngredients);
assert(ingredients.normalized.length === 3, "csv ingredient count");
const keys = extractKeyIngredientsFromFullList(
  ingredients.normalized.map((t) => ({
    token: t.token,
    normalizedName: t.normalizedName,
    order: t.order ?? 0,
  }))
);
assert(keys.length >= 2, "key preview");

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  [
    "brand",
    "product_name",
    "slug",
    "category",
    "target_areas",
    "full_ingredients",
    "description",
    "image_filename",
  ],
  [
    "XLSBrand",
    "X Product",
    "",
    "serum",
    "face,eye",
    "Water, Panthenol",
    "xlsx row",
    "x.png",
  ],
]);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
const xlsxBuf = Buffer.from(
  XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
);
const xrows = parseProductBulkSpreadsheet(xlsxBuf, "t.xlsx");
assert(xrows.length === 1, "xlsx rows");
assert(xrows[0].targetAreas.includes("face"), "target areas");
assert(xrows[0].slug.includes("xlsbrand"), "xlsx auto slug");

console.log(
  JSON.stringify({
    ok: true,
    csvRows: rows.length,
    xlsxRows: xrows.length,
    firstSlug: rows[0].slug,
    keyCount: keys.length,
  })
);
