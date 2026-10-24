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

/** Message sent from the offscreen document to the service worker. */
export type InboundServiceWorkerMessage = DarkModeResponseMessage;

/** Message sent from the service worker to a content script. */
export type InboundContentMessage = SetMutedMessage;

/** Message sent from the service worker to the offscreen document. */
export type InboundOffscreenMessage = GetDarkModeMessage;
