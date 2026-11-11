import type { PrismaClient } from "@/generated/prisma/client";
import { getYearlyBatches } from "@/features/academics/lib/batches";
import { ensureDefaultCategories } from "@/features/academics/lib/programme-categories";
import { ensureDefaultSections } from "@/features/academics/lib/section-sync";

/**
 * New academic programmes for the unified portal (the Culinary and CPD
 * diplomas come over from the University Portal's data). Courses carry fees
 * and extra charges so registration produces real challans.
 */
const PROGRAMME = {
  key: "TOURISM",
  slug: "tourism",
  label: "Tourism & Hospitality Management Programmes",
  icon: "briefcase",
  description: "CTH (UK) diplomas in tourism operations, travel and hospitality management.",
  color: "#6b21a8",
  bg: "#f3e8ff",
  position: 2,
};

interface SeedCourse {
  code: string;
  name: string;
  creditHours: number;
  fee: number;
  theoryPercent?: number;
  extraFees?: { name: string; amount: number }[];
}

const DIPLOMAS: {
  code: string;
  name: string;
  semester: number;
  head: string;
  color: string;
  bg: string;
  discountRate: number;
  description: string;
  courses: SeedCourse[];
}[] = [
  {
    code: "DTM",
    name: "Level 3 Diploma in Tourism Management",
    semester: 1,
    head: "Dr. Ayesha Khan",
    color: "#6b21a8",
    bg: "#f3e8ff",
    discountRate: 10,
    description: "Tourism Programme - destinations, travel operations, customer care and tourism marketing (CTH, UK).",
    courses: [
      { code: "DTM-TDW", name: "Tourist Destinations of the World", creditHours: 3, fee: 18000 },
      { code: "DTM-TOM", name: "Travel and Tour Operations Management", creditHours: 4, fee: 22000 },
      { code: "DTM-CCT", name: "Customer Care in Travel and Tourism", creditHours: 3, fee: 16000, theoryPercent: 60 },
      {
        code: "DTM-TMK",
        name: "Tourism Marketing",
        creditHours: 3,
        fee: 18000,
        extraFees: [{ name: "Field Visit Fee", amount: 4500 }],
      },
    ],
  },
  {
    code: "DHM",
    name: "Level 4 Diploma in Hospitality Management",
    semester: 2,
    head: "Mr. Bilal Ahmed",
    color: "#0f766e",
    bg: "#ccfbf1",
    discountRate: 0,
    description: "Hospitality Programme - rooms division, food and beverage operations and hospitality leadership (CTH, UK).",
    courses: [
      { code: "DHM-RDM", name: "Rooms Division Management", creditHours: 4, fee: 24000, theoryPercent: 70 },
      {
        code: "DHM-FBO",
        name: "Food and Beverage Operations",
        creditHours: 4,
        fee: 24000,
        theoryPercent: 50,
        extraFees: [{ name: "Uniform Fee", amount: 3000 }],
      },
      { code: "DHM-HLM", name: "Hospitality Leadership and Management", creditHours: 3, fee: 20000 },
      { code: "DHM-EVM", name: "Events Management", creditHours: 3, fee: 20000 },
    ],
  },
];

export async function seedAcademics(prisma: PrismaClient) {
  await ensureDefaultCategories();
  await prisma.programmeCategory.upsert({
    where: { key: PROGRAMME.key },
    update: {},
    create: PROGRAMME,
  });

  const diplomaIds: number[] = [];
  for (const { courses, ...diploma } of DIPLOMAS) {
    const department = await prisma.department.upsert({
      where: { code: diploma.code },
      update: {},
      create: { ...diploma, category: PROGRAMME.key },
    });
    diplomaIds.push(department.id);
    for (const { extraFees = [], ...course } of courses) {
      await prisma.course.upsert({
        where: { departmentId_code: { departmentId: department.id, code: course.code } },
        update: {},
        create: { ...course, departmentId: department.id, extraFees: { create: extraFees } },
      });
    }
  }

  // Sections A and B for every diploma in every current yearly batch.
  const allDiplomas = await prisma.department.findMany({ select: { id: true } });
  await ensureDefaultSections(
    allDiplomas.map((diploma) => diploma.id),
    getYearlyBatches(),
  );
  return { programme: PROGRAMME.key, diplomaIds };
}
