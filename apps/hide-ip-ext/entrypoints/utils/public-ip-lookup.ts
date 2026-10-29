const IP_ENDPOINT = "https://browser-ext.mynameistito.com/api/v1/ip";
const CACHE_TTL_MS = 15 * 60 * 1000;

interface IpResponsePayload {
  readonly ip: string;
}

type PublicIpFetcher = (input: string) => Promise<Response>;

const isIpResponsePayload = (value: unknown): value is IpResponsePayload =>
  typeof value === "object" &&
  value !== null &&
  "ip" in value &&
  typeof value.ip === "string";

/** Creates a cached public-IP lookup that shares concurrent network requests.
 *
 * @param fetcher - The network adapter used to request the public IP.
 * @param now - The clock used to timestamp successful responses.
 * @returns A lookup that caches valid responses for fifteen minutes.
 */
export const createPublicIpLookup = (
  fetcher: PublicIpFetcher,
  now: () => number = Date.now
): (() => Promise<string | null>) => {
  let cachedIp: string | null = null;
  let fetchedAt = 0;
  let pendingLookup: Promise<string | null> | null = null;

  return async () => {
    if (cachedIp !== null && now() - fetchedAt <= CACHE_TTL_MS) {
      return cachedIp;
    }

    if (pendingLookup !== null) {
      return await pendingLookup;
    }

    const lookup = Promise.resolve()
      .then(async () => {
        const response = await fetcher(IP_ENDPOINT);

        if (!response.ok) {
          throw new Error("Unable to look up your public IP address.");
        }

        const payload: unknown = await response.json();
        cachedIp = isIpResponsePayload(payload) ? payload.ip : null;
        fetchedAt = now();

        return cachedIp;
      })
      .finally(() => {
        pendingLookup = null;
      });

    pendingLookup = lookup;

    return await lookup;
  };
};
