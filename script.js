  // --- Utility state ---
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const framesList = document.getElementById('frames-list');
  const playBtn = document.getElementById('play-btn');
  const stopBtn = document.getElementById('stop-btn');
  const exportBtn = document.getElementById('export-btn');
  const previewCanvas = document.getElementById('preview-canvas');
  const ctx = previewCanvas.getContext('2d');
  const frameInfo = document.getElementById('frame-info');
  const bgColorInput = document.getElementById('bg-color');
  const progress = document.getElementById('progress');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const fpsLabel = document.getElementById('fps-label');
  const scaleSelect = document.getElementById('scale');

  // frames: { id, file, name, duration(ms), imgBitmap }
  let frames = [];
  let playing = false;
  let playIndex = 0;
  let playTimer = null;

  // --- Helpers ---
  function uid() { return Math.random().toString(36).slice(2,9); }

  function bytesToSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024; const sizes = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes)/Math.log(k));
    return parseFloat((bytes / Math.pow(k,i)).toFixed(2)) + ' ' + sizes[i];
  }

  // render the left list
  function renderFramesList() {
    framesList.innerHTML = '';
    frames.forEach((f, idx) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.id = f.id;
          li.className = 'bg-white border rounded p-2 flex items-center gap-3 cursor-grab';

    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', f.id);
      li.classList.add('opacity-50', 'cursor-grabbing');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('opacity-50', 'cursor-grabbing');
    });


      li.addEventListener('click', () => {
        // show this frame on preview immediately
        drawFrameOnCanvas(f);
        frameInfo.textContent = `${idx+1} / ${frames.length}: ${f.name} — ${f.duration} ms`;
      });

      li.addEventListener('dragover', e => e.preventDefault());
      li.addEventListener('drop', e => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        reorderFrames(sourceId, f.id);
      });

      const thumbnail = document.createElement('div');
      thumbnail.className = 'w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0';
      const img = document.createElement('img');
      img.alt = f.name;
      img.className = 'w-full h-full object-cover';
      img.src = URL.createObjectURL(f.file);
      thumbnail.appendChild(img);

      const meta = document.createElement('div');
      meta.className = 'flex-1';
      meta.innerHTML = `<div class="text-sm font-medium truncate">${escapeHtml(f.name)}</div>
                        <div class="text-xs text-gray-500">${bytesToSize(f.file.size)}</div>`;

      const controls = document.createElement('div');
      controls.className = 'flex items-center gap-2';

      const durationInput = document.createElement('input');
      durationInput.type = 'number';
      durationInput.min = 50;
      durationInput.value = f.duration;
      durationInput.title = 'Duration in ms';
      durationInput.className = 'w-20 text-sm border rounded px-2 py-1';
      durationInput.addEventListener('change', () => {
        f.duration = Math.max(50, parseInt(durationInput.value) || 100);
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'px-2 py-1 text-xs text-red-600';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeFrame(f.id);
      });

      controls.appendChild(durationInput);
      controls.appendChild(removeBtn);

      li.appendChild(thumbnail);
      li.appendChild(meta);
      li.appendChild(controls);

      framesList.appendChild(li);
      framesList.classList.add('mt-4');
    });
  }

  function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  // reorder logic: move source before target
  function reorderFrames(sourceId, targetId) {
    const sourceIndex = frames.findIndex(f => f.id === sourceId);
    const targetIndex = frames.findIndex(f => f.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const [item] = frames.splice(sourceIndex,1);
    frames.splice(targetIndex,0,item);
    renderFramesList();
  }

  function removeFrame(id) {
    frames = frames.filter(f => f.id !== id);
    renderFramesList();
    if (frames.length === 0) clearCanvas();
  }

  // draw a frame (imageBitmap or file)
  async function drawFrameOnCanvas(frame) {
    const w = Math.round(previewCanvas.width * parseFloat(scaleSelect.value));
    const h = Math.round(previewCanvas.height * parseFloat(scaleSelect.value));

    // fit image preserving aspect
    const imgBitmap = frame.imgBitmap || await createImageBitmap(frame.file);
    frame.imgBitmap = imgBitmap;

    // clear with background
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0,0,previewCanvas.width, previewCanvas.height);

    // compute draw size
    const ratio = Math.min(previewCanvas.width / imgBitmap.width, previewCanvas.height / imgBitmap.height);
    const dw = imgBitmap.width * ratio;
    const dh = imgBitmap.height * ratio;
    const dx = (previewCanvas.width - dw) / 2;
    const dy = (previewCanvas.height - dh) / 2;
    ctx.drawImage(imgBitmap, dx, dy, dw, dh);
    frameInfo.textContent = `${frames.indexOf(frame)+1} / ${frames.length}: ${frame.name} — ${frame.duration} ms`;
  }

  function clearCanvas(){
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0,0,previewCanvas.width, previewCanvas.height);
    frameInfo.textContent = 'No frames';
  }

  // playing animation
  async function play() {
    if (!frames.length) return;
    playing = true;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    playIndex = 0;
    fpsLabel.textContent = 'variable';

    while (playing) {
      const f = frames[playIndex];
      await drawFrameOnCanvas(f);
      await wait(f.duration);
      playIndex = (playIndex + 1) % frames.length; // loop infinitely
    }
    playBtn.disabled = false;
    stopBtn.disabled = true;
  }

  function stop() {
    playing = false;
  }

  function wait(ms){ return new Promise(res => setTimeout(res, ms)); }

  // export GIF using gif.js
  async function exportGIF() {
    if (!frames.length) { alert('No frames to export'); return; }

    progress.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = 'Preparing...';

    const scale = parseFloat(scaleSelect.value) || 1;
    const outW = Math.round(previewCanvas.width * scale);
    const outH = Math.round(previewCanvas.height * scale);

    const gif = new GIF({ workers: 2, quality: 10, workerScript: 'export-to-gif.js', width: outW, height: outH, repeat: 0 });

    // add frames
    for (let i = 0; i < frames.length; i++) {
      progressText.textContent = `Rasterizing frame ${i+1} / ${frames.length}`;
      const f = frames[i];
      const imgBitmap = f.imgBitmap || await createImageBitmap(f.file);
      f.imgBitmap = imgBitmap;

      // draw onto a temporary canvas
      const tmp = document.createElement('canvas');
      tmp.width = outW; tmp.height = outH;
      const tctx = tmp.getContext('2d');
      // background
      tctx.fillStyle = bgColorInput.value; tctx.fillRect(0,0,outW,outH);

      // fit
      const ratio = Math.min(outW / imgBitmap.width, outH / imgBitmap.height);
      const dw = imgBitmap.width * ratio;
      const dh = imgBitmap.height * ratio;
      const dx = (outW - dw)/2; const dy = (outH - dh)/2;
      tctx.drawImage(imgBitmap, dx, dy, dw, dh);

      gif.addFrame(tctx, {copy: true, delay: f.duration});
      // small throttle so UI updates
      await new Promise(r => setTimeout(r, 10));
    }

    gif.on('progress', p => {
      const percent = Math.round(p * 100);
      progressBar.style.width = percent + '%';
      progressText.textContent = `Encoding GIF — ${percent}%`;
    });

    gif.on('finished', blob => {
      progressText.textContent = 'Done! Preparing download...';
      progressBar.style.width = '100%';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export.gif';
      a.click();
      progress.classList.add('hidden');
    });

    gif.render();
  }

  // --- events ---
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('ring-2','ring-indigo-300'); });
  dropzone.addEventListener('dragleave', e => { dropzone.classList.remove('ring-2','ring-indigo-300'); });
  dropzone.addEventListener('drop', async e => {
    e.preventDefault(); dropzone.classList.remove('ring-2','ring-indigo-300');
    const items = Array.from(e.dataTransfer.files || []);
    await addFiles(items);
  });

  fileInput.addEventListener('change', async (e) => { const files = Array.from(e.target.files || []); await addFiles(files); fileInput.value = ''; });

  playBtn.addEventListener('click', () => { if (!playing) play(); });
  stopBtn.addEventListener('click', () => stop());
  stopBtn.disabled = true;

  exportBtn.addEventListener('click', () => exportGIF());

  bgColorInput.addEventListener('change', () => { if (!playing) clearCanvas(); });

  // add files helper
  async function addFiles(fileList) {
    const imageFiles = fileList.filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    for (const file of imageFiles) {
      const f = { id: uid(), file, name: file.name, duration: 300, imgBitmap: null };
      frames.push(f);
    }
    renderFramesList();
    // preload first frame into canvas
    if (frames.length) {
      const first = frames[0];
      await drawFrameOnCanvas(first);
    }
  }

  // initialize canvas size based on viewport
  function initCanvas() {
    // choose a reasonable default size; user images will scale to fit
    previewCanvas.width = 600;
    previewCanvas.height = 1100;
    clearCanvas();
  }

  initCanvas();

  // small helper: if user drags file onto framesList to reorder, add dragover/drop to whole list
  framesList.addEventListener('dragover', e => e.preventDefault());

  // click-to-select last added
  // keyboard accessibility: allow Delete to remove selected frame (optional)


document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault(); // prevent page scroll
    if (playing) {
      stop();
    } else {
      play();
    }
  }
});
