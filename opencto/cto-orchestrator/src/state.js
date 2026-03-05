import fs from "node:fs";
import path from "node:path";

export function loadState(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { incidents: {}, events: [] };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      incidents: parsed.incidents || {},
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { incidents: {}, events: [] };
  }
}

export function saveState(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

export function saveStatus(filePath, status) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(status, null, 2));
}
