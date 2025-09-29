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

// --- New: Apply to all duration ---
const applyAllInput = document.getElementById('apply-all-duration');
const applyAllBtn = document.getElementById('apply-all-btn');

// frames: { id, file, name, duration(ms), imgBitmap }
let frames = [];
let playing = false;
let playIndex = 0;

// multi-select state
let selectedItems = new Set();
let draggedItems = [];
let placeholder = null;

// --- Helpers ---
function uid() { return Math.random().toString(36).slice(2,9); }

function bytesToSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes)/Math.log(k));
  return parseFloat((bytes / Math.pow(k,i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(s) {
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

function removeFrame(id) {
  frames = frames.filter(f => f.id !== id);
  selectedItems.delete(id);
  renderFramesList();
  if (!frames.length) clearCanvas();
}

const removeAllBtn = document.getElementById('remove-all-btn');

removeAllBtn.addEventListener('click', () => {
  if (!frames.length) return;
  const confirmed = confirm('Are you sure you want to remove all frames? This cannot be undone.');
  if (!confirmed) return;

  frames = [];
  selectedItems.clear();
  renderFramesList();
  clearCanvas();
});


// --- Render frames list ---
function renderFramesList() {
  framesList.innerHTML = '';
  frames.forEach((f, idx) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.id = f.id;
    li.className = 'frame-item bg-white border rounded p-2 flex items-center gap-3 cursor-grab select-none';
    if (selectedItems.has(f.id)) li.classList.add('selected');

    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f.file);
    img.alt = f.name;
    img.className = 'w-full h-full object-cover';
    thumbnail.appendChild(img);

    // Meta
    const meta = document.createElement('div');
    meta.className = 'flex-1';
    meta.innerHTML = `<div class="text-sm font-medium truncate">${escapeHtml(f.name)}</div>
    <div class="text-xs text-gray-500">${bytesToSize(f.file.size)}</div>`;

    // Controls
    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-2';

    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.min = 10;
    durationInput.value = f.duration;
    durationInput.title = 'Duration in ms';
    durationInput.className = 'w-20 text-sm border rounded px-2 py-1';
    durationInput.addEventListener('change', () => f.duration = Math.max(10, parseInt(durationInput.value) || 100));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'px-2 py-1 text-xs text-red-600';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', ev => { ev.stopPropagation(); removeFrame(f.id); });

    controls.append(durationInput, removeBtn);
    li.append(thumbnail, meta, controls);
    framesList.appendChild(li);
    framesList.classList.add("mt-3");

    // --- Events for selection & drag ---
    li.addEventListener('click', e => handleSelectClick(e, li, f.id));
    li.addEventListener('dragstart', e => handleDragStart(e, li));
    li.addEventListener('dragover', e => e.preventDefault());
    li.addEventListener('drop', e => e.preventDefault());
  });
}

// --- Selection & Drag helpers ---
function handleSelectClick(e, li, id) {
  if (e.shiftKey) {
    if (selectedItems.has(id)) {
      selectedItems.delete(id);
      li.classList.remove('selected');
    } else {
      selectedItems.add(id);
      li.classList.add('selected');
    }
  } else {
    selectedItems.forEach(sel => document.querySelector(`li[data-id="${sel}"]`)?.classList.remove('selected'));
    selectedItems.clear();
    selectedItems.add(id);
    li.classList.add('selected');
  }
  drawFrameOnCanvas(frames.find(f => f.id === id));
}

function handleDragStart(e, li) {
  if (e.shiftKey) return;

  const id = li.dataset.id;
  if (!selectedItems.has(id)) {
    selectedItems.forEach(sel => document.querySelector(`li[data-id="${sel}"]`)?.classList.remove('selected'));
    selectedItems.clear();
    selectedItems.add(id);
    li.classList.add('selected');
  }

  draggedItems = Array.from(selectedItems).map(selId => document.querySelector(`li[data-id="${selId}"]`));

  placeholder = document.createElement('li');
  placeholder.className = 'frame-item border-2 border-dashed border-blue-400 h-12 rounded';
  li.parentNode.insertBefore(placeholder, li);

  draggedItems.forEach(item => item.style.display = 'none');
  e.dataTransfer.effectAllowed = 'move';
}

// Drag over / drop
framesList.addEventListener('dragover', e => {
  e.preventDefault();
  const li = e.target.closest('.frame-item');
  if (!li || draggedItems.includes(li) || li === placeholder) return;

  const rect = li.getBoundingClientRect();
  const next = (e.clientY - rect.top) / rect.height > 0.5;
  framesList.insertBefore(placeholder, next ? li.nextSibling : li);
});

framesList.addEventListener('drop', e => {
  e.preventDefault();
  if (!placeholder) return;

  draggedItems.forEach(item => { item.style.display = ''; framesList.insertBefore(item, placeholder); });
  placeholder.remove();
  placeholder = null;
  draggedItems = [];

  syncFramesFromDOM();
});

framesList.addEventListener('dragend', () => {
  if (placeholder) placeholder.remove();
  draggedItems.forEach(item => item.style.display = '');
  placeholder = null;
  draggedItems = [];
});

// sync frames array with DOM order
function syncFramesFromDOM() {
  const newOrder = [];
  framesList.querySelectorAll('.frame-item').forEach(li => {
    const f = frames.find(fr => fr.id === li.dataset.id);
    if (f) newOrder.push(f);
  });
  frames = newOrder;
}

// --- Frame / Canvas ---
async function drawFrameOnCanvas(frame) {
  const w = Math.round(previewCanvas.width * parseFloat(scaleSelect.value));
  const h = Math.round(previewCanvas.height * parseFloat(scaleSelect.value));
  const imgBitmap = frame.imgBitmap || await createImageBitmap(frame.file);
  frame.imgBitmap = imgBitmap;

  ctx.fillStyle = bgColorInput.value;
  ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  const ratio = Math.min(previewCanvas.width / imgBitmap.width, previewCanvas.height / imgBitmap.height);
  const dw = imgBitmap.width * ratio;
  const dh = imgBitmap.height * ratio;
  const dx = (previewCanvas.width - dw)/2;
  const dy = (previewCanvas.height - dh)/2;
  ctx.drawImage(imgBitmap, dx, dy, dw, dh);
  frameInfo.textContent = `${frames.indexOf(frame)+1} / ${frames.length}: ${frame.name} — ${frame.duration} ms`;
}

function clearCanvas() {
  ctx.fillStyle = bgColorInput.value;
  ctx.fillRect(0,0,previewCanvas.width, previewCanvas.height);
  frameInfo.textContent = 'No frames';
}

// --- Play / Stop ---
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
    playIndex = (playIndex + 1) % frames.length;
  }
  playBtn.disabled = false;
  stopBtn.disabled = true;
}

function stop() { playing = false; }
function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

// --- GIF export ---
async function exportGIF() {
  if (!frames.length) { alert('No frames to export'); return; }

  progress.classList.remove('hidden');
  progressBar.style.width = '0%';
  progressText.textContent = 'Preparing...';

  const scale = parseFloat(scaleSelect.value) || 1;
  const outW = Math.round(previewCanvas.width * scale);
  const outH = Math.round(previewCanvas.height * scale);

  const gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: 'export-to-gif.js',
    width: outW,
    height: outH,
    repeat: 0
  });

  for (let i=0; i<frames.length; i++) {
    progressText.textContent = `Rasterizing frame ${i+1} / ${frames.length}`;
    const f = frames[i];
    f.imgBitmap = f.imgBitmap || await createImageBitmap(f.file);

    const tmp = document.createElement('canvas');
    tmp.width = outW; tmp.height = outH;
    const tctx = tmp.getContext('2d');

    tctx.fillStyle = bgColorInput.value; tctx.fillRect(0,0,outW,outH);
    const ratio = Math.min(outW / f.imgBitmap.width, outH / f.imgBitmap.height);
    const dw = f.imgBitmap.width * ratio;
    const dh = f.imgBitmap.height * ratio;
    const dx = (outW - dw)/2; const dy = (outH - dh)/2;
    tctx.drawImage(f.imgBitmap, dx, dy, dw, dh);

    gif.addFrame(tctx, {copy:true, delay:f.duration});
    await new Promise(r => setTimeout(r, 10));
  }

  gif.on('progress', p => {
    const percent = Math.round(p*100);
    progressBar.style.width = percent+'%';
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

// --- File handling ---
async function addFiles(fileList) {
  const imageFiles = fileList.filter(f => f.type.startsWith('image/'));
  if (!imageFiles.length) return;
  for (const file of imageFiles) frames.push({id: uid(), file, name:file.name, duration:300, imgBitmap:null});
  renderFramesList();
  if (frames.length) await drawFrameOnCanvas(frames[0]);
}

// --- Apply to all logic ---
applyAllBtn.addEventListener('click', () => {
  const val = Math.max(10, parseInt(applyAllInput.value) || 10);
  frames.forEach(f => f.duration = val);
  renderFramesList();
});

// --- Events ---
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('ring-2','ring-indigo-300'); });
dropzone.addEventListener('dragleave', e => { dropzone.classList.remove('ring-2','ring-indigo-300'); });
dropzone.addEventListener('drop', async e => {
  e.preventDefault(); dropzone.classList.remove('ring-2','ring-indigo-300');
  await addFiles(Array.from(e.dataTransfer.files || []));
});
fileInput.addEventListener('change', async e => { await addFiles(Array.from(e.target.files || [])); fileInput.value=''; });

playBtn.addEventListener('click', () => { if(!playing) play(); });
stopBtn.addEventListener('click', () => stop());
stopBtn.disabled = true;

exportBtn.addEventListener('click', () => exportGIF());
bgColorInput.addEventListener('change', () => { if(!playing) clearCanvas(); });

// --- Keyboard ---
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (playing) stop(); else play();
  }
});

// --- Initialize ---
function initCanvas() {
  previewCanvas.width = 600;
  previewCanvas.height = 1100;
  clearCanvas();
}
initCanvas();
