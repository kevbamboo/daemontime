import { io, type Socket } from "socket.io-client";
export type Player = { id: string; username: string };
export type GameOptions = { timeLimit: number; numberOfQuestions: number };
export type Game = GameOptions & {
  gameId: string;
  hostId: string;
  players: Player[];
  started: boolean;
  solo?: boolean;
  startedAt?: number;
};
export type ChatMessage = {
  id: string;
  userId: string;
  username: string;
  text: string;
  gameId: string | null;
};
export type GameQuestion = { index: number; text: string; choices: string[] };
export type ReviewQuestion = GameQuestion & {
  correctAnswer: number;
  yourAnswer: number | null;
  points: number;
  shortExplanation: string;
  longExplanation: string;
};
export type GameUpdate = {
  gameId: string;
  phase: "countdown" | "question" | "scoreboard" | "finished" | "interrupted";
  serverNow: number;
  receivedAt?: number;
  endsAt: number | null;
  questionIndex: number;
  totalQuestions: number;
  submitted: boolean;
  yourAnswer: number | null;
  scores: (Player & {
    score: number;
    submitted: boolean;
    active: boolean;
    answerPoints?: number;
  })[];
  question?: GameQuestion;
  review?: ReviewQuestion[];
  message?: string;
};
type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 8000;
const MESSAGE_HISTORY_LIMIT = 200;

type SocketState = {
  ready: boolean;
  error: string;
  userId: string;
  username: string;
  games: Game[];
  gameUpdate: GameUpdate | null;
  lobbyMessages: ChatMessage[];
  gameMessages: ChatMessage[];
  onlineUsers: Player[];
};

function createInitialState(): SocketState {
  return {
    ready: false,
    error: "",
    userId: "",
    username: "",
    games: [],
    gameUpdate: null,
    lobbyMessages: [],
    gameMessages: [],
    onlineUsers: [],
  };
}

export class SocketService {
  private socket: Socket | null = null;
  private state = createInitialState();
  private listeners = new Set<() => void>();
  private connectionVersion = 0;
  private url: string | undefined;
  private createSocket: typeof io;

  constructor(url?: string, createSocket: typeof io = io) {
    this.url = url || undefined;
    this.createSocket = createSocket;
  }

  // Stable functions and immutable snapshots let React subscribe without
  // copying service state into components or forcing renders with counters.
  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private updateState(changes: Partial<SocketState>) {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) listener();
  }

  private get currentGameId() {
    const { games, userId } = this.state;
    return games.find((game) =>
      game.players.some((player) => player.id === userId),
    )?.gameId;
  }

  private acceptGames(games: Game[]) {
    const previousGameId = this.currentGameId;
    const currentGame = games.find((game) =>
      game.players.some((player) => player.id === this.state.userId),
    );
    const roomChanged = previousGameId !== currentGame?.gameId;

    this.updateState({
      games,
      ...(roomChanged ? { gameMessages: [], gameUpdate: null } : {}),
    });
  }

  connect(token: string, userId: string) {
    if (this.socket && this.state.userId !== userId) this.disconnect();
    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.updateState({ userId });
    // With no URL, Socket.IO uses the page origin and Vite's local proxy.
    const socket = this.createSocket(this.url, {
      auth: { token },
      autoConnect: false,
    });
    this.socket = socket;

    socket.on(
      "socket-identity",
      (identity: { userId: string; username: string }) => {
        this.updateState({
          userId: identity.userId,
          username: identity.username,
        });
      },
    );
    socket.on("connect", () => {
      const version = ++this.connectionVersion;
      this.updateState({ ready: false, error: "" });
      void this.joinLobby().catch((error: unknown) => {
        if (this.socket === socket && this.connectionVersion === version) {
          this.reportError(error);
        }
      });
    });
    socket.on("disconnect", () => {
      this.connectionVersion++;
      this.updateState({
        ready: false,
        error: "Connection lost. Reconnecting?",
        onlineUsers: [],
      });
    });
    socket.on("connect_error", (error: Error) => {
      this.updateState({ ready: false, error: error.message });
    });
    socket.on("games-snapshot", (games: Game[]) => this.acceptGames(games));
    socket.on("game-update", (update: GameUpdate) => {
      if (update.gameId === this.currentGameId) {
        this.updateState({ gameUpdate: { ...update, receivedAt: Date.now() } });
      }
    });
    socket.on("online-users", (onlineUsers: Player[]) => {
      this.updateState({ onlineUsers });
    });
    socket.on("chat-message", (message: ChatMessage) => {
      const { lobbyMessages, gameMessages } = this.state;
      if (message.gameId === null) {
        this.updateState({
          lobbyMessages: [
            ...lobbyMessages.slice(1 - MESSAGE_HISTORY_LIMIT),
            message,
          ],
        });
      } else if (message.gameId === this.currentGameId) {
        this.updateState({
          gameMessages: [
            ...gameMessages.slice(1 - MESSAGE_HISTORY_LIMIT),
            message,
          ],
        });
      }
    });
    socket.connect();
  }

  reportError(error: unknown) {
    this.updateState({
      error: error instanceof Error ? error.message : "Request failed",
    });
  }

  async retryConnection() {
    if (!this.socket) throw new Error("Sign in before connecting");
    this.updateState({ error: "" });
    if (!this.socket.connected) {
      this.socket.connect();
      return;
    }
    await this.joinLobby();
  }

  disconnect() {
    this.connectionVersion++;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.updateState(createInitialState());
  }

  private request<T>(event: string, ...args: unknown[]): Promise<T> {
    const socket = this.socket;
    const version = this.connectionVersion;
    if (!socket?.connected) {
      return Promise.reject(
        new Error("Not connected. Please retry when connected."),
      );
    }

    return new Promise((resolve, reject) => {
      socket
        .timeout(REQUEST_TIMEOUT_MS)
        .emit(event, ...args, (error: Error | null, reply?: Reply<T>) => {
          // The socket object survives reconnects; its identity alone cannot
          // distinguish a late acknowledgement from an earlier connection.
          if (socket !== this.socket || version !== this.connectionVersion) {
            reject(new Error("Connection changed. Please retry."));
          } else if (error) {
            reject(new Error("Request timed out. Please retry."));
          } else if (!reply?.ok) {
            reject(new Error(reply?.error || "Invalid server response"));
          } else {
            this.updateState({ error: "" });
            resolve(reply.data);
          }
        });
    });
  }

  private async joinLobby() {
    const socket = this.socket;
    const version = this.connectionVersion;
    const games = await this.request<Game[]>("join-lobby");
    if (
      socket !== this.socket ||
      version !== this.connectionVersion ||
      !socket?.connected
    ) {
      return;
    }
    this.acceptGames(games);
    this.updateState({ ready: true, error: "" });
  }

  createGame(options: GameOptions) {
    return this.request<Game>("create-game", options);
  }

  joinGame(gameId: string) {
    return this.request<Game>("join-game", gameId);
  }

  startGame(gameId: string) {
    return this.request<boolean>("start-game", gameId);
  }

  submitAnswer(gameId: string, questionIndex: number, choice: number) {
    return this.request<boolean>(
      "submit-answer",
      gameId,
      questionIndex,
      choice,
    );
  }

  leaveGame(gameId: string) {
    return this.request<boolean>("leave-game", gameId);
  }

  sendMessage(text: string, gameId?: string) {
    return gameId
      ? this.request<boolean>("game-message", gameId, text)
      : this.request<boolean>("lobby-message", text);
  }
}

export const socketService = new SocketService(
  import.meta.env?.VITE_SOCKET_URL,
);
