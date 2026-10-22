# site-avqn

Le site d'AVQN, `https://www.avqn.ch` : Astro 5 en rendu hybride, servi par le
runtime Node d'Astro (adapter `@astrojs/node` standalone). Les pages sont
prérendues ; trois routes tournent à la demande : `/api/contact` (le
formulaire), `/healthz.json` (la santé) et `[...catchall]` (les vrais 301, table
dans `src/lib/redirects.ts`).

`avqn.ch` et `www.avqn.ch` servent tous deux le site ; toutes les pages portent
la canonique vers `www` (`astro.config.mjs`, clé `site`). Les témoignages, le
logo et l'image de partage viennent de `cdn.avqn.ch` ; les autres images et les
polices sont dans `public/`.

## Construire et lancer

Le `Dockerfile` à la racine construit l'image seul, sans argument ni secret :
il rejoue `check:all` et `test:unit`, construit le site, vérifie les pages clés
du `dist/` ; rouge, pas d'image.

```bash
docker build -t site-avqn .
docker run --rm -p 4321:4321 -e ENVOI_HOTE=… -e AVQN_DESTINATAIRE=… site-avqn
```

- Port écouté : **4321**.
- Santé : `GET /healthz.json` répond `200 {"ok":true,"sha":"…"}`. Le `sha` est
  l'argument de build facultatif `GIT_SHA`, vide sans lui.

Sur le serveur d'AVQNOS, Coolify construit l'image à un commit de ce dépôt
(build pack Dockerfile), et le kit d'Indos pose les variables ci-dessous, le
mot de passe depuis le coffre du serveur.

## Les variables

Le formulaire de contact les lit au moment de l'envoi. Toutes sont requises,
sauf `ENVOI_NOM` ; qu'une seule manque, `/api/contact` répond une erreur
générique qui renvoie à `hello@avqn.ch`, et rien ne part.

- `ENVOI_HOTE` : l'hôte SMTP du compte d'envoi.
- `ENVOI_PORT` : son port. 465 parle TLS d'emblée ; tout autre port exige
  STARTTLS, sauf vers `localhost`, `127.0.0.1` ou `::1`.
- `ENVOI_IDENTIFIANT` : l'identifiant de connexion SMTP.
- `ENVOI_MOT_DE_PASSE` : le mot de passe de ce compte (secret).
- `ENVOI_ADRESSE` : l'adresse d'expédition des mails.
- `ENVOI_NOM` : facultatif, le nom affiché devant cette adresse.
- `AVQN_DESTINATAIRE` : la boîte qui reçoit les demandes, `hello@avqn.ch`.

## Le formulaire

`/contact` et `/bootcamp-ia-suisse` postent sur `/api/contact`. La route borne
le corps, valide l'adresse, refuse toute source hors de l'ensemble fermé de
`src/lib/contact.ts`, puis envoie un mail et répond ; elle ne garde rien.

Le mail part de `ENVOI_NOM <ENVOI_ADRESSE>` vers `AVQN_DESTINATAIRE`, avec
l'adresse du visiteur en `Reply-To`. Son sujet est `[avqn.ch] <source> :
<email>`, son texte un champ par ligne.

Chaque adresse de visiteur a droit à cinq demandes par heure, comptées en
mémoire ; la sixième reçoit un `429`. L'adresse est la dernière de
`X-Forwarded-For`, celle qu'ajoute le proxy devant le site.

## Travailler dessus

**pnpm**, épinglé par `packageManager`.

```bash
pnpm install
pnpm run dev              # http://localhost:4321
pnpm run check:all        # astro check + eslint + prettier
pnpm run test:unit        # formulaire, envoi, borne de débit, redirections
pnpm run build
```

La charte est recopiée dans `src/styles/charte/` (`tokens.css`,
`quadrillage.css`) : le site ne code aucune couleur, il lit les rôles. Les
icônes sont Solar, dessinées au build par `src/lib/icone.ts` depuis
`@iconify-json/solar` ; Solar, par 480 Design, est sous licence CC BY 4.0, et le
crédit est au pied du site.
