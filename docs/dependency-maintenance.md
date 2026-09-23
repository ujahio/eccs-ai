# Dependency maintenance

Reviewed on 2026-09-23 for issue #84. Direct dependencies remain exactly pinned in
[`package.json`](../package.json); [`bun.lock`](../bun.lock) records the complete
resolved graph. The refresh updates packages to their newest stable releases where
compatibility allows and preserves the accepted architecture.

## Refresh summary (2026-09-23)

This refresh follows the 2026-09-16 review and moves every package to the newest
available version within its verified compatibility window:

| Package | 2026-09-16 | 2026-09-23 | Notes |
| --- | --- | --- | --- |
| `@aws-sdk/*` clients | 3.1133.0 | 3.1138.0 | All six clients moved together at 3.1138.0. |
| `next` | 16.3.5 | 16.3.6 | Patch release; peer `react ^19.0.0` satisfied by 19.3.0. |
| `eslint-config-next` | 16.3.5 | 16.3.6 | Matches `next` version. |
| `@types/node` | 26.6.1 | 26.6.2 | Dev-only types. |
| `vitest` | 4.1.11 | 5.0.1 | Major migration completed; see below. |

Anything else was already at its newest stable release: `@aws-sdk/lib-dynamodb`
peer `@aws-sdk/client-dynamodb ^3.1138.0` is satisfied, React 19.3.0, Zod 4.6.5,
Better Auth 1.7.5, ESLint 9.39.5, TypeScript 6.0.3, Tailwind 4.3.3, Vite 8.3.0,
Playwright 1.63.0, SST 4.17.1, Resend 6.28.1, jsx-email 3.2.1 and the
`@radix-ui`/`aws-jwt-verify`/`server-only` pins.

### Vitest 5

Vitest 5.0.1 (released 2026-09-15) was deferred in the previous review as a
risk-based decision to keep the security update isolated. This refresh completed
the migration: Vitest 5.0.1 declares Vite `^6.4.0 || ^7.0.0 || ^8.0.0` as a peer,
which the project's Vite 8.3.0 satisfies, and the project's `vitest.config.ts` is
minimal (alias + include). The full unit suite (48 files, 241 tests) passes under
5.0.1 unchanged. The `vitest` dependency is now `5.0.1` and no longer carries its
own Vite dependency, so the `vite` override remains the single Vite-version source.

## Security overrides

The 2026-09-16 review removed all previous overrides and regenerated the lockfile
before auditing. Fresh resolution removed the need to force unrelated dependency
majors. These three overrides remain, because the latest `jsx-email` release,
3.2.1, still pins vulnerable versions exactly:

| Override | Upstream pin | Reason and removal condition |
| --- | --- | --- |
| `postcss: 8.5.28` | `jsx-email` pins 8.5.14 | Fixes source-map file disclosure and stays on PostCSS 8. Remove when JSX Email resolves a patched version (at least 8.5.23) without the override. |
| `react-router-dom: 7.18.4` | `jsx-email` pins 7.12.0 | Fixes the vulnerable router chain while retaining major 7. DOM 7.18.4 brings its matching `react-router` 7.18.4; no separate router override is necessary. Remove when JSX Email's own pin is patched. |
| `vite: 8.3.0` | `jsx-email` pins 8.0.10 | Fixes the development-server file-deny bypass and keeps preview tooling on the same Vite 8 version as the project. Remove when JSX Email's own pin is patched. |

These overrides affect all occurrences of their package names. Recheck the parent
manifests and run the full audit before removing or changing them.

Relevant advisories include [PostCSS source-map disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849),
[React Router deserialization](https://github.com/advisories/GHSA-49rj-9fvp-4h2h),
and [Vite file-deny bypass](https://github.com/advisories/GHSA-fx2h-pf6j-xcff).

Removed overrides (from the 2026-09-16 review):

- `minimatch` and `brace-expansion`: callers now receive patched releases within
  their declared majors. The lockfile contains Minimatch 3.1.5, 9.0.9 and 10.2.6,
  with Brace Expansion 1.1.21, 2.1.7 and 5.0.12. Forcing every caller onto a single
  major risks breaking older APIs, including ESLint's callable Minimatch import.
- `react-router`: the old major-8 override disagreed with React Router DOM 7's
  exact major-7 dependency. The DOM override now supplies a matching patched pair.
- `sharp`: Next.js requires `^0.35.4`, which resolves to patched 0.35.4 without
  an override.

The refreshed graph also resolves patched Browserslist 4.29.0, JS-YAML 4.3.2,
Nano ID 3.3.19 and baseline-browser-mapping 2.11.24 without overrides. `bun audit`
reported **no vulnerabilities** on 2026-09-23 for the clean-installed lockfile.
Advisory results are a point-in-time check and should be rerun with future updates.

## Deferred major upgrades

- **ESLint 10:** keep 9.39.5, the latest stable 9.x release. `eslint-config-next`
  16.3.6 pins `eslint-plugin-import` ^2.32.0, `eslint-plugin-jsx-a11y` ^6.10.0 and
  `eslint-plugin-react` ^7.37.0, and those plugins still declare peer support only
  through ESLint 9 (`^9`/`^9.7`). Upgrade after the plugins ship ESLint 10
  compatible releases and the `eslint-config-next` pins are reviewed.
- **TypeScript 7:** keep 6.0.3. The `typescript-eslint` 8.70.x packages used by
  `eslint-config-next` require TypeScript `>=4.8.4 <6.1.0`; TypeScript 7.0.2 is
  outside that supported range and no newer `typescript-eslint` major has widened
  it yet.

Compatibility evidence comes from the resolved package manifests and the
[Vitest 5.0.1 peer declarations](https://www.npmjs.com/package/vitest),
[ESLint 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0),
and the `typescript-eslint` peer ranges for the packages in `bun.lock`.

## Verification for future refreshes

Verify significant lockfile or override changes with a clean installation:
move the existing `node_modules` directory aside, then run
`bun install --frozen-lockfile`. An incremental Bun 1.3.10 install can leave stale
nested package copies after an override changes, so an audit of the lockfile alone
does not prove that an existing local installation uses those resolved versions.

After resolving dependencies, run the full `bun audit`, lint, typecheck, unit tests
and production build. This refresh passed `bun audit` (no vulnerabilities),
`bunx tsc --noEmit`, `bunx eslint .` (no errors; one pre-existing
`@next/next/no-location-assign-relative-destination` warning in
`src/features/teacher/case-authoring/case-authoring-wizard.tsx`), `bunx vitest run`
(48 files, 241 tests) and `bun run build` (webpack production build). Exercise
JSX Email rendering and preview tooling when its overrides change.
`bun run test:e2e:memory` starts the isolated browser-test harness without SST.
For manual local development against AWS, the user authenticates and starts SST
locally. Deployment and live AWS integration checks remain separate.