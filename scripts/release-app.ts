import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { assertRequiredChromeExtensionKey } from "./chrome-extension-key";

type AppScript = "check" | "typecheck" | "test" | "zip:all";

type AppScripts = Partial<Record<AppScript, string>>;

type JsonValue =
  | boolean
  | null
  | number
  | string
  | readonly JsonValue[]
  | JsonObject;

interface JsonObject {
  readonly [key: string]: JsonValue;
}

interface AppPackage {
  readonly name: string;
  readonly version: string;
  readonly scripts?: AppScripts;
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isAppScripts = (value: unknown): value is AppScripts => {
  if (!isObject(value)) {
    return false;
  }

  const scriptNames: readonly AppScript[] = [
    "check",
    "typecheck",
    "test",
    "zip:all",
  ];

  return scriptNames.every((script) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, script);

    return descriptor === undefined || isString(descriptor.value);
  });
};

const isAppPackage = (value: unknown): value is AppPackage => {
  if (!isObject(value)) {
    return false;
  }

  if (!isString(value.name) || !isString(value.version)) {
    return false;
  }

  return value.scripts === undefined || isAppScripts(value.scripts);
};

const parseAppPackage = (json: string): AppPackage => {
  const value: unknown = JSON.parse(json);

  if (!isAppPackage(value)) {
    throw new TypeError("Invalid app package manifest.");
  }

  return value;
};

const appDir = process.cwd();
const repositoryDir = path.resolve(import.meta.dirname, "..");

const pkg = parseAppPackage(
  readFileSync(path.join(appDir, "package.json"), "utf-8")
);

const tag = `${pkg.name}-v${pkg.version}`;
const releaseRepository = "mynameistito/browser-extensions";
const sourceArchiveName = `${pkg.name}-${pkg.version}-source.zip`;

const firefoxStoreListings = {
  "hide-email-ext": "hide-email-ext@mynameistito.com",
  "mute-tab-manager": "mute-tab-manager@mynameistito.com",
  "quote-viewer": "quote-viewer@mynameistito.com",
} satisfies Readonly<Record<string, string>>;

const isFirefoxStoreListing = (
  appName: string
): appName is keyof typeof firefoxStoreListings =>
  Object.hasOwn(firefoxStoreListings, appName);

const expectedAssets = [
  `${pkg.name}-${pkg.version}-chrome.zip`,
  `${pkg.name}-${pkg.version}-firefox.zip`,
  sourceArchiveName,
] as const;

const run = (command: string, args: string[]): string =>
  execFileSync(command, args, {
    cwd: appDir,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const runInherited = (command: string, args: string[]): void => {
  execFileSync(command, args, { cwd: appDir, stdio: "inherit" });
};

const hasFirefoxVersion = async (
  extensionId: string,
  version: string,
  jwtIssuer: string,
  jwtSecret: string
): Promise<boolean> => {
  const issuedAt = Math.floor(Date.now() / 1000);

  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");

  const payload = Buffer.from(
    JSON.stringify({
      exp: issuedAt + 60,
      iat: issuedAt,
      iss: jwtIssuer,
      jti: randomUUID(),
    })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;

  const signature = createHmac("sha256", jwtSecret)
    .update(signingInput)
    .digest("base64url");

  const authorization = `JWT ${signingInput}.${signature}`;

  const apiUrl = new URL(
    `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(extensionId)}/versions/`
  );

  apiUrl.searchParams.set("filter", "all_without_unlisted");
  apiUrl.searchParams.set("page_size", "100");

  const fetchVersionPage = async (pageUrl: URL): Promise<boolean> => {
    if (pageUrl.origin !== apiUrl.origin) {
      throw new Error(
        "AMO returned a versions page outside addons.mozilla.org."
      );
    }

    const response = await fetch(pageUrl, {
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
    });

    if (!response.ok) {
      throw new Error(
        `AMO version lookup failed with HTTP ${response.status}.`
      );
    }

    const result: unknown = await response.json();

    if (!isObject(result) || !Array.isArray(result.results)) {
      throw new TypeError("AMO returned an invalid versions response.");
    }

    for (const entry of result.results) {
      if (!isObject(entry) || !isString(entry.version)) {
        throw new TypeError("AMO returned an invalid version entry.");
      }

      if (entry.version === version) {
        return true;
      }
    }

    if (result.next === null) {
      return false;
    }

    if (!isString(result.next)) {
      throw new TypeError("AMO returned an invalid versions page link.");
    }

    return await fetchVersionPage(new URL(result.next, apiUrl));
  };

  return await fetchVersionPage(apiUrl);
};

const publishFirefox = async (): Promise<void> => {
  if (!isFirefoxStoreListing(pkg.name)) {
    return;
  }

  const extensionId = firefoxStoreListings[pkg.name];
  const jwtIssuer = process.env.FIREFOX_JWT_ISSUER;
  const jwtSecret = process.env.FIREFOX_JWT_SECRET;

  if (
    jwtIssuer === undefined ||
    jwtIssuer.length === 0 ||
    jwtSecret === undefined ||
    jwtSecret.length === 0
  ) {
    console.log(
      `Skipping Firefox Add-ons submission for ${pkg.name}: FIREFOX_JWT_ISSUER and FIREFOX_JWT_SECRET are not both configured.`
    );

    return;
  }

  const firefoxZip = `${pkg.name}-${pkg.version}-firefox.zip`;
  const firefoxSourcesZip = sourceArchiveName;
  const outputDirectory = path.join(appDir, ".output");
  mkdirSync(outputDirectory, { recursive: true });

  if (await hasFirefoxVersion(extensionId, pkg.version, jwtIssuer, jwtSecret)) {
    console.log(
      `Skipping Firefox Add-ons submission for ${pkg.name}: version ${pkg.version} already exists on AMO.`
    );

    return;
  }

  // When retrying a release whose GitHub assets already exist, restore those
  // assets so a transient AMO failure does not require rebuilding the release.
  const missingAssets = [firefoxZip, firefoxSourcesZip].filter(
    (asset) => !existsSync(path.join(outputDirectory, asset))
  );

  if (missingAssets.length > 0) {
    runInherited("gh", [
      "release",
      "download",
      tag,
      ...missingAssets.flatMap((asset) => ["--pattern", asset]),
      "--dir",
      outputDirectory,
      "--clobber",
      "--repo",
      releaseRepository,
    ]);
  }

  for (const asset of [firefoxZip, firefoxSourcesZip]) {
    const assetPath = path.join(outputDirectory, asset);

    if (!existsSync(assetPath)) {
      throw new Error(
        `Expected Firefox submission artifact is missing: ${assetPath}`
      );
    }
  }

  runInherited("bun", [
    "run",
    "publish:firefox",
    "--",
    "--firefox-zip",
    path.join(outputDirectory, firefoxZip),
    "--firefox-sources-zip",
    path.join(outputDirectory, firefoxSourcesZip),
    "--firefox-extension-id",
    extensionId,
    "--firefox-channel",
    "listed",
  ]);
};

let previousPackage: AppPackage | undefined;

try {
  const previousPackageJson = run("git", [
    "show",
    `HEAD^:apps/${pkg.name}/package.json`,
  ]);

  previousPackage = parseAppPackage(previousPackageJson);
} catch {
  console.log(
    `Releasing ${pkg.name}: it has no package manifest in the previous commit.`
  );
}

if (previousPackage?.version === pkg.version) {
  console.log(
    `Skipping ${pkg.name}: version ${pkg.version} did not change in this commit.`
  );
  process.exit(0);
}

assertRequiredChromeExtensionKey(
  process.env.WXT_CHROME_KEY,
  process.env.REQUIRE_CHROME_KEY !== undefined &&
    process.env.REQUIRE_CHROME_KEY.length > 0
);

const readReleaseAssetNames = (): readonly string[] => {
  const output = run("gh", [
    "release",
    "view",
    tag,
    "--repo",
    releaseRepository,
    "--json",
    "assets",
    "--jq",
    ".assets[].name",
  ]);

  return output ? output.split("\n") : [];
};

let existingAssets: readonly string[] = [];
let releaseExists = false;

try {
  existingAssets = readReleaseAssetNames();
  releaseExists = true;
} catch {
  // A missing release is created below; other gh errors will surface on create.
}

if (
  releaseExists &&
  expectedAssets.every((asset) => existingAssets.includes(asset))
) {
  console.log(`Release ${tag} already contains all release artifacts.`);
  await publishFirefox();
  process.exit(0);
}

const scriptsToRun = ["check", "typecheck", "test", "zip:all"] as const;

const scripts = scriptsToRun.filter((script) => {
  const scriptCommand = pkg.scripts?.[script];

  return scriptCommand !== undefined && scriptCommand.length > 0;
});

for (const script of scripts) {
  runInherited("bun", ["run", script]);
}

const sourceArchive = path.join(appDir, ".output", sourceArchiveName);

execFileSync(
  "git",
  [
    "archive",
    "--format=zip",
    `--output=${sourceArchive}`,
    "HEAD",
    `:(top)apps/${pkg.name}`,
    ":(top)package.json",
    ":(top)bun.lock",
    ":(top)scripts",
  ],
  { cwd: repositoryDir, stdio: "inherit" }
);

const releaseAssets = expectedAssets.map((asset) =>
  path.join(appDir, ".output", asset)
);

for (const assetPath of releaseAssets) {
  if (!existsSync(assetPath)) {
    throw new Error(`Expected release artifact was not produced: ${assetPath}`);
  }
}

const changelogPath = path.join(appDir, "CHANGELOG.md");

const changelog = existsSync(changelogPath)
  ? readFileSync(changelogPath, "utf-8")
  : `Release ${pkg.version}`;

const escapedVersion = pkg.version.replaceAll(".", "\\.");

const notesMatch = new RegExp(
  `## ${escapedVersion}\\n([\\s\\S]*?)(?=\\n## |$)`,
  "u"
).exec(changelog);

const releaseNotes = notesMatch?.[1]?.trim();

const notes =
  releaseNotes !== undefined && releaseNotes.length > 0
    ? releaseNotes
    : `Release ${pkg.version}`;

const notesPath = path.join(appDir, ".output", "release-notes.md");

writeFileSync(notesPath, notes, "utf-8");

const target = run("git", ["rev-parse", "HEAD"]);

if (releaseExists) {
  const missingAssets = expectedAssets.flatMap((asset) =>
    existingAssets.includes(asset) ? [] : [path.join(appDir, ".output", asset)]
  );

  runInherited("gh", [
    "release",
    "upload",
    tag,
    ...missingAssets,
    "--repo",
    releaseRepository,
  ]);
} else {
  runInherited("gh", [
    "release",
    "create",
    tag,
    ...releaseAssets,
    "--repo",
    releaseRepository,
    "--title",
    tag,
    "--notes-file",
    notesPath,
    "--target",
    target,
  ]);
}

await publishFirefox();
