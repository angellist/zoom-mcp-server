import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest } from "../services/zoom-client.js";
import { withRetry } from "../utils/retry.js";
import { handleApiError, createToolResponse, createErrorResponse } from "../utils/errors.js";
import { buildPaginatedOutput } from "../utils/pagination.js";
import type { ZoomMeeting, ZoomPastMeeting, ZoomPastMeetingParticipant, ZoomRegistrant } from "../types.js";

export function registerMeetingTools(server: McpServer): void {
  server.registerTool(
    "zoom_list_meetings",
    {
      title: "List Meetings",
      description:
        "List meetings for a specific user. Returns paginated results.\n\nUse when: browsing a user's scheduled, live, or upcoming meetings.\nDo NOT use when: you have a specific meeting ID (use zoom_get_meeting instead).",
      inputSchema: {
        user_id: z.string().min(1).describe("The user ID or email address"),
        type: z
          .enum(["scheduled", "live", "upcoming"])
          .default("scheduled")
          .describe("Filter by meeting type"),
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
    async ({ user_id, type, page_size, page_number }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            page_count: number;
            page_number: number;
            page_size: number;
            total_records: number;
            meetings: ZoomMeeting[];
          }>(`users/${encodeURIComponent(user_id)}/meetings`, "GET", undefined, {
            type,
            page_size,
            page_number,
          }),
        );

        const offset = (data.page_number - 1) * data.page_size;
        const output = buildPaginatedOutput(data.meetings, data.total_records, offset, data.page_size);
        return createToolResponse(output);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_get_meeting",
    {
      title: "Get Meeting",
      description:
        "Retrieve details of a specific meeting by its ID.\n\nUse when: you need full meeting details including join URL, settings, and occurrences.\nDo NOT use when: browsing meetings (use zoom_list_meetings instead).",
      inputSchema: {
        meeting_id: z.string().min(1).describe("The meeting ID"),
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
          makeApiRequest<ZoomMeeting>(`meetings/${encodeURIComponent(meeting_id)}`),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_create_meeting",
    {
      title: "Create Meeting",
      description:
        "Create a new meeting for a user. Returns the meeting with join URL.\n\nUse when: scheduling a new meeting.\nDo NOT use when: updating an existing meeting (use zoom_update_meeting instead).",
      inputSchema: {
        user_id: z.string().min(1).describe("Host user ID or email"),
        topic: z.string().max(200).optional().describe("Meeting topic/title"),
        type: z
          .number()
          .int()
          .refine((v) => [1, 2, 3, 8].includes(v), "Must be 1 (instant), 2 (scheduled), 3 (recurring no fixed time), or 8 (recurring fixed time)")
          .default(2)
          .describe("Meeting type: 1=instant, 2=scheduled, 3=recurring (no fixed time), 8=recurring (fixed time)"),
        start_time: z
          .string()
          .optional()
          .describe("Start time in ISO 8601 format (e.g. '2024-01-15T10:00:00Z'). Required for type 2 and 8."),
        duration: z.number().int().min(1).optional().describe("Duration in minutes"),
        timezone: z
          .string()
          .optional()
          .describe("Timezone (e.g. 'America/Los_Angeles'). For scheduled meetings."),
        password: z
          .string()
          .max(10)
          .optional()
          .describe("Meeting password. Allowed chars: [a-zA-Z0-9@-_*]"),
        agenda: z.string().max(2000).optional().describe("Meeting description/agenda"),
        auto_recording: z
          .enum(["local", "cloud", "none"])
          .default("none")
          .describe("Auto-recording setting"),
        join_before_host: z.boolean().default(false).describe("Allow join before host"),
        mute_upon_entry: z.boolean().default(false).describe("Mute participants on entry"),
        host_video: z.boolean().optional().describe("Start video when host joins"),
        participant_video: z.boolean().optional().describe("Start video when participants join"),
        alternative_hosts: z
          .string()
          .optional()
          .describe("Alternative host emails, comma-separated"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ user_id, topic, type, start_time, duration, timezone, password, agenda, auto_recording, join_before_host, mute_upon_entry, host_video, participant_video, alternative_hosts }) => {
      try {
        const body: Record<string, unknown> = { topic, type, start_time, duration, timezone, password, agenda };
        body.settings = {
          auto_recording,
          join_before_host,
          mute_upon_entry,
          host_video,
          participant_video,
          alternative_hosts,
        };

        const data = await withRetry(() =>
          makeApiRequest<ZoomMeeting>(`users/${encodeURIComponent(user_id)}/meetings`, "POST", body),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_update_meeting",
    {
      title: "Update Meeting",
      description:
        "Update a meeting's details (topic, time, settings, etc.).\n\nUse when: modifying an existing scheduled meeting.\nDo NOT use when: creating a new meeting (use zoom_create_meeting) or ending a live meeting (use zoom_end_meeting).",
      inputSchema: {
        meeting_id: z.string().min(1).describe("The meeting ID"),
        topic: z.string().max(200).optional().describe("Updated topic"),
        start_time: z.string().optional().describe("Updated start time in ISO 8601"),
        duration: z.number().int().min(1).optional().describe("Updated duration in minutes"),
        timezone: z.string().optional().describe("Updated timezone"),
        password: z.string().max(10).optional().describe("Updated password"),
        agenda: z.string().max(2000).optional().describe("Updated agenda"),
        auto_recording: z.enum(["local", "cloud", "none"]).optional().describe("Updated recording setting"),
        join_before_host: z.boolean().optional().describe("Allow join before host"),
        mute_upon_entry: z.boolean().optional().describe("Mute on entry"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ meeting_id, topic, start_time, duration, timezone, password, agenda, auto_recording, join_before_host, mute_upon_entry }) => {
      try {
        const body: Record<string, unknown> = {};
        if (topic !== undefined) body.topic = topic;
        if (start_time !== undefined) body.start_time = start_time;
        if (duration !== undefined) body.duration = duration;
        if (timezone !== undefined) body.timezone = timezone;
        if (password !== undefined) body.password = password;
        if (agenda !== undefined) body.agenda = agenda;

        const settings: Record<string, unknown> = {};
        if (auto_recording !== undefined) settings.auto_recording = auto_recording;
        if (join_before_host !== undefined) settings.join_before_host = join_before_host;
        if (mute_upon_entry !== undefined) settings.mute_upon_entry = mute_upon_entry;
        if (Object.keys(settings).length > 0) body.settings = settings;

        await withRetry(() =>
          makeApiRequest(`meetings/${encodeURIComponent(meeting_id)}`, "PATCH", body),
        );
        return createToolResponse({ success: true, message: `Meeting ${meeting_id} updated.` });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_delete_meeting",
    {
      title: "Delete Meeting",
      description:
        "Delete a scheduled meeting.\n\nUse when: cancelling a meeting entirely.\nDo NOT use when: ending a live meeting (use zoom_end_meeting instead).",
      inputSchema: {
        meeting_id: z.string().min(1).describe("The meeting ID"),
        occurrence_id: z.string().optional().describe("Specific occurrence ID for recurring meetings"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ meeting_id, occurrence_id }) => {
      try {
        await withRetry(() =>
          makeApiRequest(
            `meetings/${encodeURIComponent(meeting_id)}`,
            "DELETE",
            undefined,
            occurrence_id ? { occurrence_id } : undefined,
          ),
        );
        return createToolResponse({ success: true, message: `Meeting ${meeting_id} deleted.` });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_end_meeting",
    {
      title: "End Meeting",
      description:
        "End a currently live meeting.\n\nUse when: you need to stop an in-progress meeting.\nDo NOT use when: deleting a scheduled meeting (use zoom_delete_meeting instead).",
      inputSchema: {
        meeting_id: z.string().min(1).describe("The meeting ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ meeting_id }) => {
      try {
        await withRetry(() =>
          makeApiRequest(`meetings/${encodeURIComponent(meeting_id)}/status`, "PUT", {
            action: "end",
          }),
        );
        return createToolResponse({ success: true, message: `Meeting ${meeting_id} ended.` });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_list_meeting_registrants",
    {
      title: "List Meeting Registrants",
      description:
        "List registrants for a meeting that has registration enabled.\n\nUse when: reviewing who registered for a meeting.\nDo NOT use when: listing past meeting participants (use zoom_get_past_meeting_participants instead).",
      inputSchema: {
        meeting_id: z.string().min(1).describe("The meeting ID"),
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
    async ({ meeting_id, status, page_size, page_number }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            page_count: number;
            page_number: number;
            page_size: number;
            total_records: number;
            registrants: ZoomRegistrant[];
          }>(`meetings/${encodeURIComponent(meeting_id)}/registrants`, "GET", undefined, {
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
    "zoom_get_past_meeting",
    {
      title: "Get Past Meeting Details",
      description:
        "Retrieve details of a past (ended) meeting including participant count and duration.\n\nUse when: reviewing what happened in a completed meeting.\nDo NOT use when: getting details of a scheduled/upcoming meeting (use zoom_get_meeting instead).",
      inputSchema: {
        meeting_uuid: z
          .string()
          .min(1)
          .describe("The meeting UUID. Double-encode if it contains '/' or '//' characters."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ meeting_uuid }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<ZoomPastMeeting>(`past_meetings/${encodeURIComponent(meeting_uuid)}`),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_get_past_meeting_participants",
    {
      title: "Get Past Meeting Participants",
      description:
        "List participants who attended a past meeting.\n\nUse when: finding out who attended a completed meeting and their join/leave times.\nDo NOT use when: listing registrants for an upcoming meeting (use zoom_list_meeting_registrants instead).",
      inputSchema: {
        meeting_uuid: z
          .string()
          .min(1)
          .describe("The meeting UUID"),
        page_size: z.number().int().min(1).max(300).default(30).describe("Records per page"),
        next_page_token: z.string().optional().describe("Token for the next page of results"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ meeting_uuid, page_size, next_page_token }) => {
      try {
        const params: Record<string, unknown> = { page_size };
        if (next_page_token) params.next_page_token = next_page_token;

        const data = await withRetry(() =>
          makeApiRequest<{
            page_size: number;
            total_records: number;
            next_page_token: string;
            participants: ZoomPastMeetingParticipant[];
          }>(`past_meetings/${encodeURIComponent(meeting_uuid)}/participants`, "GET", undefined, params),
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
    "zoom_list_user_meeting_reports",
    {
      title: "List User Meeting Reports",
      description:
        "List all meetings a user hosted or attended within a date range. Unlike zoom_list_meetings which only shows hosted meetings, this shows ALL meetings including ones the user joined as a participant.\n\nUse when: finding all meetings a user was part of (hosted + attended) in a date range.\nDo NOT use when: listing only hosted/scheduled meetings (use zoom_list_meetings instead).",
      inputSchema: {
        user_id: z.string().min(1).describe("The user ID or email address"),
        from: z.string().describe("Start date in YYYY-MM-DD format"),
        to: z.string().describe("End date in YYYY-MM-DD format (max 1 month range)"),
        type: z
          .enum(["past", "pastOne", "pastJoined"])
          .default("pastJoined")
          .describe("'past' = hosted meetings, 'pastOne' = single past instances, 'pastJoined' = all meetings the user joined"),
        page_size: z.number().int().min(1).max(300).default(30).describe("Records per page"),
        next_page_token: z.string().optional().describe("Token for the next page"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ user_id, from, to, type, page_size, next_page_token }) => {
      try {
        const params: Record<string, unknown> = { from, to, type, page_size };
        if (next_page_token) params.next_page_token = next_page_token;

        const data = await withRetry(() =>
          makeApiRequest<{
            from: string;
            to: string;
            page_size: number;
            total_records: number;
            next_page_token: string;
            meetings: Array<{
              uuid: string;
              id: number;
              host_id: string;
              topic: string;
              type: number;
              start_time: string;
              end_time: string;
              duration: number;
              total_minutes: number;
              participants_count: number;
              source: string;
            }>;
          }>(`report/users/${encodeURIComponent(user_id)}/meetings`, "GET", undefined, params),
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
}
