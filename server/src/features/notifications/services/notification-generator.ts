import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/generated/prisma/enums";
import {
  ClassroomMembershipRole,
  ClassroomMembershipStatus,
  UserRole,
} from "@/generated/prisma/enums";

/**
 * Centralized write-side of the notifications feature - every notification
 * created anywhere in the app goes through here, never through an ad-hoc
 * prisma.notification.create in some other feature's service. Each exported
 * function corresponds to exactly one application event and is safe to call
 * fire-and-forget: failures are swallowed (logged, not thrown) so a
 * notification hiccup never breaks the primary action that triggered it.
 */

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  /** Only for notifications about one classroom's stream - lets them be
   * auto-marked read while the recipient has that stream open. */
  classroomId?: string;
}

const ADMIN_ONLY_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.CLASS_CREATED,
  NotificationType.CLASS_ARCHIVED,
  NotificationType.TIMESLOT_CLASH,
];

/**
 * Validates every recipient actually exists before writing - a stale or
 * bogus id in the input list is silently dropped rather than inserted.
 *
 * Also the single authoritative place admins are excluded from every
 * notification type except CLASS_CREATED/CLASS_ARCHIVED - individual
 * generator functions below don't need their own admin-awareness (and can't
 * accidentally forget it), since every write funnels through here regardless
 * of how its recipient list was built (membership query, a single hardcoded
 * id, whatever).
 */
async function createNotificationsForRecipients(
  recipientIds: string[],
  payload: NotificationPayload,
): Promise<void> {
  const uniqueIds = Array.from(new Set(recipientIds));
  if (uniqueIds.length === 0) {
    return;
  }

  const isAdminOnlyType = ADMIN_ONLY_NOTIFICATION_TYPES.includes(payload.type);

  const validUsers = await prisma.user.findMany({
    where: {
      id: { in: uniqueIds },
      ...(isAdminOnlyType ? {} : { role: { not: UserRole.ADMIN } }),
    },
    select: { id: true },
  });

  if (validUsers.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: validUsers.map((recipient) => ({
      recipientId: recipient.id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link,
      classroomId: payload.classroomId,
    })),
  });
}

/**
 * Admins are auto-enrolled as a co-teacher on every classroom (see
 * classroom-service.ts's createClassroom), which would otherwise make them
 * "just another manager" here and pull them into every announcement/
 * assignment/material/private-comment/member-joined notification for every
 * classroom on the platform. Admins only ever get CLASS_CREATED/
 * CLASS_ARCHIVED (see notifyClassroomCreated/notifyClassroomArchived below) -
 * excluded here, once, rather than patched into every caller below.
 */
async function getActiveMemberIds(
  classroomId: string,
  options?: { excludeUserIds?: string[]; managersOnly?: boolean; studentsOnly?: boolean },
): Promise<string[]> {
  const memberships = await prisma.classroomMembership.findMany({
    where: {
      classroomId,
      status: ClassroomMembershipStatus.ACTIVE,
      user: { role: { not: UserRole.ADMIN } },
      ...(options?.managersOnly
        ? {
            role: {
              in: [
                ClassroomMembershipRole.OWNER,
                ClassroomMembershipRole.TEACHER,
                ClassroomMembershipRole.CO_TEACHER,
              ],
            },
          }
        : {}),
      ...(options?.studentsOnly ? { role: ClassroomMembershipRole.STUDENT } : {}),
    },
    select: { userId: true },
  });

  const exclude = new Set(options?.excludeUserIds ?? []);
  return memberships.map((m) => m.userId).filter((id) => !exclude.has(id));
}

/** All current platform admins - the recipient set for CLASS_CREATED/CLASS_ARCHIVED. */
async function getAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  });
  return admins.map((admin) => admin.id);
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** Fires when a new announcement is posted (announcements are always created
 * as published - there is no separate publish step for this entity). */
export async function notifyAnnouncementPublished(params: {
  classroomId: string;
  classroomTitle: string;
  authorId: string;
  announcementId: string;
  announcementContent: string;
}): Promise<void> {
  try {
    const recipientIds = await getActiveMemberIds(params.classroomId, {
      excludeUserIds: [params.authorId],
    });
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.NEW_ANNOUNCEMENT,
      title: `New announcement in ${params.classroomTitle}`,
      message: truncate(params.announcementContent, 140),
      link: announcementLink(params.classroomId, params.announcementId),
      classroomId: params.classroomId,
    });
  } catch (error) {
    console.error("notifyAnnouncementPublished failed:", error);
  }
}

/** Fires when someone comments under an announcement - to every manager
 * (owner/teacher/co-teacher) of the classroom except the commenter. Students
 * are never notified about class comments, only about new announcements. */
export async function notifyClassComment(params: {
  classroomId: string;
  classroomTitle: string;
  announcementId: string;
  announcementTitle: string;
  authorId: string;
  authorName: string;
  commentContent: string;
}): Promise<void> {
  try {
    const recipientIds = await getActiveMemberIds(params.classroomId, {
      managersOnly: true,
      excludeUserIds: [params.authorId],
    });
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.CLASS_COMMENT,
      title: `${params.authorName} commented in ${params.classroomTitle}`,
      message: `On "${truncate(params.announcementTitle, 60)}": ${truncate(params.commentContent, 140)}`,
      link: announcementLink(params.classroomId, params.announcementId),
      classroomId: params.classroomId,
    });
  } catch (error) {
    console.error("notifyClassComment failed:", error);
  }
}

/** Deep link to one post on the stream - the card carries a matching element id. */
function announcementLink(classroomId: string, announcementId: string): string {
  return `/classes/${classroomId}/stream#announcement-${announcementId}`;
}

/** Fires when an assignment becomes visible to the classroom - whether
 * created directly as published or transitioned from draft afterward. Those
 * two paths are mutually exclusive for a given assignment, so there's no
 * risk of a duplicate notification from both. */
export async function notifyAssignmentPublished(params: {
  classroomId: string;
  classroomTitle: string;
  authorId: string;
  assignmentId: string;
  assignmentTitle: string;
}): Promise<void> {
  try {
    const recipientIds = await getActiveMemberIds(params.classroomId, {
      excludeUserIds: [params.authorId],
    });
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.NEW_ASSIGNMENT,
      title: `New assignment in ${params.classroomTitle}`,
      message: `"${params.assignmentTitle}" was just posted.`,
      link: `/classes/${params.classroomId}/classwork/${params.assignmentId}`,
    });
  } catch (error) {
    console.error("notifyAssignmentPublished failed:", error);
  }
}

/** Fires when a material becomes visible to the classroom - mirrors notifyAssignmentPublished. */
export async function notifyMaterialPublished(params: {
  classroomId: string;
  classroomTitle: string;
  authorId: string;
  materialTitle: string;
}): Promise<void> {
  try {
    const recipientIds = await getActiveMemberIds(params.classroomId, {
      excludeUserIds: [params.authorId],
    });
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.NEW_MATERIAL,
      title: `New material in ${params.classroomTitle}`,
      message: `"${params.materialTitle}" was just posted.`,
      link: `/classes/${params.classroomId}/classwork`,
    });
  } catch (error) {
    console.error("notifyMaterialPublished failed:", error);
  }
}

/** Fires when a teacher saves a grade - grading is final and the student sees it straight away. */
export async function notifySubmissionGraded(params: {
  studentId: string;
  classroomId: string;
  assignmentId: string;
  assignmentTitle: string;
  regraded: boolean;
}): Promise<void> {
  try {
    await createNotificationsForRecipients([params.studentId], {
      type: NotificationType.SUBMISSION_RETURNED,
      title: params.regraded ? "Your grade was updated" : "Your assignment was graded",
      message: params.regraded
        ? `Your grade for "${params.assignmentTitle}" was changed.`
        : `"${params.assignmentTitle}" was graded.`,
      link: `/classes/${params.classroomId}/classwork/${params.assignmentId}`,
    });
  } catch (error) {
    console.error("notifySubmissionGraded failed:", error);
  }
}

/** Fires when a teacher returns work for revision: the student has to improve it and turn it in again. */
export async function notifySubmissionReturned(params: {
  studentId: string;
  classroomId: string;
  assignmentId: string;
  assignmentTitle: string;
}): Promise<void> {
  try {
    await createNotificationsForRecipients([params.studentId], {
      type: NotificationType.SUBMISSION_RETURNED,
      title: "Your work needs revision",
      message: `Your teacher returned "${params.assignmentTitle}" - revise it and turn it in again.`,
      // The assignment detail page is where a student sees both their
      // submission and (once returned) their grade and feedback - there's no
      // separate "my submission" route to link to instead.
      link: `/classes/${params.classroomId}/classwork/${params.assignmentId}`,
    });
  } catch (error) {
    console.error("notifySubmissionReturned failed:", error);
  }
}

/** Fires when a private comment is posted on a submission - to the student if
 * a teacher wrote it, or to every manager of the classroom if the student
 * wrote it (excluding the author either way, so nobody is notified of their
 * own comment). */
export async function notifyPrivateComment(params: {
  classroomId: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  authorId: string;
  authorIsTeacher: boolean;
}): Promise<void> {
  try {
    const recipientIds = params.authorIsTeacher
      ? [params.studentId]
      : await getActiveMemberIds(params.classroomId, {
          managersOnly: true,
          excludeUserIds: [params.authorId],
        });

    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.PRIVATE_COMMENT,
      title: "New private comment",
      message: `You have a new private comment on "${params.assignmentTitle}".`,
      link: `/classes/${params.classroomId}/classwork/${params.assignmentId}`,
    });
  } catch (error) {
    console.error("notifyPrivateComment failed:", error);
  }
}

/** Fires once per invitation, to the specific teacher who sent it - gated on
 * the invitation transitioning out of PENDING, so it can never double-fire
 * for the same invitation. */
export async function notifyInvitationAccepted(params: {
  inviterId: string;
  classroomId: string;
  memberName: string;
  classroomTitle: string;
}): Promise<void> {
  try {
    await createNotificationsForRecipients([params.inviterId], {
      type: NotificationType.GENERAL,
      title: "Invitation accepted",
      message: `${params.memberName} accepted your invitation to join ${params.classroomTitle}.`,
      link: `/classes/${params.classroomId}/people`,
    });
  } catch (error) {
    console.error("notifyInvitationAccepted failed:", error);
  }
}

/** Fires once, to the specific invited user - only when the invite matched an
 * existing registered account (inviteMember leaves inviteeUserId null for an
 * unregistered email, since there's nobody to notify yet). There's no
 * accept-invite page, so the link lands on /classes with the join code
 * pre-filled - see classes-page-actions.tsx's ?code= handling. */
export async function notifyInvited(params: {
  inviteeUserId: string;
  classroomId: string;
  classroomTitle: string;
  classroomCode: string;
  inviterName: string;
}): Promise<void> {
  try {
    await createNotificationsForRecipients([params.inviteeUserId], {
      type: NotificationType.GENERAL,
      title: "You're invited to join a class",
      message: `${params.inviterName} invited you to join ${params.classroomTitle}. Use class code ${params.classroomCode} to join.`,
      link: `/classes?code=${params.classroomCode}`,
    });
  } catch (error) {
    console.error("notifyInvited failed:", error);
  }
}

/** Fires to every manager (owner/teacher/co-teacher) of the classroom except
 * whoever is already excluded - callers exclude the joining user themselves
 * and, when the join matched a pending invitation, the specific inviter
 * (who already receives the more specific "invitation accepted" notice
 * instead, avoiding a near-duplicate for the same event). */
export async function notifyMemberJoined(params: {
  classroomId: string;
  classroomTitle: string;
  memberName: string;
  excludeUserIds: string[];
}): Promise<void> {
  try {
    const recipientIds = await getActiveMemberIds(params.classroomId, {
      managersOnly: true,
      excludeUserIds: params.excludeUserIds,
    });
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.GENERAL,
      title: "New member joined",
      message: `${params.memberName} joined ${params.classroomTitle}.`,
      link: `/classes/${params.classroomId}/people`,
    });
  } catch (error) {
    console.error("notifyMemberJoined failed:", error);
  }
}

/**
 * The only two events admins are ever notified about (see
 * createNotificationsForRecipients's ADMIN_ONLY_NOTIFICATION_TYPES guard,
 * which is what actually enforces that - not this recipient list, which is
 * "every admin" regardless of type). Fires to every platform admin,
 * including whichever admin performed the action themselves - consistent
 * with how every other classroom-event notification doesn't special-case
 * "except when I did it myself" for a platform-wide audience.
 */
export async function notifyClassroomCreated(params: {
  classroomId: string;
  classroomTitle: string;
  creatorName: string;
}): Promise<void> {
  try {
    const recipientIds = await getAdminIds();
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.CLASS_CREATED,
      title: "Class created",
      message: `${params.creatorName} created ${params.classroomTitle}.`,
      link: `/classes/${params.classroomId}/stream`,
    });
  } catch (error) {
    console.error("notifyClassroomCreated failed:", error);
  }
}

export async function notifyClassroomArchived(params: {
  classroomId: string;
  classroomTitle: string;
  archivedByName: string;
}): Promise<void> {
  try {
    const recipientIds = await getAdminIds();
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.CLASS_ARCHIVED,
      title: "Class archived",
      message: `${params.archivedByName} archived ${params.classroomTitle}.`,
      link: `/classes/${params.classroomId}/stream`,
    });
  } catch (error) {
    console.error("notifyClassroomArchived failed:", error);
  }
}

/**
 * Timetable events. Students of the classroom are the audience for anything
 * about when their class meets; teachers only hear about the admin's clash
 * resolution (they made the booking themselves); admins only hear about clashes.
 * `slotLabel` is always a ready-formatted "Mon, Oct 14, 2026, 10:00 AM - 11:00 AM"
 * string so every notification states the actual timeslot.
 */
export async function notifyTimeslotScheduled(params: {
  classroomId: string;
  classroomTitle: string;
  teacherId: string;
  slotLabel: string;
  room: string;
  scheduledByAdmin?: boolean;
}): Promise<void> {
  try {
    const recipientIds = await getActiveMemberIds(params.classroomId, {
      studentsOnly: true,
      excludeUserIds: [params.teacherId],
    });
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.TIMESLOT_SCHEDULED,
      title: `Added to your timetable: ${params.classroomTitle}`,
      message: params.scheduledByAdmin
        ? `${params.classroomTitle} has been scheduled by the admin for ${params.slotLabel} in Room ${params.room}.`
        : `${params.classroomTitle} is scheduled for ${params.slotLabel} in Room ${params.room}.`,
      link: "/timetable",
    });
  } catch (error) {
    console.error("notifyTimeslotScheduled failed:", error);
  }
}

export async function notifyTimeslotUpdated(params: {
  classroomId: string;
  classroomTitle: string;
  teacherId: string;
  oldSlotLabel: string;
  oldRoom: string;
  newSlotLabel: string;
  newRoom: string;
}): Promise<void> {
  try {
    const recipientIds = await getActiveMemberIds(params.classroomId, {
      studentsOnly: true,
      excludeUserIds: [params.teacherId],
    });
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.TIMESLOT_UPDATED,
      title: `Timetable changed: ${params.classroomTitle}`,
      message: `${params.classroomTitle} moved from ${params.oldSlotLabel} (Room ${params.oldRoom}) to ${params.newSlotLabel} (Room ${params.newRoom}).`,
      link: "/timetable",
    });
  } catch (error) {
    console.error("notifyTimeslotUpdated failed:", error);
  }
}

export async function notifyTimeslotCancelled(params: {
  classroomId: string;
  classroomTitle: string;
  teacherId: string;
  slotLabel: string;
  room: string;
}): Promise<void> {
  try {
    const recipientIds = await getActiveMemberIds(params.classroomId, {
      studentsOnly: true,
      excludeUserIds: [params.teacherId],
    });
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.TIMESLOT_CANCELLED,
      title: `Removed from your timetable: ${params.classroomTitle}`,
      message: `${params.classroomTitle} (${params.slotLabel}, Room ${params.room}) has been removed from the weekly timetable.`,
      link: "/timetable",
    });
  } catch (error) {
    console.error("notifyTimeslotCancelled failed:", error);
  }
}

/** To every admin: a teacher asked for a slot the section already has a class in. */
export async function notifyTimeslotClash(params: {
  clashId: string;
  classroomTitle: string;
  section: string;
  teacherName: string;
  slotLabel: string;
  room: string;
  kind: "SECTION" | "ROOM";
  conflictingClassroomTitle: string | null;
  /** Set for a reschedule request: where the class is booked right now. */
  movingFrom?: string;
}): Promise<void> {
  try {
    const recipientIds = await getAdminIds();
    const other = params.conflictingClassroomTitle ?? "another class";
    const against =
      params.kind === "ROOM"
        ? ` Room ${params.room} is already in use by ${other} then.`
        : ` Section ${params.section} already has ${other} then.`;
    await createNotificationsForRecipients(recipientIds, {
      type: NotificationType.TIMESLOT_CLASH,
      title: "Timetable clash",
      message: params.movingFrom
        ? `${params.teacherName} tried to move ${params.classroomTitle} from ${params.movingFrom} to ${params.slotLabel} in Room ${params.room}.${against}`
        : `${params.teacherName} tried to schedule ${params.classroomTitle} for ${params.slotLabel} in Room ${params.room}.${against}`,
      link: `/admin/timetable?clash=${params.clashId}`,
    });
  } catch (error) {
    console.error("notifyTimeslotClash failed:", error);
  }
}

/** To the teacher whose booking clashed: their request was handed to the admin. */
export async function notifyTimeslotClashReported(params: {
  teacherId: string;
  classroomTitle: string;
  slotLabel: string;
  room: string;
  reason: string;
  /** Set for a reschedule request: where the class is booked right now. */
  movingFrom?: string;
}): Promise<void> {
  try {
    await createNotificationsForRecipients([params.teacherId], {
      type: NotificationType.TIMESLOT_CLASH_REPORTED,
      title: "Clash sent to admin",
      message: params.movingFrom
        ? `Your request to move ${params.classroomTitle} from ${params.movingFrom} to ${params.slotLabel} (Room ${params.room}) clashes: ${params.reason} It has been sent to the admin to resolve - your class stays at ${params.movingFrom} until then, and you'll be notified of the decision.`
        : `Your request for ${params.classroomTitle} on ${params.slotLabel} (Room ${params.room}) clashes: ${params.reason} It has been sent to the admin to resolve - please wait, you'll be notified once the admin moves your class to a free slot.`,
      link: "/timetable",
    });
  } catch (error) {
    console.error("notifyTimeslotClashReported failed:", error);
  }
}

/** To the teachers involved in a resolved clash, stating the slot the blocked class was moved to. */
export async function notifyTimeslotResolved(params: {
  teacherIds: string[];
  message: string;
  title?: string;
}): Promise<void> {
  try {
    await createNotificationsForRecipients(params.teacherIds, {
      type: NotificationType.TIMESLOT_RESOLVED,
      title: params.title ?? "Timetable clash resolved",
      message: params.message,
      link: "/timetable",
    });
  } catch (error) {
    console.error("notifyTimeslotResolved failed:", error);
  }
}
