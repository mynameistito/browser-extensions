/** Preserve the background initializer callback when testing the entrypoint.
 * @param background - Background callback or configuration.
 * @returns The input callback or configuration unchanged.
 */
export const defineBackground = <T>(background: T): T => background;

/** Preserve content-script options when testing the entrypoint.
 * @param contentScript - Content-script options object.
 * @returns The input content-script options unchanged.
 */
export const defineContentScript = <T>(contentScript: T): T => contentScript;
