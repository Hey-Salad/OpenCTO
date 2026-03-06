export type LaunchpadSessionMode = 'idle' | 'live';

export interface LaunchpadSessionUiState {
  mode: LaunchpadSessionMode;
  keyboardOpen: boolean;
}

export type LaunchpadSessionAction =
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'TOGGLE_KEYBOARD' };

export const initialLaunchpadSessionUiState: LaunchpadSessionUiState = {
  mode: 'idle',
  keyboardOpen: false
};

export function reduceLaunchpadSessionUiState(
  state: LaunchpadSessionUiState,
  action: LaunchpadSessionAction
): LaunchpadSessionUiState {
  switch (action.type) {
    case 'START':
      return { ...state, mode: 'live' };
    case 'STOP':
      return { mode: 'idle', keyboardOpen: false };
    case 'TOGGLE_KEYBOARD':
      if (state.mode !== 'live') {
        return state;
      }
      return { ...state, keyboardOpen: !state.keyboardOpen };
    default:
      return state;
  }
}
