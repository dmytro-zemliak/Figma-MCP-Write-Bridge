# Contributing to Figma MCP Write Bridge

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/figma-mcp-write-bridge.git
   cd figma-mcp-write-bridge
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up the Figma plugin** (see README.md)

## Development Workflow

### Running the Server

```bash
npm start
```

### Testing Your Changes

1. Start the MCP server
2. Run the Figma plugin in a test document
3. Verify WebSocket connection is established
4. Test tool invocations through your MCP client
5. Check both server logs and Figma console for errors

### Code Style

- Use TypeScript for server code
- Follow existing code patterns
- Keep functions focused and well-documented
- Use meaningful variable names
- Add comments for complex logic

### File Organization

- **Server code**: `server.ts` (MCP tools & WebSocket bridge)
- **Plugin code**: `plugin/plugin.js` (Figma API implementations)
- **Plugin UI**: `plugin/ui.html` (WebSocket client)
- **Configuration**: `plugin/manifest.json`

## Adding New Features

### Adding a New MCP Tool

1. **Implement the Figma API action** in `plugin/plugin.js`:

   ```javascript
   async function myNewFeature(input) {
     const { requiredParam, optionalParam = "default" } = input;
     
     // Implement using Figma API
     const node = figma.createFrame();
     node.name = requiredParam;
     
     // Return serializable result
     return { 
       nodeId: node.id,
       success: true 
     };
   }
   ```

2. **Add to the action dispatcher** in `handleAction()`:

   ```javascript
   case "my_new_feature": return myNewFeature(input);
   ```

3. **Register the MCP tool** in `server.ts`:

   ```typescript
   registerTool(
     "my_new_tool",
     z.object({
       requiredParam: z.string().describe("Description"),
       optionalParam: z.string().optional().describe("Optional param"),
     }),
     "Clear description of what this tool does for AI clients",
     "my_new_feature"
   );
   ```

4. **Update documentation** in README.md

### Testing Guidelines

- Test with real Figma documents
- Verify error handling for invalid inputs
- Check timeout behavior for long operations
- Test with multiple node types when applicable
- Ensure proper cleanup (no orphaned nodes)

## Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes** following the guidelines above

3. **Commit with clear messages**:
   ```bash
   git commit -m "Add feature: description of what changed"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/my-new-feature
   ```

5. **Open a Pull Request** with:
   - Clear title describing the change
   - Description of what the PR does
   - Any breaking changes or migration notes
   - Test results or screenshots if applicable

## Code Review

Pull requests will be reviewed for:

- **Functionality**: Does it work as intended?
- **Code quality**: Is it readable and maintainable?
- **Documentation**: Are changes documented?
- **Backward compatibility**: Does it break existing functionality?
- **Security**: Are there any security concerns?

## Bug Reports

When filing an issue, please include:

- **Description**: Clear description of the bug
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: 
  - Node.js version
  - Figma version (desktop/browser)
  - MCP client being used
  - Operating system
- **Logs**: Relevant error messages or logs

## Feature Requests

For new feature requests:

- Check existing issues first
- Describe the use case clearly
- Explain why this feature would be useful
- Provide examples if possible

## Questions?

- Open a GitHub issue with the "question" label
- Be specific about what you're trying to accomplish

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what's best for the community
- Show empathy towards others

Thank you for contributing! 🎉
