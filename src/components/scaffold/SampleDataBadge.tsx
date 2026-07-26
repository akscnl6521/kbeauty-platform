/**
 * Scaffold-mode marker: flags a screen/section as using mock data so it can
 * never be mistaken for a real, verified product/clinic/report.
 * Remove only when the section is wired to real, reviewed data.
 */
export function SampleDataBadge({ label = "샘플 데이터" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
      ⚠ {label}
    </span>
  );
}
