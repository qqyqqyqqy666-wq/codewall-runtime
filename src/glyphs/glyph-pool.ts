/**
 * Holds reusable glyph slots so future emitters can recycle instances instead of recreating them.
 */
import type { GlyphAtlas } from './glyph-atlas';

export type GlyphSlot = {
  id: number;
  glyphId: string | null;
  active: boolean;
};

export class GlyphPool {
  private readonly slots: GlyphSlot[] = [];
  private atlas: GlyphAtlas | null = null;

  attachAtlas(atlas: GlyphAtlas): void {
    this.atlas = atlas;
  }

  seed(size: number): void {
    if (this.slots.length > 0) {
      return;
    }

    const glyphs = this.atlas?.list() ?? [];

    for (let index = 0; index < size; index += 1) {
      const glyph = glyphs[index % Math.max(glyphs.length, 1)];

      this.slots.push({
        id: index,
        glyphId: glyph?.id ?? null,
        active: false,
      });
    }
  }

  acquire(): GlyphSlot | undefined {
    const slot = this.slots.find((candidate) => !candidate.active);

    if (slot) {
      slot.active = true;
    }

    return slot;
  }

  release(id: number): void {
    const slot = this.slots.find((candidate) => candidate.id === id);

    if (slot) {
      slot.active = false;
    }
  }
}
