import type { RoomVisibility } from '@/types';
import TextField from '@/components/ui/TextField';
import RichTextEditor from '@/components/RichTextEditor';
import './hub-form.css';

export interface HubDetails {
  name: string;
  description: string;
  visibility: RoomVisibility;
}

interface HubDetailsFormProps {
  value: HubDetails;
  onChange: (next: HubDetails) => void;
  disabled?: boolean;
}

/** Step 1 of the hub flow — shared by Create and Update. Private visibility is
 *  intentionally disabled for now (only public hubs are supported). */
export default function HubDetailsForm({ value, onChange, disabled }: HubDetailsFormProps) {
  return (
    <div className="hub-form">
      <TextField
        id="hub-name"
        label="Name"
        placeholder="Give your hub a name"
        maxLength={120}
        value={value.name}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />

      <div>
        <label className="hub-form__field-label">Description</label>
        <RichTextEditor
          value={value.description}
          onChange={(html) => onChange({ ...value, description: html })}
          placeholder="Describe your hub — what's it for, who's it for…"
        />
      </div>

      <div>
        <label className="hub-form__field-label">Hub type</label>
        <div className="hub-type" role="radiogroup" aria-label="Hub type">
          <button
            type="button"
            role="radio"
            aria-checked={value.visibility === 'PUBLIC'}
            className={`hub-type__option ${value.visibility === 'PUBLIC' ? 'is-active' : ''}`}
            onClick={() => onChange({ ...value, visibility: 'PUBLIC' })}
            disabled={disabled}
          >
            <i className="pi pi-globe" aria-hidden="true" />
            Public
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={false}
            className="hub-type__option"
            disabled
            title="Private hubs are coming soon"
          >
            <i className="pi pi-lock" aria-hidden="true" />
            Private
          </button>
        </div>
        <p className="hub-type__hint">Private hubs are coming soon — hubs are public for now.</p>
      </div>
    </div>
  );
}
