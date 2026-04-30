export function mergeById<T extends { id: string }>(...groups: T[][]): T[] {
  return Array.from(new Map(groups.flat().map(item => [item.id, item])).values());
}
