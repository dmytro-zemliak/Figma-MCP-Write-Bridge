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
- Place images from base64-encoded data

### Node Management
- Find and select nodes by name or type
- Rename, delete, duplicate nodes
- Resize and rotate elements
- Position nodes precisely
- Group and ungroup nodes

### Styling & Effects
- Set fills and strokes with hex color support
- Configure corner radius, opacity, and blend modes
- Add drop shadows, inner shadows, and blur effects
- Manage layout grids

### Layout
- Configure Auto Layout
- Set child constraints
- Control spacing and alignment

### Text Manipulation
- Edit text content
- Apply text styles (font family, size, weight, spacing)
- Set text colors

### Components & Boolean Operations
- Create components and instances
- Detach instances
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
- `create_frame` - Create a new frame
- `create_rectangle` - Create a rectangle with optional corner radius
- `create_ellipse` - Create an ellipse
- `create_line` - Create a line
- `create_polygon` - Create a polygon with specified number of sides
- `create_star` - Create a star shape
- `add_text` - Add text with font styling
- `place_image_base64` - Place an image from base64 data

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

### Styling
- `set_fill` - Set fill color
- `set_stroke` - Configure stroke properties
- `set_corner_radius` - Set corner radius (uniform or per-corner)
- `set_opacity` - Set opacity
- `set_blend_mode` - Set blend mode
- `add_effect` - Add visual effects (shadows, blurs)
- `clear_effects` - Remove all effects

### Layout
- `layout_grid_add` - Add layout grid
- `layout_grid_clear` - Clear layout grids
- `set_auto_layout` - Configure Auto Layout
- `set_constraints` - Set child constraints

### Text
- `set_text_content` - Edit text content
- `set_text_style` - Apply text styling
- `set_text_color` - Set text color

### Components
- `create_component` - Create a component
- `create_instance` - Create component instance
- `detach_instance` - Detach instance from component

### Advanced
- `boolean_op` - Boolean operations on vector nodes
- `export_node` - Export as PNG/JPG/SVG
- `set_plugin_data` / `get_plugin_data` - Store/retrieve JSON data

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
- **Timeouts**: Default 15s timeout for operations (configurable in `sendToPlugin()`)

## Limitations

- Single client connection (one plugin instance at a time)
- Operations must complete within 15 seconds
- Requires Figma desktop app or browser access
- Network access must be allowed in Figma plugin settings

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

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol)
- Uses [Figma Plugin API](https://www.figma.com/plugin-docs/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
