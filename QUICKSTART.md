# AWP Quick Start Guide

Get started with the Agent Workspace Protocol in 5 minutes.

## 1. Install

```bash
# Clone the repo
git clone https://github.com/marcoloco23/awp.git
cd awp

# Install dependencies
npm install

# Build all packages
npm run build

# Link CLI globally
npm link -w packages/awp-cli

# Verify installation
awp --version
```

## 2. Set Up API Keys

Create a `.env` file in the project root:

```bash
# For OpenAI (default)
OPENAI_API_KEY=sk-xxx

# For Anthropic (optional)
ANTHROPIC_API_KEY=sk-ant-xxx
```

## 3. Create Your First Workspace

```bash
# Initialize a new agent workspace
awp init my-agent

cd my-agent

# Generate identity
awp identity generate

# Validate workspace
awp validate

# See what you have
awp inspect
```

## 4. Run an Experiment

```bash
# Go back to AWP repo
cd /path/to/awp

# Source API key
source .env && export OPENAI_API_KEY

# Create a society of agents
awp experiment society create --manifesto MANIFESTO.md --agents 3 --seed 42

# Note the society ID from output (e.g., manifesto-awp-purification-v1-xxx)

# Run 3 cycles
awp experiment run \
  --society manifesto-awp-purification-v1-xxx \
  --cycles 3 \
  --manifesto MANIFESTO.md

# View results
awp experiment show manifesto-awp-purification-v1-xxx
```

## 5. Use with MCP Clients

### Claude Code

```bash
claude mcp add awp-workspace -- npx @agent-workspace/mcp-server
```

### Cursor

Add to MCP settings:
```json
{
  "awp-workspace": {
    "command": "npx",
    "args": ["@agent-workspace/mcp-server"],
    "env": {
      "AWP_WORKSPACE": "/path/to/your/workspace"
    }
  }
}
```

## 6. Use with Moltbot (Clawdbot)

```bash
# Copy skill to moltbot
cp -r skills/awp-experiment ~/.nvm/versions/node/*/lib/node_modules/clawdbot/skills/

# Use via chat
clawdbot agent --message "Create a 3-agent AWP society"
clawdbot agent --message "Run 2 cycles on society manifesto-xxx"
```

## 7. Launch the Dashboard

```bash
AWP_WORKSPACE=/path/to/workspace npm run dev -w packages/awp-dashboard
# Opens at http://localhost:3000
```

## Key Commands

| Command | Description |
|---------|-------------|
| `awp init` | Create new workspace |
| `awp validate` | Validate workspace |
| `awp status` | Rich overview |
| `awp identity generate` | Generate DID |
| `awp artifact create <slug>` | Create knowledge artifact |
| `awp reputation query <agent>` | Query reputation |
| `awp experiment society create` | Create agent society |
| `awp experiment run` | Run experiment cycles |

## Project Structure

```
your-agent/
  .awp/workspace.json    # Workspace manifest
  IDENTITY.md            # Agent identity
  SOUL.md                # Behavioral constraints
  memory/                # Daily logs
  artifacts/             # Knowledge documents
  reputation/            # Agent reputation profiles
  contracts/             # Delegation contracts
  projects/              # Coordination projects
```

## Next Steps

- Read the [full specification](spec/awp-spec.md)
- Explore [example manifestos](templates/manifestos/)
- Try different [agent providers](packages/awp-agent/AGENT_ADAPTER.md)
- Build a [custom agent adapter](packages/awp-agent/AGENT_ADAPTER.md#implementing-a-custom-adapter)

## Help

```bash
awp --help
awp <command> --help
```

## License

Apache-2.0
