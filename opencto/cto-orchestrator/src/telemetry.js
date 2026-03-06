function telemetryEnabled(cfg) {
  return (
    cfg.traceEnabled &&
    cfg.sidecarEnabled &&
    Boolean(cfg.sidecarUrl) &&
    Boolean(cfg.sidecarToken)
  );
}

export function createTelemetry(cfg) {
  async function emit(event) {
    if (!telemetryEnabled(cfg)) return;

    const payload = {
      channel: event.channel || "orchestrator",
      scope: event.scope || "opencto-cto-orchestrator",
      text: String(event.text || "").slice(0, 3000),
      direction: event.direction || "assistant",
      model: event.model || cfg.agentModel,
      attributes: {
        service_name: cfg.traceServiceName,
        planner_model: cfg.plannerModel,
        executor_model: cfg.executorModel,
        reviewer_model: cfg.reviewerModel,
        ...(event.attributes || {}),
      },
    };

    try {
      const response = await fetch(cfg.sidecarUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-opencto-sidecar-token": cfg.sidecarToken,
        },
        signal: AbortSignal.timeout(cfg.httpTimeoutMs),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        console.error(`orchestrator sidecar trace failed: ${response.status} ${body}`);
      }
    } catch (error) {
      console.error(
        `orchestrator sidecar trace failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { emit, enabled: telemetryEnabled(cfg) };
}
