import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporary = await mkdtemp(join(tmpdir(), 'chromex-side-chat-test-'));
const manifest = JSON.parse(await readFile('packages/extension/public/manifest.json', 'utf8'));
const id = [...createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
const server = createServer((request, response) => response.end('<!doctype html><title>Loaded chat</title><article><p>Original answer</p><pre>const count = 3;</pre><table><tr><td>count</td><td>3</td></tr></table></article>'));
let context;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await writeFile(join(temporary, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Side Chat Test', version: '1.0', key: manifest.key, permissions: ['tabs', 'scripting', 'storage'], host_permissions: ['http://127.0.0.1/*'] }));
  await writeFile(join(temporary, 'panel.html'), '<!doctype html><script type="module" src="panel.js"></script>');
  await build({ stdin: { contents: `import { mountSideChat } from './packages/extension/src/side-chat/panel.ts'; let id = ''; let counter = 0; const panel = mountSideChat(() => id, async () => { id = 'chat-' + ++counter; }); window.testPanel = { panel, switchId(value) { id = value; panel.sync(); }, getId() { return id; } };`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', outfile: join(temporary, 'panel.js') });
  context = await chromium.launchPersistentContext(join(temporary, 'profile'), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${temporary}`, `--load-extension=${temporary}`] });
  const source = await context.newPage();
  await source.goto(`http://127.0.0.1:${server.address().port}`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${id}/panel.html`);
  await panel.waitForFunction(() => window.testPanel);
  await source.bringToFront();
  await panel.evaluate(() => document.querySelector('[data-action="new"]').click());
  await panel.waitForFunction(() => document.querySelector('textarea').value.includes('const count = 3;'));
  assert.equal(await panel.evaluate(() => window.testPanel.getId()), 'chat-1');
  // Loaded page changes cannot replace a reviewed snapshot without a manual refresh.
  await source.evaluate(() => document.querySelector('article').textContent = 'Updated answer');
  assert.match(await panel.locator('textarea').inputValue(), /Original answer/);
  await panel.locator('textarea').fill('Reviewed and edited context');
  assert.equal(await panel.evaluate(async () => (await window.testPanel.panel.get()).text), 'Reviewed and edited context');
  await panel.evaluate(() => window.testPanel.switchId('other-chat'));
  assert.equal(await panel.locator('textarea').inputValue(), '');
  await panel.evaluate(() => window.testPanel.switchId('chat-1'));
  assert.equal(await panel.locator('textarea').inputValue(), 'Reviewed and edited context');
  await source.bringToFront();
  await panel.evaluate(() => document.querySelector('[data-action="update"]').click());
  await panel.waitForFunction(() => document.querySelector('textarea').value === 'Updated answer');
  await panel.reload();
  await panel.waitForFunction(() => window.testPanel);
  await panel.evaluate(() => window.testPanel.switchId('chat-1'));
  await panel.waitForFunction(() => document.querySelector('textarea').value === 'Updated answer');
  await panel.evaluate(() => document.querySelector('[data-action="clear"]').click());
  await panel.waitForFunction(() => document.querySelector('textarea').value === '');
  assert.equal(await panel.evaluate(() => window.testPanel.panel.get()), undefined);
  assert.equal(await source.locator('article').textContent(), 'Updated answer');
  console.log('Side Chat smoke passed: loaded text/code/table capture, edit, isolation, manual refresh, persistence, and clear.');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
