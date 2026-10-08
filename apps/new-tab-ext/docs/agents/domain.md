# Domain docs

This repository uses a single-context domain documentation layout.

## Before exploring

- Read `GLOSSARY.md` when it exists.
- Read relevant architecture decision records in `docs/adr/` when present.
- If those documents are absent, proceed without flagging the absence or creating them preemptively. Add them when domain terms or decisions are resolved and documented.

## Layout

```text
/
├── GLOSSARY.md
└── docs/
    ├── adr/
    └── agents/
```

Use established glossary terms in issues, plans, and code. Surface conflicts with recorded ADRs instead of silently overriding them.
