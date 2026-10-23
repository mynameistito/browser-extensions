/** Checks whether a string is a syntactically valid email address.
 * @param value - The value to validate.
 * @returns Whether the value is a valid email address.
 */
export const isEmail = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();

  const separator = normalized.indexOf("@");

  const domainSeparator = normalized.lastIndexOf(".");

  const hasLocalPart = separator > 0;
  const hasSingleAtSign = separator === normalized.lastIndexOf("@");

  const hasDomainAndSuffix =
    domainSeparator > separator + 1 && domainSeparator < normalized.length - 1;

  return (
    hasLocalPart &&
    hasSingleAtSign &&
    hasDomainAndSuffix &&
    !/\s/u.test(normalized)
  );
};

/** Normalizes and validates an email address.
 * @param email - The address to normalize.
 * @returns The normalized address, or `null` when it is invalid.
 */
export const normalize = (email: string): string | null => {
  const normalized = email.trim().toLowerCase();

  return isEmail(normalized) ? normalized : null;
};
