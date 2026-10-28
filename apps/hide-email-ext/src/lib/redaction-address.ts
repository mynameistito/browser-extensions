import { REDACTION_TOKEN } from "./types";

const RANDOM_EMAIL_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_IPV6_CHARS = "0123456789abcdef";
const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = `(?<![\\w.:])${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}(?!\\w|\\.\\w|:(?!\\d))`;

const IPV6_CANDIDATE_PATTERN =
  "(?<![\\w:])(?:(?:[a-f\\d]{1,4}:){2,7}[a-f\\d]{1,4}|(?:[a-f\\d]{1,4}:){1,7}:|(?:[a-f\\d]{1,4}:){1,6}:(?:[a-f\\d]{1,4}(?::[a-f\\d]{1,4}){0,5})?|::(?:[a-f\\d]{1,4}(?::[a-f\\d]{1,4}){0,6})?)(?![\\w:]|\\.\\w)";

/** Kind of address matched for display and decoy generation. */
export type AddressKind = "email" | "ipv4" | "ipv6";

const createRandomEmailPart = (length: number): string => {
  const randomValues = globalThis.crypto.getRandomValues(
    new Uint8Array(length)
  );

  return Array.from(randomValues, (value) =>
    RANDOM_EMAIL_CHARS.charAt(value % RANDOM_EMAIL_CHARS.length)
  ).join("");
};

const createDecoyEmail = (): string =>
  `${createRandomEmailPart(8)}@${createRandomEmailPart(7)}.tld`;

const createRandomIpv4Octet = (): string =>
  String(globalThis.crypto.getRandomValues(new Uint8Array(1))[0] ?? 0);

const createDecoyIpv4 = (): string =>
  Array.from({ length: 4 }, createRandomIpv4Octet).join(".");

const createDecoyIpv6 = (): string => {
  const randomValues = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const groups: string[] = [];

  for (let index = 0; index < randomValues.length; index += 4) {
    const digits = randomValues.slice(index, index + 4);
    groups.push(
      Array.from(digits, (value) =>
        RANDOM_IPV6_CHARS.charAt(value % RANDOM_IPV6_CHARS.length)
      ).join("")
    );
  }

  return groups.join(":");
};

/**
 * Check whether an IPv6 value has valid groups and compression.
 * @param value - Candidate IPv6 address.
 * @returns Whether the candidate is valid.
 */
export const isValidIpv6 = (value: string): boolean => {
  const halves = value.split("::");

  if (halves.length > 2) {
    return false;
  }

  const left = halves[0] ?? "";
  const right = halves[1] ?? "";

  const groups = [
    ...left.split(":").filter(Boolean),
    ...right.split(":").filter(Boolean),
  ];

  if (!groups.every((group) => /^[a-f\d]{1,4}$/iu.test(group))) {
    return false;
  }

  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
};

/**
 * Check whether an address match is valid for its address syntax.
 * @param value - Candidate address match.
 * @returns Whether the match is valid.
 */
export const isValidMatch = (value: string): boolean =>
  !value.includes(":") || isValidIpv6(value);

/**
 * Identify the address kind represented by a validated match.
 * @param value - Validated address match.
 * @returns The address kind.
 */
export const classifyAddress = (value: string): AddressKind => {
  if (value.includes("@")) {
    return "email";
  }

  return value.includes(":") ? "ipv6" : "ipv4";
};

/**
 * Generate a random decoy with the same address kind as the match.
 * @param kind - Address kind to preserve.
 * @returns A random decoy value.
 */
export const createDecoy = (kind: AddressKind): string => {
  if (kind === "email") {
    return createDecoyEmail();
  }

  return kind === "ipv6" ? createDecoyIpv6() : createDecoyIpv4();
};

/**
 * Replace valid matches with the common redaction token.
 * @param value - Text to redact.
 * @param regex - Global matcher for configured addresses.
 * @returns Text with valid address matches redacted.
 */
export const replaceMatches = (value: string, regex: RegExp): string =>
  value.replaceAll(regex, (match) =>
    isValidMatch(match) ? REDACTION_TOKEN : match
  );

const escapeRegex = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Build the matcher used by the DOM redaction lifecycle.
 * @param emails - Configured email addresses.
 * @param hideIpAddresses - Whether IP address patterns are enabled.
 * @returns A global address matcher, or null when no pattern is enabled.
 */
export const buildRegex = (
  emails: string[],
  hideIpAddresses: boolean
): RegExp | null => {
  const emailPattern = emails.map(escapeRegex).join("|");

  const addressPatterns = hideIpAddresses
    ? [IPV6_CANDIDATE_PATTERN, IPV4_PATTERN]
    : [];

  const expressions = [...addressPatterns, emailPattern].filter(Boolean);

  return expressions.length === 0
    ? null
    : new RegExp(expressions.join("|"), "giu");
};

/**
 * Check whether text contains a syntactically valid IP candidate.
 * @param value - Text to inspect.
 * @param regex - Global matcher for configured addresses.
 * @returns Whether the text contains a valid IP address.
 */
export const hasValidIpMatch = (value: string, regex: RegExp): boolean => {
  regex.lastIndex = 0;

  for (const match of value.matchAll(regex)) {
    if (isValidMatch(match[0]) && classifyAddress(match[0]) !== "email") {
      return true;
    }
  }

  return false;
};
