/** "B01" → { prefix: "Block", number: "01" } — 표시 전용 (ID는 그대로) */
export function splitBlockCode(code: string): { prefix: string; number: string } {
  const m = /^B(\d+)$/i.exec(code);
  return { prefix: "Block", number: m ? m[1] : code };
}
