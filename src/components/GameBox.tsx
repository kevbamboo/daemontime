import { useEffect, useLayoutEffect, useRef, useState } from "react";
import EmptyLobby from "./EmptyLobby";
import ChatPanel from "./ChatPanel";
import { useSocketState } from "../hooks/useSocketState";
import GameCard from "./GameCard";
import NewGameModal from "./NewGameModal";
import GamePlay from "./GamePlay";
import { socketService } from "../services/socket.service";
import "./GameBox.css";

function ConnectionStatus({
  busy,
  error,
  onRetry,
}: {
  busy: boolean;
  error: string;
  onRetry: () => void;
}) {
  const [canRetry, setCanRetry] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setCanRetry(true), 5000);
    return () => window.clearTimeout(timeout);
  }, []);
  return (
    <div className="connection-overlay">
      {!error && (
        <p role="status" aria-label="Connecting">
          Connecting
          <span className="connecting-dots" aria-hidden="true" />
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {canRetry && (
        <button disabled={busy} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export default function GameBox() {
  const newGameButtonRef = useRef<HTMLButtonElement>(null);
  const { games, gameUpdate, ready, error, userId, onlineUsers } =
    useSocketState();
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const game = games.find((candidate) =>
    candidate.players.some((player) => player.id === userId),
  );
  const useNativeCursor = creating || !!game;
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-native-cursor", useNativeCursor);
    return () => root.removeAttribute("data-native-cursor");
  }, [useNativeCursor]);
  const gameEnded =
    gameUpdate?.phase === "finished" || gameUpdate?.phase === "interrupted";
  async function action(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      socketService.reportError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div id="game">
      <h1 className="game-title">Daemon Time</h1>
      {ready && error && <p role="alert">{error}</p>}
      {!ready ? (
        <ConnectionStatus
          busy={busy}
          error={error}
          onRetry={() => void action(() => socketService.retryConnection())}
        />
      ) : (
        <>
          <div id="game-box">
            {!game ? (
              <>
                <div className="game-box-header">
                  <h2>Lobby</h2>
                  <button
                    ref={newGameButtonRef}
                    className="new-game-button"
                    disabled={busy}
                    onClick={() => setCreating(true)}
                  >
                    Create Game
                  </button>
                </div>
                {games.length === 0 && (
                  <EmptyLobby buttonRef={newGameButtonRef} />
                )}
                <div id="game-list">
                  {games.map((listedGame) => (
                    <GameCard
                      key={listedGame.gameId}
                      game={listedGame}
                      disabled={busy}
                      onJoin={() =>
                        void action(() =>
                          socketService.joinGame(listedGame.gameId),
                        )
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="game-header">
                  <h2>
                    {game.players.find((player) => player.id === game.hostId)
                      ?.username ?? "Host"}
                    's Game
                  </h2>
                  {(!game.started || game.solo || gameEnded) && (
                    <button
                      className={`leave-button${gameEnded ? " leave-highlight" : ""}`}
                      disabled={busy}
                      onClick={() =>
                        void action(() => socketService.leaveGame(game.gameId))
                      }
                    >
                      {gameEnded && <span aria-hidden="true">←</span>}
                      {gameEnded ? "Lobby" : "Leave"}
                    </button>
                  )}
                </div>
                {game.started ? (
                  <GamePlay
                    key={game.gameId}
                    userId={userId}
                    update={
                      gameUpdate?.gameId === game.gameId ? gameUpdate : null
                    }
                  />
                ) : (
                  <div className="players-section">
                    <h3>Players</h3>
                    <ol>
                      {game.players.map((player) => (
                        <li key={player.id}>
                          {player.username}
                          {player.id === game.hostId ? " (Host)" : ""}
                        </li>
                      ))}
                    </ol>
                    {game.players.length === 1 && (
                      <p>Waiting for players to join...</p>
                    )}
                    {game.hostId === userId && (
                      <button
                        className="start-game-button"
                        disabled={busy}
                        onClick={() =>
                          void action(() =>
                            socketService.startGame(game.gameId),
                          )
                        }
                      >
                        Start Game
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <ChatPanel
            key={game?.gameId ?? "lobby"}
            gameId={game?.gameId}
            userId={userId}
            onlineUsers={onlineUsers}
          />
        </>
      )}
      {creating && <NewGameModal onClose={() => setCreating(false)} />}
    </div>
  );
}
