import type { Server } from "socket.io";

let io: Server | null = null;

export function setSocketIO(server: Server): void {
  io = server;
}

export function getSocketIO(): Server | null {
  return io;
}

export function emitToConversation(
  conversationId: string,
  event: string,
  payload: unknown,
): void {
  io
    ?.to(`conversation:${conversationId}`)
    .emit(event, payload);
}

export function emitMessageStatus(
  conversationId: string,
  payload: unknown,
): void {
  emitToConversation(
    conversationId,
    "message_status",
    payload,
  );
}

export function emitMessageRead(
  conversationId: string,
  payload: unknown,
): void {
  emitMessageStatus(
    conversationId,
    payload,
  );
}

export function emitToUser(
  userId: string,
  event: string,
  payload: unknown,
): void {
  io
    ?.to(`user:${userId}`)
    .emit(event, payload);
}
