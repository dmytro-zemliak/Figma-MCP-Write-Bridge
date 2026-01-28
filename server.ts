#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import https from "https";
import http from "http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ---------- CLI argument handling ----------
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
MCP Figma Toolkit - AI-powered Figma design automation

USAGE:
  mcp-figma-toolkit              Start the MCP server
  mcp-figma-toolkit --help       Show this help message
  mcp-figma-toolkit --version    Show version number

DESCRIPTION:
  An MCP (Model Context Protocol) server that enables AI agents to
  create and manipulate Figma designs programmatically.

SETUP:
  1. Configure your MCP client (Claude Code, VS Code, Cursor):

     Claude Code (~/.claude.json):
     {
       "mcpServers": {
         "figma": { "command": "mcp-figma-toolkit" }
       }
     }

  2. Install the Figma plugin:
     - Run: npm root -g
     - In Figma: Plugins > Development > Import plugin from manifest
     - Navigate to: <npm-path>/mcp-figma-toolkit/plugin/manifest.json

  3. Start using:
     - Open a Figma document
     - Run the plugin: Plugins > Development > MCP Figma Toolkit
     - The MCP server will connect automatically

TOOLS:
  77 tools available across categories:
  - Creation: frames, shapes, text, images, vectors (SVG)
  - Node Management: find, move, transform, reparent, z-order
  - Styling: fills, strokes, gradients, effects
  - Layout: Auto Layout, constraints
  - Variables: design tokens, modes (Light/Dark)
  - Styles: reusable text/effect styles
  - Components: create, instance, variants

DOCUMENTATION:
  README.md  - Full documentation for users
  AGENTS.md  - Instructions for AI agents

MORE INFO:
  https://github.com/dmytro-zemliak/mcp-figma-toolkit
`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
    console.log(pkg.version);
  } catch {
    console.log("1.0.2"); // Fallback version
  }
  process.exit(0);
}

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

// Creation - all creation tools support optional parentId for nesting elements
server.registerTool("create_frame", {
  description: "Create a frame. Use parentId to nest inside another frame.",
  inputSchema: { name: z.string().optional(), width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), parentId: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_frame", input)));

server.registerTool("create_rectangle", {
  description: "Create a rectangle. Use parentId to nest inside a frame.",
  inputSchema: { width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), cornerRadius: z.number().optional(), hex: z.string().optional(), parentId: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_rectangle", input)));

server.registerTool("create_ellipse", {
  description: "Create an ellipse (circle). Use parentId to nest inside a frame.",
  inputSchema: { width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), hex: z.string().optional(), parentId: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_ellipse", input)));

server.registerTool("create_line", {
  description: "Create a line. Use parentId to nest inside a frame.",
  inputSchema: { x: z.number().optional(), y: z.number().optional(), length: z.number().positive(), rotation: z.number().optional(), strokeHex: z.string().optional(), strokeWeight: z.number().optional(), parentId: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_line", input)));

server.registerTool("create_polygon", {
  description: "Create a polygon. Use parentId to nest inside a frame.",
  inputSchema: { sides: z.number().int().min(3), width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), hex: z.string().optional(), parentId: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_polygon", input)));

server.registerTool("create_star", {
  description: "Create a star. Use parentId to nest inside a frame.",
  inputSchema: { points: z.number().int().min(3), width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), hex: z.string().optional(), parentId: z.string().optional() }
}, async (input) => ok(await sendToPlugin("create_star", input)));

server.registerTool("add_text", {
  description: "Create a text node. Use parentId to nest inside a frame.",
  inputSchema: { text: z.string(), x: z.number().optional(), y: z.number().optional(), fontFamily: z.string().optional(), fontStyle: z.string().optional(), fontSize: z.number().optional(), parentId: z.string().optional() }
}, async (input) => ok(await sendToPlugin("add_text", input)));

server.registerTool("place_image_base64", {
  description: "Create a rectangle and fill it with an IMAGE paint from base64 bytes. Use parentId to nest inside a frame.",
  inputSchema: { width: z.number().positive(), height: z.number().positive(), x: z.number().optional(), y: z.number().optional(), base64: z.string(), parentId: z.string().optional() }
}, async (input) => ok(await sendToPlugin("place_image_base64", input)));

server.registerTool("create_vector", {
  description: "Create a vector/icon from SVG. Two modes: (1) Pass full 'svgString' for complex SVGs with arcs/circles, or (2) Pass 'pathData' for simple paths. Use parentId to nest inside a frame.",
  inputSchema: {
    svgString: z.string().optional().describe("Full SVG markup string. Preferred for icons with arcs, circles, or complex shapes."),
    pathData: z.string().optional().describe("SVG path 'd' attribute. Use for simple paths (M, L, C, Q commands). Does NOT support arcs (A command)."),
    width: z.number().positive(),
    height: z.number().positive(),
    x: z.number().optional(),
    y: z.number().optional(),
    fillHex: z.string().optional().describe("Fill color (pathData mode only). Ignored when using svgString."),
    strokeHex: z.string().optional().describe("Stroke color (pathData mode only). Ignored when using svgString."),
    strokeWeight: z.number().optional().describe("Stroke weight (pathData mode only). Ignored when using svgString."),
    name: z.string().optional(),
    parentId: z.string().optional()
  }
}, async (input) => {
  // Validate that at least one of svgString or pathData is provided
  if (!input.svgString && !input.pathData) {
    throw new Error("Either 'svgString' or 'pathData' must be provided");
  }
  return ok(await sendToPlugin("create_vector", input));
});

server.registerTool("place_image_url", {
  description: "Fetch an image from URL and place it in the design. Supports jpg, png, webp. Use parentId to nest inside a frame.",
  inputSchema: {
    url: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
    x: z.number().optional(),
    y: z.number().optional(),
    cornerRadius: z.number().optional(),
    name: z.string().optional(),
    parentId: z.string().optional()
  }
}, async (input) => {
  const fetchImage = (url: string): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            fetchImage(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });
      req.on('error', reject);
    });
  };

  try {
    const buffer = await fetchImage(input.url);
    const base64 = buffer.toString('base64');
    const pluginResult = await sendToPlugin("place_image_url", { ...input, base64 });
    return ok(pluginResult);
  } catch (e) {
    throw new Error(`Failed to fetch image from URL: ${e instanceof Error ? e.message : String(e)}`);
  }
});

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

server.registerTool("duplicate_node", {
  description: "Duplicate a node. Optionally duplicate into a different parent.",
  inputSchema: {
    nodeId: z.string(),
    parentId: z.string().optional().describe("Target parent ID. If not specified, duplicates within same parent."),
    x: z.number().optional(),
    y: z.number().optional()
  }
}, async (input) => ok(await sendToPlugin("duplicate_node", input)));

server.registerTool("resize_node", { description: "Resize a node.", inputSchema: { nodeId: z.string(), width: z.number().positive(), height: z.number().positive() } },
  async (input) => ok(await sendToPlugin("resize_node", input)));

server.registerTool("rotate_node", { description: "Rotate a node (degrees).", inputSchema: { nodeId: z.string(), rotation: z.number() } },
  async (input) => ok(await sendToPlugin("rotate_node", input)));

server.registerTool("set_position", { description: "Move a node to (x,y) within its current parent.", inputSchema: { nodeId: z.string(), x: z.number(), y: z.number() } },
  async (input) => ok(await sendToPlugin("set_position", input)));

server.registerTool("move_to_parent", {
  description: "Move a node to a different parent (frame, group, component, or page). Use this to reparent nodes.",
  inputSchema: {
    nodeId: z.string().describe("ID of the node to move"),
    parentId: z.string().describe("ID of the new parent container"),
    index: z.number().optional().describe("Position among siblings (0 = first, omit for last)"),
    x: z.number().optional().describe("X position within new parent"),
    y: z.number().optional().describe("Y position within new parent")
  }
}, async (input) => ok(await sendToPlugin("move_to_parent", input)));

server.registerTool("reorder_node", {
  description: "Change a node's z-order (stacking position) among its siblings within the same parent.",
  inputSchema: {
    nodeId: z.string().describe("ID of the node to reorder"),
    index: z.number().describe("New position: 0 = bottom/back, -1 = top/front, or specific index")
  }
}, async (input) => ok(await sendToPlugin("reorder_node", input)));

server.registerTool("get_node_info", {
  description: "Get detailed information about a node including parent, position, size, children, and state.",
  inputSchema: {
    nodeId: z.string().describe("ID of the node to inspect")
  }
}, async (input) => ok(await sendToPlugin("get_node_info", input)));

server.registerTool("set_visibility", {
  description: "Show or hide a node.",
  inputSchema: {
    nodeId: z.string(),
    visible: z.boolean().describe("true to show, false to hide")
  }
}, async (input) => ok(await sendToPlugin("set_visibility", input)));

server.registerTool("set_locked", {
  description: "Lock or unlock a node. Locked nodes cannot be selected or edited in Figma.",
  inputSchema: {
    nodeId: z.string(),
    locked: z.boolean().describe("true to lock, false to unlock")
  }
}, async (input) => ok(await sendToPlugin("set_locked", input)));

server.registerTool("flatten_node", {
  description: "Flatten a node into a single vector shape. Useful for simplifying complex shapes or groups.",
  inputSchema: {
    nodeId: z.string().describe("ID of the node to flatten")
  }
}, async (input) => ok(await sendToPlugin("flatten_node", input)));

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

// Gradient tools
server.registerTool("set_gradient_fill", {
  description: "Apply linear gradient fill to a node.",
  inputSchema: {
    nodeId: z.string(),
    startHex: z.string(),
    endHex: z.string(),
    angle: z.number().optional(),
    startOpacity: z.number().min(0).max(1).optional(),
    endOpacity: z.number().min(0).max(1).optional()
  }
}, async (input) => ok(await sendToPlugin("set_gradient_fill", input)));

server.registerTool("set_gradient_stroke", {
  description: "Apply linear gradient stroke/border to a node.",
  inputSchema: {
    nodeId: z.string(),
    startHex: z.string(),
    endHex: z.string(),
    strokeWeight: z.number().optional(),
    angle: z.number().optional(),
    strokeAlign: z.enum(["CENTER", "INSIDE", "OUTSIDE"]).optional()
  }
}, async (input) => ok(await sendToPlugin("set_gradient_stroke", input)));

server.registerTool("set_text_gradient", {
  description: "Apply linear gradient fill to text node.",
  inputSchema: {
    nodeId: z.string(),
    startHex: z.string(),
    endHex: z.string(),
    angle: z.number().optional()
  }
}, async (input) => ok(await sendToPlugin("set_text_gradient", input)));

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

// ========== VARIABLES ==========

server.registerTool("create_variable_collection", {
  description: "Create a variable collection for organizing design tokens. Use modes for theme variations (e.g., ['Light', 'Dark']).",
  inputSchema: {
    name: z.string().describe("Name of the collection (e.g., 'Colors', 'Spacing')"),
    modes: z.array(z.string()).optional().describe("Mode names (e.g., ['Light', 'Dark']). Defaults to ['Default']")
  }
}, async (input) => ok(await sendToPlugin("create_variable_collection", input)));

server.registerTool("create_variable", {
  description: "Create a variable (design token) within a collection. Types: COLOR (hex), FLOAT (number), STRING, BOOLEAN.",
  inputSchema: {
    collectionId: z.string().describe("ID of the variable collection"),
    name: z.string().describe("Variable name (e.g., 'brand-primary', 'spacing-md')"),
    resolvedType: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).describe("Variable type"),
    values: z.record(z.any()).optional().describe("Values per mode ID. For COLOR use hex string, e.g., { 'modeId123': '#2563EB' }"),
    scopes: z.array(z.string()).optional().describe("UI scopes where variable appears. COLOR: ALL_FILLS, STROKE_COLOR, EFFECT_COLOR. FLOAT: ALL_SCOPES, WIDTH_HEIGHT, GAP. Defaults to visible scopes if not specified.")
  }
}, async (input) => ok(await sendToPlugin("create_variable", input)));

server.registerTool("get_local_variable_collections", {
  description: "List all local variable collections with their modes and variable IDs.",
  inputSchema: {}
}, async () => ok(await sendToPlugin("get_local_variable_collections", {})));

server.registerTool("get_local_variables", {
  description: "List all local variables, optionally filtered by collection.",
  inputSchema: {
    collectionId: z.string().optional().describe("Filter by collection ID")
  }
}, async (input) => ok(await sendToPlugin("get_local_variables", input)));

server.registerTool("set_variable_value", {
  description: "Set or update a variable's value for a specific mode.",
  inputSchema: {
    variableId: z.string().describe("ID of the variable"),
    modeId: z.string().describe("ID of the mode"),
    value: z.any().describe("New value. For COLOR use hex string.")
  }
}, async (input) => ok(await sendToPlugin("set_variable_value", input)));

server.registerTool("bind_variable", {
  description: "Bind a variable to a node property. When the variable changes, the node updates automatically.",
  inputSchema: {
    nodeId: z.string().describe("ID of the node"),
    field: z.string().describe("Property to bind: 'fill', 'stroke', 'width', 'height', 'itemSpacing', 'paddingTop', etc."),
    variableId: z.string().describe("ID of the variable to bind")
  }
}, async (input) => ok(await sendToPlugin("bind_variable", input)));

server.registerTool("unbind_variable", {
  description: "Remove variable binding from a node property.",
  inputSchema: {
    nodeId: z.string().describe("ID of the node"),
    field: z.string().describe("Property to unbind")
  }
}, async (input) => ok(await sendToPlugin("unbind_variable", input)));

server.registerTool("delete_variable", {
  description: "Delete a variable.",
  inputSchema: { variableId: z.string() }
}, async (input) => ok(await sendToPlugin("delete_variable", input)));

server.registerTool("delete_variable_collection", {
  description: "Delete a variable collection and all its variables.",
  inputSchema: { collectionId: z.string() }
}, async (input) => ok(await sendToPlugin("delete_variable_collection", input)));

// ========== STYLES ==========

server.registerTool("create_text_style", {
  description: "Create a reusable text style. All text using this style updates when the style changes.",
  inputSchema: {
    name: z.string().describe("Style name (e.g., 'Heading 1', 'Body')"),
    fontFamily: z.string().optional().default("Inter"),
    fontStyle: z.string().optional().default("Regular").describe("Font weight/style: Regular, Medium, Semi Bold, Bold"),
    fontSize: z.number().optional().default(16),
    lineHeight: z.number().optional().describe("Line height in pixels"),
    letterSpacing: z.number().optional().describe("Letter spacing in pixels"),
    textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
    textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional()
  }
}, async (input) => ok(await sendToPlugin("create_text_style", input)));

server.registerTool("create_effect_style", {
  description: "Create a reusable effect style (shadows, blurs).",
  inputSchema: {
    name: z.string().describe("Style name (e.g., 'Shadow SM', 'Blur Background')"),
    effects: z.array(z.object({
      type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
      radius: z.number().optional(),
      spread: z.number().optional(),
      hex: z.string().optional(),
      opacity: z.number().optional(),
      offsetX: z.number().optional(),
      offsetY: z.number().optional()
    })).describe("Array of effects to include in the style")
  }
}, async (input) => ok(await sendToPlugin("create_effect_style", input)));

server.registerTool("get_local_text_styles", {
  description: "List all local text styles.",
  inputSchema: {}
}, async () => ok(await sendToPlugin("get_local_text_styles", {})));

server.registerTool("get_local_effect_styles", {
  description: "List all local effect styles.",
  inputSchema: {}
}, async () => ok(await sendToPlugin("get_local_effect_styles", {})));

server.registerTool("apply_text_style", {
  description: "Apply a text style to a text node.",
  inputSchema: {
    nodeId: z.string().describe("ID of the text node"),
    styleId: z.string().describe("ID of the text style")
  }
}, async (input) => ok(await sendToPlugin("apply_text_style", input)));

server.registerTool("apply_effect_style", {
  description: "Apply an effect style to a node.",
  inputSchema: {
    nodeId: z.string().describe("ID of the node"),
    styleId: z.string().describe("ID of the effect style")
  }
}, async (input) => ok(await sendToPlugin("apply_effect_style", input)));

server.registerTool("update_text_style", {
  description: "Update an existing text style. All nodes using this style will update.",
  inputSchema: {
    styleId: z.string(),
    name: z.string().optional(),
    fontFamily: z.string().optional(),
    fontStyle: z.string().optional(),
    fontSize: z.number().optional(),
    lineHeight: z.number().optional(),
    letterSpacing: z.number().optional()
  }
}, async (input) => ok(await sendToPlugin("update_text_style", input)));

server.registerTool("update_effect_style", {
  description: "Update an existing effect style. All nodes using this style will update.",
  inputSchema: {
    styleId: z.string(),
    name: z.string().optional(),
    effects: z.array(z.object({
      type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
      radius: z.number().optional(),
      spread: z.number().optional(),
      hex: z.string().optional(),
      opacity: z.number().optional(),
      offsetX: z.number().optional(),
      offsetY: z.number().optional()
    })).optional()
  }
}, async (input) => ok(await sendToPlugin("update_effect_style", input)));

server.registerTool("delete_style", {
  description: "Delete a text or effect style.",
  inputSchema: { styleId: z.string() }
}, async (input) => ok(await sendToPlugin("delete_style", input)));

// ========== ENHANCED COMPONENTS ==========

server.registerTool("create_component_from_node", {
  description: "Convert an existing node (frame, group, etc.) into a reusable component.",
  inputSchema: {
    nodeId: z.string().describe("ID of the node to convert"),
    name: z.string().optional().describe("Component name")
  }
}, async (input) => ok(await sendToPlugin("create_component_from_node", input)));

server.registerTool("create_component_set", {
  description: "Combine multiple components into a component set (for variants like hover, active, disabled states).",
  inputSchema: {
    componentIds: z.array(z.string()).min(1).describe("IDs of components to combine"),
    name: z.string().optional().describe("Component set name")
  }
}, async (input) => ok(await sendToPlugin("create_component_set", input)));

server.registerTool("add_component_property", {
  description: "Add a configurable property to a component (text override, boolean toggle, etc.).",
  inputSchema: {
    componentId: z.string().describe("ID of the component or component set"),
    propertyName: z.string().describe("Property name (e.g., 'Label', 'Show Icon')"),
    propertyType: z.enum(["BOOLEAN", "TEXT", "INSTANCE_SWAP", "VARIANT"]).describe("Property type"),
    defaultValue: z.any().describe("Default value for the property")
  }
}, async (input) => ok(await sendToPlugin("add_component_property", input)));

server.registerTool("set_instance_property", {
  description: "Set a property value on a component instance.",
  inputSchema: {
    instanceId: z.string().describe("ID of the instance"),
    propertyName: z.string().describe("Property name to set"),
    value: z.any().describe("New value")
  }
}, async (input) => ok(await sendToPlugin("set_instance_property", input)));

server.registerTool("get_component_properties", {
  description: "Get all properties defined on a component, component set, or instance.",
  inputSchema: {
    componentId: z.string().describe("ID of the component, component set, or instance")
  }
}, async (input) => ok(await sendToPlugin("get_component_properties", input)));

// Connect to VS Code over stdio
const transport = new StdioServerTransport();
await server.connect(transport);
