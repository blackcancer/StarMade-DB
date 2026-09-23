/**
 * @fileoverview
 * Restore explicitly reviewed historical version tags and source-only releases.
 * Existing tags and release assets are immutable inputs. Only reviewed version
 * metadata may be normalized on new archival commits; runtime code is untouched.
 * Requires Node.js 22+, Git, a repository-scoped GITHUB_TOKEN and VERSION_PLAN.
 * @module release-history/regularize-versions
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Execute Git without exposing authentication configuration in error messages.
 * @param {string} root Working directory.
 * @param {string[]} args Git arguments.
 * @param {object} [options] Environment and stdin overrides.
 * @returns {string} UTF-8 standard output.
 * @throws {Error} If Git fails.
 */
function git(root, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...options.env },
    input: options.input,
  });
  if (result.status !== 0) throw new Error(`Git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trimEnd();
}

/** Normalize only root package version metadata, never dependency versions.
 * @param {object} source Parsed package or lockfile object.
 * @param {string} version Expected release version.
 * @returns {object} Detached normalized metadata.
 */
export function normalizeMetadata(source, version) {
  const result = structuredClone(source);
  result.version = version;
  if (result.packages?.['']) result.packages[''].version = version;
  return result;
}

/** Compare package metadata while ignoring root version keys.
 * @param {object} before Original metadata.
 * @param {object} after Corrected metadata.
 * @returns {void}
 * @throws {Error} If anything except root version metadata changed.
 */
export function assertMetadataOnly(before, after) {
  assert.deepEqual(normalizeMetadata(before, '__version__'), normalizeMetadata(after, '__version__'));
}

/** Reconcile one allowlisted repository using a fully specified historical plan.
 * @returns {Promise<void>}
 * @throws {Error} On ambiguous targets, changed existing tags or API failures.
 */
async function main() {
  const plan = JSON.parse(process.env.VERSION_PLAN ?? 'null');
  const allowed = new Set(['blackcancer/StarMade-DB', 'blackcancer/StarMade-Decoder', 'blackcancer/StarMade-BlockEditor']);
  assert.ok(plan && allowed.has(plan.repository), 'Repository must be explicitly allowlisted.');
  assert.equal(process.env.GITHUB_REPOSITORY, plan.repository);
  assert.ok(process.env.GITHUB_TOKEN, 'A repository-scoped token is required.');
  assert.match(plan.snapshot, /^[a-f0-9]{40}$/);
  const root = mkdtempSync(join(tmpdir(), 'starmade-version-history-'));
  const identity = {
    GIT_AUTHOR_NAME: 'github-actions[bot]', GIT_COMMITTER_NAME: 'github-actions[bot]',
    GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
  };

  /** Call a repository-scoped GitHub REST endpoint without blind write retries.
   * @param {string} method HTTP method.
   * @param {string} path Repository-relative API path.
   * @param {object} [body] JSON request body.
   * @param {boolean} [optional] Whether a 404 means absence.
   * @returns {Promise<any>} Parsed JSON or null.
   * @throws {Error} If the API rejects the operation.
   */
  async function api(method, path, body, optional = false) {
    assert.ok(path.startsWith('/') && !path.includes('..'));
    const response = await fetch(`https://api.github.com/repos/${plan.repository}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (optional && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}: ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  }
  try {
    git(root, ['clone', '--quiet', '--no-checkout', `https://github.com/${plan.repository}.git`, '.']);
    assert.equal(git(root, ['rev-parse', 'origin/main']), plan.snapshot, 'Default branch changed after review.');
    const before = Object.fromEntries(git(root, ['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/tags/']).split('\n').filter(Boolean).map(line => line.split(' ')));
    for (const [tag, object] of Object.entries(plan.existingTags)) assert.equal(before[tag], object, `Existing tag changed: ${tag}`);
    const tagNames = new Set();
    const prepared = [];
    for (const entry of plan.versions) {
      assert.match(entry.tag, /^v\d+\.\d+\.\d+$/);
      assert.match(entry.original, /^[a-f0-9]{40}$/);
      assert.ok(!tagNames.has(entry.tag), 'Duplicate tag in plan.'); tagNames.add(entry.tag);
      assert.equal(git(root, ['cat-file', '-t', entry.original]), 'commit');
      if (!plan.existingTags[entry.tag]) git(root, ['merge-base', '--is-ancestor', entry.original, plan.snapshot]);
      const metadata = JSON.parse(git(root, ['show', `${entry.original}:package.json`]));
      assert.equal(metadata.version, entry.originalVersion, `Unexpected historical manifest: ${entry.tag}`);
      const paths = git(root, ['ls-tree', '-r', '--name-only', entry.original]).split('\n');
      const suspicious = paths.filter(path => /\.(java|class|jar)$/i.test(path) && !(plan.repository.endsWith('/StarMade-DB') && /^tools\/(ReloadEntities|SandboxLoader)\.(java|class)$/.test(path)));
      assert.equal(suspicious.length, 0, `Unreviewed Java resources at ${entry.tag}: ${suspicious.join(', ')}`);
      let target = entry.original;
      let mode = 'exact historical commit';
      if (entry.normalize) {
        assert.ok(!plan.existingTags[entry.tag], 'Published tags cannot be normalized.');
        const version = entry.tag.slice(1);
        assert.notEqual(entry.originalVersion, version);
        const env = { ...identity, GIT_INDEX_FILE: join(root, `.git/index-${entry.tag}`) };
        git(root, ['read-tree', entry.original], { env });
        for (const path of ['package.json', 'package-lock.json', 'npm-shrinkwrap.json'].filter(path => paths.includes(path))) {
          const oldValue = JSON.parse(git(root, ['show', `${entry.original}:${path}`]));
          const newValue = normalizeMetadata(oldValue, version);
          assertMetadataOnly(oldValue, newValue);
          const blob = git(root, ['hash-object', '-w', '--stdin'], { input: JSON.stringify(newValue, null, 2) + '\n' });
          const fileMode = git(root, ['ls-tree', entry.original, '--', path]).split(' ')[0];
          git(root, ['update-index', '--add', '--cacheinfo', `${fileMode},${blob},${path}`], { env });
        }
        const tree = git(root, ['write-tree'], { env });
        if (before[entry.tag]) {
          target = git(root, ['rev-parse', `${entry.tag}^{commit}`]);
          assert.equal(git(root, ['rev-parse', `${target}^`]), entry.original);
          assert.equal(git(root, ['rev-parse', `${target}^{tree}`]), tree, 'Existing archival reconstruction differs from plan.');
        } else {
          target = git(root, ['commit-tree', tree, '-p', entry.original], { env: identity, input: `chore(release): normalize historical ${entry.tag} package metadata\n\nOriginal-Commit: ${entry.original}\nOriginal-Manifest-Version: ${entry.originalVersion}\nReason: ${entry.reason}\n\nRetrospective metadata-only reconstruction. Runtime code and dependencies are unchanged.\n` });
        }
        const changed = git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', target]).split('\n').filter(Boolean);
        assert.ok(changed.length > 0 && changed.every(path => ['package.json', 'package-lock.json', 'npm-shrinkwrap.json'].includes(path)));
        assert.equal(JSON.parse(git(root, ['show', `${target}:package.json`])).version, version);
        mode = 'metadata-only historical reconstruction';
      } else if (entry.tag.slice(1) !== entry.originalVersion) {
        assert.ok(plan.existingTags[entry.tag] && entry.reason, 'Unexplained new version mismatch.');
        mode = 'existing tag retained; historical manifest exception';
      }
      if (before[entry.tag]) assert.equal(git(root, ['rev-parse', `${entry.tag}^{commit}`]), target, `Refusing to move ${entry.tag}`);
      prepared.push({ ...entry, target, mode, newTag: !before[entry.tag] });
    }
    // Validate all historical targets before publishing any tag.
    for (const entry of prepared.filter(item => item.newTag)) {
      git(root, ['tag', '-a', entry.tag, entry.target, '-m', `${plan.repository.split('/')[1]} ${entry.tag}\n\nRetrospectively recorded on 2026-09-23.\nOriginal-Commit: ${entry.original}\nTag-Target: ${entry.target}\nHistorical-Manifest: ${entry.originalVersion}\nProvenance: ${entry.mode}\n${entry.reason ?? ''}\n\nNo previous tag was moved. This records source history, not a new test qualification or binary rebuild.`], { env: identity });
    }
    const createdTags = prepared.filter(item => item.newTag).map(item => `refs/tags/${item.tag}`);
    if (createdTags.length) {
      const auth = Buffer.from(`x-access-token:${process.env.GITHUB_TOKEN}`).toString('base64');
      git(root, ['push', '--atomic', 'origin', ...createdTags], { env: { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}` } });
    }
    const releases = [];
    for (let page = 1; ; page++) {
      const batch = await api('GET', `/releases?per_page=100&page=${page}`);
      releases.push(...batch); if (batch.length < 100) break;
    }
    const releaseRecords = [];
    for (const entry of prepared) {
      const current = releases.find(release => release.tag_name === entry.tag);
      if (current) { releaseRecords.push({ tag: entry.tag, status: 'preserved', url: current.html_url, draft: current.draft }); continue; }
      const body = [
        `# ${plan.repository.split('/')[1]} ${entry.tag}`,
        '', entry.summary,
        '', '## Historical provenance',
        `- Original code commit: [${entry.original.slice(0, 12)}](https://github.com/${plan.repository}/commit/${entry.original}).`,
        `- Tag target: [${entry.target.slice(0, 12)}](https://github.com/${plan.repository}/commit/${entry.target}).`,
        `- Recording method: **${entry.mode}**.`,
        `- Original package.json version: \`${entry.originalVersion}\`.`,
        entry.reason ? `- Note: ${entry.reason}` : '',
        '', 'This release entry was restored on 23 September 2026. Existing tags and published assets were not moved or replaced.',
        '', '## Distribution and qualification',
        'This is a **source-only historical record**. GitHub source archives are available; no compiled npm tarball or application bundle was recreated by this reconciliation. Historical application tests were not rerun. The reconciliation verifies commit identities, root version metadata and preservation of all existing tag objects; it is not a new application or in-game compatibility qualification.',
        entry.tag === plan.latest ? '' : `For new work, prefer the current release, **${plan.latest}**.`,
        '', `[Changelog and migration context](https://github.com/${plan.repository}/blob/${plan.snapshot}/CHANGELOG.md)`,
        `[Version-history ledger](https://github.com/${plan.repository}/blob/main/docs/VERSION_HISTORY.md)`,
      ].filter(line => line !== undefined).join('\n');
      const release = await api('POST', '/releases', { tag_name: entry.tag, target_commitish: entry.target, name: `${plan.repository.split('/')[1]} ${entry.tag}`, body, draft: false, prerelease: false, make_latest: entry.tag === plan.latest ? 'true' : 'false' });
      releaseRecords.push({ tag: entry.tag, status: 'created', url: release.html_url, draft: release.draft });
    }
    const remote = Object.fromEntries(git(root, ['ls-remote', '--tags', 'origin']).split('\n').filter(Boolean).map(line => { const [sha, ref] = line.split(/\s+/); return [ref.replace('refs/tags/', ''), sha]; }));
    for (const [tag, object] of Object.entries(before)) assert.equal(remote[tag], object, `Published tag object was changed: ${tag}`);
    for (const entry of prepared) assert.equal(remote[`${entry.tag}^{}`] ?? remote[entry.tag], entry.target, `Remote tag target mismatch: ${entry.tag}`);
    for (const entry of prepared) {
      const release = await api('GET', `/releases/tags/${entry.tag}`);
      assert.equal(release.tag_name, entry.tag);
    }
    const createdReleaseCount = releaseRecords.filter(item => item.status === 'created').length;
    const rows = prepared.map(entry => `| ${entry.tag} | [${entry.target.slice(0, 12)}](https://github.com/${plan.repository}/commit/${entry.target}) | ${JSON.parse(git(root, ['show', `${entry.target}:package.json`])).version} | ${entry.mode} |`);
    const doc = [
      '# Version history and tag provenance', '', '<!-- generated-by: starmade-version-regularization-20260923 -->',
      '', 'Reconciled and independently re-read from GitHub on 23 September 2026.',
      `Reviewed main snapshot: \`${plan.snapshot}\`.`,
      '', '## Verified stable versions', '', '| Tag | Target commit | Package version | Provenance |', '| --- | --- | --- | --- |', ...rows,
      '', '## Historical exceptions',
      ...prepared.filter(entry => entry.reason).map(entry => `\n### ${entry.tag}\n\n${entry.reason}\n\nOriginal code: \`${entry.original}\`; original manifest: \`${entry.originalVersion}\`. ${entry.normalize ? 'Only root version metadata in package.json and any existing npm lockfile was normalized on a separate archival commit. Runtime sources and dependency definitions are unchanged; the original commit was not modified.' : 'The existing published tag object and target are retained unchanged.'}`),
      '', '## Reconciliation result',
      `- ${createdTags.length} missing annotated tags created in this run.`,
      `- ${createdReleaseCount} missing source-only release records created in this run.`,
      '- Every pre-existing tag object SHA was preserved and checked against the remote.',
      '- Every listed tag target and release record was re-read after publication.',
      '- Historical application test suites were not rerun; no compiled distribution assets were rebuilt.',
      '- Release records explicitly distinguish source snapshots from installable release packages.',
      '', 'Development candidates are not promoted to stable releases by this operation. No StarMade-Open version number is invented. Future stable releases should keep the tag, package.json and root lockfile version aligned; published tags must not be silently moved.',
      '', '## Execution receipt',
      `[Repository-scoped reconciliation run](https://github.com/${plan.repository}/actions/runs/${process.env.GITHUB_RUN_ID}).`,
      '',
    ].join('\n');
    const path = '/contents/docs/VERSION_HISTORY.md';
    const previous = await api('GET', `${path}?ref=main`, undefined, true);
    if (previous) assert.ok(Buffer.from(previous.content.replace(/\s/g, ''), 'base64').toString('utf8').includes('generated-by: starmade-version-regularization-20260923'), 'Refusing to overwrite an unrelated history document.');
    const publication = await api('PUT', path, { message: 'docs: record verified historical tags and release provenance', content: Buffer.from(doc).toString('base64'), branch: 'main', ...(previous ? { sha: previous.sha } : {}) });
    const result = { repository: plan.repository, tagsCreated: createdTags.length, releasesCreated: createdReleaseCount, versions: prepared.map(({ tag, original, target, mode }) => ({ tag, original, target, mode })), releases: releaseRecords, historyCommit: publication.commit.sha, existingTagsPreserved: true };
    console.log('RECONCILIATION_RESULT ' + JSON.stringify(result));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, doc);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

if (process.env.VERSION_PLAN) main().catch(error => { console.error(error.message); process.exitCode = 1; });
