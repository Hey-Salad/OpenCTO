# Claude Code Integration

> ⚠️ This is the open-source version. For internal HeySalad documentation with credentials, see the private CTO-AI repository.

## 🔗 MCP Integration

This repository includes MCP (Model Context Protocol) server integrations for autonomous AI agents.

### CheriML MCP Server
**Purpose**: Code generation using Cheri-ML-1.3B model

**Tools**:
- \`generate_code()\` - Generate code completions
- \`complete_function()\` - Complete function implementations
- \`explain_code()\` - Explain code snippets
- \`refactor_code()\` - Refactor code
- \`check_model_health()\` - Check model server status

### HeySalad MCP Server
**Purpose**: Access to multi-domain AI tools

**Domains**:
1. Engineering - GitHub, postmortems, runbooks
2. Sales - Outbound emails, prospect briefs
3. Customer Success - Support tickets, QBRs
4. Marketing - Blog posts, campaigns
5. People/HR - Job descriptions, agent registry
6. Finance - Dashboards, unit economics
7. Data - Analytics, anomaly detection
8. Executive - Investor updates, reports

---

## 🎯 CTO Project Structure

This repository consolidates three AI systems:

\`\`\`
CTO/
├── cheri-ml/         # ML Inference Server
├── sheri-ml/         # Codex CLI (Gemini-powered)
├── opencto/          # Multi-Agent System
└── docs/             # Documentation
\`\`\`

---

## 🤖 AI Agent Roles

### Cheri-ML Agent
- **Role**: Code generation specialist
- **Model**: 1.3B parameters (fine-tuned DeepSeek Coder)
- **Best for**: Python, TypeScript, quick completions

### Sheri-ML Agent
- **Role**: Advanced coding assistant
- **Model**: Google Gemini 2.5 Pro
- **Best for**: Complex reasoning, refactoring, architecture

### OpenCTO Agents
- **Role**: Multi-agent swarm for DevOps
- **Communication**: MQTT pub/sub
- **Agents**: Deployment, Testing, Security, Code Review

---

## 🔧 Setup Instructions

See individual component READMEs:
- [cheri-ml/README.md](cheri-ml/README.md)
- [sheri-ml/README.md](sheri-ml/README.md)
- [opencto/README.md](opencto/README.md)

---

**License**: See LICENSE file
**Last Updated**: February 27, 2026
