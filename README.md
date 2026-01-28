# MCP Figma Toolkit

An MCP server that lets AI agents design in Figma. Create shapes, text, components, styles, variables, and more.

[![npm version](https://badge.fury.io/js/mcp-figma-toolkit.svg)](https://www.npmjs.com/package/mcp-figma-toolkit)

## How It Works

```
Your AI Assistant ←→ MCP Server ←→ Figma Plugin ←→ Figma Document
```

The MCP server communicates with a Figma plugin via WebSocket. Your AI client (Claude Code, VS Code, Cursor) connects to the MCP server and can then create and manipulate designs in Figma.

## Quick Start

```bash
# 1. Install globally
npm install -g mcp-figma-toolkit

# 2. Find where the plugin was installed
npm root -g
# Note the path, e.g., /Users/you/.nvm/versions/node/v20/lib/node_modules
```

Then:
1. Open Figma → **Plugins** → **Development** → **Import plugin from manifest**
2. Navigate to `<path-from-above>/mcp-figma-toolkit/plugin/manifest.json`
3. Add the MCP server to your AI client config (see [Configuration](#configuration))

## Installation

### Prerequisites

- [Node.js 18+](https://nodejs.org)
- [Figma Desktop App](https://figma.com/downloads)
- An MCP-compatible AI client (Claude Code, VS Code with Copilot, Cursor)

### Step 1: Install the Package

```bash
npm install -g mcp-figma-toolkit
```

### Step 2: Import the Figma Plugin

The plugin files are bundled with the npm package. You need to import them into Figma once.

**Find the plugin location:**

macOS / Linux:
```bash
echo "$(npm root -g)/mcp-figma-toolkit/plugin"
```

Windows (PowerShell):
```powershell
echo "$(npm root -g)\mcp-figma-toolkit\plugin"
```

**Import into Figma:**

1. Open Figma Desktop
2. Click the Figma menu (top-left) → **Plugins** → **Development** → **Import plugin from manifest...**
3. Navigate to the plugin folder from above
4. Select `manifest.json` and click **Open**

The plugin "MCP Figma Toolkit" should now appear under **Plugins → Development**.

### Alternative: Clone from Source

```bash
git clone https://github.com/dmytro-zemliak/mcp-figma-toolkit.git
cd mcp-figma-toolkit
npm install
npm run build
```

Then import the plugin from the `plugin/` folder.

## Configuration

Add the MCP server to your AI client's configuration file.

### Claude Code

Edit `~/.claude.json` (macOS/Linux) or `%USERPROFILE%\.claude.json` (Windows):

```json
{
  "mcpServers": {
    "figma": {
      "command": "mcp-figma-toolkit"
    }
  }
}
```

### VS Code / Cursor

Create `.vscode/mcp.json` in your project:

```json
{
  "mcpServers": {
    "figma": {
      "command": "mcp-figma-toolkit"
    }
  }
}
```

### Using npx (No Global Install)

If you prefer not to install globally:

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["mcp-figma-toolkit"]
    }
  }
}
```

## Usage

### Starting a Design Session

1. **Open Figma** and create or open a document

2. **Run the plugin**: **Plugins** → **Development** → **MCP Figma Toolkit**

   The plugin window is hidden but establishes the connection.

3. **Start your AI client** (Claude Code, VS Code, etc.)

   The MCP server starts automatically when your AI client launches.

4. **Design with AI!** Ask your assistant to create designs:

   > "Create a blue button with rounded corners and white text saying 'Get Started'"

   > "Design a card component with an image, title, and description"

   > "Set up a color system with primary, secondary, and neutral colors"

   > "Create a mobile login screen with email and password fields"

### Session Workflow

```
┌─────────────────────────────────────────────────────────┐
│  1. Open Figma document                                 │
│  2. Run plugin (Plugins → Development → MCP Figma...)   │
│  3. Use your AI client to design                        │
│  4. Plugin stays connected until you close Figma        │
└─────────────────────────────────────────────────────────┘
```

**Note:** You need to run the Figma plugin each time you open a new Figma document.

## Features

### Creation
- Frames, rectangles, ellipses, lines, polygons, stars
- Text with custom fonts and styling
- Images from URL or base64
- Vector icons from SVG

### Styling
- Solid and gradient fills/strokes
- Corner radius, opacity, blend modes
- Drop shadows, inner shadows, blurs
- Layout grids

### Layout
- Auto Layout (direction, spacing, padding, alignment)
- Constraints

### Variables (Design Tokens)
- Variable collections with modes (Light/Dark)
- COLOR, FLOAT, STRING, BOOLEAN types
- Bind variables to node properties

### Styles
- Reusable text styles
- Reusable effect styles

### Components
- Create components from nodes
- Component sets (variants)
- Component properties (text, boolean, instance swap)
- Instances

### Other
- Boolean operations (union, subtract, intersect, exclude)
- Export as PNG, JPG, SVG
- Plugin data storage

## Available Tools

<details>
<summary><strong>Creation Tools</strong></summary>

| Tool | Description |
|------|-------------|
| `create_frame` | Create a frame with optional parent |
| `create_rectangle` | Create a rectangle |
| `create_ellipse` | Create an ellipse/circle |
| `create_line` | Create a line |
| `create_polygon` | Create a polygon |
| `create_star` | Create a star |
| `add_text` | Add text with font styling |
| `place_image_url` | Place image from URL |
| `place_image_base64` | Place image from base64 |
| `create_vector` | Create vector from SVG |

</details>

<details>
<summary><strong>Node Management</strong></summary>

| Tool | Description |
|------|-------------|
| `find_nodes` | Find nodes by name/type |
| `select_nodes` | Select nodes |
| `get_selection` | Get current selection |
| `rename_node` | Rename a node |
| `delete_node` | Delete a node |
| `duplicate_node` | Duplicate a node |
| `resize_node` | Resize a node |
| `rotate_node` | Rotate a node |
| `set_position` | Set position |
| `group_nodes` | Group nodes |
| `ungroup` | Ungroup |
| `create_page` | Create a page |
| `set_current_page` | Switch page |

</details>

<details>
<summary><strong>Styling</strong></summary>

| Tool | Description |
|------|-------------|
| `set_fill` | Set solid fill |
| `set_gradient_fill` | Set gradient fill |
| `set_stroke` | Set stroke |
| `set_gradient_stroke` | Set gradient stroke |
| `set_corner_radius` | Set corner radius |
| `set_opacity` | Set opacity |
| `set_blend_mode` | Set blend mode |
| `add_effect` | Add shadow/blur |
| `clear_effects` | Remove effects |

</details>

<details>
<summary><strong>Layout</strong></summary>

| Tool | Description |
|------|-------------|
| `set_auto_layout` | Configure Auto Layout |
| `set_constraints` | Set constraints |
| `layout_grid_add` | Add layout grid |
| `layout_grid_clear` | Clear grids |

</details>

<details>
<summary><strong>Text</strong></summary>

| Tool | Description |
|------|-------------|
| `set_text_content` | Edit text |
| `set_text_style` | Set font/size/spacing |
| `set_text_color` | Set text color |
| `set_text_gradient` | Set text gradient |

</details>

<details>
<summary><strong>Variables</strong></summary>

| Tool | Description |
|------|-------------|
| `create_variable_collection` | Create collection |
| `create_variable` | Create variable |
| `get_local_variable_collections` | List collections |
| `get_local_variables` | List variables |
| `set_variable_value` | Update value |
| `bind_variable` | Bind to property |
| `unbind_variable` | Remove binding |
| `delete_variable` | Delete variable |
| `delete_variable_collection` | Delete collection |

</details>

<details>
<summary><strong>Styles</strong></summary>

| Tool | Description |
|------|-------------|
| `create_text_style` | Create text style |
| `create_effect_style` | Create effect style |
| `get_local_text_styles` | List text styles |
| `get_local_effect_styles` | List effect styles |
| `apply_text_style` | Apply text style |
| `apply_effect_style` | Apply effect style |
| `update_text_style` | Update text style |
| `update_effect_style` | Update effect style |
| `delete_style` | Delete style |

</details>

<details>
<summary><strong>Components</strong></summary>

| Tool | Description |
|------|-------------|
| `create_component` | Create empty component |
| `create_component_from_node` | Convert to component |
| `create_component_set` | Create variant set |
| `create_instance` | Create instance |
| `detach_instance` | Detach instance |
| `add_component_property` | Add property |
| `set_instance_property` | Set property |
| `get_component_properties` | Get properties |

</details>

<details>
<summary><strong>Advanced</strong></summary>

| Tool | Description |
|------|-------------|
| `boolean_op` | Boolean operations |
| `export_node` | Export as image |
| `set_plugin_data` | Store data |
| `get_plugin_data` | Retrieve data |
| `set_properties` | Batch set properties |

</details>

## SVG Icons

The `create_vector` tool supports two modes:

### Full SVG (Recommended)

Use `svgString` for any SVG, including those with arcs, circles, and complex shapes:

```json
{
  "svgString": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\">...</svg>",
  "width": 24,
  "height": 24,
  "name": "icon"
}
```

### Path Data Only

Use `pathData` for simple paths (no arcs):

```json
{
  "pathData": "M20 6L9 17l-5-5",
  "width": 24,
  "height": 24,
  "strokeHex": "#000000",
  "strokeWeight": 2
}
```

**Icon Library Compatibility:**

| Library | Recommended Mode |
|---------|------------------|
| Heroicons | `pathData` or `svgString` |
| Lucide | `svgString` (uses arcs) |
| Feather | `svgString` (uses circles) |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Figma plugin not connected" | Run the plugin in Figma: **Plugins → Development → MCP Figma Toolkit** |
| `mcp-figma-toolkit: command not found` | Run `npm install -g mcp-figma-toolkit` |
| Port 3055 in use | Kill existing process: `lsof -ti:3055 \| xargs kill -9` (macOS) |
| Plugin not in Figma menu | Re-import `manifest.json` via **Plugins → Development → Import plugin from manifest** |
| Font errors | Ensure the font is installed on your system and available in Figma |

## Development

### Project Structure

```
mcp-figma-toolkit/
├── server.ts          # MCP server (TypeScript source)
├── dist/              # Compiled JavaScript
├── plugin/
│   ├── plugin.js      # Figma plugin
│   ├── ui.html        # WebSocket bridge
│   └── manifest.json  # Plugin manifest
├── package.json
└── tsconfig.json
```

### Building

```bash
npm install
npm run build    # Compile TypeScript
npm run dev      # Run with tsx (development)
npm start        # Run compiled version
```

### Adding Tools

1. Add action handler in `plugin/plugin.js`
2. Add case in `handleAction()` switch
3. Register tool in `server.ts` with Zod schema
4. Rebuild: `npm run build`

## Limitations

- One Figma document connection at a time
- 20-second timeout per operation
- Multiple variable modes (Light/Dark) require Figma paid plan
- SVG `pathData` doesn't support arc commands (use `svgString` instead)

## License

MIT

## Acknowledgments

- Originally forked from [firasmj/Figma-MCP-Write-Bridge](https://github.com/firasmj/Figma-MCP-Write-Bridge)
- Built with [Model Context Protocol SDK](https://github.com/modelcontextprotocol)
- Uses [Figma Plugin API](https://www.figma.com/plugin-docs/)
