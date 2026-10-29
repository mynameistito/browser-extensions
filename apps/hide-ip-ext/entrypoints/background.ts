import { createPublicIpLookup } from "./utils/public-ip-lookup";

interface IpRequest {
  readonly type: "IP_VEIL_GET_IP";
}

interface RuntimeMessage {
  readonly type?: string;
}

const isIpRequest = (value: RuntimeMessage): value is IpRequest =>
  value.type === "IP_VEIL_GET_IP";

/** Registers the handler that returns the public IP address to the content script. */
export default defineBackground(() => {
  const getPublicIp = createPublicIpLookup(fetch);

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
