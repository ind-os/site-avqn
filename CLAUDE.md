# Le site

Tu aides une personne à faire évoluer son site. Elle n'est pas développeuse.

- Parle-lui en français, en phrases courtes, sans jargon.
- Dis ce que tu vas faire avant de le faire, et ce que ça change pour elle.
- Fais les commandes toi-même. Ne lui demande un geste que s'il touche un mot de passe ou une connexion.
- Ne lui demande jamais un mot de passe et n'en tape jamais un.

## Ce qu'il y a dans ce dossier

- `src/pages/index.astro` : la page d'accueil.
- `src/pages/` : une page par fichier. `src/pages/expert-ia-suisse.astro` devient l'adresse `/expert-ia-suisse`, `src/pages/contact/index.astro` l'adresse `/contact`.
- `src/components/` et `src/layouts/` : les blocs et la mise en page communs aux pages.
- `src/lib/redirects.ts` : les redirections d'une ancienne adresse vers une nouvelle.
- `public/` : les images et les fichiers servis tels quels. `public/favicon.svg` devient l'adresse `/favicon.svg`.

Ne modifie pas `Dockerfile` ni `src/pages/healthz.json.ts` : ils servent à publier le site. `src/styles/charte/` est une copie de la charte d'AVQN : ne la modifie pas non plus. `.github/` et `.claude/` te sont fermés.

## Les gestes

Quatre gestes, dans l'ordre : préparer l'ordinateur, une fois ; puis, à chaque modification, prévisualiser, publier, et parfois revenir à une version d'avant.

### 1. Préparer l'ordinateur

À faire une fois, et chaque fois qu'une commande ci-dessous manque.

1. Vérifie les outils, sans rien installer :

       node --version        # 22.23.4 ou plus récent
       pnpm --version        # 10 ou plus récent
       git --version
       gh --version
       gh auth status
       git config user.name
       git config user.email

2. Dis à la personne, en une courte liste, ce qui manque. S'il ne manque rien, passe à l'étape 6.
3. Sur un Mac, installe ce qui manque par Homebrew.
   - Si `brew --version` échoue, Homebrew manque. Donne à la personne cette ligne, à coller dans l'app Terminal :

         /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

     Dis-lui que le Mac va lui demander le mot de passe de sa session, qu'elle le tape elle-même, et que rien ne s'affiche pendant qu'elle tape. À la fin, Homebrew affiche deux ou trois lignes « Next steps » : elle les colle aussi dans le Terminal. Attends qu'elle te dise que c'est fini.
   - Puis installe toi-même ce qui manque : `brew install node pnpm git gh`. Un outil trop ancien se met à jour par `brew upgrade <outil>`.
4. Sur Windows, installe ce qui manque par `winget install OpenJS.NodeJS.LTS Git.Git GitHub.cli`, puis `npm install --global pnpm@10`. Si Windows demande une autorisation, c'est la personne qui l'accepte. Rouvre ensuite le terminal pour que les commandes soient trouvées.
5. Si `gh auth status` dit qu'elle n'est pas connectée, donne-lui cette ligne, à taper dans le Terminal :

       gh auth login --hostname github.com --git-protocol https --web

   Elle répond « Yes » à la question sur Git, puis copie le code affiché dans la page de GitHub qui s'ouvre. Vérifie ensuite par `gh auth status`.
6. Si `git config user.name` ou `git config user.email` est vide, demande-lui son nom et l'adresse mail de son compte GitHub, puis pose-les :

       git config --global user.name "<son nom>"
       git config --global user.email "<son adresse>"

7. Installe les dépendances du site : `pnpm install`.

### 2. Prévisualiser

La personne voit sa modification sur son ordinateur avant de la publier. Le site en ligne ne change pas.

1. Si `node_modules/` manque, ou si `package.json` a changé, lance `pnpm install`.
2. Lance `pnpm dev` en arrière-plan : le serveur de prévisualisation tourne tant que la commande n'est pas arrêtée.
3. Donne-lui l'adresse à ouvrir dans son navigateur : `http://localhost:4321`. Chaque fichier enregistré s'y voit aussitôt.
4. Arrêter la commande arrête la prévisualisation.

En local, le formulaire de contact n'envoie rien : il répond une erreur qui renvoie à `hello@avqn.ch`. C'est normal ; en ligne, il envoie.

Fais la modification qu'elle demande, puis dis-lui où la regarder.

### 3. Publier

Seulement quand la personne le demande (« publie »), après avoir vu la modification en local.

1. Vérifie le site : `pnpm run check:all`, puis `pnpm run test:unit`. La publication refait ces vérifications et s'arrête si l'une échoue. Une mise en forme refusée se corrige par `pnpm run format` ; une autre erreur nomme le fichier en cause : corrige-la, montre la correction en local, puis recommence.
2. Montre ce qui va partir : `git status`, et dis-le en mots simples.
3. Reprends ce qui a pu être publié depuis un autre ordinateur : `git pull --rebase origin main`.
4. Enregistre la modification avec un message clair, en français, qui dit ce qui change sur le site :

       git add -A
       git commit -m "La page d'accueil a un nouveau titre"

5. Publie : `git push origin main`.
6. Suis la publication jusqu'au bout. Trouve le numéro du workflow lancé par ce commit :

       gh run list --workflow publier.yml --commit "$(git rev-parse HEAD)" --json databaseId --jq '.[0].databaseId'

   S'il ne rend rien, attends quelques secondes et recommence. Puis suis-le :

       gh run watch <numéro> --exit-status

7. Vert : le site en ligne montre la modification. Son adresse : `gh variable get SITE_ADRESSE`. Donne-la à la personne.
8. Si le journal dit « Rien n'est publié », le site n'est pas encore installé sur son serveur : dis-le à la personne. Rien n'est cassé.
9. Rouge : lis ce qui a échoué, `gh run view <numéro> --log-failed`, et explique-le simplement.
   - Si la construction du site a échoué, la cause est la modification : corrige-la, vérifie-la en local, puis publie de nouveau.
   - Si l'attente du site en ligne a échoué, le site en ligne n'a pas repris la modification. Dis à la personne de prévenir la personne qui s'occupe de son serveur.

Ne publie qu'une chose à la fois : attends la fin d'une publication avant la suivante.

### 4. Revenir à une version d'avant

Quand la personne veut retrouver le site d'avant une modification.

1. Montre les dernières modifications : `git log --oneline -10`. Dis chacune en mots simples, avec sa date (`git log -10 --format="%h %ad %s" --date=short`).
2. Demande-lui laquelle annuler.
3. Annule-la par un nouveau commit : `git revert --no-edit <commit>`. Pour en annuler plusieurs, annule-les une par une, de la plus récente à la plus ancienne.
4. Montre-lui le résultat en local (geste 2), puis publie (geste 3).

L'historique ne se réécrit jamais : ni `git reset` sur une modification déjà publiée, ni poussée forcée.

## Les règles

- Aucun mot de passe, jeton ou clé dans les fichiers du site : tout ce qui est dans ce dossier peut être lu par tous.
- Une modification se voit en local avant d'être publiée.
- En cas de doute sur ce que veut la personne, demande-lui avant de modifier.
