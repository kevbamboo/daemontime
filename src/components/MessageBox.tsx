import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import { socketService } from "../services/socket.service";
import { useSocketState } from "../hooks/useSocketState";
import "./MessageBox.css";

const MESSAGE_COOLDOWN_MS = 3000;

export default function MessageBox({ gameId }: { gameId?: string }) {
  const { lobbyMessages, gameMessages } = useSocketState();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [warning, setWarning] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const messages = gameId ? gameMessages : lobbyMessages;
  useLayoutEffect(() => {
    const element = history.current;
    if (element && following.current) {
      element.scrollTop = element.scrollHeight;
      following.current = true;
    }
  }, [messages]);
  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, cooldownUntil - Date.now());
      setCooldownSeconds(Math.ceil(remaining / 1000));
      if (!remaining) {
        window.clearInterval(interval);
        setCooldownUntil(0);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  function startWarning() {
    setWarning(false);
    window.requestAnimationFrame(() => setWarning(true));
  }

  function startCooldown() {
    const until = Date.now() + MESSAGE_COOLDOWN_MS;
    setCooldownUntil(until);
    setCooldownSeconds(MESSAGE_COOLDOWN_MS / 1000);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setError("");
    if (cooldownUntil > Date.now()) {
      startWarning();
      return;
    }
    const form = event.currentTarget;
    const input = form.elements.namedItem("chat") as HTMLInputElement;
    const originalText = input.value;
    const text = originalText.trim();
    if (!text) {
      setError("Enter a message before sending.");
      return;
    }
    setSending(true);
    try {
      await socketService.sendMessage(text, gameId);
      if (input.value === originalText) input.value = "";
      startCooldown();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Message cooldown active"
      ) {
        startCooldown();
        startWarning();
      } else {
        setError(
          error instanceof Error ? error.message : "Unable to send message",
        );
      }
    } finally {
      setSending(false);
    }
  }
  return (
    <div id="message-box">
      <div
        id="messages"
        ref={history}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        onScroll={(event) => {
          const element = event.currentTarget;
          following.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            40;
        }}
      >
        {messages.map((message) => (
          <p key={message.id}>
            <strong>{message.username}</strong>
            <span>{message.text}</span>
          </p>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <form
        id="message-form"
        autoComplete="off"
        className={warning ? "message-form-warning" : ""}
        onSubmit={handleSubmit}
        onAnimationEnd={() => setWarning(false)}
      >
        <input
          id="message-input"
          name="chat"
          autoComplete="off"
          aria-label={gameId ? "Game message" : "Lobby message"}
          type="text"
          placeholder="Say something..."
          maxLength={2000}
          required
        />
        <button id="message-button" type="submit" disabled={sending}>
          Send{" "}
          {cooldownSeconds > 0 && (
            <small aria-label={`${cooldownSeconds} seconds remaining`}>
              {cooldownSeconds}
            </small>
          )}
        </button>
      </form>
    </div>
  );
}
