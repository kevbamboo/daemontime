import { useState, type CSSProperties, type KeyboardEvent } from "react";
import type { Player } from "../services/socket.service";
import MessageBox from "./MessageBox";

type ChatTab = "users" | "lobby" | "game";
type ChatPanelProps = {
  gameId?: string;
  userId: string;
  onlineUsers: Player[];
};

function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const currentIndex = tabs.indexOf(event.target as HTMLButtonElement);
  if (currentIndex < 0) return;

  let nextIndex: number;
  switch (event.key) {
    case "ArrowRight":
      nextIndex = (currentIndex + 1) % tabs.length;
      break;
    case "ArrowLeft":
      nextIndex = (currentIndex + tabs.length - 1) % tabs.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = tabs.length - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
}

export default function ChatPanel({
  gameId,
  userId,
  onlineUsers,
}: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState<ChatTab>(
    gameId ? "game" : "lobby",
  );
  const tabs: { id: ChatTab; label: string }[] = [
    { id: "users", label: "Online" },
    { id: "lobby", label: "Lobby Chat" },
  ];
  if (gameId) tabs.push({ id: "game", label: "Game Chat" });

  const tabStyle = {
    "--tab-index": tabs.findIndex((tab) => tab.id === activeTab),
    "--tab-count": tabs.length,
  } as CSSProperties;

  return (
    <aside className="chat-panel">
      <div
        className="chat-tabs"
        role="tablist"
        aria-label="Lobby sidebar"
        onKeyDown={handleTabKeyDown}
        style={tabStyle}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "active" : ""}
            role="tab"
            id={`${tab.id}-tab`}
            aria-controls="sidebar-panel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === "users" && (
              <>
                {" "}
                <span>{onlineUsers.length}</span>
              </>
            )}
          </button>
        ))}
      </div>
      <div
        id="sidebar-panel"
        className="sidebar-panel"
        role="tabpanel"
        aria-labelledby={`${activeTab}-tab`}
      >
        {activeTab === "users" ? (
          <div className="online-users">
            <ul>
              {onlineUsers.map((user) => (
                <li key={user.id}>
                  <span className="online-dot" aria-hidden="true" />
                  {user.username}
                  {user.id === userId && <small>You</small>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <MessageBox
            key={activeTab === "game" ? gameId : "lobby"}
            gameId={activeTab === "game" ? gameId : undefined}
          />
        )}
      </div>
    </aside>
  );
}
