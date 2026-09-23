import type { Request, Response } from "express";
import {
  createMessage,
  getConversationMessages,
  updateMessage,
} from "../services/message.service";

export async function create(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;
    const { content } = req.body;

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

    const message = await createMessage(
      conversationId,
      userId,
      content.trim(),
    );

    if (!message) {
      res.status(404).json({
        error: "Conversation not found",
      });
      return;
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

    if (result.status === "deleted") {
      res.status(409).json({
        error: "Message has already been deleted",
      });
      return;
    }

    res.status(200).json({
      message: result.message,
    });
  } catch (error) {
    console.error("Message update failed:", error);
    res.status(500).json({
      error: "Unable to update message",
    });
  }
}