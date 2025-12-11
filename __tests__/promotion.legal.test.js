// __tests__/promotion.legal.test.js
const { createInitialState, applyMove, getLegalMoves } = require('../engine/engine');

function clearBoard(s){ s.board = new Array(8).fill(null).map(()=>new Array(8).fill(null)); }

test('pawn reaching last rank generates promotion moves and applyMove supports promotion', () => {
  const s = createInitialState();
  clearBoard(s);
  // White pawn on 7th rank at a2 -> place it on a7 (r1,f0) so one move to promotion at a8 (r0,f0)
  s.board[1][0] = { t:'p', c:'w' }; // row1 is second from top, but simpler: put white pawn at row1 and have it promote to row0
  s.turn = 'w';

  // generate legal moves
  const legals = getLegalMoves(s, { r:1, f:0 });
  // should include promotions to a8 (r0,f0) with promotion flags
  const promos = legals.filter(m => m.to.r === 0 && m.promotion);
  // promotions to q/r/b/n => length 4
  expect(promos.length).toBeGreaterThanOrEqual(4);

  // pick a promotion to queen and apply
  const promQueen = promos.find(m => m.promotion === 'q');
  const s2 = applyMove(s, promQueen);
  expect(s2.board[0][0]).toEqual({ t: 'q', c: 'w' });
  expect(s2.board[1][0]).toBeNull();
});
