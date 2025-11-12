// engine-controller.js
function parseInfo(line) {
  // pull cp score and pv SAN if present
  const out = { type: 'info' };
  try {
    if (line.includes(' cp ')) {
      const cp = parseInt(line.split(' cp ')[1].split(' ')[0], 10);
      out.cp = cp;
    }
    if (line.includes(' pv ')) {
      const pv = line.split(' pv ')[1].trim();
      out.pv = pv;
      // leave SAN formatting to game.js (needs a position context)
    }
  } catch {}
  return out;
}

function createEngineController(workerUrl, onMsg) {
  const w = new Worker(workerUrl);
  let ready = false;

  w.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'ready') { ready = true; onMsg && onMsg({ type: 'ready' }); return; }
    if (m.type === 'error') { console.error(m.error); return; }
    if (m.type === 'raw' && typeof m.text === 'string') {
      const t = m.text;
      if (t.startsWith('info ')) onMsg && onMsg(parseInfo(t));
      if (t.startsWith('bestmove')) {
        const move = t.split(' ')[1];
        onMsg && onMsg({ type: 'bestmove', move });
      }
      return;
    }
    if (m.type === 'infoText') onMsg && onMsg(parseInfo(m.text));
    else onMsg && onMsg(m);
  };

  // kick
  w.postMessage({ type: 'init' });

  function cmd(s) { w.postMessage({ type: 'cmd', data: s }); }

  return {
    setSkill(skill) { cmd(`setoption name Skill Level value ${skill}`); },
    limitStrength(elo) { cmd('setoption name UCI_LimitStrength value true'); cmd(`setoption name UCI_Elo value ${elo}`); },
    setMultiPV(n) { cmd(`setoption name MultiPV value ${n}`); },
    positionFEN(fen, movesSAN) {
      const moves = (movesSAN && movesSAN.length) ? ` moves ${movesSAN.join(' ')}` : '';
      cmd(`position fen ${fen}${moves}`);
    },
    goMovetime(ms) { cmd(`go movetime ${ms}`); },
    goDepth(d) { cmd(`go depth ${d}`); },
    stop() { w.postMessage({ type: 'stop' }); },
    isReady() { return ready; }
  };
}

window.createEngineController = createEngineController;
