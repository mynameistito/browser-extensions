import { describe, expect, it, vi } from "vitest";

import {
  cmpToPrecision,
  debounce,
  fromHtml,
  getAllChildrenOfParent,
  hide,
  query,
  queryAll,
  throttle,
} from "@/entrypoints/content/dom";
import { DEFAULTS } from "@/lib/defaults";
import {
  clamp,
  dimensionWithinXPercentOrAbsoluteValue,
  snapToStep,
  valuesAreDifferentEnough,
} from "@/lib/math";

import {
  setupTestEnvironment,
  requireElement,
  requireHtmlElement,
  setMarkup,
} from "./test-helpers";

describe("ig-video-controls", () => {
  setupTestEnvironment();

  describe("shared math and defaults", () => {
    it("clamps, snaps valid steps, and leaves invalid steps untouched", () => {
      expect(DEFAULTS).toStrictEqual({
        playbackRate: 1,
        playbackRateAdjustmentStepSize: 0.25,
        rememberPlaybackRate: true,
        rememberVolumeLevel: true,
        volumeAdjustmentStepSize: 0.1,
        volumeLevel: 1,
      });
      expect([
        clamp(-1, 0, 1),
        clamp(2, 0, 1),
        snapToStep(1.13, 0.25),
        snapToStep(1.13, 0),
        snapToStep(1.13, Number.NaN),
      ]).toStrictEqual([0, 1, 1.25, 1.13, 1.13]);
      expect([
        valuesAreDifferentEnough(1, 1.01),
        valuesAreDifferentEnough(1, 1.001),
        dimensionWithinXPercentOrAbsoluteValue(0, 100, 1.1, 100),
        dimensionWithinXPercentOrAbsoluteValue(100, 110, 1.1, 0),
        dimensionWithinXPercentOrAbsoluteValue(100, 121, 1.2, 0),
        dimensionWithinXPercentOrAbsoluteValue(Number.NaN, 1, 2, 1),
        dimensionWithinXPercentOrAbsoluteValue(-1, -2, 2, 0),
      ]).toStrictEqual([true, false, true, true, false, false, false]);
    });
  });

  describe("DOM helpers", () => {
    it("queries, parses fragments, hides elements, compares precision, and lists siblings", () => {
      setMarkup(
        document.body,
        "<main><i></i><b id='target'></b><u></u></main>"
      );
      const target = requireElement(document.querySelector("#target"));
      expect([
        query("#target"),
        query("missing"),
        queryAll("i, b").length,
        queryAll("i", null).length,
        fromHtml("<em>ok</em>")?.tagName,
        fromHtml("text only"),
        cmpToPrecision(1.239, 1.231, 2),
        getAllChildrenOfParent(target).length,
        getAllChildrenOfParent(document.createElement("i")),
      ]).toStrictEqual([target, null, 2, 1, "EM", null, 0, 3, []]);
      hide(target);
      hide(null);
      expect(requireHtmlElement(target).style.visibility).toBe("hidden");
    });

    it("debounces latest arguments and throttles leading/trailing calls", () => {
      vi.useFakeTimers();
      const call = vi.fn<(...args: unknown[]) => void>();
      const delayed = debounce(call, 20);
      delayed("first");
      delayed("last");
      vi.advanceTimersByTime(20);
      const throttled = throttle(call, 50);
      throttled("a");
      throttled("b");
      vi.advanceTimersByTime(50);
      const noLeading = throttle(call, 25, { leading: false, trailing: false });
      noLeading("ignored");
      vi.advanceTimersByTime(30);

      const leadingOnly = throttle(call, 10, {
        leading: true,
        trailing: false,
      });

      leadingOnly("immediate");
      leadingOnly("suppressed");
      const trailing = throttle(call, 20, { leading: false });
      trailing("deferred");
      vi.advanceTimersByTime(20);
      vi.setSystemTime(1);
      const replacedTrailing = throttle(call, 50, { leading: false });
      replacedTrailing("replaced");
      vi.setSystemTime(51);
      replacedTrailing("immediate");
      expect(call.mock.calls).toStrictEqual([
        ["last"],
        ["a"],
        ["b"],
        ["immediate"],
        ["deferred"],
        ["immediate"],
      ]);
    });
  });
});
