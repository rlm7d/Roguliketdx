const SETTINGS_KEY = "ashwood-settings";
const DEFAULT_SETTINGS = {
  sound: true,
  music: true,
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

let settings = loadSettings();
let lastFrameTime = 0;
let viewportSize = { width: 0, height: 0 };

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

function drawPlaceholderScene(time) {
  ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);

  ctx.fillStyle = "rgba(225,139,58,0.25)";
  const pulse = 20 + Math.sin(time / 800) * 10;
  ctx.beginPath();
  ctx.arc(viewportSize.width / 2, viewportSize.height / 2, 80 + pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(245,239,230,0.6)";
  ctx.font = "20px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Ashwood Bastion Preview", viewportSize.width / 2, viewportSize.height / 2 + 8);
}

function loop(timestamp) {
  const delta = timestamp - lastFrameTime;
  lastFrameTime = timestamp;
  drawPlaceholderScene(timestamp);
  requestAnimationFrame(loop);
}

function startRun() {
  runStatus.textContent = "Scouts dispatched. Run map arriving next.";
}

function init() {
  applySettings();
  bindSettings();
  resizeCanvas();
  startRunButton.addEventListener("click", startRun);
  window.addEventListener("resize", resizeCanvas);
  requestAnimationFrame(loop);
}

init();
