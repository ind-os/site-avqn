/**
 * Les étiquettes d'appoint du site — une couleur par catégorie, la même partout.
 *
 * Doctrine : les cinq couleurs d'appoint (jaune, ciel, menthe, rose, lilas)
 * n'entrent que par trois portes — les cases du quadrillage, l'ombre de l'objet
 * posé, et les étiquettes. Une étiquette garde sa couleur d'un bout à l'autre du
 * site : si « Coaching individuel » est jaune sur l'accueil, il l'est partout.
 * `brand/doctrine/couleur.md`, règle 4.
 */

/** Les trois formats d'accompagnement, dans l'ordre où l'accueil les présente. */
export const OFFRES = {
  "coaching-individuel": 1,
  "accompagnement-equipe": 2,
  "cto-ia": 3,
  bootcamp: 4,
  "agents-ia": 5,
} as const;

export type Offre = keyof typeof OFFRES;

/** La classe d'étiquette d'une offre : `etiquette etiquette-<n>`. */
export function etiquetteOffre(offre: Offre): string {
  return `etiquette etiquette-${OFFRES[offre]}`;
}

/**
 * La classe d'étiquette d'un numéro d'étape. Les étapes d'une même séquence
 * tournent sur les cinq appoints, dans l'ordre : l'étiquette dit le rang, la
 * couleur ne code rien d'autre.
 */
export function etiquetteEtape(index: number): string {
  return `etiquette etiquette-${(index % 5) + 1}`;
}
