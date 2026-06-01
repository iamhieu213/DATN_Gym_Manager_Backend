-- AlterTable
ALTER TABLE "coach_change_requests" ADD COLUMN     "new_pt_package_id" INTEGER,
ADD COLUMN     "payment_id" INTEGER,
ADD COLUMN     "price_difference" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- CreateIndex
CREATE INDEX "coach_change_requests_payment_id_idx" ON "coach_change_requests"("payment_id");

-- AddForeignKey
ALTER TABLE "coach_change_requests" ADD CONSTRAINT "coach_change_requests_new_pt_package_id_fkey" FOREIGN KEY ("new_pt_package_id") REFERENCES "pt_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_change_requests" ADD CONSTRAINT "coach_change_requests_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
