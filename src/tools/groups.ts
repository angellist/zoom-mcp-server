import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest } from "../services/zoom-client.js";
import { withRetry } from "../utils/retry.js";
import { handleApiError, createToolResponse, createErrorResponse } from "../utils/errors.js";
import { buildPaginatedOutput } from "../utils/pagination.js";

export function registerGroupTools(server: McpServer): void {
  server.registerTool(
    "zoom_list_groups",
    {
      title: "List Groups",
      description:
        "List all groups on the Zoom account.\n\nUse when: browsing org structure, finding a group ID.\nDo NOT use when: you already have the group ID (use zoom_get_group_members instead).",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            total_records: number;
            groups: Array<{
              id: string;
              name: string;
              total_members: number;
            }>;
          }>("groups"),
        );
        return createToolResponse({
          total: data.total_records,
          items: data.groups,
        });
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );

  server.registerTool(
    "zoom_get_group_members",
    {
      title: "Get Group Members",
      description:
        "List all members of a specific group.\n\nUse when: finding who belongs to a group (e.g. Engineering, Sales).\nDo NOT use when: browsing available groups (use zoom_list_groups instead).",
      inputSchema: {
        group_id: z.string().min(1).describe("The group ID"),
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
    async ({ group_id, page_size, page_number }) => {
      try {
        const data = await withRetry(() =>
          makeApiRequest<{
            page_count: number;
            page_number: number;
            page_size: number;
            total_records: number;
            members: Array<{
              id: string;
              email: string;
              first_name: string;
              last_name: string;
              type: number;
              department?: string;
            }>;
          }>(`groups/${encodeURIComponent(group_id)}/members`, "GET", undefined, {
            page_size,
            page_number,
          }),
        );

        const offset = (data.page_number - 1) * data.page_size;
        const output = buildPaginatedOutput(data.members, data.total_records, offset, data.page_size);
        return createToolResponse(output);
      } catch (error) {
        return createErrorResponse(handleApiError(error));
      }
    },
  );
}
