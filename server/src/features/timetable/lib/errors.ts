export type TimetableErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "SECTION_NOT_SET"
  | "SLOT_TAKEN"
  | "TEACHER_BUSY"
  | "ROOM_TAKEN"
  | "ALREADY_SCHEDULED"
  | "CLASH_NOT_PENDING";

export class TimetableServiceError extends Error {
  constructor(
    public readonly code: TimetableErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TimetableServiceError";
  }
}
