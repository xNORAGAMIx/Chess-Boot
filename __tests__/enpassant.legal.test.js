// __tests__/enpassant.legal.test.js
const { createInitialState, applyMove, getLegalMoves } = require('../engine/engine');

function clearBoard(s){ s.board = new Array(8).fill(null).map(()=>new Array(8).fill(null)); }

test('en-passant is available as a legal move immediately after double-step and removes captured pawn', () => {
  const s = createInitialState();
  clearBoard(s);
  // White pawn at e5 (r3,f4), black pawn at d7 (r1,f3)
  s.board[3][4] = { t:'p', c:'w' }; // e5
  s.board[1][3] = { t:'p', c:'b' }; // d7
  s.turn = 'b';

  // Black plays d7->d5
  const s2 = applyMove(s, { from:{r:1,f:3}, to:{r:3,f:3} });
  expect(s2.enPassantTarget).toEqual({ r:2, f:3 });

  // Now white should have en-passant as a legal move: e5 -> d6 (r3->r2,f4->f3)
  const legal = getLegalMoves(s2, { r:3, f:4 });
  const ep = legal.find(m => m.isEnPassant);
  expect(ep).toBeDefined();

  const s3 = applyMove(s2, ep);
  // captured pawn should be removed from d5 (r3,f3)
  expect(s3.board[3][3]).toBeNull();
  // white pawn should be on d6 (r2,f3)
  expect(s3.board[2][3]).toEqual({ t:'p', c:'w' });
});

test('en-passant disappears after one non-enpassant move', () => {
  const s = createInitialState();
  clearBoard(s);
  s.board[3][4] = { t:'p', c:'w' }; // e5
  s.board[1][3] = { t:'p', c:'b' }; // d7
  s.turn = 'b';

  const s2 = applyMove(s, { from:{r:1,f:3}, to:{r:3,f:3} }); // d5
  expect(s2.enPassantTarget).toEqual({ r:2, f:3 });

  // now white plays a different move, say moving the pawn forward (e5->e4)
  const s3 = applyMove(s2, { from:{r:3,f:4}, to:{r:4,f:4} });
  expect(s3.enPassantTarget).toBeNull();

  // now black's pawn cannot be captured en-passant
  const legalForWhite = getLegalMoves(s3, { r:4, f:4 });
  expect(legalForWhite.some(m => m.isEnPassant)).toBe(false);
});
