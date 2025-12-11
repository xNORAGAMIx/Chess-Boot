// engine/engine.js
// CommonJS JS chess engine utils with castling & attack detection + legal-move filtering.
// Exports: createInitialState, applyMove, isSquareAttacked, isInCheck, getPseudoLegalMoves, getLegalMoves

function createEmptyBoard() {
  return new Array(8).fill(null).map(() => new Array(8).fill(null));
}

function cloneBoard(board) {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function createInitialState() {
  const board = createEmptyBoard();
  const backRank = ['r','n','b','q','k','b','n','r'];

  for (let f = 0; f < 8; f++) board[0][f] = { t: backRank[f], c: 'b' };
  for (let f = 0; f < 8; f++) board[1][f] = { t: 'p', c: 'b' };

  for (let f = 0; f < 8; f++) board[6][f] = { t: 'p', c: 'w' };
  for (let f = 0; f < 8; f++) board[7][f] = { t: backRank[f], c: 'w' };

  return {
    board,
    turn: 'w',
    whiteCanCastleK: true,
    whiteCanCastleQ: true,
    blackCanCastleK: true,
    blackCanCastleQ: true,
    enPassantTarget: null,
    halfmoveClock: 0,
    fullmoveNumber: 1
  };
}

/* applyMove: trusts the move shape; returns new state (does not validate legality).
   move: { from: {r,f}, to: {r,f}, promotion?, isEnPassant?, isCastling? }
*/
function applyMove(state, move) {
  const board = cloneBoard(state.board);
  const fromPiece = board[move.from.r][move.from.f];
  if (!fromPiece) throw new Error('No piece at from');

  if (move.isEnPassant) {
    const capturedRow = state.turn === 'w' ? move.to.r + 1 : move.to.r - 1;
    board[capturedRow][move.to.f] = null;
  }

  if (move.isCastling && fromPiece.t === 'k') {
    const kingRow = move.from.r;
    if (move.to.f === 6) { // king-side
      board[kingRow][5] = board[kingRow][7];
      board[kingRow][7] = null;
    } else if (move.to.f === 2) { // queen-side
      board[kingRow][3] = board[kingRow][0];
      board[kingRow][0] = null;
    }
  }

  board[move.to.r][move.to.f] = move.promotion ? { t: move.promotion, c: fromPiece.c } : fromPiece;
  board[move.from.r][move.from.f] = null;

  // update castling rights
  let wK = state.whiteCanCastleK, wQ = state.whiteCanCastleQ, bK = state.blackCanCastleK, bQ = state.blackCanCastleQ;
  if (fromPiece.t === 'k') {
    if (fromPiece.c === 'w') { wK = false; wQ = false; } else { bK = false; bQ = false; }
  }
  if (fromPiece.t === 'r') {
    if (fromPiece.c === 'w') {
      if (move.from.r === 7 && move.from.f === 0) wQ = false;
      if (move.from.r === 7 && move.from.f === 7) wK = false;
    } else {
      if (move.from.r === 0 && move.from.f === 0) bQ = false;
      if (move.from.r === 0 && move.from.f === 7) bK = false;
    }
  }

  // if a rook was captured on initial corner squares, clear rights (simple detection)
  if (state.board[0][0] && state.board[0][0].t === 'r' && board[0][0] === null) bQ = false;
  if (state.board[0][7] && state.board[0][7].t === 'r' && board[0][7] === null) bK = false;
  if (state.board[7][0] && state.board[7][0].t === 'r' && board[7][0] === null) wQ = false;
  if (state.board[7][7] && state.board[7][7].t === 'r' && board[7][7] === null) wK = false;

  // set enPassantTarget if pawn moved two squares
  let newEnPassant = null;
  if (fromPiece.t === 'p' && Math.abs(move.to.r - move.from.r) === 2) {
    const midR = (move.from.r + move.to.r) / 2;
    newEnPassant = { r: midR, f: move.from.f };
  }

  // halfmove clock
  const wasCapture = (state.board[move.to.r] && state.board[move.to.r][move.to.f] !== null) && !move.isEnPassant;
  let h = state.halfmoveClock;
  if (fromPiece.t === 'p' || wasCapture) h = 0; else h++;

  const newState = {
    board,
    turn: state.turn === 'w' ? 'b' : 'w',
    whiteCanCastleK: wK,
    whiteCanCastleQ: wQ,
    blackCanCastleK: bK,
    blackCanCastleQ: bQ,
    enPassantTarget: newEnPassant,
    halfmoveClock: h,
    fullmoveNumber: state.turn === 'b' ? state.fullmoveNumber + 1 : state.fullmoveNumber
  };
  return newState;
}

// helpers for attack detection and move generation

function inside(r,f) { return r>=0 && r<8 && f>=0 && f<8; }

// isSquareAttacked(state, square, byColor)
// returns true if `square` ({r,f}) is attacked by color 'w' or 'b'
function isSquareAttacked(state, square, byColor) {
  const { board } = state;
  const r = square.r, f = square.f;
  const enemy = byColor;

  // pawn attacks
  if (enemy === 'w') {
    const ar = r+1; // white pawns attack diagonally upwards from their perspective (they move up -> decreasing row), but remember our row 7 is white home; white pawns move r-1. To see attacks on square (r,f) by white pawns, these pawns must be at r+1.
    if (inside(ar, f-1) && board[ar][f-1] && board[ar][f-1].t === 'p' && board[ar][f-1].c === 'w') return true;
    if (inside(ar, f+1) && board[ar][f+1] && board[ar][f+1].t === 'p' && board[ar][f+1].c === 'w') return true;
  } else {
    const ar = r-1;
    if (inside(ar, f-1) && board[ar][f-1] && board[ar][f-1].t === 'p' && board[ar][f-1].c === 'b') return true;
    if (inside(ar, f+1) && board[ar][f+1] && board[ar][f+1].t === 'p' && board[ar][f+1].c === 'b') return true;
  }

  // knight attacks
  const knightD = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr,df] of knightD) {
    const rr = r + dr, ff = f + df;
    if (!inside(rr,ff)) continue;
    const p = board[rr][ff];
    if (p && p.t === 'n' && p.c === enemy) return true;
  }

  // king adjacency (attacks)
  for (let dr=-1; dr<=1; dr++) for (let df=-1; df<=1; df++) {
    if (dr===0 && df===0) continue;
    const rr = r+dr, ff = f+df;
    if (!inside(rr,ff)) continue;
    const p = board[rr][ff];
    if (p && p.t === 'k' && p.c === enemy) return true;
  }

  // sliding pieces: bishop/queen (diagonals)
  const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (const [dr,df] of diagDirs) {
    let rr = r+dr, ff = f+df;
    while (inside(rr,ff)) {
      const p = board[rr][ff];
      if (p) {
        if (p.c === enemy && (p.t === 'b' || p.t === 'q')) return true;
        break; // blocked
      }
      rr += dr; ff += df;
    }
  }

  // sliding pieces: rook/queen (straight)
  const straightDirs = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dr,df] of straightDirs) {
    let rr = r+dr, ff = f+df;
    while (inside(rr,ff)) {
      const p = board[rr][ff];
      if (p) {
        if (p.c === enemy && (p.t === 'r' || p.t === 'q')) return true;
        break;
      }
      rr += dr; ff += df;
    }
  }

  return false;
}

// find king pos for a color
function findKing(state, color) {
  for (let r=0;r<8;r++) for (let f=0;f<8;f++) {
    const p = state.board[r][f];
    if (p && p.t === 'k' && p.c === color) return { r,f };
  }
  return null;
}

function isInCheck(state, color) {
  const king = findKing(state,color);
  if (!king) return false;
  const opp = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(state, king, opp);
}

// generate pseudo-legal moves for piece at `from` (does not check for king-in-check after move).
// Will add isCastling flag for king moves that look like castling candidates.
function getPseudoLegalMoves(state, from) {
  const { board } = state;
  const p = board[from.r][from.f];
  if (!p) return [];
  const moves = [];
  const color = p.c;
  const opp = color === 'w' ? 'b' : 'w';

  if (p.t === 'n') {
    const ds = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr,df] of ds) {
      const rr = from.r+dr, ff = from.f+df;
      if (!inside(rr,ff)) continue;
      const target = board[rr][ff];
      if (!target || target.c !== color) moves.push({ from, to: { r: rr, f: ff }});
    }
    return moves;
  }

  if (p.t === 'k') {
    for (let dr=-1; dr<=1; dr++) for (let df=-1; df<=1; df++) {
      if (dr===0 && df===0) continue;
      const rr = from.r+dr, ff = from.f+df;
      if (!inside(rr,ff)) continue;
      const t = board[rr][ff];
      if (!t || t.c !== color) moves.push({ from, to: { r: rr, f: ff }});
    }

    // castling candidates: only if king and corresponding castling rights set
    if (color === 'w' && from.r === 7 && from.f === 4) {
      // white king on starting square
      if (state.whiteCanCastleK) {
        // squares between (f=5,6) empty
        if (!board[7][5] && !board[7][6]) {
          // king not in check, squares not attacked, rook exists at h1
          const rook = board[7][7];
          if (rook && rook.t === 'r' && rook.c === 'w') {
            moves.push({ from, to: { r:7, f:6 }, isCastling: true });
          }
        }
      }
      if (state.whiteCanCastleQ) {
        if (!board[7][3] && !board[7][2] && !board[7][1]) {
          const rook = board[7][0];
          if (rook && rook.t === 'r' && rook.c === 'w') {
            moves.push({ from, to: { r:7, f:2 }, isCastling: true });
          }
        }
      }
    }
    if (color === 'b' && from.r === 0 && from.f === 4) {
      if (state.blackCanCastleK) {
        if (!board[0][5] && !board[0][6]) {
          const rook = board[0][7];
          if (rook && rook.t === 'r' && rook.c === 'b') {
            moves.push({ from, to: { r:0, f:6 }, isCastling: true });
          }
        }
      }
      if (state.blackCanCastleQ) {
        if (!board[0][3] && !board[0][2] && !board[0][1]) {
          const rook = board[0][0];
          if (rook && rook.t === 'r' && rook.c === 'b') {
            moves.push({ from, to: { r:0, f:2 }, isCastling: true });
          }
        }
      }
    }

    return moves;
  }

  // pawn moves (simplified pseudo-legal: forward, captures; doesn't include enPassant generation here)
  if (p.t === 'p') {
    const dir = p.c === 'w' ? -1 : 1;
    const oneR = from.r + dir;
    if (inside(oneR, from.f) && !board[oneR][from.f]) {
      // forward
      moves.push({ from, to: { r: oneR, f: from.f }});
      // double
      const startRow = p.c === 'w' ? 6 : 1;
      const twoR = from.r + dir*2;
      if (from.r === startRow && inside(twoR,from.f) && !board[twoR][from.f]) {
        moves.push({ from, to: { r: twoR, f: from.f }});
      }
    }
    // captures
    for (const df of [-1,1]) {
      const rr = from.r + dir, ff = from.f + df;
      if (!inside(rr,ff)) continue;
      const t = board[rr][ff];
      if (t && t.c === opp) moves.push({ from, to: { r: rr, f: ff }});
      // en passant capture: if enPassantTarget matches and captured pawn exists behind target, mark isEnPassant
      if (state.enPassantTarget && state.enPassantTarget.r === rr && state.enPassantTarget.f === ff) {
        moves.push({ from, to: { r: rr, f: ff }, isEnPassant: true });
      }
    }
    return moves;
  }

  // sliding pieces: bishop, rook, queen
  const slideDirs = {
    b: [[-1,-1],[-1,1],[1,-1],[1,1]],
    r: [[-1,0],[1,0],[0,-1],[0,1]],
    q: [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
  };
  if (p.t === 'b' || p.t === 'r' || p.t === 'q') {
    const dirs = slideDirs[p.t];
    for (const [dr,df] of dirs) {
      let rr = from.r + dr, ff = from.f + df;
      while (inside(rr,ff)) {
        const t = board[rr][ff];
        if (!t) {
          moves.push({ from, to: { r: rr, f: ff }});
        } else {
          if (t.c !== color) moves.push({ from, to: { r: rr, f: ff }});
          break;
        }
        rr += dr; ff += df;
      }
    }
    return moves;
  }

  return moves;
}

// getLegalMoves(state, from) — generate pseudo-legal moves and filter out those that leave own king in check.
// Also excludes castling moves that violate "king not in check" and "safe passage" rules.
function getLegalMoves(state, from) {
  const p = state.board[from.r][from.f];
  if (!p) return [];

  // get pseudo moves
  let moves = getPseudoLegalMoves(state, from);

  // Special: for castling moves, enforce additional conditions:
  moves = moves.filter(m => {
    if (!m.isCastling) return true;
    // four conditions you listed:
    // a) unmoved pieces — already enforced by castling rights booleans we used when generating
    // b) no pieces in between — already checked when generating
    // c) king not in check currently
    if (isInCheck(state, p.c)) return false;
    // d) safe passage: king cannot pass through or land on attacked squares
    // For king-side castling: squares that matter are the from square, intermediate, and destination.
    const kingFrom = from;
    const kingTo = m.to;
    const stepFile = kingTo.f > kingFrom.f ? 1 : -1;
    // we will check the squares the king visits: from + step, and to (destination)
    const pass1 = { r: kingFrom.r, f: kingFrom.f + stepFile };
    const pass2 = { r: kingFrom.r, f: kingFrom.f + stepFile*2 };
    const opp = p.c === 'w' ? 'b' : 'w';
    // pass1 and pass2 must not be attacked by opponent
    if (isSquareAttacked(state, pass1, opp)) return false;
    if (isSquareAttacked(state, pass2, opp)) return false;
    return true;
  });

  // Now filter moves that would leave own king in check after move
  const legal = moves.filter(m => {
    const ns = applyMove(state, m);
    // After move, is own king in check?
    return !isInCheck(ns, p.c);
  });

  return legal;
}

module.exports = {
  createInitialState,
  applyMove,
  isSquareAttacked,
  isInCheck,
  getPseudoLegalMoves,
  getLegalMoves
};
