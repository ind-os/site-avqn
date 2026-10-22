#!/usr/bin/env node
/**
 * Tests unitaires de la logique des formulaires et des redirections. Pas de
 * framework lourd : `node:test` + import direct du TS via
 * `--experimental-strip-types` (Node 22). Moitié de la gate du repo
 * (`pnpm run test:unit`, appelé aussi par la CI) : ni réseau ni secret.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { collecter } from "../src/components/form/collecte.ts";
import {
  DEBIT,
  LIMITES,
  SOURCES,
  adresseDuVisiteur,
  cleDeDebit,
  creerBorneDeDebit,
  parseContactPayload,
  handleContact,
  traiterRequete,
} from "../src/lib/contact.ts";
import {
  EXACT_REDIRECTS,
  PREFIX_REDIRECTS,
  resolveRedirect,
} from "../src/lib/redirects.ts";

// ---------------------------------------------------------------------------
// Collecte du socle (`ActionForm.astro` la branche telle quelle sur le FormData
// natif du formulaire). C'est le cœur du refactor : il se teste sans navigateur.
// ---------------------------------------------------------------------------

/** Construit un FormData à partir de paires, doublons compris. */
function formDataDe(paires) {
  const fd = new FormData();
  for (const [cle, valeur] of paires) fd.append(cle, valeur);
  return fd;
}

test("collecte : un champ jamais déclaré part sans rien changer au socle", () => {
  const r = collecter(
    formDataDe([
      ["email", "a@b.ch"],
      ["budget", "12000"],
    ]),
    "avqn-contact",
  );
  assert.equal(r.budget, "12000");
  assert.equal(r.email, "a@b.ch");
});

test("collecte : valeurs rognées, champs vides écartés", () => {
  const r = collecter(
    formDataDe([
      ["email", "  a@b.ch  "],
      ["company", "   "],
      ["phone", ""],
    ]),
    "avqn-contact",
  );
  assert.equal(r.email, "a@b.ch");
  assert.equal("company" in r, false);
  assert.equal("phone" in r, false);
});

test("collecte : plusieurs valeurs d'un même name jointes par « , »", () => {
  const r = collecter(
    formDataDe([
      ["email", "a@b.ch"],
      ["sujets", "n8n"],
      ["sujets", ""],
      ["sujets", "agents"],
    ]),
    "avqn-contact",
  );
  assert.equal(r.sujets, "n8n, agents");
});

test("collecte : `source` vient du socle, un champ ne peut pas l'usurper", () => {
  const r = collecter(
    formDataDe([
      ["email", "a@b.ch"],
      ["source", "avqn-facturation"],
    ]),
    "avqn-contact",
  );
  assert.equal(r.source, "avqn-contact");
});

test("collecte : un fichier est ignoré (hors périmètre)", () => {
  const fd = formDataDe([["email", "a@b.ch"]]);
  fd.append("piece", new File(["x"], "x.txt"));
  const r = collecter(fd, "avqn-contact");
  assert.equal("piece" in r, false);
});

// ---------------------------------------------------------------------------
// Collecte générique — aucune liste blanche : seuls `source` et `email` ont un
// sens ici, tout le reste passe tel quel. Les bornes sont la seule barrière.
// ---------------------------------------------------------------------------

/** Corps minimal valide, enrichi au besoin par le test. */
function corps(extra = {}) {
  return { source: "avqn-contact", email: "a@b.ch", ...extra };
}

test("email requis : absent → erreur", () => {
  assert.equal(parseContactPayload({ source: "avqn-contact" }).ok, false);
});

test("email invalide → erreur", () => {
  assert.equal(parseContactPayload(corps({ email: "pasunemail" })).ok, false);
});

test("email trop long → erreur", () => {
  const long = `${"a".repeat(LIMITES.email)}@b.ch`;
  assert.equal(parseContactPayload(corps({ email: long })).ok, false);
});

test("source requise : absente → erreur", () => {
  assert.equal(parseContactPayload({ email: "a@b.ch" }).ok, false);
});

test("source non-slug → erreur", () => {
  assert.equal(
    parseContactPayload(corps({ source: "AVQN Contact" })).ok,
    false,
  );
});

test("source hors de l'ensemble fermé → erreur (endpoint public)", () => {
  // Sans cet ensemble, un POST direct choisirait son bac de rangement dans l'OS.
  assert.equal(
    parseContactPayload(corps({ source: "avqn-facturation" })).ok,
    false,
  );
  assert.equal(
    parseContactPayload(corps({ source: "nimporte-quoi" })).ok,
    false,
  );
});

test("les sources déclarées sont toutes acceptées", () => {
  for (const source of SOURCES) {
    assert.equal(
      parseContactPayload(corps({ source })).ok,
      true,
      `la source déclarée « ${source} » est refusée`,
    );
  }
});

test("email + source seuls → ok, rien d'autre collecté", () => {
  const r = parseContactPayload({
    source: "avqn-contact",
    email: "  test@example.ch  ",
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.email, "test@example.ch");
  assert.equal(r.value.source, "avqn-contact");
  assert.deepEqual(Object.keys(r.value.champs), ["email"]);
});

test("champ inconnu : collecté tel quel, sans rien déclarer", () => {
  const r = parseContactPayload(
    corps({ budget: "12000", secteur: " MedTech ", vide: "   " }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.value.champs.budget, "12000");
  // Valeur rognée, champ vide ignoré.
  assert.equal(r.value.champs.secteur, "MedTech");
  assert.equal("vide" in r.value.champs, false);
});

test("choix multiple : un tableau est joint par « , »", () => {
  const r = parseContactPayload(corps({ sujets: ["n8n", "", "agents"] }));
  assert.equal(r.ok, true);
  assert.equal(r.value.champs.sujets, "n8n, agents");
});

test("nombres et booléens acceptés, objets refusés", () => {
  assert.equal(parseContactPayload(corps({ taille: 12, ok: true })).ok, true);
  assert.equal(parseContactPayload(corps({ imbrique: { a: 1 } })).ok, false);
  assert.equal(parseContactPayload(corps({ imbrique: [{ a: 1 }] })).ok, false);
});

test("corps non-objet → erreur", () => {
  assert.equal(parseContactPayload(null).ok, false);
  assert.equal(parseContactPayload("a@b.ch").ok, false);
  assert.equal(parseContactPayload([{ email: "a@b.ch" }]).ok, false);
});

// --- Bornes (endpoint public : la charge utile est explicitement bornée) ---

test("les bornes annoncées dans le CLAUDE.md sont bien celles du code", () => {
  // Les autres tests s'expriment en fonction de LIMITES : ils prouvent le
  // mécanisme, pas les chiffres. Celui-ci épingle les chiffres documentés.
  assert.deepEqual(
    { ...LIMITES },
    {
      champs: 40,
      cle: 40,
      valeurs: 40,
      valeur: 5000,
      total: 20_000,
      corps: 64 * 1024,
      email: 254,
    },
  );
});

test("borne : clé qui n'est pas un identifiant simple → rejet", () => {
  for (const cle of ["mon champ", "__proto__", "a.b", "1champ", "é"]) {
    assert.equal(
      parseContactPayload(corps({ [cle]: "x" })).ok,
      false,
      `la clé « ${cle} » aurait dû être refusée`,
    );
  }
});

test("borne : clé trop longue → rejet", () => {
  const cle = `a${"b".repeat(LIMITES.cle)}`;
  assert.equal(parseContactPayload(corps({ [cle]: "x" })).ok, false);
});

test("borne : trop de champs → rejet", () => {
  const trop = {};
  for (let i = 0; i <= LIMITES.champs; i++) trop[`c${i}`] = "x";
  assert.equal(parseContactPayload(corps(trop)).ok, false);
});

test("borne : valeur trop longue → rejet", () => {
  const r = parseContactPayload(
    corps({ message: "a".repeat(LIMITES.valeur + 1) }),
  );
  assert.equal(r.ok, false);
});

test("borne : longueur cumulée dépassée → rejet", () => {
  const gros = {};
  const par = LIMITES.valeur;
  for (let i = 0; i < Math.ceil(LIMITES.total / par) + 1; i++) {
    gros[`c${i}`] = "a".repeat(par);
  }
  assert.equal(parseContactPayload(corps(gros)).ok, false);
});

test("borne : un formulaire humain réaliste passe largement", () => {
  const r = parseContactPayload(
    corps({
      firstName: "Jean",
      lastName: "Dupont",
      company: "ACME",
      phone: "+41 79 000 00 00",
      website: "https://acme.ch",
      linkedin: "https://linkedin.com/in/jd",
      message: "a".repeat(2000),
      budget: "12000",
      sujets: ["n8n", "agents"],
    }),
  );
  assert.equal(r.ok, true);
});

// ---------------------------------------------------------------------------
// L'unique effet : l'envoi du mail. Doublure de transport : `jsonTransport` de
// nodemailer compose le mail sans réseau et le rend en JSON.
// ---------------------------------------------------------------------------

const ENV = {
  ENVOI_HOTE: "smtp.instance.test",
  ENVOI_PORT: "587",
  ENVOI_IDENTIFIANT: "envoi@instance.test",
  ENVOI_MOT_DE_PASSE: "secret-de-test",
  ENVOI_ADRESSE: "envoi@instance.test",
  ENVOI_NOM: "Le site d'AVQN",
  AVQN_DESTINATAIRE: "hello@avqn.ch",
};

/**
 * Doublure de `nodemailer.createTransport` : retient les options SMTP reçues
 * et les mails composés. `echec` fait échouer l'envoi avec ce code.
 */
function doublure({ echec } = {}) {
  const d = { options: [], mails: [] };
  d.creer = (options) => {
    d.options.push(options);
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const sendMail = transport.sendMail.bind(transport);
    transport.sendMail = async (mail) => {
      if (echec) throw Object.assign(new Error("refusé"), { code: echec });
      const info = await sendMail(mail);
      d.mails.push(JSON.parse(info.message));
      return info;
    };
    return transport;
  };
  return d;
}

/** Soumission validée minimale, enrichie au besoin par le test. */
function soumission(extra = {}) {
  const r = parseContactPayload(corps(extra));
  assert.equal(r.ok, true);
  return r.value;
}

test("envoi : un réglage absent → effet sauté, aucun transport, ok faux", async () => {
  for (const cle of Object.keys(ENV).filter((c) => c !== "ENVOI_NOM")) {
    const d = doublure();
    const r = await handleContact(soumission(), { ...ENV, [cle]: "" }, d.creer);
    assert.equal(r.envoi, "skipped", cle);
    assert.equal(r.ok, false);
    assert.equal(d.options.length, 0);
  }
});

test("envoi : un port illisible compte comme absent", async () => {
  const d = doublure();
  const r = await handleContact(
    soumission(),
    { ...ENV, ENVOI_PORT: "smtp" },
    d.creer,
  );
  assert.equal(r.envoi, "skipped");
  assert.equal(d.options.length, 0);
});

test("envoi : destinataire, Reply-To, sujet et corps du mail", async () => {
  const d = doublure();
  const r = await handleContact(
    soumission({ firstName: "Jean", message: "Bonjour,\nune question." }),
    ENV,
    d.creer,
  );
  assert.equal(r.envoi, "envoye");
  assert.equal(r.ok, true);
  assert.equal(d.mails.length, 1);
  const mail = d.mails[0];
  assert.deepEqual(mail.from, {
    address: "envoi@instance.test",
    name: "Le site d'AVQN",
  });
  assert.deepEqual(
    mail.to.map((a) => a.address),
    ["hello@avqn.ch"],
  );
  assert.deepEqual(
    mail.replyTo.map((a) => a.address),
    ["a@b.ch"],
  );
  assert.equal(mail.subject, "[avqn.ch] avqn-contact : a@b.ch");
  assert.equal(
    mail.text,
    "source : avqn-contact\nemail : a@b.ch\nfirstName : Jean\nmessage : Bonjour,\nune question.\n",
  );
});

test("envoi : la source du formulaire est dans le sujet et le corps", async () => {
  const d = doublure();
  await handleContact(soumission({ source: "avqn-bootcamp" }), ENV, d.creer);
  assert.equal(d.mails[0].subject, "[avqn.ch] avqn-bootcamp : a@b.ch");
  assert.match(d.mails[0].text, /^source : avqn-bootcamp\n/);
});

test("envoi : un champ jamais déclaré arrive intact dans le corps", async () => {
  const d = doublure();
  await handleContact(
    soumission({ budget: "12000", sujets: ["n8n", "agents"] }),
    ENV,
    d.creer,
  );
  assert.match(d.mails[0].text, /^budget : 12000$/m);
  assert.match(d.mails[0].text, /^sujets : n8n, agents$/m);
});

test("envoi : un nom d'expéditeur sur plusieurs lignes tient sur une seule", async () => {
  const d = doublure();
  await handleContact(
    soumission(),
    { ...ENV, ENVOI_NOM: "AVQN\r\nBcc: x@y.z" },
    d.creer,
  );
  assert.equal(d.mails[0].from.name, "AVQN Bcc: x@y.z");
});

test("envoi : le port 465 dit TLS d'emblée, un autre port STARTTLS", async () => {
  const d = doublure();
  await handleContact(soumission(), { ...ENV, ENVOI_PORT: "465" }, d.creer);
  await handleContact(soumission(), ENV, d.creer);
  assert.equal(d.options[0].port, 465);
  assert.equal(d.options[0].secure, true);
  assert.equal(d.options[0].requireTLS, false);
  assert.equal(d.options[1].port, 587);
  assert.equal(d.options[1].secure, false);
  assert.equal(d.options[1].requireTLS, true);
  assert.equal(d.options[1].host, "smtp.instance.test");
  assert.deepEqual(d.options[1].auth, {
    user: "envoi@instance.test",
    pass: "secret-de-test",
  });
});

test("envoi : le serveur SMTP refuse → effet failed, ok faux", async () => {
  const d = doublure({ echec: "EAUTH" });
  const r = await handleContact(soumission(), ENV, d.creer);
  assert.equal(r.envoi, "failed");
  assert.equal(r.ok, false);
});

// ---------------------------------------------------------------------------
// Formulaire bootcamp — les quatre champs de préinscription
// (`/bootcamp-ia-suisse`, source `avqn-bootcamp`).
// ---------------------------------------------------------------------------

test("bootcamp : les quatre clés du formulaire arrivent bien dans les données collectées", () => {
  const r = collecter(
    formDataDe([
      ["email", "a@b.ch"],
      ["season", "Le printemps"],
      ["situation", "Je suis indépendant"],
      ["comingWith", "Juste moi"],
      ["message", "Les relances clients qui traînent."],
    ]),
    "avqn-bootcamp",
  );
  assert.equal(r.season, "Le printemps");
  assert.equal(r.situation, "Je suis indépendant");
  assert.equal(r.comingWith, "Juste moi");
  assert.equal(r.message, "Les relances clients qui traînent.");
  assert.equal(r.source, "avqn-bootcamp");
});

test("bootcamp : les deux champs optionnels absents ne cassent rien", () => {
  const r = parseContactPayload(
    corps({
      source: "avqn-bootcamp",
      season: "L'automne",
      situation: "À titre personnel",
    }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.value.champs.season, "L'automne");
  assert.equal(r.value.champs.situation, "À titre personnel");
  assert.equal("comingWith" in r.value.champs, false);
  assert.equal("message" in r.value.champs, false);
});

/** Source de la page bootcamp — les champs y sont composés (aucune logique serveur à eux). */
function sourceBootcamp() {
  return readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "pages",
      "bootcamp-ia-suisse.astro",
    ),
    "utf8",
  );
}

/** Chaque champ composé (`<FieldChoice>`/`<FieldTextarea>`), isolé et indexé par son `name`. */
function champsBootcamp() {
  const source = sourceBootcamp();
  const blocs =
    source.match(/<(FieldText|FieldChoice|FieldTextarea)\b[\s\S]*?\/>/g) ?? [];
  const parNom = new Map();
  for (const bloc of blocs) {
    const nom = bloc.match(/name="([^"]+)"/)?.[1];
    if (nom) parNom.set(nom, bloc);
  }
  return { source, blocs, parNom };
}

test("bootcamp : les quatre champs sont présents, avec les libellés validés au mot près", () => {
  const { parNom } = champsBootcamp();
  for (const nom of ["season", "situation", "comingWith", "message"]) {
    assert.ok(
      parNom.has(nom),
      `le champ « ${nom} » est absent de la page bootcamp`,
    );
  }
  assert.match(
    parNom.get("season"),
    /Vous auriez une préférence entre le printemps et l'automne \?/,
  );
  assert.match(parNom.get("situation"), /C'est dans quel cadre \?/);
  assert.match(parNom.get("comingWith"), /Vous viendriez…/);
  assert.match(
    parNom.get("message"),
    /Qu'est-ce qui vous prend le plus de temps aujourd'hui, et que vous aimeriez confier à l'IA \?/,
  );
});

test("bootcamp : season et situation sont requis, comingWith et message restent optionnels", () => {
  const { parNom } = champsBootcamp();
  assert.match(parNom.get("season"), /\brequired\b/, "season doit être requis");
  assert.match(
    parNom.get("situation"),
    /\brequired\b/,
    "situation doit être requis",
  );
  assert.doesNotMatch(
    parNom.get("comingWith"),
    /\brequired\b/,
    "comingWith doit rester optionnel",
  );
  assert.doesNotMatch(
    parNom.get("message"),
    /\brequired\b/,
    "message doit rester optionnel",
  );
});

test("bootcamp : les options de season, situation et comingWith sont exactement celles validées", () => {
  const { parNom } = champsBootcamp();
  const optionsDe = (bloc) =>
    [...bloc.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);

  assert.deepEqual(optionsDe(parNom.get("season")), [
    "Le printemps",
    "L'automne",
    "Peu importe",
  ]);
  assert.deepEqual(optionsDe(parNom.get("situation")), [
    "Je suis indépendant",
    "Dans mon entreprise ou mon institution",
    "En recherche d'emploi ou en reconversion",
    "À titre personnel",
  ]);
  assert.deepEqual(optionsDe(parNom.get("comingWith")), [
    "Juste moi",
    "Avec un ou deux collègues",
    "Avec une équipe (3 personnes ou plus)",
  ]);
});

test("bootcamp : ordre d'affichage — les deux requis, puis « vous viendriez », puis le champ libre", () => {
  const { blocs } = champsBootcamp();
  const noms = blocs.map((bloc) => bloc.match(/name="([^"]+)"/)?.[1]);
  assert.deepEqual(noms, [
    "firstName",
    "lastName",
    "company",
    "season",
    "situation",
    "comingWith",
    "message",
  ]);
});

test("bootcamp : on sait qui s'inscrit — l'identité est demandée", () => {
  const { source } = champsBootcamp();
  // Sans nom, la routine ne peut ni enquêter sur la personne ni la saluer.
  for (const nom of ["firstName", "lastName", "company"]) {
    assert.ok(
      source.includes(`name="${nom}"`),
      `le champ « ${nom} » doit rester : sans lui, on ne sait pas qui s'inscrit`,
    );
  }
});

test("bootcamp : formulaire resté court — pas de champ de contact secondaire", () => {
  const { source } = champsBootcamp();
  for (const nom of ["phone", "website", "linkedin"]) {
    assert.ok(
      !source.includes(`name="${nom}"`),
      `le champ « ${nom} » alourdit une préinscription sans la servir`,
    );
  }
});

test("bootcamp : les champs ajoutés ne posent aucune question sur le prix ou le niveau technique", () => {
  const { parNom } = champsBootcamp();
  const texte = [...parNom.values()].join("\n").toLowerCase();
  for (const mot of [
    "budget",
    "tarif",
    "prix",
    "niveau technique",
    "niveau de compétence",
    "prérequis",
  ]) {
    assert.ok(
      !texte.includes(mot),
      `mot interdit trouvé dans les champs ajoutés : « ${mot} »`,
    );
  }
});

// ---------------------------------------------------------------------------
// Route publique — les garde-fous au vrai point d'entrée.
// ---------------------------------------------------------------------------

/** Appelle le point d'entrée HTTP, avec une borne de débit neuve par défaut. */
function appeler(
  requete,
  env = {},
  d = doublure(),
  debit = creerBorneDeDebit(),
) {
  return traiterRequete(requete, env, debit, d.creer);
}

/** Une requête JSON vers la route. */
function requete(corpsBrut, entetes = {}) {
  return new Request("https://avqn.ch/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...entetes },
    body: typeof corpsBrut === "string" ? corpsBrut : JSON.stringify(corpsBrut),
  });
}

test("route : email manquant → 400, aucun envoi", async () => {
  const d = doublure();
  const res = await appeler(requete({ source: "avqn-contact" }), ENV, d);
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.ok(res.body.error);
  assert.equal(d.options.length, 0);
});

test("route : source inconnue → 400, aucun envoi", async () => {
  const d = doublure();
  const res = await appeler(
    requete({ source: "autre", email: "a@b.ch" }),
    ENV,
    d,
  );
  assert.equal(res.status, 400);
  assert.equal(d.options.length, 0);
});

test("route : corps plus gros que la borne → 400 sans être traité", async () => {
  const d = doublure();
  const gros = JSON.stringify({
    source: "avqn-contact",
    email: "a@b.ch",
    message: "a".repeat(LIMITES.corps + 10),
  });
  const res = await appeler(requete(gros), ENV, d);
  assert.equal(res.status, 400);
  assert.equal(d.options.length, 0);
});

test("route : content-length annoncé au-delà de la borne → 400", async () => {
  const res = await appeler(
    requete(
      { source: "avqn-contact", email: "a@b.ch" },
      { "content-length": String(LIMITES.corps + 1) },
    ),
  );
  assert.equal(res.status, 400);
});

test("route : corps chunké sans content-length, au-delà de la borne → 400", async () => {
  // Un flux qui n'annonce pas sa taille ne doit jamais être mis en mémoire en entier.
  const morceau = new TextEncoder().encode("a".repeat(8 * 1024));
  let envoyes = 0;
  const flux = new ReadableStream({
    pull(controller) {
      // De quoi dépasser largement la borne si personne ne coupe.
      if (envoyes > 64) return controller.close();
      envoyes++;
      controller.enqueue(morceau);
    },
  });
  const res = await appeler(
    new Request("https://avqn.ch/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: flux,
      duplex: "half",
    }),
  );
  assert.equal(res.status, 400);
  // Le flux a été coupé : on n'a pas lu les 512 Ko annoncés par le producteur.
  assert.ok(
    envoyes * morceau.byteLength <= LIMITES.corps + morceau.byteLength,
    `lecture non bornée : ${envoyes * morceau.byteLength} octets lus`,
  );
});

test("route : sans content-length, un corps sous la borne passe", async () => {
  const utile = new TextEncoder().encode(
    JSON.stringify({ source: "avqn-contact", email: "flux@test.ch" }),
  );
  let envoye = false;
  const flux = new ReadableStream({
    pull(controller) {
      if (envoye) return controller.close();
      envoye = true;
      controller.enqueue(utile);
    },
  });
  const res = await appeler(
    new Request("https://avqn.ch/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: flux,
      duplex: "half",
    }),
    ENV,
  );
  assert.equal(res.status, 200);
});

test("route : JSON illisible → 400", async () => {
  const res = await appeler(requete("{pas du json"));
  assert.equal(res.status, 400);
});

test("route : corps form-urlencoded, clés répétées jointes", async () => {
  const d = doublure();
  const res = await appeler(
    new Request("https://avqn.ch/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "source=avqn-contact&email=a%40b.ch&sujets=n8n&sujets=agents",
    }),
    ENV,
    d,
  );
  assert.equal(res.status, 200);
  assert.match(d.mails[0].text, /^sujets : n8n, agents$/m);
});

test("route : un réglage d'envoi absent → 500 générique, sans détail", async () => {
  const res = await appeler(
    requete({ source: "avqn-contact", email: "a@b.ch" }),
    { ...ENV, AVQN_DESTINATAIRE: undefined },
  );
  assert.equal(res.status, 500);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /hello@avqn\.ch/);
  assert.ok(!/ENVOI|SMTP|DESTINATAIRE/i.test(res.body.error));
});

test("route : envoi en échec → 500, le visiteur n'a pas de détail", async () => {
  const res = await appeler(
    requete({ source: "avqn-contact", email: "a@b.ch" }),
    ENV,
    doublure({ echec: "ETIMEDOUT" }),
  );
  assert.equal(res.status, 500);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /hello@avqn\.ch/);
  assert.ok(!/SMTP|ETIMEDOUT|instance\.test/i.test(res.body.error));
});

test("route : mail envoyé → 200", async () => {
  const d = doublure();
  const res = await appeler(
    requete({ source: "avqn-contact", email: "a@b.ch" }),
    ENV,
    d,
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(d.mails.length, 1);
});

// --- Borne de débit (par l'adresse que Traefik ajoute en dernier) ---

test("débit : l'adresse du visiteur est la dernière de X-Forwarded-For", () => {
  const de = (xff) =>
    adresseDuVisiteur(requete({}, xff ? { "X-Forwarded-For": xff } : {}));
  assert.equal(de("203.0.113.7"), "203.0.113.7");
  assert.equal(de("1.2.3.4, 203.0.113.7"), "203.0.113.7");
  assert.equal(de("1.2.3.4,203.0.113.7 "), "203.0.113.7");
  assert.equal(de(""), "");
});

test("débit : la sixième demande d'une adresse est refusée, une autre adresse passe", async () => {
  const d = doublure();
  const debit = creerBorneDeDebit();
  const corpsValide = { source: "avqn-contact", email: "a@b.ch" };
  // Traefik ajoute l'adresse du visiteur en dernier ; la première est inventée
  // par le visiteur, et change à chaque demande sans rien y changer.
  const de = (adresse, i) =>
    requete(corpsValide, { "X-Forwarded-For": `10.0.0.${i}, ${adresse}` });

  for (let i = 0; i < DEBIT.demandes; i++) {
    const res = await appeler(de("203.0.113.1", i), ENV, d, debit);
    assert.equal(res.status, 200, `demande ${i + 1}`);
  }
  const sixieme = await appeler(de("203.0.113.1", 99), ENV, d, debit);
  assert.equal(sixieme.status, 429);
  const retry = Number(sixieme.headers["Retry-After"]);
  assert.ok(
    retry > 0 && retry <= DEBIT.fenetreMs / 1000,
    `Retry-After ${retry}`,
  );
  assert.equal(sixieme.body.ok, false);
  assert.match(sixieme.body.error, /hello@avqn\.ch/);

  const autre = await appeler(de("198.51.100.2", 0), ENV, d, debit);
  assert.equal(autre.status, 200);
  assert.equal(d.mails.length, DEBIT.demandes + 1);
});

test("débit : une demande refusée par les bornes compte aussi", async () => {
  const debit = creerBorneDeDebit();
  const xff = { "X-Forwarded-For": "203.0.113.1" };
  for (let i = 0; i < DEBIT.demandes; i++) {
    const res = await appeler(
      requete("{pas du json", xff),
      ENV,
      doublure(),
      debit,
    );
    assert.equal(res.status, 400);
  }
  const res = await appeler(
    requete({ source: "avqn-contact", email: "a@b.ch" }, xff),
    ENV,
    doublure(),
    debit,
  );
  assert.equal(res.status, 429);
});

test("débit : la fenêtre close, l'adresse a de nouveau droit à ses demandes", () => {
  const debit = creerBorneDeDebit();
  const t0 = 1_000_000;
  for (let i = 0; i < DEBIT.demandes; i++) {
    assert.equal(debit.accepter("203.0.113.1", t0 + i), 0);
  }
  assert.equal(debit.accepter("203.0.113.1", t0 + DEBIT.fenetreMs - 1000), 1);
  assert.equal(debit.accepter("203.0.113.1", t0 + DEBIT.fenetreMs), 0);
});

test("débit : une IPv6 compte par son préfixe /64, une IPv4 entière", () => {
  assert.equal(cleDeDebit("203.0.113.1"), "203.0.113.1");
  assert.equal(cleDeDebit("::ffff:203.0.113.1"), "203.0.113.1");
  assert.equal(cleDeDebit("2001:db8:1:2::1"), "2001:db8:1:2::/64");
  assert.equal(
    cleDeDebit("2001:0DB8:0001:0002:aaaa:bbbb:cccc:dddd"),
    "2001:db8:1:2::/64",
  );
  assert.equal(cleDeDebit("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(cleDeDebit("::1"), "0:0:0:0::/64");
  assert.notEqual(cleDeDebit("2001:db8:1:2::1"), cleDeDebit("2001:db8:1:3::1"));
});

test("débit : une IPv6 qui change d'adresse dans son /64 reste bornée", async () => {
  const d = doublure();
  const debit = creerBorneDeDebit();
  const corpsValide = { source: "avqn-contact", email: "a@b.ch" };
  for (let i = 0; i <= DEBIT.demandes; i++) {
    const res = await appeler(
      requete(corpsValide, { "X-Forwarded-For": `2001:db8:1:2::${i + 1}` }),
      ENV,
      d,
      debit,
    );
    assert.equal(
      res.status,
      i < DEBIT.demandes ? 200 : 429,
      `demande ${i + 1}`,
    );
  }
});

test("débit : au-delà des adresses suivies, une nouvelle attend, la mémoire reste bornée", () => {
  const debit = creerBorneDeDebit();
  const t0 = 1_000_000;
  for (let i = 0; i < DEBIT.adresses; i++) {
    assert.equal(debit.accepter(`a${i}`, t0), 0);
  }
  // Toutes les fenêtres sont ouvertes : une adresse nouvelle attend.
  assert.ok(debit.accepter("nouvelle", t0 + 1) > 0);
  // Une adresse déjà suivie garde son compte.
  assert.equal(debit.accepter("a0", t0 + 1), 0);
  // Les fenêtres fermées, la place se libère.
  assert.equal(debit.accepter("nouvelle", t0 + DEBIT.fenetreMs), 0);
});

test("redirections exactes → cible finale", () => {
  assert.equal(resolveRedirect("/contact/audit"), "/contact");
  assert.equal(resolveRedirect("/contact/bootcamp-entreprise"), "/contact");
  assert.equal(resolveRedirect("/audit-offert"), "/contact");
  assert.equal(resolveRedirect("/n8n"), "/n8n-suisse");
  assert.equal(resolveRedirect("/en"), "/");
});

test("slash final toléré", () => {
  assert.equal(resolveRedirect("/contact/audit/"), "/contact");
});

test("redirections par préfixe (rebase ou page unique)", () => {
  assert.equal(
    resolveRedirect("/services-automatisation-ia-n8n-suisse-romande/strategie"),
    "/consultant-ia-suisse-romande",
  );
  assert.equal(
    resolveRedirect("/services-automatisation-ia-n8n-suisse-romande/inconnu"),
    "/services",
  );
  assert.equal(resolveRedirect("/n8n/quest-ce-que-n8n"), "/n8n-suisse");
  assert.equal(resolveRedirect("/collaboration/whatsapp-ai"), "/n8n-suisse");
});

test("refonte 2026 : rubriques thématiques", () => {
  assert.equal(resolveRedirect("/construire-avec-ia"), "/claude-code-suisse");
  assert.equal(
    resolveRedirect("/construire-avec-ia/quest-ce-que-claude-code"),
    "/claude-code-suisse",
  );
  assert.equal(
    resolveRedirect("/construire-avec-ia/creer-agent-ia"),
    "/agents-ia",
  );
  assert.equal(resolveRedirect("/services/integration"), "/agents-ia");
  assert.equal(resolveRedirect("/services/formation"), "/bootcamp-ia-suisse");
  assert.equal(
    resolveRedirect("/services/strategie"),
    "/consultant-ia-suisse-romande",
  );
  assert.equal(
    resolveRedirect("/services/formation/coaching"),
    "/coaching-ia-independant-suisse",
  );
  assert.equal(
    resolveRedirect("/services/formation/equipe"),
    "/formation-ia-entreprise-suisse",
  );
  assert.equal(
    resolveRedirect("/claude-code/coaching"),
    "/coaching-ia-independant-suisse",
  );
  assert.equal(
    resolveRedirect("/claude-code/equipe"),
    "/formation-ia-entreprise-suisse",
  );
  assert.equal(resolveRedirect("/n8n-suisse/bootcamp"), "/bootcamp-ia-suisse");
});

test("refonte 2026 : le pilier Claude Code et ses guides", () => {
  assert.equal(resolveRedirect("/claude-code"), "/claude-code-suisse");
  assert.equal(
    resolveRedirect("/claude-code/quest-ce-que-claude-code"),
    "/claude-code-suisse",
  );
  assert.equal(
    resolveRedirect("/claude-code/creer-application-sans-coder"),
    "/claude-code-suisse",
  );
  // Le filet de préfixe couvre tout chemin non listé sous l'ancien pilier…
  assert.equal(resolveRedirect("/claude-code/inconnu"), "/claude-code-suisse");
  // …sans masquer les entrées exactes des offres déplacées.
  assert.equal(
    resolveRedirect("/claude-code/coaching"),
    "/coaching-ia-independant-suisse",
  );
  assert.equal(resolveRedirect("/agents-ia/creer-agent-ia"), "/agents-ia");
});

test("cocon cas-usage : exception Vetmint avant la règle générale", () => {
  assert.equal(resolveRedirect("/cas-usage"), "/n8n-suisse");
  assert.equal(resolveRedirect("/cas-usage/prospection"), "/n8n-suisse");
  assert.equal(
    resolveRedirect(
      "/cas-usage/reporting/vetmint-dashboard-cliniques-veterinaires",
    ),
    "/expert-ia-suisse",
  );
});

test("chemin inconnu → pas de redirection", () => {
  assert.equal(resolveRedirect("/a-propos"), null);
  assert.equal(resolveRedirect("/services"), null);
  assert.equal(resolveRedirect("/this-does-not-exist"), null);
});

// ---------------------------------------------------------------------------
// Invariants de la table de redirections (garde anti-régression de refonte)
// ---------------------------------------------------------------------------

/**
 * Chemin final représenté par une cible : une cible « rebasée » (préfixe
 * finissant par `/`) désigne la page du même nom sans slash.
 */
function finalPath(target) {
  return target.length > 1 && target.endsWith("/")
    ? target.slice(0, -1)
    : target;
}

/** Toutes les cibles déclarées dans la table (exactes + préfixes). */
function allTargets() {
  return [
    ...Object.values(EXACT_REDIRECTS),
    ...PREFIX_REDIRECTS.map((r) => r.target),
  ];
}

test("aucune chaîne : une cible n'est jamais elle-même redirigée", () => {
  for (const target of allTargets()) {
    const path = finalPath(target);
    assert.equal(
      resolveRedirect(path),
      null,
      `chaîne de redirection : « ${path} » est à la fois cible et source`,
    );
  }
});

/** Routes statiques réellement présentes dans `src/pages/`. */
function existingRoutes() {
  const pagesDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "pages",
  );
  const routes = new Set();
  function walk(dir, base) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, `${base}/${entry.name}`);
        continue;
      }
      // Routes dynamiques et endpoints non-HTML hors périmètre.
      if (entry.name.startsWith("[")) continue;
      if (!entry.name.endsWith(".astro")) continue;
      const name = entry.name.replace(/\.astro$/, "");
      routes.add(name === "index" ? base || "/" : `${base}/${name}`);
    }
  }
  walk(pagesDir, "");
  return routes;
}

test("toute cible de redirection correspond à une route existante", () => {
  const routes = existingRoutes();
  for (const target of allTargets()) {
    const path = finalPath(target);
    assert.ok(
      routes.has(path),
      `cible orpheline : « ${path} » n'existe pas dans src/pages/`,
    );
  }
});
