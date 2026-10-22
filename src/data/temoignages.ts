/**
 * Corpus des témoignages clients — source unique du site.
 *
 * Les verbatims sont reproduits tels qu'ils ont été reçus : sélection et ordre
 * se pilotent depuis les pages, la réécriture est interdite.
 */

export interface Temoignage {
  /** Identifiant stable, utilisé pour référencer un témoignage depuis une page. */
  id: string;
  name: string;
  role: string;
  company?: string;
  content: string;
  image?: string;
  imageAlt?: string;
  /** Verbatim court mis en avant d'un cran dans le carrousel. */
  isBold?: boolean;
}

/** Une citation prête à afficher : le texte et sa ligne d'attribution. */
export interface Citation {
  texte: string;
  attribution: string;
}

export const temoignages: Temoignage[] = [
  {
    id: "olivier-dommange",
    name: "Olivier Dommange",
    role: "Responsable de programme",
    company: "Emploi Lausanne",
    content:
      "Grâce à Emmanuel, nous avons développé nos compétences en automatisation et structuré une infrastructure adaptée à notre IA. Son accompagnement, clair et personnalisé, a été une réelle opportunité.",
    image:
      "https://cdn.avqn.ch/images/temoignage-olivier-dommange-emploi-lausanne-automatisation-ia-n8n-lausanne.webp",
    imageAlt:
      "Olivier Dommange, responsable de programme chez Emploi Lausanne — témoignage accompagnement automatisation et IA avec AVQN",
    isBold: true,
  },
  {
    id: "sebastien-debatty",
    name: "Sébastien Debatty",
    role: "Directeur",
    company: "Groupe Vetmint",
    content:
      "Pour piloter efficacement nos différents sites, nous avions besoin d'automatiser l'analyse de nos chiffres (qui se faisait jusqu'ici site par site et mois par mois). Après une formation N8N très claire, très pratique et créée en fonction de nos besoins spécifiques, nous avons pu, entre autres, co-construire un dashboard très performant en seulement quelques heures. Durant nos échanges, Emmanuel s'est montré remarquablement réactif, très à l'écoute et a rapidement saisi nos enjeux, rendant le processus de co-création fluide et efficace. Je dispose aujourd'hui d'un outil clair et évolutif, ainsi que des compétences pour le faire évoluer en totale autonomie selon mes besoins.",
    image:
      "https://cdn.avqn.ch/images/temoignage-sebastien-debatty-vetmint-formation-n8n-lausanne.webp",
    imageAlt:
      "Sébastien Debatty, directeur du groupe Vetmint — témoignage formation n8n et dashboard automatisé avec AVQN",
  },
  {
    id: "sebastian-haag",
    name: "Sebastian Haag",
    role: "Business Strategist",
    company: "Liip",
    content:
      "L'accompagnement d'Emmanuel m'a permis d'automatiser des pipelines de données stratégiques et de gagner un temps précieux. Pédagogue et efficace, je recommande vivement. ",
    image:
      "https://cdn.avqn.ch/images/temoignage-sebastian-haag-liip-automatisation-ia-n8n-lausanne.webp",
    imageAlt:
      "Sebastian Haag, business strategist chez Liip — témoignage accompagnement automatisation IA et n8n, Lausanne",
    isBold: true,
  },
  {
    id: "serge-reymond",
    name: "Serge Reymond",
    role: "Co-fondateur",
    company: "Vetcoop SA",
    content:
      "Pas de grandes théories mais une formation avec les opérationnels sur les besoins immédiats et concrets de l'entreprise. Des progrès rapides et mesurables et une appropriation rapide de l'outil par les équipes. ",
    image:
      "https://cdn.avqn.ch/images/temoignage-serge-reymond-vetcoop-automatisation-ia-n8n-lausanne.webp",
    imageAlt:
      "Serge Reymond, co-fondateur de Vetcoop SA — témoignage sur la formation et l'automatisation IA avec AVQN à Lausanne",
    isBold: true,
  },
  {
    id: "antoine-aigroz",
    name: "Antoine Aigroz",
    role: "Responsable secteur",
    company: "Ville de Lausanne",
    content:
      "Certains craignent l'automatisation, la seule chose que craint Manu c'est le temps perdu. Si vous aimez les tâches répétitives, fuyez-le!",
    image:
      "https://cdn.avqn.ch/images/temoignage-antoine-aigroz-ville-de-lausanne-automatisation-ia-n8n-lausanne.webp",
    imageAlt:
      "Antoine Aigroz, responsable secteur à la Ville de Lausanne — témoignage sur l'automatisation avec AVQN",
    isBold: true,
  },
  {
    id: "ewen-kerharo",
    name: "Ewen Kerharo",
    role: "Vétérinaire directeur",
    company: "Groupe Vetmint",
    content:
      "Quand AVQN nous a proposé de nous accompagner sur l'automatisation et les solutions n8n, nous partions de zéro. En quelques semaines, nous étions capables d'appliquer des procédures efficacement et d'en créer de nouvelles en toute autonomie. Contrairement à d'autres prestataires qui nous auraient rendu captifs de leurs services, Emmanuel nous a formés pour voler de nos propres ailes. Un vrai partenaire pour les entreprises qui veulent prendre le virage de l'IA et de l'automatisation.",
    image:
      "https://cdn.avqn.ch/images/temoignage-ewen-kerharo-vetmint-automatisation-ia-n8n-lausanne.webp",
    imageAlt:
      "Ewen Kerharo, vétérinaire directeur du groupe Vetmint — témoignage accompagnement n8n et automatisation avec AVQN",
  },
  {
    id: "emilien-coutard",
    name: "Emilien Coutard",
    role: "Ingénieur System",
    content:
      "J'ai découvert n8n et le potentiel de l'automatisation grâce à la formation d'Emmanuel, suivie sur plusieurs demi-journées. La formation alliait une partie théorique claire à une forte mise en pratique, favorisant l'apprentissage par l'expérience. Nous avons notamment exploré l'identification des tâches automatisables, la connexion à des applications web et à des API, ainsi que l'intégration d'agents IA. J'ai particulièrement apprécié sa pédagogie, sa sympathie et son envie de transmettre son savoir, qui m'ont permis d'appliquer concrètement ces nouvelles compétences à un projet personnel.",
    image:
      "https://cdn.avqn.ch/images/temoignage-emilien-coutard-formation-n8n-lausanne-suisse-romande.webp",
    imageAlt:
      "Emilien Coutard — témoignage sur la formation n8n et automatisation IA avec Emmanuel Bernard à Lausanne",
  },
  {
    id: "christopher",
    name: "Christopher",
    role: "Participant du bootcamp",
    content:
      "Avant la formation d'Emmanuel, je ne connaissais tout simplement pas N8N. Et franchement, ça a été une belle découverte! Ce qui m'a le plus marqué, c'est de réaliser qu'on peut automatiser pratiquement n'importe quoi; des tâches qui prenaient du temps deviennent soudainement triviales. La formation était claire, bien rythmée, et surtout très concrète. Je suis ressorti avec l'envie d'aller plus loin et d'intégrer N8N dans mes propres projets. Je recommande sans hésiter!",
    image: undefined,
    imageAlt:
      "Christopher, participant au bootcamp Automatisation IA et n8n — témoignage AVQN Lausanne",
  },
  {
    id: "felix-sandri",
    name: "Félix Sandri",
    role: "Encadrant audiovisuel",
    company: "Ville de Lausanne",
    content:
      "Emmanuel m'a fait entrer dans le monde de l'IA avec douceur et intelligence. Nos échanges m'ont permis de mieux appréhender une technologie qui peut être effrayante parfois, et fascinante en même temps. Son professionnalisme, sa bienveillance, et son envie de partager sont contagieux !",
    image:
      "https://cdn.avqn.ch/images/temoignage-felix-sandri-ville-de-lausanne-automatisation-ia-n8n-lausanne.webp",
    imageAlt:
      "Félix Sandri, encadrant audiovisuel à la Ville de Lausanne — témoignage sur l'IA et l'accompagnement AVQN",
  },
];

/** Ligne d'attribution d'un témoignage réel : « Nom — Rôle, Entreprise ». */
export function attribution(temoignage: Temoignage): string {
  return temoignage.company
    ? `${temoignage.name} — ${temoignage.role}, ${temoignage.company}`
    : `${temoignage.name} — ${temoignage.role}`;
}

/** Le témoignage portant cet identifiant. Lève si l'identifiant est inconnu. */
export function temoignage(id: string): Temoignage {
  const trouve = temoignages.find((item) => item.id === id);
  if (!trouve) throw new Error(`Témoignage inconnu : ${id}`);
  return trouve;
}

/** Citation prête à afficher, à partir de l'identifiant d'un témoignage réel. */
export function citation(id: string): Citation {
  const source = temoignage(id);
  return { texte: source.content, attribution: attribution(source) };
}
