-- AlterTable
ALTER TABLE "coach_change_requests" ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH';
