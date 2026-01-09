import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";

// --- WebSocket bridge to the Figma plugin UI ---
const PORT = 3055;
const HOST = "127.0.0.1";

const wss = new WebSocketServer({ host: HOST, port: PORT });
let pluginClient: WebSocket | null = null;

type Pending = {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
};
const pending = new Map<string, Pending>();

function makeId() {
  return Math.random().toString(36).slice(2);
}

function sendToPlugin(action: string, args: unknown): Promise<any> {
  if (!pluginClient || pluginClient.readyState !== WebSocket.OPEN) {
    throw new Error(
      "Figma plugin not connected. Open Figma → Plugins → Development → MCP Figma Write Bridge."
    );
  }
  const id = makeId();
  const payload = JSON.stringify({ id, action, args });
  pluginClient.send(payload);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Plugin timeout waiting for "${action}" response.`));
    }, 15000);

    pending.set(id, { resolve, reject, timeout });
  });
}

wss.on("connection", (ws) => {
  pluginClient = ws;
  console.error(`[bridge] Plugin connected from ${ws.url ?? "ui.html"}`);


  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const { replyTo, result, error } = msg;
      if (!replyTo) return;

      const p = pending.get(replyTo);
      if (!p) return;

      clearTimeout(p.timeout);
      pending.delete(replyTo);
      if (error) p.reject(new Error(error));
      else p.resolve(result);
    } catch (e) {
      console.error("[bridge] Bad message from plugin:", e);
    }
  });

  ws.on("close", () => {
    console.error("[bridge] Plugin disconnected");
    pluginClient = null;
  });
});

console.error(`[bridge] Waiting for plugin on ws://${HOST}:${PORT}`);

// --- MCP server with tools that forward to the plugin ---
const server = new McpServer({
  name: "figma-write-bridge",
  version: "0.1.0"
});

// Utility to register a tool quickly
function registerTool<T extends z.ZodTypeAny>(
  name: string,
  schema: T,
  description: string,
  action: string
) {
  server.registerTool(
    name,
    {
      title: name,
      description,
      inputSchema: schema as any
    },
    async (input: z.infer<T>, _extra: any) => {
      const result = await sendToPlugin(action, input);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result
      };
    }
  );
}

// --- Tools ---
registerTool(
  "create_frame",
  z.object({
    name: z.string().optional(),
    width: z.number().positive(),
    height: z.number().positive(),
    x: z.number().optional(),
    y: z.number().optional()
  }),
  "Create a frame with width/height and optional name/position.",
  "create_frame"
);

registerTool(
  "add_text",
  z.object({
    text: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
    fontFamily: z.string().optional().default("Inter"),
    fontStyle: z.string().optional().default("Regular"),
    fontSize: z.number().optional().default(32)
  }),
  "Add a text node (loads font) at optional position.",
  "add_text"
);

registerTool(
  "rectangle",
  z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    hex: z.string().optional(), // e.g. #0EA5E9
    x: z.number().optional(),
    y: z.number().optional(),
    cornerRadius: z.number().optional()
  }),
  "Create a rectangle with optional fill color/position/cornerRadius.",
  "rectangle"
);

registerTool(
  "set_position",
  z.object({
    nodeId: z.string(),
    x: z.number(),
    y: z.number()
  }),
  "Move a node to (x,y).",
  "set_position"
);

registerTool(
  "group_nodes",
  z.object({
    nodeIds: z.array(z.string()).min(2),
    name: z.string().optional()
  }),
  "Group the given nodes into a single group.",
  "group_nodes"
);

registerTool(
  "set_fill",
  z.object({
    nodeId: z.string(),
    hex: z.string(),
    opacity: z.number().min(0).max(1).optional()
  }),
  "Apply a solid fill color (optionally opacity) to a node that supports fills.",
  "set_fill"
);

registerTool(
  "find_text_nodes",
  z.object({}),
  "Return all text nodes on the current page with nodeId and content.",
  "find_text_nodes"
);

registerTool(
  "set_text_color",
  z.object({ nodeId: z.string(), hex: z.string(), opacity: z.number().min(0).max(1).optional() }),
  "Set the fill color of a text node.",
  "set_text_color"
);

registerTool(
  "add_icon_placeholder",
  z.object({
    frameId: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    size: z.number().optional(),
    shape: z.enum(["circle", "square"]).optional(),
    hex: z.string().optional()
  }),
  "Insert a simple icon placeholder (circle or square) into a frame or page.",
  "add_icon_placeholder"
);

registerTool(
  "set_interaction_data",
  z.object({ nodeId: z.string(), event: z.string().optional(), targetId: z.string().optional() }),
  "Store interaction mapping in pluginData for a node (non-prototype).",
  "set_interaction_data"
);

registerTool(
  "clear_page",
  z.object({}),
  "Delete all nodes on the current page (use carefully!).",
  "clear_page"
);

// Connect via stdio (VS Code will spawn this process)
const transport = new StdioServerTransport();
await server.connect(transport);
