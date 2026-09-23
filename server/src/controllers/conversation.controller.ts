import type { Request, Response } from "express";
import {
  createConversation,
  findDirectConversation,
  getConversationById,
  getUserConversations,
  userExists,
} from "../services/conversation.service";

export async function create(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { otherUserId } = req.body;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (
      typeof otherUserId !== "string" ||
      otherUserId.trim().length === 0
    ) {
      res.status(400).json({
        error: "otherUserId is required",
      });
      return;
    }

    const normalizedOtherUserId = otherUserId.trim();

    if (normalizedOtherUserId === userId) {
      res.status(400).json({
        error: "Cannot create a conversation with yourself",
      });
      return;
    }

    const otherUserExists = await userExists(normalizedOtherUserId);

    if (!otherUserExists) {
      res.status(404).json({
        error: "User not found",
      });
      return;
    }

    const existingConversation = await findDirectConversation(
      userId,
      normalizedOtherUserId,
    );

    if (existingConversation) {
      res.status(200).json({
        conversation: existingConversation,
        existing: true,
      });
      return;
    }

    const conversation = await createConversation(
      userId,
      normalizedOtherUserId,
    );

    res.status(201).json({ conversation });
  } catch (error) {
    console.error("Conversation creation failed:", error);
    res.status(500).json({
      error: "Unable to create conversation",
    });
  }
}

export async function list(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    const conversations = await getUserConversations(userId);

    res.status(200).json({ conversations });
  } catch (error) {
    console.error("Conversation retrieval failed:", error);
    res.status(500).json({
      error: "Unable to retrieve conversations",
    });
  }
}
export async function getById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;

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

    const conversation = await getConversationById(
      conversationId,
      userId,
    );

    if (!conversation) {
      res.status(404).json({
        error: "Conversation not found",
      });
      return;
    }

    res.status(200).json({ conversation });
  } catch (error) {
    console.error("Conversation retrieval failed:", error);
    res.status(500).json({
      error: "Unable to retrieve conversation",
    });
  }
}