---
name: awp-experiment
description: Run AWP society experiments with manifesto-driven agent coordination
metadata: {"clawdbot":{"emoji":"🧪","requires":{"bins":["node","awp"]}}}
---

# AWP Experiment Skill

Run experiments testing how different manifestos affect agent societies. This skill enables manifesto-driven coordination experiments where agents operate under defined value systems and their behaviors are measured against fitness functions.

## Prerequisites

- Node.js 18+
- AWP CLI installed globally: `npm link -w packages/awp-cli` (from AWP repo) or `npm install -g @agent-workspace/cli`
- API key set: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

## Quick Start

```bash
# Navigate to AWP workspace
cd ~/Local\ Documents/Projects/awp

# Source environment
source .env && export OPENAI_API_KEY

# Create a society with 3 agents
awp experiment society create --manifesto MANIFESTO.md --agents 3

# Run 3 cycles
awp experiment run --society <society-id> --cycles 3 --manifesto MANIFESTO.md

# View results
awp experiment show <society-id>

# List all societies
awp experiment list
```

## Commands

### Create Society

```bash
awp experiment society create \
  --manifesto <path>     # Required: path to manifesto file
  --agents <n>           # Required: number of agents
  --seed <n>             # Optional: random seed for reproducibility
  --output <dir>         # Optional: output directory (default: societies)
```

### Run Experiment

```bash
awp experiment run \
  --society <id>         # Required: society ID
  --cycles <n>           # Required: number of cycles
  --manifesto <path>     # Required: path to manifesto
  --provider <provider>  # Optional: openai (default) or anthropic
  --model <model>        # Optional: model name
```

### Other Commands

```bash
awp experiment list              # List all societies
awp experiment show <id>         # Show society details
awp experiment cycle ...         # Run single cycle (same options as run)
```

## Usage via Chat

You can request experiments conversationally:

- "Create a 3-agent society using the purification manifesto"
- "Run 5 cycles on society manifesto-awp-purification-v1-xxx"
- "Show me the reputation evolution for my latest experiment"
- "List all AWP societies"
- "What's the success rate of the last experiment?"

## Provider Options

### OpenAI (default)

```bash
export OPENAI_API_KEY=sk-xxx
awp experiment run -s <id> -c 3 -m MANIFESTO.md
# Or explicitly:
awp experiment run -s <id> -c 3 -m MANIFESTO.md --provider openai --model gpt-4o-mini
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
awp experiment run -s <id> -c 3 -m MANIFESTO.md --provider anthropic
# Default model: claude-sonnet-4-20250514
```

## Manifesto Configuration

Manifestos are markdown files with YAML frontmatter that define agent society values and constraints:

```yaml
---
type: manifesto
id: my-manifesto-v1
values:
  purification: 1.0
  collaboration: 0.8
fitness:
  epistemic_hygiene: 0.4
  task_completion: 0.3
constraints:
  max_agents: 10
  min_reputation: 0.3
---

# My Manifesto

Description of the society's philosophy and goals...
```

## Example Manifestos

Located in `templates/manifestos/`:

- **baseline.md** — Minimal constraints, standard reputation dynamics
- **monastic.md** — High epistemic hygiene requirements
- **market-dynamics.md** — Competitive, faster feedback loops

## Interpreting Results

After running an experiment, check:

1. **Success Rate** — Percentage of tasks completed successfully
2. **Reputation Changes** — How agent scores evolved over cycles
3. **Token Usage** — Cost efficiency
4. **Anti-patterns** — Detected violations of manifesto constraints

Example output:
```
=== Summary ===
Experiment ID: exp-manifesto-xxx-123
Provider: openai
Model: gpt-4o-mini
Total cycles: 5
Total tasks: 15
Success rate: 80.0%
Total tokens: 45000
Duration: 120.5s
Est. cost: $0.0170
```

## Troubleshooting

### "awp: command not found"

```bash
# From AWP repo directory:
npm link -w packages/awp-cli

# Verify:
which awp
```

### API Key Issues

```bash
# Verify key is set
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY

# Source from .env file
cd ~/Local\ Documents/Projects/awp
source .env && export OPENAI_API_KEY
```

### Society Not Found

```bash
# List all societies to find correct ID
awp experiment list

# Societies are in the societies/ directory
ls societies/
```

### Build Issues

```bash
cd ~/Local\ Documents/Projects/awp
npm run build
```

## Further Reading

- [AWP Specification](https://github.com/marcoloco23/awp/blob/main/spec/awp-spec.md)
- [Experiment Protocol](https://github.com/marcoloco23/awp/blob/main/spec/experiment/experiment-spec.md)
- [AgentAdapter Interface](https://github.com/marcoloco23/awp/blob/main/packages/awp-agent/AGENT_ADAPTER.md)
- [MANIFESTO.md](https://github.com/marcoloco23/awp/blob/main/MANIFESTO.md)
