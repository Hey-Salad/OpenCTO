export async function fetchMetrics(url, timeoutMs) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Monitor request failed (${response.status})`);
  }
  return await response.json();
}

export function deriveSignals(metrics) {
  const cpu = Number(metrics?.cpu?.load_pct_1m || 0);
  const mem = Number(metrics?.memory?.used_pct || 0);
  const disk = Number(metrics?.disk?.used_pct || 0);

  const incidents = [];

  if (cpu >= 85) {
    incidents.push({
      key: "cpu_high",
      severity: cpu >= 95 ? "critical" : "high",
      title: `High CPU usage (${cpu.toFixed(1)}%)`,
      detail: `1m load is ${metrics?.cpu?.load_1m ?? "n/a"} across ${metrics?.cpu?.cores ?? "n/a"} cores.`,
      metrics: { cpu, mem, disk },
    });
  }
  if (mem >= 90) {
    incidents.push({
      key: "memory_high",
      severity: mem >= 96 ? "critical" : "high",
      title: `High memory usage (${mem.toFixed(1)}%)`,
      detail: "Available memory is critically low for sustained agent execution.",
      metrics: { cpu, mem, disk },
    });
  }
  if (disk >= 90) {
    incidents.push({
      key: "disk_high",
      severity: disk >= 97 ? "critical" : "high",
      title: `High disk usage (${disk.toFixed(1)}%)`,
      detail: "Root disk is nearing capacity and could block builds/logging.",
      metrics: { cpu, mem, disk },
    });
  }

  return incidents;
}
