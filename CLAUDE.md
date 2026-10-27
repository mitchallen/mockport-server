# mockport-server — notes for Claude

A mock HTTP server for testing clients: it serves canned responses from a JSON
mockfile (`data/` by default, overridable with `MOCKFILE` or a mounted volume).
Plain JavaScript + Express 5, `node:test` + `c8`, a single-stage Docker image on
`node:24-alpine` with a `/healthz` `HEALTHCHECK`, published to GHCR + Docker Hub
via a tag-triggered workflow. `package.json` is `"private": true` — it ships
only as an image.

## Remaining work

Run `gh issue list` for the current state. Nothing is outstanding as of
v0.1.9 (2026-10-20), which took `express` 5.3.0, dropped the dead `diff` /
`serialize-javascript` overrides, and fixed the README's Node 20 references.

- **`overrides` outlive their reason.** The `diff` and `serialize-javascript`
  pins were for mocha's tree; when #35 removed mocha they pinned nothing.
  After removing a dependency, run `npm explain <pkg>` for each override and
  drop the ones that report "No dependencies found".

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
- **Release lessons (v0.1.9, 2026-10-20):**
  - **PR titles are the release notes.** There is no CHANGELOG; the release
    job generates "What's Changed" from the PRs merged since the last tag. So
    give a PR a title that says what users get — v0.1.9's read
    `bump express to 5.3.0, drop dead overrides, fix README Node version`.
  - **Bundle fixes into one PR, then release.** v0.1.9 landed three
    follow-ups (#38) and then a release PR (#39); each runs the required
    checks (~1 min), and the release PR isn't a Dependabot PR, so merge it by
    hand once green. Use `make release VERSION=x.y.z` to pin the number.
  - **`make tag` must run on the pulled squash commit.** The release PR's
    commit is replaced by its squash merge, so `git pull` on `main` before
    `make tag`, or the tag lands on a commit that isn't on `main`.
  - **Verify what shipped, not just that publishing succeeded.** The publish
    run takes ~1.5 min (tag → images + Release). Afterwards, check both
    registries are multi-arch
    (`docker buildx imagetools inspect <image>:x.y.z`) and that the image
    carries the change:
    `docker run --rm --entrypoint node ghcr.io/mitchallen/mockport-server:x.y.z -p "require('express/package.json').version + ' / app ' + require('./package.json').version"`
    printed `5.3.0 / app 0.1.9`.
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

## Automated releases

`.github/workflows/auto-release.yml` ships Dependabot updates without a
hand-cut release. Every Wednesday at 15:00 UTC it runs
`.github/scripts/auto-release.sh plan`. A release is due when `main` has
changes since the latest tag that reach the image, and every one was committed
by a bot. CI, docs and test changes and dev-only dependency bumps don't count.
When a release is due, it opens an `auto-release/vX.Y.Z` PR (patch version bump) with
auto-merge (squash) on, so it lands only once the required checks pass. When the
PR merges, the `tag` job tags the merge commit, and the tag push triggers the
publish workflows. `publish.yml` then creates the GitHub Release.

- **Anything a person changed is left alone.** A human commit touching
  image-affecting files, or entries under `[Unreleased]` in the changelog,
  makes `plan` skip with a reason in the run summary. Release those with
  `make release`.
- **Run it by hand:** `gh workflow run auto-release.yml -f dry-run=true`
  reports the decision without opening a PR; drop `dry-run` to release now.
- **Credentials:** pushes use a GitHub App token (repo variable
  `RELEASE_APP_CLIENT_ID`, secret `RELEASE_APP_PRIVATE_KEY`), because tags and
  PRs created with `GITHUB_TOKEN` don't trigger other workflows.
- **Keep it in sync.** The same script and workflow live in all eight sibling
  repos; only the `MERGE_METHOD` and `CREATE_RELEASE` env values differ.
