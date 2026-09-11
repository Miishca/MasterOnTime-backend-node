-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('HOME_GARDEN', 'HEALTH_WELLBEING', 'WEDDINGS_EVENTS', 'BUSINESS_SERVICES', 'LESSONS_TRAINING');

-- AlterTable
ALTER TABLE "specialist_profiles" ADD COLUMN     "industry" "Industry";
