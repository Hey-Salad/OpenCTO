# OpenAI Infrastructure Documentation

## Executive Summary
**OpenClaw: An Open Source Agentic Engineering Platform**

We're building **OpenCTO** - a CTO-as-a-Service SDK that extends **OpenClaw**, an open-source agentic engineering platform. Our infrastructure demonstrates sophisticated AI integration across distributed systems, with real-world applications in mobile AI, business strategy, and development workflows.

## Overview
This document details our OpenAI infrastructure usage across the HeySalad ecosystem. We use OpenAI services for multiple applications including AI assistants, recipe generation, and development workflows.

## Current OpenAI Usage

### 1. **OpenClaw Configuration (Primary AI Assistant Platform)**
**Location**: `/home/admin/.openclaw/openclaw.json`
**Model Provider**: `openai` (DeepSeek API endpoint)
**Current Model**: `deepseek-chat`
**API Endpoint**: `https://api.deepseek.com/v1`
**API Key**: Environment variable `OPENAI_API_KEY`

**Configuration Details**:
```json
"openai": {
  "baseUrl": "https://api.deepseek.com/v1",
  "apiKey": "env:OPENAI_API_KEY",
  "api": "openai-completions",
  "models": [
    {
      "id": "deepseek-chat",
      "name": "DeepSeek Chat",
      "reasoning": false,
      "input": ["text"],
      "contextWindow": 64000,
      "maxTokens": 8192
    },
    {
      "id": "deepseek-reasoner",
      "name": "DeepSeek R1",
      "reasoning": true,
      "input": ["text"],
      "contextWindow": 64000,
      "maxTokens": 8192
    }
  ]
}
```

### 2. **HeySalad Mobile App (Recipe Generation)**
**Location**: `/home/admin/.openclaw/workspace/temp-mobile-app/services/ai_gpt.ts`
**Model**: GPT-4o
**Usage**: Recipe generation from images, ingredient analysis, meal planning
**API Endpoint**: `process.env.EXPO_PUBLIC_GPT4_API_URL`
**API Key**: `process.env.EXPO_PUBLIC_OPEN_AI_API_KEY`

**Key Functions**:
- `getRecipesFromImage()`: Generates recipes from food images
- `getIngredients()`: Analyzes images to identify ingredients
- `getRecommendedRecipes()`: Personalizes recipe recommendations
- `chatWithAI()`: Nutrition/fitness coaching chatbot
- `getMealPlans()`: Creates personalized meal plans

**Example API Call**:
```typescript
const response = await axios.post(
  process.env.EXPO_PUBLIC_GPT4_API_URL as string,
  gptRequest,
  {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPEN_AI_API_KEY}`,
    },
  }
);
```

### 3. **Environment Variables**
**Current API Keys**:
```bash
OPENAI_API_KEY=sk-fbf2d88f4c064a4781c88fedb7d846f8  # DeepSeek API key
# Additional keys stored in environment or .env files for mobile app
```

### 4. **Secret Storage**
**Location**: `~/.heysalad-secrets/`
**Files**:
- `all-keys.env`: Comprehensive environment variables
- `julia.env`: Julia-specific configurations
- `sally.env`: Sally mobile app configurations
- `social.env`: Social media API keys

### 5. **Alternative AI Providers Configured**
**Amazon Bedrock**:
- Claude Opus 4.5, Sonnet 4.5, Haiku 4.5
- Multiple regions (US, EU, AP)
- AWS SDK authentication

**HuggingFace**:
- Qwen 2.5 72B, Llama 3.3 70B, Mistral 7B
- Router-based access with `HUGGINGFACE_HUB_TOKEN`

## Infrastructure Architecture

### **Current Setup**:
```
Raspberry Pi (raspbx)
├── OpenClaw Gateway
├── Julia (DeepSeek Chat instance)
├── Telegram integration
└── Workspace management

Mac Mini (heysalad-ai-01)
├── OpenCTO platform
├── Business Strategy Module
├── MQTT Broker
└── Heavy computation tasks
```

### **AI Service Flow**:
1. **User Request** → Telegram/OpenClaw interface
2. **Julia Processing** → DeepSeek Chat API
3. **Complex Tasks** → MQTT → Mac Mini Business Module
4. **Mobile App** → Direct GPT-4o API calls for recipes

## Usage Statistics & Patterns

### **Primary Use Cases**:
1. **AI Assistant (Julia)**: Daily operations, coding, planning, coordination
2. **Recipe Generation**: Mobile app AI features (Sally)
3. **Business Strategy**: OpenCTO CEO extension development
4. **Development Workflow**: Code generation, debugging, documentation

### **API Consumption Patterns**:
- **OpenClaw/Julia**: Continuous usage for assistant functions
- **Mobile App**: On-demand for user recipe requests
- **Development**: Periodic for code generation and problem-solving

## Planned OpenAI Codex Integration

### **Target Benefits from Codex for OSS**:
1. **6 months ChatGPT Pro with Codex**: Enhanced development capabilities
2. **Codex Security**: Security scanning for repositories
3. **API Credits**: Additional resources for automation
4. **Official Support**: OpenAI engineering support

### **Integration Plan**:
1. **Replace current DeepSeek** with ChatGPT Pro + Codex
2. **Enhance mobile app** with Codex-powered features
3. **Implement Codex Security** for all HeySalad repositories
4. **Build advanced AI workflows** with increased API limits

## Security & Best Practices

### **Current Security Measures**:
1. **API Keys**: Stored in environment variables, not in code
2. **Secret Management**: Centralized in `~/.heysalad-secrets/`
3. **Access Control**: Limited to necessary services
4. **Monitoring**: OpenClaw logs all configuration changes

### **Recommended Improvements**:
1. **Key Rotation**: Regular API key rotation schedule
2. **Usage Monitoring**: Track API consumption per service
3. **Rate Limiting**: Implement application-level rate limits
4. **Backup Keys**: Maintain backup API keys for critical services

## Cost Management

### **Current Cost Structure**:
1. **DeepSeek API**: Pay-per-use via `OPENAI_API_KEY`
2. **GPT-4o for Mobile**: Pay-per-use via mobile app environment
3. **Bedrock**: AWS-based pricing (currently not primary)

### **Cost Optimization Opportunities**:
1. **Codex for OSS**: Free 6-month access would eliminate current costs
2. **Model Selection**: Use appropriate models for different tasks
3. **Caching**: Implement response caching for common queries
4. **Batch Processing**: Group similar requests

## Future Roadmap

### **Short-term (With Codex Access)**:
1. **Migrate Julia to ChatGPT Pro + Codex**
2. **Implement Codex Security scanning**
3. **Enhance mobile app with Codex features**
4. **Build advanced CEO capabilities for OpenCTO**

### **Long-term Vision**:
1. **Unified AI Platform**: Single AI infrastructure across all products
2. **Advanced Automation**: AI-driven development and operations
3. **Marketplace Integration**: AI agents marketplace powered by OpenAI
4. **Research Collaboration**: Potential OpenAI partnership opportunities

## Application Alignment with OpenAI Codex for OSS

### **Why We're a Perfect Fit**:
1. **OpenClaw Usage**: We use OpenClaw (explicitly mentioned in their program)
2. **OSS Maintainers**: We maintain multiple open-source projects
3. **Tool Integration**: Demonstrate real-world OpenClaw + OpenAI integration
4. **Ecosystem Impact**: Our tools help other OSS maintainers

### **Proposed Usage of Codex Benefits**:
1. **ChatGPT Pro**: Daily development, code review, issue triage
2. **Codex Security**: Security scanning for HeySalad repositories
3. **API Credits**: Enhance our AI-powered products
4. **Engineering Support**: Accelerate OpenCTO platform development

---

*Document generated: March 6, 2026 - 20:40 GMT*
*For OpenAI Codex for OSS application submission*