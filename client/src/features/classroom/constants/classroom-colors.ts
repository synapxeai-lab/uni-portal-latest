// Deterministic per-classroom accent, so a class always shows the same banner color
// without storing one - hashed from the classroom id. See docs/ui-architecture.md §5.
// Deep, restrained tones that sit alongside the EITHM navy/gold identity - all
// dark enough for the white banner title to stay readable.
const ACCENTS = [
  { key: "navy", bannerClassName: "bg-navy" },
  { key: "teal", bannerClassName: "bg-teal-800" },
  { key: "burgundy", bannerClassName: "bg-rose-900" },
  { key: "royal", bannerClassName: "bg-royal" },
  { key: "forest", bannerClassName: "bg-emerald-900" },
  { key: "slate", bannerClassName: "bg-slate-700" },
  { key: "plum", bannerClassName: "bg-purple-900" },
  { key: "bronze", bannerClassName: "bg-amber-900" },
] as const;

export function getClassroomAccent(classroomId: string) {
  let hash = 0;

  for (let i = 0; i < classroomId.length; i += 1) {
    hash = (hash * 31 + classroomId.charCodeAt(i)) >>> 0;
  }

  return ACCENTS[hash % ACCENTS.length];
}
