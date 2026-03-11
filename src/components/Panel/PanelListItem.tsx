import type { PanelItem } from "../../context/PanelContext";
import "./PanelListItem.css";

interface PanelListItemProps {
  item: PanelItem;
  onAction: (id: string, action: "request" | "accept" | "reject") => void;
  onRemove: (id: string) => void;
}

// Status badge component
function StatusBadge({ status }: { status: PanelItem["status"] }) {
  if (status === "idle") return null;

  const statusText = {
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Rejected",
  }[status];

  return <span className={`status-badge status-${status}`}>{statusText}</span>;
}

export default function PanelListItem({
  item,
  onAction,
  onRemove,
}: PanelListItemProps) {
  const renderContent = () => {
    switch (item.type) {
      case "chat_request":
        return (
          <>
            <div className="panel-item-text">
              <span>Request private chat to {item.targetClientName}</span>
            </div>
            {item.status === "idle" ? (
              <button
                className="panel-item-action-btn"
                onClick={() => onAction(item.id, "request")}
              >
                Request
              </button>
            ) : (
              <StatusBadge status={item.status} />
            )}
          </>
        );

      case "chat_received":
        return (
          <>
            <div className="panel-item-text">
              <span>{item.targetClientName} requested private chat</span>
            </div>
            {item.status === "idle" ? (
              <button
                className="panel-item-action-btn accept"
                onClick={() => onAction(item.id, "accept")}
              >
                Accept
              </button>
            ) : (
              <StatusBadge status={item.status} />
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`panel-list-item panel-list-item--${item.type} status-${item.status}`}
    >
      <div className="panel-item-content">{renderContent()}</div>
      <button
        className="panel-item-close"
        onClick={() => onRemove(item.id)}
        aria-label="Remove"
        title={
          item.type === "chat_received" && item.status === "idle"
            ? "Reject"
            : "Close"
        }
      >
        ×
      </button>
    </div>
  );
}
