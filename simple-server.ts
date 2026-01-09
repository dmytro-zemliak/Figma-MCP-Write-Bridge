import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "simple-test-server",
  version: "0.0.1"
});

// One tiny tool: ping
server.registerTool(
  "ping",
  {
    description: "Sanity check tool.",
    inputSchema: {
      message: z.string().optional()
    }
  },
  async (input) => {
    const msg = input.message ?? "hello";
    return {
      content: [{ type: "text", text: `pong from simple-test-server: ${msg}` }]
    };
  }
);

// IMPORTANT: no console.log here, only MCP traffic on stdout.
// If you really need logs, use console.error (stderr) instead.
const transport = new StdioServerTransport();
await server.connect(transport);
