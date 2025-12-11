// src/App.jsx
import React, { useState } from "react";
import { createInitialState, applyMove, getLegalMoves } from "./engine/engine";

// Unicode mapping (correctly for white and black)
const pieceToUnicode = (p) => {
  if (!p) return "";
  const map = {
    w: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♙" },
  };
  return map[p.c]?.[p.t] || "";
};

const toAlgebraic = ({ r, f }) => "abcdefgh"[f] + (8 - r);

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
            title={`${"abcdefgh"[f]}${8 - r}`}
          >
            {cell === ".." ? <span className="text-gray-300">·</span> : <span>{cell}</span>}
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

      <div className="mb-2 text-[11px] text-gray-600 whitespace-pre-wrap overflow-auto max-h-40">
        <pre className="text-[11px]">{pretty}</pre>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => navigator.clipboard?.writeText(pretty)}
          className="px-2 py-1 bg-gray-200 rounded text-xs"
        >
          Copy JSON
        </button>
        <button
          onClick={() => {
            const rows = state.board.map((row) =>
              row.map((c) => (c ? `${c.c}${c.t}` : "..")).join("")
            );
            const fenLike = `${rows.join("/")} ${state.turn} ${state.whiteCanCastleK ? "K" : ""}${state.whiteCanCastleQ ? "Q" : ""}${state.blackCanCastleK ? "k" : ""}${state.blackCanCastleQ ? "q" : ""} ${state.enPassantTarget ? toAlgebraic(state.enPassantTarget) : "-"} ${state.halfmoveClock} ${state.fullmoveNumber}`;
            navigator.clipboard?.writeText(fenLike);
          }}
          className="px-2 py-1 bg-gray-200 rounded text-xs"
        >
          Copy FEN-like
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(() => createInitialState());
  const [selected, setSelected] = useState(null); // {r,f}
  const [legalSet, setLegalSet] = useState(new Set()); // Set of 'r-f' strings
  const [legalMoves, setLegalMoves] = useState([]); // array of move objects for selected
  const [message, setMessage] = useState("");
  const [showInspector, setShowInspector] = useState(false);
  const [promoChoice, setPromoChoice] = useState(null); // { from, to, options: [ 'q','r','b','n' ] }

  function onSelectSquare(r, f) {
    const piece = state.board[r][f];

    // If no selection, attempt to select a friendly piece and compute legal moves
    if (!selected) {
      if (piece && piece.c === state.turn) {
        const legal = getLegalMoves(state, { r, f }); // engine-provided legal moves
        const set = new Set(legal.map(m => `${m.to.r}-${m.to.f}`));
        setLegalSet(set);
        setLegalMoves(legal);
        setSelected({ r, f });
        setMessage(`Selected ${piece.t} at ${toAlgebraic({ r, f })}`);
      }
      return;
    }

    // deselect if same square clicked
    if (selected.r === r && selected.f === f) {
      clearSelection();
      return;
    }

    // if clicked a legal destination
    const key = `${r}-${f}`;
    if (!legalSet.has(key)) {
      setMessage("Illegal destination — select a legal square or reselect piece.");
      return;
    }

    // find the matching move object(s) for this destination
    const candidates = legalMoves.filter(m => m.to.r === r && m.to.f === f);
    if (candidates.length === 0) {
      setMessage("No move found.");
      clearSelection();
      return;
    }

    // if promotion moves exist among candidates, prompt user
    const promos = candidates.filter(m => m.promotion).map(m => m.promotion);
    if (promos.length > 0) {
      setPromoChoice({ from: selected, to: { r, f }, options: promos });
      return;
    }

    // otherwise perform the (single) legal move (should be unique)
    performMove(candidates[0]);
  }

  function performMove(move) {
    try {
      const next = applyMove(state, move);
      setState(next);
      setMessage(`${toAlgebraic(move.from)} → ${toAlgebraic(move.to)}`);
    } catch (err) {
      console.error("applyMove error:", err);
      setMessage("Engine rejected move.");
    } finally {
      clearSelection();
    }
  }

  function choosePromotion(pieceLetter) {
    if (!promoChoice) return;
    const leg = getLegalMoves(state, promoChoice.from);
    const move = leg.find(m => m.promotion === pieceLetter && m.to.r === promoChoice.to.r && m.to.f === promoChoice.to.f);
    if (!move) {
      setMessage("Promotion move not found.");
      setPromoChoice(null);
      clearSelection();
      return;
    }
    performMove(move);
    setPromoChoice(null);
  }

  function clearSelection() {
    setSelected(null);
    setLegalSet(new Set());
    setLegalMoves([]);
  }

  function reset() {
    setState(createInitialState());
    clearSelection();
    setMessage("");
    setPromoChoice(null);
  }

  return (
    <div className="p-6 font-sans text-gray-900">
      <h2 className="text-2xl font-semibold mb-4">Chess Prototype (legal moves)</h2>

      <div className="flex gap-6 items-start">
        <div className="flex">
          <div>
            <div className="flex">
              <div className="flex flex-col justify-between mr-1">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-16 w-6 flex items-center justify-center text-sm text-gray-700">
                    {8 - i}
                  </div>
                ))}
              </div>

              <div className="inline-grid grid-cols-8 border-2 border-gray-800 divide-x-[1px] divide-y-[1px] divide-black/10">
                {state.board.map((row, r) =>
                  row.map((cell, f) => {
                    const isLight = (r + f) % 2 === 0;
                    const bgClass = isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]";
                    const isSelected = selected && selected.r === r && selected.f === f;
                    const isLegal = legalSet.has(`${r}-${f}`);

                    const pieceColorClass = cell
                      ? cell.c === "w"
                        ? "text-white"
                        : "text-black"
                      : "";

                    const textShadow =
                      cell && cell.c === "w"
                        ? "0 0 1px rgba(0,0,0,0.7)"
                        : "0 0 1px rgba(255,255,255,0.7)";

                    return (
                      <div
                        key={`${r}-${f}`}
                        onClick={() => onSelectSquare(r, f)}
                        className={`w-16 h-16 flex items-center justify-center cursor-pointer box-border ${bgClass} ${
                          isSelected ? "ring-4 ring-blue-500 ring-inset" : ""
                        }`}
                        style={{ position: "relative" }}
                      >
                        <span
                          className={`text-2xl select-none ${pieceColorClass}`}
                          style={{ textShadow }}
                        >
                          {pieceToUnicode(cell)}
                        </span>

                        {/* legal destination dot */}
                        {isLegal && (
                          <div
                            style={{
                              position: "absolute",
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              background: "rgba(59,130,246,0.95)",
                              bottom: 6,
                              right: 6,
                              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                            }}
                            aria-hidden
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-8 mt-1 ml-7">
              {"abcdefgh".split("").map((f) => (
                <div key={f} className="w-16 text-center text-sm text-gray-700">
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-72 text-sm text-gray-800">
          <div className="mb-2">
            <strong>Turn:</strong> {state.turn === "w" ? "White" : "Black"}
          </div>
          <div className="mb-2">
            <strong>En passant:</strong> {state.enPassantTarget ? toAlgebraic(state.enPassantTarget) : "—"}
          </div>

          <div className="mb-2">
            <strong>Castling:</strong>
            <div className="mt-1">
              <span className="block">W: {state.whiteCanCastleK ? "K" : "-"} {state.whiteCanCastleQ ? "Q" : "-"}</span>
              <span className="block">B: {state.blackCanCastleK ? "K" : "-"} {state.blackCanCastleQ ? "Q" : "-"}</span>
            </div>
          </div>

          <div className="mb-2"><strong>Halfmove:</strong> {state.halfmoveClock}</div>
          <div className="mb-2"><strong>Fullmove:</strong> {state.fullmoveNumber}</div>

          <div className="mt-4">
            <strong>Last:</strong>
            <div className="mt-2 text-gray-700">{message}</div>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Click a friendly piece to see legal moves (blue dots). Click a dot to move. Promotions prompt choices.
          </div>

          <div className="mt-3 flex gap-2 items-center">
            <button onClick={reset} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm">
              Reset
            </button>

            <button
              onClick={() => setShowInspector((s) => !s)}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
            >
              {showInspector ? "Hide state" : "Show state"}
            </button>

            <button
              onClick={() => navigator.clipboard?.writeText(JSON.stringify(state))}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm"
            >
              Copy raw JSON
            </button>
          </div>

          {promoChoice && (
            <div className="mt-3 p-3 border rounded bg-white">
              <div className="mb-2 text-sm font-medium">Choose promotion</div>
              <div className="flex gap-2">
                {promoChoice.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => choosePromotion(opt)}
                    className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                  >
                    {opt.toUpperCase()}
                  </button>
                ))}
                <button onClick={() => { setPromoChoice(null); clearSelection(); }} className="px-3 py-1 rounded bg-gray-200 text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {showInspector && (
          <div>
            <StateViewer state={state} />
          </div>
        )}
      </div>
    </div>
  );
}
