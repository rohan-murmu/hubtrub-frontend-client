import type { Client } from "../../types";
import { useChat } from "../../context/ChatContext";
import "./PlayerCard.css";

interface PlayerCardProps {
  client: Client;
  onFollow?: (client: Client) => void;
}

export default function PlayerCard({ client, onFollow }: PlayerCardProps) {
  const { createPrivateChat, openChatWindow } = useChat();

  const initial = client.clientUserName?.[0]?.toUpperCase() || "?";

  const handleMessage = () => {
    if (!client.clientId) return;
    const chatId = createPrivateChat(client.clientId, client.clientUserName);
    openChatWindow(chatId);
  };

  return (
    <div className="player-card">
      <div className="player-card-avatar">
        {initial}
      </div>
      <p className="player-card-username">{client.clientUserName}</p>
      <span className="player-card-status">online</span>
      <div className="player-card-actions">
        <button className="player-card-btn" onClick={() => onFollow?.(client)}>Follow</button>
        <button className="player-card-btn" onClick={handleMessage}>Message</button>
      </div>
    </div>
  );
}

