import type { DomainRule } from "@/lib/schemas";

interface Parsed {
  host: string;
  href: string;
  pathname: string;
}

const WWW_PREFIX = /^www\./;
const PROTOCOL_PREFIX = /^https?:\/\//;
const PATH_TAIL = /\/.*$/;

function parse(url: string): Parsed | null {
  try {
    const u = new URL(url);
    return {
      host: u.host.toLowerCase().replace(WWW_PREFIX, ""),
      pathname: u.pathname,
      href: `${u.origin}${u.pathname}${u.search}`,
    };
  } catch {
    return null;
  }
}

function normHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(PROTOCOL_PREFIX, "")
    .replace(WWW_PREFIX, "")
    .replace(PATH_TAIL, "");
}

export function ruleMatches(rule: DomainRule, url: string): boolean {
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
        return p.host === targetHost && p.pathname.startsWith(t.pathname);
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
}

export function anyRuleMatches(rules: DomainRule[], url: string): boolean {
  for (const r of rules) {
    if (ruleMatches(r, url)) {
      return true;
    }
  }
  return false;
}

export function shouldDelete(
  url: string,
  blacklist: DomainRule[],
  whitelist: DomainRule[],
  whitelistPrecedence: boolean
): boolean {
  const onWhite = anyRuleMatches(whitelist, url);
  const onBlack = anyRuleMatches(blacklist, url);
  if (whitelistPrecedence && onWhite) {
    return false;
  }
  return onBlack;
}
