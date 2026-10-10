// Pixora batch conversion screen. Images are decoded and re-encoded in the
// browser with a canvas, so nothing is uploaded. The queue and the .zip
// writer live in batch-core.js.
(function () {
  'use strict';

  const { createQueue, buildZip, outputName, uniqueName } = window.PixoraBatch;

  // How many images convert at once. Decoding a large photo holds its full
  // bitmap in memory, so a few at a time keeps phones responsive.
  const MAX_PARALLEL = 3;
  const MAX_BYTES = 50 * 1024 * 1024;

  const $ = (id) => document.getElementById(id);
  const els = {
    format: $('opt-format'),
    size: $('opt-size'),
    quality: $('opt-quality'),
    drop: $('drop-zone'),
    input: $('file-input'),
    list: $('queue'),
    empty: $('queue-empty'),
    summary: $('queue-summary'),
    zip: $('zip-btn'),
    clear: $('clear-btn'),
    template: $('row-template'),
  };

  const jobs = [];
  let nextId = 1;

  const queue = createQueue(MAX_PARALLEL, convert, (job, err, blob) => {
    if (job.removed) return;
    if (err) {
      job.state = 'failed';
      job.error = err.message || 'Something went wrong';
    } else {
      job.state = 'done';
      job.result = blob;
      job.resultUrl = URL.createObjectURL(blob);
    }
    job.progress = 1;
    render(job);
    renderSummary();
  });

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function currentSettings() {
    return {
      type: els.format.value,
      maxSide: parseInt(els.size.value, 10) || 0,
      quality: parseFloat(els.quality.value),
    };
  }

  function setProgress(job, value, label) {
    if (job.removed) return;
    job.progress = value;
    job.stage = label;
    render(job);
  }

  async function decode(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) { /* fall back to an <img>, which reads a few more formats */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function convert(job) {
    const { file, settings } = job;
    job.state = 'working';
    if (!file.type.startsWith('image/') && file.type !== '') throw new Error('This file is not an image.');
    if (file.size > MAX_BYTES) throw new Error('This file is larger than 50 MB.');

    setProgress(job, 0.15, 'Reading');
    let image;
    try {
      image = await decode(file);
    } catch (_) {
      throw new Error("Couldn't read this image. Your browser may not support its format.");
    }
    if (job.removed) return null;

    setProgress(job, 0.5, 'Resizing');
    const srcW = image.width || image.naturalWidth;
    const srcH = image.height || image.naturalHeight;
    if (!srcW || !srcH) throw new Error("Couldn't read this image's size.");
    const scale = settings.maxSide && Math.max(srcW, srcH) > settings.maxSide
      ? settings.maxSide / Math.max(srcW, srcH) : 1;
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This image is too large to convert on this device.');
    // JPEG has no transparency: paint transparent areas white, not black.
    if (settings.type === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, w, h);
    if (image.close) image.close();

    setProgress(job, 0.75, 'Saving');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, settings.type, settings.quality));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error('This image is too large to convert on this device.');
    // Browsers that can't encode a format quietly hand back PNG instead.
    if (blob.type !== settings.type) {
      throw new Error("This browser can't save " + els.format.querySelector('[value="' + settings.type + '"]').textContent + '. Try another format.');
    }
    job.width = w;
    job.height = h;
    return blob;
  }

  function addFiles(fileList) {
    const settings = currentSettings();
    for (const file of Array.from(fileList)) {
      const job = {
        id: nextId++,
        file,
        settings,
        state: 'waiting',
        progress: 0,
        stage: '',
        thumbUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        outName: outputName(file.name, settings.type),
      };
      job.row = createRow(job);
      jobs.push(job);
      els.list.append(job.row);
      render(job);
      queue.add(job);
    }
    renderSummary();
  }

  function createRow(job) {
    const row = els.template.content.firstElementChild.cloneNode(true);
    row.dataset.job = String(job.id);
    const thumb = row.querySelector('[data-thumb]');
    // A file the browser can't show gets a plain tile, not a broken image.
    const placeholder = () => {
      const tile = document.createElement('div');
      tile.className = 'h-12 w-12 shrink-0 rounded-md bg-raised';
      thumb.replaceWith(tile);
    };
    thumb.addEventListener('error', placeholder);
    if (job.thumbUrl) thumb.src = job.thumbUrl;
    else placeholder();
    row.querySelector('[data-name]').textContent = job.file.name;
    row.querySelector('[data-remove]').setAttribute('aria-label', 'Remove ' + job.file.name);
    row.querySelector('[data-remove]').addEventListener('click', () => removeJob(job));
    row.querySelector('[data-retry]').addEventListener('click', () => retryJob(job));
    return row;
  }

  function render(job) {
    const row = job.row;
    const status = row.querySelector('[data-status]');
    const bar = row.querySelector('[data-bar]');
    const barWrap = row.querySelector('[data-bar-wrap]');
    const download = row.querySelector('[data-download]');
    const retry = row.querySelector('[data-retry]');

    status.classList.toggle('text-danger', job.state === 'failed');
    status.classList.toggle('text-muted', job.state !== 'failed');
    if (job.state === 'waiting') status.textContent = 'Waiting';
    else if (job.state === 'working') status.textContent = (job.stage || 'Converting') + '…';
    else if (job.state === 'done') {
      status.textContent = 'Done. ' + formatBytes(job.file.size) + ' to ' + formatBytes(job.result.size)
        + ', ' + job.width + '×' + job.height;
    } else if (job.state === 'failed') status.textContent = job.error;

    bar.style.width = Math.round(job.progress * 100) + '%';
    barWrap.hidden = job.state === 'done' || job.state === 'failed';
    barWrap.setAttribute('role', 'progressbar');
    barWrap.setAttribute('aria-label', 'Progress for ' + job.file.name);
    barWrap.setAttribute('aria-valuenow', String(Math.round(job.progress * 100)));

    download.hidden = job.state !== 'done';
    if (job.state === 'done') {
      download.href = job.resultUrl;
      download.download = job.outName;
      download.setAttribute('aria-label', 'Download ' + job.outName);
    }
    retry.hidden = job.state !== 'failed';
  }

  function renderSummary() {
    const counts = { waiting: 0, working: 0, done: 0, failed: 0 };
    for (const j of jobs) counts[j.state]++;
    const total = jobs.length;
    els.list.hidden = total === 0;
    els.empty.hidden = total !== 0;
    els.clear.hidden = total === 0;
    els.zip.disabled = counts.done === 0;
    els.zip.textContent = counts.done > 1 ? 'Download all ' + counts.done + ' (.zip)' : 'Download all (.zip)';

    if (!total) { els.summary.textContent = ''; return; }
    const parts = [counts.done + ' of ' + total + ' done'];
    if (counts.working) parts.push(counts.working + ' converting');
    if (counts.waiting) parts.push(counts.waiting + ' waiting');
    if (counts.failed) parts.push(counts.failed + ' failed');
    els.summary.textContent = parts.join(', ');
  }

  function releaseUrls(job) {
    if (job.thumbUrl) URL.revokeObjectURL(job.thumbUrl);
    if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
  }

  function removeJob(job) {
    job.removed = true;
    queue.remove(job);
    releaseUrls(job);
    job.row.remove();
    jobs.splice(jobs.indexOf(job), 1);
    renderSummary();
  }

  function retryJob(job) {
    job.state = 'waiting';
    job.error = null;
    job.progress = 0;
    render(job);
    renderSummary();
    queue.add(job);
  }

  async function downloadZip() {
    const done = jobs.filter((j) => j.state === 'done');
    if (!done.length) return;
    els.zip.disabled = true;
    els.zip.textContent = 'Preparing .zip…';
    try {
      const taken = new Set();
      const entries = [];
      for (const job of done) {
        entries.push({
          name: uniqueName(job.outName, taken),
          data: new Uint8Array(await job.result.arrayBuffer()),
        });
      }
      const zip = new Blob([buildZip(entries)], { type: 'application/zip' });
      const url = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pixora-converted.zip';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.warn('zip failed', err);
      renderSummary();
      els.summary.textContent = "Couldn't build the .zip. You can still download each image on its own.";
      return;
    }
    renderSummary();
  }

  function clearList() {
    for (const job of jobs.slice()) removeJob(job);
  }

  $('choose-btn').addEventListener('click', () => els.input.click());
  els.input.addEventListener('change', () => {
    if (els.input.files && els.input.files.length) addFiles(els.input.files);
    els.input.value = '';
  });

  // Drag and drop: on the drop zone, and anywhere on the page so a near miss
  // doesn't make the browser open the image instead.
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  document.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    dragDepth++;
    els.drop.classList.add('border-accent');
  });
  document.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) els.drop.classList.remove('border-accent');
  });
  document.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    els.drop.classList.remove('border-accent');
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  els.zip.addEventListener('click', downloadZip);
  els.clear.addEventListener('click', clearList);

  renderSummary();
})();
