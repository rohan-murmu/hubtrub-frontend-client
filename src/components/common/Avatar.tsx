import type { CSSProperties } from "react";
import { avatarImageFor } from "@/utils/avatars";
import "./Avatar.css";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  name?: string | null;
  /** Avatar catalogue key (`User.avatarKey`). When set and resolvable, the
   *  matching preview image is rendered instead of initials. */
  avatarKey?: string | null;
  size?: AvatarSize;
  online?: boolean | null;
  ring?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

/** Single source of truth for circular profile avatars across the app.
 *  - If `avatarKey` resolves to a known avatar, renders its preview image.
 *  - Otherwise falls back to an initial-letter tile.
 *  - `online` renders the colored status dot (true=green, false=gray, null=hidden)
 *  - `ring` adds the green accent ring used to highlight selected/active rows. */
export default function Avatar({
  name,
  avatarKey,
  size = "md",
  online = null,
  ring = false,
  className = "",
  style,
}: AvatarProps) {
  const initial = name?.trim()?.[0]?.toUpperCase() || "?";
  const px = SIZE_PX[size];
  const image = avatarImageFor(avatarKey);
  const inline: CSSProperties = {
    width: px,
    height: px,
    fontSize: Math.max(10, px * 0.38),
    ...style,
  };

  return (
    <span
      className={`sx-avatar ${ring ? "is-ring" : ""} ${image ? "has-image" : ""} ${className}`.trim()}
      style={inline}
      data-size={size}
    >
      {image ? (
        <img
          className="sx-avatar-img"
          src={image}
          alt={name ?? "avatar"}
          draggable={false}
        />
      ) : (
        <span className="sx-avatar-initial">{initial}</span>
      )}
      {online !== null && (
        <span className={`sx-avatar-dot ${online ? "is-online" : "is-offline"}`} />
      )}
    </span>
  );
}
