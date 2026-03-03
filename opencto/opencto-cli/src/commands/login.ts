import {
  FileTokenStore,
  pollDeviceToken,
  startDeviceAuthorization,
} from '@heysalad/opencto'
import type { ParsedArgs } from '../args.js'
import { getFlag } from '../args.js'
import type { CliConfig } from '../config.js'

export async function handleLogin(parsed: ParsedArgs, config: CliConfig): Promise<void> {
  const clientId = getFlag(parsed, 'client-id') ?? 'opencto-cli'
  const scope = getFlag(parsed, 'scope') ?? 'openid profile offline_access'
  const deviceAuthorizationUrl = getFlag(parsed, 'device-auth-url') ?? `${config.authBaseUrl}/oauth/device/code`
  const tokenUrl = getFlag(parsed, 'token-url') ?? `${config.authBaseUrl}/oauth/token`

  const device = await startDeviceAuthorization({
    deviceAuthorizationUrl,
    clientId,
    scope,
  })

  console.log(`Open this URL: ${device.verification_uri_complete ?? device.verification_uri}`)
  console.log(`Enter code: ${device.user_code}`)

  const { tokenSet } = await pollDeviceToken({
    tokenUrl,
    clientId,
    deviceCode: device.device_code,
    intervalSeconds: device.interval,
    expiresInSeconds: device.expires_in,
  })

  const store = new FileTokenStore(config.tokenPath)
  await store.set(config.workspaceKey, tokenSet)

  console.log(`Login complete for workspace '${config.workspaceKey}'.`)
  console.log(`Token saved to ${config.tokenPath}`)
}
