import { passwordFields } from "@/lib/auth/password";
import { UserRole, UserStatus, type PrismaClient } from "@/generated/prisma/client";
import { getBatchDetails } from "@/features/academics/lib/batches";
import { syncEnrolledSection } from "@/features/academics/lib/section-sync";
import { createBatch } from "@/features/academics/services/batch-service";

/** The intake that hasn't started yet: its student sees "Your batch has not started yet" on Registration. */
const INTAKE_YEAR = 2027;

export const FUTURE_STUDENT = {
  name: "Areeba Khan",
  email: "areeba.khan@eithm.edu.pk",
  password: "Student@123",
  rollNo: "EITHM-27-TM-001",
};

/**
 * A Tourism student in the 2027 intake, Section A. Uses whichever batch
 * already has intake year 2027 (e.g. one an admin added), else adds batch
 * "2027" with its Sections A and B. Idempotent: an existing login keeps its
 * password and an existing record is left as it is.
 */
export async function seedFutureStudent(prisma: PrismaClient) {
  let batch = (await getBatchDetails()).find((b) => b.year === INTAKE_YEAR)?.name;
  if (!batch) {
    batch = String(INTAKE_YEAR);
    await createBatch({ name: batch, year: INTAKE_YEAR });
  }

  const user =
    (await prisma.user.findUnique({ where: { email: FUTURE_STUDENT.email } })) ??
    (await prisma.user.create({
      data: {
        name: FUTURE_STUDENT.name,
        email: FUTURE_STUDENT.email,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        ...(await passwordFields(FUTURE_STUDENT.password)),
      },
    }));

  const student = await prisma.student.upsert({
    where: { email: FUTURE_STUDENT.email },
    update: {},
    create: {
      name: FUTURE_STUDENT.name,
      email: FUTURE_STUDENT.email,
      rollNo: FUTURE_STUDENT.rollNo,
      userId: user.id,
      phone: "0321-5552701",
      address: "House 7, Block C, Model Town, Lahore",
      cnic: "35202-2700001-2",
      dob: new Date("2006-02-11T00:00:00Z"),
      gender: "FEMALE",
      lastQualification: "Intermediate (FA)",
      passingYear: 2026,
      grade: "A",
      university: "BISE Lahore",
      programme: "TOURISM",
      batch,
      section: "A",
      guardianName: "Imran Khan",
      guardianContact: "0300-5552701",
      guardianCnic: "35202-2700002-1",
      guardianRelationship: "Father",
      guardianEmail: "imran.khan.guardian@example.com",
    },
  });
  await syncEnrolledSection(student.id);
  return { batch, email: FUTURE_STUDENT.email };
}
