interface IpRequest {
  readonly type: "IP_VEIL_GET_IP";
}

interface RuntimeMessage {
  readonly type?: string;
}

interface IpResponsePayload {
  readonly ip: string;
}

const isIpRequest = (value: RuntimeMessage): value is IpRequest =>
  value.type === "IP_VEIL_GET_IP";

const isIpResponsePayload = (value: unknown): value is IpResponsePayload =>
  typeof value === "object" &&
  value !== null &&
  "ip" in value &&
  typeof value.ip === "string";

/** Registers the handler that returns the public IP address to the content script. */
export default defineBackground(() => {
  let cachedIp: string | null = null;
  let fetchedAt = 0;

  const getPublicIp = async (): Promise<string | null> => {
    if (cachedIp !== null && Date.now() - fetchedAt <= 15 * 60 * 1000) {
      return cachedIp;
    }

    const response = await fetch(
      "https://browser-ext.mynameistito.com/api/v1/ip"
    );

    if (!response.ok) {
      throw new Error("Unable to look up your public IP address.");
    }

    const payload: unknown = await response.json();
    cachedIp = isIpResponsePayload(payload) ? payload.ip : null;
    fetchedAt = Date.now();

    return cachedIp;
  };

  function handleMessage(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: string | null) => void
  ): void;
  function handleMessage(
    message: RuntimeMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: string | null) => void
  ): boolean {
    if (!isIpRequest(message)) {
      return false;
    }

    void getPublicIp()
      .then(sendResponse)
      .catch(() => {
        console.error("Unable to look up your public IP address.");
        sendResponse(null);
      });

    return true;
  }

  chrome.runtime.onMessage.addListener(handleMessage);
});
