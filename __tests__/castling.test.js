// __tests__/castling.test.js
const { createInitialState, applyMove } = require("../engine/engine");

test("king and rook moving clears castling rights", () => {
  const s = createInitialState();
  // move white king one square (simulate king moved)
  s.turn = "w";
  const s2 = applyMove(s, { from: { r: 7, f: 4 }, to: { r: 7, f: 5 } }); // e1 -> f1 (king moved)
  expect(s2.whiteCanCastleK).toBe(false);
  expect(s2.whiteCanCastleQ).toBe(false);

  // reset and test rook move
  const s0 = createInitialState();
  const s3 = applyMove(s0, { from: { r: 7, f: 7 }, to: { r: 6, f: 7 } }); // rook h1 -> h2
  expect(s3.whiteCanCastleK).toBe(false); // king-side rook moved -> no king-side castling
});

test("simple castling move moves rook correctly (king-side)", () => {
  // We'll build a custom position with king on e1 and rook on h1, and spaces empty between
  const s = createInitialState();
  // remove all pieces between e1 and h1
  s.board[7][5] = null; // f1
  s.board[7][6] = null; // g1
  s.turn = "w";

  // Castling move: king e1 -> g1 (from r7 f4 -> to r7 f6)
  const castlingMove = {
    from: { r: 7, f: 4 },
    to: { r: 7, f: 6 },
    isCastling: true,
  };
  const s2 = applyMove(s, castlingMove);

  // King should be at g1
  expect(s2.board[7][6]).toEqual({ t: "k", c: "w" });
  // Rook should have moved to f1 (7,5)
  expect(s2.board[7][5]).toEqual({ t: "r", c: "w" });
});
