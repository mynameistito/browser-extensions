/** Return a WXT definition unchanged so its entrypoint can run in Vitest.
 * @param definition - The WXT content-script definition.
 * @returns The supplied definition unchanged.
 */
export const defineContentScript = <Definition>(
  definition: Definition
): Definition => definition;
