import { describe, it, expect } from 'vitest';
import { z } from 'astro/zod';

describe('Projektaufbau', () => {
  it('kann Zod über astro/zod importieren', () => {
    const schema = z.object({ a: z.string() });
    expect(schema.parse({ a: 'x' })).toEqual({ a: 'x' });
  });

  it('hat eine DOM-Umgebung', () => {
    expect(typeof document).toBe('object');
  });
});
