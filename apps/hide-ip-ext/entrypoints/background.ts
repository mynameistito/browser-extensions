export default defineBackground(() => {
  let cachedIp: string | null = null;
  let fetchedAt = 0;

  browser.runtime.onMessage.addListener(async (message) => {
    if (message?.type !== 'IP_VEIL_GET_IP') return;

    // Refresh periodically so a changed network address is still protected.
    if (!cachedIp || Date.now() - fetchedAt > 15 * 60 * 1000) {
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) throw new Error('Unable to look up your public IP address.');

      const payload = (await response.json()) as { ip?: string };
      cachedIp = payload.ip ?? null;
      fetchedAt = Date.now();
    }

    return cachedIp;
  });
});
