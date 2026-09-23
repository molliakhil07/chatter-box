import type { Request, Response } from "express";
import {
  createConversation,
  getUserConversations,
} from "../services/conversation.service";

export async function create(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const conversation = await createConversation(userId);

    res.status(201).json({ conversation });
  } catch (error) {
    console.error("Conversation creation failed:", error);
    res.status(500).json({ error: "Unable to create conversation" });
  }
}

export async function list(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const conversations = await getUserConversations(userId);

    res.status(200).json({ conversations });
  } catch (error) {
    console.error("Conversation retrieval failed:", error);
    res.status(500).json({ error: "Unable to retrieve conversations" });
  }
}