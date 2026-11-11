export type AdminClassroomErrorCode = "NOT_FOUND" | "USER_NOT_FOUND" | "VALIDATION_ERROR";

export class AdminClassroomServiceError extends Error {
  constructor(
    public readonly code: AdminClassroomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminClassroomServiceError";
  }
}
