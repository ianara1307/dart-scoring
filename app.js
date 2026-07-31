// ---------- State ----------
let state = {
  gameType: 501,
  outMode: 'double',   // 'double' | 'straight'
  inputMode: 'dart',   // 'dart' | 'total'
  players: [],         // [{ name, score, legs, history }]
  activePlayerIndex: 0,
  startingPlayerIndex: 0,
  turnDarts: [],       // [{ value, label, isDouble }] — dart-by-dart mode only
  selectedMult: 1,
  pendingConclusion: null, // { isBust, total, darts } while turn-summary modal is open
  pendingCheckoutTotal: 0  // total score submitted in total mode when remaining === 0
};

// ---------- Setup screen elements ----------
const gameTypeToggle = document.getElementById('game-type-toggle');
const outModeToggle = document.getElementById('out-mode-toggle');
const inputModeToggle = document.getElementById('input-mode-toggle');
const playerListEl = document.getElementById('player-list');
const addPlayerBtn = document.getElementById('add-player-btn');
const startGameBtn = document.getElementById('start-game-btn');

// ---------- Game screen elements ----------
const gameTitleEl = document.getElementById('game-title');
const scoreboardEl = document.getElementById('scoreboard');
const checkoutBox = document.getElementById('checkout-suggestion');
const checkoutText = document.getElementById('checkout-text');
const activePlayerNameEl = document.getElementById('active-player-name');
const dartMarks = document.querySelectorAll('.dart-mark');
const turnTotalEl = document.getElementById('turn-total');
const numberGrid = document.getElementById('number-grid');
const multButtons = document.querySelectorAll('.mult-btn');
const undoBtn = document.getElementById('undo-btn');
const endTurnBtn = document.getElementById('end-turn-btn');
const quitGameBtn = document.getElementById('quit-game-btn');
const entryPad = document.getElementById('entry-pad');
const totalScorePad = document.getElementById('total-score-pad');
const totalScoreInput = document.getElementById('total-score-input');
const totalScoreSubmit = document.getElementById('total-score-submit');

// ---------- Win screen elements ----------
const winnerNameEl = document.getElementById('winner-name');
const winStatsEl = document.getElementById('win-stats');
const rematchBtn = document.getElementById('rematch-btn');
const newGameBtn = document.getElementById('new-game-btn');
const winStatsNavBtn = document.getElementById('win-stats-nav-btn');

// ---------- Stats screen elements ----------
const statsNavBtn = document.getElementById('stats-nav-btn');
const statsBackBtn = document.getElementById('stats-back-btn');
const statsEmptyEl = document.getElementById('stats-empty');
const statsContentEl = document.getElementById('stats-content');
const statsPlayerToggle = document.getElementById('stats-player-toggle');
const statsSummaryEl = document.getElementById('stats-summary');
const trendChartWrap = document.getElementById('trend-chart-wrap');
const matchHistoryListEl = document.getElementById('match-history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// ---------- Turn summary modal elements ----------
const turnModal = document.getElementById('turn-modal');
const modalTitle = document.getElementById('modal-title');
const modalDarts = document.getElementById('modal-darts');
const modalTotal = document.getElementById('modal-total');
const modalContinueBtn = document.getElementById('modal-continue-btn');
const modalEditBtn = document.getElementById('modal-edit-btn');

// ---------- Dart count modal elements ----------
const dartCountModal = document.getElementById('dart-count-modal');

// ===================================================================
// SETUP SCREEN
// ===================================================================

function addPlayerRow(name = '') {
  const row = document.createElement('div');
  row.className = 'player-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Player name';
  input.value = name;
  input.maxLength = 16;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-player';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    if (playerListEl.children.length > 1) row.remove();
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  playerListEl.appendChild(row);
}

function setupToggle(toggleEl, onChange) {
  toggleEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    toggleEl.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    onChange(btn.dataset.value);
  });
}

setupToggle(gameTypeToggle, (val) => { state.gameType = parseInt(val, 10); });
setupToggle(outModeToggle, (val) => { state.outMode = val; });
setupToggle(inputModeToggle, (val) => { state.inputMode = val; });

addPlayerBtn.addEventListener('click', () => addPlayerRow());

startGameBtn.addEventListener('click', () => {
  const names = Array.from(playerListEl.querySelectorAll('input'))
    .map((input, i) => input.value.trim() || `Player ${i + 1}`);

  state.players = names.map(name => ({
    name,
    score: state.gameType,
    legs: 0,
    history: []
  }));
  state.activePlayerIndex = 0;
  state.startingPlayerIndex = 0;
  startGame();
});

// ===================================================================
// NUMBER GRID / DART-BY-DART PAD
// ===================================================================

for (let i = 1; i <= 20; i++) {
  const btn = document.createElement('button');
  btn.className = 'num-btn';
  btn.textContent = i;
  btn.addEventListener('click', () => handleNumberPress(i));
  numberGrid.appendChild(btn);
}

multButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    multButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.selectedMult = parseInt(btn.dataset.mult, 10);
  });
});

document.querySelectorAll('.special-row .special').forEach(btn => {
  btn.addEventListener('click', () => handleSpecialPress(btn.dataset.special));
});

undoBtn.addEventListener('click', undoLastDart);
endTurnBtn.addEventListener('click', () => concludeTurn(false));

function handleNumberPress(num) {
  if (state.turnDarts.length >= 3) return;
  const mult = state.selectedMult;
  const value = num * mult;
  const labelMap = { 1: '', 2: 'D', 3: 'T' };
  const label = `${labelMap[mult]}${num}`;
  addDart({ value, label, isDouble: mult === 2 });
  resetMultiplier();
}

function handleSpecialPress(type) {
  if (state.turnDarts.length >= 3) return;
  if (type === 'miss') {
    addDart({ value: 0, label: '-', isDouble: false });
  } else if (type === 'bull25') {
    addDart({ value: 25, label: '25', isDouble: false });
  } else if (type === 'bull50') {
    addDart({ value: 50, label: 'Bull', isDouble: true });
  }
  resetMultiplier();
}

function resetMultiplier() {
  state.selectedMult = 1;
  multButtons.forEach(b => b.classList.toggle('active', b.dataset.mult === '1'));
}

function addDart(dart) {
  state.turnDarts.push(dart);
  renderTurn();

  const player = state.players[state.activePlayerIndex];
  const turnTotal = state.turnDarts.reduce((sum, d) => sum + d.value, 0);
  const remaining = player.score - turnTotal;

  if (remaining < 0) { concludeTurn(true); return; }

  if (state.outMode === 'double') {
    if (remaining === 0) {
      if (dart.isDouble) { winLeg(); return; }
      else { concludeTurn(true); return; }
    }
    if (remaining === 1) { concludeTurn(true); return; }
  } else {
    if (remaining === 0) { winLeg(); return; }
  }

  if (state.turnDarts.length === 3) concludeTurn(false);
}

function undoLastDart() {
  if (state.turnDarts.length === 0) return;
  state.turnDarts.pop();
  renderTurn();
}

// ===================================================================
// TOTAL SCORE PAD
// ===================================================================

totalScoreSubmit.addEventListener('click', handleTotalScoreSubmit);
totalScoreInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleTotalScoreSubmit();
});

function handleTotalScoreSubmit() {
  const raw = parseInt(totalScoreInput.value, 10);
  if (isNaN(raw) || raw < 0 || raw > 180) return;
  totalScoreInput.value = '';

  const player = state.players[state.activePlayerIndex];
  const remaining = player.score - raw;

  if (remaining < 0 || (state.outMode === 'double' && remaining === 1)) {
    // Bust
    concludeTotalTurn(true, raw, 3);
  } else if (remaining === 0) {
    // Checkout — ask how many darts
    state.pendingCheckoutTotal = raw;
    pauseVoice();
    dartCountModal.classList.add('active');
  } else {
    // Normal turn — 3 darts assumed
    concludeTotalTurn(false, raw, 3);
  }
}

document.querySelectorAll('.dart-count-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    dartCountModal.classList.remove('active');
    stopVoice();
    const count = parseInt(btn.dataset.count, 10);
    const player = state.players[state.activePlayerIndex];
    player.history.push({ darts: count, score: state.pendingCheckoutTotal });
    player.score = 0;
    player.legs += 1;
    showWinScreen(player.name);
  });
});

function concludeTotalTurn(isBust, total, darts) {
  const player = state.players[state.activePlayerIndex];
  if (!isBust) player.score -= total;
  state.pendingConclusion = { isBust, total, darts };
  renderGame();
  showTurnSummary(isBust, total, darts, false);
}

// ===================================================================
// TURN / SCORING LOGIC (dart-by-dart mode)
// ===================================================================

function concludeTurn(isBust) {
  const player = state.players[state.activePlayerIndex];
  const turnTotal = state.turnDarts.reduce((sum, d) => sum + d.value, 0);
  if (!isBust) player.score -= turnTotal;
  state.pendingConclusion = { isBust, total: turnTotal, darts: state.turnDarts.length };
  renderGame();
  showTurnSummary(isBust, turnTotal, state.turnDarts.length, true);
}

function showTurnSummary(isBust, total, darts, showDartBreakdown) {
  pauseVoice();
  modalTitle.textContent = isBust ? 'Bust!' : 'Turn Total';
  modalTitle.classList.toggle('bust', isBust);

  modalDarts.innerHTML = '';
  if (showDartBreakdown) {
    for (let i = 0; i < 3; i++) {
      const dart = state.turnDarts[i];
      const el = document.createElement('span');
      el.className = 'dart-mark' + (dart ? '' : ' empty');
      el.textContent = dart ? (dart.label || '0') : '-';
      modalDarts.appendChild(el);
    }
  }

  modalTotal.textContent = isBust ? '0' : `${total}`;
  // Hide Edit button in total-score mode (no individual darts to change)
  modalEditBtn.style.display = showDartBreakdown ? '' : 'none';
  turnModal.classList.add('active');
}

function closeTurnSummary() {
  resumeVoice();
  const player = state.players[state.activePlayerIndex];
  const { isBust, total, darts } = state.pendingConclusion;
  player.history.push({ darts, score: isBust ? 0 : total });

  turnModal.classList.remove('active');
  state.pendingConclusion = null;
  state.turnDarts = [];
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  renderGame();
}

function editTurn() {
  resumeVoice();
  const player = state.players[state.activePlayerIndex];
  if (state.pendingConclusion && !state.pendingConclusion.isBust) {
    player.score += state.pendingConclusion.total;
  }
  state.pendingConclusion = null;
  turnModal.classList.remove('active');
  renderGame();
}

modalContinueBtn.addEventListener('click', closeTurnSummary);
modalEditBtn.addEventListener('click', editTurn);

function winLeg() {
  const player = state.players[state.activePlayerIndex];
  const turnTotal = state.turnDarts.reduce((sum, d) => sum + d.value, 0);
  player.history.push({ darts: state.turnDarts.length, score: turnTotal });
  player.score = 0;
  player.legs += 1;
  showWinScreen(player.name);
}

// ===================================================================
// CHECKOUT SUGGESTION
// ===================================================================

const THROW_OPTIONS = (() => {
  const options = [];
  for (let n = 20; n >= 1; n--) options.push({ value: n * 3, label: `T${n}`, isDouble: false });
  options.push({ value: 50, label: 'Bull', isDouble: true });
  for (let n = 20; n >= 1; n--) options.push({ value: n * 2, label: `D${n}`, isDouble: true });
  options.push({ value: 25, label: '25', isDouble: false });
  for (let n = 20; n >= 1; n--) options.push({ value: n, label: `${n}`, isDouble: false });
  return options;
})();

function findCheckout(score, dartsLeft, requireDoubleFinish) {
  if (score <= 0) return null;
  for (let darts = 1; darts <= dartsLeft; darts++) {
    const result = tryExact(score, darts, requireDoubleFinish);
    if (result) return result;
  }
  return null;
}

function tryExact(score, darts, requireDoubleFinish) {
  if (darts === 1) {
    if (!requireDoubleFinish) {
      const match = THROW_OPTIONS.find(o => o.value === score);
      return match ? [match.label] : null;
    }
    if (score === 50) return ['Bull'];
    if (score >= 2 && score <= 40 && score % 2 === 0) return [`D${score / 2}`];
    return null;
  }
  for (const opt of THROW_OPTIONS) {
    const remainder = score - opt.value;
    if (remainder < 0) continue;
    if (requireDoubleFinish && remainder === 1) continue;
    if (remainder === 0) continue;
    const rest = tryExact(remainder, darts - 1, requireDoubleFinish);
    if (rest) return [opt.label, ...rest];
  }
  return null;
}

// ===================================================================
// RENDERING
// ===================================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function startGame(isRematch) {
  state.turnDarts = [];
  resetMultiplier();

  const isDart = state.inputMode === 'dart';
  entryPad.style.display = isDart ? '' : 'none';
  totalScorePad.style.display = isDart ? 'none' : '';
  // dart-marks / checkout suggestion only relevant in dart-by-dart mode
  document.getElementById('current-turn-info').style.display = isDart ? '' : '';

  showScreen('game-screen');
  renderGame();

  if (!isDart) {
    totalScoreInput.focus();
  }
}

function playerAverage(p) {
  const totalDarts = p.history.reduce((s, h) => s + h.darts, 0);
  const totalScore = p.history.reduce((s, h) => s + h.score, 0);
  return totalDarts > 0 ? (totalScore / totalDarts * 3).toFixed(1) : null;
}

function renderGame() {
  gameTitleEl.textContent = `${state.gameType} • ${state.outMode === 'double' ? 'Double Out' : 'Straight Out'}`;

  scoreboardEl.innerHTML = '';
  state.players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'player-card' + (i === state.activePlayerIndex ? ' active' : '');

    const topRow = document.createElement('div');
    topRow.className = 'card-top-row';

    const nameEl = document.createElement('div');
    nameEl.className = 'pname';
    nameEl.innerHTML = `${escapeHtml(p.name)}${p.legs > 0 ? `<span class="legs">Legs: ${p.legs}</span>` : ''}`;

    const scoreCol = document.createElement('div');
    scoreCol.className = 'pscore-col';

    const scoreEl = document.createElement('div');
    scoreEl.className = 'pscore';
    scoreEl.textContent = p.score;
    scoreCol.appendChild(scoreEl);

    const avg = playerAverage(p);
    if (avg !== null) {
      const avgEl = document.createElement('div');
      avgEl.className = 'pavg';
      avgEl.textContent = `avg ${avg}`;
      scoreCol.appendChild(avgEl);
    }

    topRow.appendChild(nameEl);
    topRow.appendChild(scoreCol);
    card.appendChild(topRow);

    if (p.history.length > 0) {
      const historyEl = document.createElement('div');
      historyEl.className = 'phistory';
      historyEl.textContent = p.history.map(h => h.score).join(', ');
      card.appendChild(historyEl);
    }

    scoreboardEl.appendChild(card);
  });

  renderTurn();
}

function renderTurn() {
  const player = state.players[state.activePlayerIndex];
  activePlayerNameEl.textContent = `${player.name}'s turn`;

  const isDart = state.inputMode === 'dart';

  const turnTotal = state.turnDarts.reduce((sum, d) => sum + d.value, 0);
  const remaining = player.score - turnTotal;

  if (isDart) {
    dartMarks.forEach((el, idx) => {
      const dart = state.turnDarts[idx];
      if (dart) {
        el.textContent = dart.label || '0';
        el.classList.remove('empty');
      } else {
        el.textContent = '-';
        el.classList.add('empty');
      }
    });
    turnTotalEl.textContent = `Turn total: ${turnTotal}  |  Remaining: ${remaining >= 0 ? remaining : player.score}`;
  } else {
    dartMarks.forEach(el => { el.textContent = '-'; el.classList.add('empty'); });
    turnTotalEl.textContent = `Remaining: ${player.score}`;
  }

  // Checkout suggestion (dart-by-dart: uses darts left; total mode: always 3 darts)
  const dartsLeft = isDart ? 3 - state.turnDarts.length : 3;
  const targetScore = isDart ? (remaining >= 0 ? remaining : player.score) : player.score;
  let suggestion = null;

  if (dartsLeft > 0 && targetScore > 0 && targetScore <= 170) {
    suggestion = findCheckout(targetScore, dartsLeft, state.outMode === 'double');
  }

  if (suggestion) {
    checkoutBox.style.display = '';
    checkoutText.textContent = suggestion.join(' → ');
  } else {
    checkoutBox.style.display = 'none';
  }
}

function showWinScreen(name) {
  stopVoice();
  recordMatch(name);
  winnerNameEl.textContent = name;

  winStatsEl.innerHTML = '';
  state.players.forEach(p => {
    const totalDarts = p.history.reduce((sum, h) => sum + h.darts, 0);
    const totalScored = p.history.reduce((sum, h) => sum + h.score, 0);
    const average = totalDarts > 0 ? (totalScored / totalDarts * 3).toFixed(1) : '0.0';

    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `<span class="stat-name">${escapeHtml(p.name)}</span>` +
      `<span class="stat-vals">3-dart avg: ${average}<br>Darts thrown: ${totalDarts}</span>`;
    winStatsEl.appendChild(row);
  });

  showScreen('win-screen');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

quitGameBtn.addEventListener('click', () => {
  if (confirm('Quit current game and return to setup?')) {
    stopVoice();
    showScreen('setup-screen');
  }
});

rematchBtn.addEventListener('click', () => {
  state.startingPlayerIndex = (state.startingPlayerIndex + 1) % state.players.length;
  state.players.forEach(p => { p.score = state.gameType; p.history = []; });
  state.activePlayerIndex = state.startingPlayerIndex;
  startGame(true);
});

newGameBtn.addEventListener('click', () => showScreen('setup-screen'));

// ===================================================================
// VOICE INPUT
// ===================================================================

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBtn = document.getElementById('mic-btn');
const voiceFeedbackEl = document.getElementById('voice-feedback');
let recognition = null;
let voiceActive = false;
let voiceFeedbackTimer = null;

const WORD_NUMS = {
  'zero':0,'oh':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,
  'seven':7,'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,
  'thirteen':13,'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,
  'eighteen':18,'nineteen':19,'twenty':20,'thirty':30,'forty':40,
  'fifty':50,'sixty':60,'seventy':70,'eighty':80,'ninety':90,'hundred':100
};

function parseDartFromSpeech(t) {
  t = t.toLowerCase().trim();

  if (/^(miss|missed|no score|nowt|zero|0)$/.test(t))
    return { type: 'special', special: 'miss' };

  if (/^(bull$|bullseye|double bull|bull 50|fifty)/.test(t))
    return { type: 'special', special: 'bull50' };

  if (/^(twenty[\s-]?five|outer bull|bull 25|single bull|25)/.test(t))
    return { type: 'special', special: 'bull25' };

  let mult = 1;
  t = t.replace(/^(treble|triple)\s*/, () => { mult = 3; return ''; })
       .replace(/^double\s*/, () => { mult = 2; return ''; })
       .replace(/^single\s*/, () => { mult = 1; return ''; });

  let num = parseInt(t, 10);
  if (isNaN(num)) num = WORD_NUMS[t.trim()];
  if (num >= 1 && num <= 20) return { type: 'number', num, mult };
  return null;
}

function parseTotalFromSpeech(t) {
  t = t.toLowerCase().trim().replace(/[^a-z0-9 ]/g, ' ').trim();

  // Direct digits
  const direct = parseInt(t.replace(/\s+/g, ''), 10);
  if (!isNaN(direct) && direct >= 0 && direct <= 180) return direct;

  const words = t.split(/\s+/).filter(w => w !== 'and' && w !== 'a' && w !== '');

  // Informal "one forty", "one eighty" → X*100 + Y
  if (words.length === 2) {
    const a = WORD_NUMS[words[0]], b = WORD_NUMS[words[1]];
    if (a !== undefined && b !== undefined && a >= 1 && a <= 9 && b >= 10 && b % 10 === 0) {
      const v = a * 100 + b;
      if (v <= 180) return v;
    }
  }

  // Standard word-number parsing
  let total = 0, current = 0;
  for (const w of words) {
    const n = WORD_NUMS[w];
    if (n === undefined) continue;
    if (n === 100) { current = current === 0 ? 100 : current * 100; total += current; current = 0; }
    else current += n;
  }
  total += current;
  return total >= 0 && total <= 180 ? total : NaN;
}

function initVoice() {
  if (!SpeechRecognition) { micBtn.style.display = 'none'; return; }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-GB';

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript.toLowerCase().trim();
    processVoiceInput(transcript);
  };

  recognition.onend = () => {
    if (voiceActive) {
      try { recognition.start(); } catch (_) {}
    }
  };

  recognition.onerror = (e) => {
    if (e.error === 'not-allowed') {
      setVoiceActive(false);
      showVoiceFeedback('Microphone access denied', 3000);
    }
    // 'no-speech', 'aborted' etc — onend will restart
  };
}

function setVoiceActive(active) {
  voiceActive = active;
  micBtn.classList.toggle('listening', active);
  micBtn.textContent = active ? '🎙️' : '🎤';
  if (active) {
    try { recognition.start(); } catch (_) {}
    showVoiceFeedback('Listening…', 0);
  } else {
    try { recognition.stop(); } catch (_) {}
    clearVoiceFeedback();
  }
}

function pauseVoice() {
  if (voiceActive && recognition) try { recognition.stop(); } catch (_) {}
}

function resumeVoice() {
  if (voiceActive && recognition) try { recognition.start(); } catch (_) {}
}

function stopVoice() {
  voiceActive = false;
  micBtn.classList.remove('listening');
  micBtn.textContent = '🎤';
  if (recognition) try { recognition.stop(); } catch (_) {}
  clearVoiceFeedback();
}

function showVoiceFeedback(text, duration) {
  clearTimeout(voiceFeedbackTimer);
  voiceFeedbackEl.textContent = text;
  voiceFeedbackEl.classList.add('visible');
  if (duration > 0) {
    voiceFeedbackTimer = setTimeout(() => {
      voiceActive ? showVoiceFeedback('Listening…', 0) : clearVoiceFeedback();
    }, duration);
  }
}

function clearVoiceFeedback() {
  clearTimeout(voiceFeedbackTimer);
  voiceFeedbackEl.classList.remove('visible');
}

function processVoiceInput(transcript) {
  if (state.inputMode === 'dart') {
    const result = parseDartFromSpeech(transcript);
    if (!result) { showVoiceFeedback(`"${transcript}" — not recognised`, 2000); return; }

    if (result.type === 'special') {
      showVoiceFeedback(`Heard: ${transcript}`, 1500);
      handleSpecialPress(result.special);
    } else {
      const prefix = { 1: '', 2: 'D', 3: 'T' }[result.mult];
      showVoiceFeedback(`Heard: ${transcript} → ${prefix}${result.num}`, 1500);
      if (state.turnDarts.length >= 3) return;
      const value = result.num * result.mult;
      const label = `${prefix}${result.num}`;
      addDart({ value, label, isDouble: result.mult === 2 });
    }
  } else {
    const score = parseTotalFromSpeech(transcript);
    if (isNaN(score)) { showVoiceFeedback(`"${transcript}" — not recognised`, 2000); return; }
    showVoiceFeedback(`Heard: ${score}`, 1500);
    totalScoreInput.value = score;
    setTimeout(handleTotalScoreSubmit, 600);
  }
}

micBtn.addEventListener('click', () => {
  if (!recognition) return;
  setVoiceActive(!voiceActive);
});

initVoice();

// ===================================================================
// MATCH HISTORY / STATS
// ===================================================================

const HISTORY_KEY = 'dartHistoryV1';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch (_) { return []; }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function recordMatch(winnerName) {
  const history = loadHistory();
  const record = {
    id: Date.now(),
    date: new Date().toISOString(),
    gameType: state.gameType,
    outMode: state.outMode,
    winnerName,
    players: state.players.map(p => {
      const totalDarts = p.history.reduce((s, h) => s + h.darts, 0);
      const totalScore = p.history.reduce((s, h) => s + h.score, 0);
      const avg = totalDarts > 0 ? +(totalScore / totalDarts * 3).toFixed(1) : 0;
      const highestTurn = p.history.reduce((m, h) => Math.max(m, h.score), 0);
      const won = p.name === winnerName;
      const lastTurn = p.history[p.history.length - 1];
      return {
        name: p.name,
        won,
        avg,
        dartsThrown: totalDarts,
        highestTurn,
        checkoutDarts: won && lastTurn ? lastTurn.darts : null,
        checkoutScore: won && lastTurn ? lastTurn.score : null
      };
    })
  };
  history.push(record);
  saveHistory(history);
}

let statsSelectedPlayer = null;

statsNavBtn.addEventListener('click', () => { showScreen('stats-screen'); renderStats(); });
winStatsNavBtn.addEventListener('click', () => { showScreen('stats-screen'); renderStats(); });
statsBackBtn.addEventListener('click', () => showScreen('setup-screen'));

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Clear all match history? This cannot be undone.')) {
    saveHistory([]);
    renderStats();
  }
});

function renderStats() {
  const history = loadHistory();

  if (history.length === 0) {
    statsEmptyEl.style.display = '';
    statsContentEl.style.display = 'none';
    return;
  }
  statsEmptyEl.style.display = 'none';
  statsContentEl.style.display = '';

  const names = [];
  for (let i = history.length - 1; i >= 0; i--) {
    history[i].players.forEach(p => { if (!names.includes(p.name)) names.push(p.name); });
  }

  if (!statsSelectedPlayer || !names.includes(statsSelectedPlayer)) {
    statsSelectedPlayer = names[0];
  }

  statsPlayerToggle.innerHTML = '';
  names.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'toggle-btn' + (name === statsSelectedPlayer ? ' active' : '');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      statsSelectedPlayer = name;
      renderStats();
    });
    statsPlayerToggle.appendChild(btn);
  });

  const rows = [];
  history.forEach(match => {
    const p = match.players.find(pl => pl.name === statsSelectedPlayer);
    if (p) rows.push({ match, p });
  });

  renderStatsSummary(rows);
  renderTrendChart(rows);
  renderMatchHistoryList(rows);
}

function renderStatsSummary(rows) {
  const games = rows.length;
  const wins = rows.filter(r => r.p.won).length;
  const winPct = games > 0 ? Math.round((wins / games) * 100) : 0;
  const totalDarts = rows.reduce((s, r) => s + r.p.dartsThrown, 0);
  const totalWeighted = rows.reduce((s, r) => s + r.p.avg * r.p.dartsThrown, 0);
  const careerAvg = totalDarts > 0 ? (totalWeighted / totalDarts).toFixed(1) : '0.0';
  const bestLegDarts = rows
    .filter(r => r.p.won && r.p.checkoutDarts)
    .reduce((m, r) => Math.min(m, r.p.checkoutDarts), Infinity);
  const highestCheckout = rows
    .filter(r => r.p.won)
    .reduce((m, r) => Math.max(m, r.p.checkoutScore || 0), 0);
  const bestTurn = rows.reduce((m, r) => Math.max(m, r.p.highestTurn), 0);

  const tiles = [
    { label: 'Games', value: games },
    { label: 'Win %', value: `${winPct}%` },
    { label: 'Career Avg', value: careerAvg },
    { label: 'Best Leg', value: bestLegDarts === Infinity ? '—' : `${bestLegDarts} darts` },
    { label: 'Highest Checkout', value: highestCheckout || '—' },
    { label: 'Best Turn', value: bestTurn || '—' }
  ];

  statsSummaryEl.innerHTML = '';
  tiles.forEach(t => {
    const el = document.createElement('div');
    el.className = 'stat-tile';
    el.innerHTML = `<div class="stat-tile-value">${t.value}</div><div class="stat-tile-label">${t.label}</div>`;
    statsSummaryEl.appendChild(el);
  });
}

function renderTrendChart(rows) {
  const points = rows.slice(-15).map(r => ({ avg: r.p.avg, date: r.match.date }));

  trendChartWrap.innerHTML = '';

  if (points.length < 2) {
    const msg = document.createElement('div');
    msg.className = 'chart-empty';
    msg.textContent = 'Play a few more legs to see your trend.';
    trendChartWrap.appendChild(msg);
    return;
  }

  const W = 300, H = 120, PAD = 16;
  const maxAvg = Math.max(...points.map(p => p.avg), 40);
  const minAvg = Math.min(...points.map(p => p.avg), 0);
  const range = (maxAvg - minAvg) || 1;

  const xFor = i => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const yFor = v => H - PAD - ((v - minAvg) / range) * (H - PAD * 2);

  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.avg)}`).join(' ');

  const gridLines = [0.25, 0.5, 0.75].map(f => {
    const y = PAD + f * (H - PAD * 2);
    return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="var(--border)" stroke-width="1" opacity="0.5"/>`;
  }).join('');

  const dots = points.map((p, i) =>
    `<circle class="trend-dot" data-idx="${i}" cx="${xFor(i)}" cy="${yFor(p.avg)}" r="3" fill="var(--accent-2)"/>`
  ).join('');

  trendChartWrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="trend-svg" id="trend-svg">
      ${gridLines}
      <polyline points="${linePoints}" fill="none" stroke="var(--accent-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>
    <div class="trend-tooltip" id="trend-tooltip"></div>
  `;

  const svgEl = document.getElementById('trend-svg');
  const tooltipEl = document.getElementById('trend-tooltip');

  function showPoint(idx) {
    idx = Math.max(0, Math.min(points.length - 1, idx));
    const p = points[idx];
    const dateStr = new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    tooltipEl.textContent = `${dateStr}: ${p.avg}`;
    tooltipEl.style.left = `${(xFor(idx) / W) * 100}%`;
    tooltipEl.style.top = `${(yFor(p.avg) / H) * 100}%`;
    tooltipEl.classList.add('visible');
  }

  function hideTooltip() {
    tooltipEl.classList.remove('visible');
  }

  function handlePointer(clientX) {
    const rect = svgEl.getBoundingClientRect();
    const xRatio = (clientX - rect.left) / rect.width;
    showPoint(Math.round(xRatio * (points.length - 1)));
  }

  svgEl.addEventListener('mousemove', (e) => handlePointer(e.clientX));
  svgEl.addEventListener('mouseleave', hideTooltip);
  svgEl.addEventListener('touchstart', (e) => handlePointer(e.touches[0].clientX));
  svgEl.addEventListener('touchmove', (e) => { e.preventDefault(); handlePointer(e.touches[0].clientX); }, { passive: false });
  svgEl.addEventListener('touchend', hideTooltip);
}

function renderMatchHistoryList(rows) {
  matchHistoryListEl.innerHTML = '';
  const recent = rows.slice().reverse().slice(0, 10);
  recent.forEach(({ match, p }) => {
    const opponents = match.players
      .filter(pl => pl.name !== statsSelectedPlayer)
      .map(pl => pl.name)
      .join(', ');
    const dateStr = new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const row = document.createElement('div');
    row.className = 'history-row';

    const main = document.createElement('div');
    main.className = 'history-row-main';
    const badge = document.createElement('span');
    badge.className = 'history-result ' + (p.won ? 'win' : 'loss');
    badge.textContent = p.won ? 'W' : 'L';
    const detail = document.createElement('span');
    detail.className = 'history-detail';
    detail.textContent = `${match.gameType}${opponents ? ' vs ' + opponents : ''}`;
    main.appendChild(badge);
    main.appendChild(detail);

    const side = document.createElement('div');
    side.className = 'history-row-side';
    side.innerHTML = `<span>${p.avg} avg</span><span class="history-date">${dateStr}</span>`;

    row.appendChild(main);
    row.appendChild(side);
    matchHistoryListEl.appendChild(row);
  });
}

// ===================================================================
// INIT
// ===================================================================

addPlayerRow('Ian');
