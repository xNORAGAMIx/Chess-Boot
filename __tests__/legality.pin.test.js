// __tests__/legality.pin.test.js
const { createInitialState, applyMove, getLegalMoves } = require('../engine/engine');

function clearBoard(s){ s.board = new Array(8).fill(null).map(()=>new Array(8).fill(null)); }

test('pinned piece cannot move if it exposes king to check (vertical pin) — off-file moves disallowed', () => {
  const s = createInitialState();
  clearBoard(s);
  // Setup:
  // White king at e1 (7,4)
  // White rook at e2 (6,4) — pinned to king by a black rook on e8 (0,4)
  s.board[7][4] = { t:'k', c:'w' };
  s.board[6][4] = { t:'r', c:'w' };
  s.board[0][4] = { t:'r', c:'b' };
  s.turn = 'w';

  // Get legal moves for the rook
  const legal = getLegalMoves(s, { r:6, f:4 });

  // 1) No legal move should have the rook move off the file (i.e., change file)
  const offFile = legal.filter(m => m.to.f !== 4);
  expect(offFile.length).toBe(0);

  // 2) There should be at least one legal move (e.g., moving up the file or capturing the attacker)
  expect(legal.length).toBeGreaterThan(0);

  // Optional: ensure one of the legal moves is the capture of the attacker at e8 (0,4)
  const captureAttacker = legal.some(m => m.to.r === 0 && m.to.f === 4);
  expect(captureAttacker).toBe(true);
});
