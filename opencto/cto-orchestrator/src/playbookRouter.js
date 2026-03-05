import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CATALOG = [
  {
    id: "cto-playbook-skill",
    label: "CTO Playbook",
    terms: ["architecture", "infra", "devops", "deployment", "security", "api", "backend", "scaling"],
  },
  {
    id: "dj-playbook-skill",
    label: "DJ Playbook",
    terms: ["music", "dj", "set", "mix", "event", "sound", "stage", "festival", "track"],
  },
  {
    id: "sales-playbook-skill",
    label: "Sales Playbook",
    terms: ["sales", "pipeline", "lead", "prospect", "conversion", "revenue", "pricing", "deal"],
  },
  {
    id: "people-culture-playbook-skill",
    label: "People & Culture Playbook",
    terms: ["hiring", "team", "culture", "performance", "onboarding", "retention", "manager"],
  },
  {
    id: "product-innovation-playbook-skill",
    label: "Product Innovation Playbook",
    terms: ["product", "feature", "roadmap", "discovery", "user", "mvp", "experiment", "innovation"],
  },
  {
    id: "leadership-strategy-playbook-skill",
    label: "Leadership Strategy Playbook",
    terms: ["strategy", "vision", "board", "execution", "okr", "prioritization", "leadership"],
  },
];

function skillsRoot() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  return path.join(codexHome, "skills");
}

function safeSnippet(skillId) {
  try {
    const file = path.join(skillsRoot(), skillId, "SKILL.md");
    if (!fs.existsSync(file)) {
      return "";
    }
    const text = fs.readFileSync(file, "utf8");
    const lines = text
      .split("\n")
      .filter((line) => line.trim().length > 0 && !line.startsWith("```"))
      .slice(0, 36);
    return lines.join("\n").slice(0, 2400);
  } catch {
    return "";
  }
}

function score(text, terms) {
  const t = text.toLowerCase();
  return terms.reduce((sum, term) => (t.includes(term) ? sum + 1 : sum), 0);
}

export function routePlaybooks(userText) {
  const candidates = CATALOG.map((item) => ({ ...item, score: score(userText || "", item.terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const selected = ["cto-playbook-skill"];
  for (const item of candidates) {
    if (!selected.includes(item.id)) {
      selected.push(item.id);
    }
  }
  return selected;
}

export function buildPlaybookContext(playbookIds) {
  const parts = [];
  for (const id of playbookIds) {
    const meta = CATALOG.find((item) => item.id === id);
    const snippet = safeSnippet(id);
    if (!snippet) continue;
    parts.push(`# ${meta?.label || id}\n${snippet}`);
  }
  return parts.join("\n\n");
}
