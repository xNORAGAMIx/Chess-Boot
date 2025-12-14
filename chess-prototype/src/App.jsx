const INITIAL_TIME = 10 * 60; // seconds

import { useEffect, useState } from "react";
import {
  createInitialState,
  applyMove,
  getLegalMoves,
  getGameStatus,
  calculateMaterial,
} from "./engine/engine";

function serializeStateForStorage(state) {
  const { zobrist, positionCounts, ...rest } = state;

  return rest;
}

// piece to unicode
const pieceToUnicode = (p) => {
  if (!p) return "";
  const map = {
    w: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♙" },
  };
  return map[p.c]?.[p.t] || "";
};

const toAlgebraic = ({ r, f }) => "abcdefgh"[f] + (8 - r);

/* =========================
   State inspector (UNCHANGED)
========================= */
function stateToSerializable(s) {
  const board = s.board.map((row) =>
    row.map((cell) => (cell ? `${cell.c}${cell.t.toUpperCase()}` : ".."))
  );

  return {
    turn: s.turn,
    enPassantTarget: s.enPassantTarget ? toAlgebraic(s.enPassantTarget) : null,
    castling: {
      whiteK: !!s.whiteCanCastleK,
      whiteQ: !!s.whiteCanCastleQ,
      blackK: !!s.blackCanCastleK,
      blackQ: !!s.blackCanCastleQ,
    },
    halfmoveClock: s.halfmoveClock,
    fullmoveNumber: s.fullmoveNumber,
    board,
  };
}

function CompactBoard({ board }) {
  return (
    <div className="grid grid-cols-8 gap-0 border border-gray-200 text-xs">
      {board.flatMap((row, r) =>
        row.map((cell, f) => (
          <div
            key={`${r}-${f}`}
            className="w-8 h-8 flex items-center justify-center border-[1px] border-gray-100 bg-white"
          >
            {cell === ".." ? (
              <span className="text-gray-300">·</span>
            ) : (
              <span>{cell}</span>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function StateViewer({ state }) {
  const serial = stateToSerializable(state);
  const pretty = JSON.stringify(serial, null, 2);

  return (
    <div className="p-3 bg-gray-50 rounded border border-gray-200 w-80">
      <div className="mb-2 text-sm font-medium">State inspector</div>
      <div className="mb-2">
        <CompactBoard board={serial.board} />
      </div>
      <pre className="text-[11px] max-h-40 overflow-auto">{pretty}</pre>
    </div>
  );
}

/* =========================
   Main App
========================= */
export default function App() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem("chess-state");
    if (!saved) return createInitialState();

    const parsed = JSON.parse(saved);
    const fresh = createInitialState();

    return {
      ...fresh, // restores zobrist, maps, internals
      ...parsed, // restores board, moves, clocks
    };
  });

  const [selected, setSelected] = useState(null);
  const [legalSet, setLegalSet] = useState(new Set());
  const [legalMoves, setLegalMoves] = useState([]);
  const [promoChoice, setPromoChoice] = useState(null);
  const [message, setMessage] = useState("");
  const [showInspector, setShowInspector] = useState(false);
  const [halfCounter, setHalfCounter] = useState(null);
  const [time, setTime] = useState({
    w: INITIAL_TIME,
    b: INITIAL_TIME,
  });

  const [running, setRunning] = useState(true);

  const material = calculateMaterial(state.board);
  const [score, setScore] = useState({ w: 0, b: 0 });

  // persist state
  useEffect(() => {
    const safeState = serializeStateForStorage(state);
    localStorage.setItem("chess-state", JSON.stringify(safeState));
  }, [state]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setTime((t) => {
        const side = state.turn;
        if (t[side] <= 0) return t;

        return {
          ...t,
          [side]: t[side] - 1,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.turn, running]);

  useEffect(() => {
    if (time.w <= 0) {
      setMessage("White lost on time — Black wins");
      setRunning(false);
    }
    if (time.b <= 0) {
      setMessage("Black lost on time — White wins");
      setRunning(false);
    }
  }, [time]);

  function selectPiece(r, f) {
    const legal = getLegalMoves(state, { r, f });
    setLegalMoves(legal);
    setLegalSet(new Set(legal.map((m) => `${m.to.r}-${m.to.f}`)));
    setSelected({ r, f });
  }

  function clearSelection() {
    setSelected(null);
    setLegalMoves([]);
    setLegalSet(new Set());
  }

  function onSelectSquare(r, f) {
    const piece = state.board[r][f];

    if (!selected) {
      if (piece && piece.c === state.turn) selectPiece(r, f);
      return;
    }

    if (selected.r === r && selected.f === f) {
      clearSelection();
      return;
    }

    const key = `${r}-${f}`;
    if (!legalSet.has(key)) {
      clearSelection(); // reset instead of silent ignore
      return;
    }

    const candidates = legalMoves.filter((m) => m.to.r === r && m.to.f === f);
    const promos = candidates.filter((m) => m.promotion);

    if (promos.length) {
      setPromoChoice({
        from: selected,
        to: { r, f },
        options: promos.map((p) => p.promotion),
      });
      return;
    }

    performMove(candidates[0]);
  }

  function performMove(move) {
    const piece = state.board[move.from.r][move.from.f];

    const next = applyMove(state, move);
    setState(next);
    setHalfCounter(next.halfmoveClock);
    console.log(next.halfmoveClock);
    clearSelection();
    setPromoChoice(null);

    const status = getGameStatus(next);
    if (status.status === "checkmate") {
      setRunning(false);
      setScore((s) =>
        status.winner === "w" ? { w: s.w + 1, b: s.b } : { w: s.w, b: s.b + 1 }
      );
      setMessage(
        `Checkmate — ${status.winner === "w" ? "White" : "Black"} wins`
      );
    } else if(status.status === "draw_50_moves") {
      setMessage("Draw - Halfmove")
    } else if (status.status === "stalemate") {
      setRunning(false);
      setScore((s) => ({ w: s.w + 0.5, b: s.b + 0.5 }));
      setMessage("Stalemate — draw");
    } else if (next.threefoldAvailable) {
      setMessage("Threefold repetition available");
    } else {
      setMessage(next.moveHistory.at(-1));
    }
  }

  function choosePromotion(promo) {
    const move = legalMoves.find(
      (m) =>
        m.promotion === promo &&
        m.to.r === promoChoice.to.r &&
        m.to.f === promoChoice.to.f
    );
    performMove(move);
  }

  function claimDraw() {
    alert("Draw claimed by threefold repetition");
    localStorage.removeItem("chess-state");
    setState(createInitialState());
  }

  function exportPGN() {
    const pgn = state.moveHistory
      .map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m}` : m))
      .join(" ");
    navigator.clipboard.writeText(pgn);
  }

  function resetGame() {
    localStorage.clear();
    setState(createInitialState());
    setSelected(null);
    setLegalSet(new Set());
    setLegalMoves([]);
    setPromoChoice(null);
    setMessage("");
    setShowInspector(false);
    setTime({ w: INITIAL_TIME, b: INITIAL_TIME });
    setRunning(true);
  }

  const lastFrom = state.lastMove
    ? `${state.lastMove.from.r}-${state.lastMove.from.f}`
    : null;
  const lastTo = state.lastMove
    ? `${state.lastMove.to.r}-${state.lastMove.to.f}`
    : null;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Chess Prototype</h2>

      <div className="flex gap-6">
        {/* Board */}
        <div>
          <div className="grid grid-cols-8">
            {state.board.map((row, r) =>
              row.map((cell, f) => {
                const key = `${r}-${f}`;
                const isLight = (r + f) % 2 === 0;
                const isLegal = legalSet.has(key);
                const isLast = key === lastFrom || key === lastTo;

                const pieceColorClass = cell
                  ? cell.c === "w"
                    ? "text-white"
                    : "text-black"
                  : "";

                const textShadow =
                  cell && cell.c === "w"
                    ? "0 0 1px rgba(255, 255, 255, 1)"
                    : "0 0 1px rgba(255, 255, 255, 0)";

                return (
                  <div
                    key={key}
                    onClick={() => onSelectSquare(r, f)}
                    className={`w-16 h-16 flex items-center justify-center cursor-pointer
                      ${isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]"}
                      ${isLast ? "bg-green-600 opacity-80" : ""}`}
                    style={{ position: "relative" }}
                  >
                    <span
                      className={`text-4xl ${pieceColorClass}`}
                      style={{ textShadow }}
                    >
                      {pieceToUnicode(cell)}
                    </span>
                    {isLegal && (
                      <div className="absolute w-16 h-16 bg-blue-500 opacity-40" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Promotion */}
          {promoChoice && (
            <div className="mt-3 flex gap-2">
              {promoChoice.options.map((p) => (
                <button
                  key={p}
                  onClick={() => choosePromotion(p)}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 text-sm">
          {/* Material */}
          <div className="mt-3">
            <strong>Material</strong>
            <div>White: {material.w}</div>
            <div>Black: {material.b}</div>
          </div>
          {/* Clock */}
          <div className="mt-3">
            <strong>Clock</strong>
            <div className="mt-1">
              <div className={state.turn === "w" ? "font-bold" : ""}>
                White: {Math.floor(time.w / 60)}:
                {String(time.w % 60).padStart(2, "0")}
              </div>
              <div className={state.turn === "b" ? "font-bold" : ""}>
                Black: {Math.floor(time.b / 60)}:
                {String(time.b % 60).padStart(2, "0")}
              </div>
            </div>
          </div>
          <div>
            <strong>Turn:</strong> {state.turn === "w" ? "White" : "Black"}
          </div>
          <div className="mt-2 text-gray-700">Halfmove Counter: {halfCounter}</div>
          <div className="mt-2 text-gray-700">{message}</div>
          <div className="mt-4">
            <strong>Moves</strong>
            <ol className="mt-1 space-y-1">
              {state.moveHistory.map((m, i) => (
                <li key={i}>
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}
                  {m}
                </li>
              ))}
            </ol>
          </div>
          {state.threefoldAvailable && (
            <button
              onClick={claimDraw}
              className="mt-3 px-3 py-1 bg-gray-200 rounded"
            >
              Claim draw
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={exportPGN}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              Copy PGN
            </button>
            <button
              onClick={() => setShowInspector((s) => !s)}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              {showInspector ? "Hide state" : "Show state"}
            </button>

            <button
              onClick={resetGame}
              className="px-3 py-1 bg-gray-200 rounded"
            >
              Reset
            </button>
          </div>
        </div>

        {showInspector && <StateViewer state={state} />}
      </div>
    </div>
  );
}
