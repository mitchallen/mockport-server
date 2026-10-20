# mockport-server — notes for Claude

A mock HTTP server for testing clients: it serves canned responses from a JSON
mockfile (`data/` by default, overridable with `MOCKFILE` or a mounted volume).
Plain JavaScript + Express 5, `node:test` + `c8`, a single-stage Docker image on
`node:24-alpine` with a `/healthz` `HEALTHCHECK`, published to GHCR + Docker Hub
via a tag-triggered workflow. `package.json` is `"private": true` — it ships
only as an image.

## Remaining work

Check `gh issue list` too. Found on 2026-10-20, not yet done:

- `express` 5.2.1 → 5.3.0 is pending (random-server and thing-server took it on
  2026-10-20). This repo's Dependabot is monthly, so it hasn't proposed it yet.
- The `overrides` for `diff` and `serialize-javascript` are dead: both came in
  via mocha, which #35 removed, and `npm explain` now finds neither. Remove them.
- The README still says Node 20 (the badge and "Requires Node.js 20 or later")
  though `engines` is `>=22` and CI tests 22 + 24.

## Conventions

- **Tests:** `make test` (or `npm test`) runs `node --test` over `test/unit/`;
  requests go through `test/helpers/request.js` (`node:http` + `fetch`, no
  supertest). `make coverage` is the CI gate: `c8` enforces **100%** on
  `src/`. `make ci` runs everything CI does, locally.
- **CI (`ci.yml`):** `test` on Node 22.x and 24.x, `audit`
  (`npm audit --audit-level=moderate`), and `docker`, which runs `make smoke`
  twice — once with the built-in mockfile (`MOUNT=`) and once with
  `test/data` mounted, proving a mounted mockfile actually overrides the
  built-in one. Keep the smoke logic in the Makefile so CI and `make ci` can't
  drift.
- **Branch protection (set up 2026-10-20):** `main` requires `test (22.x)`,
  `test (24.x)` and `docker` — the names must match exactly, matrix suffix
  included. `audit` runs on every PR but is deliberately **not required**: a
  new advisory in an unrelated package would otherwise block every PR,
  Dependabot's fix included, until it's resolved. `enforce_admins` is off.
- **Low-risk Dependabot PRs auto-merge** via
  `.github/workflows/dependabot-auto-merge.yml` (added 2026-10-20, #36): all
  github-actions updates, plus npm/docker **minor and patch**, merged with
  `--squash` once the required checks pass. Majors stay manual. It relies on
  the required checks above — without them native auto-merge lands PRs with no
  CI gating. Not yet exercised: on the first monthly Dependabot PR, check that
  the `auto-merge` job ran and the PR waited for CI. Merges made by the
  workflow's `GITHUB_TOKEN` don't start a `push` CI run on `main`.
- **Dependabot:** monthly for npm, docker and github-actions, with a 7-day
  cooldown; npm minor/patch are grouped. Node base-image majors are ignored
  entirely (Dependabot can't express "even majors only"), so moving to the
  next LTS line is a manual bump — Node 26 enters LTS on **2026-10-28**. Bump
  the `Dockerfile` together with every `node-version` that tracks it: the
  `ci.yml` test matrix (`[22.x, 24.x]`), the coverage-upload conditions keyed
  on `24.x`, the `audit` job, and `publish.yml`'s test job. Renaming a matrix
  entry renames its check, so update the required checks in branch
  protection in the same change or every PR will wait forever.
- **Release** goes through a PR, not a direct push:
  1. `make release` (`BUMP=patch|minor|major`, or `VERSION=x.y.z`) — opens a
     `release-x.y.z` PR titled `Release vx.y.z` with the `package.json` bump.
  2. Once it merges: `git checkout main && git pull`, then
     `make tag VERSION=x.y.z` (refuses unless `package.json` matches).
  3. `git push origin vx.y.z` — `publish.yml` re-runs the tests at the tag,
     pushes multi-arch images to GHCR and Docker Hub, syncs the README, and
     creates the GitHub Release.
  Merge PRs with `--squash`; the history reads `title (#N)`.
- **Deciding whether a release is due:** compare `main` against the latest tag
  and ignore `.github/` and `*.md`. A lockfile change only counts if it moves
  the *production* tree — compare the non-dev entries
  (`jq '.packages|to_entries[]|select(.value.dev!=true)'` on
  `package-lock.json` at the tag vs now). On 2026-10-20 the test-suite rewrite
  (#35) changed the lockfile heavily but left the production tree identical,
  so no release was needed.
- Default branch is `main`. Work on a branch and open a PR.

## Sibling projects (`../`)

random-server is the reference for the shared conventions (see its CLAUDE.md
"Sibling projects" section). As of 2026-10-20 all eight active siblings have
branch protection, Dependabot auto-merge, and a required check that starts the
built container. random-server and the MCP servers update weekly, so their
Dependabot bumps usually land before this repo's — when one ships a
production dependency this repo shares (`express`, `cors`), check
`npm outdated` here.
