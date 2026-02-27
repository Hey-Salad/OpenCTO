import type { PasskeyCredential, TrustedDevice } from '../../types/auth'

interface SecuritySettingsProps {
  passkeys: PasskeyCredential[]
  devices: TrustedDevice[]
  onEnrollPasskey: () => void
  onRevokeDevice: (deviceId: string) => void
  passkeysLoading: boolean
  devicesLoading: boolean
  errorMessage: string | null
}

export function SecuritySettings({
  passkeys,
  devices,
  onEnrollPasskey,
  onRevokeDevice,
  passkeysLoading,
  devicesLoading,
  errorMessage,
}: SecuritySettingsProps) {
  return (
    <section className="panel security-settings" aria-label="Security settings">
      <header className="settings-header">
        <h2>Security</h2>
        <button type="button" className="secondary-button" onClick={onEnrollPasskey}>
          Add Passkey
        </button>
      </header>

      {errorMessage && <p className="billing-error">{errorMessage}</p>}

      <div className="settings-grid">
        <article>
          <h3>Passkeys</h3>
          {passkeysLoading ? (
            <p className="muted">Loading passkeys...</p>
          ) : passkeys.length === 0 ? (
            <p className="muted">No passkeys enrolled.</p>
          ) : (
            <ul className="plain-list">
              {passkeys.map((item) => (
                <li key={item.id} className="list-row">
                  <div>
                    <p>{item.displayName}</p>
                    <p className="muted">{item.deviceType}</p>
                  </div>
                  <p className="muted">{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString() : 'Never used'}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article>
          <h3>Trusted Devices</h3>
          {devicesLoading ? (
            <p className="muted">Loading devices...</p>
          ) : devices.length === 0 ? (
            <p className="muted">No trusted devices found.</p>
          ) : (
            <ul className="plain-list">
              {devices.map((device) => (
                <li key={device.id} className="list-row">
                  <div>
                    <p>{device.displayName}</p>
                    <p className="muted">
                      {device.platform} | {device.city}, {device.country}
                    </p>
                    <p className="muted">State: {device.trustState}</p>
                  </div>
                  <button
                    type="button"
                    className="ghost-danger-button"
                    onClick={() => onRevokeDevice(device.id)}
                    disabled={device.trustState === 'REVOKED'}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  )
}
