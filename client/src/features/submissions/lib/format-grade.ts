export function formatGrade(grade: number | null, maxPoints: number | null): string {
  if (grade === null || maxPoints === null) {
    return "Not graded";
  }

  const percentage = maxPoints > 0 ? Math.round((grade / maxPoints) * 100) : 0;
  return `${grade}/${maxPoints} (${percentage}%)`;
}

export function computeGradePercentage(
  grade: number | null,
  maxPoints: number | null,
): number | null {
  if (grade === null || maxPoints === null || maxPoints <= 0) {
    return null;
  }

  return Math.round((grade / maxPoints) * 100);
}
