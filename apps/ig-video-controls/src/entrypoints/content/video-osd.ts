type OsdType = "volume" | "speed";

const OSD_HIDE_DELAY_MS = 500;

const osdElements = new WeakMap<HTMLVideoElement, HTMLElement>();
const osdTimers = new WeakMap<
  HTMLVideoElement,
  ReturnType<typeof setTimeout>
>();

const formatValue = (type: OsdType, value: number): string => {
  if (type === "volume") {
    return `${Math.round(value * 100)}%`;
  }
  return `${value.toFixed(2)}x`;
};

const applyInlineStyles = (el: HTMLElement): void => {
  el.style.position = "fixed";
  el.style.zIndex = "2147483647";
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.alignItems = "center";
  el.style.gap = "4px";
  el.style.padding = "8px 14px";
  el.style.background = "rgba(0, 0, 0, 0.75)";
  el.style.borderRadius = "8px";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";
  el.style.opacity = "0";
  el.style.transition = "opacity 0.15s ease";
  el.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  el.style.boxSizing = "border-box";
  el.style.width = "auto";
  el.style.maxWidth = "none";
  el.style.minWidth = "0";
  el.style.height = "auto";
  el.style.margin = "0";
  el.style.border = "none";
  el.style.outline = "none";
  el.style.left = "0";
  el.style.top = "0";
};

const applyChildStyles = (el: HTMLElement): void => {
  const value = el.querySelector(".igvc-osd-value") as HTMLElement | null;
  if (value) {
    value.style.fontSize = "20px";
    value.style.fontWeight = "600";
    value.style.lineHeight = "1";
    value.style.color = "#fff";
    value.style.whiteSpace = "nowrap";
    value.style.margin = "0";
    value.style.padding = "0";
  }
};

const positionOsd = (el: HTMLElement, video: HTMLVideoElement): void => {
  const rect = video.getBoundingClientRect();
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top + rect.height / 2}px`;
  el.style.transform = "translate(-50%, -50%)";
};

const createOsdElement = (video: HTMLVideoElement): HTMLElement => {
  const el = document.createElement("div");
  el.classList.add("igvc-osd");

  el.innerHTML = `
    <span class="igvc-osd-value"></span>
  `;

  applyInlineStyles(el);
  applyChildStyles(el);

  document.body.append(el);
  positionOsd(el, video);

  return el;
};

const getOrCreateOsd = (video: HTMLVideoElement): HTMLElement => {
  let el = osdElements.get(video);
  if (!el || !el.isConnected) {
    el = createOsdElement(video);
    osdElements.set(video, el);
  }
  return el;
};

const showOsd = (
  video: HTMLVideoElement,
  type: OsdType,
  value: number
): void => {
  const el = getOrCreateOsd(video);

  positionOsd(el, video);

  const valueEl = el.querySelector(".igvc-osd-value") as HTMLElement | null;

  if (valueEl) {
    valueEl.textContent = formatValue(type, value);
  }

  el.style.opacity = "1";
  el.classList.add("igvc-osd-visible");

  const existingTimer = osdTimers.get(video);
  if (existingTimer !== undefined) {
    clearTimeout(existingTimer);
  }

  osdTimers.set(
    video,
    setTimeout(() => {
      el.style.opacity = "0";
      el.classList.remove("igvc-osd-visible");
      osdTimers.delete(video);
    }, OSD_HIDE_DELAY_MS)
  );
};

export const showVolumeOsd = (
  video: HTMLVideoElement,
  volume: number
): void => {
  showOsd(video, "volume", volume);
};

export const showSpeedOsd = (video: HTMLVideoElement, rate: number): void => {
  showOsd(video, "speed", rate);
};
