import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";

import { registerUserTools } from "./tools/users.js";
import { registerMeetingTools } from "./tools/meetings.js";
import { registerWebinarTools } from "./tools/webinars.js";
import { registerRecordingTools } from "./tools/recordings.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "zoom-mcp-server",
    version: "1.0.0",
  });

  registerUserTools(server);
  registerMeetingTools(server);
  registerWebinarTools(server);
  registerRecordingTools(server);

  return server;
}

function validateConfig(): void {
  const hasStaticToken = !!process.env.ZOOM_API_TOKEN;
  const hasOAuthCreds =
    !!process.env.ZOOM_ACCOUNT_ID &&
    !!process.env.ZOOM_CLIENT_ID &&
    !!process.env.ZOOM_CLIENT_SECRET;

  if (!hasStaticToken && !hasOAuthCreds) {
    console.error(
      "Missing Zoom credentials. Set either:\n" +
        "  - ZOOM_API_TOKEN (static bearer token)\n" +
        "  - ZOOM_ACCOUNT_ID + ZOOM_CLIENT_ID + ZOOM_CLIENT_SECRET (Server-to-Server OAuth)\n",
    );
    process.exit(1);
  }
}

async function startHttpServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close().catch(() => {});
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "zoom-mcp-server", version: "1.0.0" });
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  app.listen(port, () => {
    console.error(`zoom-mcp-server listening on http://localhost:${port}/mcp`);
  });
}

async function startStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("zoom-mcp-server running on stdio");
}

async function main(): Promise<void> {
  validateConfig();

  const transport = process.env.MCP_TRANSPORT || "http";
  if (transport === "stdio") {
    await startStdioServer();
  } else {
    await startHttpServer();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
