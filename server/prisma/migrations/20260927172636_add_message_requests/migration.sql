-- CreateEnum
CREATE TYPE "MessageRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "MessageRequest" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "MessageRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "MessageRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageRequest_receiverId_status_idx" ON "MessageRequest"("receiverId", "status");

-- CreateIndex
CREATE INDEX "MessageRequest_senderId_status_idx" ON "MessageRequest"("senderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRequest_senderId_receiverId_key" ON "MessageRequest"("senderId", "receiverId");

-- AddForeignKey
ALTER TABLE "MessageRequest" ADD CONSTRAINT "MessageRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRequest" ADD CONSTRAINT "MessageRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
