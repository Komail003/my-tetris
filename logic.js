// logic.js — responsive + touch-ready version (replace your old file)

const COLS = 10,
  ROWS = 20;
let CELL = 30;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// helper must exist early
function createMatrix(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

// initialize critical game state BEFORE any drawing/resizing runs
let grid = createMatrix(COLS, ROWS);
let piece = null; // declared and initialized (null) before resize/draw calls
let dropCounter = 0;
let dropInterval = 800;
let lastTime = 0;
let running = false,
  paused = false,
  gameOver = false;
let score = 0,
  lines = 0,
  level = 1;

function cloneMatrix(m) {
  return m.map((r) => r.slice());
}

const tetrominoes = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};
const keys = Object.keys(tetrominoes);

function rotateMatrix(m, dir = 1) {
  const h = m.length,
    w = m[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (dir > 0) out[x][h - 1 - y] = m[y][x];
      else out[w - 1 - x][y] = m[y][x];
    }
  return out;
}

function collide(matrix, pos) {
  for (let y = 0; y < matrix.length; y++)
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const px = pos.x + x,
        py = pos.y + y;
      if (px < 0 || px >= COLS || py >= ROWS) return true;
      if (py < 0) continue;
      if (grid[py][px]) return true;
    }
  return false;
}

function merge(matrix, pos) {
  for (let y = 0; y < matrix.length; y++)
    for (let x = 0; x < matrix[y].length; x++) {
      if (matrix[y][x]) {
        const px = pos.x + x,
          py = pos.y + y;
        if (py >= 0 && py < ROWS && px >= 0 && px < COLS) grid[py][px] = 1;
      }
    }
}

function clearLines() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) if (!grid[y][x]) continue outer;
    grid.splice(y, 1);
    grid.unshift(Array(COLS).fill(0));
    cleared++;
    y++;
  }
  if (cleared) {
    const scores = [0, 100, 300, 500, 800];
    score += (scores[cleared] || cleared * 500) * level;
    lines += cleared;
    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel > level) {
      level = newLevel;
      dropInterval = Math.max(120, dropInterval - 80);
    }
    updateHUD();
  }
}

function updateHUD() {
  const s = document.getElementById("score");
  const l = document.getElementById("lines");
  const lv = document.getElementById("level");
  if (s) s.textContent = score;
  if (l) l.textContent = lines;
  if (lv) lv.textContent = level;
}

function resetPiece() {
  const type = keys[Math.floor(Math.random() * keys.length)];
  const matrix = cloneMatrix(tetrominoes[type]);

  // spawn at top row 0 so collision is immediate if top blocked
  const x = Math.floor(COLS / 2 - matrix[0].length / 2);
  const y = 0;
  piece = { matrix, pos: { x, y }, type };

  if (collide(piece.matrix, piece.pos)) {
    running = false;
    gameOver = true;
    // draw overlay immediately
    draw();

    return;
  }
  drawNext();
}

function playerDrop() {
  piece.pos.y++;
  if (collide(piece.matrix, piece.pos)) {
    piece.pos.y--;
    merge(piece.matrix, piece.pos);
    clearLines();
    resetPiece();
  }
  dropCounter = 0;
}
function hardDrop() {
  while (!collide(piece.matrix, { x: piece.pos.x, y: piece.pos.y + 1 })) {
    piece.pos.y++;
  }
  merge(piece.matrix, piece.pos);
  clearLines();
  resetPiece();
  dropCounter = 0;
}
function playerMove(dir) {
  piece.pos.x += dir;
  if (collide(piece.matrix, piece.pos)) piece.pos.x -= dir;
}
function playerRotate(dir = 1) {
  const rotated = rotateMatrix(piece.matrix, dir);
  const oldX = piece.pos.x;
  piece.matrix = rotated;
  let kicked = false;
  const shifts = [0, -1, 1, -2, 2];
  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    piece.pos.x = oldX + shift;
    if (!collide(piece.matrix, piece.pos)) {
      kicked = true;
      break;
    }
  }
  if (!kicked) {
    piece.matrix = rotateMatrix(rotated, -dir);
    piece.pos.x = oldX;
  }
}

function drawGrid() {
  ctx.fillStyle = "#031024";
  ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) if (grid[y][x]) drawCell(x, y, "#f5d76e");
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, ROWS * CELL);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(COLS * CELL, y * CELL + 0.5);
    ctx.stroke();
  }
}
function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
}
function drawPiece() {
  if (!piece) return;
  const mat = piece.matrix;
  for (let y = 0; y < mat.length; y++)
    for (let x = 0; x < mat[y].length; x++)
      if (mat[y][x]) {
        const px = piece.pos.x + x;
        const py = piece.pos.y + y;
        if (py >= 0) drawCell(px, py, "#7ee0ff");
      }
}

const nextCvs = document.getElementById("next");
const nctx = nextCvs.getContext("2d");
function drawNext() {
  nctx.clearRect(0, 0, nextCvs.width, nextCvs.height);
  const mat =
    tetrominoes[
      typeof piece === "object" && piece.type
        ? piece.type
        : keys[Math.floor(Math.random() * keys.length)]
    ];
  const cw = nextCvs.width / 4;
  nctx.fillStyle = "#031424";
  nctx.fillRect(0, 0, nextCvs.width, nextCvs.height);
  for (let y = 0; y < mat.length; y++)
    for (let x = 0; x < mat[0].length; x++)
      if (mat[y][x]) {
        const dx = Math.floor((4 - mat[0].length) / 2) + x;
        const dy = Math.floor((4 - mat.length) / 2) + y;
        nctx.fillStyle = "#7ee0ff";
        nctx.fillRect(dx * cw + 6, dy * cw + 6, cw - 12, cw - 12);
      }
}

function draw() {
  drawGrid();
  drawPiece();
  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.fillStyle = "#bfefff";
    ctx.font = "bold 26px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", (COLS * CELL) / 2, (ROWS * CELL) / 2 - 10);
  }
}

function update(time = 0) {
  // always update lastTime so delta calculation stays sane
  if (!lastTime) lastTime = time;
  // draw overlay even when not running so GAME OVER remains visible
  if (!running) {
    lastTime = time;
    draw();
    requestAnimationFrame(update);
    return;
  }
  if (paused) {
    lastTime = time;
    draw();
    requestAnimationFrame(update);
    return;
  }
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) {
    if (piece) playerDrop();
    dropCounter = 0;
  }
  draw();
  requestAnimationFrame(update);
}

/* ----------------- input ----------------- */
document.addEventListener("keydown", (e) => {
  if (!piece || gameOver) {
    if (e.key.toLowerCase() === "p") paused = !paused;
    return;
  }
  if (e.key === "ArrowLeft") playerMove(-1);
  else if (e.key === "ArrowRight") playerMove(1);
  else if (e.key === "ArrowDown") playerDrop();
  else if (e.key === " ") {
    e.preventDefault();
    hardDrop();
  } else if (e.key === "z" || e.key === "Z") playerRotate(-1);
  else if (e.key === "x" || e.key === "X" || e.key === "ArrowUp")
    playerRotate(1);
  else if (e.key.toLowerCase() === "p") paused = !paused;
});

/* ----------------- buttons ----------------- */
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");

if (startBtn)
  startBtn.onclick = () => {
    if (!running) {
      running = true;
      paused = false;
      gameOver = false;
      if (!piece) resetPiece();
      lastTime = performance.now();
      requestAnimationFrame(update);
    }
  };
if (pauseBtn)
  pauseBtn.onclick = () => {
    paused = !paused;
    // draw immediately to show pause state
    draw();
  };
if (restartBtn)
  restartBtn.onclick = () => {
    grid = createMatrix(COLS, ROWS);
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 800;
    updateHUD();
    gameOver = false;
    running = true;
    resetPiece();
    lastTime = performance.now();
    requestAnimationFrame(update);
  };

updateHUD();
resetPiece();

/* ----------------- responsive/resizing (improved) ----------------- */
function resizeCanvas() {
  // Max available space (both width and height) for the canvas
  const maxWidth = Math.floor(window.innerWidth * 0.94);
  const maxHeight = Math.floor(window.innerHeight * 0.72);

  // Choose target pixel height for canvas area (prefer height but cap by width)
  const targetPixelHeight = Math.min(maxWidth, maxHeight);

  // keep CELL sensible on very small screens
  const minCell = 16;
  CELL = Math.max(minCell, Math.floor(targetPixelHeight / ROWS));

  const dpr = window.devicePixelRatio || 1;

  // set CSS visual size (keeps canvas responsive in layout)
  canvas.style.width = COLS * CELL + "px";
  canvas.style.height = ROWS * CELL + "px";

  // set actual backing store size for crisp rendering
  canvas.width = COLS * CELL * dpr;
  canvas.height = ROWS * CELL * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // next preview size (scale down on narrow screens)
  const previewSize = Math.min(120, Math.floor(window.innerWidth * 0.22));
  nextCvs.width = previewSize * dpr;
  nextCvs.height = previewSize * dpr;
  nextCvs.style.width = previewSize + "px";
  nextCvs.style.height = previewSize + "px";
  nctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // reposition touch-controls if present (small nudge)
  const tc = document.getElementById("touchControls");
  if (tc) {
    tc.style.bottom = Math.max(8, Math.floor(window.innerHeight * 0.02)) + "px";
  }

  draw();
  drawNext();
}
window.addEventListener("resize", resizeCanvas);

/* ----------------- touch & mobile controls ----------------- */
function setupTouchControls() {
  const btnLeft = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");
  const btnDown = document.getElementById("btnDown");
  const btnRotate = document.getElementById("btnRotate");
  const btnHard = document.getElementById("btnHard");

  if (btnLeft)
    btnLeft.addEventListener("touchstart", (e) => {
      e.preventDefault();
      playerMove(-1);
    });
  if (btnRight)
    btnRight.addEventListener("touchstart", (e) => {
      e.preventDefault();
      playerMove(1);
    });
  if (btnDown)
    btnDown.addEventListener("touchstart", (e) => {
      e.preventDefault();
      playerDrop();
    });
  if (btnRotate)
    btnRotate.addEventListener("touchstart", (e) => {
      e.preventDefault();
      playerRotate(1);
    });
  if (btnHard)
    btnHard.addEventListener("touchstart", (e) => {
      e.preventDefault();
      hardDrop();
    });

  // mouse fallback for small-screen desktop use
  [btnLeft, btnRight, btnDown, btnRotate, btnHard].forEach((b) => {
    if (!b) return;
    b.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      b.dispatchEvent(new Event("touchstart"));
    });
  });

  // Simple swipe / tap detection on canvas
  let startX = 0,
    startY = 0,
    startTime = 0;
  let lastTap = 0;

  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const t = e.changedTouches[0];
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startTime;
      const absX = Math.abs(dx),
        absY = Math.abs(dy);

      // horizontal swipe -> move
      if (absX > 40 && absX > absY) {
        if (dx > 0) playerMove(1);
        else playerMove(-1);
        return;
      }

      // vertical swipe down -> soft drop
      if (absY > 40 && absY > absX && dy > 0) {
        playerDrop();
        return;
      }

      // tap: rotate; double-tap: hard drop
      if (absX < 12 && absY < 12 && dt < 300) {
        const now = Date.now();
        if (now - lastTap < 300) {
          hardDrop();
          lastTap = 0;
        } else {
          playerRotate(1);
          lastTap = now;
        }
      }
    },
    { passive: true }
  );

  // prevent page scrolling while interacting
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches && e.touches.length > 1) return;
      e.preventDefault();
    },
    { passive: false }
  );
}

// run setup on load
window.addEventListener("load", () => {
  setupTouchControls();
  resizeCanvas();
  requestAnimationFrame(update);
});

// initial sizing & loop start
resizeCanvas();
requestAnimationFrame(update);
