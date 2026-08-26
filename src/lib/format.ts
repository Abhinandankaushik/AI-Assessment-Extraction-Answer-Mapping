export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb % 1 === 0 ? mb : mb.toFixed(mb < 10 ? 1 : 0)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
