/**
 * Traitement des formulaires du site — générique.
 *
 * Le corps reçu est un dictionnaire plat de champs. Deux clés seulement ont un
 * sens ici : `source` (le formulaire d'origine) et `email` (le seul champ
 * requis). Tout le reste est accepté tel quel et transmis : ajouter un champ à
 * un formulaire ne demande rien à ce fichier.
 *
 * Le site VALIDE et ENVOIE. Un seul effet à la soumission : un mail à
 * `AVQN_DESTINATAIRE`, par le compte d'envoi de l'instance (SMTP), avec tous
 * les champs et l'adresse du visiteur en réponse. Le site ne garde rien : ni
 * table, ni fichier, ni file d'attente.
 *
 * La route est publique : chaque adresse de visiteur a droit à
 * `DEBIT.demandes` demandes par `DEBIT.fenetreMs`, comptées en mémoire.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

/**
 * Délai maximal accordé à chaque temps de l'envoi (connexion, accueil du
 * serveur SMTP, silence en cours d'échange) avant abandon : le visiteur attend
 * la réponse du formulaire.
 */
const ENVOI_TIMEOUT_MS = 10_000;

/**
 * Borne de débit de la route : au plus `demandes` demandes par adresse de
 * visiteur sur `fenetreMs`. Large pour un humain qui se reprend, serrée pour
 * un robot qui voudrait remplir la boîte de réception.
 */
export const DEBIT = {
  demandes: 5,
  fenetreMs: 60 * 60 * 1000,
  /** Nombre maximal d'adresses suivies à la fois. */
  adresses: 10_000,
} as const;

/**
 * Bornes du corps accepté — l'endpoint est public et sans liste blanche, donc
 * la charge utile est bornée explicitement. Larges pour un humain, serrées
 * pour un robot : un formulaire réel tient dans un dixième de ces valeurs.
 */
export const LIMITES = {
  /** Nombre maximal de champs distincts dans une soumission. */
  champs: 40,
  /** Longueur maximale d'une clé de champ. */
  cle: 40,
  /** Nombre maximal de valeurs sous un même `name` (choix multiple). */
  valeurs: 40,
  /** Longueur maximale d'une valeur (un long message tient largement). */
  valeur: 5000,
  /** Longueur cumulée maximale des clés et valeurs retenues. */
  total: 20_000,
  /** Taille maximale du corps brut lu par la route, en octets. */
  corps: 64 * 1024,
  /** Longueur maximale d'une adresse email (RFC 5321). */
  email: 254,
} as const;

/** Clé de champ acceptée : un identifiant simple, sans espace ni ponctuation. */
const CLE_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * Sources reconnues — un formulaire du site déclare la sienne ici. L'endpoint
 * est public : cet ensemble fermé empêche un inconnu d'écrire ce qu'il veut
 * dans le sujet du mail. Ce sont les CHAMPS qui sont libres, pas la source.
 */
export const SOURCES: ReadonlySet<string> = new Set([
  "avqn-contact",
  "avqn-bootcamp",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Message rendu au client sur toute violation de borne — sans détail. */
const ERREUR_FORMULAIRE = "Formulaire invalide.";
const ERREUR_EMAIL = "Une adresse email valide est requise.";
const ERREUR_CORPS = "Corps de requête invalide.";

/** Une soumission validée. `champs` porte tous les champs, email inclus. */
export interface ContactPayload {
  /** Formulaire d'origine, repris dans le sujet du mail (`avqn-contact`…). */
  source: string;
  email: string;
  /** Tous les champs reçus, tels quels — aucune liste blanche. */
  champs: Record<string, string>;
}

export interface ContactResult {
  ok: boolean;
  /**
   * Statut du seul effet — utile au log serveur, jamais d'info sensible.
   * `skipped` veut dire qu'un réglage d'envoi manque : c'est une panne de
   * déploiement, pas un cas nominal, et le visiteur reçoit un 500.
   */
  envoi: "envoye" | "skipped" | "failed";
}

/**
 * Ramène une valeur brute à une chaîne. `null` signale un type refusé (objet,
 * imbrication) ; une chaîne vide signale un champ laissé vide.
 */
function normaliser(brut: unknown): string | null {
  if (typeof brut === "string") return brut.trim();
  if (typeof brut === "number" && Number.isFinite(brut)) return String(brut);
  if (typeof brut === "boolean") return String(brut);
  if (brut === null || brut === undefined) return "";
  // Choix multiple : un tableau de valeurs scalaires, joint par « , ».
  if (Array.isArray(brut)) {
    if (brut.length > LIMITES.valeurs) return null;
    const morceaux: string[] = [];
    for (const item of brut) {
      if (typeof item === "string") {
        const valeur = item.trim();
        if (valeur) morceaux.push(valeur);
        continue;
      }
      if (typeof item === "number" && Number.isFinite(item)) {
        morceaux.push(String(item));
        continue;
      }
      if (typeof item === "boolean") {
        morceaux.push(String(item));
        continue;
      }
      return null;
    }
    return morceaux.join(", ");
  }
  return null;
}

/**
 * Valide le corps reçu et en fait une soumission. Aucune liste blanche : les
 * champs inconnus passent tels quels, seules les bornes les arrêtent.
 */
export function parseContactPayload(
  raw: unknown,
): { ok: true; value: ContactPayload } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: ERREUR_FORMULAIRE };
  }

  const entrees = Object.entries(raw as Record<string, unknown>);
  if (entrees.length > LIMITES.champs) {
    return { ok: false, error: ERREUR_FORMULAIRE };
  }

  const champs = new Map<string, string>();
  let source = "";
  let total = 0;

  for (const [cle, brut] of entrees) {
    if (cle.length > LIMITES.cle || !CLE_RE.test(cle)) {
      return { ok: false, error: ERREUR_FORMULAIRE };
    }
    const valeur = normaliser(brut);
    if (valeur === null || valeur.length > LIMITES.valeur) {
      return { ok: false, error: ERREUR_FORMULAIRE };
    }
    if (!valeur) continue; // champ laissé vide → ignoré

    total += cle.length + valeur.length;
    if (total > LIMITES.total) {
      return { ok: false, error: ERREUR_FORMULAIRE };
    }

    if (cle === "source") {
      source = valeur;
      continue;
    }
    champs.set(cle, valeur);
  }

  if (!SOURCES.has(source)) {
    return { ok: false, error: ERREUR_FORMULAIRE };
  }

  const email = champs.get("email") ?? "";
  if (!EMAIL_RE.test(email) || email.length > LIMITES.email) {
    return { ok: false, error: ERREUR_EMAIL };
  }

  return {
    ok: true,
    value: { source, email, champs: Object.fromEntries(champs) },
  };
}

/** Hôtes où un port autre que 465 peut se passer de STARTTLS : la machine même. */
const LOCAL: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"]);

/** Fabrique le transport SMTP ; les tests y substituent un `jsonTransport`. */
export type CreerTransport = (
  options: SMTPTransport.Options,
) => Transporter<SMTPTransport.SentMessageInfo>;

/** Le texte du mail : la source, puis un champ par ligne. */
export function texteDuMail(p: ContactPayload): string {
  const lignes = [`source : ${p.source}`];
  for (const [cle, valeur] of Object.entries(p.champs)) {
    lignes.push(`${cle} : ${valeur}`);
  }
  return `${lignes.join("\n")}\n`;
}

/**
 * Envoie la demande par mail. N'échoue jamais en cascade : elle rend `failed`
 * et laisse la route décider quoi dire au visiteur. Le port 465 dit TLS
 * d'emblée ; un autre port, STARTTLS, exigé hors de la machine même.
 */
async function envoyer(
  reglages: Reglages,
  p: ContactPayload,
  creerTransport: CreerTransport,
): Promise<ContactResult["envoi"]> {
  const transport = creerTransport({
    host: reglages.hote,
    port: reglages.port,
    secure: reglages.port === 465,
    requireTLS: reglages.port !== 465 && !LOCAL.has(reglages.hote),
    auth: { user: reglages.identifiant, pass: reglages.motDePasse },
    connectionTimeout: ENVOI_TIMEOUT_MS,
    greetingTimeout: ENVOI_TIMEOUT_MS,
    socketTimeout: ENVOI_TIMEOUT_MS,
  });
  try {
    const info = await transport.sendMail({
      from: { name: reglages.nom, address: reglages.adresse },
      to: reglages.destinataire,
      replyTo: { name: "", address: p.email },
      subject: `[avqn.ch] ${p.source} : ${p.email}`,
      text: texteDuMail(p),
    });
    if ((info.rejected ?? []).length > 0) {
      console.error("[contact] le serveur SMTP a refusé le destinataire");
      return "failed";
    }
    return "envoye";
  } catch (erreur) {
    // Le code seul (EAUTH, ETIMEDOUT…) : jamais l'identifiant ni le contenu.
    const code = (erreur as { code?: string }).code ?? "inconnu";
    console.error(`[contact] l'envoi du mail a échoué (${code})`);
    return "failed";
  } finally {
    transport.close();
  }
}

/** Les réglages d'envoi, lus dans l'env. */
interface Reglages {
  hote: string;
  port: number;
  identifiant: string;
  motDePasse: string;
  adresse: string;
  nom: string;
  destinataire: string;
}

/** Les réglages d'envoi, complets, ou `null` si l'un manque. */
function lireReglages(env: ContactEnv): Reglages | null {
  const port = Number(env.ENVOI_PORT);
  const reglages: Reglages = {
    hote: env.ENVOI_HOTE ?? "",
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 0,
    identifiant: env.ENVOI_IDENTIFIANT ?? "",
    motDePasse: env.ENVOI_MOT_DE_PASSE ?? "",
    adresse: env.ENVOI_ADRESSE ?? "",
    // Le nom s'affiche devant l'adresse, sur une seule ligne.
    nom: (env.ENVOI_NOM ?? "")
      .replace(/\p{Cc}/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
    destinataire: env.AVQN_DESTINATAIRE ?? "",
  };
  // Le nom seul est facultatif.
  const complets = Object.entries(reglages).every(
    ([cle, valeur]) => cle === "nom" || Boolean(valeur),
  );
  return complets ? reglages : null;
}

/** L'unique effet de la soumission. */
export async function handleContact(
  p: ContactPayload,
  env: ContactEnv,
  creerTransport: CreerTransport = nodemailer.createTransport,
): Promise<ContactResult> {
  const reglages = lireReglages(env);
  if (!reglages) {
    console.error("[contact] un réglage d'envoi manque — rien n'est envoyé");
    return { ok: false, envoi: "skipped" };
  }

  const envoi = await envoyer(reglages, p, creerTransport);
  return { ok: envoi === "envoye", envoi };
}

// ---------------------------------------------------------------------------
// Point d'entrée HTTP — la route `/api/contact` n'est qu'une coquille autour
// de ceci, pour que le chemin réellement exposé soit celui qu'on teste.
// ---------------------------------------------------------------------------

/**
 * Env runtime attendu (posé par la définition de l'app). Un réglage absent →
 * rien n'est envoyé et le visiteur reçoit un 500 : il n'y a pas de second
 * chemin. Les six `ENVOI_*` sont le compte d'envoi de l'instance.
 */
export interface ContactEnv {
  ENVOI_HOTE?: string;
  ENVOI_PORT?: string;
  ENVOI_IDENTIFIANT?: string;
  ENVOI_MOT_DE_PASSE?: string;
  ENVOI_ADRESSE?: string;
  /** Le nom affiché devant `ENVOI_ADRESSE` ; le seul réglage facultatif. */
  ENVOI_NOM?: string;
  /** La boîte qui reçoit les demandes. */
  AVQN_DESTINATAIRE?: string;
}

/**
 * L'adresse du visiteur : la dernière de `X-Forwarded-For`, celle que Traefik
 * y ajoute. Les précédentes viennent du visiteur lui-même et ne prouvent rien ;
 * la socket, elle, est celle du proxy. Sans en-tête, une adresse commune.
 */
export function adresseDuVisiteur(request: Request): string {
  const chaine = request.headers.get("x-forwarded-for") ?? "";
  return chaine.split(",").at(-1)?.trim() ?? "";
}

/**
 * La clé de débit d'une adresse : une IPv4 entière, une IPv6 par son préfixe
 * /64, que tient un seul abonné et dont il change l'adresse à volonté.
 */
export function cleDeDebit(adresse: string): string {
  if (!adresse.includes(":")) return adresse;
  // IPv4 mappée en IPv6 (`::ffff:203.0.113.1`) : l'IPv4 qu'elle porte.
  if (adresse.includes(".")) return adresse.slice(adresse.lastIndexOf(":") + 1);
  const [tete, queue] = adresse.toLowerCase().split("::");
  const groupes = tete ? tete.split(":") : [];
  if (queue !== undefined) {
    const fin = queue ? queue.split(":") : [];
    const zeros = Math.max(0, 8 - groupes.length - fin.length);
    groupes.push(...Array<string>(zeros).fill("0"), ...fin);
  }
  const prefixe = groupes.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, ""));
  return `${prefixe.join(":")}::/64`;
}

/** Les secondes qui restent avant qu'une fenêtre ouverte à `debut` se ferme. */
function attente(debut: number, maintenant: number): number {
  return Math.ceil((debut + DEBIT.fenetreMs - maintenant) / 1000);
}

/**
 * Compte les demandes de chaque clé, par fenêtre fixe de `DEBIT.fenetreMs`.
 * Au plus `DEBIT.adresses` clés suivies : au-delà, une clé nouvelle attend
 * qu'une fenêtre se ferme, et la mémoire reste bornée.
 */
export function creerBorneDeDebit() {
  const fenetres = new Map<string, { debut: number; demandes: number }>();
  return {
    /**
     * 0 si la clé a encore droit à une demande, qui est alors comptée ; sinon
     * les secondes à attendre.
     */
    accepter(cle: string, maintenant = Date.now()): number {
      if (!fenetres.has(cle) && fenetres.size >= DEBIT.adresses) {
        let premiere = maintenant;
        for (const [autre, f] of fenetres) {
          if (maintenant - f.debut >= DEBIT.fenetreMs) fenetres.delete(autre);
          else premiere = Math.min(premiere, f.debut);
        }
        if (fenetres.size >= DEBIT.adresses)
          return attente(premiere, maintenant);
      }
      const f = fenetres.get(cle);
      if (!f || maintenant - f.debut >= DEBIT.fenetreMs) {
        fenetres.set(cle, { debut: maintenant, demandes: 1 });
        return 0;
      }
      if (f.demandes >= DEBIT.demandes) return attente(f.debut, maintenant);
      f.demandes++;
      return 0;
    },
  };
}

export type BorneDeDebit = ReturnType<typeof creerBorneDeDebit>;

/** Corps form-urlencoded → dictionnaire ; les clés répétées deviennent un tableau. */
function depuisFormulaire(texte: string): Record<string, string[]> {
  const groupes = new Map<string, string[]>();
  for (const [cle, valeur] of new URLSearchParams(texte)) {
    const deja = groupes.get(cle);
    if (deja) deja.push(valeur);
    else groupes.set(cle, [valeur]);
  }
  return Object.fromEntries(groupes);
}

/**
 * Lit le corps en comptant les octets au fil de l'eau et en coupant net au-delà
 * de la borne : un corps chunké n'annonce pas sa taille, on ne le met donc
 * jamais entièrement en mémoire sur parole. `null` = refusé ou illisible.
 */
async function lireTexteBorne(request: Request): Promise<string | null> {
  const flux = request.body;
  if (!flux) return "";

  const lecteur = flux.getReader();
  const decodeur = new TextDecoder();
  let octets = 0;
  let texte = "";
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      octets += value.byteLength;
      if (octets > LIMITES.corps) {
        await lecteur.cancel();
        return null;
      }
      texte += decodeur.decode(value, { stream: true });
    }
    return texte + decodeur.decode();
  } catch {
    return null;
  }
}

/**
 * Lit et borne le corps de la requête (JSON ou form-urlencoded). L'endpoint
 * est public : la taille est refusée avant tout traitement.
 */
export async function lireCorps(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  // Sortie immédiate si la requête annonce elle-même un corps trop gros.
  const annonce = Number(request.headers.get("content-length"));
  if (Number.isFinite(annonce) && annonce > LIMITES.corps) {
    return { ok: false, error: ERREUR_FORMULAIRE };
  }

  const texte = await lireTexteBorne(request);
  if (texte === null) {
    return { ok: false, error: ERREUR_FORMULAIRE };
  }

  try {
    const ct = request.headers.get("content-type") ?? "";
    return {
      ok: true,
      value: ct.includes("application/json")
        ? JSON.parse(texte)
        : depuisFormulaire(texte),
    };
  } catch {
    return { ok: false, error: ERREUR_CORPS };
  }
}

/** Réponse HTTP de la route : un statut et un corps JSON sans détail sensible. */
export interface ContactReponse {
  status: number;
  /** `Retry-After` d'un 429 : les secondes à attendre. */
  headers?: Record<string, string>;
  body: { ok: boolean; error?: string };
}

/** Traite une requête de formulaire de bout en bout : lecture, bornes, effets. */
export async function traiterRequete(
  request: Request,
  env: ContactEnv,
  debit: BorneDeDebit,
  creerTransport?: CreerTransport,
): Promise<ContactReponse> {
  // Comptée avant toute lecture : une demande refusée par les bornes compte
  // aussi, et un robot n'obtient rien de plus en envoyant n'importe quoi.
  const secondes = debit.accepter(cleDeDebit(adresseDuVisiteur(request)));
  if (secondes > 0) {
    return {
      status: 429,
      headers: { "Retry-After": String(secondes) },
      body: {
        ok: false,
        error:
          "Trop de demandes depuis votre adresse. Réessayez plus tard ou écrivez-nous à hello@avqn.ch.",
      },
    };
  }

  const lu = await lireCorps(request);
  if (!lu.ok) return { status: 400, body: { ok: false, error: lu.error } };

  const parsed = parseContactPayload(lu.value);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: parsed.error } };
  }

  const result = await handleContact(parsed.value, env, creerTransport);
  if (!result.ok) {
    // L'envoi a échoué, ou un réglage manque — signalé sans détail sensible.
    return {
      status: 500,
      body: {
        ok: false,
        error:
          "Une erreur est survenue côté serveur. Réessayez ou écrivez-nous à hello@avqn.ch.",
      },
    };
  }

  return { status: 200, body: { ok: true } };
}
