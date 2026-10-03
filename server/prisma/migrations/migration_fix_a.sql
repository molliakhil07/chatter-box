-- FIX-A: Persist the latest message read by each conversation member.
-- This follows the v1.1 backend design's per-member read-pointer approach.

ALTER TABLE "ConversationMember"
ADD COLUMN "lastReadMessageId" TEXT;

CREATE INDEX "ConversationMember_lastReadMessageId_idx"
ON "ConversationMember"("lastReadMessageId");

ALTER TABLE "ConversationMember"
ADD CONSTRAINT "ConversationMember_lastReadMessageId_fkey"
FOREIGN KEY ("lastReadMessageId")
REFERENCES "Message"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
