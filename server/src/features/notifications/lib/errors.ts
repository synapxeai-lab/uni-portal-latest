export type NotificationErrorCode = "NOT_FOUND" | "VALIDATION_ERROR";

export class NotificationServiceError extends Error {
  constructor(
    public readonly code: NotificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NotificationServiceError";
  }
}
