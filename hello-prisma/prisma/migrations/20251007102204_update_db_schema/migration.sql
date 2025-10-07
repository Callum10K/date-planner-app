/*
  Warnings:

  - You are about to drop the `Suggestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TripPlace` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- DropTable
DROP TABLE "public"."Suggestion";

-- DropTable
DROP TABLE "public"."TripPlace";

-- CreateTable
CREATE TABLE "trip_places" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 1,
    "time" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_places_day_idx" ON "trip_places"("day");

-- CreateIndex
CREATE INDEX "suggestions_status_idx" ON "suggestions"("status");
