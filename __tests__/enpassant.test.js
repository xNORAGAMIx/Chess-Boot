// __tests__/enpassant.test.js
const { createInitialState, applyMove } = require("../engine/engine");

test("double pawn move sets enPassantTarget and opponent can capture en passant next move", () => {
  // Set up a simple custom position:
  // White pawn at e5 (row 3, file 4) and black pawn at d7 (row 1, file 3)
  const s = createInitialState();
  // clear board quickly
  s.board = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  s.board[3][4] = { t: "p", c: "w" }; // e5
  s.board[1][3] = { t: "p", c: "b" }; // d7
  s.turn = "b";

  // black pawn moves d7 -> d5 (two steps) -> enPassantTarget should be d6 (row 2, file 3)
  const move = { from: { r: 1, f: 3 }, to: { r: 3, f: 3 } };
  const s2 = applyMove(s, move);
  expect(s2.enPassantTarget).toEqual({ r: 2, f: 3 });

  // now white can capture en passant: e5 -> d6 (isEnPassant true)
  const epMove = {
    from: { r: 3, f: 4 },
    to: { r: 2, f: 3 },
    isEnPassant: true,
  };
  const s3 = applyMove(s2, epMove);

  // captured pawn should be removed from d5 (row 3, file 3)
  expect(s3.board[3][3]).toBeNull();
  // white pawn should land on d6
  expect(s3.board[2][3]).toEqual({ t: "p", c: "w" });
});

test("en passant target expires after one move if unused", () => {
  const s = createInitialState();
  s.board = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));
  s.board[3][4] = { t: "p", c: "w" }; // e5
  s.board[1][3] = { t: "p", c: "b" }; // d7
  s.turn = "b";

  const s2 = applyMove(s, { from: { r: 1, f: 3 }, to: { r: 3, f: 3 } }); // d7->d5
  expect(s2.enPassantTarget).toEqual({ r: 2, f: 3 });

  // Suppose white makes some other move (not en passant)
  // e.g., dummy: white moves some virtual piece (we'll move e5 -> e4)
  const s3 = applyMove(s2, { from: { r: 3, f: 4 }, to: { r: 4, f: 4 } });
  // enPassantTarget should be cleared
  expect(s3.enPassantTarget).toBeNull();
});
