import type { PrismaClient } from "@/generated/prisma/client";
import { syncEnrolledSection } from "@/features/academics/lib/section-sync";

/**
 * Teacher and student profiles for the seed accounts (linked by email to the
 * logins from accounts.ts). CNICs and phone numbers are made up.
 */
const TEACHERS = [
  {
    email: "ayesha.khan@eithm.edu.pk",
    name: "Dr. Ayesha Khan",
    phone: "0300-1112233",
    cnic: "35202-1000001-2",
    qualification: "PhD Tourism Management",
    programme: "TOURISM",
    type: "PERMANENT",
    salary: 180000,
    ratePerCreditHour: null,
  },
  {
    email: "bilal.ahmed@eithm.edu.pk",
    name: "Mr. Bilal Ahmed",
    phone: "0301-2223344",
    cnic: "35202-1000002-3",
    qualification: "MBA Hospitality Management",
    programme: "TOURISM",
    type: "VISITING",
    salary: null,
    ratePerCreditHour: 6500,
  },
  {
    email: "sana.mirza@eithm.edu.pk",
    name: "Chef Sana Mirza",
    phone: "0302-3334455",
    cnic: "35202-1000003-4",
    qualification: "CTH Level 4 Culinary Arts",
    programme: "TOURISM",
    type: "PERMANENT",
    salary: 150000,
    ratePerCreditHour: null,
  },
];

const STUDENTS = [
  { email: "ali.raza@eithm.edu.pk", name: "Ali Raza", rollNo: "EITHM-26-TM-001", section: "A", gender: "MALE" },
  { email: "maryam.iqbal@eithm.edu.pk", name: "Maryam Iqbal", rollNo: "EITHM-26-TM-002", section: "A", gender: "FEMALE" },
  { email: "hassan.javed@eithm.edu.pk", name: "Hassan Javed", rollNo: "EITHM-26-TM-003", section: "A", gender: "MALE" },
  { email: "zara.sheikh@eithm.edu.pk", name: "Zara Sheikh", rollNo: "EITHM-26-TM-004", section: "B", gender: "FEMALE" },
  { email: "omar.farooq@eithm.edu.pk", name: "Omar Farooq", rollNo: "EITHM-26-TM-005", section: "B", gender: "MALE" },
  { email: "hina.aslam@eithm.edu.pk", name: "Hina Aslam", rollNo: "EITHM-26-TM-006", section: "B", gender: "FEMALE" },
];

export async function seedPeople(prisma: PrismaClient) {
  for (const teacher of TEACHERS) {
    const user = await prisma.user.findUnique({ where: { email: teacher.email } });
    await prisma.teacher.upsert({
      where: { email: teacher.email },
      update: {},
      create: {
        ...teacher,
        userId: user?.id,
        address: "EITHM Campus, Lahore",
        guardianName: "On file",
        guardianContact: "0300-0000000",
        guardianCnic: "35202-9999999-1",
      },
    });
  }

  for (const [index, student] of STUDENTS.entries()) {
    const user = await prisma.user.findUnique({ where: { email: student.email } });
    const n = String(index + 1).padStart(2, "0");
    const row = await prisma.student.upsert({
      where: { email: student.email },
      update: {},
      create: {
        ...student,
        userId: user?.id,
        phone: `0321-55500${n}`,
        address: "Lahore, Pakistan",
        cnic: `35202-20000${n}-1`,
        dob: new Date(`200${index % 4 + 4}-0${(index % 9) + 1}-15T00:00:00Z`),
        lastQualification: "Intermediate (FSc / FA)",
        passingYear: 2025,
        grade: "A",
        university: "BISE Lahore",
        programme: "TOURISM",
        batch: "2026",
        guardianName: `Guardian of ${student.name}`,
        guardianContact: `0333-44400${n}`,
        guardianCnic: `35202-30000${n}-1`,
        guardianRelationship: "Father",
        guardianEmail: `guardian.${n}@example.com`,
      },
    });
    await syncEnrolledSection(row.id);
  }
  return { teachers: TEACHERS.length, students: STUDENTS.length };
}
