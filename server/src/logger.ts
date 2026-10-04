export function logError(context: string, error?: unknown): void {
  const errorType = error instanceof Error ? error.name : typeof error;
  console.error(`[server-error] ${context} (${errorType})`);
}
