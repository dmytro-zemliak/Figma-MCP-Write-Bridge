# AI Coding Agent Instructions for `mcp-figma-toolkit`

Purpose: Provide a Model Context Protocol (MCP) server that exposes write/manipulation tools for a running Figma document via a lightweight plugin bridge (WebSocket + stdio). Use these instructions to quickly understand architecture, patterns, and safe extension points.

## Big Picture Flow
1. Host process runs `npm start` which executes `tsx server.ts` (see `package.json`).
2. `server.ts` boots:
   - A WebSocket server on `ws://127.0.0.1:3055` waiting for the Figma plugin UI (`plugin/ui.html`).
   - An MCP server (`McpServer`) over stdio so AI clients (e.g. VS Code extension, Claude Code) can invoke tools.
3. The Figma plugin (`plugin.js`) loads a hidden UI (`ui.html`) solely to access `WebSocket` APIs.
4. Tool invocation path: MCP client -> `server.ts` tool handler -> `sendToPlugin()` -> WS to UI -> `parent.postMessage` into plugin -> `figma.ui.onmessage` -> `handleAction()` -> action implementation -> result bubbled back reversing the chain.

## Core Files & Responsibilities
- `server.ts`: Defines WebSocket bridge, pending request correlation (id + timeout), and registers MCP tools forwarding to plugin actions. Uses `server.registerTool()` pattern with Zod schemas.
- `plugin/plugin.js`: Maps `action` strings to concrete Figma API operations. Handles error wrapping & result formatting. Contains implementations for nodes, styling, variables, styles, and components.
- `plugin/ui.html`: Minimal resilient auto-reconnecting WS client; shuttles messages between bridge and Figma plugin via `postMessage`.
- `plugin/manifest.json`: Declares plugin metadata & enables network access (required for WS localhost communication).
- `tsconfig.json`: Non‑strict TypeScript (strict:false) with modern ES2022 + bundler module resolution.

## Message & Tool Pattern
Request envelope from server to plugin: `{ id, action, args }`.
Reply envelope from plugin back: `{ replyTo, result, error? }`.
`server.ts` maintains a `Map` of pending promises keyed by `id`; 20s timeout triggers rejection.
Each MCP tool uses `server.registerTool(name, { description, inputSchema }, handler)` pattern; results are JSON‑stringified into MCP textual & structured content via `ok()` helper.

## Tool Categories

### Creation Tools
- `create_frame`, `create_rectangle`, `create_ellipse`, `create_line`, `create_polygon`, `create_star`
- `add_text`: text with font styling
- `place_image_base64`, `place_image_url`: image placement
- `create_vector`: SVG icons/vectors (see SVG Icons section below)
- All support `parentId` for proper layer nesting

### Node Management
- `find_nodes`, `select_nodes`, `get_selection`
- `rename_node`, `delete_node`, `duplicate_node`
- `resize_node`, `rotate_node`, `set_position`
- `group_nodes`, `ungroup`
- `create_page`, `set_current_page`

### Styling & Effects
- `set_fill`, `set_gradient_fill`: solid and gradient fills
- `set_stroke`, `set_gradient_stroke`: stroke styling
- `set_corner_radius`, `set_opacity`, `set_blend_mode`
- `add_effect`, `clear_effects`: shadows, blurs
- `layout_grid_add`, `layout_grid_clear`

### Layout
- `set_auto_layout`: full Auto Layout configuration (direction, spacing, padding, alignment)
- `set_constraints`: child constraints within frames

### Text
- `set_text_content`, `set_text_style`, `set_text_color`, `set_text_gradient`

### Variables (Design Tokens)
- `create_variable_collection`: create collection with optional modes (Light/Dark)
- `create_variable`: create COLOR, FLOAT, STRING, or BOOLEAN variable with scopes
- `get_local_variable_collections`, `get_local_variables`: query existing variables
- `set_variable_value`: update variable value for a mode
- `bind_variable`: bind variable to node property (fill, stroke, itemSpacing, padding, etc.)
- `unbind_variable`: remove binding
- `delete_variable`, `delete_variable_collection`

### Styles (Reusable)
- `create_text_style`: font family, size, weight, line height, letter spacing
- `create_effect_style`: shadows, blurs with multiple effects
- `get_local_text_styles`, `get_local_effect_styles`: query styles
- `apply_text_style`, `apply_effect_style`: apply to nodes
- `update_text_style`, `update_effect_style`: modify existing styles
- `delete_style`

### Components
- `create_component`: empty component
- `create_component_from_node`: convert existing node to component
- `create_component_set`: combine components into variant set
- `create_instance`: instantiate a component
- `detach_instance`: break link to main component
- `add_component_property`: add TEXT, BOOLEAN, INSTANCE_SWAP, or VARIANT property
- `set_instance_property`: set property value on instance
- `get_component_properties`: query component properties

### Advanced
- `boolean_op`: union, subtract, intersect, exclude
- `export_node`: PNG, JPG, SVG export
- `set_plugin_data`, `get_plugin_data`: JSON storage on nodes
- `set_properties`: batch apply scalar properties

## SVG Icons (`create_vector`)

The `create_vector` tool supports two modes for creating icons/vectors:

### Mode 1: Full SVG String (Recommended)
Use `svgString` parameter for full SVG markup. This handles ALL SVG features.

```javascript
create_vector({
  svgString: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  width: 24,
  height: 24,
  x: 0,
  y: 0,
  name: "user-icon"
})
```

**Supports:**
- Arc commands (A/a) - rounded corners, partial circles
- Circle elements (`<circle>`)
- Line elements (`<line>`)
- All path commands (M, L, H, V, C, S, Q, T, A, Z)
- Multiple paths in one SVG

**Note:** `fillHex`, `strokeHex`, `strokeWeight` parameters are ignored - the SVG's embedded styles are used.

**Returns:** A FRAME containing the vector elements (may have children)

### Mode 2: Path Data Only
Use `pathData` parameter for simple SVG path `d` attribute values.

```javascript
create_vector({
  pathData: "M20 6L9 17l-5-5",
  width: 24,
  height: 24,
  strokeHex: "#000000",
  strokeWeight: 2,
  name: "check-icon"
})
```

**Supports:** M, L, H, V, C, Q, Z (and relative versions m, l, h, v, c, q, z)
**Auto-converts:** S→C (smooth curve), T→Q (smooth quadratic)
**Does NOT support:** A/a (arc commands) - Figma's `vectorPaths` API limitation, use `svgString` instead

**Returns:** A single VECTOR node

### Icon Library Compatibility

| Library | Recommended Mode | Notes |
|---------|------------------|-------|
| **Heroicons** | `pathData` works | Uses bezier curves (C), no arcs |
| **Lucide** | `svgString` | Many icons use arcs (A) and circles |
| **Feather** | `svgString` | Uses `<line>` and `<circle>` elements |
| **Material** | `svgString` | Complex paths, often with arcs |

### Best Practice for AI Agents

1. **Prefer `svgString`** - It works with any icon, no conversion needed
2. **Get full SVG** from icon library (not just path data)
3. **Include xmlns** attribute: `xmlns="http://www.w3.org/2000/svg"`
4. **Include viewBox**: `viewBox="0 0 24 24"` (or appropriate size)
5. **Specify size**: `width` and `height` parameters for final size in Figma

### Example: Creating Icons from Lucide

```javascript
// User icon (has arcs and circle - MUST use svgString)
create_vector({
  svgString: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  width: 24, height: 24, name: "user"
})

// Check icon (simple path - pathData works)
create_vector({
  pathData: "M20 6L9 17l-5-5",
  width: 24, height: 24,
  strokeHex: "#000000", strokeWeight: 2,
  name: "check"
})

// Menu icon (simple lines - pathData works)
create_vector({
  pathData: "M4 6h16M4 12h16M4 18h16",
  width: 24, height: 24,
  strokeHex: "#000000", strokeWeight: 2,
  name: "menu"
})
```

## Conventions & Gotchas
- All geometry defaults to origin (0,0) if not specified.
- **parentId**: Use for proper layer nesting. Create parent frames first, then children with `parentId`.
- Color hex converted to normalized 0..1 RGB in `hexToRGB()` (validate 6‑digit only).
- Fonts must be loaded (`figma.loadFontAsync`) before mutating text properties—handled inside text functions.
- Font styles: Use "Semi Bold" not "SemiBold".
- Hidden UI is necessary for network APIs; do not remove `visible:false` usage.
- Error propagation: plugin wraps errors into `{ error: message }`; server rejects promise so MCP client sees failure.
- Zod schemas enforce positive dimensions; extend with additional validation here first.
- Variables: Set `scopes` to control where variables appear in UI pickers. Set `hiddenFromPublishing = false` for visibility.
- Multiple modes (Light/Dark): Requires Figma paid plan.

## Adding a New Tool
1. Implement action in `plugin/plugin.js` `handleAction()` switch; return a plain serializable object.
2. Add `server.registerTool()` call in `server.ts` with matching `action` name, Zod schema, and description.
3. Keep response size modest; large payloads will be JSON‑stringified for MCP content.
4. Consider timeout implications if action may exceed 20s; adjust in `sendToPlugin()` if needed.

## Debug Workflow
- Start bridge: `npm start` (uses `tsx` so TS runs directly; no build step currently).
- Open Figma → Plugins → Development → Run this plugin (ensure localhost allowed).
- Watch stderr logs from `server.ts` for connection status; plugin logs appear in Figma console.
- If tools hang: verify WS connected (`[bridge] Plugin connected` message) and that `replyTo` id matches.

## Safety & Reliability
- `clear_page` is irreversible within current session—avoid accidental invocation.
- Pending Map cleaned after timeout or resolution; ensure every action eventually replies to avoid memory leaks.
- Reconnection: UI retries WS every 1s; server side simply awaits new connection (no multi‑client support).

## When Unsure
Prefer inspecting these files directly rather than guessing hidden complexity; there is intentionally no build/bundle or test harness yet.
