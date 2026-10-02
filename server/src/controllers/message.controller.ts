import type { Request, Response } from "express";
import {
  createMessage,
  getConversationMessages,
  updateMessage,
} from "../services/message.service";
import { prisma } from "../config/prisma";
import { emitToConversation, emitToUser } from "../socket";

export async function create(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;
    const { content, replyToMessageId } = req.body;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (
      typeof conversationId !== "string" ||
      conversationId.trim().length === 0
    ) {
      res.status(400).json({
        error: "conversationId is required",
      });
      return;
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({
        error: "Message content is required",
      });
      return;
    }

    if (
      replyToMessageId !== undefined &&
      (typeof replyToMessageId !== "string" ||
        replyToMessageId.trim().length === 0)
    ) {
      res.status(400).json({
        error: "replyToMessageId must be a valid message id",
      });
      return;
    }

    const messageResult = await createMessage(
      conversationId,
      userId,
      content.trim(),
      typeof replyToMessageId === "string"
        ? replyToMessageId
        : undefined,
    );

    if (messageResult.status === "conversation_not_found") {
      res.status(404).json({
        error: "Conversation not found",
      });
      return;
    }

    if (messageResult.status === "invalid_reply") {
      res.status(400).json({
        error: "Reply target message was not found in this conversation",
      });
      return;
    }

    const message = messageResult.message;

    const conversationMembers =
      await prisma.conversationMember.findMany({
        where: {
          conversationId,
          userId: {
            not: userId,
          },
        },
        select: {
          userId: true,
        },
      });

    const realtimePayload = {
      conversationId,
      message,
    };

    /*
     * Keep the existing conversation-room event for users who
     * currently have this chat open.
     */
    emitToConversation(
      conversationId,
      "message_new",
      realtimePayload,
    );

    /*
     * Also notify each recipient's private user room. This is
     * required when the recipient is on another screen/chat and
     * needs the conversation-list unread indicator.
     */
    for (const member of conversationMembers) {
      emitToUser(
        member.userId,
        "message_new",
        realtimePayload,
      );
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error("Message creation failed:", error);
    res.status(500).json({
      error: "Unable to create message",
    });
  }
}

export async function list(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;
    const { cursor } = req.query;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (
      typeof conversationId !== "string" ||
      conversationId.trim().length === 0
    ) {
      res.status(400).json({
        error: "conversationId is required",
      });
      return;
    }

    if (
      cursor !== undefined &&
      typeof cursor !== "string"
    ) {
      res.status(400).json({
        error: "cursor must be a string",
      });
      return;
    }

    const messages = await getConversationMessages(
      conversationId,
      userId,
      cursor,
    );

    if (!messages) {
      res.status(404).json({
        error: "Conversation not found",
      });
      return;
    }

    res.status(200).json({ messages });
  } catch (error) {
    console.error("Message retrieval failed:", error);
    res.status(500).json({
      error: "Unable to retrieve messages",
    });
  }
}

export async function update(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { messageId } = req.params;
    const { action, content } = req.body;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (
      typeof messageId !== "string" ||
      messageId.trim().length === 0
    ) {
      res.status(400).json({
        error: "messageId is required",
      });
      return;
    }

    if (action !== "edit" && action !== "delete") {
      res.status(400).json({
        error: "action must be edit or delete",
      });
      return;
    }

    if (
      action === "edit" &&
      (typeof content !== "string" || content.trim().length === 0)
    ) {
      res.status(400).json({
        error: "Message content is required for editing",
      });
      return;
    }

    const result = await updateMessage(
      messageId,
      userId,
      action,
      content,
    );

    if (result.status === "not_found") {
      res.status(404).json({
        error: "Message not found",
      });
      return;
    }

    if (result.status === "forbidden") {
      res.status(403).json({
        error: "You can only modify your own messages",
      });
      return;
    }

    if (result.status === "invalid_content") {
      res.status(400).json({
        error: "Message content is required for editing",
      });
      return;
    }

    /*
     * The service uses the same `deleted` status for a successful
     * deletion and for an already-deleted message. A successful
     * deletion includes `message`; an already-deleted message does
     * not. Only the latter should be treated as a conflict.
     */
    if (
      result.status === "deleted" &&
      !("message" in result)
    ) {
      res.status(409).json({
        error: "Message has already been deleted",
      });
      return;
    }

    const updatedMessage = result.message;

if (!updatedMessage) {
  res.status(500).json({
    error: "Message update did not return a message",
  });
  return;
}

const conversationId = updatedMessage.conversationId;

    const conversationMembers =
      await prisma.conversationMember.findMany({
        where: {
          conversationId,
        },
        select: {
          userId: true,
        },
      });

    const realtimePayload = {
      conversationId,
      message: updatedMessage,
    };

    /*
     * Notify users who currently have this conversation open.
     */
    emitToConversation(
      conversationId,
      "message_updated",
      realtimePayload,
    );

    /*
     * Also notify every conversation member's private room so
     * edits/deletions reach users who are viewing another chat.
     */
    for (const member of conversationMembers) {
      emitToUser(
        member.userId,
        "message_updated",
        realtimePayload,
      );
    }

    res.status(200).json({
      message: updatedMessage,
    });
  } catch (error) {
    console.error("Message update failed:", error);
    res.status(500).json({
      error: "Unable to update message",
    });
  }
}
