-- CreateTable
CREATE TABLE "coach_change_requests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "old_coach_id" INTEGER NOT NULL,
    "new_coach_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_change_requests_user_id_idx" ON "coach_change_requests"("user_id");

-- CreateIndex
CREATE INDEX "coach_change_requests_assignment_id_idx" ON "coach_change_requests"("assignment_id");

-- CreateIndex
CREATE INDEX "coach_change_requests_old_coach_id_idx" ON "coach_change_requests"("old_coach_id");

-- CreateIndex
CREATE INDEX "coach_change_requests_new_coach_id_idx" ON "coach_change_requests"("new_coach_id");

-- AddForeignKey
ALTER TABLE "coach_change_requests" ADD CONSTRAINT "coach_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_change_requests" ADD CONSTRAINT "coach_change_requests_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "coach_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_change_requests" ADD CONSTRAINT "coach_change_requests_old_coach_id_fkey" FOREIGN KEY ("old_coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_change_requests" ADD CONSTRAINT "coach_change_requests_new_coach_id_fkey" FOREIGN KEY ("new_coach_id") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
