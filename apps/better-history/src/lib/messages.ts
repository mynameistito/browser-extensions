import { z } from "zod";

const RuntimeResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), value: z.unknown() }),
  z.object({ error: z.string(), ok: z.literal(false) }),
]);

const RuntimeRequestSchema = z.object({
  payload: z.unknown(),
  type: z.string(),
});

type RuntimeResponse = z.infer<typeof RuntimeResponseSchema>;

type JsonMessage =
  | boolean
  | JsonMessage[]
  | null
  | number
  | string
  | { [key: string]: JsonMessage };

const CleanupRunNowRequestSchema = z.object({});

type RuntimeMessageListener = (
  message: JsonMessage,
  sender: Browser.runtime.MessageSender,
  sendResponse: (response: RuntimeResponse) => void
) => boolean;

interface RuntimeMessageEvent {
  addListener: (listener: RuntimeMessageListener) => void;
  removeListener: (listener: RuntimeMessageListener) => void;
}

/** Response returned after the cleanup message finishes. */
const CleanupRunNowResponseSchema = z.object({
  lastRunAt: z.number(),
});

/** Validated result returned by an immediate cleanup run. */
export type CleanupRunNowResponse = z.infer<typeof CleanupRunNowResponseSchema>;

export const extensionMessaging = {
  onMessage(
    type: "cleanup.runNow",
    handler: (
      payload: z.output<typeof CleanupRunNowRequestSchema>,
      sender: Browser.runtime.MessageSender
    ) => Promise<CleanupRunNowResponse> | CleanupRunNowResponse
  ): () => void {
    const messageEvent: RuntimeMessageEvent = browser.runtime.onMessage;

    const listener = (
      message: JsonMessage,
      sender: Browser.runtime.MessageSender,
      sendResponse: (response: RuntimeResponse) => void
    ): boolean => {
      const parsedMessage = RuntimeRequestSchema.safeParse(message);

      if (!parsedMessage.success || parsedMessage.data.type !== type) {
        return false;
      }

      const payload = CleanupRunNowRequestSchema.safeParse(
        parsedMessage.data.payload
      );

      if (!payload.success) {
        sendResponse({ error: "Invalid message payload.", ok: false });

        return false;
      }

      void (async () => {
        try {
          const value = await handler(payload.data, sender);

          sendResponse({ ok: true, value });
        } catch {
          sendResponse({ error: "Message handler failed.", ok: false });
        }
      })();

      return true;
    };

    messageEvent.addListener(listener);

    return () => {
      messageEvent.removeListener(listener);
    };
  },

  async sendMessage(
    type: "cleanup.runNow",
    payload: z.output<typeof CleanupRunNowRequestSchema>
  ): Promise<CleanupRunNowResponse> {
    const response: unknown = await browser.runtime.sendMessage({
      payload,
      type,
    });

    const parsedResponse = RuntimeResponseSchema.safeParse(response);

    if (!parsedResponse.success) {
      throw new Error("Invalid runtime message response.");
    }

    if (!parsedResponse.data.ok) {
      throw new Error(parsedResponse.data.error);
    }

    const value = CleanupRunNowResponseSchema.safeParse(
      parsedResponse.data.value
    );

    if (!value.success) {
      throw new Error("Runtime message response did not match its schema.");
    }

    return value.data;
  },
};
