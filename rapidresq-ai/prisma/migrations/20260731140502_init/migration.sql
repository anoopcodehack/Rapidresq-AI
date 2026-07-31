-- CreateEnum
CREATE TYPE "ResponderStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ASSIGNED', 'ON_THE_WAY', 'RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Responder" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "status" "ResponderStatus" NOT NULL DEFAULT 'AVAILABLE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Responder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'LOW',
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "assignedResponderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchHistory" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "responderId" INTEGER NOT NULL,
    "assignedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedTime" TIMESTAMP(3),

    CONSTRAINT "DispatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Responder_status_idx" ON "Responder"("status");

-- CreateIndex
CREATE INDEX "EmergencyRequest_status_idx" ON "EmergencyRequest"("status");

-- CreateIndex
CREATE INDEX "EmergencyRequest_priority_idx" ON "EmergencyRequest"("priority");

-- CreateIndex
CREATE INDEX "EmergencyRequest_assignedResponderId_idx" ON "EmergencyRequest"("assignedResponderId");

-- CreateIndex
CREATE INDEX "EmergencyRequest_createdAt_idx" ON "EmergencyRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyRequest" ADD CONSTRAINT "EmergencyRequest_assignedResponderId_fkey" FOREIGN KEY ("assignedResponderId") REFERENCES "Responder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchHistory" ADD CONSTRAINT "DispatchHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EmergencyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchHistory" ADD CONSTRAINT "DispatchHistory_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "Responder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
