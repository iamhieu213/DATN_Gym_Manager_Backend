-- CreateTable
CREATE TABLE "body_metrics" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "bmi" DOUBLE PRECISION,
    "body_fat_pct" DOUBLE PRECISION,
    "muscle_mass_kg" DOUBLE PRECISION,
    "water_pct" DOUBLE PRECISION,
    "note" TEXT,
    "recorded_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" INTEGER,

    CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "body_metrics_user_id_idx" ON "body_metrics"("user_id");

-- CreateIndex
CREATE INDEX "body_metrics_recorded_by_id_idx" ON "body_metrics"("recorded_by_id");

-- CreateIndex
CREATE INDEX "body_metrics_recorded_at_idx" ON "body_metrics"("recorded_at");

-- AddForeignKey
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
