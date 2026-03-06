export async function initTracing(cfg) {
  if (!cfg.traceEnabled) {
    return false
  }

  const hasCreds = Boolean(cfg.traceloopApiKey) || Boolean(cfg.otelExporterOtlpEndpoint)
  if (!hasCreds) {
    console.log('Tracing disabled: TRACELOOP_API_KEY or OTEL_EXPORTER_OTLP_ENDPOINT missing')
    return false
  }

  try {
    const traceloop = await import('@traceloop/node-server-sdk')
    traceloop.initialize({
      appName: cfg.traceServiceName,
      disableBatch: true,
      apiKey: cfg.traceloopApiKey || undefined,
    })

    console.log(`Tracing enabled for ${cfg.traceServiceName}`)
    return true
  } catch (error) {
    console.error('Tracing init failed:', error instanceof Error ? error.message : String(error))
    return false
  }
}
