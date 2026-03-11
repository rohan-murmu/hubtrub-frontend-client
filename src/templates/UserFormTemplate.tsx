import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import type { Client } from '../types';
import './UserFormTemplate.css';

// Predefined avatar options - mapped to Godot avatar registry keys
const AVATAR_OPTIONS = [
  { id: 'knight', label: 'Knight', color: '#FF6B6B', description: 'res://scenes/players/player_knight.tscn' },
  { id: 'mage', label: 'Mage', color: '#4ECDC4', description: 'res://scenes/players/player_mage.tscn' }
];

interface UserFormTemplateProps {
  onSubmit: (data: Client) => void;
  loading?: boolean;
  initialData?: Client;
  title?: string;
}

export default function UserFormTemplate({
  onSubmit,
  loading = false,
  initialData,
  title = 'Create User',
}: UserFormTemplateProps) {
  const { control, handleSubmit, setError } = useForm<Client>({
    defaultValues: initialData || {
      clientUserName: '',
      clientAvatar: '',
    },
  });

  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    initialData?.clientAvatar || ''
  );
  const [backendError, setBackendError] = useState<string | null>(null);

  const onSubmitForm = async (data: Client) => {
    // Clear previous backend errors
    setBackendError(null);
    
    const selectedAvatar = AVATAR_OPTIONS.find((a) => a.id === selectedAvatarId);
    
    try {
      await onSubmit({
        ...data,
        clientAvatar: selectedAvatar ? selectedAvatar.id : '', // Use the key (knight, mage, etc.)
      });
    } catch (error: unknown) {
      // Handle backend error for duplicate username (409 Conflict)
      if (error instanceof Error) {
        if (error.message.includes('409') || error.message.includes('Username already exists')) {
          setBackendError('Username already exists');
          setError('clientUserName', {
            type: 'server',
            message: 'Username already exists',
          });
        } else {
          setBackendError(error.message);
        }
      }
    }
  };

  return (
    <div className="user-form-container">
      <Card className="user-form-card">
        <h2>{title}</h2>
        <form onSubmit={handleSubmit(onSubmitForm)}>
          <div className="form-field">
            <label htmlFor="clientUserName">User Name</label>
            <Controller
              name="clientUserName"
              control={control}
              rules={{ required: 'User name is required' }}
              render={({ field, fieldState }) => (
                <>
                  <InputText
                    {...field}
                    id="clientUserName"
                    className={`w-100 ${fieldState.error || backendError ? 'p-invalid' : ''}`}
                    placeholder="Enter your user name"
                    onFocus={() => setBackendError(null)}
                  />
                  {(fieldState.error || backendError) && (
                    <small className="p-error">
                      {fieldState.error?.message || backendError}
                    </small>
                  )}
                </>
              )}
            />
          </div>

          <div className="form-field">
            <label>Choose Avatar</label>
            <div className="avatar-grid">
              {AVATAR_OPTIONS.map((avatarOption) => (
                <div
                  key={avatarOption.id}
                  className={`avatar-option ${
                    selectedAvatarId === avatarOption.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedAvatarId(avatarOption.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedAvatarId(avatarOption.id);
                    }
                  }}
                >
                  <div className="avatar-label">{avatarOption.label}</div>
                  <div className="avatar-description">{avatarOption.description}</div>
                  <div
                    className="avatar-circle"
                    style={{ backgroundColor: avatarOption.color }}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button
            label={loading ? 'Saving...' : 'Submit'}
            type="submit"
            disabled={loading || !selectedAvatarId}
            loading={loading}
            className="welcome-button"
          />
        </form>
      </Card>
    </div>
  );
}
