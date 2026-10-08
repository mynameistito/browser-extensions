import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { deriveChromeExtensionKey } from "./chrome-extension-key";
import { persistentChromeKeyApps } from "./extension-catalog";

export interface ChromeExtensionConfigOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly warn?: (message: string) => void;
  readonly fail?: (message: string) => never;
}

const defaultFail = (message: string): never => {
  throw new Error(message);
};

/** Load the persistent Chromium manifest key for a catalogued keyed app. */
export const loadChromeExtensionConfig = (
  appDirectory: string,
  options: ChromeExtensionConfigOptions = {}
):
  | { readonly manifestKey: string; readonly extensionId: string }
  | undefined => {
  const appName = path.basename(appDirectory);
  const app = persistentChromeKeyApps.find(({ name }) => name === appName);
  const fail = options.fail ?? defaultFail;
  if (!app) {
    return fail(`${appName} is not configured for a persistent Chrome key.`);
  }

  const env = options.env ?? process.env;
  const fromEnvironment = env.WXT_CHROME_KEY?.trim();
  let privateKeyPem = fromEnvironment;
  if (!privateKeyPem) {
    const keyPath = path.resolve(appDirectory, "key.pem");
    if (existsSync(keyPath)) {
      privateKeyPem = readFileSync(keyPath, "utf-8").trim();
    }
  }

  if (!privateKeyPem) {
    const message =
      "WXT_CHROME_KEY or key.pem is required when REQUIRE_CHROME_KEY=1.";
    if (env.REQUIRE_CHROME_KEY === "1") {
      return fail(message);
    }
    (options.warn ?? console.warn)(
      `[wxt] Chrome signing key not found; the extension ID will be unstable. Run \`bun run generate-keys -- --app ${app.name}\` from the workspace root.`
    );
    return undefined;
  }

  return deriveChromeExtensionKey(privateKeyPem);
};
