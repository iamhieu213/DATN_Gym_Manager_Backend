-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('CRITICAL', 'ROUTINE', 'NORMAL');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" SERIAL NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_team" VARCHAR(255),
    "cost" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_tasks_equipment_id_idx" ON "maintenance_tasks"("equipment_id");

-- CreateIndex
CREATE INDEX "maintenance_tasks_scheduled_at_idx" ON "maintenance_tasks"("scheduled_at");

-- CreateIndex
CREATE INDEX "maintenance_tasks_status_idx" ON "maintenance_tasks"("status");

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
