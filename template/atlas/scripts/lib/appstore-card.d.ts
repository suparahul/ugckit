/** Types for scripts/lib/appstore-card.mjs, for the Atlas's card route. */
export const CARD_W: number;
export const CARD_H: number;
export function defaultCardText(slug: string): { name: string; subtitle: string; button: string } | null;
export function iconOf(slug: string): string;
export function cardHash(t: { name: string; subtitle: string; button: string }): string;
export function cardFitError(t: { name: string; subtitle: string; button: string }): Promise<string | null>;
export function renderAppStoreCard(t: { slug: string; name: string; subtitle: string; button: string; out: string }): Promise<{ w: number; h: number }>;
