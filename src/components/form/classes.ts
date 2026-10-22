/**
 * Classes de la charte pour les champs de formulaire — un seul endroit.
 * Partagées par le socle (`ActionForm.astro`) et par les champs composables.
 */

/** Champ de saisie : contour `trait` en `trait-objet`, rayon `rayon-m`, fond `fond`. */
export const CHAMP =
  "w-full rounded-md bg-paper border-[length:var(--trait-objet)] border-[color:var(--trait)] px-4 py-3 font-medium text-ink placeholder:text-grey placeholder:font-normal transition-colors duration-150";

/** Libellé posé au-dessus d'un champ. */
export const LIBELLE = "block text-sm font-semibold text-ink mb-1.5";

/** Légende d'un groupe de choix (`fieldset`). */
export const LEGENDE = "block text-sm font-semibold text-ink mb-2";

/** Ligne cliquable d'une option (bouton radio ou case à cocher). */
export const OPTION =
  "flex items-start gap-3 cursor-pointer text-ink leading-relaxed";

/** Contrôle d'une option — l'accent vermillon de la charte. */
export const CONTROLE = "mt-1 h-4 w-4 shrink-0 accent-swiss";
