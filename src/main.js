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

const FIXED_STEP = 1000 / 60;

let settings = loadSettings();
let lastFrameTime = 0;
let accumulator = 0;
let viewportSize = { width: 0, height: 0 };
let currentState = GameState.MENU;
let isPaused = false;
let demoPulse = 0;

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

function updateHud() {
  if (currentState === GameState.MENU) {
    baseHpLabel.textContent = "-";
    goldLabel.textContent = "-";
    waveLabel.textContent = "-";
    actLabel.textContent = "Menu";
  }

  if (currentState === GameState.RUN_MAP) {
    baseHpLabel.textContent = "100%";
    goldLabel.textContent = "140";
    waveLabel.textContent = "0 / 5";
    actLabel.textContent = "Run Map";
  }

  if (currentState === GameState.BATTLE) {
    baseHpLabel.textContent = "100%";
    goldLabel.textContent = "140";
    waveLabel.textContent = "1 / 5";
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
  setActiveScreen(nextState);
  updateHud();
  runStatus.textContent =
    nextState === GameState.MENU ? "Awaiting orders..." : "Run underway.";
}

function drawTextCentered(text, y, color = "rgba(245,239,230,0.7)") {
  ctx.fillStyle = color;
  ctx.font = "18px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, viewportSize.width / 2, y);
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
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);

  ctx.fillStyle = "rgba(225,139,58,0.25)";
  const pulse = 20 + Math.sin(time / 800) * 10;
  ctx.beginPath();
  ctx.arc(viewportSize.width / 2, viewportSize.height / 2, 80 + pulse, 0, Math.PI * 2);
  ctx.fill();

  drawTextCentered("Battlefield Preview", viewportSize.height / 2 + 8, "rgba(245,239,230,0.8)");
}

function renderGameOverScene() {
  ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);
  ctx.fillStyle = "rgba(30,10,10,0.5)";
  ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);
  drawTextCentered("The bastion falls, for now.", viewportSize.height / 2);
}

function update(dt) {
  demoPulse += dt / 1000;
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

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "p" || event.key === "Escape") {
      togglePause();
    }
  });
}

function init() {
  applySettings();
  bindSettings();
  bindControls();
  resizeCanvas();
  updateHud();
  setActiveScreen(currentState);
  window.addEventListener("resize", resizeCanvas);
  requestAnimationFrame(loop);
}

init();
