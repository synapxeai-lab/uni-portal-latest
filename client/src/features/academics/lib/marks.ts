/** Labels for the built-in assessment codes; custom names show as typed. */
const CATEGORY_LABELS: Record<string, string> = {
  QUIZ: "Quizzes",
  ASSIGNMENT: "Assignments",
  MID: "Mid Term",
  PROJECT: "Project",
  LAB: "Lab Work",
  PRACTICAL: "Practical",
  FINAL: "Final Term",
};

export const categoryLabel = (type: string) => CATEGORY_LABELS[type] ?? type;

export interface GradeRange {
  grade: string;
  min: number;
  max: number;
}

export const GRADE_LETTERS = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"];
