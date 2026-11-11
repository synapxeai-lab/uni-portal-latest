-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_PASSWORD_CHANGE', 'ARCHIVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ClassroomMembershipRole" AS ENUM ('OWNER', 'TEACHER', 'CO_TEACHER', 'STUDENT', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ClassroomMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REMOVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClassroomStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('EMAIL', 'LINK', 'CODE');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('DOCUMENT', 'LINK', 'VIDEO', 'IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('ASSIGNED', 'SUBMITTED', 'LATE', 'REVIEWED', 'RETURNED', 'MISSING');

-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_ASSIGNMENT', 'NEW_MATERIAL', 'NEW_ANNOUNCEMENT', 'SUBMISSION_RETURNED', 'PRIVATE_COMMENT', 'CLASS_COMMENT', 'GENERAL', 'CLASS_CREATED', 'CLASS_ARCHIVED', 'TIMESLOT_SCHEDULED', 'TIMESLOT_UPDATED', 'TIMESLOT_CANCELLED', 'TIMESLOT_CLASH', 'TIMESLOT_RESOLVED', 'TIMESLOT_CLASH_REPORTED');

-- CreateEnum
CREATE TYPE "TimetableClashKind" AS ENUM ('SECTION', 'ROOM');

-- CreateEnum
CREATE TYPE "TimetableClashStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "FileAttachmentType" AS ENUM ('ANNOUNCEMENT', 'MATERIAL', 'ASSIGNMENT', 'SUBMISSION');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'ARCHIVED', 'JOINED', 'INVITED', 'SUBMITTED', 'RETURNED', 'SUSPENDED', 'ROLE_CHANGED', 'PASSWORD_RESET', 'RESTORED', 'LOCKED', 'UNLOCKED', 'SESSION_TERMINATED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "avatarUrl" TEXT,
    "avatarStorageKey" TEXT,
    "passwordEnc" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "userId" UUID,
    "succeeded" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLoginSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserLoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "section" TEXT NOT NULL,
    "description" TEXT,
    "room" TEXT,
    "code" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "status" "ClassroomStatus" NOT NULL DEFAULT 'ACTIVE',
    "sectionCourseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomSettings" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "allowMaterials" BOOLEAN NOT NULL DEFAULT true,
    "allowAssignments" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassroomSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomMembership" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ClassroomMembershipRole" NOT NULL DEFAULT 'STUDENT',
    "status" "ClassroomMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassroomMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "inviteeUserId" UUID,
    "inviteeEmail" TEXT NOT NULL,
    "type" "InvitationType" NOT NULL DEFAULT 'EMAIL',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'PUBLISHED',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "topicId" UUID,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "type" "MaterialType" NOT NULL DEFAULT 'DOCUMENT',
    "status" "MaterialStatus" NOT NULL DEFAULT 'PUBLISHED',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "topicId" UUID,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
    "dueDate" TIMESTAMP(3),
    "points" INTEGER,
    "allowLateSubmission" BOOLEAN NOT NULL DEFAULT true,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "textAnswer" TEXT,
    "submittedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "status" "SubmissionStatus" NOT NULL DEFAULT 'ASSIGNED',
    "privateComment" TEXT,
    "grade" INTEGER,
    "feedback" TEXT,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "announcementId" UUID,
    "submissionId" UUID,
    "content" TEXT NOT NULL,
    "visibility" "CommentVisibility" NOT NULL DEFAULT 'PUBLIC',
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "classroomId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" UUID NOT NULL,
    "storagePath" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "attachmentType" "FileAttachmentType" NOT NULL,
    "entityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "classroomId" UUID,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "targetLabel" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSlot" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "roomKey" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startHour" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableClash" (
    "id" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "conflictingSlotId" UUID,
    "sectionKey" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "kind" "TimetableClashKind" NOT NULL DEFAULT 'SECTION',
    "dayOfWeek" INTEGER NOT NULL,
    "startHour" INTEGER NOT NULL,
    "status" "TimetableClashStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" UUID,
    "resolvedSlotId" UUID,
    "rescheduleSlotId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableClash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" UUID NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'Elevate Institute of Tourism & Hospitality Management',
    "academicYear" TEXT NOT NULL DEFAULT '2025-2026',
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxUploadSizeMb" INTEGER NOT NULL DEFAULT 25,
    "defaultAllowComments" BOOLEAN NOT NULL DEFAULT true,
    "defaultAllowMaterials" BOOLEAN NOT NULL DEFAULT true,
    "defaultAllowAssignments" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewAssignment" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewMaterial" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewAnnouncement" BOOLEAN NOT NULL DEFAULT true,
    "notifySubmissionReturned" BOOLEAN NOT NULL DEFAULT true,
    "notifyPrivateComment" BOOLEAN NOT NULL DEFAULT true,
    "minPasswordLength" INTEGER NOT NULL DEFAULT 8,
    "requirePasswordUppercase" BOOLEAN NOT NULL DEFAULT true,
    "requirePasswordNumber" BOOLEAN NOT NULL DEFAULT true,
    "requirePasswordSymbol" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeCategory" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'layers',
    "color" TEXT NOT NULL,
    "bg" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "bg" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "head" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CPD',
    "semester" INTEGER NOT NULL DEFAULT 1,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "studentsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creditHours" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "theoryPercent" INTEGER NOT NULL DEFAULT 100,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseFee" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "batch" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionCourse" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "teacherId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedAssignment" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" SERIAL NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cnic" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "programme" TEXT NOT NULL DEFAULT 'CPD',
    "type" TEXT NOT NULL DEFAULT 'PERMANENT',
    "salary" INTEGER,
    "ratePerCreditHour" INTEGER,
    "guardianName" TEXT NOT NULL,
    "guardianContact" TEXT NOT NULL,
    "guardianCnic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" SERIAL NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "rollNo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cnic" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "lastQualification" TEXT,
    "passingYear" INTEGER,
    "grade" TEXT,
    "university" TEXT,
    "programme" TEXT NOT NULL DEFAULT 'CPD',
    "batch" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL,
    "guardianContact" TEXT NOT NULL,
    "guardianCnic" TEXT NOT NULL,
    "guardianRelationship" TEXT,
    "guardianEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" SERIAL NOT NULL,
    "semester" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "semesterStart" TIMESTAMP(3),
    "semesterEnd" TIMESTAMP(3),
    "semesterEndedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationLimit" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "batch" TEXT NOT NULL,
    "creditLimit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "percentageOverride" DOUBLE PRECISION,
    "gradeOverride" TEXT,
    "publishedGrade" TEXT,
    "gradeVisibleFrom" TIMESTAMP(3),
    "gradeGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" SERIAL NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAssessment" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "weightage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentCategory" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "courseAssessmentId" INTEGER,
    "type" TEXT NOT NULL,
    "weightage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingCriteria" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "grades" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mark" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "enrollmentId" INTEGER NOT NULL,
    "obtained" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challan" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SectionToStudent" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_SectionToStudent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_userId_createdAt_idx" ON "LoginAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_succeeded_createdAt_idx" ON "LoginAttempt"("succeeded", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserLoginSession_tokenId_key" ON "UserLoginSession"("tokenId");

-- CreateIndex
CREATE INDEX "UserLoginSession_userId_revokedAt_idx" ON "UserLoginSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "UserLoginSession_revokedAt_expiresAt_idx" ON "UserLoginSession"("revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_code_key" ON "Classroom"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_sectionCourseId_key" ON "Classroom"("sectionCourseId");

-- CreateIndex
CREATE INDEX "Classroom_ownerId_idx" ON "Classroom"("ownerId");

-- CreateIndex
CREATE INDEX "Classroom_status_idx" ON "Classroom"("status");

-- CreateIndex
CREATE INDEX "Classroom_createdAt_idx" ON "Classroom"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomSettings_classroomId_key" ON "ClassroomSettings"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomMembership_userId_idx" ON "ClassroomMembership"("userId");

-- CreateIndex
CREATE INDEX "ClassroomMembership_classroomId_status_idx" ON "ClassroomMembership"("classroomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomMembership_classroomId_userId_key" ON "ClassroomMembership"("classroomId", "userId");

-- CreateIndex
CREATE INDEX "Invitation_classroomId_status_idx" ON "Invitation"("classroomId", "status");

-- CreateIndex
CREATE INDEX "Invitation_classroomId_inviteeEmail_idx" ON "Invitation"("classroomId", "inviteeEmail");

-- CreateIndex
CREATE INDEX "Invitation_inviteeUserId_idx" ON "Invitation"("inviteeUserId");

-- CreateIndex
CREATE INDEX "Topic_classroomId_position_idx" ON "Topic"("classroomId", "position");

-- CreateIndex
CREATE INDEX "Announcement_status_scheduledFor_idx" ON "Announcement"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Announcement_moderationStatus_createdAt_idx" ON "Announcement"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_classroomId_createdAt_idx" ON "Announcement"("classroomId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_authorId_idx" ON "Announcement"("authorId");

-- CreateIndex
CREATE INDEX "Material_classroomId_createdAt_idx" ON "Material"("classroomId", "createdAt");

-- CreateIndex
CREATE INDEX "Material_topicId_idx" ON "Material"("topicId");

-- CreateIndex
CREATE INDEX "Material_authorId_idx" ON "Material"("authorId");

-- CreateIndex
CREATE INDEX "Material_status_scheduledFor_idx" ON "Material"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Material_moderationStatus_createdAt_idx" ON "Material"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Assignment_classroomId_dueDate_idx" ON "Assignment"("classroomId", "dueDate");

-- CreateIndex
CREATE INDEX "Assignment_topicId_idx" ON "Assignment"("topicId");

-- CreateIndex
CREATE INDEX "Assignment_authorId_idx" ON "Assignment"("authorId");

-- CreateIndex
CREATE INDEX "Assignment_status_scheduledFor_idx" ON "Assignment"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Assignment_moderationStatus_createdAt_idx" ON "Assignment"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_status_idx" ON "Submission"("assignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assignmentId_studentId_key" ON "Submission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "Comment_announcementId_createdAt_idx" ON "Comment"("announcementId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_submissionId_createdAt_idx" ON "Comment"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Comment_moderationStatus_createdAt_idx" ON "Comment"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_createdAt_idx" ON "Notification"("recipientId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_classroomId_isRead_idx" ON "Notification"("recipientId", "classroomId", "isRead");

-- CreateIndex
CREATE INDEX "File_uploadedById_createdAt_idx" ON "File"("uploadedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "File_storagePath_key" ON "File"("storagePath");

-- CreateIndex
CREATE INDEX "FileAttachment_fileId_attachmentType_idx" ON "FileAttachment"("fileId", "attachmentType");

-- CreateIndex
CREATE INDEX "FileAttachment_attachmentType_entityId_idx" ON "FileAttachment"("attachmentType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FileAttachment_fileId_attachmentType_entityId_key" ON "FileAttachment"("fileId", "attachmentType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_classroomId_createdAt_idx" ON "ActivityLog"("classroomId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_action_createdAt_idx" ON "ActivityLog"("entityType", "action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Room_number_key" ON "Room"("number");

-- CreateIndex
CREATE INDEX "Room_isActive_number_idx" ON "Room"("isActive", "number");

-- CreateIndex
CREATE INDEX "TimetableSlot_classroomId_dayOfWeek_idx" ON "TimetableSlot"("classroomId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimetableSlot_dayOfWeek_idx" ON "TimetableSlot"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_sectionKey_dayOfWeek_startHour_key" ON "TimetableSlot"("sectionKey", "dayOfWeek", "startHour");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_teacherId_dayOfWeek_startHour_key" ON "TimetableSlot"("teacherId", "dayOfWeek", "startHour");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSlot_roomKey_dayOfWeek_startHour_key" ON "TimetableSlot"("roomKey", "dayOfWeek", "startHour");

-- CreateIndex
CREATE INDEX "TimetableClash_status_createdAt_idx" ON "TimetableClash"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TimetableClash_classroomId_status_idx" ON "TimetableClash"("classroomId", "status");

-- CreateIndex
CREATE INDEX "TimetableClash_rescheduleSlotId_status_idx" ON "TimetableClash"("rescheduleSlotId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeCategory_key_key" ON "ProgrammeCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeCategory_slug_key" ON "ProgrammeCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeCategory_label_key" ON "ProgrammeCategory"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_category_semester_idx" ON "Department"("category", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "Course_departmentId_code_key" ON "Course"("departmentId", "code");

-- CreateIndex
CREATE INDEX "CourseFee_courseId_idx" ON "CourseFee"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_name_key" ON "Batch"("name");

-- CreateIndex
CREATE INDEX "Section_batch_idx" ON "Section"("batch");

-- CreateIndex
CREATE UNIQUE INDEX "Section_departmentId_batch_label_key" ON "Section"("departmentId", "batch", "label");

-- CreateIndex
CREATE INDEX "SectionCourse_courseId_idx" ON "SectionCourse"("courseId");

-- CreateIndex
CREATE INDEX "SectionCourse_teacherId_idx" ON "SectionCourse"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionCourse_sectionId_courseId_key" ON "SectionCourse"("sectionId", "courseId");

-- CreateIndex
CREATE INDEX "PlannedAssignment_teacherId_idx" ON "PlannedAssignment"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedAssignment_sectionId_courseId_key" ON "PlannedAssignment"("sectionId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_cnic_key" ON "Teacher"("cnic");

-- CreateIndex
CREATE INDEX "Teacher_programme_idx" ON "Teacher"("programme");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_rollNo_key" ON "Student"("rollNo");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_cnic_key" ON "Student"("cnic");

-- CreateIndex
CREATE INDEX "Student_programme_batch_idx" ON "Student"("programme", "batch");

-- CreateIndex
CREATE INDEX "Registration_startDate_endDate_idx" ON "Registration"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_semester_year_key" ON "Registration"("semester", "year");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationLimit_registrationId_batch_key" ON "RegistrationLimit"("registrationId", "batch");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_sectionId_idx" ON "Enrollment"("courseId", "sectionId");

-- CreateIndex
CREATE INDEX "Enrollment_sectionId_idx" ON "Enrollment"("sectionId");

-- CreateIndex
CREATE INDEX "Enrollment_registrationId_idx" ON "Enrollment"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_registrationId_courseId_key" ON "Enrollment"("studentId", "registrationId", "courseId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_enrollmentId_date_key" ON "Attendance"("enrollmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAssessment_courseId_type_key" ON "CourseAssessment"("courseId", "type");

-- CreateIndex
CREATE INDEX "AssessmentCategory_sectionId_idx" ON "AssessmentCategory"("sectionId");

-- CreateIndex
CREATE INDEX "AssessmentCategory_courseAssessmentId_idx" ON "AssessmentCategory"("courseAssessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCategory_courseId_sectionId_type_key" ON "AssessmentCategory"("courseId", "sectionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_categoryId_title_key" ON "Assessment"("categoryId", "title");

-- CreateIndex
CREATE INDEX "GradingCriteria_sectionId_idx" ON "GradingCriteria"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingCriteria_courseId_sectionId_key" ON "GradingCriteria"("courseId", "sectionId");

-- CreateIndex
CREATE INDEX "Mark_enrollmentId_idx" ON "Mark"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Mark_assessmentId_enrollmentId_key" ON "Mark"("assessmentId", "enrollmentId");

-- CreateIndex
CREATE INDEX "Challan_registrationId_status_idx" ON "Challan"("registrationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Challan_studentId_registrationId_key" ON "Challan"("studentId", "registrationId");

-- CreateIndex
CREATE INDEX "_SectionToStudent_B_index" ON "_SectionToStudent"("B");

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLoginSession" ADD CONSTRAINT "UserLoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_sectionCourseId_fkey" FOREIGN KEY ("sectionCourseId") REFERENCES "SectionCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomSettings" ADD CONSTRAINT "ClassroomSettings_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMembership" ADD CONSTRAINT "ClassroomMembership_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMembership" ADD CONSTRAINT "ClassroomMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_conflictingSlotId_fkey" FOREIGN KEY ("conflictingSlotId") REFERENCES "TimetableSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_resolvedSlotId_fkey" FOREIGN KEY ("resolvedSlotId") REFERENCES "TimetableSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_rescheduleSlotId_fkey" FOREIGN KEY ("rescheduleSlotId") REFERENCES "TimetableSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFee" ADD CONSTRAINT "CourseFee_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionCourse" ADD CONSTRAINT "SectionCourse_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionCourse" ADD CONSTRAINT "SectionCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionCourse" ADD CONSTRAINT "SectionCourse_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAssignment" ADD CONSTRAINT "PlannedAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAssignment" ADD CONSTRAINT "PlannedAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedAssignment" ADD CONSTRAINT "PlannedAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationLimit" ADD CONSTRAINT "RegistrationLimit_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAssessment" ADD CONSTRAINT "CourseAssessment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCategory" ADD CONSTRAINT "AssessmentCategory_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCategory" ADD CONSTRAINT "AssessmentCategory_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCategory" ADD CONSTRAINT "AssessmentCategory_courseAssessmentId_fkey" FOREIGN KEY ("courseAssessmentId") REFERENCES "CourseAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssessmentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingCriteria" ADD CONSTRAINT "GradingCriteria_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingCriteria" ADD CONSTRAINT "GradingCriteria_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challan" ADD CONSTRAINT "Challan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challan" ADD CONSTRAINT "Challan_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SectionToStudent" ADD CONSTRAINT "_SectionToStudent_A_fkey" FOREIGN KEY ("A") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SectionToStudent" ADD CONSTRAINT "_SectionToStudent_B_fkey" FOREIGN KEY ("B") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints Prisma can't express in the schema.
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_startHour_check" CHECK ("startHour" BETWEEN 8 AND 16);
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 1 AND 6);
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_startHour_check" CHECK ("startHour" BETWEEN 8 AND 16);
ALTER TABLE "TimetableClash" ADD CONSTRAINT "TimetableClash_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 1 AND 6);
ALTER TABLE "Room" ADD CONSTRAINT "Room_number_format_check" CHECK ("number" ~ '^[0-9]{3}$');
ALTER TABLE "Room" ADD CONSTRAINT "Room_floor_matches_number_check" CHECK ("floor" = CAST(substr("number", 1, 1) AS INTEGER));
