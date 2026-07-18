import type { ReactNode } from "react";

export function JourneyProgress({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 0), safeTotal);
  const pct = Math.round((safeCurrent / safeTotal) * 100);

  return (
    <div className="mb-5" aria-label={label ?? "진행 상태"}>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold tracking-wide text-[var(--accent-warm)]">
        <span>
          {safeCurrent} / {safeTotal}
        </span>
        <span className="tabular-nums text-[var(--text-subtle)]">{pct}%</span>
      </div>
      <div className="kb-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="kb-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="kb-empty" role="status">
      <p className="text-sm font-semibold text-[#2a1c14]">{title}</p>
      {description ? <p className="max-w-sm text-sm leading-6">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function StatusMessage({
  tone = "info",
  children,
}: {
  tone?: "info" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={tone === "error" ? "kb-status-error" : "kb-status-info"}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function SectionLabel({
  children,
  optional,
}: {
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-2">
      <p className="text-sm font-semibold text-gray-900">{children}</p>
      {optional ? (
        <span className="text-[11px] font-medium text-[var(--text-subtle)]">선택</span>
      ) : (
        <span className="text-[11px] font-medium text-[var(--brand)]">필수</span>
      )}
    </div>
  );
}
