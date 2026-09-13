import { LEVELS } from "./challenges.js";
import { WORD_LEVELS } from "./words.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE = { custom: "gp-custom-v1", customWords: "gp-custom-words-v1", selected: "gp-selected-v1", selectedCards: "gp-card-selected-v1", selectedWheel: "gp-wheel-selected-v1", selectedWords: "gp-word-selected-v1", wordDuration: "gp-word-duration-v1", mute: "gp-muted-v1", game: "gp-current-game-v1", cardGame: "gp-card-game-v1", wheelGame: "gp-wheel-game-v1", wordGame: "gp-word-game-v1", ludoGame: "gp-ludo-game-v1" };
const COLORS = ["#ff3d81", "#6ee7ff", "#ffd166", "#9bff8a"];
const LUDO_COLORS = ["#ef3f5d", "#35c87a", "#ffd166", "#4f9cff"];
const LUDO_COLOR_NAMES = ["Merah", "Hijau", "Kuning", "Biru"];
const LUDO_STARTS = [0, 13, 26, 39];
const LUDO_SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const LUDO_PATH = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
const LUDO_LANES = [
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
];
const LADDER = { 3: 22, 8: 26, 20: 41, 28: 55, 36: 57, 51: 72, 63: 81, 71: 92 };
const SNAKE = { 17: 4, 31: 12, 47: 25, 59: 38, 69: 49, 78: 56, 88: 67, 97: 76 };
const SPECIAL_CELLS = new Set([...Object.keys(LADDER), ...Object.values(LADDER), ...Object.keys(SNAKE), ...Object.values(SNAKE)].map(Number));

let currentScreen = "homeScreen";
let selectedLevel = 1;
let selectedGameMode = "snake";
let playerCount = 2;
let game = null;
let cardGame = null;
let wheelGame = null;
let wordGame = null;
let ludoGame = null;
let wheelRotation = 0;
let wordTimerId = null;
let challengeOwner = "snake";
let busy = false;
let timerId = null;
let chosenDuration = 30;
let wordDuration = 30;
let muted = JSON.parse(localStorage.getItem(STORAGE.mute) ?? "false");
let audioContext;

const screens = $$(".screen");
const screenHistory = [];

document.addEventListener("click", (event) => {
  const levelButton = event.target.closest("[data-level]");
  if (!levelButton) return;
  event.preventDefault();
  openSetup(levelButton.dataset.level);
});

function showScreen(id, remember = true) {
  if (remember && currentScreen !== id) screenHistory.push(currentScreen);
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  currentScreen = id;
  $("#backBtn").classList.toggle("hidden", id === "homeScreen" || id === "gameScreen" || id === "cardGameScreen" || id === "wheelGameScreen" || id === "wordGameScreen" || id === "ludoGameScreen");
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

function selectionStorageKey() {
  if (selectedGameMode === "cards") return STORAGE.selectedCards;
  if (selectedGameMode === "wheel") return STORAGE.selectedWheel;
  return STORAGE.selected;
}

function getSavedSelected(level = selectedLevel) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(selectionStorageKey())) || {}; } catch {}
  const allIds = getChallenges(level).map((item) => item.id);
  return new Set(Array.isArray(saved[level]) ? saved[level].filter((id) => allIds.includes(id)) : allIds);
}

function saveSelected(ids, level = selectedLevel) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(selectionStorageKey())) || {}; } catch {}
  saved[level] = [...ids];
  localStorage.setItem(selectionStorageKey(), JSON.stringify(saved));
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
    ? selectedGameMode === "cards"
      ? `${checked.length} kartu akan dikocok dan dimainkan tanpa pengulangan dalam satu ronde.`
      : selectedGameMode === "wheel"
        ? `${checked.length} tantangan aktif dan memiliki peluang yang sama saat roda diputar.`
      : checked.length < 30 ? `${checked.length} tantangan terpilih akan diulang secara acak hingga mengisi 30 kotak.` : "Tantangan akan diacak merata, 3 jebakan pada setiap baris."
    : "Pilih minimal satu tantangan untuk memulai.";
  saveSelected(new Set(checked.map((input) => input.value)));
}

function openSetup(level) {
  selectedLevel = Number(level);
  if (selectedGameMode === "words") return openWordSetup();
  const prefix = selectedGameMode === "cards" ? "KARTU TANTANGAN" : selectedGameMode === "wheel" ? "SPIN WHEEL" : "ULAR TANGGA";
  const levelText = selectedLevel === 1 ? `${prefix} · LEVEL 1 · ROMANTIS` : `${prefix} · LEVEL 2 · HOT & BERANI · 18+`;
  $("#setupEyebrow").textContent = levelText;
  $("#selectionTitle").textContent = selectedGameMode === "cards" ? "Pilih kartu" : selectedGameMode === "wheel" ? "Pilih tantangan" : "Pilih jebakan";
  $("#selectionDescription").textContent = selectedGameMode === "cards" ? "akan dikocok menjadi satu dek" : selectedGameMode === "wheel" ? "akan dimasukkan ke roda" : "akan mengisi 30 kotak";
  $("#startGameBtn").textContent = selectedGameMode === "cards" ? "Kocok Kartu & Mulai" : selectedGameMode === "wheel" ? "Buat Roda & Mulai" : "Acak Papan & Mulai";
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
  if (selectedGameMode === "cards") return startCardGame(names, selectedChallenges);
  if (selectedGameMode === "wheel") return startWheelGame(names, selectedChallenges);
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
  $("#resumeCardsBtn").classList.toggle("hidden", !localStorage.getItem(STORAGE.cardGame));
  $("#resumeWheelBtn").classList.toggle("hidden", !localStorage.getItem(STORAGE.wheelGame));
  $("#resumeWordsBtn").classList.toggle("hidden", !localStorage.getItem(STORAGE.wordGame));
  $("#resumeLudoBtn").classList.toggle("hidden", !localStorage.getItem(STORAGE.ludoGame));
}

function enterGame() {
  selectedGameMode = "snake";
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
  if (challenge) openChallenge(challenge, player, `Kotak ${player.position}`, "snake");
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

function openChallenge(challenge, player, contextLabel = "", owner = "snake") {
  challengeOwner = owner;
  $("#challengePlayer").textContent = `Giliran ${player.name}${contextLabel ? ` · ${contextLabel}` : ""}`;
  $("#challengeText").textContent = challenge.text;
  $("#challengeTypeBadge").textContent = challenge.timed ? "⏱ TANTANGAN TIMER" : "⚡ TANTANGAN LANGSUNG";
  $("#timerControls").classList.toggle("hidden", !challenge.timed);
  $("#timerDisplay").classList.add("hidden");
  $("#startTimerBtn").disabled = false;
  $("#doneChallengeBtn").disabled = challenge.timed;
  $$("[data-duration]").forEach((button) => { button.disabled = false; });
  $("#timerValue").textContent = formatTime(chosenDuration);
  $("#challengeModal").classList.remove("hidden");
  beep(620, 0.12); setTimeout(() => beep(820, 0.15), 120);
}

function startTimer() {
  clearInterval(timerId);
  let remaining = chosenDuration;
  $("#timerDisplay").classList.remove("hidden");
  $("#startTimerBtn").disabled = true;
  $$("[data-duration]").forEach((button) => { button.disabled = true; });
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
      $("#doneChallengeBtn").disabled = false;
      beep(950, 0.16, "sine", 0.08); setTimeout(() => beep(1150, 0.25, "sine", 0.08), 180);
    }
  }, 1000);
}

function closeChallenge() {
  clearInterval(timerId);
  $("#challengeModal").classList.add("hidden");
  $("#timerDisplay").classList.remove("finished");
  if (challengeOwner === "cards") finishCardTurn();
  else if (challengeOwner === "wheel") finishWheelTurn();
  else finishTurn();
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
  selectedGameMode = "snake";
  openSetup(selectedLevel);
}

function openLevelSelection(mode) {
  selectedGameMode = mode;
  const labels = {
    snake: ["ULAR TANGGA PASANGAN", "Keduanya memakai papan yang sama, tetapi tantangannya berbeda."],
    cards: ["KARTU TANTANGAN PASANGAN", "Pilih suasana kartu yang ingin kalian mainkan malam ini."],
    wheel: ["SPIN WHEEL PASANGAN", "Pilih level, atur tantangan, lalu biarkan roda menentukan giliran kalian."],
    words: ["TEBAK KATA PASANGAN", "Pilih level kata, lalu buktikan seberapa kompak kalian dalam 30 detik."]
  }[mode];
  $("#levelEyebrow").textContent = labels[0];
  $("#levelDescription").textContent = labels[1];
  showScreen("levelScreen");
}

function startCardGame(names, selectedChallenges) {
  cardGame = {
    level: selectedLevel,
    players: names.map((name, index) => ({ name, color: COLORS[index], completed: 0 })),
    currentIndex: Math.floor(Math.random() * names.length),
    sourceChallenges: selectedChallenges,
    remainingDeck: shuffle(selectedChallenges),
    drawnCount: 0
  };
  saveCardGame();
  enterCardGame();
}

function saveCardGame() {
  if (cardGame) localStorage.setItem(STORAGE.cardGame, JSON.stringify(cardGame));
  updateResumeButton();
}

function enterCardGame() {
  selectedGameMode = "cards";
  selectedLevel = Number(cardGame.level);
  $("#cardGameLevelLabel").textContent = selectedLevel === 1 ? "KARTU · LEVEL 1 · ROMANTIS" : "KARTU · LEVEL 2 · HOT & BERANI";
  renderCardGameState();
  showScreen("cardGameScreen", false);
}

function renderCardGameState() {
  const current = cardGame.players[cardGame.currentIndex];
  $("#cardTurnLabel").textContent = `Giliran ${current.name}`;
  $("#cardsRemaining").textContent = cardGame.remainingDeck.length;
  $("#cardDeckStatus").textContent = cardGame.remainingDeck.length
    ? `${cardGame.remainingDeck.length} kartu tersisa di dalam dek`
    : "Semua kartu sudah dimainkan";
  $("#cardPlayerStatus").innerHTML = cardGame.players.map((player, index) => `
    <div class="status-card ${index === cardGame.currentIndex ? "current" : ""}" style="--token:${player.color}">
      <span class="status-token">${index + 1}</span>
      <span><strong>${escapeHtml(player.name)}</strong><small>${player.completed} tantangan selesai</small></span>
      ${index === cardGame.currentIndex ? `<b>GILIRAN</b>` : ""}
    </div>`).join("");
  $("#drawCardBtn").disabled = busy || !cardGame.remainingDeck.length;
}

async function drawChallengeCard() {
  if (busy || !cardGame || !cardGame.remainingDeck.length) return;
  busy = true;
  $("#drawCardBtn").disabled = true;
  const deck = $("#cardDeck");
  deck.classList.remove("drawing");
  void deck.offsetWidth;
  deck.classList.add("drawing");
  $("#cardDeckStatus").textContent = "Mengambil kartu…";
  beep(360, 0.07, "square", 0.035);
  setTimeout(() => beep(520, 0.09, "square", 0.04), 300);
  await wait(850);
  deck.classList.remove("drawing");
  const challenge = cardGame.remainingDeck.pop();
  cardGame.drawnCount += 1;
  saveCardGame();
  renderCardGameState();
  openChallenge(challenge, cardGame.players[cardGame.currentIndex], `Kartu ${cardGame.drawnCount}`, "cards");
}

function finishCardTurn() {
  const player = cardGame.players[cardGame.currentIndex];
  player.completed += 1;
  cardGame.currentIndex = (cardGame.currentIndex + 1) % cardGame.players.length;
  busy = false;
  if (!cardGame.remainingDeck.length) {
    localStorage.removeItem(STORAGE.cardGame);
    updateResumeButton();
    $("#cardRoundModal").classList.remove("hidden");
    victorySound();
    renderCardGameState();
    return;
  }
  saveCardGame();
  renderCardGameState();
  $("#cardDeckStatus").textContent = `Giliran ${cardGame.players[cardGame.currentIndex].name}, ambil satu kartu`;
}

function shuffleCardRoundAgain() {
  cardGame.players.forEach((player) => { player.completed = 0; });
  cardGame.remainingDeck = shuffle(cardGame.sourceChallenges);
  cardGame.drawnCount = 0;
  cardGame.currentIndex = Math.floor(Math.random() * cardGame.players.length);
  busy = false;
  $("#cardRoundModal").classList.add("hidden");
  saveCardGame();
  renderCardGameState();
  beep(520, 0.1); setTimeout(() => beep(720, 0.13), 110);
}

function resetCardGameToSetup() {
  if (!confirm("Atur ulang kartu? Ronde yang sedang berjalan akan dihapus.")) return;
  localStorage.removeItem(STORAGE.cardGame);
  cardGame = null;
  selectedGameMode = "cards";
  openSetup(selectedLevel);
}

function startWheelGame(names, selectedChallenges) {
  wheelGame = {
    level: selectedLevel,
    players: names.map((name, index) => ({ name, color: COLORS[index], completed: 0 })),
    currentIndex: Math.floor(Math.random() * names.length),
    challenges: selectedChallenges,
    spinCount: 0,
    lastChallengeId: null,
    rotation: 0
  };
  wheelRotation = 0;
  saveWheelGame();
  enterWheelGame();
}

function saveWheelGame() {
  if (wheelGame) {
    wheelGame.rotation = wheelRotation;
    localStorage.setItem(STORAGE.wheelGame, JSON.stringify(wheelGame));
  }
  updateResumeButton();
}

function enterWheelGame() {
  selectedGameMode = "wheel";
  selectedLevel = Number(wheelGame.level);
  wheelRotation = Number(wheelGame.rotation || 0);
  $("#wheelGameLevelLabel").textContent = selectedLevel === 1 ? "SPIN WHEEL · LEVEL 1 · ROMANTIS" : "SPIN WHEEL · LEVEL 2 · HOT & BERANI";
  buildWheelVisual();
  renderWheelGameState();
  showScreen("wheelGameScreen", false);
}

function wheelGradient(count) {
  const palette = ["#ff3d81", "#9c4dff", "#ff8a4c", "#d52eaa", "#6d45d9", "#ef315e"];
  const step = 360 / count;
  const stops = [];
  for (let index = 0; index < count; index += 1) {
    stops.push(`${palette[index % palette.length]} ${index * step}deg ${(index + 1) * step}deg`);
  }
  return `conic-gradient(from 0deg, ${stops.join(",")})`;
}

function buildWheelVisual() {
  const wheel = $("#challengeWheel");
  const count = wheelGame.challenges.length;
  wheel.style.setProperty("--wheel-gradient", wheelGradient(count));
  wheel.style.setProperty("--wheel-rotation", `${wheelRotation}deg`);
  wheel.style.setProperty("--wheel-counter-rotation", `${-wheelRotation}deg`);
  $("#wheelChoiceCount").textContent = count;
}

function renderWheelGameState() {
  const current = wheelGame.players[wheelGame.currentIndex];
  $("#wheelTurnLabel").textContent = `Giliran ${current.name}`;
  $("#wheelSpinCount").textContent = wheelGame.spinCount;
  $("#wheelPlayerStatus").innerHTML = wheelGame.players.map((player, index) => `
    <div class="status-card ${index === wheelGame.currentIndex ? "current" : ""}" style="--token:${player.color}">
      <span class="status-token">${index + 1}</span>
      <span><strong>${escapeHtml(player.name)}</strong><small>${player.completed} tantangan selesai</small></span>
      ${index === wheelGame.currentIndex ? `<b>GILIRAN</b>` : ""}
    </div>`).join("");
  $("#spinWheelBtn").disabled = busy;
}

async function spinChallengeWheel() {
  if (busy || !wheelGame?.challenges.length) return;
  busy = true;
  $("#spinWheelBtn").disabled = true;
  const count = wheelGame.challenges.length;
  let selectedIndex = Math.floor(Math.random() * count);
  if (count > 1) {
    while (wheelGame.challenges[selectedIndex].id === wheelGame.lastChallengeId) selectedIndex = Math.floor(Math.random() * count);
  }
  const segmentAngle = 360 / count;
  const desiredModulo = (360 - (selectedIndex + 0.5) * segmentAngle) % 360;
  const currentModulo = ((wheelRotation % 360) + 360) % 360;
  const correction = (desiredModulo - currentModulo + 360) % 360;
  wheelRotation += 1440 + correction;
  const wheel = $("#challengeWheel");
  wheel.classList.add("spinning");
  wheel.style.setProperty("--wheel-rotation", `${wheelRotation}deg`);
  wheel.style.setProperty("--wheel-counter-rotation", `${-wheelRotation}deg`);
  $("#wheelMessage").textContent = "Roda sedang berputar…";
  [0, 260, 520, 780, 1040, 1300, 1580, 1880, 2200, 2550, 2920, 3320, 3720].forEach((delay, index) => setTimeout(() => beep(340 + index * 14, 0.035, "square", 0.025), delay));
  await wait(4300);
  wheel.classList.remove("spinning");
  const challenge = wheelGame.challenges[selectedIndex];
  wheelGame.lastChallengeId = challenge.id;
  wheelGame.spinCount += 1;
  saveWheelGame();
  renderWheelGameState();
  $("#wheelMessage").textContent = "Tantangan terpilih!";
  beep(760, 0.12); setTimeout(() => beep(980, 0.18), 140);
  openChallenge(challenge, wheelGame.players[wheelGame.currentIndex], `Putaran ${wheelGame.spinCount}`, "wheel");
}

function finishWheelTurn() {
  wheelGame.players[wheelGame.currentIndex].completed += 1;
  wheelGame.currentIndex = (wheelGame.currentIndex + 1) % wheelGame.players.length;
  busy = false;
  saveWheelGame();
  renderWheelGameState();
  $("#wheelMessage").textContent = `Giliran ${wheelGame.players[wheelGame.currentIndex].name}, putar roda`;
}

function resetWheelGameToSetup() {
  if (!confirm("Atur ulang roda? Permainan yang sedang berjalan akan dihapus.")) return;
  localStorage.removeItem(STORAGE.wheelGame);
  wheelGame = null;
  selectedGameMode = "wheel";
  openSetup(selectedLevel);
}



function renderLudoPlayerInputs(values) {
  const holder = $("#ludoPlayerInputs");
  const oldValues = values || $("#ludoPlayerInputs .player-name").map((input) => input.value);
  holder.innerHTML = "";
  for (let index = 0; index < playerCount; index += 1) {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `<span class="player-color" style="--player-color:${LUDO_COLORS[index]}">${index + 1}</span><input class="player-name" maxlength="18" value="${escapeHtml(oldValues[index] || `Pemain ${index + 1}`)}" aria-label="Nama pemain ${index + 1}">${playerCount > 2 ? `<button class="remove-player" data-remove-ludo-player="${index}" aria-label="Hapus pemain">×</button>` : ""}`;
    holder.appendChild(row);
  }
  $("#addLudoPlayerBtn").disabled = playerCount >= 4;
}

function openLudoSetup() {
  selectedGameMode = "ludo";
  renderLudoPlayerInputs();
  showScreen("ludoSetupScreen");
}

function startLudoGame() {
  const names = $("#ludoPlayerInputs .player-name").map((input, index) => input.value.trim() || `Pemain ${index + 1}`);
  ludoGame = {
    players: names.map((name, index) => ({ name, color: LUDO_COLORS[index], pieces: [-1, -1, -1, -1] })),
    currentIndex: Math.floor(Math.random() * names.length),
    phase: "roll",
    dice: 1,
    turn: 1,
    message: "Tekan dadu untuk mulai"
  };
  saveLudoGame();
  enterLudoGame();
}

function saveLudoGame() {
  if (ludoGame) localStorage.setItem(STORAGE.ludoGame, JSON.stringify(ludoGame));
  updateResumeButton();
}

function enterLudoGame() {
  selectedGameMode = "ludo";
  busy = false;
  renderLudoBoard();
  renderLudoState();
  showScreen("ludoGameScreen", false);
}

function ludoCoordKey(coord) { return `${coord[0]}-${coord[1]}`; }

function renderLudoBoard() {
  const board = $("#ludoBoard");
  board.innerHTML = "";
  const pathMap = new Map(LUDO_PATH.map((coord, index) => [ludoCoordKey(coord), index]));
  const laneMap = new Map();
  LUDO_LANES.forEach((lane, playerIndex) => lane.forEach((coord) => laneMap.set(ludoCoordKey(coord), playerIndex)));
  for (let row = 0; row < 15; row += 1) {
    for (let col = 0; col < 15; col += 1) {
      const cell = document.createElement("div");
      const key = `${row}-${col}`;
      cell.className = "ludo-cell";
      cell.dataset.coord = key;
      if (pathMap.has(key)) {
        const pathIndex = pathMap.get(key);
        cell.classList.add("ludo-path");
        if (LUDO_SAFE.has(pathIndex)) { cell.classList.add("ludo-safe"); cell.innerHTML = "<span>★</span>"; }
        const startPlayer = LUDO_STARTS.indexOf(pathIndex);
        if (startPlayer >= 0) cell.style.setProperty("--cell-color", LUDO_COLORS[startPlayer]);
      } else if (laneMap.has(key)) {
        const owner = laneMap.get(key);
        cell.classList.add("ludo-lane");
        cell.style.setProperty("--cell-color", LUDO_COLORS[owner]);
      }
      if (row === 7 && col === 7) { cell.classList.add("ludo-center"); cell.innerHTML = "<span>🏆</span>"; }
      board.appendChild(cell);
    }
  }
  const positions = ["tl", "tr", "br", "bl"];
  ludoGame.players.forEach((player, index) => {
    const base = document.createElement("div");
    base.className = `ludo-base ludo-base-${positions[index]}`;
    base.dataset.player = index;
    base.style.setProperty("--base-color", player.color);
    base.innerHTML = `<strong>${escapeHtml(player.name)}</strong><div class="ludo-base-spots"></div>`;
    board.appendChild(base);
  });
  placeLudoPieces();
}

function globalLudoPosition(playerIndex, progress) {
  return (LUDO_STARTS[playerIndex] + progress) % 52;
}

function pieceCoord(playerIndex, progress) {
  if (progress >= 0 && progress <= 51) return LUDO_PATH[globalLudoPosition(playerIndex, progress)];
  if (progress >= 52 && progress <= 57) return LUDO_LANES[playerIndex][progress - 52];
  return [7, 7];
}

function movableLudoPieces() {
  if (!ludoGame || ludoGame.phase !== "select") return [];
  const player = ludoGame.players[ludoGame.currentIndex];
  return player.pieces.map((progress, index) => ({ progress, index })).filter(({ progress }) =>
    (progress === -1 && ludoGame.dice === 6) || (progress >= 0 && progress < 58 && progress + ludoGame.dice <= 58)
  ).map((item) => item.index);
}

function placeLudoPieces() {
  $("#ludoBoard .ludo-token").forEach((token) => token.remove());
  const movable = new Set(movableLudoPieces());
  ludoGame.players.forEach((player, playerIndex) => {
    player.pieces.forEach((progress, pieceIndex) => {
      const token = document.createElement("button");
      token.className = `ludo-token ${movable.has(pieceIndex) && playerIndex === ludoGame.currentIndex ? "movable" : ""}`;
      token.style.setProperty("--token", player.color);
      token.dataset.player = playerIndex;
      token.dataset.piece = pieceIndex;
      token.textContent = pieceIndex + 1;
      token.disabled = !(movable.has(pieceIndex) && playerIndex === ludoGame.currentIndex);
      if (progress === -1) {
        boardBase(playerIndex).querySelector(".ludo-base-spots").appendChild(token);
      } else {
        const coord = pieceCoord(playerIndex, progress);
        const cell = $(`#ludoBoard [data-coord="${ludoCoordKey(coord)}"]`);
        if (cell) cell.appendChild(token);
      }
    });
  });
}

function boardBase(playerIndex) { return $(`#ludoBoard .ludo-base[data-player="${playerIndex}"]`); }

function renderLudoState() {
  const current = ludoGame.players[ludoGame.currentIndex];
  $("#ludoTurnLabel").textContent = `Giliran ${current.name}`;
  $("#ludoDice").textContent = ["⚀","⚁","⚂","⚃","⚄","⚅"][ludoGame.dice - 1];
  $("#ludoMessage").textContent = ludoGame.message;
  $("#rollLudoBtn").disabled = busy || ludoGame.phase !== "roll";
  $("#ludoDice").disabled = busy || ludoGame.phase !== "roll";
  $("#ludoPlayerStatus").innerHTML = ludoGame.players.map((player, index) => {
    const finished = player.pieces.filter((piece) => piece >= 58).length;
    return `<div class="status-card ${index === ludoGame.currentIndex ? "current" : ""}" style="--token:${player.color}">
      <span class="status-token">${index + 1}</span><span><strong>${escapeHtml(player.name)}</strong><small>${finished}/4 pion finis</small></span>
      ${index === ludoGame.currentIndex ? "<b>GILIRAN</b>" : ""}</div>`;
  }).join("");
  placeLudoPieces();
}

async function rollLudoDice() {
  if (!ludoGame || ludoGame.phase !== "roll" || busy) return;
  busy = true;
  $("#ludoDice").classList.add("rolling");
  $("#ludoMessage").textContent = "Dadu berputar…";
  [260,340,430,520,610].forEach((frequency, index) => setTimeout(() => beep(frequency, .04, "square", .025), index * 100));
  await wait(700);
  ludoGame.dice = Math.floor(Math.random() * 6) + 1;
  $("#ludoDice").classList.remove("rolling");
  ludoGame.phase = "select";
  busy = false;
  const moves = movableLudoPieces();
  if (!moves.length) {
    ludoGame.message = `Dapat ${ludoGame.dice}. Tidak ada pion yang bisa bergerak.`;
    renderLudoState();
    saveLudoGame();
    await wait(1100);
    finishLudoTurn();
    return;
  }
  ludoGame.message = `Dapat ${ludoGame.dice}. Pilih pion yang ingin digerakkan.`;
  renderLudoState();
  saveLudoGame();
  beep(700, .1);
}

async function moveLudoPiece(pieceIndex) {
  if (!ludoGame || ludoGame.phase !== "select" || busy || !movableLudoPieces().includes(pieceIndex)) return;
  busy = true;
  const playerIndex = ludoGame.currentIndex;
  const player = ludoGame.players[playerIndex];
  let progress = player.pieces[pieceIndex];
  if (progress === -1) {
    player.pieces[pieceIndex] = 0;
    ludoGame.message = `${player.name} mengeluarkan pion ${pieceIndex + 1}.`;
    renderLudoState(); beep(620, .12); await wait(450);
  } else {
    for (let step = 0; step < ludoGame.dice; step += 1) {
      player.pieces[pieceIndex] += 1;
      renderLudoState();
      beep(350 + step * 22, .035, "square", .018);
      await wait(150);
    }
  }
  const finalProgress = player.pieces[pieceIndex];
  let captured = 0;
  if (finalProgress >= 0 && finalProgress <= 51) {
    const global = globalLudoPosition(playerIndex, finalProgress);
    if (!LUDO_SAFE.has(global)) {
      ludoGame.players.forEach((opponent, opponentIndex) => {
        if (opponentIndex === playerIndex) return;
        opponent.pieces = opponent.pieces.map((otherProgress) => {
          if (otherProgress >= 0 && otherProgress <= 51 && globalLudoPosition(opponentIndex, otherProgress) === global) {
            captured += 1; return -1;
          }
          return otherProgress;
        });
      });
    }
  }
  if (captured) { ludoGame.message = `${player.name} memakan ${captured} pion lawan!`; beep(900,.12); await wait(650); }
  if (finalProgress >= 58) { ludoGame.message = `Pion ${pieceIndex + 1} berhasil finis!`; victorySound(); await wait(650); }
  saveLudoGame();
  renderLudoState();
  if (player.pieces.every((piece) => piece >= 58)) return showLudoWinner(player);
  finishLudoTurn();
}

function finishLudoTurn() {
  busy = false;
  ludoGame.currentIndex = (ludoGame.currentIndex + 1) % ludoGame.players.length;
  ludoGame.phase = "roll";
  ludoGame.turn += 1;
  ludoGame.message = `Giliran ${ludoGame.players[ludoGame.currentIndex].name}. Tekan dadu.`;
  saveLudoGame();
  renderLudoState();
}

function showLudoWinner(player) {
  busy = false;
  localStorage.removeItem(STORAGE.ludoGame);
  updateResumeButton();
  $("#ludoWinnerTitle").textContent = `${player.name} Menang!`;
  $("#ludoWinnerModal").classList.remove("hidden");
  victorySound();
}

function resetLudoToSetup() {
  if (!confirm("Mulai ulang Ludo? Semua posisi pion akan dihapus.")) return;
  localStorage.removeItem(STORAGE.ludoGame);
  ludoGame = null;
  busy = false;
  openLudoSetup();
}

function getCustomWords() {
  try { return JSON.parse(localStorage.getItem(STORAGE.customWords)) || { 1: [], 2: [] }; }
  catch { return { 1: [], 2: [] }; }
}

function getWordChallenges(level = selectedLevel) {
  return [...WORD_LEVELS[level].words, ...(getCustomWords()[level] || [])];
}

function addCustomWord(event) {
  event.preventDefault();
  const input = $("#customWordInput");
  const text = input.value.trim();
  if (!text) return;
  const custom = getCustomWords();
  custom[selectedLevel] ||= [];
  const item = { id: `custom-word-${selectedLevel}-${Date.now()}`, text, custom: true };
  custom[selectedLevel].push(item);
  localStorage.setItem(STORAGE.customWords, JSON.stringify(custom));
  const selected = getSavedSelectedWords();
  selected.add(item.id);
  saveSelectedWords(selected);
  event.target.reset();
  renderWordList();
  showToast("Kata custom ditambahkan");
}

function deleteCustomWord(id) {
  const custom = getCustomWords();
  custom[selectedLevel] = (custom[selectedLevel] || []).filter((item) => item.id !== id);
  localStorage.setItem(STORAGE.customWords, JSON.stringify(custom));
  const selected = getSavedSelectedWords();
  selected.delete(id);
  saveSelectedWords(selected);
  renderWordList();
}

function getSavedSelectedWords(level = selectedLevel) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE.selectedWords)) || {}; } catch {}
  const allIds = getWordChallenges(level).map((item) => item.id);
  return new Set(Array.isArray(saved[level]) ? saved[level].filter((id) => allIds.includes(id)) : allIds);
}

function saveSelectedWords(ids, level = selectedLevel) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE.selectedWords)) || {}; } catch {}
  saved[level] = [...ids];
  localStorage.setItem(STORAGE.selectedWords, JSON.stringify(saved));
}

function renderWordPlayerInputs(values) {
  const holder = $("#wordPlayerInputs");
  const oldValues = values || $$("#wordPlayerInputs .player-name").map((input) => input.value);
  holder.innerHTML = "";
  for (let index = 0; index < playerCount; index += 1) {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `<span class="player-color" style="--player-color:${COLORS[index]}">${index + 1}</span><input class="player-name" maxlength="18" value="${escapeHtml(oldValues[index] || `Pemain ${index + 1}`)}" aria-label="Nama pemain ${index + 1}">${playerCount > 2 ? `<button class="remove-player" data-remove-word-player="${index}" aria-label="Hapus pemain ${index + 1}">×</button>` : ""}`;
    holder.appendChild(row);
  }
  $("#addWordPlayerBtn").disabled = playerCount >= 4;
}

function renderWordList() {
  const selected = getSavedSelectedWords();
  const words = getWordChallenges();
  const customIds = new Set((getCustomWords()[selectedLevel] || []).map((item) => item.id));
  $("#wordList").innerHTML = words.map((word, index) => `
    <label class="challenge-option word-option">
      <input type="checkbox" value="${word.id}" ${selected.has(word.id) ? "checked" : ""}>
      <span class="custom-checkbox">✓</span><span class="challenge-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="challenge-option-copy"><span>${escapeHtml(word.text)}</span><small>${customIds.has(word.id) ? "✍ Kata buatan sendiri" : "💬 Kata bawaan"}</small></span>
      ${customIds.has(word.id) ? `<button type="button" class="delete-custom" data-delete-custom-word="${word.id}" aria-label="Hapus kata custom">×</button>` : ""}
    </label>`).join("");
  updateSelectedWordCount();
}

function updateSelectedWordCount() {
  const checked = $$("#wordList input:checked");
  $("#selectedWordCount").textContent = checked.length;
  $("#startWordGameBtn").disabled = checked.length < 2;
  $("#wordSetupHint").textContent = checked.length < 2
    ? "Pilih minimal 2 kata untuk memulai."
    : `${checked.length} kata akan dikocok dan tidak langsung berulang.`;
  saveSelectedWords(new Set(checked.map((input) => input.value)));
}

function getSavedWordDuration(level = selectedLevel) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE.wordDuration)) || {}; } catch {}
  return [30, 60, 120, 180].includes(Number(saved[level])) ? Number(saved[level]) : 30;
}

function saveWordDuration(level = selectedLevel) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE.wordDuration)) || {}; } catch {}
  saved[level] = wordDuration;
  localStorage.setItem(STORAGE.wordDuration, JSON.stringify(saved));
}

function renderWordDurationPicker() {
  $$("[data-word-duration]").forEach((button) => {
    const selected = Number(button.dataset.wordDuration) === wordDuration;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const preview = $("#wordDurationPreview");
  if (preview) preview.textContent = wordDuration >= 60 ? `${wordDuration / 60} mnt` : `${wordDuration}`;
}

function formatWordDuration(seconds) {
  return seconds >= 60 ? `${seconds / 60} menit` : `${seconds} detik`;
}

function openWordSetup() {
  wordDuration = getSavedWordDuration();
  renderWordDurationPicker();
  $("#wordSetupEyebrow").textContent = selectedLevel === 1
    ? "TEBAK KATA · LEVEL 1 · ROMANTIS"
    : "TEBAK KATA · LEVEL 2 · HOT & VULGAR · 18+";
  renderWordPlayerInputs();
  renderWordList();
  showScreen("wordSetupScreen");
}

function startWordGame() {
  const names = $$("#wordPlayerInputs .player-name").map((input, index) => input.value.trim() || `Pemain ${index + 1}`);
  const selectedIds = new Set($$("#wordList input:checked").map((input) => input.value));
  const selectedWords = getWordChallenges().filter((item) => selectedIds.has(item.id));
  if (selectedWords.length < 2) return;
  wordDuration = getSavedWordDuration();
  saveWordDuration();
  wordGame = {
    level: selectedLevel,
    duration: wordDuration,
    players: names.map((name, index) => ({ name, color: COLORS[index], score: 0 })),
    currentIndex: Math.floor(Math.random() * names.length),
    sourceWords: selectedWords,
    remainingWords: shuffle(selectedWords),
    currentWord: null,
    phase: "ready",
    timeLeft: 30,
    endAt: null,
    round: 1,
    roundCorrect: 0,
    roundPassed: 0
  };
  saveWordGame();
  enterWordGame();
}

function saveWordGame() {
  if (wordGame) localStorage.setItem(STORAGE.wordGame, JSON.stringify(wordGame));
  updateResumeButton();
}

function enterWordGame() {
  selectedGameMode = "words";
  selectedLevel = Number(wordGame.level);
  wordDuration = [30, 60, 120, 180].includes(Number(wordGame.duration)) ? Number(wordGame.duration) : 30;
  wordGame.duration = wordDuration;
  $("#wordGameLevelLabel").textContent = selectedLevel === 1
    ? "TEBAK KATA · LEVEL 1 · ROMANTIS"
    : "TEBAK KATA · LEVEL 2 · HOT & VULGAR · 18+";
  if (wordGame.phase === "playing") {
    const remaining = Math.max(0, Math.ceil((Number(wordGame.endAt) - Date.now()) / 1000));
    wordGame.timeLeft = remaining;
    if (remaining > 0) startWordTimerLoop();
    else finishWordRound();
  }
  renderWordGameState();
  showScreen("wordGameScreen", false);
}

function drawNextWord() {
  if (!wordGame.remainingWords.length) wordGame.remainingWords = shuffle(wordGame.sourceWords);
  let next = wordGame.remainingWords.pop();
  if (wordGame.sourceWords.length > 1 && next?.id === wordGame.currentWord?.id) {
    wordGame.remainingWords.unshift(next);
    next = wordGame.remainingWords.pop();
  }
  wordGame.currentWord = next;
}

function renderWordGameState() {
  const player = wordGame.players[wordGame.currentIndex];
  const isReady = wordGame.phase === "ready";
  const isPlaying = wordGame.phase === "playing";
  const isSummary = wordGame.phase === "summary";
  $("#wordTurnLabel").textContent = `Giliran ${player.name}`;
  $("#wordRoleText").textContent = isPlaying ? `${player.name} menjelaskan · pasangan menebak` : isSummary ? "Lihat hasil ronde kalian" : `${player.name}, bersiaplah menjelaskan`;
  $("#wordTimer").textContent = formatTime(wordGame.timeLeft);
  $("#startWordRoundBtn").textContent = `▶ MULAI RONDE ${formatWordDuration(wordGame.duration || wordDuration).toUpperCase()}`;
  $("#wordTimer").classList.toggle("urgent", isPlaying && wordGame.timeLeft <= 10);
  $("#wordCard").classList.toggle("active", isPlaying);
  $("#wordCardIcon").textContent = isPlaying ? "💡" : isSummary ? "✨" : "💬";
  $("#wordCardLabel").textContent = isPlaying ? "JELASKAN KATA INI" : isSummary ? "RONDE SELESAI" : "RONDE SIAP";
  $("#currentWord").textContent = isPlaying && wordGame.currentWord ? wordGame.currentWord.text : isSummary ? `+${wordGame.roundCorrect} poin` : "Tekan tombol mulai";
  $("#startWordRoundBtn").classList.toggle("hidden", !isReady);
  $("#wordAnswerControls").classList.toggle("hidden", !isPlaying);
  $("#wordRoundResult").classList.toggle("hidden", !isSummary);
  $("#wordRoundScore").textContent = `${wordGame.roundCorrect} kata benar · ${wordGame.roundPassed} dilewati`;
  $("#wordRoundNumber").textContent = wordGame.round;
  $("#wordPlayerStatus").innerHTML = wordGame.players.map((item, index) => `
    <div class="status-card ${index === wordGame.currentIndex ? "current" : ""}" style="--token:${item.color}">
      <span class="status-token">${index + 1}</span>
      <span><strong>${escapeHtml(item.name)}</strong><small>${item.score} poin</small></span>
      ${index === wordGame.currentIndex ? `<b>GILIRAN</b>` : ""}
    </div>`).join("");
}

async function startWordRound() {
  if (!wordGame || wordGame.phase !== "ready" || busy) return;
  busy = true;
  $("#startWordRoundBtn").disabled = true;
  $("#wordCountdown").classList.remove("hidden");
  for (const count of [3, 2, 1]) {
    $("#wordCountdown").textContent = count;
    beep(420 + count * 90, 0.09, "square", 0.04);
    await wait(650);
  }
  $("#wordCountdown").textContent = "MULAI!";
  beep(900, 0.15, "sine", 0.06);
  await wait(450);
  $("#wordCountdown").classList.add("hidden");
  wordGame.phase = "playing";
  wordGame.timeLeft = wordGame.duration || wordDuration;
  wordGame.endAt = Date.now() + (wordGame.duration || wordDuration) * 1000;
  wordGame.roundCorrect = 0;
  wordGame.roundPassed = 0;
  drawNextWord();
  busy = false;
  $("#startWordRoundBtn").disabled = false;
  saveWordGame();
  renderWordGameState();
  startWordTimerLoop();
}

function startWordTimerLoop() {
  clearInterval(wordTimerId);
  wordTimerId = setInterval(() => {
    if (!wordGame || wordGame.phase !== "playing") return clearInterval(wordTimerId);
    const remaining = Math.max(0, Math.ceil((Number(wordGame.endAt) - Date.now()) / 1000));
    if (remaining !== wordGame.timeLeft) {
      wordGame.timeLeft = remaining;
      $("#wordTimer").textContent = formatTime(remaining);
      $("#wordTimer").classList.toggle("urgent", remaining <= 10);
      if (remaining <= 5 && remaining > 0) beep(360, 0.05, "square", 0.025);
    }
    if (remaining <= 0) finishWordRound();
  }, 200);
}

function answerWord(correct) {
  if (!wordGame || wordGame.phase !== "playing") return;
  if (correct) {
    wordGame.players[wordGame.currentIndex].score += 1;
    wordGame.roundCorrect += 1;
    beep(760, 0.08); setTimeout(() => beep(960, 0.1), 80);
  } else {
    wordGame.roundPassed += 1;
    beep(260, 0.07, "square", 0.025);
  }
  drawNextWord();
  saveWordGame();
  renderWordGameState();
}

function finishWordRound() {
  if (!wordGame || wordGame.phase === "summary") return;
  clearInterval(wordTimerId);
  wordGame.phase = "summary";
  wordGame.timeLeft = 0;
  wordGame.endAt = null;
  saveWordGame();
  renderWordGameState();
  victorySound();
}

function nextWordTurn() {
  if (!wordGame || wordGame.phase !== "summary") return;
  wordGame.currentIndex = (wordGame.currentIndex + 1) % wordGame.players.length;
  wordGame.round += 1;
  wordGame.phase = "ready";
  wordGame.timeLeft = wordGame.duration || wordDuration;
  wordGame.currentWord = null;
  wordGame.roundCorrect = 0;
  wordGame.roundPassed = 0;
  saveWordGame();
  renderWordGameState();
  beep(520, 0.1); setTimeout(() => beep(720, 0.12), 100);
}

function resetWordGameToSetup() {
  if (!confirm("Atur ulang Tebak Kata? Skor permainan saat ini akan dihapus.")) return;
  clearInterval(wordTimerId);
  localStorage.removeItem(STORAGE.wordGame);
  wordGame = null;
  busy = false;
  selectedGameMode = "words";
  openWordSetup();
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
  if (button.dataset.game === "snake") return openLevelSelection("snake");
  if (button.dataset.game === "cards") return openLevelSelection("cards");
  if (button.dataset.game === "wheel") return openLevelSelection("wheel");
  if (button.dataset.game === "ludo") return openLudoSetup();
  if (button.dataset.game === "words") return openLevelSelection("words");
  const data = { wheel: ["🎡", "Spin Wheel"], ludo: ["🎯", "Ludo"], cards: ["🃏", "Kartu Tantangan"], words: ["💬", "Tebak Kata"] }[button.dataset.game];
  $("#placeholderIcon").textContent = data[0]; $("#placeholderTitle").textContent = data[1]; showScreen("placeholderScreen");
}));

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
$("#newCardGameBtn").addEventListener("click", resetCardGameToSetup);
$("#drawCardBtn").addEventListener("click", drawChallengeCard);
$("#cardDeck").addEventListener("click", drawChallengeCard);
$("#newWheelGameBtn").addEventListener("click", resetWheelGameToSetup);
$("#spinWheelBtn").addEventListener("click", spinChallengeWheel);
$("#challengeWheel").addEventListener("click", spinChallengeWheel);
$("#ludoPlayerInputs").addEventListener("click", (event) => {
  const index = event.target.dataset.removeLudoPlayer;
  if (index !== undefined && playerCount > 2) {
    const names = $("#ludoPlayerInputs .player-name").map((input) => input.value).filter((_, i) => i !== Number(index));
    playerCount -= 1; renderLudoPlayerInputs(names);
  }
});
$("#addLudoPlayerBtn").addEventListener("click", () => { if (playerCount < 4) { playerCount += 1; renderLudoPlayerInputs(); } });
$("#startLudoGameBtn").addEventListener("click", startLudoGame);
$("#rollLudoBtn").addEventListener("click", rollLudoDice);
$("#ludoDice").addEventListener("click", rollLudoDice);
$("#ludoBoard").addEventListener("click", (event) => {
  const token = event.target.closest(".ludo-token");
  if (token && Number(token.dataset.player) === ludoGame?.currentIndex) moveLudoPiece(Number(token.dataset.piece));
});
$("#newLudoGameBtn").addEventListener("click", resetLudoToSetup);
$("#playLudoAgainBtn").addEventListener("click", () => { $("#ludoWinnerModal").classList.add("hidden"); ludoGame = null; openLudoSetup(); });
$("#wordList").addEventListener("change", updateSelectedWordCount);
$("#wordList").addEventListener("click", (event) => {
  const id = event.target.dataset.deleteCustomWord;
  if (id) { event.preventDefault(); deleteCustomWord(id); }
});
$("#customWordForm").addEventListener("submit", addCustomWord);
$$("[data-word-duration]").forEach((button) => button.addEventListener("click", () => {
  wordDuration = Number(button.dataset.wordDuration);
  saveWordDuration();
  renderWordDurationPicker();
  showToast(`Durasi ronde: ${formatWordDuration(wordDuration)}`);
}));
$("#selectAllWordsBtn").addEventListener("click", () => { $$("#wordList input").forEach((input) => { input.checked = true; }); updateSelectedWordCount(); });
$("#clearAllWordsBtn").addEventListener("click", () => { $$("#wordList input").forEach((input) => { input.checked = false; }); updateSelectedWordCount(); });
$("#addWordPlayerBtn").addEventListener("click", () => { if (playerCount < 4) { playerCount += 1; renderWordPlayerInputs(); } });
$("#wordPlayerInputs").addEventListener("click", (event) => {
  const index = event.target.dataset.removeWordPlayer;
  if (index !== undefined && playerCount > 2) {
    const remainingNames = $$("#wordPlayerInputs .player-name").map((input) => input.value).filter((_, playerIndex) => playerIndex !== Number(index));
    playerCount -= 1;
    renderWordPlayerInputs(remainingNames);
  }
});
$("#startWordGameBtn").addEventListener("click", startWordGame);
$("#startWordRoundBtn").addEventListener("click", startWordRound);
$("#correctWordBtn").addEventListener("click", () => answerWord(true));
$("#skipWordBtn").addEventListener("click", () => answerWord(false));
$("#nextWordTurnBtn").addEventListener("click", nextWordTurn);
$("#newWordGameBtn").addEventListener("click", resetWordGameToSetup);
$("#doneChallengeBtn").addEventListener("click", closeChallenge);
$("#startTimerBtn").addEventListener("click", startTimer);
$$('[data-duration]').forEach((button) => button.addEventListener("click", () => { chosenDuration = Number(button.dataset.duration); $$('[data-duration]').forEach((item) => item.classList.toggle("selected", item === button)); $("#timerValue").textContent = formatTime(chosenDuration); }));
$("#resumeBtn").addEventListener("click", () => { try { game = JSON.parse(localStorage.getItem(STORAGE.game)); if (game) enterGame(); } catch { localStorage.removeItem(STORAGE.game); updateResumeButton(); } });
$("#resumeCardsBtn").addEventListener("click", () => { try { cardGame = JSON.parse(localStorage.getItem(STORAGE.cardGame)); if (cardGame) enterCardGame(); } catch { localStorage.removeItem(STORAGE.cardGame); updateResumeButton(); } });
$("#resumeWheelBtn").addEventListener("click", () => { try { wheelGame = JSON.parse(localStorage.getItem(STORAGE.wheelGame)); if (wheelGame) enterWheelGame(); } catch { localStorage.removeItem(STORAGE.wheelGame); updateResumeButton(); } });
$("#resumeWordsBtn").addEventListener("click", () => { try { wordGame = JSON.parse(localStorage.getItem(STORAGE.wordGame)); if (wordGame) enterWordGame(); } catch { localStorage.removeItem(STORAGE.wordGame); updateResumeButton(); } });
$("#resumeLudoBtn").addEventListener("click", () => { try { ludoGame = JSON.parse(localStorage.getItem(STORAGE.ludoGame)); if (ludoGame) enterLudoGame(); } catch { localStorage.removeItem(STORAGE.ludoGame); updateResumeButton(); } });
$("#playAgainBtn").addEventListener("click", () => { $("#winnerModal").classList.add("hidden"); game = null; openSetup(selectedLevel); });
$("#shuffleAgainBtn").addEventListener("click", shuffleCardRoundAgain);
$("#cardSettingsBtn").addEventListener("click", () => { $("#cardRoundModal").classList.add("hidden"); selectedGameMode = "cards"; cardGame = null; openSetup(selectedLevel); });
$$('[data-back-home]').forEach((button) => button.addEventListener("click", () => { $("#winnerModal").classList.add("hidden"); $("#cardRoundModal").classList.add("hidden"); $("#ludoWinnerModal").classList.add("hidden"); goHome(); }));

$("#muteBtn").textContent = muted ? "🔇" : "🔊";
renderPlayerInputs();
updateResumeButton();
