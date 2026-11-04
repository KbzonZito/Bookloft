// La bienvenida aparece una sola vez: en una instalación nueva (biblioteca vacía y sin haberla visto).
// Quien actualiza con libros ya conoce la app: no se le muestra.
export const ONBOARDED = 'onboarded';

export function shouldShowOnboarding(bookCount: number, onboarded: boolean | null) {
  return !onboarded && bookCount === 0;
}
