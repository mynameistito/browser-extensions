import { fakeBrowser } from "wxt/testing/fake-browser";

Reflect.set(globalThis, "browser", fakeBrowser);

Reflect.set(globalThis, "chrome", fakeBrowser);
