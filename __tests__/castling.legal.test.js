// __tests__/castling.legal.test.js
const {
  createInitialState, applyMove, getPseudoLegalMoves, getLegalMoves,
  isSquareAttacked, isInCheck
} = require('../engine/engine');

function clearBoard(state) {
  state.board = new Array(8).fill(null).map(() => new Array(8).fill(null));
}

test('white king-side castling allowed when all conditions met', () => {
  const s = createInitialState();
  clearBoard(s);
  // put white king e1 (7,4) and rook h1 (7,7)
  s.board[7][4] = { t: 'k', c: 'w' };
  s.board[7][7] = { t: 'r', c: 'w' };
  s.turn = 'w';
  s.whiteCanCastleK = true;
  s.whiteCanCastleQ = false;

  // ensure squares f1(7,5) and g1(7,6) empty
  const pseudo = getPseudoLegalMoves(s, { r:7, f:4 });
  // expect castling candidate present (to f=6)
  expect(pseudo.some(m => m.isCastling && m.to.r===7 && m.to.f===6)).toBe(true);

  const legal = getLegalMoves(s, { r:7, f:4 });
  expect(legal.some(m => m.isCastling && m.to.r===7 && m.to.f===6)).toBe(true);

  // apply castling
  const kingMove = legal.find(m => m.isCastling && m.to.f===6);
  const s2 = applyMove(s, kingMove);
  // king at g1, rook at f1
  expect(s2.board[7][6]).toEqual({ t: 'k', c: 'w' });
  expect(s2.board[7][5]).toEqual({ t: 'r', c: 'w' });
  // castling rights cleared
  expect(s2.whiteCanCastleK).toBe(false);
  expect(s2.whiteCanCastleQ).toBe(false);
});

test('castling disallowed if king has moved earlier', () => {
  const s = createInitialState();
  clearBoard(s);
  s.board[7][4] = { t: 'k', c: 'w' };
  s.board[7][7] = { t: 'r', c: 'w' };
  s.turn = 'w';
  // simulate king moved earlier -> rights cleared
  s.whiteCanCastleK = false;
  s.whiteCanCastleQ = true;

  const legal = getLegalMoves(s, { r:7, f:4 });
  expect(legal.some(m => m.isCastling)).toBe(false);
});

test('castling disallowed if rook has moved earlier', () => {
  const s = createInitialState();
  clearBoard(s);
  s.board[7][4] = { t: 'k', c: 'w' };
  s.board[7][7] = { t: 'r', c: 'w' };
  s.turn = 'w';
  s.whiteCanCastleK = false; // simulate rook moved (king-side flag false)
  s.whiteCanCastleQ = true;

  const legal = getLegalMoves(s, { r:7, f:4 });
  expect(legal.some(m => m.isCastling)).toBe(false);
});

test('castling disallowed if pieces between king and rook', () => {
  const s = createInitialState();
  clearBoard(s);
  s.board[7][4] = { t: 'k', c: 'w' };
  s.board[7][7] = { t: 'r', c: 'w' };
  // put a bishop between at f1
  s.board[7][5] = { t: 'b', c: 'w' };
  s.turn = 'w';
  s.whiteCanCastleK = true;

  const pseudo = getPseudoLegalMoves(s, { r:7, f:4 });
  // pseudo should not include castling because we check empty squares when generating
  expect(pseudo.some(m => m.isCastling)).toBe(false);
  const legal = getLegalMoves(s, { r:7, f:4 });
  expect(legal.some(m => m.isCastling)).toBe(false);
});

test('castling disallowed if king is currently in check', () => {
  const s = createInitialState();
  clearBoard(s);
  s.board[7][4] = { t: 'k', c: 'w' };
  s.board[7][7] = { t: 'r', c: 'w' };
  s.turn = 'w';
  s.whiteCanCastleK = true;

  // place black rook attacking e1 (king's square)
  s.board[0][4] = { t: 'r', c: 'b' }; // black rook on e8
  // The rook on same file attacks down to e1 (no blocking)
  expect(isInCheck(s,'w')).toBe(true);

  const legal = getLegalMoves(s, { r:7, f:4 });
  expect(legal.some(m => m.isCastling)).toBe(false);
});

test('castling disallowed if king would pass through an attacked square', () => {
  const s = createInitialState();
  clearBoard(s);
  s.board[7][4] = { t: 'k', c: 'w' };
  s.board[7][7] = { t: 'r', c: 'w' };
  s.turn = 'w';
  s.whiteCanCastleK = true;

  // Place a black bishop attacking f1 (the square king would pass through)
  // Bishop on a6 (row 2, file 0) attacks f1? let's place black bishop at c4 (row4,file2) to attack f1 (7,5): diagonal from c4 (4,2) through d5,e6,f7 - not f1. Simpler: place black knight attacking f1.
  // Place black knight at g3 (row 5, file 6): knight at g3 attacks f1 (7,5)
  s.board[5][6] = { t: 'n', c: 'b' }; // g3
  // confirm f1 (7,5) is attacked
  const attacked = isSquareAttacked(s, { r:7, f:5 }, 'b');
  expect(attacked).toBe(true);

  const legal = getLegalMoves(s, { r:7, f:4 });
  // even though pseudo might include castling candidate, getLegalMoves will remove because pass-through square attacked
  expect(legal.some(m => m.isCastling)).toBe(false);
});
