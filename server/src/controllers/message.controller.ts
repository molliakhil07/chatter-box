import type { Request, Response } from "express";
import {
  createMessage,
  getConversationMessages,
  updateMessage,
} from "../services/message.service";
import { emitToConversation } from "../socket";

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

    if (
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
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

    emitToConversation(
      conversationId,
      "message_new",
      {
        conversationId,
        message,
      },
    );

    res.status(201).json({ message });
  } catch (error) {
    console.error(
      "Message creation failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to create message",
    });
  }
}

/* ---------------- MESSAGE HISTORY ---------------- */

export async function list(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;

    const cursorParam = req.query.cursor;
    const beforeParam = req.query.before;
    const limitParam = req.query.limit;

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

    const cursor =
      typeof beforeParam === "string"
        ? beforeParam
        : typeof cursorParam === "string"
          ? cursorParam
          : undefined;

    if (
      cursorParam !== undefined &&
      typeof cursorParam !== "string"
    ) {
      res.status(400).json({
        error: "cursor must be a string",
      });
      return;
    }

    if (
      beforeParam !== undefined &&
      typeof beforeParam !== "string"
    ) {
      res.status(400).json({
        error: "before must be a string",
      });
      return;
    }

    let limit = 30;

    if (limitParam !== undefined) {
      if (typeof limitParam !== "string") {
        res.status(400).json({
          error: "limit must be a number",
        });
        return;
      }

      const parsedLimit = Number(limitParam);

      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 50
      ) {
        res.status(400).json({
          error:
            "limit must be an integer between 1 and 50",
        });
        return;
      }

      limit = parsedLimit;
    }

    const result =
      await getConversationMessages(
        conversationId,
        userId,
        cursor,
        limit,
      );

    if (!result) {
      res.status(404).json({
        error: "Conversation not found",
      });
      return;
    }

    res.status(200).json({
      items: result.items,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    console.error(
      "Message retrieval failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to retrieve messages",
    });
  }
}

/* ---------------- MESSAGE UPDATE ---------------- */

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

    if (
      action !== "edit" &&
      action !== "delete"
    ) {
      res.status(400).json({
        error: "action must be edit or delete",
      });
      return;
    }

    if (
      action === "edit" &&
      (
        typeof content !== "string" ||
        content.trim().length === 0
      )
    ) {
      res.status(400).json({
        error:
          "Message content is required for editing",
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
        error:
          "You can only modify your own messages",
      });
      return;
    }

    if (
      result.status === "invalid_content"
    ) {
      res.status(400).json({
        error:
          "Message content is required for editing",
      });
      return;
    }

    if (result.status === "deleted") {
      res.status(409).json({
        error:
          "Message has already been deleted",
      });
      return;
    }

    res.status(200).json({
      message: result.message,
    });
  } catch (error) {
    console.error(
      "Message update failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to update message",
    });
  }
}