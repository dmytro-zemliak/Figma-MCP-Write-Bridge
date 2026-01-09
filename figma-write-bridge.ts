import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";

// ---------- WebSocket bridge to the Figma plugin UI ----------
const HOST = "127.0.0.1";
const PORT = 3055;

const wss = new WebSocketServer({ host: HOST, port: PORT });
let pluginClient: WebSocket | null = null;

type Pending = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
};
const pending = new Map<string, Pending>();

function makeId() {
  return Math.random().toString(36).slice(2);
}

// All debug -> stderr (never stdout for MCP stdio)
console.error(`[bridge] Waiting for plugin on ws://${HOST}:${PORT}`);

wss.on("connection", (ws) => {
  pluginClient = ws;
  console.error("[bridge] Plugin connected");
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const { replyTo, result, error } = msg || {};
      if (!replyTo) return;
      const p = pending.get(replyTo);
      if (!p) return;
      clearTimeout(p.timeout);
      pending.delete(replyTo);
      error ? p.reject(new Error(error)) : p.resolve(result);
    } catch (e) {
      console.error("[bridge] Bad message from plugin:", e);
    }
  });
  ws.on("close", () => {
    console.error("[bridge] Plugin disconnected");
    pluginClient = null;
  });
});

function sendToPlugin(action: string, args: unknown): Promise<any> {
  if (!pluginClient || pluginClient.readyState !== WebSocket.OPEN) {
    throw new Error("Figma plugin not connected. In Figma: Plugins → Development → MCP Figma Write Bridge.");
  }
  const id = makeId();
  pluginClient.send(JSON.stringify({ id, action, args }));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Plugin timeout for "${action}".`));
    }, 20000);
    pending.set(id, { resolve, reject, timeout });
  });
}

// ---------- MCP server + tools ----------
const server = new McpServer({ name: "figma-write-bridge", version: "1.0.0" });
// Helper to wrap tool results in the MCP expected shape.
// The SDK's type for tool handler return is a fairly loose record with optional
// discriminated `content` array entries (type: "text"|"image"|etc). Without an
// explicit return type, TS sometimes widens the literal "text" to string inside
// the array, causing incompatibility. We pin the literal and allow extra props.
type McpTextContent = { type: "text"; text: string; [x: string]: unknown };
type McpToolReturn = { content: McpTextContent[]; structuredContent: any; [x: string]: unknown };
const ok = (result: any): McpToolReturn => ({
  content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  structuredContent: result
});

// Creation
server.registerTool("create_frame", {
  description: "Create a frame on the current page.",
  inputSchema: { name: z.string().optional(), width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional() }
}, async (input) => ok(await sendToPlugin("create_frame", input)));

server.registerTool("create_rectangle", {
  description: "Create a rectangle.",
  inputSchema: { width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), cornerRadius: z.number().optional(), hex: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_rectangle", input)));

server.registerTool("create_ellipse", {
  description: "Create an ellipse (circle).",
  inputSchema: { width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), hex: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_ellipse", input)));

server.registerTool("create_line", {
  description: "Create a line.",
  inputSchema: { x: z.number().optional(), y: z.number().optional(), length: z.number().positive(), rotation: z.number().optional(), strokeHex: z.string().optional(), strokeWeight: z.number().optional() }
}, async (input) => ok(await sendToPlugin("create_line", input)));

server.registerTool("create_polygon", {
  description: "Create a polygon.",
  inputSchema: { sides: z.number().int().min(3), width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), hex: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_polygon", input)));

server.registerTool("create_star", {
  description: "Create a star.",
  inputSchema: { points: z.number().int().min(3), width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), hex: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_star", input)));

server.registerTool("add_text", {
  description: "Create a text node.",
  inputSchema: { text: z.string(), x: z.number().optional(), y: z.number().optional(), fontFamily: z.string().optional(), fontStyle: z.string().optional(), fontSize: z.number().optional() }
}, async (input) => ok(await sendToPlugin("add_text", input)));

server.registerTool("place_image_base64", {
  description: "Create a rectangle and fill it with an IMAGE paint from base64 bytes.",
  inputSchema: { width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), base64: z.string() }
}, async (input) => ok(await sendToPlugin("place_image_base64", input)));

// Selection / find / pages
server.registerTool("find_nodes", {
  description: "Find nodes by type and/or name substring.",
  inputSchema: { type: z.string().optional(), nameContains: z.string().optional(), within: z.string().optional() /* parent nodeId */ }
}, async (input) => ok(await sendToPlugin("find_nodes", input)));

server.registerTool("select_nodes", {
  description: "Set the current selection to the given nodeIds.",
  inputSchema: { nodeIds: z.array(z.string()).min(1) }
}, async (input) => ok(await sendToPlugin("select_nodes", input)));

server.registerTool("get_selection", {
  description: "Return selection nodeIds and basic info.",
  inputSchema: {}
}, async () => ok(await sendToPlugin("get_selection", {})));

server.registerTool("create_page", {
  description: "Create a new page and optionally switch to it.",
  inputSchema: { name: z.string().default("Page"), makeCurrent: z.boolean().optional() }
}, async (input) => ok(await sendToPlugin("create_page", input)));

server.registerTool("set_current_page", {
  description: "Switch current page by pageId.",
  inputSchema: { pageId: z.string() }
}, async (input) => ok(await sendToPlugin("set_current_page", input)));

// Node management
server.registerTool("rename_node", { description: "Rename a node.", inputSchema: { nodeId: z.string(), name: z.string() } },
  async (input) => ok(await sendToPlugin("rename_node", input)));

server.registerTool("delete_node", { description: "Delete a node.", inputSchema: { nodeId: z.string() } },
  async (input) => ok(await sendToPlugin("delete_node", input)));

server.registerTool("duplicate_node", { description: "Duplicate a node.", inputSchema: { nodeId: z.string(), x: z.number().optional(), y: z.number().optional() } },
  async (input) => ok(await sendToPlugin("duplicate_node", input)));

server.registerTool("resize_node", { description: "Resize a node.", inputSchema: { nodeId: z.string(), width: z.number().positive(), height: z.number().positive() } },
  async (input) => ok(await sendToPlugin("resize_node", input)));

server.registerTool("rotate_node", { description: "Rotate a node (degrees).", inputSchema: { nodeId: z.string(), rotation: z.number() } },
  async (input) => ok(await sendToPlugin("rotate_node", input)));

server.registerTool("set_position", { description: "Move a node to (x,y).", inputSchema: { nodeId: z.string(), x: z.number(), y: z.number() } },
  async (input) => ok(await sendToPlugin("set_position", input)));

server.registerTool("group_nodes", { description: "Group nodes.", inputSchema: { nodeIds: z.array(z.string()).min(2), name: z.string().optional() } },
  async (input) => ok(await sendToPlugin("group_nodes", input)));

server.registerTool("ungroup", { description: "Ungroup a group node.", inputSchema: { groupId: z.string() } },
  async (input) => ok(await sendToPlugin("ungroup", input)));

// Styling
server.registerTool("set_fill", { description: "Solid fill.", inputSchema: { nodeId: z.string(), hex: z.string(), opacity: z.number().min(0).max(1).optional() } },
  async (input) => ok(await sendToPlugin("set_fill", input)));

server.registerTool("set_stroke", {
  description: "Set stroke color/weight/etc.",
  inputSchema: {
    nodeId: z.string(),
    hex: z.string(),
    opacity: z.number().min(0).max(1).optional(),
    strokeWeight: z.number().optional(),
    strokeAlign: z.enum(["CENTER", "INSIDE", "OUTSIDE"]).optional(),
    dashPattern: z.array(z.number()).optional(),
    cap: z.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL"]).optional(),
    join: z.enum(["MITER", "BEVEL", "ROUND"]).optional()
  }
}, async (input) => ok(await sendToPlugin("set_stroke", input)));

server.registerTool("set_corner_radius", {
  description: "Set uniform/per-corner radius when supported.",
  inputSchema: { nodeId: z.string(), radius: z.number().optional(), topLeft: z.number().optional(), topRight: z.number().optional(), bottomRight: z.number().optional(), bottomLeft: z.number().optional() }
}, async (input) => ok(await sendToPlugin("set_corner_radius", input)));

server.registerTool("set_opacity", { description: "Set node opacity (0..1).", inputSchema: { nodeId: z.string(), opacity: z.number().min(0).max(1) } },
  async (input) => ok(await sendToPlugin("set_opacity", input)));

server.registerTool("set_blend_mode", {
  description: "Set blend mode.",
  inputSchema: { nodeId: z.string(), mode: z.string() /* e.g. 'NORMAL','MULTIPLY',... */ }
}, async (input) => ok(await sendToPlugin("set_blend_mode", input)));

server.registerTool("add_effect", {
  description: "Add effect (dropShadow, innerShadow, layerBlur, backgroundBlur).",
  inputSchema: {
    nodeId: z.string(),
    type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
    radius: z.number().optional(),
    spread: z.number().optional(),
    hex: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional()
  }
}, async (input) => ok(await sendToPlugin("add_effect", input)));

server.registerTool("clear_effects", {
  description: "Remove all effects.",
  inputSchema: { nodeId: z.string() }
}, async (input) => ok(await sendToPlugin("clear_effects", input)));

server.registerTool("layout_grid_add", {
  description: "Add a layout grid to a frame (rows/columns).",
  inputSchema: { nodeId: z.string(), pattern: z.enum(["ROWS", "COLUMNS", "GRID"]).default("COLUMNS"), count: z.number().optional(), gutterSize: z.number().optional(), sectionSize: z.number().optional(), hex: z.string().optional(), opacity: z.number().min(0).max(1).optional() }
}, async (input) => ok(await sendToPlugin("layout_grid_add", input)));

server.registerTool("layout_grid_clear", {
  description: "Clear all layout grids.",
  inputSchema: { nodeId: z.string() }
}, async (input) => ok(await sendToPlugin("layout_grid_clear", input)));

// Auto Layout & Constraints
server.registerTool("set_auto_layout", {
  description: "Enable/configure Auto Layout on a frame.",
  inputSchema: {
    nodeId: z.string(),
    layoutMode: z.enum(["HORIZONTAL", "VERTICAL"]).optional(),
    primaryAxisSizingMode: z.enum(["AUTO", "FIXED"]).optional(),
    counterAxisSizingMode: z.enum(["AUTO", "FIXED"]).optional(),
    itemSpacing: z.number().optional(),
    paddingTop: z.number().optional(),
    paddingRight: z.number().optional(),
    paddingBottom: z.number().optional(),
    paddingLeft: z.number().optional(),
    primaryAxisAlignItems: z.enum(["MIN", "CENTER", "MAX", "SPACE_BETWEEN"]).optional(),
    counterAxisAlignItems: z.enum(["MIN", "CENTER", "MAX"]).optional(),
    layoutWrap: z.boolean().optional(),
    counterAxisSpacing: z.number().optional(),
    layoutPositioning: z.enum(["AUTO", "ABSOLUTE"]).optional()
  }
}, async (input) => ok(await sendToPlugin("set_auto_layout", input)));

server.registerTool("set_constraints", {
  description: "Set child constraints within a frame.",
  inputSchema: { nodeId: z.string(), horizontal: z.enum(["LEFT", "RIGHT", "CENTER", "LEFT_RIGHT", "SCALE"]).optional(), vertical: z.enum(["TOP", "BOTTOM", "CENTER", "TOP_BOTTOM", "SCALE"]).optional() }
}, async (input) => ok(await sendToPlugin("set_constraints", input)));

// Text manipulation
server.registerTool("set_text_content", {
  description: "Edit text characters.",
  inputSchema: { nodeId: z.string(), text: z.string() }
}, async (input) => ok(await sendToPlugin("set_text_content", input)));

server.registerTool("set_text_style", {
  description: "Set text font/size/lineHeight/letterSpacing.",
  inputSchema: { nodeId: z.string(), fontFamily: z.string().optional(), fontStyle: z.string().optional(), fontSize: z.number().optional(), lineHeight: z.number().optional(), letterSpacing: z.number().optional(), textAlignHorizontal: z.enum(["LEFT","CENTER","RIGHT","JUSTIFIED"]).optional(), textAutoResize: z.enum(["NONE","HEIGHT","WIDTH_AND_HEIGHT"]).optional() }
}, async (input) => ok(await sendToPlugin("set_text_style", input)));

server.registerTool("set_text_color", {
  description: "Set text fill color.",
  inputSchema: { nodeId: z.string(), hex: z.string(), opacity: z.number().min(0).max(1).optional() }
}, async (input) => ok(await sendToPlugin("set_text_color", input)));

// Components & boolean ops
server.registerTool("create_component", {
  description: "Create a component (optionally from nodes).",
  inputSchema: { name: z.string().optional(), fromNodeIds: z.array(z.string()).optional() }
}, async (input) => ok(await sendToPlugin("create_component", input)));

server.registerTool("create_instance", {
  description: "Create an instance from a componentId.",
  inputSchema: { componentId: z.string(), x: z.number().optional(), y: z.number().optional() }
}, async (input) => ok(await sendToPlugin("create_instance", input)));

server.registerTool("detach_instance", {
  description: "Detach an instance.",
  inputSchema: { nodeId: z.string() }
}, async (input) => ok(await sendToPlugin("detach_instance", input)));

server.registerTool("boolean_op", {
  description: "Boolean operations on vector-like nodes.",
  inputSchema: { op: z.enum(["UNION","SUBTRACT","INTERSECT","EXCLUDE"]), nodeIds: z.array(z.string()).min(2), name: z.string().optional() }
}, async (input) => ok(await sendToPlugin("boolean_op", input)));

// Export / plugin data / generic set
server.registerTool("export_node", {
  description: "Export node as PNG/JPG/SVG and return base64.",
  inputSchema: { nodeId: z.string(), format: z.enum(["PNG","JPG","SVG"]).default("PNG"), scale: z.number().optional() }
}, async (input) => ok(await sendToPlugin("export_node", input)));

server.registerTool("set_plugin_data", {
  description: "Set plugin data JSON on a node.",
  inputSchema: { nodeId: z.string(), key: z.string(), value: z.any() }
}, async (input) => ok(await sendToPlugin("set_plugin_data", input)));

server.registerTool("get_plugin_data", {
  description: "Get plugin data JSON from a node.",
  inputSchema: { nodeId: z.string(), key: z.string() }
}, async (input) => ok(await sendToPlugin("get_plugin_data", input)));

server.registerTool("set_properties", {
  description: "Batch apply a safe set of scalar properties to a node.",
  inputSchema: { nodeId: z.string(), props: z.record(z.any()) }
}, async (input) => ok(await sendToPlugin("set_properties", input)));

// Connect to VS Code over stdio
const transport = new StdioServerTransport();
await server.connect(transport);
