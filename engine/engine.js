function createEmptyBoard() {
  return new Array(8).fill(null).map(() => new Array(8).fill(null));
}
function cloneBoard(board) { return board.map(r => r.map(c => (c ? { ...c } : null))); }
function inside(r,f){ return r>=0 && r<8 && f>=0 && f<8; }

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
    fullmoveNumber: 1,
    lastMove: null // { from:{r,f}, to:{r,f}, captured: {t,c} | null, promotion?, isEnPassant?, isCastling? }
  };
}

/* applyMove: trusts the move shape; returns new state (does not validate legality).
   move: { from: {r,f}, to: {r,f}, promotion?, isEnPassant?, isCastling? }
*/
function applyMove(state, move) {
  const board = cloneBoard(state.board);
  const fromPiece = board[move.from.r][move.from.f];
  if (!fromPiece) throw new Error('No piece at from');

  // figure out captured piece (for lastMove info)
  let captured = null;
  if (move.isEnPassant) {
    const capRow = state.turn === 'w' ? move.to.r + 1 : move.to.r - 1;
    captured = board[capRow][move.to.f];
  } else {
    captured = board[move.to.r][move.to.f];
  }

  // en-passant removal
  if (move.isEnPassant) {
    const capturedRow = state.turn === 'w' ? move.to.r + 1 : move.to.r - 1;
    board[capturedRow][move.to.f] = null;
  }

  // castling rook movement
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

  // place piece (handle promotion)
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

  // if a rook was captured on original corner squares, clear rights (simple)
  if (state.board[0][0] && state.board[0][0].t === 'r' && board[0][0] === null) bQ = false;
  if (state.board[0][7] && state.board[0][7].t === 'r' && board[0][7] === null) bK = false;
  if (state.board[7][0] && state.board[7][0].t === 'r' && board[7][0] === null) wQ = false;
  if (state.board[7][7] && state.board[7][7].t === 'r' && board[7][7] === null) wK = false;

  // en passant target
  let newEnPassant = null;
  if (fromPiece.t === 'p' && Math.abs(move.to.r - move.from.r) === 2) {
    const midR = (move.from.r + move.to.r) / 2;
    newEnPassant = { r: midR, f: move.from.f };
  }

  // halfmove clock
  const wasCapture = captured !== null && !move.isEnPassant;
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
    fullmoveNumber: state.turn === 'b' ? state.fullmoveNumber + 1 : state.fullmoveNumber,
    lastMove: {
      from: move.from,
      to: move.to,
      captured: captured ? { t: captured.t, c: captured.c } : null,
      promotion: move.promotion || null,
      isEnPassant: !!move.isEnPassant,
      isCastling: !!move.isCastling
    }
  };
  return newState;
}

// attack detection
function isSquareAttacked(state, square, byColor) {
  const { board } = state;
  const r = square.r, f = square.f;
  const enemy = byColor;

  // pawn attacks (white pawns are moving 'up' (row decreasing))
  if (enemy === 'w') {
    const ar = r + 1;
    if (inside(ar, f-1) && board[ar][f-1] && board[ar][f-1].t === 'p' && board[ar][f-1].c === 'w') return true;
    if (inside(ar, f+1) && board[ar][f+1] && board[ar][f+1].t === 'p' && board[ar][f+1].c === 'w') return true;
  } else {
    const ar = r - 1;
    if (inside(ar, f-1) && board[ar][f-1] && board[ar][f-1].t === 'p' && board[ar][f-1].c === 'b') return true;
    if (inside(ar, f+1) && board[ar][f+1] && board[ar][f+1].t === 'p' && board[ar][f+1].c === 'b') return true;
  }

  // knight
  const knightD = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr,df] of knightD) {
    const rr = r + dr, ff = f + df;
    if (!inside(rr,ff)) continue;
    const p = board[rr][ff];
    if (p && p.t === 'n' && p.c === enemy) return true;
  }

  // king adjacency
  for (let dr=-1; dr<=1; dr++) for (let df=-1; df<=1; df++) {
    if (dr===0 && df===0) continue;
    const rr = r+dr, ff = f+df;
    if (!inside(rr,ff)) continue;
    const p = board[rr][ff];
    if (p && p.t === 'k' && p.c === enemy) return true;
  }

  // bishops/queens diagonals
  const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (const [dr,df] of diagDirs) {
    let rr = r+dr, ff = f+df;
    while (inside(rr,ff)) {
      const p = board[rr][ff];
      if (p) {
        if (p.c === enemy && (p.t === 'b' || p.t === 'q')) return true;
        break;
      }
      rr += dr; ff += df;
    }
  }

  // rooks/queens straight
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

// PSEUDO-LEGAL moves (with promotions & en-passant & castling candidates)
function getPseudoLegalMoves(state, from) {
  const { board } = state; const p = board[from.r][from.f];
  if (!p) return [];
  const moves = []; const color = p.c; const opp = color === 'w' ? 'b' : 'w';

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
    // castling candidates
    if (color === 'w' && from.r === 7 && from.f === 4) {
      if (state.whiteCanCastleK && !board[7][5] && !board[7][6]) {
        const rook = board[7][7]; if (rook && rook.t === 'r' && rook.c === 'w') moves.push({ from, to: { r:7, f:6 }, isCastling: true });
      }
      if (state.whiteCanCastleQ && !board[7][3] && !board[7][2] && !board[7][1]) {
        const rook = board[7][0]; if (rook && rook.t === 'r' && rook.c === 'w') moves.push({ from, to: { r:7, f:2 }, isCastling: true });
      }
    }
    if (color === 'b' && from.r === 0 && from.f === 4) {
      if (state.blackCanCastleK && !board[0][5] && !board[0][6]) {
        const rook = board[0][7]; if (rook && rook.t === 'r' && rook.c === 'b') moves.push({ from, to: { r:0, f:6 }, isCastling: true });
      }
      if (state.blackCanCastleQ && !board[0][3] && !board[0][2] && !board[0][1]) {
        const rook = board[0][0]; if (rook && rook.t === 'r' && rook.c === 'b') moves.push({ from, to: { r:0, f:2 }, isCastling: true });
      }
    }
    return moves;
  }

  // pawn moves with promotion generation
  if (p.t === 'p') {
    const dir = p.c === 'w' ? -1 : 1;
    const oneR = from.r + dir;
    const promotionRow = p.c === 'w' ? 0 : 7;
    if (inside(oneR, from.f) && !board[oneR][from.f]) {
      if (oneR === promotionRow) {
        for (const promo of ['q','r','b','n']) moves.push({ from, to: { r: oneR, f: from.f }, promotion: promo });
      } else {
        moves.push({ from, to: { r: oneR, f: from.f }});
        const startRow = p.c === 'w' ? 6 : 1;
        const twoR = from.r + dir*2;
        if (from.r === startRow && inside(twoR,from.f) && !board[twoR][from.f]) moves.push({ from, to: { r: twoR, f: from.f }});
      }
    }
    for (const df of [-1,1]) {
      const rr = from.r + dir, ff = from.f + df;
      if (!inside(rr,ff)) continue;
      const t = board[rr][ff];
      if (t && t.c === opp) {
        if (rr === promotionRow) {
          for (const promo of ['q','r','b','n']) moves.push({ from, to: { r: rr, f: ff }, promotion: promo });
        } else {
          moves.push({ from, to: { r: rr, f: ff }});
        }
      }
      if (state.enPassantTarget && state.enPassantTarget.r === rr && state.enPassantTarget.f === ff) {
        moves.push({ from, to: { r: rr, f: ff }, isEnPassant: true });
      }
    }
    return moves;
  }

  // sliding pieces
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
        if (!t) { moves.push({ from, to: { r: rr, f: ff }}); }
        else { if (t.c !== color) moves.push({ from, to: { r: rr, f: ff }}); break; }
        rr += dr; ff += df;
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

  moves = moves.filter(m => {
    if (!m.isCastling) return true;
    if (isInCheck(state, p.c)) return false;
    const kingFrom = from;
    const kingTo = m.to;
    const stepFile = kingTo.f > kingFrom.f ? 1 : -1;
    const pass1 = { r: kingFrom.r, f: kingFrom.f + stepFile };
    const pass2 = { r: kingFrom.r, f: kingFrom.f + stepFile*2 };
    const opp = p.c === 'w' ? 'b' : 'w';
    if (isSquareAttacked(state, pass1, opp)) return false;
    if (isSquareAttacked(state, pass2, opp)) return false;
    return true;
  });

  const legal = moves.filter(m => {
    const ns = applyMove(state, m);
    return !isInCheck(ns, p.c);
  });

  return legal;
}

function getAllLegalMoves(state, color) {
  const moves = [];
  for (let r=0;r<8;r++) for (let f=0;f<8;f++) {
    const p = state.board[r][f];
    if (p && p.c === color) {
      const legal = getLegalMoves(state, { r,f });
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
    return { status: 'checkmate', winner: color === 'w' ? 'b' : 'w' };
  }
  if (isStalemate(state, color)) {
    return { status: 'stalemate', winner: null };
  }
  if (state.halfmoveClock >= 100) {
    return { status: 'draw_50_moves', winner: null };
  }
  if (isInCheck(state, color)) {
    return { status: 'check', winner: null };
  }
  return { status: 'ongoing', winner: null };
}

export {
  createInitialState,
  applyMove,
  isSquareAttacked,
  isInCheck,
  getPseudoLegalMoves,
  getLegalMoves,
  getAllLegalMoves,
  isCheckmate,
  isStalemate,
  getGameStatus
};
