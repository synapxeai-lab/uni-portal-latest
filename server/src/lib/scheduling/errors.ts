export type SchedulingServiceErrorCode = "NOT_FOUND" | "VALIDATION_ERROR" | "INVALID_STATE";

export class SchedulingServiceError extends Error {
  code: SchedulingServiceErrorCode;

  constructor(code: SchedulingServiceErrorCode, message: string) {
    super(message);
    this.name = "SchedulingServiceError";
    this.code = code;
  }
}
