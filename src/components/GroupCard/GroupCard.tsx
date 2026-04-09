import type { GroupInfo, Client } from "../../types";
import { useEffect, useState } from "react";
import { userService } from "../../services/api";
import "./GroupCard.css";

interface GroupCardProps {
  group: GroupInfo;
  onJoin: (groupId: string) => void;
  onClose: () => void;
}

export default function GroupCard({ group, onJoin, onClose }: GroupCardProps) {
  const [memberDetails, setMemberDetails] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Fetch first 3 members' details for avatar preview
    const toFetch = group.members.slice(0, 3);
    Promise.all(toFetch.map((id) => userService.getClientById(id).catch(() => null)))
      .then((results) => {
        setMemberDetails(results.filter(Boolean) as Client[]);
        setLoaded(true);
      });
  }, [group.members]);

  const extraCount = Math.max(0, group.members.length - 3);

  if (!loaded) return null;

  return (
    <>
    <div className="group-card-backdrop" onClick={onClose} />
    <div className="group-card">
      <h3 className="group-card-name">{group.groupName}</h3>

      <div className="group-card-avatars">
        {memberDetails.map((m, i) => {
          const initial = m.clientUserName?.[0]?.toUpperCase() || "?";
          return (
            <div key={m.clientId || i} className="group-card-avatar">
              {initial}
            </div>
          );
        })}
        {extraCount > 0 && (
          <div className="group-card-avatar group-card-extra">+{extraCount}</div>
        )}
      </div>

      <button className="group-card-join-btn" onClick={() => onJoin(group.groupId)}>
        Join
      </button>
    </div>
    </>
  );
}
