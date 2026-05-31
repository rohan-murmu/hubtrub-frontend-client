import { SCENES } from '@/utils/scenes';
import Button from '@/components/ui/Button';
import './hub-form.css';

interface SceneSelectorProps {
  value: string;
  onChange: (sceneKey: string) => void;
  onExplore: (sceneKey: string) => void;
  disabled?: boolean;
}

/** Step 2 of Create Hub — pick the world scene, with an option to explore it
 *  in a standalone preview before committing. */
export default function SceneSelector({ value, onChange, onExplore, disabled }: SceneSelectorProps) {
  return (
    <div className="scene-grid">
      {SCENES.map((scene) => {
        const isSelected = scene.key === value;
        return (
          <div
            key={scene.key}
            className={`scene-card${isSelected ? ' is-selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => !disabled && onChange(scene.key)}
            onKeyDown={(e) => {
              if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onChange(scene.key);
              }
            }}
          >
            <div className="scene-card__preview" aria-hidden="true">
              {scene.image ? (
                <img
                  className="scene-card__preview-img"
                  src={scene.image}
                  alt={scene.label}
                  draggable={false}
                />
              ) : (
                <i className="pi pi-compass" />
              )}
            </div>
            <div className="scene-card__body">
              <span className="scene-card__name">{scene.label}</span>
              <span className="scene-card__blurb">{scene.blurb}</span>
              <Button
                variant="ghost"
                size="sm"
                icon="pi pi-eye"
                className="scene-card__explore"
                onClick={(e) => {
                  e.stopPropagation();
                  onExplore(scene.key);
                }}
              >
                Explore
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
