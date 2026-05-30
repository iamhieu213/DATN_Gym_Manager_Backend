-- CreateEnum
CREATE TYPE "TrainingGoal" AS ENUM ('WEIGHT_LOSS', 'MUSCLE_GAIN', 'COMPETITION_PREP', 'REHABILITATION', 'GENERAL_FITNESS');

-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('PLANNED', 'PENDING_RESCHEDULE', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "GroupClassStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "coach_assignment_id" INTEGER,
ALTER COLUMN "membership_id" DROP NOT NULL,
ALTER COLUMN "plan_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "coach_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "speciality" VARCHAR(255),
    "bio" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_availabilities" (
    "id" SERIAL NOT NULL,
    "coach_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "start_minutes" INTEGER NOT NULL,
    "end_minutes" INTEGER NOT NULL,

    CONSTRAINT "coach_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pt_packages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "number_of_sessions" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "goal" "TrainingGoal" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pt_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_pt_packages" (
    "coach_id" INTEGER NOT NULL,
    "pt_package_id" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coach_pt_packages_pkey" PRIMARY KEY ("coach_id","pt_package_id")
);

-- CreateTable
CREATE TABLE "coach_assignments" (
    "id" SERIAL NOT NULL,
    "coach_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "pt_package_id" INTEGER NOT NULL,
    "total_sessions" INTEGER NOT NULL,
    "remaining_sessions" INTEGER NOT NULL,
    "price_paid" DECIMAL(12,2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "coach_id" INTEGER,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "pending_reschedule_at" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_logs" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "exercise_name" VARCHAR(255) NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "rest_seconds" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_classes" (
    "id" SERIAL NOT NULL,
    "coach_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" "GroupClassStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_classes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coach_profiles_user_id_key" ON "coach_profiles"("user_id");

-- CreateIndex
CREATE INDEX "coach_availabilities_coach_id_idx" ON "coach_availabilities"("coach_id");

-- CreateIndex
CREATE INDEX "coach_availabilities_day_of_week_start_minutes_end_minutes_idx" ON "coach_availabilities"("day_of_week", "start_minutes", "end_minutes");

-- CreateIndex
CREATE INDEX "coach_assignments_coach_id_idx" ON "coach_assignments"("coach_id");

-- CreateIndex
CREATE INDEX "coach_assignments_user_id_idx" ON "coach_assignments"("user_id");

-- CreateIndex
CREATE INDEX "workout_sessions_user_id_idx" ON "workout_sessions"("user_id");

-- CreateIndex
CREATE INDEX "workout_sessions_coach_id_idx" ON "workout_sessions"("coach_id");

-- CreateIndex
CREATE INDEX "workout_sessions_scheduled_at_idx" ON "workout_sessions"("scheduled_at");

-- CreateIndex
CREATE INDEX "exercise_logs_session_id_idx" ON "exercise_logs"("session_id");

-- CreateIndex
CREATE INDEX "group_classes_coach_id_idx" ON "group_classes"("coach_id");

-- CreateIndex
CREATE INDEX "group_classes_scheduled_at_idx" ON "group_classes"("scheduled_at");

-- CreateIndex
CREATE INDEX "payments_coach_assignment_id_idx" ON "payments"("coach_assignment_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_coach_assignment_id_fkey" FOREIGN KEY ("coach_assignment_id") REFERENCES "coach_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_availabilities" ADD CONSTRAINT "coach_availabilities_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_pt_packages" ADD CONSTRAINT "coach_pt_packages_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_pt_packages" ADD CONSTRAINT "coach_pt_packages_pt_package_id_fkey" FOREIGN KEY ("pt_package_id") REFERENCES "pt_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_assignments" ADD CONSTRAINT "coach_assignments_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_assignments" ADD CONSTRAINT "coach_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_assignments" ADD CONSTRAINT "coach_assignments_pt_package_id_fkey" FOREIGN KEY ("pt_package_id") REFERENCES "pt_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_classes" ADD CONSTRAINT "group_classes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
