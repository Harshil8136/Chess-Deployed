// engine-worker.js
// Loads Stockfish (JS/WASM) from CDNJS inside a classic Web Worker via importScripts.
let sf = null;

// Choose a known-good Stockfish build hosted on cdnjs.
// If you change versions, verify the file exists on cdnjs.
const STOCKFISH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';

function post(line) { self.postMessage(line); }

// Initialize Stockfish
async function init() {
  try {
    importScripts(STOCKFISH_URL);
    // stockfish.js exposes a dedicated Worker-like object via STOCKFISH() in many builds
    sf = (typeof STOCKFISH === 'function') ? STOCKFISH() : (typeof Module !== 'undefined' ? Module : null);
    if (!sf) throw new Error('Stockfish not found in scope');
    // forward engine messages
    sf.onmessage = (e) => {
      const text = typeof e === 'string' ? e : e.data;
      post({ type: 'raw', text });
      if (typeof text === 'string') {
        if (text.startsWith('bestmove')) {
          const move = text.split(' ')[1];
          post({ type: 'bestmove', move });
        } else if (text.startsWith('info')) {
          // parse cp and pv SAN elsewhere if desired
          post({ type: 'infoText', text });
        }
      }
    };
    sf.postMessage('uci');
    post({ type: 'ready' });
  } catch (err) {
    post({ type: 'error', error: String(err) });
  }
}

self.onmessage = (e) => {
  const { type, data } = e.data || {};
  if (type === 'init') init();
  else if (type === 'cmd' && sf) sf.postMessage(data);
  else if (type === 'stop' && sf) sf.postMessage('stop');
};
