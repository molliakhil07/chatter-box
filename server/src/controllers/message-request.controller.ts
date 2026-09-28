import type { Request, Response } from "express";

import { emitToUser } from "../socket";

import {
  createMessageRequest,
  getIncomingMessageRequests,
  getAcceptedMessageRequestNotification,
  markAcceptedMessageRequestSeen,
  acceptMessageRequest,
  rejectMessageRequest,
} from "../services/message-request.service";

export async function create(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const senderId = req.userId;
    const { receiverId } = req.body;

    if (!senderId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (
      typeof receiverId !== "string" ||
      receiverId.trim().length === 0
    ) {
      res.status(400).json({
        error: "receiverId is required",
      });
      return;
    }

    const result = await createMessageRequest(
      senderId,
      receiverId.trim(),
    );

    if (result.status === "self_request") {
      res.status(400).json({
        error: "You cannot send a message request to yourself",
      });
      return;
    }

    if (result.status === "user_not_found") {
      res.status(404).json({
        error: "User not found",
      });
      return;
    }

    if (result.status === "already_connected") {
      res.status(409).json({
        error: "A conversation already exists with this user",
      });
      return;
    }

    if (result.status === "request_exists") {
      res.status(409).json({
        error: "A message request is already pending",
      });
      return;
    }

    if (!("request" in result)) {
  res.status(500).json({
    error: "Unable to send message request",
  });
  return;
}

res.status(201).json({
  request: result.request,
});
  } catch (error) {
    console.error(
      "Message request creation failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to send message request",
    });
  }
}

export async function listIncoming(
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

    const requests =
      await getIncomingMessageRequests(userId);

    res.status(200).json({
      requests,
    });
  } catch (error) {
    console.error(
      "Incoming message request retrieval failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to retrieve incoming message requests",
    });
  }
}

export async function accept(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { requestId } = req.params;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (
      typeof requestId !== "string" ||
      requestId.trim().length === 0
    ) {
      res.status(400).json({
        error: "requestId is required",
      });
      return;
    }

    const result = await acceptMessageRequest(
      requestId,
      userId,
    );

    if (result.status === "request_not_found") {
      res.status(404).json({
        error: "Message request not found",
      });
      return;
    }

    if (result.status === "forbidden") {
      res.status(403).json({
        error: "You cannot accept this message request",
      });
      return;
    }

    if (result.status === "request_not_pending") {
      res.status(409).json({
        error: "Message request is no longer pending",
      });
      return;
    }

    if (result.status === "already_connected") {
      res.status(409).json({
        error: "A conversation already exists with this user",
      });
      return;
    }

    if (
      result.status !== "accepted" ||
      !("conversation" in result)
    ) {
      res.status(500).json({
        error: "Unable to accept message request",
      });
      return;
    }

    emitToUser(result.request.senderId, "message_request_accepted", {
      requestId: result.request.id,
      conversationId: result.conversation.id,
      acceptedBy: result.acceptedBy,
      respondedAt: result.request.respondedAt,
    });

    res.status(200).json({
      request: result.request,
      conversation: result.conversation,
    });
  } catch (error) {
    console.error(
      "Message request acceptance failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to accept message request",
    });
  }
}


export async function accepted(
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

    const notification =
      await getAcceptedMessageRequestNotification(userId);

    res.status(200).json({
      notification,
    });
  } catch (error) {
    console.error(
      "Accepted message request retrieval failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to retrieve accepted message request",
    });
  }
}

export async function acceptedSeen(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { requestId } = req.params;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (
      typeof requestId !== "string" ||
      requestId.trim().length === 0
    ) {
      res.status(400).json({
        error: "requestId is required",
      });
      return;
    }

    const result =
      await markAcceptedMessageRequestSeen(
        requestId,
        userId,
      );

    if (result.status === "request_not_found") {
      res.status(404).json({
        error: "Message request not found",
      });
      return;
    }

    if (result.status === "forbidden") {
      res.status(403).json({
        error: "You cannot update this message request",
      });
      return;
    }

    if (result.status === "request_not_accepted") {
      res.status(409).json({
        error: "Message request has not been accepted",
      });
      return;
    }

    res.status(200).json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Accepted message request acknowledgement failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to acknowledge accepted message request",
    });
  }
}

export async function reject(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.userId;
    const { requestId } = req.params;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
      });
      return;
    }

    if (
      typeof requestId !== "string" ||
      requestId.trim().length === 0
    ) {
      res.status(400).json({
        error: "requestId is required",
      });
      return;
    }

    const result = await rejectMessageRequest(
      requestId,
      userId,
    );

    if (result.status === "request_not_found") {
      res.status(404).json({
        error: "Message request not found",
      });
      return;
    }

    if (result.status === "forbidden") {
      res.status(403).json({
        error: "You cannot reject this message request",
      });
      return;
    }

    if (result.status === "request_not_pending") {
      res.status(409).json({
        error: "Message request is no longer pending",
      });
      return;
    }

    if (
      result.status !== "rejected" ||
      !("request" in result)
    ) {
      res.status(500).json({
        error: "Unable to reject message request",
      });
      return;
    }

    res.status(200).json({
      request: result.request,
    });
  } catch (error) {
    console.error(
      "Message request rejection failed:",
      error,
    );

    res.status(500).json({
      error: "Unable to reject message request",
    });
  }
}