export type AdminUserErrorCode =
  "NOT_FOUND" | "DUPLICATE_EMAIL" | "CANNOT_MODIFY_SELF" | "VALIDATION_ERROR";

export class AdminUserServiceError extends Error {
  constructor(
    public readonly code: AdminUserErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminUserServiceError";
  }
}
