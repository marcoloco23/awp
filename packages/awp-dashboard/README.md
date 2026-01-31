# @agent-workspace/dashboard

Visual governance layer for AWP workspaces. A Next.js application that provides a read-only web UI for monitoring agent workspaces.

## Features

- **Overview** — Agent identity, health warnings, workspace metrics, active tasks
- **Projects** — Project list with progress bars, detail pages with task views
- **Reputation** — Agent roster with score gauges, profile pages with radar charts
- **Artifacts** — Knowledge browser with confidence bars, detail with provenance timelines
- **Contracts** — Delegation contracts with evaluation scores
- **Memory** — Daily log timeline with long-term memory
- **Experiments** — Society experiment viewer with cycle metrics and agent comparisons

## Usage

```bash
# Set the workspace path
export AWP_WORKSPACE=/path/to/your/workspace

# Run the dashboard
npm run dev --workspace=packages/awp-dashboard

# Opens at http://localhost:3000
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AWP_WORKSPACE` | Path to the AWP workspace to display | Current directory |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Overview dashboard with identity, projects, tasks |
| `/projects` | Project list |
| `/projects/[slug]` | Project detail with tasks |
| `/reputation` | Agent reputation list |
| `/reputation/[slug]` | Agent profile with radar chart |
| `/artifacts` | Knowledge artifact list |
| `/artifacts/[slug]` | Artifact detail with provenance |
| `/contracts` | Delegation contract list |
| `/memory` | Memory log viewer |
| `/experiments` | Society experiment list |
| `/experiments/[societyId]` | Society detail |
| `/experiments/[societyId]/[experimentId]` | Experiment results |

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev --workspace=packages/awp-dashboard

# Build for production
npm run build --workspace=packages/awp-dashboard

# Run tests
npm test --workspace=packages/awp-dashboard
```

## Tech Stack

- **Next.js 15** — App Router
- **React 19** — UI
- **Recharts** — Charts and visualizations
- **Framer Motion** — Animations
- **Vitest** — Testing

## Note

This package is private and not published to npm. It's designed to be run locally within the AWP monorepo.
