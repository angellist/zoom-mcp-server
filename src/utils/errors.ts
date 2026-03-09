import axios from "axios";
import { z } from "zod";

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const zoomCode = error.response?.data?.code;
    const zoomMessage = error.response?.data?.message;

    const detail = zoomMessage ? ` ${zoomMessage}` : "";

    switch (status) {
      case 400:
        return `Error: Invalid request parameters.${detail}`;
      case 401:
        return "Error: Authentication failed. Check your ZOOM_API_TOKEN or ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET.";
      case 403:
        return "Error: Permission denied. Your token may lack the required scopes.";
      case 404:
        return `Error: Resource not found. Verify the ID is correct.${detail}`;
      case 409:
        return `Error: Conflict. The resource may already exist.${detail}`;
      case 429:
        return "Error: Rate limit exceeded. Wait before retrying.";
      default:
        return `Error: Zoom API request failed (HTTP ${status ?? "unknown"}, code ${zoomCode ?? "unknown"}).${detail}`;
    }
  }

  if (error instanceof z.ZodError) {
    return `Error: Invalid input - ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`;
  }

  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

type ToolResult = {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
};

export function createToolResponse(data: object): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function createErrorResponse(message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
