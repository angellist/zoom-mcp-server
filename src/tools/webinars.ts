import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest } from "../services/zoom-client.js";
import { withRetry } from "../utils/retry.js";
import { handleApiError, createToolResponse, createErrorResponse } from "../utils/errors.js";
import { buildPaginatedOutput } from "../utils/pagination.js";
import type { ZoomWebinar, ZoomRegistrant } from "../types.js";

export function registerWebinarTools(server: McpServer): void {
  server.registerTool(
    "zoom_list_webinars",
    {
      title: "List Webinars",
      description:
        "List webinars for a specific user. Returns paginated results.\n\nUse when: browsing a user's webinars.\nDo NOT use when: you have a specific webinar ID (use zoom_get_webinar instead).",
      inputSchema: {
        user_id: z.string().min(1).describe("The user ID or email address"),
        page_size: z.number().int().min(1).max(300).default(30).describe("Records per page"),
        page_number: z.number().int().min(1).default(1).describe("Page number"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ user_id, page_size, page_number }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            page_count: number;
            page_number: number;
            page_size: number;
            total_records: number;
            webinars: ZoomWebinar[];
          }>(`users/${encodeURIComponent(user_id)}/webinars`, "GET", undefined, {
            page_size,
            page_number,
          }),
        );

        const offset = (data.page_number - 1) * data.page_size;
        const output = buildPaginatedOutput(data.webinars, data.total_records, offset, data.page_size);
        return createToolResponse(output);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_get_webinar",
    {
      title: "Get Webinar",
      description:
        "Retrieve details of a specific webinar.\n\nUse when: you need full webinar details including join URL, settings, and panelists.\nDo NOT use when: browsing webinars (use zoom_list_webinars instead).",
      inputSchema: {
        webinar_id: z.string().min(1).describe("The webinar ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ webinar_id }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<ZoomWebinar>(`webinars/${encodeURIComponent(webinar_id)}`),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_create_webinar",
    {
      title: "Create Webinar",
      description:
        "Create a new webinar for a user.\n\nUse when: scheduling a webinar.\nDo NOT use when: creating a regular meeting (use zoom_create_meeting instead).",
      inputSchema: {
        user_id: z.string().min(1).describe("Host user ID or email"),
        topic: z.string().max(200).optional().describe("Webinar topic"),
        type: z
          .number()
          .int()
          .refine((v) => [5, 6, 9].includes(v), "Must be 5 (webinar), 6 (recurring no fixed time), or 9 (recurring fixed time)")
          .default(5)
          .describe("Webinar type: 5=webinar, 6=recurring (no fixed time), 9=recurring (fixed time)"),
        start_time: z.string().optional().describe("Start time in ISO 8601 format"),
        duration: z.number().int().min(1).optional().describe("Duration in minutes"),
        timezone: z.string().optional().describe("Timezone (e.g. 'America/New_York')"),
        password: z.string().max(10).optional().describe("Webinar password"),
        agenda: z.string().max(2000).optional().describe("Webinar agenda/description"),
        auto_recording: z.enum(["local", "cloud", "none"]).default("none").describe("Auto-recording setting"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ user_id, topic, type, start_time, duration, timezone, password, agenda, auto_recording }) => {
      try {
        const body: Record<string, unknown> = {
          topic,
          type,
          start_time,
          duration,
          timezone,
          password,
          agenda,
          settings: { auto_recording },
        };
        const data = await withRetry(() =>
          makeApiRequest<ZoomWebinar>(`users/${encodeURIComponent(user_id)}/webinars`, "POST", body),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_update_webinar",
    {
      title: "Update Webinar",
      description:
        "Update an existing webinar's details.\n\nUse when: modifying a scheduled webinar.\nDo NOT use when: creating a new webinar (use zoom_create_webinar instead).",
      inputSchema: {
        webinar_id: z.string().min(1).describe("The webinar ID"),
        topic: z.string().max(200).optional().describe("Updated topic"),
        start_time: z.string().optional().describe("Updated start time in ISO 8601"),
        duration: z.number().int().min(1).optional().describe("Updated duration in minutes"),
        timezone: z.string().optional().describe("Updated timezone"),
        password: z.string().max(10).optional().describe("Updated password"),
        agenda: z.string().max(2000).optional().describe("Updated agenda"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ webinar_id, ...updates }) => {
      try {
        const body: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) body[key] = value;
        }
        await withRetry(() =>
          makeApiRequest(`webinars/${encodeURIComponent(webinar_id)}`, "PATCH", body),
        );
        return createToolResponse({ success: true, message: `Webinar ${webinar_id} updated.` });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_delete_webinar",
    {
      title: "Delete Webinar",
      description:
        "Delete a webinar.\n\nUse when: cancelling a webinar.\nDo NOT use when: ending a live webinar (use zoom_end_meeting with the webinar ID).",
      inputSchema: {
        webinar_id: z.string().min(1).describe("The webinar ID"),
        occurrence_id: z.string().optional().describe("Specific occurrence ID for recurring webinars"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ webinar_id, occurrence_id }) => {
      try {
        await withRetry(() =>
          makeApiRequest(
            `webinars/${encodeURIComponent(webinar_id)}`,
            "DELETE",
            undefined,
            occurrence_id ? { occurrence_id } : undefined,
          ),
        );
        return createToolResponse({ success: true, message: `Webinar ${webinar_id} deleted.` });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_list_webinar_registrants",
    {
      title: "List Webinar Registrants",
      description:
        "List registrants for a webinar.\n\nUse when: reviewing who registered for a webinar.\nDo NOT use when: listing webinar panelists.",
      inputSchema: {
        webinar_id: z.string().min(1).describe("The webinar ID"),
        status: z
          .enum(["pending", "approved", "denied"])
          .default("approved")
          .describe("Filter by registration status"),
        page_size: z.number().int().min(1).max(300).default(30).describe("Records per page"),
        page_number: z.number().int().min(1).default(1).describe("Page number"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ webinar_id, status, page_size, page_number }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            page_count: number;
            page_number: number;
            page_size: number;
            total_records: number;
            registrants: ZoomRegistrant[];
          }>(`webinars/${encodeURIComponent(webinar_id)}/registrants`, "GET", undefined, {
            status,
            page_size,
            page_number,
          }),
        );

        const offset = (data.page_number - 1) * data.page_size;
        const output = buildPaginatedOutput(data.registrants, data.total_records, offset, data.page_size);
        return createToolResponse(output);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_list_webinar_panelists",
    {
      title: "List Webinar Panelists",
      description:
        "List panelists for a webinar. Panelists are speakers/presenters, distinct from registrants who are attendees.\n\nUse when: checking who the speakers/presenters are for a webinar.\nDo NOT use when: listing attendee registrations (use zoom_list_webinar_registrants instead).",
      inputSchema: {
        webinar_id: z.string().min(1).describe("The webinar ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ webinar_id }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            total_records: number;
            panelists: Array<{
              id: string;
              email: string;
              name: string;
              join_url: string;
            }>;
          }>(`webinars/${encodeURIComponent(webinar_id)}/panelists`),
        );
        return createToolResponse({
          total: data.total_records,
          items: data.panelists,
        });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );
}
