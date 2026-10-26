import { beforeEach, describe, expect, it, vi } from "vitest";

interface ContentScriptOptions {
  main: () => void;
  matches: string[];
  runAt: string;
}

vi.stubGlobal(
  "defineContentScript",
  (options: ContentScriptOptions) => options
);

const { startContentScript } = await import("../entrypoints/github.content");

const writeTextMock = vi.fn<(text: string) => Promise<void>>();

const addConfirmation = (
  text: string,
  selector = "dialog"
): HTMLLabelElement => {
  const container = document.createElement(selector);
  const label = document.createElement("label");
  label.textContent = text;
  container.append(label);
  document.body.append(container);

  return label;
};

describe("GitHub repository confirmation copy control", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.history.replaceState({}, "", "/acme/widgets/settings/danger");
    vi.useRealTimers();
    writeTextMock.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    startContentScript();
  });

  it("does not enhance labels outside repository settings", () => {
    window.history.replaceState({}, "", "/acme/widgets/issues");
    const label = addConfirmation('To confirm, type "acme/widgets"');

    window.dispatchEvent(new Event("popstate"));

    expect(label.querySelector("button")).toBeNull();
  });

  it("ignores incomplete paths, unrelated labels, and labels without the repo", () => {
    const unrelated = addConfirmation("Enter the repository name");

    const missingRepository = addConfirmation(
      'To confirm, type "other/project"'
    );

    window.history.replaceState({}, "", "/only-one-part");
    window.dispatchEvent(new Event("turbo:load"));
    window.history.replaceState({}, "", "/acme/widgets/settings");
    window.dispatchEvent(new Event("turbo:load"));

    expect(unrelated.querySelector("button")).toBeNull();
    expect(missingRepository.querySelector("button")).toBeNull();
  });

  it("enhances matching confirmation text once, preserving quotes and nested text", () => {
    const label = addConfirmation("To confirm, type ");
    const code = document.createElement("code");
    code.textContent = "‘acme/widgets’";
    label.append(code);
    const other = addConfirmation('To confirm, type "someone/else"');

    window.dispatchEvent(new Event("turbo:load"));

    const button = label.querySelector<HTMLButtonElement>("button");
    expect(button?.textContent).toContain("acme/widgets");
    expect(button?.getAttribute("aria-label")).toBe("Copy acme/widgets");
    expect(button?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true"
    );
    expect(other.querySelector("button")).toBeNull();
    window.dispatchEvent(new Event("turbo:load"));
    expect(label.querySelectorAll("button")).toHaveLength(1);
  });

  it("recognizes non-dialog GitHub labels and unquoted repository names", () => {
    const label = addConfirmation("To confirm, type acme/widgets now", "div");
    label.className = "FormControl-label";

    window.dispatchEvent(new Event("turbo:load"));

    expect(label.querySelector("button code")?.textContent).toBe(
      "acme/widgets"
    );
  });

  it("reports successful copies and resets the icon after the delay", async () => {
    vi.useFakeTimers();
    const label = addConfirmation('To confirm, type "acme/widgets"');
    window.dispatchEvent(new Event("turbo:load"));
    const button = label.querySelector<HTMLButtonElement>("button");

    if (!button) {
      return;
    }

    button.click();
    await vi.waitFor(() => {
      expect(button.getAttribute("aria-label")).toBe("Copied acme/widgets");
    });
    expect(writeTextMock).toHaveBeenCalledWith("acme/widgets");
    expect(button.classList.contains("repocopy-copied")).toBeTruthy();
    button.click();
    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(2);
    });

    await vi.advanceTimersByTimeAsync(1400);
    expect(button.getAttribute("aria-label")).toBe("Copy acme/widgets");
    expect(button.querySelector("path")?.getAttribute("d")).toContain(
      "M5.5 5.5"
    );
  });

  it("reports clipboard failures and restores the accessible label", async () => {
    vi.useFakeTimers();
    writeTextMock.mockRejectedValueOnce(new Error("denied"));
    const label = addConfirmation('To confirm, type "acme/widgets"');
    window.dispatchEvent(new Event("turbo:load"));
    const button = label.querySelector<HTMLButtonElement>("button");

    if (!button) {
      return;
    }

    button.click();
    await vi.waitFor(() => {
      expect(button.getAttribute("aria-label")).toBe(
        "Could not copy acme/widgets"
      );
    });
    await vi.advanceTimersByTimeAsync(1400);

    expect(button.getAttribute("aria-label")).toBe("Copy acme/widgets");
    expect(button.classList.contains("repocopy-copied")).toBeFalsy();
  });
});
