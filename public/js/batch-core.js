// Pixora batch core: the parts of batch conversion that don't touch the DOM,
// so tests/batch-core.test.js can run them under node.
//   - createQueue: runs jobs with at most `limit` at once; one job throwing
//     never stops the others.
//   - buildZip: packs finished files into one .zip (stored, no compression:
//     PNG, JPEG and WebP are already compressed).
//   - uniqueName / outputName: file names for results and zip entries.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PixoraBatch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createQueue(limit, worker, onSettled) {
    const waiting = [];
    let running = 0;

    function pump() {
      while (running < limit && waiting.length) {
        const job = waiting.shift();
        running++;
        Promise.resolve()
          .then(() => worker(job))
          .then(
            (result) => onSettled && onSettled(job, null, result),
            (err) => onSettled && onSettled(job, err || new Error('Failed'), null)
          )
          .finally(() => { running--; pump(); });
      }
    }

    return {
      add(job) { waiting.push(job); pump(); },
      // Drops a job that hasn't started yet. Returns true if it was waiting.
      remove(job) {
        const i = waiting.indexOf(job);
        if (i === -1) return false;
        waiting.splice(i, 1);
        return true;
      },
      get running() { return running; },
      get waiting() { return waiting.length; },
    };
  }

  const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

  function outputName(originalName, mimeType) {
    const base = String(originalName || 'image').replace(/\.[^./\\]*$/, '') || 'image';
    return base + '.' + (EXTENSIONS[mimeType] || 'bin');
  }

  // "photo.png", then "photo (2).png", "photo (3).png", ... within one set.
  function uniqueName(name, taken) {
    if (!taken.has(name)) { taken.add(name); return name; }
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let n = 2; ; n++) {
      const candidate = base + ' (' + n + ')' + ext;
      if (!taken.has(candidate)) { taken.add(candidate); return candidate; }
    }
  }

  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[i] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const d = date || new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const day = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, day };
  }

  // entries: [{ name: string, data: Uint8Array }]. Returns a Uint8Array.
  function buildZip(entries, date) {
    const enc = new TextEncoder();
    const { time, day } = dosDateTime(date);
    const parts = [];
    const central = [];
    let offset = 0;

    for (const entry of entries) {
      const name = enc.encode(entry.name);
      const data = entry.data;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);       // version needed
      local.setUint16(6, 0x0800, true);   // UTF-8 names
      local.setUint16(8, 0, true);        // stored
      local.setUint16(10, time, true);
      local.setUint16(12, day, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);          // version made by
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, time, true);
      cd.setUint16(14, day, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);

      offset += 30 + name.length + data.length;
    }

    const centralSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
    let pos = 0;
    for (const p of all) { out.set(p, pos); pos += p.length; }
    return out;
  }

  return { createQueue, buildZip, crc32, outputName, uniqueName };
});
