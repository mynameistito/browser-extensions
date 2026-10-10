// Paste this into DevTools console on an IG reels/stories page while a video is playing
(() => {
  const slider = document.querySelector(
    '[data-instancekey] [aria-label="Adjust volume"]'
  );
  if (!slider) {
    return console.log("No slider found");
  }

  const parent = slider.parentElement;
  console.log("=== Slider parent (wrapper) ===");
  console.log(
    "tag:",
    parent.tagName,
    "| role:",
    parent.getAttribute("role"),
    "| classes:",
    parent.className
  );
  console.log("computed visibility:", getComputedStyle(parent).visibility);
  console.log(
    "computed pointerEvents:",
    getComputedStyle(parent).pointerEvents
  );
  console.log("computed display:", getComputedStyle(parent).display);

  console.log("\n=== Slider ===");
  console.log("computed visibility:", getComputedStyle(slider).visibility);
  console.log(
    "computed pointerEvents:",
    getComputedStyle(slider).pointerEvents
  );

  console.log("\n=== Slider siblings ===");
  for (const sib of parent.children) {
    const svg = sib.querySelector("svg");
    const label = svg?.getAttribute("aria-label") ?? "(no svg)";
    console.log(
      "tag:",
      sib.tagName,
      "| role:",
      sib.getAttribute("role"),
      "| aria-label:",
      sib.getAttribute("aria-label"),
      "| svg-label:",
      label,
      "| visibility:",
      getComputedStyle(sib).visibility,
      "| pointerEvents:",
      getComputedStyle(sib).pointerEvents,
      "| classes:",
      sib.className.slice(0, 60)
    );
  }

  console.log("\n=== Full parent outerHTML (first 3000 chars) ===");
  console.log(parent.outerHTML.slice(0, 3000));

  console.log("\n=== presentation div ===");
  const pres = parent.closest('[role="presentation"]');
  if (pres) {
    console.log("computed visibility:", getComputedStyle(pres).visibility);
    console.log("children count:", pres.children.length);
    for (const child of pres.children) {
      console.log(
        "child tag:",
        child.tagName,
        "| role:",
        child.getAttribute("role"),
        "| classes:",
        child.className.slice(0, 60)
      );
    }
  }
})();
