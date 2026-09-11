import { LEVELS } from "./challenges.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE = { custom: "gp-custom-v1", selected: "gp-selected-v1", mute: "gp-muted-v1", game: "gp-current-game-v1" };
const COLORS = ["#ff3d81", "#6ee7ff", "#ffd166", "#9bff8a"];
const LADDER = { 3: 22, 8: 26, 20: 41, 28: 55, 36: 57, 51: 72, 63: 81, 71: 92 };
const SNAKE = { 17: 4, 31: 12, 47: 25, 59: 38, 69: 49, 78: 56, 88: 67, 97: 76 };
const SPECIAL_CELLS = new Set([...Object.keys(LADDER), ...Object.values(LADDER), ...Object.keys(SNAKE), ...Object.values(SNAKE)].map(Number));

let currentScreen = "homeScreen";
let selectedLevel = 1;
let playerCount = 2;
let game = null;
let busy = false;
let timerId = null;
let chosenDuration = 30;
let muted = JSON.parse(localStorage.getItem(STORAGE.mute) ?? "false");
let audioContext;

const screens = $$(".screen");
const screenHistory = [];

function showScreen(id, remember = true) {
  if (remember && currentScreen !== id) screenHistory.push(currentScreen);
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  currentScreen = id;
  $("#backBtn").classList.toggle("hidden", id === "homeScreen" || id === "gameScreen");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goHome() {
  screenHistory.length = 0;
  showScreen("homeScreen", false);
  updateResumeButton();
}

function goBack() {
  const previous = screenHistory.pop() || "homeScreen";
  showScreen(previous, false);
}

function getCustom() {
  try { return JSON.parse(localStorage.getItem(STORAGE.custom)) || { 1: [], 2: [] }; }
  catch { return { 1: [], 2: [] }; }
}

function getChallenges(level = selectedLevel) {
  const custom = getCustom();
  return [...LEVELS[level].challenges, ...(custom[level] || [])];
}

function getSavedSelected(level = selectedLevel) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE.selected)) || {}; } catch {}
  const allIds = getChallenges(level).map((item) => item.id);
  return new Set(Array.isArray(saved[level]) ? saved[level].filter((id) => allIds.includes(id)) : allIds);
}

function saveSelected(ids, level = selectedLevel) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE.selected)) || {}; } catch {}
  saved[level] = [...ids];
  localStorage.setItem(STORAGE.selected, JSON.stringify(saved));
}

function renderPlayerInputs(values) {
  const holder = $("#playerInputs");
  const oldValues = values || $$(".player-name").map((input) => input.value);
  holder.innerHTML = "";
  for (let index = 0; index < playerCount; index += 1) {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `<span class="player-color" style="--player-color:${COLORS[index]}">${index + 1}</span><input class="player-name" maxlength="18" value="${escapeHtml(oldValues[index] || `Pemain ${index + 1}`)}" aria-label="Nama pemain ${index + 1}">${playerCount > 2 ? `<button class="remove-player" data-remove-player="${index}" aria-label="Hapus pemain ${index + 1}">×</button>` : ""}`;
    holder.appendChild(row);
  }
  $("#addPlayerBtn").disabled = playerCount >= 4;
}

function renderChallengeList() {
  const challenges = getChallenges();
  const selected = getSavedSelected();
  const customIds = new Set((getCustom()[selectedLevel] || []).map((item) => item.id));
  $("#challengeList").innerHTML = challenges.map((challenge, index) => `
    <label class="challenge-option">
      <input type="checkbox" value="${challenge.id}" ${selected.has(challenge.id) ? "checked" : ""}>
      <span class="custom-checkbox">✓</span><span class="challenge-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="challenge-option-copy"><span>${escapeHtml(challenge.text)}</span><small>${challenge.timed ? "⏱ Memakai timer" : "⚡ Tanpa timer"}</small></span>
      ${customIds.has(challenge.id) ? `<button type="button" class="delete-custom" data-delete-custom="${challenge.id}" aria-label="Hapus tantangan">×</button>` : ""}
    </label>`).join("");
  updateSelectedCount();
}

function updateSelectedCount() {
  const checked = $$("#challengeList input:checked");
  $("#selectedCount").textContent = checked.length;
  $("#startGameBtn").disabled = checked.length === 0;
  $("#setupHint").textContent = checked.length
    ? checked.length < 30 ? `${checked.length} tantangan terpilih akan diulang secara acak hingga mengisi 30 kotak.` : "Tantangan akan diacak merata, 3 jebakan pada setiap baris."
    : "Pilih minimal satu tantangan untuk memulai.";
  saveSelected(new Set(checked.map((input) => input.value)));
}

function openSetup(level) {
  selectedLevel = Number(level);
  const levelText = selectedLevel === 1 ? "LEVEL 1 · ROMANTIS" : "LEVEL 2 · HOT & BERANI · 18+";
  $("#setupEyebrow").textContent = levelText;
  renderPlayerInputs();
  renderChallengeList();
  showScreen("setupScreen");
}

function addCustomChallenge(event) {
  event.preventDefault();
  const input = $("#customChallengeInput");
  const text = input.value.trim();
  if (!text) return;
  const custom = getCustom();
  custom[selectedLevel] ||= [];
  const item = { id: `custom-${selectedLevel}-${Date.now()}`, text, timed: $("#customTimedInput").checked, custom: true };
  custom[selectedLevel].push(item);
  localStorage.setItem(STORAGE.custom, JSON.stringify(custom));
  const selected = getSavedSelected();
  selected.add(item.id);
  saveSelected(selected);
  event.target.reset();
  renderChallengeList();
  showToast("Tantangan ditambahkan");
}

function deleteCustom(id) {
  const custom = getCustom();
  custom[selectedLevel] = (custom[selectedLevel] || []).filter((item) => item.id !== id);
  localStorage.setItem(STORAGE.custom, JSON.stringify(custom));
  const selected = getSavedSelected();
  selected.delete(id);
  saveSelected(selected);
  renderChallengeList();
}

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildTrapMap(selectedChallenges) {
  const cells = [];
  for (let decade = 0; decade < 10; decade += 1) {
    const min = decade * 10 + 1;
    const candidates = [];
    for (let number = min; number <= min + 9; number += 1) {
      if (number !== 1 && number !== 100 && !SPECIAL_CELLS.has(number)) candidates.push(number);
    }
    cells.push(...shuffle(candidates).slice(0, 3));
  }
  let pool = [];
  while (pool.length < 30) pool.push(...shuffle(selectedChallenges));
  pool = pool.slice(0, 30);
  return Object.fromEntries(shuffle(cells).map((cell, index) => [cell, pool[index]]));
}

function startGame() {
  const names = $$(".player-name").map((input, index) => input.value.trim() || `Pemain ${index + 1}`);
  const selectedIds = new Set($$("#challengeList input:checked").map((input) => input.value));
  const selectedChallenges = getChallenges().filter((item) => selectedIds.has(item.id));
  if (!selectedChallenges.length) return;
  game = {
    level: selectedLevel,
    players: names.map((name, index) => ({ name, color: COLORS[index], position: 1 })),
    currentIndex: Math.floor(Math.random() * names.length),
    trapMap: buildTrapMap(selectedChallenges),
    turn: 1
  };
  saveGame();
  enterGame();
}

function saveGame() {
  if (game) localStorage.setItem(STORAGE.game, JSON.stringify(game));
  updateResumeButton();
}

function updateResumeButton() {
  $("#resumeBtn").classList.toggle("hidden", !localStorage.getItem(STORAGE.game));
}

function enterGame() {
  selectedLevel = Number(game.level);
  $("#gameLevelLabel").textContent = selectedLevel === 1 ? "LEVEL 1 · ROMANTIS" : "LEVEL 2 · HOT & BERANI";
  renderBoard();
  renderGameState();
  showScreen("gameScreen", false);
}

function boardSequence() {
  const result = [];
  for (let row = 9; row >= 0; row -= 1) {
    const start = row * 10 + 1;
    const numbers = Array.from({ length: 10 }, (_, index) => start + index);
    result.push(...(row % 2 ? numbers.reverse() : numbers));
  }
  return result;
}

function renderBoard() {
  const board = $("#board");
  board.innerHTML = boardSequence().map((number) => {
    const trap = game.trapMap[number];
    const special = LADDER[number] ? "ladder-start" : SNAKE[number] ? "snake-start" : "";
    return `<div class="cell ${number % 2 ? "cell-dark" : "cell-light"} ${trap ? "trap-cell" : ""} ${special}" data-cell="${number}"><span class="cell-number">${number}</span>${trap ? `<span class="trap-mark" title="${trap.timed ? "Tantangan timer" : "Tantangan langsung"}">${trap.timed ? "⏱" : "⚡"}</span>` : ""}<div class="tokens"></div></div>`;
  }).join("");
  drawBoardLinks();
}

function cellCenter(number) {
  const zero = number - 1;
  const rowFromBottom = Math.floor(zero / 10);
  const within = zero % 10;
  const col = rowFromBottom % 2 === 0 ? within : 9 - within;
  return { x: (col + 0.5) * 100, y: (9 - rowFromBottom + 0.5) * 100 };
}

function drawBoardLinks() {
  const svg = $("#boardLinks");
  let content = "";
  Object.entries(LADDER).forEach(([from, to]) => {
    const a = cellCenter(Number(from)); const b = cellCenter(to);
    const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy); const nx = -dy / length * 10; const ny = dx / length * 10;
    content += `<g class="ladder-svg"><line x1="${a.x + nx}" y1="${a.y + ny}" x2="${b.x + nx}" y2="${b.y + ny}"/><line x1="${a.x - nx}" y1="${a.y - ny}" x2="${b.x - nx}" y2="${b.y - ny}"/>`;
    for (let step = 0.15; step < 0.9; step += 0.15) content += `<line x1="${a.x + dx * step + nx}" y1="${a.y + dy * step + ny}" x2="${a.x + dx * step - nx}" y2="${a.y + dy * step - ny}"/>`;
    content += "</g>";
  });
  Object.entries(SNAKE).forEach(([from, to], index) => {
    const a = cellCenter(Number(from)); const b = cellCenter(to); const bend = index % 2 ? 90 : -90;
    content += `<path class="snake-svg" d="M ${a.x} ${a.y} C ${a.x + bend} ${(a.y + b.y) / 2}, ${b.x - bend} ${(a.y + b.y) / 2}, ${b.x} ${b.y}"/><circle class="snake-head" cx="${a.x}" cy="${a.y}" r="17"/>`;
  });
  svg.innerHTML = content;
}

function renderGameState() {
  $$(".tokens").forEach((holder) => { holder.innerHTML = ""; });
  game.players.forEach((player, index) => {
    const cell = $(`[data-cell="${player.position}"] .tokens`);
    if (cell) cell.insertAdjacentHTML("beforeend", `<span class="token" style="--token:${player.color}" title="${escapeHtml(player.name)}">${index + 1}</span>`);
  });
  $("#playerStatus").innerHTML = game.players.map((player, index) => `<div class="status-card ${index === game.currentIndex ? "current" : ""}" style="--token:${player.color}"><span class="status-token">${index + 1}</span><span><strong>${escapeHtml(player.name)}</strong><small>Kotak ${player.position}</small></span>${index === game.currentIndex ? `<b>GILIRAN</b>` : ""}</div>`).join("");
  $("#turnLabel").textContent = `Giliran ${game.players[game.currentIndex].name}`;
}

async function rollDice() {
  if (busy || !game) return;
  busy = true;
  $("#rollBtn").disabled = true;
  const roll = Math.floor(Math.random() * 6) + 1;
  const dice = $("#dice");
  dice.classList.remove("rolling"); void dice.offsetWidth; dice.classList.add("rolling");
  beep(220, 0.06); setTimeout(() => beep(330, 0.08), 280); setTimeout(() => beep(440, 0.1), 560);
  $("#diceMessage").textContent = "Dadu berputar…";
  await wait(950);
  dice.classList.remove("rolling");
  dice.dataset.value = roll;
  dice.setAttribute("aria-label", `Dadu menunjukkan angka ${roll}`);
  $("#diceMessage").textContent = `Dapat angka ${roll}!`;
  await movePlayer(roll);
}

async function movePlayer(steps) {
  const player = game.players[game.currentIndex];
  let direction = 1;
  for (let step = 0; step < steps; step += 1) {
    if (player.position === 100) direction = -1;
    player.position += direction;
    beep(500 + player.position * 2, 0.035, "square", 0.025);
    renderGameState();
    await wait(210);
  }
  if (player.position === 100) return showWinner(player);
  if (LADDER[player.position]) {
    $("#diceMessage").textContent = `Naik tangga ke ${LADDER[player.position]}!`;
    await travelSpecial(player, LADDER[player.position], 1, "ladder");
  } else if (SNAKE[player.position]) {
    $("#diceMessage").textContent = `Digigit ular, turun ke ${SNAKE[player.position]}!`;
    await travelSpecial(player, SNAKE[player.position], -1, "snake");
  }
  saveGame();
  const challenge = game.trapMap[player.position];
  if (challenge) openChallenge(challenge, player);
  else finishTurn();
}

async function travelSpecial(player, destination, direction, type) {
  beep(type === "ladder" ? 700 : 180, 0.25, type === "ladder" ? "sine" : "sawtooth", 0.05);
  const distance = Math.abs(destination - player.position);
  const stride = Math.max(1, Math.ceil(distance / 12));
  while (player.position !== destination) {
    player.position += direction * Math.min(stride, Math.abs(destination - player.position));
    renderGameState();
    await wait(75);
  }
}

function openChallenge(challenge, player) {
  $("#challengePlayer").textContent = `Giliran ${player.name} · Kotak ${player.position}`;
  $("#challengeText").textContent = challenge.text;
  $("#challengeTypeBadge").textContent = challenge.timed ? "⏱ TANTANGAN TIMER" : "⚡ TANTANGAN LANGSUNG";
  $("#timerControls").classList.toggle("hidden", !challenge.timed);
  $("#timerDisplay").classList.add("hidden");
  $("#startTimerBtn").disabled = false;
  $("#doneChallengeBtn").disabled = false;
  $("#timerValue").textContent = formatTime(chosenDuration);
  $("#challengeModal").classList.remove("hidden");
  beep(620, 0.12); setTimeout(() => beep(820, 0.15), 120);
}

function startTimer() {
  clearInterval(timerId);
  let remaining = chosenDuration;
  $("#timerDisplay").classList.remove("hidden");
  $("#startTimerBtn").disabled = true;
  $("#timerStatus").textContent = "Waktu berjalan…";
  $("#timerValue").textContent = formatTime(remaining);
  timerId = setInterval(() => {
    remaining -= 1;
    $("#timerValue").textContent = formatTime(Math.max(0, remaining));
    if (remaining <= 5 && remaining > 0) beep(760, 0.05, "square", 0.035);
    if (remaining <= 0) {
      clearInterval(timerId);
      $("#timerStatus").textContent = "Waktu habis! Tekan DONE";
      $("#timerDisplay").classList.add("finished");
      beep(950, 0.16, "sine", 0.08); setTimeout(() => beep(1150, 0.25, "sine", 0.08), 180);
    }
  }, 1000);
}

function closeChallenge() {
  clearInterval(timerId);
  $("#challengeModal").classList.add("hidden");
  $("#timerDisplay").classList.remove("finished");
  finishTurn();
}

function finishTurn() {
  game.currentIndex = (game.currentIndex + 1) % game.players.length;
  game.turn += 1;
  busy = false;
  $("#rollBtn").disabled = false;
  $("#diceMessage").textContent = `Giliran ${game.players[game.currentIndex].name}, putar dadu`;
  renderGameState();
  saveGame();
}

function showWinner(player) {
  localStorage.removeItem(STORAGE.game);
  $("#winnerTitle").textContent = `${player.name} Menang!`;
  $("#winnerModal").classList.remove("hidden");
  busy = false;
  victorySound();
}

function resetToSetup() {
  if (!confirm("Mulai ulang? Posisi permainan saat ini akan dihapus.")) return;
  localStorage.removeItem(STORAGE.game);
  game = null;
  openSetup(selectedLevel);
}

function beep(frequency, duration, type = "sine", volume = 0.04) {
  if (muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.value = volume;
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration); oscillator.stop(audioContext.currentTime + duration);
  } catch {}
}

function victorySound() { [523, 659, 784, 1046].forEach((note, index) => setTimeout(() => beep(note, 0.3, "sine", 0.07), index * 170)); }
function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }

let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout); const toast = $("#toast"); toast.textContent = message; toast.classList.remove("hidden");
  toastTimeout = setTimeout(() => toast.classList.add("hidden"), 2200);
}

$("#backBtn").addEventListener("click", goBack);
$("#brandBtn").addEventListener("click", goHome);
$("#muteBtn").addEventListener("click", () => { muted = !muted; localStorage.setItem(STORAGE.mute, JSON.stringify(muted)); $("#muteBtn").textContent = muted ? "🔇" : "🔊"; $("#muteBtn").setAttribute("aria-label", muted ? "Nyalakan suara" : "Matikan suara"); });
$$('[data-game]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.game === "snake") return showScreen("levelScreen");
  const data = { wheel: ["🎡", "Spin Wheel"], ludo: ["🎯", "Ludo"], cards: ["🃏", "Kartu Tantangan"], words: ["💬", "Tebak Kata"] }[button.dataset.game];
  $("#placeholderIcon").textContent = data[0]; $("#placeholderTitle").textContent = data[1]; showScreen("placeholderScreen");
}));
$$('[data-level]').forEach((button) => button.addEventListener("click", () => openSetup(button.dataset.level)));
$("#addPlayerBtn").addEventListener("click", () => { if (playerCount < 4) { playerCount += 1; renderPlayerInputs(); } });
$("#playerInputs").addEventListener("click", (event) => {
  const index = event.target.dataset.removePlayer;
  if (index !== undefined && playerCount > 2) {
    const remainingNames = $$(".player-name").map((input) => input.value).filter((_, playerIndex) => playerIndex !== Number(index));
    playerCount -= 1;
    renderPlayerInputs(remainingNames);
  }
});
$("#challengeList").addEventListener("change", updateSelectedCount);
$("#challengeList").addEventListener("click", (event) => { const id = event.target.dataset.deleteCustom; if (id) { event.preventDefault(); deleteCustom(id); } });
$("#selectAllBtn").addEventListener("click", () => { $$("#challengeList input").forEach((input) => { input.checked = true; }); updateSelectedCount(); });
$("#clearAllBtn").addEventListener("click", () => { $$("#challengeList input").forEach((input) => { input.checked = false; }); updateSelectedCount(); });
$("#customChallengeForm").addEventListener("submit", addCustomChallenge);
$("#startGameBtn").addEventListener("click", startGame);
$("#rollBtn").addEventListener("click", rollDice);
$("#newGameBtn").addEventListener("click", resetToSetup);
$("#doneChallengeBtn").addEventListener("click", closeChallenge);
$("#startTimerBtn").addEventListener("click", startTimer);
$$('[data-duration]').forEach((button) => button.addEventListener("click", () => { chosenDuration = Number(button.dataset.duration); $$('[data-duration]').forEach((item) => item.classList.toggle("selected", item === button)); $("#timerValue").textContent = formatTime(chosenDuration); }));
$("#resumeBtn").addEventListener("click", () => { try { game = JSON.parse(localStorage.getItem(STORAGE.game)); if (game) enterGame(); } catch { localStorage.removeItem(STORAGE.game); updateResumeButton(); } });
$("#playAgainBtn").addEventListener("click", () => { $("#winnerModal").classList.add("hidden"); game = null; openSetup(selectedLevel); });
$$('[data-back-home]').forEach((button) => button.addEventListener("click", () => { $("#winnerModal").classList.add("hidden"); goHome(); }));

$("#muteBtn").textContent = muted ? "🔇" : "🔊";
renderPlayerInputs();
updateResumeButton();
