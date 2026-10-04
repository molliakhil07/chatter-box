import type { ErrorRequestHandler } from "express";
import { logError } from "../logger";

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status =
    typeof error?.status === "number" &&
    error.status >= 400 &&
    error.status < 500
      ? error.status
      : error?.type === "entity.too.large"
        ? 413
        : error?.type === "entity.parse.failed"
          ? 400
          : 500;

  if (status >= 500) {
    logError("Unhandled HTTP request error", error);
  }

  if (error?.type === "entity.too.large") {
    res.status(413).json({
      error: "Request body is too large",
    });
    return;
  }

  if (error?.type === "entity.parse.failed") {
    res.status(400).json({
      error: "Invalid JSON request body",
    });
    return;
  }

  res.status(status).json({
    error: status >= 500
      ? "Internal server error"
      : "Unable to process request",
  });
};
