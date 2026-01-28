# AI Agent Instructions for MCP Figma Toolkit

This document provides instructions for AI agents (Claude, Copilot, Cursor, etc.) on how to effectively use the MCP Figma Toolkit tools.

## Quick Start

This MCP server exposes 77 tools for manipulating Figma documents. The Figma plugin must be running and connected via WebSocket for tools to work.

## Tool Categories Overview

| Category | Tools | Purpose |
|----------|-------|---------|
| Creation | 10 | Create frames, shapes, text, images, vectors |
| Node Management | 16 | Find, select, move, transform, organize nodes |
| Styling | 11 | Fills, strokes, gradients, effects, blend modes |
| Layout | 2 | Auto Layout, constraints |
| Text | 4 | Content, style, color, gradients |
| Variables | 9 | Design tokens, collections, modes |
| Styles | 9 | Reusable text/effect styles |
| Components | 8 | Components, instances, variants |
| Advanced | 8 | Boolean ops, export, plugin data |

## Essential Patterns

### Layer Nesting with parentId

All creation tools support `parentId` for proper layer hierarchy:

```javascript
// Create parent frame first
create_frame({ name: "Card", width: 300, height: 200 })
// Returns: { nodeId: "123:456" }

// Create children inside the parent
create_rectangle({
  width: 280, height: 40,
  x: 10, y: 10,
  parentId: "123:456"  // Nest inside Card
})
```

### Moving Nodes Between Parents

Use `move_to_parent` to reparent existing nodes:

```javascript
move_to_parent({
  nodeId: "button-id",
  parentId: "target-container-id",
  x: 16,    // Position within new parent
  y: 16,
  index: 0  // Optional: 0=first child, -1=last
})
```

### Z-Order / Stacking

Use `reorder_node` to change stacking within same parent:

```javascript
reorder_node({
  nodeId: "node-id",
  index: -1  // -1 = front/top, 0 = back/bottom
})
```

### Getting Node Information

Use `get_node_info` to inspect nodes:

```javascript
get_node_info({ nodeId: "123:456" })
// Returns: { id, type, name, x, y, width, height,
//            parentId, parentName, children, indexInParent,
//            visible, locked, opacity }
```

## Node Management Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `find_nodes` | Find by type/name | `type`, `nameContains`, `within` |
| `select_nodes` | Select nodes | `nodeIds[]` |
| `get_selection` | Get selected nodes | - |
| `rename_node` | Rename | `nodeId`, `name` |
| `delete_node` | Delete | `nodeId` |
| `duplicate_node` | Clone (optionally to different parent) | `nodeId`, `parentId?`, `x?`, `y?` |
| `resize_node` | Resize | `nodeId`, `width`, `height` |
| `rotate_node` | Rotate | `nodeId`, `rotation` |
| `set_position` | Move within parent | `nodeId`, `x`, `y` |
| `move_to_parent` | Reparent node | `nodeId`, `parentId`, `index?`, `x?`, `y?` |
| `reorder_node` | Change z-order | `nodeId`, `index` |
| `get_node_info` | Inspect node | `nodeId` |
| `set_visibility` | Show/hide | `nodeId`, `visible` |
| `set_locked` | Lock/unlock | `nodeId`, `locked` |
| `flatten_node` | Flatten to vector | `nodeId` |
| `group_nodes` | Group nodes | `nodeIds[]`, `name?` |
| `ungroup` | Ungroup | `groupId` |

## Creation Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `create_frame` | Create frame | `width`, `height`, `name?`, `parentId?` |
| `create_rectangle` | Create rectangle | `width`, `height`, `hex?`, `cornerRadius?`, `parentId?` |
| `create_ellipse` | Create circle/ellipse | `width`, `height`, `hex?`, `parentId?` |
| `create_line` | Create line | `length`, `strokeHex?`, `parentId?` |
| `create_polygon` | Create polygon | `sides`, `radius`, `parentId?` |
| `create_star` | Create star | `points`, `innerRadius`, `outerRadius`, `parentId?` |
| `add_text` | Create text | `text`, `fontSize?`, `fontFamily?`, `fontStyle?`, `parentId?` |
| `place_image_base64` | Place image from base64 | `base64`, `width`, `height`, `parentId?` |
| `place_image_url` | Place image from URL | `url`, `width`, `height`, `parentId?` |
| `create_vector` | Create SVG vector | `svgString` OR `pathData`, `width`, `height` |

## SVG Icons (create_vector)

### Recommended: Use svgString

```javascript
create_vector({
  svgString: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  width: 24,
  height: 24,
  name: "user-icon",
  parentId: "frame-id"
})
```

**Supports:** All SVG features including arcs (A), circles, lines, complex paths.

### Alternative: Use pathData

For simple paths without arcs:

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

**Limitation:** Does NOT support arc commands (A/a). Use `svgString` for icons with rounded corners or circles.

## Styling Tools

| Tool | Description |
|------|-------------|
| `set_fill` | Solid fill: `nodeId`, `hex`, `opacity?` |
| `set_gradient_fill` | Gradient fill: `nodeId`, `stops[]`, `angle?` |
| `set_stroke` | Stroke: `nodeId`, `hex`, `strokeWeight?`, `dashPattern?` |
| `set_gradient_stroke` | Gradient stroke |
| `set_corner_radius` | Corner radius: `nodeId`, `radius` or individual corners |
| `set_opacity` | Opacity: `nodeId`, `opacity` (0-1) |
| `set_blend_mode` | Blend mode: `nodeId`, `blendMode` |
| `add_effect` | Add shadow/blur: `nodeId`, `type`, `radius`, `color?` |
| `clear_effects` | Remove all effects |

## Auto Layout

```javascript
set_auto_layout({
  nodeId: "frame-id",
  direction: "VERTICAL",     // or "HORIZONTAL"
  spacing: 16,               // Gap between items
  paddingTop: 24,
  paddingRight: 24,
  paddingBottom: 24,
  paddingLeft: 24,
  primaryAxisAlign: "CENTER",    // MIN, CENTER, MAX, SPACE_BETWEEN
  counterAxisAlign: "CENTER",    // MIN, CENTER, MAX
  wrap: false
})
```

## Variables (Design Tokens)

```javascript
// Create collection with modes
create_variable_collection({
  name: "Theme",
  modes: ["Light", "Dark"]
})

// Create color variable
create_variable({
  collectionId: "collection-id",
  name: "Primary",
  type: "COLOR",
  value: "#0066FF",
  scopes: ["FRAME_FILL", "SHAPE_FILL"]
})

// Set value for specific mode
set_variable_value({
  variableId: "var-id",
  modeId: "dark-mode-id",
  value: "#3399FF"
})

// Bind variable to node
bind_variable({
  nodeId: "node-id",
  field: "fill",        // fill, stroke, width, height, itemSpacing, padding...
  variableId: "var-id"
})
```

## Components

```javascript
// Create component from existing node
create_component_from_node({
  nodeId: "frame-id",
  name: "Button"
})

// Create instance
create_instance({
  componentId: "component-id",
  x: 100,
  y: 100,
  parentId: "container-id"
})

// Add component property
add_component_property({
  componentId: "component-id",
  name: "Label",
  type: "TEXT",
  defaultValue: "Button"
})

// Set instance property
set_instance_property({
  instanceId: "instance-id",
  property: "Label",
  value: "Submit"
})
```

## Common Workflows

### Creating a Button

```javascript
// 1. Create button frame
create_frame({ name: "Button", width: 120, height: 40 })

// 2. Set fill and corner radius
set_fill({ nodeId: "button-id", hex: "#0066FF" })
set_corner_radius({ nodeId: "button-id", radius: 8 })

// 3. Add auto layout
set_auto_layout({
  nodeId: "button-id",
  direction: "HORIZONTAL",
  spacing: 8,
  paddingTop: 10, paddingRight: 16, paddingBottom: 10, paddingLeft: 16,
  primaryAxisAlign: "CENTER",
  counterAxisAlign: "CENTER"
})

// 4. Add text
add_text({
  text: "Click me",
  fontSize: 14,
  fontFamily: "Inter",
  fontStyle: "Semi Bold",
  hex: "#FFFFFF",
  parentId: "button-id"
})
```

### Moving Button to Container

```javascript
// Find the button
find_nodes({ nameContains: "Button" })

// Move to target container
move_to_parent({
  nodeId: "button-id",
  parentId: "container-id",
  x: 16,
  y: 16
})
```

### Creating Icon + Text Row

```javascript
// Create horizontal frame
create_frame({ name: "Row", width: 200, height: 24 })

// Set auto layout
set_auto_layout({
  nodeId: "row-id",
  direction: "HORIZONTAL",
  spacing: 8,
  counterAxisAlign: "CENTER"
})

// Add icon
create_vector({
  svgString: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ...></svg>',
  width: 16,
  height: 16,
  parentId: "row-id"
})

// Add text
add_text({
  text: "Settings",
  fontSize: 14,
  parentId: "row-id"
})
```

## Tips for AI Agents

1. **Always use `parentId`** when creating nested elements
2. **Use `find_nodes`** to locate existing elements before modifying
3. **Use `get_node_info`** to understand current node state
4. **Use `move_to_parent`** to reorganize existing nodes
5. **Prefer `svgString`** over `pathData` for icons
6. **Set Auto Layout** before adding children for responsive layouts
7. **Font style names** use spaces: "Semi Bold" not "SemiBold"
8. **Colors** are 6-digit hex: "#0066FF" not "#06F"

## Error Handling

Tools return `{ ok: true, ...result }` on success or throw errors. Common errors:

- "Node not found" - Invalid nodeId
- "Target parent cannot contain children" - parentId is not a frame/group/component
- "Figma plugin not connected" - Plugin not running in Figma

## Connection Status

The MCP server logs to stderr:
- `[bridge] Waiting for plugin on ws://127.0.0.1:3055` - Server started
- `[bridge] Plugin connected` - Ready to use
- `[bridge] Plugin disconnected` - Reconnection needed
