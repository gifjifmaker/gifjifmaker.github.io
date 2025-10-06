// --- Utility state ---
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const framesList = document.getElementById('frames-list');
const removeAllBtn = document.getElementById('remove-all-btn');
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
const scaleSelect = document.getElementById('scale');

const applyAllInput = document.getElementById('apply-all-duration');
const applyAllBtn = document.getElementById('apply-all-btn');

const focusBtn = document.getElementById('focus-preview-btn');
const bgColor = document.getElementById('bg-color');
const durationInput = document.getElementById('apply-all-duration');
const body = document.body;

const toggleBtn = document.getElementById('toggleOrientationBtn');
const info = document.getElementById('info');
const previewContainer = document.getElementById('preview-container');
const collapseBtn = document.getElementById('collapseBtn');


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

    // Only truncate if the element will have the 'truncate' class
    let displayName = f.name;
    if (displayName.length > 40) {
      displayName = displayName.slice(0, 37) + '...';
    }

    meta.innerHTML = `<div class="text-sm font-medium truncate" title="${escapeHtml(f.name)}">${escapeHtml(displayName)}</div>
    <div class="text-xs text-gray-500">${bytesToSize(f.file.size)}</div>`;

    // Controls
    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-2';

    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.min = 1;
    durationInput.value = f.duration;
    durationInput.title = 'Duration in ms';
    durationInput.className = 'w-20 text-sm border rounded px-2 py-1';
    durationInput.addEventListener('change', () => f.duration = Math.max(1, parseInt(durationInput.value) || 100));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'px-2 py-1 text-xs text-red-600';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', ev => { ev.stopPropagation(); removeFrame(f.id); });

    controls.append(durationInput, removeBtn);
    li.append(thumbnail, meta, controls);
    framesList.appendChild(li);
    framesList.classList.add("mt-1.5", "pb-16");

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
  if (!frame) return;

  const w = Math.round(previewCanvas.width * parseFloat(scaleSelect.value));
  const h = Math.round(previewCanvas.height * parseFloat(scaleSelect.value));
  const imgBitmap = frame.imgBitmap || await createImageBitmap(frame.file);

  ctx.fillStyle = bgColorInput.value;
  ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  const ratio = Math.min(previewCanvas.width / imgBitmap.width, previewCanvas.height / imgBitmap.height);
  const dw = imgBitmap.width * ratio;
  const dh = imgBitmap.height * ratio;
  const dx = (previewCanvas.width - dw)/2;
  const dy = (previewCanvas.height - dh)/2;
  ctx.drawImage(imgBitmap, dx, dy, dw, dh);

  let frameInfoName = frame.name;
    if (frame.name.length > 20) {
      frameInfoName = frame.name.slice(0, 17) + '...';
    }

  frameInfo.textContent = `${frames.indexOf(frame)+1} / ${frames.length} - ${frame.duration} ms : ${frameInfoName}`;
}

function clearCanvas() {
  ctx.fillStyle = bgColorInput.value;
  ctx.fillRect(0,0,previewCanvas.width, previewCanvas.height);
  frameInfo.textContent = 'No frames';
}


async function play() {
  if (!frames.length) return;
  playing = true;

  // Toggle icons
  playBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');

  playIndex = 0;
  while (playing) {
    const f = frames[playIndex];
    await drawFrameOnCanvas(f);
    await wait(f.duration);
    playIndex = (playIndex + 1) % frames.length;
  }

  // Reset icons when stopped
  playBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
}

function stop() {
  playing = false;
  playBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// --- Event listeners ---
playBtn.addEventListener('click', play);
stopBtn.addEventListener('click', stop);



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
  const val = Math.max(1, parseInt(applyAllInput.value) || 1);
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

bgColorInput.addEventListener('input', () => {  // was 'change'
  if (!playing) clearCanvas();
});


// --- Keyboard ---
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (playing) stop(); else play();
  }
});



let isPortrait = true;
let isCollapsed = false;

function updateCollapseButton() {
  // Update collapseBtn content depending on state
  collapseBtn.innerHTML = isCollapsed
    ? `
      <button class="px-3 py-2">
        <img title="Click to expand panel" src="collapse.webp" alt="expand icon" class="h-6 w-6 rotate-180">
      </button>
    `
    : `
      <button class="px-3 py-2">
        <img title="Click to collapse panel" src="collapse.webp" alt="collapse icon" class="h-6 w-6">
      </button>
    `;
}

function toggleInfo() {
  if (isPortrait) return; // only works in landscape mode

  // Toggle visibility
  info.classList.toggle('hidden');
  previewContainer.classList.toggle('col-span-2');
  previewContainer.classList.toggle('col-span-3');

  // Update state + button icon
  isCollapsed = !isCollapsed;
  updateCollapseButton();
}

toggleBtn.addEventListener('click', () => {
  const ctx = previewCanvas.getContext('2d');

  if (isPortrait) {
    // Switch to landscape
    previewCanvas.width = 1100;
    previewCanvas.height = 600;
    toggleBtn.textContent = 'Switch to Portrait';

    collapseBtn.classList.remove('hidden');
    collapseBtn.classList.add('flex');
    updateCollapseButton();
  } else {
    // Switch to portrait
    previewCanvas.width = 600;
    previewCanvas.height = 1100;
    toggleBtn.textContent = 'Switch to Landscape';

    // Ensure info panel is visible again when returning to portrait
    info.classList.remove('hidden');
    previewContainer.classList.remove('col-span-3');
    previewContainer.classList.add('col-span-2');

    collapseBtn.classList.remove('flex');
    collapseBtn.classList.add('hidden');
    isCollapsed = false;
  }

  // Optional: clear or refresh
  ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  isPortrait = !isPortrait;
});

// Delegate click event for collapse/expand button
collapseBtn.addEventListener('click', toggleInfo);



// --- Initialize ---
function initCanvas() {
  previewCanvas.width = 600;
  previewCanvas.height = 1100;
  clearCanvas();
}
initCanvas();


function toggleFocusMode(force = null) {
  const isActive =
    force === null
      ? body.classList.toggle('focus-mode')
      : (force
          ? body.classList.add('focus-mode')
          : body.classList.remove('focus-mode'),
        force);

  // Hide or show elements
  bgColor.classList.toggle('hidden', isActive);
  removeAllBtn.classList.toggle('hidden', isActive);

  // Respect current play state
  if (isActive) {
    // In focus mode — hide both buttons
    playBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');
  } else {
    // Leaving focus mode — show only the correct one
    if (playing) {
      playBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      playBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
    }
  }

  // Hide all inputs except file selector
  document.querySelectorAll('input').forEach(input => {
    if (input.id === 'file-input') return;
    input.classList.toggle('hidden', isActive);
  });

  // Remove border on the focus button when active
  const focusBtn = document.getElementById('focus-preview-btn');
  focusBtn.classList.toggle('border', !isActive);
  focusBtn.classList.toggle('mt-[13px]', isActive);
}


// Focus button click
focusBtn.addEventListener('click', () => toggleFocusMode());

// Exit focus mode when clicking anywhere (except the canvas or button)
document.addEventListener('click', e => {
  if (!body.classList.contains('focus-mode')) return;

  const canvas = document.getElementById('preview-canvas');
  if (e.target === canvas || e.target === focusBtn) return;

  toggleFocusMode(false);
});

// ESC key listener
document.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    toggleFocusMode(false);
  }
});
