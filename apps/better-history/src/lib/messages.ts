interface MessageSpec {
  request: unknown;
  response: unknown;
}

type MessageKey<TProtocol> = Extract<keyof TProtocol, string>;
type RequestFor<
  TProtocol,
  TKey extends MessageKey<TProtocol>,
> = TProtocol[TKey] extends MessageSpec ? TProtocol[TKey]["request"] : never;
type ResponseFor<
  TProtocol,
  TKey extends MessageKey<TProtocol>,
> = TProtocol[TKey] extends MessageSpec ? TProtocol[TKey]["response"] : never;

interface RuntimeMessage<TKey extends string, TPayload> {
  payload: TPayload;
  type: TKey;
}

type RuntimeResponse<TValue> =
  | { ok: true; value: TValue }
  | { error: string; ok: false };

export interface CleanupRunNowResponse {
  lastRunAt: number;
}

interface ExtensionMessagingProtocol {
  "cleanup.runNow": {
    request: Record<string, never>;
    response: CleanupRunNowResponse;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isMessageOfType<TKey extends string>(
  message: unknown,
  type: TKey
): message is RuntimeMessage<TKey, unknown> {
  return isRecord(message) && message.type === type && "payload" in message;
}

export function defineExtensionMessaging<
  TProtocol extends { [TKey in keyof TProtocol]: MessageSpec },
>() {
  return {
    async sendMessage<TKey extends MessageKey<TProtocol>>(
      type: TKey,
      payload: RequestFor<TProtocol, TKey>
    ): Promise<ResponseFor<TProtocol, TKey>> {
      const response = await browser.runtime.sendMessage<
        RuntimeMessage<TKey, RequestFor<TProtocol, TKey>>,
        RuntimeResponse<ResponseFor<TProtocol, TKey>>
      >({ payload, type });
      if (!response.ok) {
        throw new Error(response.error);
      }
      return response.value;
    },

    onMessage<TKey extends MessageKey<TProtocol>>(
      type: TKey,
      handler: (
        payload: RequestFor<TProtocol, TKey>,
        sender: Browser.runtime.MessageSender
      ) => Promise<ResponseFor<TProtocol, TKey>> | ResponseFor<TProtocol, TKey>
    ): () => void {
      const listener = (
        message: unknown,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response: unknown) => void
      ) => {
        if (!isMessageOfType(message, type)) {
          return;
        }

        Promise.resolve()
          .then(() =>
            handler(message.payload as RequestFor<TProtocol, TKey>, sender)
          )
          .then((value) => sendResponse({ ok: true, value }))
          .catch((error: unknown) =>
            sendResponse({ error: messageError(error), ok: false })
          );

        return true;
      };
      browser.runtime.onMessage.addListener(listener);
      return () => browser.runtime.onMessage.removeListener(listener);
    },
  };
}

export const extensionMessaging =
  defineExtensionMessaging<ExtensionMessagingProtocol>();
