/**
 * Defines the glyph catalog that future text-driven particles and instances will draw from.
 */
export type GlyphDefinition = {
  id: string;
  value: string;
};

const DEFAULT_GLYPHS = ['{', '}', '[', ']', '<', '>', '/', '_', '=', '*'];

export class GlyphAtlas {
  private readonly glyphs = new Map<string, GlyphDefinition>();

  initialize(): void {
    if (this.glyphs.size > 0) {
      return;
    }

    DEFAULT_GLYPHS.forEach((value) => {
      this.glyphs.set(value, { id: value, value });
    });
  }

  list(): GlyphDefinition[] {
    return [...this.glyphs.values()];
  }
}
