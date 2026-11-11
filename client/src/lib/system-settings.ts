/** The platform's settings row, as returned by GET /api/admin/settings. */
export interface SystemSettings {
  id: string;
  platformName: string;
  academicYear: string;
  sessionTimeoutMinutes: number;
  maxUploadSizeMb: number;
  defaultAllowComments: boolean;
  defaultAllowMaterials: boolean;
  defaultAllowAssignments: boolean;
  notifyNewAssignment: boolean;
  notifyNewMaterial: boolean;
  notifyNewAnnouncement: boolean;
  notifySubmissionReturned: boolean;
  notifyPrivateComment: boolean;
  minPasswordLength: number;
  requirePasswordUppercase: boolean;
  requirePasswordNumber: boolean;
  requirePasswordSymbol: boolean;
  updatedAt: Date;
  updatedById: string | null;
}
