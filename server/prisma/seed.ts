import bcrypt from "bcryptjs";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  UserRole,
  UserStatus,
  ClassroomMembershipRole,
  ClassroomMembershipStatus,
  ClassroomStatus,
  InvitationStatus,
  InvitationType,
  AnnouncementStatus,
  MaterialType,
  AssignmentStatus,
  SubmissionStatus,
  CommentVisibility,
  NotificationType,
  ActivityAction,
} from "@/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.material.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.fileAttachment.deleteMany();
  await prisma.file.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.classroomMembership.deleteMany();
  await prisma.classroomSettings.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      name: "Faizan",
      email: "faizan.admin@gcr.dev",
      passwordHash: await bcrypt.hash("F@izan4121", 10),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    },
  });

  const teacher = await prisma.user.create({
    data: {
      name: "Daniel Brooks",
      email: "daniel.teacher@gcr.dev",
      passwordHash: await bcrypt.hash("Testpass123!", 10),
      role: UserRole.TEACHER,
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    },
  });

  const studentOne = await prisma.user.create({
    data: {
      name: "Sofia Chen",
      email: "sofia.student@gcr.dev",
      passwordHash: await bcrypt.hash("Testpass123!", 10),
      role: UserRole.STUDENT,
      avatarUrl:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    },
  });

  const studentTwo = await prisma.user.create({
    data: {
      name: "Liam Patel",
      email: "liam.student@gcr.dev",
      passwordHash: await bcrypt.hash("Testpass123!", 10),
      role: UserRole.STUDENT,
      avatarUrl:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
    },
  });

  const classroom = await prisma.classroom.create({
    data: {
      ownerId: teacher.id,
      title: "Advanced Mathematics 101",
      subject: "Mathematics",
      section: "A",
      description:
        "A collaborative classroom for solving real-world math problems and sharing resources.",
      room: "B-204",
      code: "MATH101A",
      coverImageUrl:
        "https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?auto=format&fit=crop&w=1200&q=80",
      status: ClassroomStatus.ACTIVE,
    },
  });

  await prisma.classroomSettings.create({
    data: {
      classroomId: classroom.id,
      allowComments: true,
      allowMaterials: true,
      allowAssignments: true,
    },
  });

  await prisma.classroomMembership.createMany({
    data: [
      {
        classroomId: classroom.id,
        userId: teacher.id,
        role: ClassroomMembershipRole.OWNER,
        status: ClassroomMembershipStatus.ACTIVE,
      },
      {
        classroomId: classroom.id,
        userId: studentOne.id,
        role: ClassroomMembershipRole.STUDENT,
        status: ClassroomMembershipStatus.ACTIVE,
      },
      {
        classroomId: classroom.id,
        userId: studentTwo.id,
        role: ClassroomMembershipRole.STUDENT,
        status: ClassroomMembershipStatus.ACTIVE,
      },
    ],
  });

  await prisma.invitation.create({
    data: {
      classroomId: classroom.id,
      invitedById: teacher.id,
      inviteeEmail: "new.student@gcr.dev",
      type: InvitationType.EMAIL,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  const topicOne = await prisma.topic.create({
    data: {
      classroomId: classroom.id,
      title: "Week 1: Algebra Foundations",
      position: 1,
    },
  });

  const topicTwo = await prisma.topic.create({
    data: {
      classroomId: classroom.id,
      title: "Week 2: Geometry Basics",
      position: 2,
    },
  });

  const announcementOne = await prisma.announcement.create({
    data: {
      classroomId: classroom.id,
      authorId: teacher.id,
      title: "Welcome to the semester",
      content:
        "Welcome to Advanced Mathematics 101. Please review the first week's materials before our next session.",
      status: AnnouncementStatus.PUBLISHED,
      isPinned: true,
    },
  });

  await prisma.announcement.create({
    data: {
      classroomId: classroom.id,
      authorId: teacher.id,
      title: "Geometry workshop this Friday",
      content:
        "We will meet in room B-204 this Friday to review coordinate geometry and problem solving strategies.",
      status: AnnouncementStatus.PUBLISHED,
      isPinned: false,
    },
  });

  await prisma.material.create({
    data: {
      classroomId: classroom.id,
      topicId: topicOne.id,
      authorId: teacher.id,
      title: "Algebra Review Slides",
      description: "A concise overview of the core algebraic concepts covered in week one.",
      type: MaterialType.DOCUMENT,
    },
  });

  await prisma.material.create({
    data: {
      classroomId: classroom.id,
      topicId: topicTwo.id,
      authorId: teacher.id,
      title: "Geometry Cheat Sheet",
      description: "Helpful notes for classifying shapes and understanding angles.",
      type: MaterialType.DOCUMENT,
    },
  });

  const assignmentOne = await prisma.assignment.create({
    data: {
      classroomId: classroom.id,
      topicId: topicOne.id,
      authorId: teacher.id,
      title: "Linear Equations Practice",
      description:
        "Solve the linear equations worksheet and submit your reasoning in the response box.",
      status: AssignmentStatus.PUBLISHED,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      allowLateSubmission: true,
    },
  });

  const assignmentTwo = await prisma.assignment.create({
    data: {
      classroomId: classroom.id,
      topicId: topicTwo.id,
      authorId: teacher.id,
      title: "Coordinate Geometry Quiz",
      description: "Complete the short geometry quiz and upload your work if needed.",
      status: AssignmentStatus.PUBLISHED,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      allowLateSubmission: false,
    },
  });

  await prisma.submission.createMany({
    data: [
      {
        assignmentId: assignmentOne.id,
        studentId: studentOne.id,
        textAnswer: "I solved each equation by isolating the variable and checking my answers.",
      },
      {
        assignmentId: assignmentOne.id,
        studentId: studentTwo.id,
        textAnswer: "I completed the worksheet and showed my work for each step.",
        status: SubmissionStatus.SUBMITTED,
      },
      {
        assignmentId: assignmentTwo.id,
        studentId: studentOne.id,
        textAnswer: "I mapped the points carefully and calculated the slope for each pair.",
        status: SubmissionStatus.REVIEWED,
      },
      {
        assignmentId: assignmentTwo.id,
        studentId: studentTwo.id,
        textAnswer:
          "I completed the geometry questions and reviewed the coordinate plane examples.",
        status: SubmissionStatus.LATE,
      },
    ],
  });

  await prisma.comment.createMany({
    data: [
      {
        authorId: studentOne.id,
        announcementId: announcementOne.id,
        content: "Thanks for the welcome message. I’m looking forward to the semester.",
        visibility: CommentVisibility.PUBLIC,
      },
      {
        authorId: teacher.id,
        submissionId: (
          await prisma.submission.findFirst({
            where: { assignmentId: assignmentOne.id, studentId: studentOne.id },
          })
        )?.id,
        content: "Great progress. Please make sure to show your algebra steps clearly.",
        visibility: CommentVisibility.PRIVATE,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        recipientId: studentOne.id,
        type: NotificationType.NEW_ASSIGNMENT,
        title: "New assignment posted",
        message: "Linear Equations Practice has been posted for Advanced Mathematics 101.",
        isRead: false,
      },
      {
        recipientId: studentTwo.id,
        type: NotificationType.NEW_ANNOUNCEMENT,
        title: "New announcement",
        message: "A new announcement was posted in Advanced Mathematics 101.",
        isRead: true,
      },
      {
        recipientId: teacher.id,
        type: NotificationType.PRIVATE_COMMENT,
        title: "New private comment",
        message: "You received a private comment on a student submission.",
        isRead: false,
      },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      {
        actorId: teacher.id,
        classroomId: classroom.id,
        entityType: "Classroom",
        entityId: classroom.id,
        action: ActivityAction.CREATED,
        metadata: { source: "seed" },
      },
      {
        actorId: studentOne.id,
        classroomId: classroom.id,
        entityType: "Submission",
        entityId: assignmentOne.id,
        action: ActivityAction.SUBMITTED,
        metadata: { assignmentId: assignmentOne.id },
      },
      {
        actorId: teacher.id,
        classroomId: classroom.id,
        entityType: "Assignment",
        entityId: assignmentTwo.id,
        action: ActivityAction.UPDATED,
        metadata: { dueDate: assignmentTwo.dueDate?.toISOString() },
      },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
