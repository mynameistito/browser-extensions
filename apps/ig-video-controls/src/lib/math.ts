export const clamp = (value: number, min: number, max: number): number =>
  Math.max(Math.min(value, max), min);

export const snapToStep = (value: number, stepSize: number): number => {
  if (stepSize === 0 || !Number.isFinite(stepSize)) {
    return value;
  }
  return stepSize * Math.round(value / stepSize);
};

export const valuesAreDifferentEnough = (
  a: number,
  b: number,
  minimumDiff = 0.01
): boolean => Math.abs(a - b) >= minimumDiff;

/**
 * Checks whether two dimensions are close enough to be considered equal.
 *
 * Short-circuits on absolute tolerance first: if `|a - b| <= absolutePixels`,
 * returns true (including when either value is zero).
 *
 * Otherwise performs a symmetric ratio check: `max(a,b) / min(a,b) <= allowedRatioFactor`.
 *
 * @param a - First dimension (px).
 * @param b - Second dimension (px).
 * @param allowedRatioFactor - Multiplier tolerance (>= 1). E.g. `1.1` allows ±10%.
 *   The check verifies the larger value is at most `allowedRatioFactor` times the smaller.
 * @param absolutePixels - Absolute pixel tolerance. Short-circuits the ratio check
 *   when the difference is within this threshold.
 * @returns `true` when dimensions are within tolerance.
 */
export const dimensionWithinXPercentOrAbsoluteValue = (
  a: number,
  b: number,
  allowedRatioFactor: number,
  absolutePixels: number
): boolean => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }
  if (Math.abs(a - b) <= absolutePixels) {
    return true;
  }
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo > 0 && hi / lo <= allowedRatioFactor;
};
