export interface CharacterArt {
  characterId: string;
  baseImagePath: string | null;
  bannerImagePath: string | null;
  splashImagePath: string | null;
  chatBackgroundImagePath: string | null;
  generatedAt: string;
}

export function emptyCharacterArt(characterId: string): CharacterArt {
  return {
    characterId,
    baseImagePath: null,
    bannerImagePath: null,
    splashImagePath: null,
    chatBackgroundImagePath: null,
    generatedAt: new Date().toISOString(),
  };
}
