import {
  BADGE_COLOR_MUTED,
  BADGE_COLOR_UNMUTED,
  BADGE_MUTED,
  BADGE_UNMUTED,
  ICON_BASE,
  ICON_SIZES,
} from "@/utils/constants.ts";
import { getIsDarkMode } from "@/utils/storage.ts";

const makeIconPaths = (
  variant: string,
  theme: string
): Record<string, string> =>
  Object.fromEntries(
    ICON_SIZES.map((size) => [
      size,
      `${ICON_BASE}-${size}-${variant}-${theme}.png`,
    ])
  );

const makeFallbackIconPaths = (): Record<string, string> =>
  Object.fromEntries(
    ICON_SIZES.map((size) => [size, `${ICON_BASE}-${size}.png`])
  );

export const updateBadgeAndIcon = async (
  tabId: number,
  muted: boolean
): Promise<void> => {
  const isDark = await getIsDarkMode();
  const variant = muted ? "muted" : "unmuted";
  const theme = isDark ? "dark" : "light";

  await chrome.action.setBadgeText({
    tabId,
    text: muted ? BADGE_MUTED : BADGE_UNMUTED,
  });
  await chrome.action.setBadgeBackgroundColor({
    color: muted ? BADGE_COLOR_MUTED : BADGE_COLOR_UNMUTED,
    tabId,
  });

  // Use muted/unmuted icons if they exist; fall back to base icons
  try {
    await chrome.action.setIcon({ path: makeIconPaths(variant, theme), tabId });
  } catch {
    await chrome.action.setIcon({ path: makeFallbackIconPaths(), tabId });
  }
};
