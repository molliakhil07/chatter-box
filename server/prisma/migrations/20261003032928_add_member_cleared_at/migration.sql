-- AlterTable
ALTER TABLE "ConversationMember"
ADD COLUMN "clearedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConversationMember"
ADD COLUMN "lastReadMessageId" TEXT;

-- CreateIndex
CREATE INDEX "ConversationMember_lastReadMessageId_idx"
ON "ConversationMember"("lastReadMessageId");

-- AddForeignKey
ALTER TABLE "ConversationMember"
ADD CONSTRAINT "ConversationMember_lastReadMessageId_fkey"
FOREIGN KEY ("lastReadMessageId")
REFERENCES "Message"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;