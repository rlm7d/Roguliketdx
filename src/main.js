const SETTINGS_KEY = "ashwood-settings";
const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
};

const GameState = {
  MENU: "menu",
  RUN_MAP: "runMap",
  BATTLE: "battle",
  GAME_OVER: "gameOver",
};

const MAP_CONFIG = {
  cols: 16,
  rows: 10,
  path: [
    { x: 0, y: 5 },
    { x: 3, y: 5 },
    { x: 3, y: 2 },
    { x: 7, y: 2 },
    { x: 7, y: 7 },
    { x: 12, y: 7 },
    { x: 12, y: 4 },
    { x: 15, y: 4 },
  ],
};
const WAVE_DATA = [
  { count: 6, hp: 20, speed: 1.2, bounty: 4, spawnDelay: 0.7, damage: 5 },
  { count: 8, hp: 28, speed: 1.1, bounty: 5, spawnDelay: 0.6, damage: 6 },
  { count: 10, hp: 36, speed: 1.0, bounty: 6, spawnDelay: 0.5, damage: 7 },
];
const PATH_TILE_SET = new Set(
  MAP_CONFIG.path.map((point) => `${point.x},${point.y}`)
);

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const settingsDialog = document.querySelector("#settingsDialog");
const settingsButton = document.querySelector("#settingsButton");
const closeSettings = document.querySelector("#closeSettings");
const soundToggle = document.querySelector("#soundToggle");
const musicToggle = document.querySelector("#musicToggle");
const startRunButton = document.querySelector("#startRunButton");
const runStatus = document.querySelector("#runStatus");
const pauseButton = document.querySelector("#pauseButton");
const baseHpLabel = document.querySelector("#baseHp");
const goldLabel = document.querySelector("#gold");
const waveLabel = document.querySelector("#wave");
const actLabel = document.querySelector("#act");
const pauseOverlay = document.querySelector("#pauseOverlay");
const runMapStage = document.querySelector("#runMapStage");
const battlefieldStage = document.querySelector("#battlefieldStage");

const screens = {
  [GameState.MENU]: document.querySelector("#menuScreen"),
  [GameState.RUN_MAP]: document.querySelector("#runMapScreen"),
  [GameState.BATTLE]: document.querySelector("#battleScreen"),
  [GameState.GAME_OVER]: document.querySelector("#gameOverScreen"),
};

const enterBattleButton = document.querySelector("#enterBattleButton");
const returnToMenuButton = document.querySelector("#returnToMenuButton");
const backToMapButton = document.querySelector("#backToMapButton");
const endRunButton = document.querySelector("#endRunButton");
const restartButton = document.querySelector("#restartButton");
const startWaveButton = document.querySelector("#startWaveButton");
const waveStatus = document.querySelector("#waveStatus");

const FIXED_STEP = 1000 / 60;

let settings = loadSettings();
let lastFrameTime = 0;
let accumulator = 0;
let viewportSize = { width: 0, height: 0 };
let currentState = GameState.MENU;
let isPaused = false;
let demoPulse = 0;
let showPathDebug = true;
let battleState = createBattleState();

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (error) {
    console.warn("Failed to load settings", error);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applySettings() {
  soundToggle.checked = settings.sound;
  musicToggle.checked = settings.music;
}

function bindSettings() {
  settingsButton.addEventListener("click", () => {
    settingsDialog.showModal();
  });

  closeSettings.addEventListener("click", () => {
    settingsDialog.close();
  });

  soundToggle.addEventListener("change", (event) => {
    settings.sound = event.target.checked;
    saveSettings();
  });

  musicToggle.addEventListener("change", (event) => {
    settings.music = event.target.checked;
    saveSettings();
  });
}

function resizeCanvas() {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  viewportSize = { width, height };
}

function createBattleState() {
  return {
    baseHp: 100,
    gold: 120,
    waveIndex: 0,
    enemies: [],
    waveInProgress: false,
    spawnTimer: 0,
    spawnIndex: 0,
  };
}

function updateHud() {
  if (currentState === GameState.MENU) {
    baseHpLabel.textContent = "-";
    goldLabel.textContent = "-";
    waveLabel.textContent = "-";
    actLabel.textContent = "Menu";
  }

  if (currentState === GameState.RUN_MAP) {
    baseHpLabel.textContent = `${battleState.baseHp}%`;
    goldLabel.textContent = `${battleState.gold}`;
    waveLabel.textContent = `${battleState.waveIndex} / ${WAVE_DATA.length}`;
    actLabel.textContent = "Run Map";
  }

  if (currentState === GameState.BATTLE) {
    const currentWave = battleState.waveInProgress
      ? battleState.waveIndex + 1
      : battleState.waveIndex;
    baseHpLabel.textContent = `${battleState.baseHp}%`;
    goldLabel.textContent = `${battleState.gold}`;
    waveLabel.textContent = `${currentWave} / ${WAVE_DATA.length}`;
    actLabel.textContent = "Battle";
  }

  if (currentState === GameState.GAME_OVER) {
    baseHpLabel.textContent = "0%";
    goldLabel.textContent = "0";
    waveLabel.textContent = "-";
    actLabel.textContent = "Defeat";
  }
}

function setActiveScreen(nextState) {
  Object.values(screens).forEach((screen) => {
    screen.classList.remove("screen--active");
  });
  screens[nextState].classList.add("screen--active");

  if (nextState === GameState.RUN_MAP) {
    runMapStage.classList.add("is-visible");
    battlefieldStage.classList.remove("is-visible");
  } else if (nextState === GameState.BATTLE) {
    runMapStage.classList.remove("is-visible");
    battlefieldStage.classList.add("is-visible");
  } else {
    runMapStage.classList.remove("is-visible");
    battlefieldStage.classList.add("is-visible");
  }
}

function transitionTo(nextState) {
  currentState = nextState;
  if (nextState === GameState.MENU) {
    battleState = createBattleState();
  }
  if (nextState === GameState.RUN_MAP) {
    battleState.waveInProgress = false;
  }
  setActiveScreen(nextState);
  updateHud();
  updateWaveUI();
  runStatus.textContent =
    nextState === GameState.MENU ? "Awaiting orders..." : "Run underway.";
}

function drawTextCentered(text, y, color = "rgba(245,239,230,0.7)") {
  ctx.fillStyle = color;
  ctx.font = "18px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, viewportSize.width / 2, y);
}

function getMapLayout() {
  const padding = 32;
  const availableWidth = Math.max(viewportSize.width - padding * 2, 320);
  const availableHeight = Math.max(viewportSize.height - padding * 2, 240);
  const tileSize = Math.floor(
    Math.min(availableWidth / MAP_CONFIG.cols, availableHeight / MAP_CONFIG.rows)
  );
  const width = tileSize * MAP_CONFIG.cols;
  const height = tileSize * MAP_CONFIG.rows;
  return {
    tileSize,
    width,
    height,
    offsetX: (viewportSize.width - width) / 2,
    offsetY: (viewportSize.height - height) / 2,
  };
}

function getTileCenter(layout, point) {
  return {
    x: layout.offsetX + (point.x + 0.5) * layout.tileSize,
    y: layout.offsetY + (point.y + 0.5) * layout.tileSize,
  };
}

function drawBattlefieldGrid(layout) {
  for (let row = 0; row < MAP_CONFIG.rows; row += 1) {
    for (let col = 0; col < MAP_CONFIG.cols; col += 1) {
      const x = layout.offsetX + col * layout.tileSize;
      const y = layout.offsetY + row * layout.tileSize;
      const isPath = PATH_TILE_SET.has(`${col},${row}`);
      ctx.fillStyle = isPath ? "rgba(94, 80, 64, 0.8)" : "rgba(28, 30, 29, 0.85)";
      ctx.fillRect(x, y, layout.tileSize, layout.tileSize);
      ctx.strokeStyle = "rgba(60, 56, 52, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, layout.tileSize, layout.tileSize);
    }
  }
}

function drawPathLine(layout) {
  ctx.strokeStyle = "rgba(225, 139, 58, 0.8)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  MAP_CONFIG.path.forEach((point, index) => {
    const { x, y } = getTileCenter(layout, point);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function drawSpawnAndGate(layout) {
  const spawn = MAP_CONFIG.path[0];
  const gate = MAP_CONFIG.path[MAP_CONFIG.path.length - 1];
  const spawnCenter = getTileCenter(layout, spawn);
  const gateX = layout.offsetX + (gate.x + 0.1) * layout.tileSize;
  const gateY = layout.offsetY + (gate.y + 0.1) * layout.tileSize;

  ctx.fillStyle = "rgba(88, 160, 120, 0.9)";
  ctx.beginPath();
  ctx.arc(
    spawnCenter.x,
    spawnCenter.y,
    layout.tileSize * 0.2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "rgba(200, 90, 70, 0.9)";
  ctx.fillRect(
    gateX,
    gateY,
    layout.tileSize * 0.8,
    layout.tileSize * 0.8
  );
}

function spawnEnemy(waveConfig) {
  battleState.enemies.push({
    hp: waveConfig.hp,
    maxHp: waveConfig.hp,
    speed: waveConfig.speed,
    bounty: waveConfig.bounty,
    damage: waveConfig.damage,
    segmentIndex: 0,
    segmentProgress: 0,
  });
}

function updateEnemies(dtSeconds) {
  const remainingEnemies = [];
  for (const enemy of battleState.enemies) {
    let moveRemaining = enemy.speed * dtSeconds;
    while (moveRemaining > 0) {
      const current = MAP_CONFIG.path[enemy.segmentIndex];
      const next = MAP_CONFIG.path[enemy.segmentIndex + 1];
      if (!next) {
        battleState.baseHp = Math.max(battleState.baseHp - enemy.damage, 0);
        break;
      }
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const segmentLength = Math.hypot(dx, dy);
      const remainingSegment = segmentLength * (1 - enemy.segmentProgress);
      if (moveRemaining < remainingSegment) {
        enemy.segmentProgress += moveRemaining / segmentLength;
        moveRemaining = 0;
      } else {
        moveRemaining -= remainingSegment;
        enemy.segmentIndex += 1;
        enemy.segmentProgress = 0;
      }
    }
    if (enemy.segmentIndex < MAP_CONFIG.path.length - 1) {
      remainingEnemies.push(enemy);
    }
  }
  battleState.enemies = remainingEnemies;
}

function updateWaveSpawner(dtSeconds) {
  if (!battleState.waveInProgress) {
    return;
  }
  const waveConfig = WAVE_DATA[battleState.waveIndex];
  if (!waveConfig) {
    battleState.waveInProgress = false;
    return;
  }
  battleState.spawnTimer -= dtSeconds;
  if (battleState.spawnTimer <= 0 && battleState.spawnIndex < waveConfig.count) {
    spawnEnemy(waveConfig);
    battleState.spawnIndex += 1;
    battleState.spawnTimer = waveConfig.spawnDelay;
  }

  if (battleState.spawnIndex >= waveConfig.count && battleState.enemies.length === 0) {
    battleState.waveInProgress = false;
    battleState.waveIndex += 1;
  }
}

function updateWaveUI() {
  if (currentState !== GameState.BATTLE) {
    return;
  }
  if (battleState.waveIndex >= WAVE_DATA.length) {
    waveStatus.textContent = "All waves cleared. Return to the map.";
    startWaveButton.disabled = true;
    return;
  }
  if (battleState.waveInProgress) {
    waveStatus.textContent = `Wave ${battleState.waveIndex + 1} in progress...`;
    startWaveButton.disabled = true;
  } else {
    waveStatus.textContent = `Ready for Wave ${battleState.waveIndex + 1}.`;
    startWaveButton.disabled = false;
  }
}

function renderMenuScene(time) {
  ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);
  drawTextCentered("Ashwood Bastion", viewportSize.height / 2 - 20);
  drawTextCentered("Prepare the wardens.", viewportSize.height / 2 + 10);
}

function renderRunMapScene(time) {
  ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);
  ctx.fillStyle = "rgba(20,17,15,0.7)";
  ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);

  ctx.strokeStyle = "rgba(240,192,112,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(viewportSize.width * 0.2, viewportSize.height * 0.7);
  ctx.lineTo(viewportSize.width * 0.4, viewportSize.height * 0.55);
  ctx.lineTo(viewportSize.width * 0.6, viewportSize.height * 0.4);
  ctx.lineTo(viewportSize.width * 0.8, viewportSize.height * 0.25);
  ctx.stroke();

  const nodes = [
    { x: 0.2, y: 0.7 },
    { x: 0.4, y: 0.55 },
    { x: 0.6, y: 0.4 },
    { x: 0.8, y: 0.25 },
  ];

  nodes.forEach((node, index) => {
    ctx.fillStyle = index === 0 ? "#e18b3a" : "#c4b7aa";
    ctx.beginPath();
    ctx.arc(viewportSize.width * node.x, viewportSize.height * node.y, 10, 0, Math.PI * 2);
    ctx.fill();
  });

  drawTextCentered("Run map preview: choose the next node.", viewportSize.height * 0.85);
}

function renderBattleScene(time) {
  ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);
  ctx.fillStyle = "rgba(20, 19, 18, 0.9)";
  ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);

  const layout = getMapLayout();
  drawBattlefieldGrid(layout);
  if (showPathDebug) {
    drawPathLine(layout);
  }
  drawSpawnAndGate(layout);

  battleState.enemies.forEach((enemy) => {
    const current = MAP_CONFIG.path[enemy.segmentIndex];
    const next = MAP_CONFIG.path[enemy.segmentIndex + 1] ?? current;
    const position = {
      x: current.x + (next.x - current.x) * enemy.segmentProgress,
      y: current.y + (next.y - current.y) * enemy.segmentProgress,
    };
    const worldPos = getTileCenter(layout, position);
    const radius = layout.tileSize * 0.25;
    ctx.fillStyle = "rgba(120, 180, 110, 0.9)";
    ctx.beginPath();
    ctx.arc(worldPos.x, worldPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    const barWidth = layout.tileSize * 0.5;
    const barHeight = 4;
    const barX = worldPos.x - barWidth / 2;
    const barY = worldPos.y - radius - 8;
    ctx.fillStyle = "rgba(40, 30, 30, 0.8)";
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = "rgba(225, 139, 58, 0.9)";
    ctx.fillRect(barX, barY, barWidth * (enemy.hp / enemy.maxHp), barHeight);
  });

  ctx.fillStyle = "rgba(245,239,230,0.8)";
  ctx.font = "14px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `Path Debug: ${showPathDebug ? "On" : "Off"} (V)`,
    layout.offsetX,
    layout.offsetY - 10
  );

  ctx.fillStyle = "rgba(225,139,58,0.2)";
  const pulse = 20 + Math.sin(time / 800) * 10;
  ctx.beginPath();
  ctx.arc(
    layout.offsetX + layout.width * 0.8,
    layout.offsetY + layout.height * 0.2,
    50 + pulse,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function renderGameOverScene() {
  ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);
  ctx.fillStyle = "rgba(30,10,10,0.5)";
  ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);
  drawTextCentered("The bastion falls, for now.", viewportSize.height / 2);
}

function update(dt) {
  demoPulse += dt / 1000;
  if (currentState === GameState.BATTLE) {
    const dtSeconds = dt / 1000;
    updateWaveSpawner(dtSeconds);
    updateEnemies(dtSeconds);
    updateWaveUI();
    updateHud();
    if (battleState.baseHp <= 0) {
      transitionTo(GameState.GAME_OVER);
    }
  }
}

function render(time) {
  if (currentState === GameState.MENU) {
    renderMenuScene(time);
  }

  if (currentState === GameState.RUN_MAP) {
    renderRunMapScene(time);
  }

  if (currentState === GameState.BATTLE) {
    renderBattleScene(time);
  }

  if (currentState === GameState.GAME_OVER) {
    renderGameOverScene(time);
  }
}

function loop(timestamp) {
  const delta = timestamp - lastFrameTime;
  lastFrameTime = timestamp;
  accumulator += delta;

  if (!isPaused) {
    while (accumulator >= FIXED_STEP) {
      update(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
  }

  render(timestamp);
  requestAnimationFrame(loop);
}

function togglePause() {
  isPaused = !isPaused;
  pauseOverlay.classList.toggle("is-visible", isPaused);
  pauseButton.textContent = isPaused ? "Resume" : "Pause";
}

function bindControls() {
  startRunButton.addEventListener("click", () => {
    transitionTo(GameState.RUN_MAP);
  });

  enterBattleButton.addEventListener("click", () => {
    transitionTo(GameState.BATTLE);
  });

  returnToMenuButton.addEventListener("click", () => {
    transitionTo(GameState.MENU);
  });

  backToMapButton.addEventListener("click", () => {
    transitionTo(GameState.RUN_MAP);
  });

  endRunButton.addEventListener("click", () => {
    transitionTo(GameState.GAME_OVER);
  });

  restartButton.addEventListener("click", () => {
    transitionTo(GameState.MENU);
  });

  pauseButton.addEventListener("click", togglePause);

  startWaveButton.addEventListener("click", () => {
    if (battleState.waveInProgress || battleState.waveIndex >= WAVE_DATA.length) {
      return;
    }
    battleState.waveInProgress = true;
    battleState.spawnIndex = 0;
    battleState.spawnTimer = 0;
    updateWaveUI();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "p" || event.key === "Escape") {
      togglePause();
    }
    if (event.key.toLowerCase() === "v") {
      showPathDebug = !showPathDebug;
    }
  });
}

function init() {
  applySettings();
  bindSettings();
  bindControls();
  resizeCanvas();
  updateHud();
  updateWaveUI();
  setActiveScreen(currentState);
  window.addEventListener("resize", resizeCanvas);
  requestAnimationFrame(loop);
}

init();
