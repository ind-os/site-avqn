/**
 * Collecte générique d'un formulaire — le cœur du socle, isolé pour être
 * testable sans navigateur (`pnpm run test:unit`).
 *
 * Tout champ portant un `name` part dans la soumission : aucune liste blanche.
 * Les champs laissés vides sont écartés, plusieurs valeurs sous un même `name`
 * (choix multiple) sont jointes par « , ».
 */

/** `source` appartient au socle : un champ de ce nom ne peut pas l'usurper. */
export const CLE_RESERVEE = "source";

/** FormData natif → dictionnaire plat prêt à poster vers `/api/contact`. */
export function collecter(
  formData: FormData,
  source: string,
): Record<string, string> {
  const valeurs = new Map<string, string>();
  for (const [cle, brut] of formData.entries()) {
    if (typeof brut !== "string") continue; // fichiers hors périmètre
    const valeur = brut.trim();
    if (!valeur) continue;
    const deja = valeurs.get(cle);
    valeurs.set(cle, deja ? `${deja}, ${valeur}` : valeur);
  }
  valeurs.delete(CLE_RESERVEE);
  return { ...Object.fromEntries(valeurs), [CLE_RESERVEE]: source };
}
