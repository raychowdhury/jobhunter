# JobHunter
A private full-stack Sites adaptation of https://github.com/career-ops-hq/career-ops.
Source provenance and MIT attribution: [PROVENANCE.md](vendor/career-ops/PROVENANCE.md) and [LICENSE](vendor/career-ops/LICENSE).

Hosted workspace: https://ray-career-ops.rayking027.chatgpt.site (owner-only access).

## Features
- Live public Greenhouse scans across ten company boards with per-source diagnostics, 30-minute cache and explicit partial-result scope.
- Import individual Greenhouse or Lever posting URLs, or paste jobs from any source.
- PDF/text/Markdown resume text import, editable profile and cloud-persisted resume.
- Deterministic keyword coverage using the upstream matcher and display model. No invented fit grade or hiring probability.
- User-scoped D1 application board, stage changes, notes, follow-up dates and review checklist.
- Editable starter cover letters and role-specific resume drafts, download and browser print/PDF.
- User-authored STAR+Reflection interview stories; exports compatible with the repo's story-bank format.
- Exported A–H evaluation, tailoring and interview prompts for the user's chosen AI assistant.
- CSV and complete JSON data exports. This release exports backups; it does not restore them.

## Runtime
Preserves the Sites Vinext/Cloudflare starter and hosted ChatGPT authentication. All APIs require identity and all user-record queries include its stable ID. No email transport, application submission, browser automation or hosted LLM key is used.

The original repo depends on local CLI subprocesses and Playwright, which do not run in Workers. This adaptation reuses its portable modules and workflows instead of claiming to host that engine. AI reasoning is performed in the assistant chosen by the user after copying a prompt; exported prompts include user resume content.

This is a single-owner private workspace. Sites enforces owner-only access before dispatch, including scoped service authorization. A runtime grant marked owner-private plus an exact dispatch-service match selects a stable owner record scope. It does not depend on email aliases or omitted visitor IDs. Without that grant, APIs require native visitor identity or the exact configured owner email. Configuration is held in Sites secrets, never in the browser or repository. The health endpoint exposes readiness only, with no user records. BEFORE any sharing, audience, or ownership change, disable CAREER_OPS_PRIVATE_ACCESS_BOUNDARY and implement/migrate the intended per-visitor access model; the owner-only runtime grant is not valid for a shared or public Site.

## Local development

Use Node.js 22.13.0 or newer and pnpm (the package-manager version is recorded in package.json).

```sh
git clone https://github.com/raychowdhury/jobhunter.git
cd jobhunter
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wild_mongu.sql
pnpm dev
```

Open the localhost address printed by the dev server. The portable preview provides a local mock sign-in at `/signin-with-chatgpt?return_to=/`. Local records are separate from the hosted database. Do not replay an already-applied local migration.

The hosting manifest retains the existing Site identity. GitHub is a source mirror; pushing here does not automatically redeploy the hosted workspace. Publish changes through the Sites workflow. Runtime settings stay in Sites; `.env.example` documents names only.

## Verification

```sh
pnpm exec tsc --noEmit
node --test tests/*.test.mjs
pnpm build
```

Migrations are generated with Drizzle and applied by Sites at deployment. Tests execute the actual storage module against SQLite and verify persistence, deduplication and owner boundaries. Managed browser QA is unavailable when control-browser is not present; no alternate browser is installed.

