// game.js
const Game = (() => {
  const game = new Chess(); // chess.js UMD
  let engine = null;
  let board = null;
  const ui = {};
  let humanSide = 'white';
  let running = false;
  let analyze = false;

  // 6 levels: mix Skill Level + movetime caps
  const LEVELS = {
    1: { skill: 0,  movetime: 80  },
    2: { skill: 5,  movetime: 150 },
    3: { skill: 8,  movetime: 300 },
    4: { skill: 12, movetime: 600 },
    5: { skill: 18, movetime: 1200 },
    6: { skill: 20, movetime: 1800 }
  };
  let currentLevel = 3;

  // clocks
  let baseSec = 600, incSec = 5; // default 10+5
  let wTime = baseSec, bTime = baseSec;
  let tickHandle = null;
  let turnStart = null;

  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60), r = s % 60;
    return `${m}:${r.toString().padStart(2,'0')}`;
  }
  function updateClocks() {
    if (!turnStart) return;
    const dt = (Date.now() - turnStart) / 1000;
    if (game.turn() === 'w') ui.wClock.textContent = fmt(wTime - dt);
    else ui.bClock.textContent = fmt(bTime - dt);
  }
  function stopTick() { if (tickHandle) { clearInterval(tickHandle); tickHandle = null; } }
  function startTick() { stopTick(); tickHandle = setInterval(updateClocks, 250); }

  function applyIncAtTurnSwitch() {
    if (!turnStart) return;
    const dt = (Date.now() - turnStart) / 1000;
    if (game.turn() === 'b') wTime = wTime - dt + incSec;
    else bTime = bTime - dt + incSec;
    turnStart = Date.now();
    ui.wClock.textContent = fmt(wTime);
    ui.bClock.textContent = fmt(bTime);
  }

  function startClocks() {
    if (baseSec === 0 && incSec === 0) return; // unlimited
    wTime = baseSec; bTime = baseSec; ui.wClock.textContent = fmt(wTime); ui.bClock.textContent = fmt(bTime);
    turnStart = Date.now();
    startTick();
  }

  function parseTimeCtrl(tc) {
    const [base, inc] = tc.split('|').map(x => parseInt(x, 10));
    baseSec = base; incSec = inc;
  }

  function updatePV(line) {
    if (!line.pv) return;
    // convert UCI pv to SAN using a clone of current position
    const clone = new Chess(game.fen());
    const moves = line.pv.trim().split(/\s+/);
    const san = [];
    for (const mv of moves) {
      const from = mv.slice(0,2), to = mv.slice(2,4), promo = mv[4];
      const res = clone.move({ from, to, promotion: promo });
      if (!res) break;
      san.push(res.san);
    }
    if (san.length) window.document.getElementById('pv').textContent = san.join(' ');
  }

  function engineGo() {
    if (analyze) return;
    const { movetime } = LEVELS[currentLevel];
    const fen = game.fen();
    engine.positionFEN(fen);
    engine.goMovetime(movetime);
  }

  return {
    game,
    init({ board: b, engine: e, ui: uiRefs }) {
      board = b; engine = e; Object.assign(ui, uiRefs);
      engine.setMultiPV(1);
    },
    newGame({ humanSide: side, level, timeCtrl }) {
      humanSide = side; currentLevel = level;
      game.reset();
      board.position(game.fen(), true);
      // engine strength
      engine.setSkill(LEVELS[currentLevel].skill);
      // time controls
      parseTimeCtrl(timeCtrl);
      startClocks();
      running = true; analyze = false;
      if (humanSide === 'black') engineGo();
    },
    onDragStart(source, piece, side) {
      if (!running || analyze) return false;
      if (side !== humanSide) return false;
      if (game.turn() === 'w' && piece.startsWith('b')) return false;
      if (game.turn() === 'b' && piece.startsWith('w')) return false;
      return true;
    },
    onPlayerMove(source, target) {
      const move = game.move({ from: source, to: target, promotion: 'q' });
      if (!move) return false;
      applyIncAtTurnSwitch();
      board.position(game.fen(), true);
      if (!game.game_over()) engineGo();
      return true;
    },
    onEngineBestMove(uci) {
      const move = { from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] };
      game.move(move);
      applyIncAtTurnSwitch();
      if (game.game_over()) { running = false; stopTick(); }
    },
    undo() {
      if (analyze) return;
      game.undo(); game.undo();
    },
    resign() { running = false; },
    offerDraw() { /* UI-only for MVP */ },
    startAnalysis() {
      analyze = true;
      engine.setMultiPV(1);
      const fen = game.fen();
      engine.positionFEN(fen);
      engine.goDepth(18);
    },
    stopAnalysis() { analyze = false; engine.stop(); },
    loadPGN(pgn) { game.reset(); game.load_pgn(pgn); },
  };
})();

window.Game = Game;
