import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { SocketService } from "../src/services/socket.service.ts";

class FakeSocket extends EventEmitter {
  connected = false;
  requests = [];

  constructor(url, options) {
    super();
    this.url = url;
    this.auth = options.auth;
  }

  connect() {
    this.connected = true;
    super.emit("connect");
  }

  disconnect() {
    this.connected = false;
    super.emit("disconnect");
  }

  timeout(milliseconds) {
    assert.equal(milliseconds, 8000);
    return this;
  }

  emit(event, ...args) {
    const acknowledge = args.pop();
    this.requests.push({ event, args, acknowledge });
  }

  receive(event, payload) {
    super.emit(event, payload);
  }

  takeRequest(expectedEvent) {
    const request = this.requests.shift();
    assert.equal(request?.event, expectedEvent);
    return request;
  }
}

const player = { id: "user-1", username: "Player one" };

function makeGame(gameId) {
  return {
    gameId,
    hostId: player.id,
    players: [player],
    started: false,
    timeLimit: 30,
    numberOfQuestions: 5,
  };
}

function makeMessage(id, gameId = null) {
  return { id, gameId, userId: player.id, username: player.username, text: id };
}

function makeUpdate(gameId) {
  return {
    gameId,
    phase: "countdown",
    serverNow: 1000,
    endsAt: 4000,
    questionIndex: 0,
    totalQuestions: 5,
    submitted: false,
    yourAnswer: null,
    scores: [],
  };
}

async function createConnectedService(url) {
  const sockets = [];
  const service = new SocketService(url, (socketUrl, options) => {
    const socket = new FakeSocket(socketUrl, options);
    sockets.push(socket);
    return socket;
  });
  service.connect("initial-token", player.id);
  const socket = sockets[0];
  socket.takeRequest("join-lobby").acknowledge(null, { ok: true, data: [] });
  await setImmediate();
  assert.equal(service.getSnapshot().ready, true);
  return { service, socket, sockets };
}

test("uses the configured server, or the same origin when omitted", async () => {
  const configured = await createConnectedService("https://game.example.com");
  assert.equal(configured.socket.url, "https://game.example.com");

  const defaultConnection = await createConnectedService();
  assert.equal(defaultConnection.socket.url, undefined);
});

test("refreshing a token reuses the connection and updates authentication", async () => {
  const { service, socket, sockets } = await createConnectedService();
  service.connect("refreshed-token", player.id);

  assert.equal(sockets.length, 1);
  assert.deepEqual(socket.auth, { token: "refreshed-token" });
  assert.equal(socket.requests.length, 0);
});

test("snapshots stay stable until an event and subscribers see a complete reset", async () => {
  const { service, socket } = await createConnectedService();
  const initial = service.getSnapshot();
  assert.equal(service.getSnapshot(), initial);

  const snapshots = [];
  const unsubscribe = service.subscribe(() =>
    snapshots.push(service.getSnapshot()),
  );
  socket.receive("socket-identity", {
    userId: player.id,
    username: player.username,
  });
  socket.receive("online-users", [player]);
  socket.receive("games-snapshot", [makeGame("first")]);
  socket.receive("chat-message", makeMessage("lobby"));
  socket.receive("chat-message", makeMessage("game", "first"));
  socket.receive("game-update", makeUpdate("first"));

  service.disconnect();
  const reset = snapshots.at(-1);
  assert.equal(reset.ready, false);
  assert.equal(reset.userId, "");
  assert.equal(reset.username, "");
  assert.equal(reset.gameUpdate, null);
  for (const key of ["games", "lobbyMessages", "gameMessages", "onlineUsers"]) {
    assert.deepEqual(reset[key], []);
  }
  assert.equal(initial.username, "");
  assert.equal(socket.connected, false);
  assert.equal(socket.eventNames().length, 0);

  unsubscribe();
  const count = snapshots.length;
  service.reportError(new Error("After unsubscribe"));
  assert.equal(snapshots.length, count);
});

test("changing game rooms clears only the previous game's data in one update", async () => {
  const { service, socket } = await createConnectedService();
  socket.receive("games-snapshot", [makeGame("first")]);
  socket.receive("chat-message", makeMessage("lobby"));
  socket.receive("chat-message", makeMessage("first message", "first"));
  socket.receive("game-update", makeUpdate("first"));
  assert.equal(typeof service.getSnapshot().gameUpdate.receivedAt, "number");

  const snapshots = [];
  service.subscribe(() => snapshots.push(service.getSnapshot()));
  socket.receive("games-snapshot", [makeGame("second")]);

  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0].gameMessages, []);
  assert.equal(snapshots[0].gameUpdate, null);
  assert.equal(snapshots[0].lobbyMessages.length, 1);

  socket.receive("chat-message", makeMessage("late message", "first"));
  socket.receive("game-update", makeUpdate("first"));
  assert.equal(snapshots.length, 1);
});

test("each chat history keeps only its latest 200 messages", async () => {
  const { service, socket } = await createConnectedService();
  socket.receive("games-snapshot", [makeGame("first")]);
  for (let index = 0; index < 205; index++) {
    socket.receive("chat-message", makeMessage(String(index)));
    socket.receive("chat-message", makeMessage(String(index), "first"));
  }
  for (const messages of [
    service.getSnapshot().lobbyMessages,
    service.getSnapshot().gameMessages,
  ]) {
    assert.equal(messages.length, 200);
    assert.equal(messages[0].id, "5");
    assert.equal(messages.at(-1).id, "204");
  }
});

test("a late lobby response cannot replace the state from a reconnect", async () => {
  const { service, socket } = await createConnectedService();
  socket.receive("online-users", [player]);
  socket.disconnect();
  assert.equal(service.getSnapshot().ready, false);
  assert.deepEqual(service.getSnapshot().onlineUsers, []);

  socket.connect();
  const staleLobby = socket.takeRequest("join-lobby");
  socket.disconnect();
  socket.connect();
  socket.takeRequest("join-lobby").acknowledge(null, {
    ok: true,
    data: [makeGame("current")],
  });
  await setImmediate();

  staleLobby.acknowledge(null, { ok: true, data: [makeGame("stale")] });
  await setImmediate();
  assert.equal(service.getSnapshot().games[0].gameId, "current");
  assert.equal(service.getSnapshot().ready, true);
  assert.equal(service.getSnapshot().error, "");
});

test("late action responses after reconnect are rejected without clearing new errors", async () => {
  const { service, socket } = await createConnectedService();
  const action = service.joinGame("first");
  const staleReply = socket.takeRequest("join-game");
  const rejection = assert.rejects(action, /Connection changed/);
  socket.disconnect();
  socket.connect();
  socket.takeRequest("join-lobby").acknowledge(null, { ok: true, data: [] });
  await setImmediate();
  service.reportError(new Error("Current connection error"));

  staleReply.acknowledge(null, { ok: true, data: makeGame("first") });
  await rejection;
  assert.equal(service.getSnapshot().error, "Current connection error");
});

test("changing accounts clears private state and rejects old requests", async () => {
  const { service, socket, sockets } = await createConnectedService();
  socket.receive("online-users", [player]);
  socket.receive("chat-message", makeMessage("old account"));
  const action = service.createGame({ timeLimit: 30, numberOfQuestions: 5 });
  const staleReply = socket.takeRequest("create-game");
  const rejection = assert.rejects(action, /Connection changed/);

  service.connect("other-token", "user-2");
  assert.equal(socket.connected, false);
  assert.equal(sockets.length, 2);
  assert.equal(service.getSnapshot().userId, "user-2");
  assert.deepEqual(service.getSnapshot().lobbyMessages, []);
  assert.deepEqual(service.getSnapshot().onlineUsers, []);
  staleReply.acknowledge(null, { ok: true, data: makeGame("stale") });
  await rejection;
  sockets[1]
    .takeRequest("join-lobby")
    .acknowledge(null, { ok: true, data: [] });
  await setImmediate();
  assert.equal(service.getSnapshot().error, "");
});

test("requests preserve the backend protocol for games, answers, and chat", async () => {
  const { service, socket } = await createConnectedService();
  const options = { timeLimit: 30, numberOfQuestions: 5 };
  const cases = [
    [() => service.createGame(options), "create-game", [options]],
    [() => service.joinGame("first"), "join-game", ["first"]],
    [() => service.startGame("first"), "start-game", ["first"]],
    [
      () => service.submitAnswer("first", 2, 4),
      "submit-answer",
      ["first", 2, 4],
    ],
    [() => service.leaveGame("first"), "leave-game", ["first"]],
    [() => service.sendMessage("Hello"), "lobby-message", ["Hello"]],
    [
      () => service.sendMessage("Hello", "first"),
      "game-message",
      ["first", "Hello"],
    ],
  ];
  for (const [perform, event, args] of cases) {
    const result = perform();
    const request = socket.takeRequest(event);
    assert.deepEqual(request.args, args);
    request.acknowledge(null, { ok: true, data: true });
    assert.equal(await result, true);
  }
});

test("disconnected, timed-out, rejected, and malformed requests fail clearly", async () => {
  const { service, socket } = await createConnectedService();
  const cases = [
    [new Error("timeout"), undefined, /Request timed out/],
    [null, { ok: false, error: "Game is full" }, /Game is full/],
    [null, undefined, /Invalid server response/],
  ];
  for (const [error, reply, expected] of cases) {
    const result = service.joinGame("first");
    const rejection = assert.rejects(result, expected);
    socket.takeRequest("join-game").acknowledge(error, reply);
    await rejection;
  }
  service.disconnect();
  await assert.rejects(service.joinGame("first"), /Not connected/);
  await assert.rejects(service.retryConnection(), /Sign in before connecting/);
});

test("retry rejoins the lobby after a failed join on an active connection", async () => {
  const { service, socket } = await createConnectedService();
  service.reportError(new Error("Lobby unavailable"));
  const retry = service.retryConnection();
  socket
    .takeRequest("join-lobby")
    .acknowledge(null, { ok: true, data: [makeGame("first")] });
  await retry;
  assert.equal(service.getSnapshot().error, "");
  assert.equal(service.getSnapshot().ready, true);
  assert.equal(service.getSnapshot().games[0].gameId, "first");
});
