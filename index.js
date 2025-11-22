#!/usr/bin/env node

import https from 'https';

const NODE_ENV = process.env.NODE_ENV || 'production';
if (NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0], 10);

if (majorVersion < 18) {
  process.stderr.write(`ERROR: Node.js version ${nodeVersion} is not supported.\n`);
  process.stderr.write('Codesona MCP Server requires Node.js 18.0.0 or higher.\n');
  process.stderr.write('Please upgrade your Node.js version.\n');
  process.exit(1);
}

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const CODESONA_API_URL = process.env.CODESONA_API_URL || 'https://codesona.ai';
const CODESONA_API_KEY = process.env.CODESONA_API_KEY;

const cache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000,
};

const configCache = {
  data: null,
  timestamp: null,
  ttl: 10 * 60 * 1000,
};

function isCacheValid(cacheObj) {
  if (!cacheObj.data || !cacheObj.timestamp) {
    return false;
  }
  const age = Date.now() - cacheObj.timestamp;
  return age < cacheObj.ttl;
}

function setCachedData(cacheObj, data) {
  cacheObj.data = data;
  cacheObj.timestamp = Date.now();
}

async function fetchFromCodesonaAPI(endpoint, method, apiKey, body = null) {
  const keyPrefix = apiKey.substring(0, 12);
  const timestamp = new Date().toISOString();
  
  process.stderr.write(`[${timestamp}] [API_FETCH] ${method} ${endpoint} with key ${keyPrefix}...\n`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const options = {
      method,
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    };

    if (body) {
      options.body = JSON.stringify(body);
      process.stderr.write(`[${timestamp}] [API_FETCH] Request body: ${JSON.stringify(body)}\n`);
    }

    if (CODESONA_API_URL.startsWith('https:')) {
      options.agent = httpsAgent;
    }

    process.stderr.write(`[${timestamp}] [API_FETCH] Calling: ${CODESONA_API_URL}${endpoint}\n`);
    const response = await fetch(`${CODESONA_API_URL}${endpoint}`, options);

    clearTimeout(timeoutId);

    process.stderr.write(`[${timestamp}] [API_FETCH] Response status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Endpoint not found: ${endpoint}`);
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Invalid API Key`);
      }
      throw new Error(`API error ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();
      process.stderr.write(`[${timestamp}] [API_FETCH] ✓ Success (JSON response)\n`);
      return json;
    } else {
      const text = await response.text();
      process.stderr.write(`[${timestamp}] [API_FETCH] ✓ Success (${text.length} chars text response)\n`);
      return text;
    }
  } catch (error) {
    if (error.name === "AbortError") {
      process.stderr.write(`[${timestamp}] [API_FETCH] ✗ Timeout after 10 seconds\n`);
      throw new Error("Network timeout: API request took longer than 10 seconds");
    }
    process.stderr.write(`[${timestamp}] [API_FETCH] ✗ Error: ${error.message}\n`);
    throw error;
  }
}

async function getMcpConfig(apiKey) {
  if (isCacheValid(configCache)) {
    process.stderr.write(`[MCP_CONFIG] ✓ Using cached MCP config\n`);
    return configCache.data;
  }

  try {
    process.stderr.write(`[MCP_CONFIG] Fetching config from ${CODESONA_API_URL}/api/v1/mcp-config\n`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const options = {
      method: 'GET',
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    };

    if (CODESONA_API_URL.startsWith('https:')) {
      options.agent = httpsAgent;
    }

    const response = await fetch(`${CODESONA_API_URL}/api/v1/mcp-config`, options);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${response.statusText}`);
    }

    const config = await response.json();
    setCachedData(configCache, config);
    process.stderr.write(`[MCP_CONFIG] ✓ Fetched MCP config from API\n`);
    return config;
  } catch (error) {
    process.stderr.write(`[MCP_CONFIG] ✗ Error: ${error.message}\n`);
    if (configCache.data) {
      process.stderr.write(`[MCP_CONFIG] ⚠ API unavailable, using stale MCP config cache\n`);
      return configCache.data;
    }
    throw new Error(`Failed to load MCP config: ${error.message}`);
  }
}

async function getRules(apiKey, codeContext = null) {
  if (isCacheValid(cache)) {
    process.stderr.write(`✓ Using cached rules\n`);
    return cache.data;
  }

  try {
    const body = {
      codeContext: codeContext || {
        language: "csharp",
        framework: "aspnet",
        platform: "backend"
      }
    };

    const rulesText = await fetchFromCodesonaAPI('/api/v1/dynamic-rules', 'POST', apiKey, body);
    
    setCachedData(cache, rulesText);
    process.stderr.write(`✓ Fetched rules from API\n`);
    
    return rulesText;
  } catch (error) {
    if (cache.data) {
      process.stderr.write(`⚠ API unavailable, using stale cached data\n`);
      return cache.data;
    }
    throw new Error(`API unavailable and no cached data: ${error.message}`);
  }
}

async function createMCPServer(mcpConfig, apiKey) {
  const server = new Server(
    {
      name: mcpConfig.serverConfig.name,
      version: mcpConfig.serverConfig.version,
      description: mcpConfig.serverConfig.description,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    try {
      const resources = mcpConfig.resources.map(r => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));

      return { resources };
    } catch (error) {
      process.stderr.write(`✗ Error listing resources: ${error.message}\n`);
      throw error;
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    try {
      const resource = mcpConfig.resources.find(r => r.uri === uri);
      
      if (!resource) {
        throw new Error(`Unknown resource URI: ${uri}`);
      }

      const rulesText = await getRules(apiKey);

      return {
        contents: [
          {
            uri,
            mimeType: resource.mimeType,
            text: rulesText,
          },
        ],
      };
    } catch (error) {
      process.stderr.write(`✗ Error reading resource ${uri}: ${error.message}\n`);
      throw error;
    }
  });

  server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
    try {
      const prompts = mcpConfig.prompts.map(p => ({
        name: p.name,
        description: p.description,
        arguments: [],
      }));

      return { prompts };
    } catch (error) {
      process.stderr.write(`✗ Error listing prompts: ${error.message}\n`);
      throw error;
    }
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;

    try {
      const prompt = mcpConfig.prompts.find(p => p.name === name);
      
      if (!prompt) {
        throw new Error(`Unknown prompt: ${name}`);
      }

      const rulesText = await getRules(apiKey);
      
      process.stderr.write(`🚨 PROMPT SAMPLING: Injecting rules\n`);
      
      let messages = [];
      
      messages.push({
        role: "user",
        content: {
          type: "text",
          text: rulesText,
        },
      });
      
      process.stderr.write(`✅ PROMPT SAMPLING: Rules injected successfully\n`);
      
      return {
        description: prompt.instructions,
        messages,
      };
    } catch (error) {
      process.stderr.write(`✗ PROMPT SAMPLING ERROR: ${error.message}\n`);
      return {
        description: "Error loading team rules",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Error loading team rules: ${error.message}`,
            },
          },
        ],
      };
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    try {
      const tools = mcpConfig.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));

      return { tools };
    } catch (error) {
      process.stderr.write(`✗ Error listing tools: ${error.message}\n`);
      throw error;
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const tool = mcpConfig.tools.find(t => t.name === name);
      
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      if (tool.name === "get_coding_rules") {
        process.stderr.write(`🚨 TOOL CALL: get_coding_rules invoked\n`);
        
        const codeContext = args?.codeContext;
        const rulesText = await getRules(apiKey, codeContext);
        
        process.stderr.write(`✅ TOOL CALL: get_coding_rules completed successfully\n`);
        
        return {
          content: [
            {
              type: "text",
              text: rulesText,
            },
          ],
        };
      }

      if (tool.name === "suggest_new_rule") {
        const { title, description, rationale, exampleCode, badExampleCode, goodExampleCode, codeContext } = args;
        
        if (!title || !description || !rationale) {
          return {
            content: [{
              type: "text",
              text: "Error: Missing required fields. Required: title, description, rationale"
            }],
            isError: true
          };
        }
        
        process.stderr.write(`📝 TOOL CALL: suggest_new_rule invoked\n`);
        process.stderr.write(`   Title: ${title}\n`);
        
        const payload = {
          codeContext: codeContext || {
            language: "csharp",
            framework: "aspnet",
            platform: "backend"
          },
          title,
          description,
          rationale,
          exampleCode: exampleCode || null,
          badExampleCode: badExampleCode || null,
          goodExampleCode: goodExampleCode || null
        };
        
        const result = await fetchFromCodesonaAPI(tool.config.endpoint, tool.config.method, apiKey, payload);
        
        process.stderr.write(`✅ Rule suggestion sent: ${result.suggestionId}\n`);
        
        return {
          content: [
            {
              type: "text",
              text: `✓ Rule suggestion sent successfully!\n\nSuggestion ID: ${result.suggestionId}\nStatus: ${result.status}\n\n${result.message}`,
            },
          ],
        };
      }

      throw new Error(`Tool ${name} not implemented`);
    } catch (error) {
      process.stderr.write(`✗ Error executing tool ${name}: ${error.message}\n`);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

async function main() {
  const banner = `
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║                     CODESONA MCP SERVER                          ║
║                    Team Coding Standards                         ║
║                                                                  ║
║   📋 Provides team coding rules via MCP (Stdio Transport)         ║
║   🔄 Auto-syncs from centralized API                             ║
║   🔐 Uses API Key from environment variable                       ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`;

  process.stderr.write(banner);
  process.stderr.write("\n");
  process.stderr.write("🚀 Starting Codesona MCP Server (stdio)...\n");
  process.stderr.write(`   Environment: ${NODE_ENV}\n`);
  process.stderr.write(`   API URL: ${CODESONA_API_URL}\n`);
  
  if (!CODESONA_API_KEY) {
    process.stderr.write("\n");
    process.stderr.write("✗ FATAL: CODESONA_API_KEY environment variable is required\n");
    process.stderr.write("   Please set CODESONA_API_KEY before starting the server\n");
    process.exit(1);
  }
  
  const keyPrefix = CODESONA_API_KEY.substring(0, 12);
  process.stderr.write(`   API Key: ${keyPrefix}...\n`);
  process.stderr.write("\n");
  
  process.stderr.write("📡 Loading MCP configuration (required for startup)...\n");
  let mcpConfig;
  try {
    mcpConfig = await getMcpConfig(CODESONA_API_KEY);
    process.stderr.write("✓ MCP configuration loaded successfully\n");
  } catch (error) {
    process.stderr.write(`✗ FATAL: Failed to load MCP config: ${error.message}\n`);
    process.stderr.write("✗ Server cannot start without MCP configuration\n");
    process.exit(1);
  }
  process.stderr.write("\n");

  const server = await createMCPServer(mcpConfig, CODESONA_API_KEY);
  const transport = new StdioServerTransport();

  process.stderr.write("✓ Connecting server to stdio transport...\n");
  await server.connect(transport);
  process.stderr.write("✓ Codesona MCP Server ready (stdio)\n");
  process.stderr.write("📡 Listening for MCP requests on stdin/stdout\n");
  process.stderr.write("\n");
}

main().catch((error) => {
  process.stderr.write(`✗ Fatal error: ${error}\n`);
  process.stderr.write(`   Stack: ${error.stack}\n`);
  process.exit(1);
});
