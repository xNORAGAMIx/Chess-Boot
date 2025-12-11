function createEmptyBoard() {
  // creating a 8x8 board
  const b = new Array(8).fill(null).map(() => new Array(8).fill(null));
  return b;
}

function cloneBoard(board) {
  // create a copy of the board to execute moves
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

// set up the pieces on the board and initial rules
function createInitialState() {
  const board = createEmptyBoard();

  const backRank = ["r", "n", "b", "q", "k", "b", "n", "r"]; // pieces

  // board on black side
  for (let f = 0; f < 8; f++) {
    board[0][f] = {
      t: backRank[f],
      c: "b",
    };
  }
  // pawns - black
  for (let f = 0; f < 8; f++) {
    board[1][f] = {
      t: "p",
      c: "b",
    };
  }

  // board on white side
  // pawns - white
  for (let f = 0; f < 8; f++) {
    board[6][f] = {
      t: "p",
      c: "w",
    };
  }
  for (let f = 0; f < 8; f++) {
    board[7][f] = {
      t: backRank[f],
      c: "w",
    };
  }

  // return board and initial rules
  return {
    board,
    turn: "w",
    whiteCanCastleK: true,
    whiteCanCastleQ: true,
    blackCanCastleK: true,
    blackCanCastleQ: true,
    enPassantTarget: null, // { rank, file } || null
    halfmoveClock: 0,
    fullmoveNumber: 1,
  };
}

/**
 * move: { from: {r,f}, to: {r,f}, promotion?: 'q|r|b|n', isEnPassant?: bool, isCastling?: bool }
 * return a new state, dont change the original
 */


function applyMove(state, move) {
  const board = cloneBoard(state.board);
  const fromPiece = board[move.from.r][move.from.f]; // extracting the piece location
  if (!fromPiece) throw new Error("No piece at from"); // if null no piece 

  // en passant capture removal
  if (move.isEnPassant) {
    const capturedRow = state.turn === "w" ? move.to.r + 1 : move.to.r - 1;
    board[capturedRow][move.to.f] = null;
  }

  /**
   * when pawn moves two ahead (turn black) , then white has chance for en passsant
   * when that happens, white pawn moves to one block below the black pawn
   * the black pawn box has to be made empty
   * hence when white turn for en passant , the white pawn postion r
   * r+1 has to be made empty, since white captured black 
   */

  // castling rook movement
  if (move.isCastling && fromPiece.t === "k") {
    const kingRow = move.from.r;
    if (move.to.f === 6) {
      // king-side
      board[kingRow][5] = board[kingRow][7];
      board[kingRow][7] = null;
    } else if (move.to.f === 2) {
      // queen-side
      board[kingRow][3] = board[kingRow][0];
      board[kingRow][0] = null;
    }
  }

  // normal move
  board[move.to.r][move.to.f] = move.promotion
    ? { t: move.promotion, c: fromPiece.c }
    : fromPiece;
  board[move.from.r][move.from.f] = null;

  // update castling rights
  let wK = state.whiteCanCastleK,
    wQ = state.whiteCanCastleQ,
    bK = state.blackCanCastleK,
    bQ = state.blackCanCastleQ;
  if (fromPiece.t === "k") {
    if (fromPiece.c === "w") {
      wK = false;
      wQ = false;
    } else {
      bK = false;
      bQ = false;
    }
  }
  if (fromPiece.t === "r") {
    if (fromPiece.c === "w") {
      if (move.from.r === 7 && move.from.f === 0) wQ = false;
      if (move.from.r === 7 && move.from.f === 7) wK = false;
    } else {
      if (move.from.r === 0 && move.from.f === 0) bQ = false;
      if (move.from.r === 0 && move.from.f === 7) bK = false;
    }
  }

  // if a rook was captured on initial corner squares, clear rights
  if (state.board[0][0] && state.board[0][0].t === "r" && board[0][0] === null)
    bQ = false;
  if (state.board[0][7] && state.board[0][7].t === "r" && board[0][7] === null)
    bK = false;
  if (state.board[7][0] && state.board[7][0].t === "r" && board[7][0] === null)
    wQ = false;
  if (state.board[7][7] && state.board[7][7].t === "r" && board[7][7] === null)
    wK = false;

  // set enPassantTarget if double pawn move happened
  let newEnPassant = null;
  if (fromPiece.t === "p" && Math.abs(move.to.r - move.from.r) === 2) {
    const midR = (move.from.r + move.to.r) / 2;
    newEnPassant = { r: midR, f: move.from.f };
  }

  // halfmove clock reset on pawn move or capture
  const wasCapture =
    state.board[move.to.r] &&
    state.board[move.to.r][move.to.f] !== null &&
    !move.isEnPassant;
  let h = state.halfmoveClock;
  if (fromPiece.t === "p" || wasCapture) h = 0;
  else h++;

  const newState = {
    board,
    turn: state.turn === "w" ? "b" : "w",
    whiteCanCastleK: wK,
    whiteCanCastleQ: wQ,
    blackCanCastleK: bK,
    blackCanCastleQ: bQ,
    enPassantTarget: newEnPassant,
    halfmoveClock: h,
    fullmoveNumber:
      state.turn === "b" ? state.fullmoveNumber + 1 : state.fullmoveNumber,
  };
  return newState;
}

module.exports = {
  createInitialState,
  applyMove,
  createEmptyBoard, 
};
