/**
 * Colour palette for timetable entries, so each course is easy to pick out at a glance.
 * Class names are written out in full so Tailwind can see them at build time.
 */
export interface CourseColor {
  /** Background, border and hover for a grid cell / list item. */
  surface: string;
  /** Thick left accent stripe. */
  accent: string;
  /** Course title text. */
  title: string;
  /** Small swatch dot. */
  dot: string;
}

const PALETTE: CourseColor[] = [
  {
    surface: "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20",
    accent: "border-l-sky-500",
    title: "text-sky-900 dark:text-sky-100",
    dot: "bg-sky-500",
  },
  {
    surface: "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20",
    accent: "border-l-emerald-500",
    title: "text-emerald-900 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  {
    surface: "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20",
    accent: "border-l-violet-500",
    title: "text-violet-900 dark:text-violet-100",
    dot: "bg-violet-500",
  },
  {
    surface: "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20",
    accent: "border-l-rose-500",
    title: "text-rose-900 dark:text-rose-100",
    dot: "bg-rose-500",
  },
  {
    surface: "border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20",
    accent: "border-l-orange-500",
    title: "text-orange-900 dark:text-orange-100",
    dot: "bg-orange-500",
  },
  {
    surface: "border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20",
    accent: "border-l-teal-500",
    title: "text-teal-900 dark:text-teal-100",
    dot: "bg-teal-500",
  },
  {
    surface: "border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20",
    accent: "border-l-fuchsia-500",
    title: "text-fuchsia-900 dark:text-fuchsia-100",
    dot: "bg-fuchsia-500",
  },
  {
    surface: "border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20",
    accent: "border-l-indigo-500",
    title: "text-indigo-900 dark:text-indigo-100",
    dot: "bg-indigo-500",
  },
  {
    surface: "border-lime-500/30 bg-lime-500/10 hover:bg-lime-500/20",
    accent: "border-l-lime-500",
    title: "text-lime-900 dark:text-lime-100",
    dot: "bg-lime-500",
  },
  {
    surface: "border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20",
    accent: "border-l-cyan-500",
    title: "text-cyan-900 dark:text-cyan-100",
    dot: "bg-cyan-500",
  },
  {
    surface: "border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20",
    accent: "border-l-pink-500",
    title: "text-pink-900 dark:text-pink-100",
    dot: "bg-pink-500",
  },
  {
    surface: "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20",
    accent: "border-l-yellow-500",
    title: "text-yellow-900 dark:text-yellow-100",
    dot: "bg-yellow-500",
  },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Assigns a colour to every course in the list. Courses get distinct colours (in title order)
 * until the palette runs out, after which colours repeat.
 */
export function assignCourseColors(
  courses: { classroomId: string; classroomTitle: string }[],
): Map<string, CourseColor> {
  const unique = new Map<string, string>();
  for (const course of courses) {
    unique.set(course.classroomId, course.classroomTitle);
  }

  const ordered = [...unique.entries()].sort(
    ([idA, titleA], [idB, titleB]) => titleA.localeCompare(titleB) || idA.localeCompare(idB),
  );

  const colors = new Map<string, CourseColor>();
  ordered.forEach(([id], index) => {
    colors.set(id, PALETTE[index % PALETTE.length]);
  });
  return colors;
}

/** Fallback colour for a single course, stable across renders. */
export function courseColorFor(classroomId: string): CourseColor {
  return PALETTE[hashString(classroomId) % PALETTE.length];
}
