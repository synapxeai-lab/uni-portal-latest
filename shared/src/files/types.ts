export interface AttachedFileSummary {
  /** The FileAttachment id - what /api/files/:fileAttachmentId keys on, not the underlying File id. */
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  /** False for a pre-storage record with no real bytes behind it - the UI hides Open/Download for these instead of linking to a 404. */
  isAvailable: boolean;
}
