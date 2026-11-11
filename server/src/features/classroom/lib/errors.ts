export type ClassroomErrorCode =
  | "NOT_FOUND"
  | "ARCHIVED"
  | "ALREADY_ENROLLED"
  | "NOT_A_MEMBER"
  | "OWNER_CANNOT_LEAVE"
  | "CANNOT_REMOVE_OWNER"
  | "CANNOT_REMOVE_LAST_TEACHER"
  | "INVALID_ROLE_CHANGE"
  | "FORBIDDEN"
  | "CODE_GENERATION_FAILED"
  | "VALIDATION_ERROR";

export class ClassroomServiceError extends Error {
  constructor(
    public readonly code: ClassroomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClassroomServiceError";
  }
}
