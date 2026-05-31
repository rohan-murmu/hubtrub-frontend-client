// World scene catalogue. Keys mirror the Godot scene registry
// (scene_registry.gd → WORLD_SCENES). Used by the hub creation flow, the
// hub card list, and the standalone explore preview.
export interface SceneOption {
  key: string;
  label: string;
  blurb: string;
  /** Public path of the preview image (served from /public/world_preview).
   *  Optional — when absent the UI falls back to an icon + gradient. */
  image?: string;
}

export const SCENES: SceneOption[] = [
  {
    key: 'first_land',
    label: 'The First Land',
    blurb: 'The land where we begin — green hills and quiet trails.',
    image: '/world_preview/the-first-land.png',
  },
];

export function findScene(key: string | undefined | null): SceneOption | undefined {
  if (!key) return undefined;
  return SCENES.find((s) => s.key === key);
}

/** Resolve the preview image for a scene key (or null if unknown / no image). */
export function sceneImageFor(key: string | undefined | null): string | null {
  return findScene(key)?.image ?? null;
}
