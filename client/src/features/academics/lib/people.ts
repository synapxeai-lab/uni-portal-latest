/**
 * Dropdown labels for people: the name, plus the email when another person in
 * the list has the same name (an imported record and a new one often do), so
 * every option can be told apart.
 */
export function personLabels<T extends { id: number; name: string; email: string }>(people: T[]): Map<number, string> {
  const counts = new Map<string, number>();
  for (const p of people) {
    const key = p.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map(
    people.map((p) => [p.id, (counts.get(p.name.trim().toLowerCase()) ?? 0) > 1 ? `${p.name} (${p.email})` : p.name]),
  );
}
