import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import type { Room } from '../types';
import './RoomFormTemplate.css';

// Scene options - mapped to Godot scene registry keys
const SCENE_OPTIONS = [
  { id: 'forest', label: 'Forest', description: 'res://scenes/worlds/world_forest.tscn' },
  { id: 'desert', label: 'Desert', description: 'res://scenes/worlds/world_desert.tscn' }
];

interface RoomFormTemplateProps {
  onSubmit: (data: Room) => void;
  loading?: boolean;
  initialData?: Room;
  title?: string;
}

export default function RoomFormTemplate({
  onSubmit,
  loading = false,
  initialData,
  title = 'Create Hub',
}: RoomFormTemplateProps) {
  const { control, handleSubmit } = useForm<Room>({
    defaultValues: initialData || {
      roomName: '',
      roomScene: '',
    },
  });

  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    initialData?.roomScene || ''
  );
  const [uploadedImage, setUploadedImage] = useState<string | null>(
    initialData?.roomScene || null
  );

  const onSubmitForm = (data: Room) => {
    const sceneValue = uploadedImage || selectedSceneId;
    onSubmit({
      ...data,
      roomScene: sceneValue,
    });
  };

  return (
    <div className="room-form-container">
      <Card className="room-form-card">
        <h2>{title}</h2>
        <form onSubmit={handleSubmit(onSubmitForm)}>
          <div className="form-field">
            <label htmlFor="roomName">Hub Name</label>
            <Controller
              name="roomName"
              control={control}
              rules={{ required: 'Hub name is required' }}
              render={({ field, fieldState }) => (
                <>
                  <InputText
                    {...field}
                    id="roomName"
                    className={`w-100 ${fieldState.error ? 'p-invalid' : ''}`}
                    placeholder="Enter hub name"
                  />
                  {fieldState.error && (
                    <small className="p-error">{fieldState.error.message}</small>
                  )}
                </>
              )}
            />
          </div>

          <div className="form-field">
            <label>Choose Scene</label>
            <div className="scene-grid">
              {SCENE_OPTIONS.map((sceneOption) => (
                <div
                  key={sceneOption.id}
                  className={`scene-option ${
                    selectedSceneId === sceneOption.id ? 'selected' : ''
                  }`}
                  onClick={() => {
                    setSelectedSceneId(sceneOption.id);
                    setUploadedImage(null);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedSceneId(sceneOption.id);
                      setUploadedImage(null);
                    }
                  }}
                >
                  <div className="scene-label">{sceneOption.label}</div>
                  <div className="scene-description">{sceneOption.description}</div>
                  <div className="scene-preview-box" />
                </div>
              ))}
            </div>
          </div>

          <Button
            label={loading ? 'Processing...' : title}
            type="submit"
            disabled={loading || (!selectedSceneId && !uploadedImage)}
            loading={loading}
            className="welcome-button"
          />
        </form>
      </Card>
    </div>
  );
}
