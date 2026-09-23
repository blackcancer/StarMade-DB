# Version history and tag provenance

<!-- generated-by: starmade-version-regularization-20260923 -->

Reconciled and independently re-read from GitHub on 23 September 2026.
Reviewed main snapshot: `d3383859285d3ee7007499ccaabfc6fabb90be7a`.

## Verified stable versions

| Tag | Target commit | Package version | Provenance |
| --- | --- | --- | --- |
| v1.0.0 | [bc9640cfae31](https://github.com/blackcancer/StarMade-DB/commit/bc9640cfae31c4c38602f560ac12c64774f0373b) | 1.0.0 | exact historical commit |
| v1.0.1 | [fe243db3f4e7](https://github.com/blackcancer/StarMade-DB/commit/fe243db3f4e7f94c73dc39fc4862347e314df299) | 1.0.0 | existing tag retained; historical manifest exception |
| v1.1.0 | [3bdac7387dbb](https://github.com/blackcancer/StarMade-DB/commit/3bdac7387dbb1d6f99e224183920c54fd282adb5) | 1.1.0 | metadata-only historical reconstruction |
| v1.2.0 | [96723c84f58c](https://github.com/blackcancer/StarMade-DB/commit/96723c84f58cc6e392215cdccc8b61906fa04cd4) | 1.2.0 | exact historical commit |
| v1.3.0 | [f26c5e77dd2c](https://github.com/blackcancer/StarMade-DB/commit/f26c5e77dd2c16ed799c33626b22910b894c205d) | 1.3.0 | exact historical commit |
| v2.0.0 | [25c5ea944b66](https://github.com/blackcancer/StarMade-DB/commit/25c5ea944b661a30e7c5a3aa55cb0ea0e64fc55e) | 2.0.0 | exact historical commit |
| v2.0.1 | [f592ae3419a1](https://github.com/blackcancer/StarMade-DB/commit/f592ae3419a156c5a65ab0a0abd85aa7674ca3e3) | 2.0.1 | exact historical commit |
| v2.0.2 | [d3383859285d](https://github.com/blackcancer/StarMade-DB/commit/d3383859285d3ee7007499ccaabfc6fabb90be7a) | 2.0.2 | exact historical commit |

## Historical exceptions

### v1.0.1

The original annotated tag explicitly identifies Release 1.0.1 - Fix GitHub install (add prepare script), but its package.json remained at 1.0.0. This published tag is retained unchanged; the discrepancy is documented rather than silently rewriting public history.

Original code: `fe243db3f4e7f94c73dc39fc4862347e314df299`; original manifest: `1.0.0`. The existing published tag object and target are retained unchanged.

### v1.1.0

Commit 96723c84f58cc6e392215cdccc8b61906fa04cd4 explicitly renumbered the historical 2.1.0 changelog entry to 1.1.0. The retained pre-Decoder-integration code snapshot still declares package version 2.0.0. This archival reconstruction corrects root package and lockfile versions only, with no runtime or dependency changes.

Original code: `28104870539455e9d1227aa638e9c766515c3f4c`; original manifest: `2.0.0`. Only root version metadata in package.json and any existing npm lockfile was normalized on a separate archival commit. Runtime sources and dependency definitions are unchanged; the original commit was not modified.

## Reconciliation result
- 4 missing annotated tags created in this run.
- 8 missing source-only release records created in this run.
- Every pre-existing tag object SHA was preserved and checked against the remote.
- Every listed tag target and release record was re-read after publication.
- Historical application test suites were not rerun; no compiled distribution assets were rebuilt.
- Release records explicitly distinguish source snapshots from installable release packages.

Development candidates are not promoted to stable releases by this operation. No StarMade-Open version number is invented. Future stable releases should keep the tag, package.json and root lockfile version aligned; published tags must not be silently moved.

## Execution receipt
[Repository-scoped reconciliation run](https://github.com/blackcancer/StarMade-DB/actions/runs/35862526056).
