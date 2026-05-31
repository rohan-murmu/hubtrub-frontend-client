import { AVATARS, findAvatar, type AvatarOption } from '@/utils/avatars';
import './AvatarSelector.css';

interface AvatarSelectorProps {
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}

/** Three-pane avatar picker:
 *    ┌─────────────┬────────────────┐
 *    │             │   viewer (big) │
 *    │  selector   ├────────────────┤
 *    │   (tiles)   │   info card    │
 *    └─────────────┴────────────────┘
 *  Used by the signup flow and Settings → Appearance. */
export default function AvatarSelector({ value, onChange, disabled }: AvatarSelectorProps) {
  const selected: AvatarOption | undefined = findAvatar(value) ?? AVATARS[0];

  return (
    <div className="avatar-selector">
      <ul
        className="avatar-selector__list"
        role="listbox"
        aria-label="Avatars"
      >
        {AVATARS.map((opt) => {
          const isSelected = opt.key === selected?.key;
          return (
            <li key={opt.key}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                title={opt.name}
                className={`avatar-thumb${isSelected ? ' is-selected' : ''}`}
                onClick={() => onChange(opt.key)}
                disabled={disabled}
              >
                <img src={opt.image} alt={opt.name} draggable={false} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="avatar-selector__right">
        <div className="avatar-viewer" aria-live="polite">
          {selected && (
            <img
              className="avatar-viewer__img"
              src={selected.image}
              alt={selected.name}
              draggable={false}
            />
          )}
        </div>

        <div className="avatar-info">
          {selected ? (
            <>
              <div className="avatar-info__head">
                <span className="avatar-info__name">{selected.name}</span>
                <span className="avatar-info__age">
                  <span className="avatar-info__age-label">Age</span>
                  {selected.description.age}
                </span>
              </div>
              <div className="avatar-info__divider" />
              <div>
                <p className="avatar-info__about-label">About</p>
                <p className="avatar-info__about">{selected.description.about}</p>
              </div>
            </>
          ) : (
            <p className="avatar-info__empty">Pick an avatar on the left.</p>
          )}
        </div>
      </div>
    </div>
  );
}
