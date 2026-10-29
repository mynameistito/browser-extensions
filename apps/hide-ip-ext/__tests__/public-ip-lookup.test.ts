import { describe, expect, it } from "vitest";

import { createPublicIpLookup } from "../entrypoints/utils/public-ip-lookup";

describe("public IP lookup", () => {
  it("shares an in-flight request across concurrent callers", async () => {
    let requestCount = 0;

    const fetcher = async (): Promise<Response> => {
      requestCount += 1;

      return await Promise.resolve(Response.json({ ip: "203.0.113.4" }));
    };

    const lookup = createPublicIpLookup(fetcher);

    const first = lookup();
    const second = lookup();
    const third = lookup();

    await expect(Promise.all([first, second, third])).resolves.toStrictEqual([
      "203.0.113.4",
      "203.0.113.4",
      "203.0.113.4",
    ]);
    expect(requestCount).toBe(1);
  });
});
