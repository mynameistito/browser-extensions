interface SetMutedMessage {
  readonly muted: boolean;
  readonly type: "SET_MUTED";
}

interface DarkModeResponseMessage {
  readonly isDark: boolean;
  readonly type: "DARK_MODE_RESPONSE";
}

interface GetDarkModeMessage {
  readonly type: "GET_DARK_MODE";
}

export type InboundServiceWorkerMessage = DarkModeResponseMessage;
export type InboundContentMessage = SetMutedMessage;
export type InboundOffscreenMessage = GetDarkModeMessage;
