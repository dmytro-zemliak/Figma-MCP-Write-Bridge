# Figma MCP Write Bridge

A Model Context Protocol (MCP) server that enables AI coding agents to manipulate Figma documents programmatically through a WebSocket bridge and Figma plugin.

## Overview

This project provides a local MCP server that exposes write/manipulation tools for running Figma documents. It allows AI assistants and LLMs to create, modify, and manage Figma design elements programmatically via a lightweight plugin bridge.

### Architecture

```
AI Client (VS Code) ←→ MCP Server (stdio) ←→ WebSocket Bridge ←→ Figma Plugin
```

1. **MCP Server** (`server.ts`): Runs locally and exposes tools via the Model Context Protocol over stdio
2. **WebSocket Bridge**: Enables communication between the server and Figma plugin
3. **Figma Plugin**: Executes Figma API operations and returns results

## Features

### Node Creation
- Create frames, rectangles, ellipses, lines, polygons, and stars
- Add text with customizable fonts and styling
- Place images from base64-encoded data or URL
- Create vector icons from SVG (full SVG string or path data)

### Node Management
- Find and select nodes by name or type
- Rename, delete, duplicate nodes
- Resize and rotate elements
- Position nodes precisely
- Group and ungroup nodes
- Create and switch pages

### Styling & Effects
- Set fills and strokes with hex color support
- Apply gradient fills and strokes
- Configure corner radius, opacity, and blend modes
- Add drop shadows, inner shadows, and blur effects
- Manage layout grids

### Layout
- Configure Auto Layout with full control over spacing, padding, alignment
- Set child constraints
- Control spacing and alignment

### Text Manipulation
- Edit text content
- Apply text styles (font family, size, weight, spacing)
- Set text colors and gradients

### Variables (Design Tokens)
- Create variable collections with multiple modes (Light/Dark themes)
- Define COLOR, FLOAT, STRING, and BOOLEAN variables
- Bind variables to node properties (fill, stroke, spacing, etc.)
- Update variables to automatically update all bound nodes
- Configure variable scopes for UI picker visibility

### Styles
- Create and manage reusable text styles
- Create and manage effect styles (shadows, blurs)
- Apply styles to nodes for consistent design
- Update styles to propagate changes across all uses

### Components
- Create components from existing nodes
- Create component sets for variants (hover, active, disabled states)
- Add configurable properties (text, boolean, instance swap)
- Create and manage component instances
- Detach instances from components

### Boolean Operations
- Perform boolean operations (union, subtract, intersect, exclude)

### Data & Export
- Export nodes as PNG, JPG, or SVG
- Manage plugin data (JSON storage)
- Batch apply properties to multiple nodes

## Installation

### Prerequisites

- Node.js 18+ installed
- Figma desktop app or browser access
- An MCP-compatible AI client (e.g., VS Code with Copilot)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/figma-mcp-write-bridge.git
   cd figma-mcp-write-bridge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Import the Figma plugin**
   - Open Figma
   - Go to **Plugins** → **Development** → **Import plugin from manifest**
   - Select `plugin/manifest.json` from this project

## Usage

### Starting the Server

```bash
npm start
```

This will:
- Start the WebSocket server on `ws://127.0.0.1:3055`
- Initialize the MCP server listening on stdio
- Wait for the Figma plugin to connect

### Running the Figma Plugin

1. Open a Figma document
2. Go to **Plugins** → **Development** → **MCP Figma Write Bridge**
3. The plugin runs with a hidden UI to establish the WebSocket connection
4. You should see `[bridge] Plugin connected` in the server logs

### Connecting Your AI Client

Configure your MCP client (e.g., VS Code) to use this server:

```json
{
  "mcpServers": {
    "figma-write": {
      "command": "node",
      "args": [
        "--loader",
        "tsx",
        "/path/to/figma-mcp-write-bridge/server.ts"
      ]
    }
  }
}
```

Or using npm:

```json
{
  "mcpServers": {
    "figma-write": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/figma-mcp-write-bridge"
    }
  }
}
```

## Available Tools

### Creation Tools
- `create_frame` - Create a new frame with optional parentId for nesting
- `create_rectangle` - Create a rectangle with optional corner radius
- `create_ellipse` - Create an ellipse
- `create_line` - Create a line
- `create_polygon` - Create a polygon with specified number of sides
- `create_star` - Create a star shape
- `add_text` - Add text with font styling
- `place_image_base64` - Place an image from base64 data
- `place_image_url` - Fetch and place an image from URL
- `create_vector` - Create vector/icon from SVG (supports full SVG string or path data)

### Node Management
- `find_nodes` - Find nodes by name or type
- `select_nodes` - Select specific nodes
- `get_selection` - Get currently selected nodes
- `rename_node` - Rename a node
- `delete_node` - Delete a node
- `duplicate_node` - Duplicate a node
- `resize_node` - Resize a node
- `rotate_node` - Rotate a node
- `set_position` - Set absolute position
- `group_nodes` - Group multiple nodes
- `ungroup` - Ungroup a group node
- `create_page` - Create a new page
- `set_current_page` - Switch to a different page

### Styling
- `set_fill` - Set solid fill color
- `set_gradient_fill` - Apply linear gradient fill
- `set_stroke` - Configure stroke properties
- `set_gradient_stroke` - Apply gradient stroke
- `set_corner_radius` - Set corner radius (uniform or per-corner)
- `set_opacity` - Set opacity
- `set_blend_mode` - Set blend mode
- `add_effect` - Add visual effects (shadows, blurs)
- `clear_effects` - Remove all effects

### Layout
- `layout_grid_add` - Add layout grid
- `layout_grid_clear` - Clear layout grids
- `set_auto_layout` - Configure Auto Layout (direction, spacing, padding, alignment)
- `set_constraints` - Set child constraints

### Text
- `set_text_content` - Edit text content
- `set_text_style` - Apply text styling (font, size, weight, spacing)
- `set_text_color` - Set text color
- `set_text_gradient` - Apply gradient to text

### Variables (Design Tokens)
- `create_variable_collection` - Create a collection with optional modes (Light/Dark)
- `create_variable` - Create a variable (COLOR, FLOAT, STRING, BOOLEAN)
- `get_local_variable_collections` - List all variable collections
- `get_local_variables` - List all variables, optionally filtered by collection
- `set_variable_value` - Update a variable's value for a specific mode
- `bind_variable` - Bind a variable to a node property (fill, stroke, spacing, etc.)
- `unbind_variable` - Remove variable binding from a node property
- `delete_variable` - Delete a variable
- `delete_variable_collection` - Delete a collection and all its variables

### Styles
- `create_text_style` - Create a reusable text style
- `create_effect_style` - Create a reusable effect style (shadows, blurs)
- `get_local_text_styles` - List all text styles
- `get_local_effect_styles` - List all effect styles
- `apply_text_style` - Apply a text style to a text node
- `apply_effect_style` - Apply an effect style to a node
- `update_text_style` - Update an existing text style
- `update_effect_style` - Update an existing effect style
- `delete_style` - Delete a text or effect style

### Components
- `create_component` - Create an empty component
- `create_component_from_node` - Convert an existing node to a component
- `create_component_set` - Combine components into a variant set
- `create_instance` - Create a component instance
- `detach_instance` - Detach instance from component
- `add_component_property` - Add a configurable property (TEXT, BOOLEAN, INSTANCE_SWAP)
- `set_instance_property` - Set a property value on an instance
- `get_component_properties` - Get all properties of a component

### Advanced
- `boolean_op` - Boolean operations on vector nodes
- `export_node` - Export as PNG/JPG/SVG
- `set_plugin_data` / `get_plugin_data` - Store/retrieve JSON data

## SVG Icons

The `create_vector` tool supports two modes for creating icons:

### Using Full SVG String (Recommended)

Pass the complete SVG markup via `svgString`. This supports all SVG features including arcs, circles, and complex shapes.

```json
{
  "svgString": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/></svg>",
  "width": 24,
  "height": 24,
  "name": "user-icon"
}
```

### Using Path Data

For simple paths, pass just the `d` attribute value via `pathData`:

```json
{
  "pathData": "M20 6L9 17l-5-5",
  "width": 24,
  "height": 24,
  "strokeHex": "#000000",
  "strokeWeight": 2,
  "name": "check-icon"
}
```

**Note:** `pathData` mode uses Figma's `vectorPaths` API which does not accept arc commands (A/a). For icons with arcs, rounded corners, or circles, use `svgString` instead (which uses Figma's full SVG import).

### Icon Library Compatibility

| Library | Works with `pathData` | Notes |
|---------|----------------------|-------|
| Heroicons | ✅ Yes | Uses bezier curves |
| Lucide | ⚠️ Some | Many use arcs - use `svgString` |
| Feather | ❌ No | Uses line/circle elements - use `svgString` |

## Example Usage

Once connected, you can ask your AI assistant to:

> "Create a blue rectangle 200x100 at position 50,50"

> "Add a text saying 'Hello World' with Arial font size 24"

> "Group the selected nodes and name it 'Header'"

> "Export the frame as PNG"

or even:

> "Create a full landing page design with both desktop and mobile layouts with the theme ... and describe the idea in mind"

The AI will use the appropriate MCP tools to execute these operations in your Figma document.

## Development

### Project Structure

```
figma-mcp-write-bridge/
├── server.ts              # MCP server & WebSocket bridge
├── plugin/
│   ├── plugin.js          # Figma plugin implementation
│   ├── ui.html            # Hidden UI for WebSocket access
│   └── manifest.json      # Plugin manifest
├── package.json
└── tsconfig.json
```

### Adding New Tools

1. **Implement the action** in `plugin/plugin.js`:
   ```javascript
   async function myNewAction(input) {
     const { param1, param2 } = input;
     // Figma API operations
     return { result: "success" };
   }
   ```

2. **Add to the dispatcher** in `handleAction()`:
   ```javascript
   case "my_new_action": return myNewAction(input);
   ```

3. **Register the MCP tool** in `server.ts`:
   ```typescript
   registerTool(
     "my_new_tool",
     z.object({ param1: z.string(), param2: z.number() }),
     "Description of what this tool does",
     "my_new_action"
   );
   ```

### Debugging

- **Server logs**: Check stderr output from `npm start`
- **Plugin logs**: Open Figma → Plugins → Development → Open Console
- **WebSocket connection**: Look for `[bridge] Plugin connected` message
- **Timeouts**: Default 20s timeout for operations (configurable in `sendToPlugin()`)

## Limitations

- Single client connection (one plugin instance at a time)
- Operations must complete within 20 seconds
- Requires Figma desktop app or browser access
- Network access must be allowed in Figma plugin settings
- SVG `pathData` mode uses Figma's `vectorPaths` API which doesn't accept arc commands (use `svgString` instead)
- Multiple variable modes (Light/Dark) require Figma paid plan

## Troubleshooting

### "Figma plugin not connected" error

1. Ensure the Figma plugin is running (**Plugins** → **Development** → **MCP Figma Write Bridge**)
2. Check that the server is running (`npm start`)
3. Verify WebSocket connection logs

### Plugin times out

- Check Figma console for errors
- Ensure the action is implemented in `plugin.js`
- Verify the `replyTo` id matches in responses

### Font loading errors

- Font must be available in Figma
- Font name and style must match exactly
- Text operations automatically load fonts before modification

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with a running Figma instance
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Originally created by [firasmj](https://github.com/firasmj/Figma-MCP-Write-Bridge)
- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol)
- Uses [Figma Plugin API](https://www.figma.com/plugin-docs/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
