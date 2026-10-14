# Career Ops source provenance
Upstream: https://github.com/career-ops-hq/career-ops
Pinned commit: b05b7002cc7efc55513f0e3c42d243b310aa5d42
License: MIT. Copyright © 2026 Santiago Fernández de Valderrama.

- keyword-match.mjs: exact pure exports SYNONYMS through analyzeCoverage extracted from upstream; Node file I/O and CLI removed for browser/Worker compatibility.
- keyword-coverage.mjs, clean-chips.mjs, posting-url.mjs: copied unchanged from web/src/lib.
- _html-to-text.mjs: copied unchanged from providers. _html-entities.mjs has one additional JSDoc map annotation for strict TypeScript checking; runtime behavior is unchanged.
- public/career-ops/evaluation.md, interview-plan.md, story-bank.template.md: copied upstream mode/template files unchanged.
- Company board names and identifiers in lib/career.mjs are a ten-company subset of templates/portals.example.yml.

This is a cloud adaptation. CLI process execution, browser automation, and the Playwright PDF engine are not executable in Workers. Hosted keyword coverage is deterministic. Full AI reasoning uses exported prompts in the user's assistant. Resume text, applications, and stories are saved in a private, user-scoped database.
