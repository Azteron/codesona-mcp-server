# Codesona MCP Server

A standard MCP server that provides team coding standards via stdio transport. This server connects to the Codesona API and serves your team's coding rules to AI assistants in IDEs like Cursor, Windsurf, and other MCP-compatible tools.

## Features

- 🔄 Automatic rule fetching from centralized Codesona API
- 📦 Smart caching (5-minute cache)
- ⚡ Fast & lightweight Node.js implementation
- 🔐 Secure API key authentication
- 📊 Full MCP protocol compliance

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- A Codesona workspace API key (get it from [Codesona dashboard](https://codesona.ai))

### Method 1: Using npx (Recommended - No Installation Required)

This is the easiest method. No global installation needed.

1. **Get your API key** from Codesona dashboard

2. **Configure your IDE** (see IDE-specific instructions below)

### Method 2: Global Installation

Install the package globally for system-wide access:

```bash
npm install -g @codesona/mcp-server
```

After installation, configure your IDE with the `codesona-mcp-server` command.

### Method 3: From Source

1. **Clone the repository**
```bash
git clone https://dev.azure.com/Azteron/Codesona/_git/CodesonaMCPServer
cd CodesonaMCPServer
```

2. **Install dependencies**
```bash
npm install
```

3. **Make executable** (Unix/Mac only)
```bash
chmod +x index.js
```

4. **Configure your IDE** using the full path to `index.js`

## Configuration

### Environment Variables

- `CODESONA_API_KEY` (required): Your workspace API key from Codesona dashboard
- `CODESONA_API_URL` (optional): Codesona API URL (default: `https:/codesona.ai`)
- `NODE_ENV` (optional): Environment mode (development/production)

### IDE Setup Instructions

#### Cursor

1. **Open Cursor Settings**
   - Mac: `Cmd + ,` or `Code > Settings`
   - Windows/Linux: `Ctrl + ,` or `File > Preferences > Settings`

2. **Find MCP Settings**
   - Search for "MCP" in settings search bar
   - Or navigate to: Extensions > MCP

3. **Edit MCP Configuration**
   - Click "Edit in settings.json"
   - Add the following configuration:

   **Using npx (Recommended):**
```json
{
  "mcpServers": {
    "codesona": {
      "command": "npx",
      "args": ["-y", "@codesona/mcp-server"],
      "env": {
        "CODESONA_API_KEY": "your-workspace-api-key-here"
      }
    }
  }
}
```

   **Using global installation:**
```json
{
  "mcpServers": {
    "codesona": {
      "command": "codesona-mcp-server",
      "env": {
        "CODESONA_API_KEY": "your-workspace-api-key-here"
      }
    }
  }
}
```

4. **Replace the API key**
   - Change `your-workspace-api-key-here` to your actual API key from Codesona dashboard

5. **Save and restart Cursor**
   - Save the file (`Cmd+S` / `Ctrl+S`)
   - **Completely restart Cursor** (not just reload window)

#### Windsurf

1. **Open Windsurf Settings**
   - Navigate to Settings

2. **Find MCP Configuration**
   - Look for MCP Server settings
   - Click "Configure MCP Servers"

3. **Add Codesona Server**

   **Using npx (Recommended):**
```json
{
  "mcpServers": {
    "codesona": {
      "command": "npx",
      "args": ["-y", "@codesona/mcp-server"],
      "env": {
        "CODESONA_API_KEY": "your-workspace-api-key-here"
      }
    }
  }
}
```

   **Using global installation:**
```json
{
  "mcpServers": {
    "codesona": {
      "command": "codesona-mcp-server",
      "env": {
        "CODESONA_API_KEY": "your-workspace-api-key-here"
      }
    }
  }
}
```

4. **Replace the API key** and save

5. **Restart Windsurf**

#### Claude Desktop

1. **Open Claude Desktop Configuration**
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add MCP Server Configuration**

   **Using npx (Recommended):**
```json
{
  "mcpServers": {
    "codesona": {
      "command": "npx",
      "args": ["-y", "@codesona/mcp-server"],
      "env": {
        "CODESONA_API_KEY": "your-workspace-api-key-here"
      }
    }
  }
}
```

   **Using global installation:**
```json
{
  "mcpServers": {
    "codesona": {
      "command": "codesona-mcp-server",
      "env": {
        "CODESONA_API_KEY": "your-workspace-api-key-here"
      }
    }
  }
}
```

3. **Replace the API key** and save

4. **Restart Claude Desktop**

## Available MCP Tools

### `get_coding_rules`
Retrieves mandatory team coding standards. Accepts optional `codeContext` parameter:
- `language`: Programming language (e.g., "csharp", "javascript")
- `framework`: Framework name (e.g., "aspnet", "react")
- `platform`: Platform type (e.g., "backend", "frontend")

Rules are cached for 5 minutes.

### `suggest_new_rule`
Suggests a new coding rule to team standards. Required parameters: `title`, `description`, `rationale`. Optional: `exampleCode`, `badExampleCode`, `goodExampleCode`, `codeContext`.

## Available MCP Resources

- **Team Coding Standards** (`codesona://standards/team`): Team-wide rules that apply to all projects

## Available MCP Prompts

- **`apply-coding-standards`**: Applies team coding standards to the conversation via prompt sampling

## Troubleshooting

**Server won't start:**
- Verify `CODESONA_API_KEY` is set correctly
- Check Node.js version is 18.0.0 or higher
- Ensure API key is valid

**Invalid API key:**
- Get a fresh API key from Codesona dashboard
- Verify the key has correct permissions

**Rules not updating:**
- Rules are cached for 5 minutes
- Wait for cache expiry or check Codesona API for updates

**IDE can't connect:**
- Verify Node.js is in PATH
- Check environment variables are set correctly
- Review IDE logs for detailed error messages

## Development

### Local Development Setup

1. **Install dependencies**
```bash
npm install
```

2. **Set environment variables**
```bash
export CODESONA_API_KEY=your-api-key-here
export CODESONA_API_URL=https://codesona.ai
export NODE_ENV=development
```

3. **Run server**
```bash
node index.js
```

## License

MIT

## Support

For issues or questions:
- Visit [Codesona documentation](https://codesona.ai)
- Open an issue in this repository
