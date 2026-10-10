const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createQueue, buildZip, crc32, outputName, uniqueName } = require('../public/js/batch-core.js');

const tick = (ms) => new Promise((r) => setTimeout(r, ms));

test('queue never runs more than the limit at once and finishes every job', async () => {
  let active = 0;
  let peak = 0;
  const settled = [];
  await new Promise((resolve) => {
    const q = createQueue(3, async (job) => {
      active++; peak = Math.max(peak, active);
      await tick(5 + (job % 3) * 5);
      active--;
      return job * 2;
    }, (job, err, result) => {
      settled.push({ job, err, result });
      if (settled.length === 10) resolve();
    });
    for (let i = 0; i < 10; i++) q.add(i);
  });
  assert.strictEqual(peak, 3);
  assert.deepStrictEqual(settled.map((s) => s.job).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(settled.every((s) => s.err === null && s.result === s.job * 2));
});

test('one failing job does not stop the others', async () => {
  const settled = [];
  await new Promise((resolve) => {
    const q = createQueue(2, async (job) => {
      if (job === 1) throw new Error('bad file');
      return 'ok';
    }, (job, err) => {
      settled.push({ job, err: err && err.message });
      if (settled.length === 4) resolve();
    });
    [0, 1, 2, 3].forEach((j) => q.add(j));
  });
  const byJob = Object.fromEntries(settled.map((s) => [s.job, s.err]));
  assert.deepStrictEqual(byJob, { 0: null, 1: 'bad file', 2: null, 3: null });
});

test('remove drops a job that has not started', async () => {
  const ran = [];
  await new Promise((resolve) => {
    let done = 0;
    const q = createQueue(1, async (job) => { ran.push(job); await tick(5); }, () => {
      if (++done === 2) resolve();
    });
    q.add('a'); q.add('b'); q.add('c');
    assert.strictEqual(q.remove('b'), true);
    assert.strictEqual(q.remove('a'), false); // already running
  });
  assert.deepStrictEqual(ran, ['a', 'c']);
});

test('output names swap the extension and stay unique', () => {
  assert.strictEqual(outputName('holiday.photo.HEIC', 'image/webp'), 'holiday.photo.webp');
  assert.strictEqual(outputName('scan', 'image/jpeg'), 'scan.jpg');
  const taken = new Set();
  assert.deepStrictEqual(
    ['a.png', 'a.png', 'a.png', 'b.png'].map((n) => uniqueName(n, taken)),
    ['a.png', 'a (2).png', 'a (3).png', 'b.png']
  );
});

test('crc32 matches the standard check value', () => {
  assert.strictEqual(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('buildZip produces an archive a standard zip reader accepts, with every file intact', (t) => {
  const files = [
    { name: 'one.png', data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) },
    { name: 'café (2).webp', data: new TextEncoder().encode('RIFF....WEBP') },
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixora-zip-'));
  const zipPath = path.join(dir, 'out.zip');
  fs.writeFileSync(zipPath, buildZip(files));
  // Python's zipfile checks every CRC (testzip) and honours the UTF-8 name flag.
  const reader = [
    'import sys, zipfile, json, base64',
    'z = zipfile.ZipFile(sys.argv[1])',
    'assert z.testzip() is None',
    'print(json.dumps({i.filename: base64.b64encode(z.read(i)).decode() for i in z.infolist()}))',
  ].join('\n');
  let out;
  try {
    out = execFileSync('python3', ['-I', '-c', reader, zipPath], { encoding: 'utf8' });
  } catch (err) {
    if (err.code === 'ENOENT') { t.skip('python3 not installed'); return; }
    throw err;
  }
  const read = JSON.parse(out);
  assert.deepStrictEqual(Object.keys(read), files.map((f) => f.name));
  for (const f of files) {
    assert.deepStrictEqual(new Uint8Array(Buffer.from(read[f.name], 'base64')), f.data);
  }
});
