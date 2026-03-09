import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest } from "../services/zoom-client.js";
import { withRetry } from "../utils/retry.js";
import { handleApiError, createToolResponse, createErrorResponse } from "../utils/errors.js";

export function registerReportTools(server: McpServer): void {
  server.registerTool(
    "zoom_get_meeting_participant_report",
    {
      title: "Get Meeting Participant Report",
      description:
        "Get a detailed participant report for a past meeting. Returns richer data than zoom_get_past_meeting_participants — includes IP address, device, location, network type, join/leave times, and attentiveness score.\n\nUse when: you need detailed participant analytics for a specific meeting.\nDo NOT use when: you just need names and join times (use zoom_get_past_meeting_participants instead).",
      inputSchema: {
        meeting_id: z
          .string()
          .min(1)
          .describe("The meeting ID or UUID. Double-encode UUIDs containing '/' or '//' characters."),
        page_size: z.number().int().min(1).max(300).default(30).describe("Records per page"),
        next_page_token: z.string().optional().describe("Token for the next page"),
        include_fields: z
          .enum(["registrant_id"])
          .optional()
          .describe("Include additional fields. 'registrant_id' adds registrant info."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ meeting_id, page_size, next_page_token, include_fields }) => {
      try {
        const params: Record<string, unknown> = { page_size };
        if (next_page_token) params.next_page_token = next_page_token;
        if (include_fields) params.include_fields = include_fields;

        const data = await withRetry(() =>
          makeApiRequest<{
            page_size: number;
            total_records: number;
            next_page_token: string;
            participants: Array<{
              id?: string;
              user_id?: string;
              name: string;
              user_email?: string;
              join_time: string;
              leave_time: string;
              duration: number;
              attentiveness_score?: string;
              failover?: boolean;
              status?: string;
              location?: string;
              network_type?: string;
              ip_address?: string;
              device?: string;
              version?: string;
              registrant_id?: string;
            }>;
          }>(`report/meetings/${encodeURIComponent(meeting_id)}/participants`, "GET", undefined, params),
        );

        const output = {
          total: data.total_records,
          count: data.participants.length,
          items: data.participants,
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
    "zoom_list_all_user_reports",
    {
      title: "List All User Activity Reports",
      description:
        "List active/inactive users and their meeting activity across the entire account for a date range. Shows total meetings, meeting minutes, and last login for each user.\n\nUse when: auditing org-wide Zoom usage, finding inactive users, comparing meeting loads across the team.\nDo NOT use when: looking at a single user's meetings (use zoom_list_user_meeting_reports instead).",
      inputSchema: {
        from: z.string().describe("Start date in YYYY-MM-DD format"),
        to: z.string().describe("End date in YYYY-MM-DD format (max 1 month range)"),
        type: z
          .enum(["active", "inactive"])
          .default("active")
          .describe("'active' = users with meeting activity, 'inactive' = users with no activity"),
        page_size: z.number().int().min(1).max(300).default(30).describe("Records per page"),
        page_number: z.number().int().min(1).default(1).describe("Page number"),
        next_page_token: z.string().optional().describe("Token for the next page"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ from, to, type, page_size, page_number, next_page_token }) => {
      try {
        const params: Record<string, unknown> = { from, to, type, page_size, page_number };
        if (next_page_token) params.next_page_token = next_page_token;

        const data = await withRetry(() =>
          makeApiRequest<{
            from: string;
            to: string;
            page_count: number;
            page_size: number;
            total_records: number;
            next_page_token: string;
            users: Array<{
              id: string;
              email: string;
              user_name: string;
              type: number;
              dept?: string;
              meetings: number;
              participants: number;
              meeting_minutes: number;
              last_client_version?: string;
              last_login_time?: string;
              create_time: string;
            }>;
          }>("report/users", "GET", undefined, params),
        );

        const output = {
          from: data.from,
          to: data.to,
          total: data.total_records,
          count: data.users.length,
          items: data.users,
          has_more: !!data.next_page_token || data.total_records > (page_number * page_size),
          next_page_token: data.next_page_token || undefined,
        };
        return createToolResponse(output);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_get_daily_usage_report",
    {
      title: "Get Daily Usage Report",
      description:
        "Get account-level daily usage statistics: total meetings, meeting minutes, participants, and new users for each day in a month.\n\nUse when: getting a high-level overview of Zoom usage trends.\nDo NOT use when: looking at individual user activity (use zoom_list_all_user_reports instead).",
      inputSchema: {
        year: z.number().int().min(2019).describe("Year (e.g. 2026)"),
        month: z.number().int().min(1).max(12).describe("Month (1-12)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ year, month }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            year: number;
            month: number;
            dates: Array<{
              date: string;
              new_users: number;
              meetings: number;
              participants: number;
              meeting_minutes: number;
            }>;
          }>("report/daily", "GET", undefined, { year, month }),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_get_meeting_quality",
    {
      title: "Get Meeting Quality Scores",
      description:
        "Get quality of service (QoS) data for participants in a past meeting. Returns audio/video/screen-share quality metrics including bitrate, latency, jitter, and packet loss.\n\nUse when: diagnosing audio/video quality issues in a past meeting.\nDo NOT use when: listing meeting participants (use zoom_get_meeting_participant_report instead).",
      inputSchema: {
        meeting_id: z
          .string()
          .min(1)
          .describe("The meeting ID or UUID. Double-encode UUIDs containing '/' or '//' characters."),
        page_size: z.number().int().min(1).max(10).default(10).describe("Records per page (max 10)"),
        next_page_token: z.string().optional().describe("Token for the next page"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ meeting_id, page_size, next_page_token }) => {
      try {
        const params: Record<string, unknown> = { page_size };
        if (next_page_token) params.next_page_token = next_page_token;

        const data = await withRetry(() =>
          makeApiRequest<{
            page_size: number;
            next_page_token: string;
            participants: Array<{
              user_id?: string;
              user_name: string;
              email?: string;
              join_time: string;
              leave_time: string;
              device: string;
              ip_address: string;
              location: string;
              network_type: string;
              version: string;
              user_qos: Array<{
                date_time: string;
                audio_input?: Record<string, unknown>;
                audio_output?: Record<string, unknown>;
                video_input?: Record<string, unknown>;
                video_output?: Record<string, unknown>;
                as_input?: Record<string, unknown>;
                as_output?: Record<string, unknown>;
                cpu_usage?: Record<string, unknown>;
              }>;
            }>;
          }>(`metrics/meetings/${encodeURIComponent(meeting_id)}/participants/qos`, "GET", undefined, params),
        );

        const output = {
          count: data.participants.length,
          items: data.participants,
          has_more: !!data.next_page_token,
          next_page_token: data.next_page_token || undefined,
        };
        return createToolResponse(output);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );
}
