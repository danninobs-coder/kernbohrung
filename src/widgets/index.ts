import Pipeline from './Pipeline.astro';

/**
 * Bildet die Namen ab, die im MDX-Rumpf benutzt werden dürfen.
 * Generiertes MDX enthält deshalb keine import-Zeilen — der Compiler
 * schreibt nur <Pipeline … />, aufgelöst wird hier.
 */
export const widgets = { Pipeline };
