import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest } from "../services/zoom-client.js";
import { withRetry } from "../utils/retry.js";
import { handleApiError, createToolResponse, createErrorResponse } from "../utils/errors.js";
import { buildPaginatedOutput } from "../utils/pagination.js";
import type { ZoomRecordingMeeting } from "../types.js";

export function registerRecordingTools(server: McpServer): void {
  server.registerTool(
    "zoom_list_recordings",
    {
      title: "List Recordings",
      description:
        "List cloud recordings for a user within a date range.\n\nUse when: browsing a user's recorded meetings.\nDo NOT use when: getting recordings for a specific meeting (use zoom_get_meeting_recordings instead).",
      inputSchema: {
        user_id: z.string().min(1).describe("The user ID or email address"),
        from: z
          .string()
          .describe("Start date in YYYY-MM-DD format. Max range with 'to' is 1 month."),
        to: z
          .string()
          .describe("End date in YYYY-MM-DD format. Max range with 'from' is 1 month."),
        page_size: z.number().int().min(1).max(300).default(30).describe("Records per page"),
        next_page_token: z
          .string()
          .optional()
          .describe("Token for the next page of results"),
        trash: z
          .boolean()
          .default(false)
          .describe("List recordings from the trash"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ user_id, from, to, page_size, next_page_token, trash }) => {
      try {
        const params: Record<string, unknown> = { from, to, page_size, trash };
        if (next_page_token) params.next_page_token = next_page_token;

        const data = await withRetry(() =>
          makeApiRequest<{
            from: string;
            to: string;
            page_count: number;
            page_size: number;
            total_records: number;
            next_page_token: string;
            meetings: ZoomRecordingMeeting[];
          }>(`users/${encodeURIComponent(user_id)}/recordings`, "GET", undefined, params),
        );

        const output = {
          from: data.from,
          to: data.to,
          total: data.total_records,
          count: data.meetings.length,
          items: data.meetings,
          has_more: !!data.next_page_token,
          next_page_token: data.next_page_token || undefined,
        };
        return createToolResponse(output);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_get_meeting_recordings",
    {
      title: "Get Meeting Recordings",
      description:
        "Retrieve all recording files for a specific meeting.\n\nUse when: you need recording download URLs or details for a known meeting.\nDo NOT use when: browsing all recordings (use zoom_list_recordings instead).",
      inputSchema: {
        meeting_id: z
          .string()
          .min(1)
          .describe("The meeting ID or meeting UUID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ meeting_id }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<ZoomRecordingMeeting>(
            `meetings/${encodeURIComponent(meeting_id)}/recordings`,
          ),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_delete_meeting_recordings",
    {
      title: "Delete Meeting Recordings",
      description:
        "Delete all recording files for a meeting. By default, moves to trash.\n\nUse when: removing all recordings from a meeting.\nDo NOT use when: deleting a single recording file (use zoom_delete_recording_file instead).",
      inputSchema: {
        meeting_id: z.string().min(1).describe("The meeting ID or meeting UUID"),
        action: z
          .enum(["trash", "delete"])
          .default("trash")
          .describe("'trash' moves to trash (recoverable), 'delete' permanently removes"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ meeting_id, action }) => {
      try {
        await withRetry(() =>
          makeApiRequest(
            `meetings/${encodeURIComponent(meeting_id)}/recordings`,
            "DELETE",
            undefined,
            { action },
          ),
        );
        return createToolResponse({
          success: true,
          message: `Recordings for meeting ${meeting_id} ${action === "delete" ? "permanently deleted" : "moved to trash"}.`,
        });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_delete_recording_file",
    {
      title: "Delete Recording File",
      description:
        "Delete a single recording file from a meeting.\n\nUse when: removing one specific recording file.\nDo NOT use when: deleting all recordings for a meeting (use zoom_delete_meeting_recordings instead).",
      inputSchema: {
        meeting_id: z.string().min(1).describe("The meeting ID or meeting UUID"),
        recording_id: z.string().min(1).describe("The recording file ID"),
        action: z
          .enum(["trash", "delete"])
          .default("trash")
          .describe("'trash' moves to trash, 'delete' permanently removes"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ meeting_id, recording_id, action }) => {
      try {
        await withRetry(() =>
          makeApiRequest(
            `meetings/${encodeURIComponent(meeting_id)}/recordings/${encodeURIComponent(recording_id)}`,
            "DELETE",
            undefined,
            { action },
          ),
        );
        return createToolResponse({
          success: true,
          message: `Recording ${recording_id} ${action === "delete" ? "permanently deleted" : "moved to trash"}.`,
        });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_recover_meeting_recordings",
    {
      title: "Recover Meeting Recordings",
      description:
        "Recover all trashed recordings for a meeting.\n\nUse when: restoring accidentally deleted recordings.\nDo NOT use when: recordings were permanently deleted (cannot be recovered).",
      inputSchema: {
        meeting_id: z.string().min(1).describe("The meeting ID or meeting UUID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ meeting_id }) => {
      try {
        await withRetry(() =>
          makeApiRequest(
            `meetings/${encodeURIComponent(meeting_id)}/recordings/status`,
            "PUT",
            { action: "recover" },
          ),
        );
        return createToolResponse({
          success: true,
          message: `Recordings for meeting ${meeting_id} recovered from trash.`,
        });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );
}
