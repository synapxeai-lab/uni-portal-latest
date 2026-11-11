-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_number_key" ON "Room"("number");

-- CreateIndex
CREATE INDEX "Room_isActive_number_idx" ON "Room"("isActive", "number");

-- Room numbers are three digits; the first digit is the floor.
ALTER TABLE "Room" ADD CONSTRAINT "Room_number_format_check" CHECK ("number" ~ '^[0-9]{3}$');
ALTER TABLE "Room" ADD CONSTRAINT "Room_floor_matches_number_check" CHECK ("floor" = CAST(substr("number", 1, 1) AS INTEGER));

-- Starter set of rooms across four floors.
INSERT INTO "Room" ("id", "number", "floor") VALUES
  (gen_random_uuid(), '101', 1),
  (gen_random_uuid(), '104', 1),
  (gen_random_uuid(), '107', 1),
  (gen_random_uuid(), '110', 1),
  (gen_random_uuid(), '112', 1),
  (gen_random_uuid(), '201', 2),
  (gen_random_uuid(), '203', 2),
  (gen_random_uuid(), '206', 2),
  (gen_random_uuid(), '209', 2),
  (gen_random_uuid(), '211', 2),
  (gen_random_uuid(), '302', 3),
  (gen_random_uuid(), '305', 3),
  (gen_random_uuid(), '308', 3),
  (gen_random_uuid(), '310', 3),
  (gen_random_uuid(), '404', 4),
  (gen_random_uuid(), '407', 4)
ON CONFLICT ("number") DO NOTHING;
