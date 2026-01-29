const SETTINGS_KEY = "ashwood-settings";
const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
};

const GameState = {
  MENU: "menu",
  RUN_MAP: "runMap",
  BATTLE: "battle",
  REWARD: "reward",
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
const TOWER_DATA = {
  arrow: {
    name: "Arrow Watch",
    cost: 40,
    range: 2.6,
    fireRate: 0.6,
    damage: 12,
    projectileSpeed: 6,
  },
  frost: {
    name: "Frost Totem",
    cost: 55,
    range: 2.3,
    fireRate: 1.2,
    damage: 6,
    projectileSpeed: 5,
    splashRadius: 1.1,
    slow: {
      factor: 0.65,
      duration: 2.4,
    },
  },
  bombard: {
    name: "Bombard",
    cost: 70,
    range: 2.8,
    fireRate: 1.6,
    damage: 22,
    projectileSpeed: 4,
    splashRadius: 1.4,
  },
};
const REWARD_POOL = [
  {
    id: "sharpened-fletching",
    name: "Sharpened Fletching",
    description: "Arrow Watch damage +8%.",
    rarity: "Common",
    apply(modifiers) {
      modifiers.towerDamage.arrow *= 1.08;
    },
  },
  {
    id: "cold-iron-rings",
    name: "Cold Iron Rings",
    description: "Frost Totem slow strength +10%.",
    rarity: "Common",
    apply(modifiers) {
      modifiers.slowFactor *= 1.1;
    },
  },
  {
    id: "ember-reserves",
    name: "Ember Reserves",
    description: "Gain 20 gold before the next battle.",
    rarity: "Common",
    apply(modifiers, state) {
      state.gold += 20;
    },
  },
  {
    id: "long-watch",
    name: "Long Watch",
    description: "Tower range +10%.",
    rarity: "Rare",
    apply(modifiers) {
      modifiers.range *= 1.1;
    },
  },
  {
    id: "battlefield-drills",
    name: "Battlefield Drills",
    description: "Arrow Watch fires 10% faster.",
    rarity: "Rare",
    apply(modifiers) {
      modifiers.attackSpeed.arrow *= 1.1;
    },
  },
  {
    id: "ruinbreaker-rounds",
    name: "Ruinbreaker Rounds",
    description: "Bombard damage +15%.",
    rarity: "Epic",
    apply(modifiers) {
      modifiers.towerDamage.bombard *= 1.15;
    },
  },
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
  [GameState.REWARD]: document.querySelector("#rewardScreen"),
  [GameState.GAME_OVER]: document.querySelector("#gameOverScreen"),
};

const enterBattleButton = document.querySelector("#enterBattleButton");
const returnToMenuButton = document.querySelector("#returnToMenuButton");
const backToMapButton = document.querySelector("#backToMapButton");
const endRunButton = document.querySelector("#endRunButton");
const restartButton = document.querySelector("#restartButton");
const startWaveButton = document.querySelector("#startWaveButton");
const waveStatus = document.querySelector("#waveStatus");
const arrowTowerButton = document.querySelector("#arrowTowerButton");
const frostTowerButton = document.querySelector("#frostTowerButton");
const bombardTowerButton = document.querySelector("#bombardTowerButton");
const speedNormalButton = document.querySelector("#speedNormalButton");
const speedFastButton = document.querySelector("#speedFastButton");
const wavePreviewList = document.querySelector("#wavePreviewList");
const continueRunButton = document.querySelector("#continueRunButton");
const rewardGrid = document.querySelector("#rewardGrid");

const FIXED_STEP = 1000 / 60;
const BUILD_PHASE_DURATION = 6;

let settings = loadSettings();
let lastFrameTime = 0;
let accumulator = 0;
let viewportSize = { width: 0, height: 0 };
let currentState = GameState.MENU;
let isPaused = false;
let simulationSpeed = 1;
let demoPulse = 0;
let showPathDebug = true;
let battleState = createBattleState();
let runState = createRunState();
let placementMode = null;
let hoverTile = null;

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
    towers: [],
    projectiles: [],
    waveInProgress: false,
    spawnTimer: 0,
    spawnIndex: 0,
    buildPhaseRemaining: 0,
  };
}

function createRunState() {
  return {
    modifiers: createRunModifiers(),
    rewardChoices: [],
    rewardClaimed: false,
  };
}

function createRunModifiers() {
  return {
    towerDamage: {
      arrow: 1,
      frost: 1,
      bombard: 1,
    },
    attackSpeed: {
      arrow: 1,
      frost: 1,
      bombard: 1,
    },
    range: 1,
    slowFactor: 1,
  };
}

function resetBattleProgression() {
  const { baseHp, gold } = battleState;
  battleState = {
    ...createBattleState(),
    baseHp,
    gold,
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

  if (currentState === GameState.REWARD) {
    baseHpLabel.textContent = `${battleState.baseHp}%`;
    goldLabel.textContent = `${battleState.gold}`;
    waveLabel.textContent = `${WAVE_DATA.length} / ${WAVE_DATA.length}`;
    actLabel.textContent = "Rewards";
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
  const previousState = currentState;
  currentState = nextState;
  if (nextState === GameState.MENU) {
    battleState = createBattleState();
    runState = createRunState();
  }
  if (nextState === GameState.RUN_MAP) {
    battleState.waveInProgress = false;
    if (previousState === GameState.REWARD) {
      resetBattleProgression();
    }
  }
  if (nextState === GameState.BATTLE && battleState.waveIndex >= WAVE_DATA.length) {
    resetBattleProgression();
  }
  if (nextState === GameState.REWARD) {
    prepareRewards();
  }
  setActiveScreen(nextState);
  updateHud();
  updateWaveUI();
  updateTowerUI();
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
    statusEffects: [],
  });
}

function updateEnemies(dtSeconds) {
  const remainingEnemies = [];
  for (const enemy of battleState.enemies) {
    updateEnemyStatusEffects(enemy, dtSeconds);
    const currentSpeed = enemy.speed * getSpeedModifier(enemy);
    let moveRemaining = currentSpeed * dtSeconds;
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

function updateEnemyStatusEffects(enemy, dtSeconds) {
  enemy.statusEffects = enemy.statusEffects
    .map((effect) => ({ ...effect, remaining: effect.remaining - dtSeconds }))
    .filter((effect) => effect.remaining > 0);
}

function getSpeedModifier(enemy) {
  return enemy.statusEffects.reduce((modifier, effect) => {
    if (effect.type === "slow") {
      return Math.min(modifier, effect.factor);
    }
    return modifier;
  }, 1);
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
    if (battleState.waveIndex < WAVE_DATA.length) {
      battleState.buildPhaseRemaining = BUILD_PHASE_DURATION;
    }
  }
}

function updateWaveUI() {
  if (currentState !== GameState.BATTLE) {
    return;
  }
  updateWavePreview();
  if (battleState.waveIndex >= WAVE_DATA.length) {
    waveStatus.textContent = "All waves cleared. Return to the map.";
    startWaveButton.disabled = true;
    return;
  }
  if (battleState.waveInProgress) {
    waveStatus.textContent = `Wave ${battleState.waveIndex + 1} in progress...`;
    startWaveButton.disabled = true;
    return;
  }
  if (battleState.buildPhaseRemaining > 0) {
    waveStatus.textContent = `Build phase: ${Math.ceil(
      battleState.buildPhaseRemaining
    )}s`;
    startWaveButton.disabled = true;
  } else {
    waveStatus.textContent = `Ready for Wave ${battleState.waveIndex + 1}.`;
    startWaveButton.disabled = false;
  }
}

function updateTowerUI() {
  if (currentState !== GameState.BATTLE) {
    arrowTowerButton.disabled = true;
    frostTowerButton.disabled = true;
    bombardTowerButton.disabled = true;
    return;
  }
  arrowTowerButton.disabled = !canAffordTower("arrow");
  frostTowerButton.disabled = !canAffordTower("frost");
  bombardTowerButton.disabled = !canAffordTower("bombard");
}

function updateWavePreview() {
  if (!wavePreviewList) {
    return;
  }
  wavePreviewList.innerHTML = "";
  const previewWaves = WAVE_DATA.slice(battleState.waveIndex, battleState.waveIndex + 2);
  previewWaves.forEach((wave, index) => {
    const row = document.createElement("div");
    const label = battleState.waveIndex + index + 1;
    row.textContent = `Wave ${label}: ${wave.count} raiders · ${wave.hp} HP · ${wave.speed.toFixed(
      1
    )} speed`;
    wavePreviewList.appendChild(row);
  });
  if (!previewWaves.length) {
    const row = document.createElement("div");
    row.textContent = "No waves remain.";
    wavePreviewList.appendChild(row);
  }
}

function getTowerCost(type) {
  return TOWER_DATA[type]?.cost ?? 0;
}

function canAffordTower(type) {
  return battleState.gold >= getTowerCost(type);
}

function isBuildableTile(tile) {
  if (!tile) {
    return false;
  }
  if (tile.x < 0 || tile.y < 0 || tile.x >= MAP_CONFIG.cols || tile.y >= MAP_CONFIG.rows) {
    return false;
  }
  if (PATH_TILE_SET.has(`${tile.x},${tile.y}`)) {
    return false;
  }
  return !battleState.towers.some((tower) => tower.x === tile.x && tower.y === tile.y);
}

function placeTower(tile, type) {
  if (!isBuildableTile(tile) || !canAffordTower(type)) {
    return false;
  }
  battleState.gold -= getTowerCost(type);
  battleState.towers.push({
    type,
    x: tile.x,
    y: tile.y,
    cooldown: 0,
  });
  updateHud();
  updateTowerUI();
  return true;
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

  battleState.towers.forEach((tower) => {
    const worldPos = getTileCenter(layout, tower);
    const size = layout.tileSize * 0.4;
    ctx.fillStyle = "rgba(225, 139, 58, 0.9)";
    ctx.fillRect(worldPos.x - size / 2, worldPos.y - size / 2, size, size);
    ctx.fillStyle = "rgba(50, 30, 20, 0.6)";
    ctx.fillRect(worldPos.x - size / 4, worldPos.y - size / 4, size / 2, size / 2);
  });

  battleState.projectiles.forEach((projectile) => {
    ctx.fillStyle = "rgba(245, 239, 230, 0.9)";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, layout.tileSize * 0.08, 0, Math.PI * 2);
    ctx.fill();
  });

  battleState.enemies.forEach((enemy) => {
    const worldPos = getEnemyWorldPosition(enemy);
    const radius = layout.tileSize * 0.25;
    const slowed = enemy.statusEffects.some((effect) => effect.type === "slow");
    ctx.fillStyle = slowed ? "rgba(120, 170, 220, 0.9)" : "rgba(120, 180, 110, 0.9)";
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

  if (placementMode && hoverTile) {
    const worldPos = getTileCenter(layout, hoverTile);
    const size = layout.tileSize * 0.8;
    ctx.strokeStyle = isBuildableTile(hoverTile)
      ? "rgba(120, 200, 150, 0.8)"
      : "rgba(200, 80, 80, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(worldPos.x - size / 2, worldPos.y - size / 2, size, size);
  }

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
    const dtSeconds = (dt / 1000) * simulationSpeed;
    if (!battleState.waveInProgress && battleState.buildPhaseRemaining > 0) {
      battleState.buildPhaseRemaining = Math.max(
        battleState.buildPhaseRemaining - dtSeconds,
        0
      );
    }
    updateWaveSpawner(dtSeconds);
    updateEnemies(dtSeconds);
    updateTowers(dtSeconds);
    updateProjectiles(dtSeconds);
    updateWaveUI();
    updateTowerUI();
    updateHud();
    if (
      battleState.waveIndex >= WAVE_DATA.length &&
      !battleState.waveInProgress &&
      battleState.enemies.length === 0
    ) {
      transitionTo(GameState.REWARD);
    }
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
  if (isPaused) {
    lastFrameTime = timestamp;
    render(timestamp);
    requestAnimationFrame(loop);
    return;
  }

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
  if (isPaused) {
    accumulator = 0;
  }
  pauseOverlay.classList.toggle("is-visible", isPaused);
  pauseButton.textContent = isPaused ? "Resume" : "Pause";
}

function updateTowers(dtSeconds) {
  battleState.towers.forEach((tower) => {
    const data = getTowerStats(tower.type);
    if (!data) {
      return;
    }
    tower.cooldown = Math.max(tower.cooldown - dtSeconds, 0);
    if (tower.cooldown > 0) {
      return;
    }
    const target = findTargetForTower(tower, data.range);
    if (!target) {
      return;
    }
    const worldOrigin = getTileCenter(getMapLayout(), tower);
    battleState.projectiles.push({
      x: worldOrigin.x,
      y: worldOrigin.y,
      target,
      speed: data.projectileSpeed,
      damage: data.damage,
      splashRadius: data.splashRadius ?? 0,
      slow: data.slow ?? null,
    });
    tower.cooldown = data.fireRate;
  });
}

function updateProjectiles(dtSeconds) {
  const remaining = [];
  const layout = getMapLayout();
  battleState.projectiles.forEach((projectile) => {
    if (!battleState.enemies.includes(projectile.target)) {
      return;
    }
    const targetPos = getEnemyWorldPosition(projectile.target);
    const dx = targetPos.x - projectile.x;
    const dy = targetPos.y - projectile.y;
    const distance = Math.hypot(dx, dy);
    const speedPixels = projectile.speed * layout.tileSize;
    if (distance < speedPixels * dtSeconds) {
      applyProjectileHit(projectile);
      return;
    }
    const vx = (dx / distance) * speedPixels;
    const vy = (dy / distance) * speedPixels;
    projectile.x += vx * dtSeconds;
    projectile.y += vy * dtSeconds;
    remaining.push(projectile);
  });
  battleState.projectiles = remaining;
}

function applyProjectileHit(projectile) {
  const targets = projectile.splashRadius
    ? getEnemiesInRadius(projectile.target, projectile.splashRadius)
    : [projectile.target];
  targets.forEach((enemy) => {
    enemy.hp -= projectile.damage;
    if (projectile.slow) {
      applyStatusEffect(enemy, {
        type: "slow",
        factor: projectile.slow.factor,
        remaining: projectile.slow.duration,
      });
    }
    if (enemy.hp <= 0) {
      battleState.gold += enemy.bounty;
    }
  });
  battleState.enemies = battleState.enemies.filter((enemy) => enemy.hp > 0);
  updateTowerUI();
}

function getEnemiesInRadius(centerEnemy, radiusTiles) {
  const layout = getMapLayout();
  const center = getEnemyWorldPosition(centerEnemy);
  const radius = radiusTiles * layout.tileSize;
  return battleState.enemies.filter((enemy) => {
    const pos = getEnemyWorldPosition(enemy);
    return Math.hypot(pos.x - center.x, pos.y - center.y) <= radius;
  });
}

function applyStatusEffect(enemy, effect) {
  const existing = enemy.statusEffects.find((item) => item.type === effect.type);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, effect.remaining);
    existing.factor = Math.min(existing.factor, effect.factor);
  } else {
    enemy.statusEffects.push(effect);
  }
}

function findTargetForTower(tower, range) {
  const towerPos = getTileCenter(getMapLayout(), tower);
  let bestTarget = null;
  let bestProgress = -Infinity;
  battleState.enemies.forEach((enemy) => {
    const enemyPos = getEnemyWorldPosition(enemy);
    const distance = Math.hypot(enemyPos.x - towerPos.x, enemyPos.y - towerPos.y);
    if (distance > range * getMapLayout().tileSize) {
      return;
    }
    const progress = enemy.segmentIndex + enemy.segmentProgress;
    if (progress > bestProgress) {
      bestProgress = progress;
      bestTarget = enemy;
    }
  });
  return bestTarget;
}

function getTowerStats(towerType) {
  const data = TOWER_DATA[towerType];
  if (!data) {
    return null;
  }
  const modifiers = runState.modifiers;
  const attackSpeed = modifiers.attackSpeed[towerType] ?? 1;
  const damage = data.damage * (modifiers.towerDamage[towerType] ?? 1);
  const range = data.range * modifiers.range;
  const fireRate = data.fireRate / attackSpeed;
  const slow = data.slow
    ? {
        ...data.slow,
        factor: data.slow.factor * modifiers.slowFactor,
      }
    : null;
  return {
    ...data,
    damage,
    range,
    fireRate,
    slow,
  };
}

function getEnemyWorldPosition(enemy) {
  const layout = getMapLayout();
  const current = MAP_CONFIG.path[enemy.segmentIndex];
  const next = MAP_CONFIG.path[enemy.segmentIndex + 1] ?? current;
  const position = {
    x: current.x + (next.x - current.x) * enemy.segmentProgress,
    y: current.y + (next.y - current.y) * enemy.segmentProgress,
  };
  return getTileCenter(layout, position);
}

function getTileFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const layout = getMapLayout();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const gridX = Math.floor((x - layout.offsetX) / layout.tileSize);
  const gridY = Math.floor((y - layout.offsetY) / layout.tileSize);
  if (Number.isNaN(gridX) || Number.isNaN(gridY)) {
    return null;
  }
  return { x: gridX, y: gridY };
}

function prepareRewards() {
  runState.rewardChoices = rollRewards(3);
  runState.rewardClaimed = false;
  renderRewardChoices();
  continueRunButton.disabled = true;
}

function rollRewards(count) {
  const choices = [];
  const used = new Set();
  while (choices.length < count && used.size < REWARD_POOL.length) {
    const reward = pickRewardByRarity();
    if (!reward || used.has(reward.id)) {
      continue;
    }
    used.add(reward.id);
    choices.push(reward);
  }
  return choices;
}

function pickRewardByRarity() {
  const rarityWeights = {
    Common: 0.65,
    Rare: 0.28,
    Epic: 0.07,
  };
  const roll = Math.random();
  let cumulative = 0;
  let selectedRarity = "Common";
  for (const [rarity, weight] of Object.entries(rarityWeights)) {
    cumulative += weight;
    if (roll <= cumulative) {
      selectedRarity = rarity;
      break;
    }
  }
  const filtered = REWARD_POOL.filter((reward) => reward.rarity === selectedRarity);
  if (!filtered.length) {
    return REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];
  }
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function renderRewardChoices() {
  rewardGrid.innerHTML = "";
  runState.rewardChoices.forEach((reward) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button--metal reward-card";
    button.innerHTML = `
      <span class="reward-card__rarity">${reward.rarity}</span>
      <strong>${reward.name}</strong>
      <span class="muted">${reward.description}</span>
    `;
    button.addEventListener("click", () => selectReward(reward, button));
    rewardGrid.appendChild(button);
  });
}

function selectReward(reward, button) {
  if (runState.rewardClaimed) {
    return;
  }
  applyReward(reward);
  runState.rewardClaimed = true;
  continueRunButton.disabled = false;
  rewardGrid.querySelectorAll(".reward-card").forEach((card) => {
    card.classList.toggle("is-selected", card === button);
    card.disabled = true;
  });
}

function applyReward(reward) {
  reward.apply(runState.modifiers, battleState);
  updateHud();
  updateTowerUI();
}

function bindControls() {
  startRunButton.addEventListener("click", () => {
    runState = createRunState();
    battleState = createBattleState();
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

  continueRunButton.addEventListener("click", () => {
    if (!runState.rewardClaimed) {
      return;
    }
    transitionTo(GameState.RUN_MAP);
  });

  pauseButton.addEventListener("click", togglePause);

  speedNormalButton.addEventListener("click", () => {
    simulationSpeed = 1;
    speedNormalButton.classList.add("is-active");
    speedFastButton.classList.remove("is-active");
  });

  speedFastButton.addEventListener("click", () => {
    simulationSpeed = 2;
    speedFastButton.classList.add("is-active");
    speedNormalButton.classList.remove("is-active");
  });

  startWaveButton.addEventListener("click", () => {
    if (
      battleState.waveInProgress ||
      battleState.waveIndex >= WAVE_DATA.length ||
      battleState.buildPhaseRemaining > 0
    ) {
      return;
    }
    battleState.waveInProgress = true;
    battleState.spawnIndex = 0;
    battleState.spawnTimer = 0;
    updateWaveUI();
  });

  arrowTowerButton.addEventListener("click", () => {
    if (currentState !== GameState.BATTLE) {
      return;
    }
    placementMode = "arrow";
  });

  frostTowerButton.addEventListener("click", () => {
    if (currentState !== GameState.BATTLE) {
      return;
    }
    placementMode = "frost";
  });

  bombardTowerButton.addEventListener("click", () => {
    if (currentState !== GameState.BATTLE) {
      return;
    }
    placementMode = "bombard";
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!placementMode || currentState !== GameState.BATTLE) {
      hoverTile = null;
      return;
    }
    hoverTile = getTileFromPointer(event);
  });

  canvas.addEventListener("pointerleave", () => {
    hoverTile = null;
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!placementMode || currentState !== GameState.BATTLE) {
      return;
    }
    const tile = getTileFromPointer(event);
    const placed = placeTower(tile, placementMode);
    if (placed) {
      placementMode = null;
      updateTowerUI();
    }
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
  updateTowerUI();
  updateWavePreview();
  setActiveScreen(currentState);
  window.addEventListener("resize", resizeCanvas);
  requestAnimationFrame(loop);
}

init();
