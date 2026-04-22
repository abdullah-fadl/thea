export function computeNewResults(results: Array<{ resultId: string }>, viewedSet: Set<string>) {
  return results.filter((result) => !viewedSet.has(String(result.resultId || '')));
}
