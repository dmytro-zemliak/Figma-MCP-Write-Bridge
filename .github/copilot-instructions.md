# AI Coding Agent Instructions for `figma-mcp-write-bridge`

Purpose: Provide a local Model Context Protocol (MCP) server that exposes write/manipulation tools for a running Figma document via a lightweight plugin bridge (WebSocket + stdio). Use these instructions to quickly understand architecture, patterns, and safe extension points.

## Big Picture Flow
1. Host process runs `npm start` which executes `tsx server.ts` (see `package.json`).
2. `server.ts` boots:
   - A WebSocket server on `ws://127.0.0.1:3055` waiting for the Figma plugin UI (`plugin/ui.html`).
   - An MCP server (`McpServer`) over stdio so AI clients (e.g. VS Code extension) can invoke tools.
3. The Figma plugin (`plugin.js`) loads a hidden UI (`ui.html`) solely to access `WebSocket` APIs.
4. Tool invocation path: MCP client -> `server.ts` tool handler -> `sendToPlugin()` -> WS to UI -> `parent.postMessage` into plugin -> `figma.ui.onmessage` -> `handleAction()` -> action implementation -> result bubbled back reversing the chain.

## Core Files & Responsibilities
- `server.ts`: Defines WebSocket bridge, pending request correlation (id + timeout), and registers MCP tools forwarding to plugin actions.
- `plugin/plugin.js`: Maps `action` strings to concrete Figma API operations (frame, text, rectangle, grouping, positioning, page clearing). Handles error wrapping & result formatting.
- `plugin/ui.html`: Minimal resilient auto-reconnecting WS client; shuttles messages between bridge and Figma plugin via `postMessage`.
- `plugin/manifest.json`: Declares plugin metadata & enables network access (required for WS localhost communication).
- `tsconfig.json`: Non‑strict TypeScript (strict:false) with modern ES2022 + bundler module resolution.

## Message & Tool Pattern
Request envelope from server to plugin: `{ id, action, args }`.
Reply envelope from plugin back: `{ replyTo, result, error? }`.
`server.ts` maintains a `Map` of pending promises keyed by `id`; 15s timeout triggers rejection.
Each MCP tool uses `registerTool(name, zodSchema, description, action)` pattern; results are JSON‑stringified into MCP textual & structured content.

## Existing Tools (mirror action names)
- `create_frame`: width/height (+ optional name,x,y)
- `add_text`: text (+ font metadata & position)
- `rectangle`: width/height (+ optional hex fill, x,y, cornerRadius)
- `set_position`: nodeId + x,y
- `group_nodes`: array of >=2 nodeIds (+ optional group name)
- `clear_page`: destructive wipe of current page

## Conventions & Gotchas
- All geometry defaults to origin (0,0) if not specified.
- Color hex converted to normalized 0..1 RGB in `hexToRGB()` (validate 6‑digit only).
- Fonts must be loaded (`figma.loadFontAsync`) before mutating text properties—already handled inside `add_text`.
- Hidden UI is necessary for network APIs; do not remove `visible:false` usage.
- Error propagation: plugin wraps errors into `{ error: message }`; server rejects promise so MCP client sees failure.
- Zod schemas enforce positive dimensions; extend with additional validation here first.

## Adding a New Tool
1. Implement action in `plugin/plugin.js` `handleAction()` switch; return a plain serializable object.
2. Add schema + `registerTool()` call in `server.ts` with matching `action` name.
3. Keep response size modest; large payloads will be JSON‑stringified for MCP content.
4. Consider timeout implications if action may exceed 15s; adjust in `sendToPlugin()` if needed.

## Debug Workflow
- Start bridge: `npm start` (uses `tsx` so TS runs directly; no build step currently).
- Open Figma → Development → Run this plugin (ensure localhost allowed).
- Watch stderr logs from `server.ts` for connection status; plugin logs appear in Figma console.
- If tools hang: verify WS connected (`[bridge] Plugin connected` message) and that `replyTo` id matches.

## Safety & Reliability
- `clear_page` is irreversible within current session—avoid accidental invocation; consider confirmation wrapper client‑side.
- Pending Map cleaned after timeout or resolution; ensure every action eventually replies to avoid memory leaks.
- Reconnection: UI retries WS every 1s; server side simply awaits new connection (no multi‑client support).

## Extension Ideas (non‑speculative, aligned with patterns)
- Add `resize_node` tool mirroring `set_position` pattern for width/height if node supports `resize`.
- Add color utilities (e.g., apply fills to existing nodes) reusing `hexToRGB`.

## When Unsure
Prefer inspecting these files directly rather than guessing hidden complexity; there is intentionally no build/bundle or test harness yet.

(End of file – please suggest improvements or missing clarifications.)
