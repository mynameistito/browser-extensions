import type { DomainRule } from "@/lib/schemas";

interface Parsed {
  host: string;
  href: string;
  pathname: string;
}

const WWW_PREFIX = /^www\./u;
const PROTOCOL_PREFIX = /^https?:\/\//u;
const PATH_TAIL = /\/.*$/u;

const parse = (url: string): Parsed | null => {
  try {
    const u = new URL(url);
    return {
      host: u.host.toLowerCase().replace(WWW_PREFIX, ""),
      href: `${u.origin}${u.pathname}${u.search}`,
      pathname: u.pathname,
    };
  } catch {
    return null;
  }
};

const normHost = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(PROTOCOL_PREFIX, "")
    .replace(WWW_PREFIX, "")
    .replace(PATH_TAIL, "");

export const ruleMatches = (rule: DomainRule, url: string): boolean => {
  const p = parse(url);
  if (!p) {
    return false;
  }

  switch (rule.kind) {
    case "exact": {
      return p.host === normHost(rule.pattern);
    }
    case "subdomain": {
      const root = normHost(rule.pattern);
      return p.host === root || p.host.endsWith(`.${root}`);
    }
    case "specific-sub": {
      return (
        p.host === rule.pattern.trim().toLowerCase().replace(WWW_PREFIX, "")
      );
    }
    case "path": {
      const target = rule.pattern.trim();
      try {
        const t = new URL(
          target.startsWith("http") ? target : `https://${target}`
        );
        const targetHost = t.host.toLowerCase().replace(WWW_PREFIX, "");
        const targetPath = t.pathname.replace(/\/$/u, "");
        const atBoundary =
          p.pathname === targetPath || p.pathname.startsWith(`${targetPath}/`);
        return p.host === targetHost && atBoundary;
      } catch {
        return false;
      }
    }
    case "page": {
      const target = rule.pattern.trim();
      try {
        const t = new URL(
          target.startsWith("http") ? target : `https://${target}`
        );
        const targetHost = t.host.toLowerCase().replace(WWW_PREFIX, "");
        return p.host === targetHost && p.pathname === t.pathname;
      } catch {
        return false;
      }
    }
    default: {
      return false;
    }
  }
};

export const anyRuleMatches = (rules: DomainRule[], url: string): boolean => {
  for (const r of rules) {
    if (ruleMatches(r, url)) {
      return true;
    }
  }
  return false;
};

export const shouldDelete = (
  url: string,
  blacklist: DomainRule[],
  whitelist: DomainRule[],
  whitelistPrecedence: boolean
): boolean => {
  const onWhite = anyRuleMatches(whitelist, url);
  const onBlack = anyRuleMatches(blacklist, url);
  if (whitelistPrecedence && onWhite) {
    return false;
  }
  return onBlack;
};
