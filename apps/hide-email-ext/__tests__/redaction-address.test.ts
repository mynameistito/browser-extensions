import { describe, expect, it } from "vitest";

import { isValidIpv6 } from "../src/lib/redact";

describe("IPv6 validation", () => {
  it("accepts valid forms and rejects malformed groups or compression", () => {
    expect({
      compressed: isValidIpv6("2001:db8::1"),
      full: isValidIpv6("2001:db8:0:0:0:0:0:1"),
      malformedGroup: isValidIpv6("2001:db8::gg"),
      multipleCompression: isValidIpv6("1::2::3"),
      tooFewGroupsWithoutCompression: isValidIpv6("2001:db8:1"),
      tooManyGroupsWithCompression: isValidIpv6("1:2:3::4:5:6:7:8"),
    }).toStrictEqual({
      compressed: true,
      full: true,
      malformedGroup: false,
      multipleCompression: false,
      tooFewGroupsWithoutCompression: false,
      tooManyGroupsWithCompression: false,
    });
  });
});
