// ---------- State ----------
let state = {
  gameType: 501,
  outMode: 'double', // 'double' | 'straight'
  players: [],       // [{ name, score, legs }]
  activePlayerIndex: 0,
  startingPlayerIndex: 0,
  turnDarts: [],      // [{ value, label, isDouble }]
  selectedMult: 1,
  pendingConclusion: null // { isBust, total } while the turn-summary modal is open
};

// ---------- Setup screen elements ----------
const gameTypeToggle = document.getElementById('game-type-toggle');
const outModeToggle = document.getElementById('out-mode-toggle');
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

// ---------- Win screen elements ----------
const winnerNameEl = document.getElementById('winner-name');
const rematchBtn = document.getElementById('rematch-btn');
const newGameBtn = document.getElementById('new-game-btn');

// ---------- Turn summary modal elements ----------
const turnModal = document.getElementById('turn-modal');
const modalTitle = document.getElementById('modal-title');
const modalDarts = document.getElementById('modal-darts');
const modalTotal = document.getElementById('modal-total');
const modalContinueBtn = document.getElementById('modal-continue-btn');
const modalEditBtn = document.getElementById('modal-edit-btn');

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
    if (playerListEl.children.length > 1) {
      row.remove();
    }
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  playerListEl.appendChild(row);
}

// Toggle group helper
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

addPlayerBtn.addEventListener('click', () => addPlayerRow());

startGameBtn.addEventListener('click', () => {
  const names = Array.from(playerListEl.querySelectorAll('input'))
    .map((input, i) => input.value.trim() || `Player ${i + 1}`);

  state.players = names.map(name => ({
    name,
    score: state.gameType,
    legs: 0,
    history: [] // [{ darts, score }] one entry per completed turn
  }));
  state.activePlayerIndex = 0;
  state.startingPlayerIndex = 0;

  startGame();
});

// ===================================================================
// NUMBER GRID / ENTRY PAD
// ===================================================================

for (let i = 1; i <= 20; i++) {
  const btn = document.createElement('button');
  btn.className = 'num-btn';
  btn.textContent = i;
  btn.dataset.num = i;
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
modalContinueBtn.addEventListener('click', closeTurnSummary);
modalEditBtn.addEventListener('click', editTurn);
quitGameBtn.addEventListener('click', () => {
  if (confirm('Quit current game and return to setup?')) {
    showScreen('setup-screen');
  }
});

rematchBtn.addEventListener('click', () => {
  // Reset scores, rotate starting player
  state.startingPlayerIndex = (state.startingPlayerIndex + 1) % state.players.length;
  state.players.forEach(p => { p.score = state.gameType; p.history = []; });
  state.activePlayerIndex = state.startingPlayerIndex;
  startGame(true);
});

newGameBtn.addEventListener('click', () => showScreen('setup-screen'));

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

  // Check for bust / win immediately
  if (remaining < 0) {
    // Bust
    concludeTurn(true);
    return;
  }
  if (state.outMode === 'double') {
    if (remaining === 0) {
      if (dart.isDouble) {
        winLeg();
        return;
      } else {
        concludeTurn(true);
        return;
      }
    }
    if (remaining === 1) {
      concludeTurn(true);
      return;
    }
  } else { // straight out
    if (remaining === 0) {
      winLeg();
      return;
    }
  }

  // If 3 darts thrown without bust/win, end the turn normally
  if (state.turnDarts.length === 3) {
    concludeTurn(false);
  }
}

function undoLastDart() {
  if (state.turnDarts.length === 0) return;
  state.turnDarts.pop();
  renderTurn();
}

// ===================================================================
// TURN / SCORING LOGIC
// ===================================================================

// isBust = true means the turn total is discarded (score unchanged)
function concludeTurn(isBust) {
  const player = state.players[state.activePlayerIndex];
  const turnTotal = state.turnDarts.reduce((sum, d) => sum + d.value, 0);
  if (!isBust) {
    player.score -= turnTotal;
  }
  state.pendingConclusion = { isBust, total: turnTotal };
  renderGame();
  showTurnSummary(isBust, turnTotal);
}

function showTurnSummary(isBust, total) {
  modalTitle.textContent = isBust ? 'Bust!' : 'Turn Total';
  modalTitle.classList.toggle('bust', isBust);

  modalDarts.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const dart = state.turnDarts[i];
    const el = document.createElement('span');
    el.className = 'dart-mark' + (dart ? '' : ' empty');
    el.textContent = dart ? (dart.label || '0') : '-';
    modalDarts.appendChild(el);
  }

  modalTotal.textContent = isBust ? '0' : `${total}`;
  turnModal.classList.add('active');
}

function closeTurnSummary() {
  const player = state.players[state.activePlayerIndex];
  const { isBust, total } = state.pendingConclusion;
  player.history.push({ darts: state.turnDarts.length, score: isBust ? 0 : total });

  turnModal.classList.remove('active');
  state.pendingConclusion = null;
  state.turnDarts = [];
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  renderGame();
}

function editTurn() {
  const player = state.players[state.activePlayerIndex];
  if (state.pendingConclusion && !state.pendingConclusion.isBust) {
    player.score += state.pendingConclusion.total;
  }
  state.pendingConclusion = null;
  turnModal.classList.remove('active');
  renderGame();
}

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

// Returns array of throw labels, or null if no checkout possible
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
      // Any single throw value 1-60 (matching a real dart segment) finishes
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
    // Avoid leaving a remainder that can never be finished (e.g. 1 with double-out)
    if (requireDoubleFinish && remainder === 1) continue;
    if (remainder === 0) continue; // can't use last dart of a multi-dart sequence to land exactly 0 here; handled by darts===1 case at outer loop
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
  if (!isRematch) {
    // nothing extra needed; state.players already set
  }
  state.turnDarts = [];
  resetMultiplier();
  showScreen('game-screen');
  renderGame();
}

function renderGame() {
  gameTitleEl.textContent = `${state.gameType} • ${state.outMode === 'double' ? 'Double Out' : 'Straight Out'}`;

  // Scoreboard
  scoreboardEl.innerHTML = '';
  state.players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'player-card' + (i === state.activePlayerIndex ? ' active' : '');

    const topRow = document.createElement('div');
    topRow.className = 'card-top-row';

    const nameEl = document.createElement('div');
    nameEl.className = 'pname';
    nameEl.innerHTML = `${escapeHtml(p.name)}${p.legs > 0 ? `<span class="legs">Legs: ${p.legs}</span>` : ''}`;

    const scoreEl = document.createElement('div');
    scoreEl.className = 'pscore';
    scoreEl.textContent = p.score;

    topRow.appendChild(nameEl);
    topRow.appendChild(scoreEl);
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

  const turnTotal = state.turnDarts.reduce((sum, d) => sum + d.value, 0);
  const remaining = player.score - turnTotal;

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

  // Checkout suggestion
  const dartsLeft = 3 - state.turnDarts.length;
  const targetScore = remaining >= 0 ? remaining : player.score;
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

const winStatsEl = document.getElementById('win-stats');

function showWinScreen(name) {
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

// ===================================================================
// INIT
// ===================================================================

addPlayerRow('Ian');
