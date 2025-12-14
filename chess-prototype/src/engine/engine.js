/* =========================
   Board utilities
========================= */
function createEmptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}
function cloneBoard(board) {
  return board.map((r) => r.map((c) => (c ? { ...c } : null)));
}
function inside(r, f) {
  return r >= 0 && r < 8 && f >= 0 && f < 8;
}
const FILES = "abcdefgh";

/* =========================
   Zobrist hashing
========================= */

let seed = 88172645463325252n;
function rand64() {
  seed ^= seed << 13n;
  seed ^= seed >> 7n;
  seed ^= seed << 17n;
  return BigInt.asUintN(64, seed);
}

function createZobrist() {
  const table = {};
  for (const c of ["w", "b"]) {
    for (const t of ["p", "n", "b", "r", "q", "k"]) {
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < 8; f++) {
          table[`${c}${t}${r}${f}`] = rand64();
        }
    }
  }
  return {
    table,
    side: rand64(),
    castling: { K: rand64(), Q: rand64(), k: rand64(), q: rand64() },
    epFile: Array.from({ length: 8 }, rand64),
  };
}

function computeHash(state) {
  let h = 0n;
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = state.board[r][f];
      if (p) h ^= state.zobrist.table[`${p.c}${p.t}${r}${f}`];
    }
  if (state.turn === "b") h ^= state.zobrist.side;
  if (state.whiteCanCastleK) h ^= state.zobrist.castling.K;
  if (state.whiteCanCastleQ) h ^= state.zobrist.castling.Q;
  if (state.blackCanCastleK) h ^= state.zobrist.castling.k;
  if (state.blackCanCastleQ) h ^= state.zobrist.castling.q;
  if (state.enPassantTarget) h ^= state.zobrist.epFile[state.enPassantTarget.f];
  return h;
}

/* =========================
   Initial state
========================= */
function createInitialState() {
  const board = createEmptyBoard();
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let f = 0; f < 8; f++) {
    board[0][f] = { t: back[f], c: "b" };
    board[1][f] = { t: "p", c: "b" };
    board[6][f] = { t: "p", c: "w" };
    board[7][f] = { t: back[f], c: "w" };
  }

  const zobrist = createZobrist();
  const state = {
    board,
    turn: "w",
    whiteCanCastleK: true,
    whiteCanCastleQ: true,
    blackCanCastleK: true,
    blackCanCastleQ: true,
    enPassantTarget: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    lastMove: null,
    moveHistory: [],
    positionCounts: new Map(),
    threefoldAvailable: false,
    zobrist,
  };

  const h = computeHash(state);
  state.positionCounts.set(h, 1);
  return state;
}

/* =========================
   Attack & check detection
========================= */
function isSquareAttacked(state, sq, byColor) {
  if (!sq) return false;
  const { board } = state;
  const { r, f } = sq;

  const pawnDir = byColor === "w" ? 1 : -1;
  for (const df of [-1, 1]) {
    const rr = r + pawnDir,
      ff = f + df;
    if (inside(rr, ff)) {
      const p = board[rr][ff];
      if (p && p.t === "p" && p.c === byColor) return true;
    }
  }

  const knightD = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  for (const [dr, df] of knightD) {
    const rr = r + dr,
      ff = f + df;
    if (inside(rr, ff)) {
      const p = board[rr][ff];
      if (p && p.t === "n" && p.c === byColor) return true;
    }
  }

  const dirs = {
    b: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
    r: [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ],
  };

  for (const [dr, df] of [...dirs.b, ...dirs.r]) {
    let rr = r + dr,
      ff = f + df;
    while (inside(rr, ff)) {
      const p = board[rr][ff];
      if (p) {
        if (
          p.c === byColor &&
          (p.t === "q" ||
            (p.t === "b" && Math.abs(dr) === 1) ||
            (p.t === "r" && dr * df === 0))
        )
          return true;
        break;
      }
      rr += dr;
      ff += df;
    }
  }

  for (let dr = -1; dr <= 1; dr++)
    for (let df = -1; df <= 1; df++) {
      if (dr || df) {
        const rr = r + dr,
          ff = f + df;
        if (inside(rr, ff)) {
          const p = board[rr][ff];
          if (p && p.t === "k" && p.c === byColor) return true;
        }
      }
    }
  return false;
}

function findKing(state, color) {
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = state.board[r][f];
      if (p && p.t === "k" && p.c === color) return { r, f };
    }
  return null;
}

function isInCheck(state, color) {
  const king = findKing(state, color);
  if (!king) return false; // IMPORTANT: tolerate transient states
  const opp = color === "w" ? "b" : "w";
  return isSquareAttacked(state, king, opp);
}

/* =========================
   SAN generation
========================= */
function needsDisambiguation(state, move) {
  const p = state.board[move.from.r][move.from.f];
  if (!p || p.t === "p") return false;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (r === move.from.r && f === move.from.f) continue;

      const other = state.board[r][f];
      if (!other || other.c !== p.c || other.t !== p.t) continue;

      const pseudo = getPseudoLegalMoves(state, { r, f });
      if (pseudo.some(m => m.to.r === move.to.r && m.to.f === move.to.f)) {
        return true;
      }
    }
  }
  return false;
}


function toSAN(state, move, next) {
  // Castling
  if (move.isCastling) {
    return move.to.f === 6 ? "O-O" : "O-O-O";
  }

  const p = state.board[move.from.r][move.from.f];
  if (!p) return ""; 
  const isPawn = p.t === "p";
  const isCapture = move.isEnPassant || state.board[move.to.r][move.to.f];

  const piece = isPawn ? "" : p.t.toUpperCase();

  // Disambiguation ONLY for non-pawns
  const disambig =
    !isPawn && needsDisambiguation(state, move) ? FILES[move.from.f] : "";

  // Pawn captures use file as identifier
  const pawnFile = isPawn && isCapture ? FILES[move.from.f] : "";

  const square = FILES[move.to.f] + (8 - move.to.r);
  const promo = move.promotion ? `=${move.promotion.toUpperCase()}` : "";

  // Only simple check detection here
  const check = isInCheck(next, next.turn) ? "+" : "";

  return `${piece}${disambig}${pawnFile}${
    isCapture ? "x" : ""
  }${square}${promo}${check}`;
}

/* =========================
   Move application
========================= */
function applyMove(state, move) {
  const next = applyMoveInternal(state, move);

  const san = toSAN(state, move, next);
  next.moveHistory = [...state.moveHistory, san];

  const h = computeHash(next);
  const c = (next.positionCounts.get(h) || 0) + 1;
  next.positionCounts = new Map(next.positionCounts).set(h, c);
  next.threefoldAvailable = c >= 3;

  return next;
}

function applyMoveInternal(state, move) {
  const board = cloneBoard(state.board);
  const p = board[move.from.r][move.from.f];
  let captured = null;

  if (move.isEnPassant) {
    const cr = state.turn === "w" ? move.to.r + 1 : move.to.r - 1;
    captured = board[cr][move.to.f];
    board[cr][move.to.f] = null;
  } else captured = board[move.to.r][move.to.f];

  if (move.isCastling) {
    const r = move.from.r;
    if (move.to.f === 6) {
      board[r][5] = board[r][7];
      board[r][7] = null;
    } else {
      board[r][3] = board[r][0];
      board[r][0] = null;
    }
  }

  board[move.to.r][move.to.f] = move.promotion
    ? { t: move.promotion, c: p.c }
    : p;
  board[move.from.r][move.from.f] = null;

  let { whiteCanCastleK, whiteCanCastleQ, blackCanCastleK, blackCanCastleQ } =
    state;
  if (p.t === "k")
    p.c === "w"
      ? ((whiteCanCastleK = false), (whiteCanCastleQ = false))
      : ((blackCanCastleK = false), (blackCanCastleQ = false));
  if (p.t === "r") {
    if (p.c === "w" && move.from.r === 7) {
      if (move.from.f === 0) whiteCanCastleQ = false;
      if (move.from.f === 7) whiteCanCastleK = false;
    }
    if (p.c === "b" && move.from.r === 0) {
      if (move.from.f === 0) blackCanCastleQ = false;
      if (move.from.f === 7) blackCanCastleK = false;
    }
  }
  if (captured?.t === "r") {
    if (captured.c === "w" && move.to.r === 7) {
      if (move.to.f === 0) whiteCanCastleQ = false;
      if (move.to.f === 7) whiteCanCastleK = false;
    }
    if (captured.c === "b" && move.to.r === 0) {
      if (move.to.f === 0) blackCanCastleQ = false;
      if (move.to.f === 7) blackCanCastleK = false;
    }
  }

  const ep =
    p.t === "p" && Math.abs(move.to.r - move.from.r) === 2
      ? { r: (move.to.r + move.from.r) / 2, f: move.from.f }
      : null;

  const half = p.t === "p" || captured ? 0 : state.halfmoveClock + 1;
  const next = {
    ...state,
    board,
    turn: state.turn === "w" ? "b" : "w",
    whiteCanCastleK,
    whiteCanCastleQ,
    blackCanCastleK,
    blackCanCastleQ,
    enPassantTarget: ep,
    halfmoveClock: half,
    fullmoveNumber:
      state.turn === "b" ? state.fullmoveNumber + 1 : state.fullmoveNumber,
    lastMove: move,
  };

  return next;
}

/* =========================
   Legal move generation
========================= */
// (pseudo + king safety filtering retained from your version, omitted here for brevity)
// PSEUDO-LEGAL moves (with promotions & en-passant & castling candidates)
function getPseudoLegalMoves(state, from) {
  const { board } = state;
  const p = board[from.r][from.f];
  if (!p) return [];
  const moves = [];
  const color = p.c;
  const opp = color === "w" ? "b" : "w";

  if (p.t === "n") {
    const ds = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    for (const [dr, df] of ds) {
      const rr = from.r + dr,
        ff = from.f + df;
      if (!inside(rr, ff)) continue;
      const target = board[rr][ff];
      if (!target || target.c !== color)
        moves.push({ from, to: { r: rr, f: ff } });
    }
    return moves;
  }

  if (p.t === "k") {
    for (let dr = -1; dr <= 1; dr++)
      for (let df = -1; df <= 1; df++) {
        if (dr === 0 && df === 0) continue;
        const rr = from.r + dr,
          ff = from.f + df;
        if (!inside(rr, ff)) continue;
        const t = board[rr][ff];
        if (!t || t.c !== color) moves.push({ from, to: { r: rr, f: ff } });
      }
    // castling candidates
    if (color === "w" && from.r === 7 && from.f === 4) {
      if (state.whiteCanCastleK && !board[7][5] && !board[7][6]) {
        const rook = board[7][7];
        if (rook && rook.t === "r" && rook.c === "w")
          moves.push({ from, to: { r: 7, f: 6 }, isCastling: true });
      }
      if (
        state.whiteCanCastleQ &&
        !board[7][3] &&
        !board[7][2] &&
        !board[7][1]
      ) {
        const rook = board[7][0];
        if (rook && rook.t === "r" && rook.c === "w")
          moves.push({ from, to: { r: 7, f: 2 }, isCastling: true });
      }
    }
    if (color === "b" && from.r === 0 && from.f === 4) {
      if (state.blackCanCastleK && !board[0][5] && !board[0][6]) {
        const rook = board[0][7];
        if (rook && rook.t === "r" && rook.c === "b")
          moves.push({ from, to: { r: 0, f: 6 }, isCastling: true });
      }
      if (
        state.blackCanCastleQ &&
        !board[0][3] &&
        !board[0][2] &&
        !board[0][1]
      ) {
        const rook = board[0][0];
        if (rook && rook.t === "r" && rook.c === "b")
          moves.push({ from, to: { r: 0, f: 2 }, isCastling: true });
      }
    }
    return moves;
  }

  // pawn moves with promotion generation
  if (p.t === "p") {
    const dir = p.c === "w" ? -1 : 1;
    const oneR = from.r + dir;
    const promotionRow = p.c === "w" ? 0 : 7;
    if (inside(oneR, from.f) && !board[oneR][from.f]) {
      if (oneR === promotionRow) {
        for (const promo of ["q", "r", "b", "n"])
          moves.push({ from, to: { r: oneR, f: from.f }, promotion: promo });
      } else {
        moves.push({ from, to: { r: oneR, f: from.f } });
        const startRow = p.c === "w" ? 6 : 1;
        const twoR = from.r + dir * 2;
        if (from.r === startRow && inside(twoR, from.f) && !board[twoR][from.f])
          moves.push({ from, to: { r: twoR, f: from.f } });
      }
    }
    for (const df of [-1, 1]) {
      const rr = from.r + dir,
        ff = from.f + df;
      if (!inside(rr, ff)) continue;
      const t = board[rr][ff];
      if (t && t.c === opp) {
        if (rr === promotionRow) {
          for (const promo of ["q", "r", "b", "n"])
            moves.push({ from, to: { r: rr, f: ff }, promotion: promo });
        } else {
          moves.push({ from, to: { r: rr, f: ff } });
        }
      }
      if (
        state.enPassantTarget &&
        state.enPassantTarget.r === rr &&
        state.enPassantTarget.f === ff
      ) {
        moves.push({ from, to: { r: rr, f: ff }, isEnPassant: true });
      }
    }
    return moves;
  }

  // sliding pieces
  const slideDirs = {
    b: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
    r: [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ],
    q: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ],
  };
  if (p.t === "b" || p.t === "r" || p.t === "q") {
    const dirs = slideDirs[p.t];
    for (const [dr, df] of dirs) {
      let rr = from.r + dr,
        ff = from.f + df;
      while (inside(rr, ff)) {
        const t = board[rr][ff];
        if (!t) {
          moves.push({ from, to: { r: rr, f: ff } });
        } else {
          if (t.c !== color) moves.push({ from, to: { r: rr, f: ff } });
          break;
        }
        rr += dr;
        ff += df;
      }
    }
    return moves;
  }
  return moves;
}

// Legal filtering (castling safe passage + simulation to prevent exposing king)
function getLegalMoves(state, from) {
  const p = state.board[from.r][from.f];
  if (!p) return [];
  let moves = getPseudoLegalMoves(state, from);

  moves = moves.filter((m) => {
    if (!m.isCastling) return true;
    if (isInCheck(state, p.c)) return false;
    const kingFrom = from;
    const kingTo = m.to;
    const stepFile = kingTo.f > kingFrom.f ? 1 : -1;
    const pass1 = { r: kingFrom.r, f: kingFrom.f + stepFile };
    const pass2 = { r: kingFrom.r, f: kingFrom.f + stepFile * 2 };
    const opp = p.c === "w" ? "b" : "w";
    if (isSquareAttacked(state, pass1, opp)) return false;
    if (isSquareAttacked(state, pass2, opp)) return false;
    return true;
  });

  const legal = moves.filter((m) => {
    const ns = applyMoveInternal(state, m);
    return !isInCheck(ns, p.c);
  });

  return legal;
}

function getAllLegalMoves(state, color) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = state.board[r][f];
      if (p && p.c === color) {
        const legal = getLegalMoves(state, { r, f });
        for (const m of legal) moves.push(m);
      }
    }
  return moves;
}

function isCheckmate(state, color) {
  // color = side to move
  if (!isInCheck(state, color)) return false;
  const moves = getAllLegalMoves(state, color);
  return moves.length === 0;
}

function isStalemate(state, color) {
  if (isInCheck(state, color)) return false;
  const moves = getAllLegalMoves(state, color);
  return moves.length === 0;
}

function getGameStatus(state) {
  // status from perspective of the side to move (state.turn)
  const color = state.turn;
  if (isCheckmate(state, color)) {
    return { status: "checkmate", winner: color === "w" ? "b" : "w" };
  }
  if (isStalemate(state, color)) {
    return { status: "stalemate", winner: null };
  }
  if (state.halfmoveClock >= 100) {
    return { status: "draw_50_moves", winner: null };
  }
  if (isInCheck(state, color)) {
    return { status: "check", winner: null };
  }
  return { status: "ongoing", winner: null };
}

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function calculateMaterial(board) {
  let score = { w: 0, b: 0 };

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p) score[p.c] += PIECE_VALUES[p.t];
    }
  }
  return score;
}



export {
  createInitialState,
  applyMove,
  isInCheck,
  getLegalMoves,
  getGameStatus,
  calculateMaterial
};
