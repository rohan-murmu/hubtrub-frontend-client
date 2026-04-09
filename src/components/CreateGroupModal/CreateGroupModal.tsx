import { useState } from "react";
import "./CreateGroupModal.css";

interface CreateGroupModalProps {
  onClose: () => void;
  onCreate: (groupName: string) => void;
}

export default function CreateGroupModal({ onClose, onCreate }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");

  const handleCreate = () => {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="create-group-overlay" onClick={onClose}>
      <div className="create-group-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="create-group-title">New Group</h2>
        <label className="create-group-label">Type in Group Name</label>
        <input
          className="create-group-input"
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Group name..."
          autoFocus
          maxLength={40}
        />
        <div className="create-group-actions">
          <button
            className="create-group-btn"
            onClick={handleCreate}
            disabled={!groupName.trim()}
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}
