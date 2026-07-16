function fmtCount(n: number | null): string {
  return n == null ? "—" : String(n);
}

function fmtRate(n: number | null): string {
  return n == null ? "—" : `${(n * 100).toFixed(0)}%`;
}

export { fmtCount, fmtRate };
