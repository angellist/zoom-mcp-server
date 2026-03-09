import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest } from "../services/zoom-client.js";
import { withRetry } from "../utils/retry.js";
import { handleApiError, createToolResponse, createErrorResponse } from "../utils/errors.js";
import { buildPaginatedOutput } from "../utils/pagination.js";
import type { ZoomUser } from "../types.js";

export function registerUserTools(server: McpServer): void {
  server.registerTool(
    "zoom_list_users",
    {
      title: "List Users",
      description:
        "List users on the Zoom account. Returns paginated results.\n\nUse when: finding user accounts, browsing the user directory.\nDo NOT use when: you already have the user ID (use zoom_get_user instead).",
      inputSchema: {
        status: z
          .enum(["active", "inactive", "pending"])
          .default("active")
          .describe("Filter by user status"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(300)
          .default(30)
          .describe("Number of records per page"),
        page_number: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("Page number to return"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ status, page_size, page_number }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            page_count: number;
            page_number: number;
            page_size: number;
            total_records: number;
            users: ZoomUser[];
          }>("users", "GET", undefined, { status, page_size, page_number }),
        );

        const offset = (data.page_number - 1) * data.page_size;
        const output = buildPaginatedOutput(data.users, data.total_records, offset, data.page_size);
        return createToolResponse(output);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_get_user",
    {
      title: "Get User",
      description:
        "Retrieve a single user's details by user ID or email address.\n\nUse when: you need detailed info about a specific user.\nDo NOT use when: browsing or searching users (use zoom_list_users instead).",
      inputSchema: {
        user_id: z
          .string()
          .min(1)
          .describe("The user ID or email address"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ user_id }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<ZoomUser>(`users/${encodeURIComponent(user_id)}`),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_create_user",
    {
      title: "Create User",
      description:
        "Create a new user on the Zoom account.\n\nUse when: provisioning a new Zoom user.\nDo NOT use when: updating an existing user (use zoom_update_user instead).",
      inputSchema: {
        action: z
          .enum(["create", "autoCreate", "custCreate", "ssoCreate"])
          .describe(
            "How to create the user. 'create' sends activation email, 'autoCreate' for managed domains, 'ssoCreate' for SSO-provisioned users",
          ),
        email: z.string().email().max(128).describe("User email address"),
        type: z
          .number()
          .int()
          .refine((v) => [1, 2, 3].includes(v), "Must be 1 (basic), 2 (pro), or 3 (corp)")
          .describe("User type: 1=basic, 2=pro, 3=corp"),
        first_name: z
          .string()
          .max(64)
          .optional()
          .describe("User first name"),
        last_name: z
          .string()
          .max(64)
          .optional()
          .describe("User last name"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ action, email, type, first_name, last_name }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<ZoomUser>("users", "POST", {
            action,
            user_info: { email, type, first_name, last_name },
          }),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_update_user",
    {
      title: "Update User",
      description:
        "Update an existing user's profile details.\n\nUse when: changing a user's name, type, timezone, department, or other profile fields.\nDo NOT use when: creating a new user (use zoom_create_user instead).",
      inputSchema: {
        user_id: z
          .string()
          .min(1)
          .describe("The user ID or email address"),
        first_name: z.string().max(64).optional().describe("Updated first name"),
        last_name: z.string().max(64).optional().describe("Updated last name"),
        type: z
          .number()
          .int()
          .optional()
          .describe("User type: 1=basic, 2=pro, 3=corp"),
        timezone: z.string().optional().describe("User timezone (e.g. 'America/Los_Angeles')"),
        dept: z.string().optional().describe("Department name"),
        vanity_name: z.string().optional().describe("Personal meeting room name"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ user_id, ...updates }) => {
      try {
        await withRetry(() =>
          makeApiRequest(`users/${encodeURIComponent(user_id)}`, "PATCH", updates),
        );
        return createToolResponse({ success: true, message: `User ${user_id} updated.` });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_delete_user",
    {
      title: "Delete User",
      description:
        "Delete or disassociate a user from the account.\n\nUse when: offboarding a user from Zoom.\nDo NOT use when: deactivating a user (use zoom_update_user to change status instead).",
      inputSchema: {
        user_id: z
          .string()
          .min(1)
          .describe("The user ID or email address"),
        action: z
          .enum(["disassociate", "delete"])
          .default("disassociate")
          .describe("'disassociate' removes from account, 'delete' permanently removes"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ user_id, action }) => {
      try {
        await withRetry(() =>
          makeApiRequest(`users/${encodeURIComponent(user_id)}`, "DELETE", undefined, { action }),
        );
        return createToolResponse({
          success: true,
          message: `User ${user_id} ${action === "delete" ? "permanently deleted" : "disassociated"}.`,
        });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_search_users",
    {
      title: "Search Users",
      description:
        "Search for users by name, email, or other criteria. Filters the full user list server-side by keyword.\n\nUse when: finding a user by partial name or email when you don't have their exact ID.\nDo NOT use when: you already have the user ID or exact email (use zoom_get_user instead).",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe("Search string to match against user name or email"),
        status: z
          .enum(["active", "inactive", "pending"])
          .default("active")
          .describe("Filter by user status"),
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
    async ({ query, status, page_size, page_number }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            page_count: number;
            page_number: number;
            page_size: number;
            total_records: number;
            users: ZoomUser[];
          }>("users", "GET", undefined, { status, page_size, page_number }),
        );

        const q = query.toLowerCase();
        const matched = data.users.filter(
          (u) =>
            u.first_name?.toLowerCase().includes(q) ||
            u.last_name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            `${u.first_name} ${u.last_name}`.toLowerCase().includes(q),
        );

        return createToolResponse({
          query,
          total_scanned: data.users.length,
          total_matched: matched.length,
          items: matched,
          note: matched.length === 0 && data.total_records > data.page_size
            ? "No matches on this page. Try increasing page_size or page_number to search more users."
            : undefined,
        });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_get_user_settings",
    {
      title: "Get User Settings",
      description:
        "Retrieve a user's Zoom settings including meeting defaults, recording preferences, telephony config, and feature access.\n\nUse when: checking or auditing a user's Zoom configuration.\nDo NOT use when: getting basic profile info (use zoom_get_user instead).",
      inputSchema: {
        user_id: z
          .string()
          .min(1)
          .describe("The user ID or email address"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ user_id }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<Record<string, unknown>>(
            `users/${encodeURIComponent(user_id)}/settings`,
          ),
        );
        return createToolResponse(data);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );
}
