import { describe, expect, it } from 'vitest';
import {
  initialLaunchpadSessionUiState,
  reduceLaunchpadSessionUiState
} from '@/launchpad/sessionFlow';

describe('launchpad session flow reducer', () => {
  it('supports start -> keyboard toggle -> stop flow', () => {
    const started = reduceLaunchpadSessionUiState(initialLaunchpadSessionUiState, { type: 'START' });
    const keyboardOpen = reduceLaunchpadSessionUiState(started, { type: 'TOGGLE_KEYBOARD' });
    const stopped = reduceLaunchpadSessionUiState(keyboardOpen, { type: 'STOP' });

    expect(started.mode).toBe('live');
    expect(keyboardOpen.keyboardOpen).toBe(true);
    expect(stopped.mode).toBe('idle');
    expect(stopped.keyboardOpen).toBe(false);
  });

  it('does not toggle keyboard in idle mode', () => {
    const next = reduceLaunchpadSessionUiState(initialLaunchpadSessionUiState, { type: 'TOGGLE_KEYBOARD' });
    expect(next.keyboardOpen).toBe(false);
  });
});
