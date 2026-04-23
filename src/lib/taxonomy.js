export const continentMeta = {
  "Viral Tools": {
    color: "#d98c4e",
    tagline: "Fast to ship, fast to spread",
    description:
      "Fast to adopt, easy to show to other people, often spread through immediate usefulness.",
  },
  Infrastructure: {
    color: "#819f88",
    tagline: "Slow to bloom, load-bearing",
    description:
      "Foundational systems, frameworks, and tools that support a lot of downstream work.",
  },
  Utility: {
    color: "#c9b07d",
    tagline: "Small, sharp, everywhere",
    description:
      "Smaller practical tools that fit into personal workflows without becoming broad platforms.",
  },
  Learning: {
    color: "#d8cfc0",
    tagline: "Docs and curricula",
    description:
      "Repos that teach, document, or help people enter a field through examples and guides.",
  },
  Creative: {
    color: "#b48b73",
    tagline: "Tools for making",
    description:
      "Tools oriented toward expression, experimentation, or making media, art, games, and interfaces.",
  },
  Startup: {
    color: "#d6a26c",
    tagline: "The gold rush belt",
    description:
      "Product-minded tools that package a bigger workflow or business use case into something usable.",
  },
  "Ambitious but Obscure": {
    color: "#9e9787",
    tagline: "Vast, few roads",
    description:
      "Strong ideas and deeper commitments, but with smaller audiences or more specialized appeal.",
  },
  "Developer Experience": {
    color: "#8f7fa8",
    tagline: "Friction, reduced",
    description:
      "Tools that reduce developer friction through better workflows, packaging, automation, and local tooling.",
  },
  "Data & AI": {
    color: "#7b9baa",
    tagline: "Models, pipelines, inference",
    description:
      "Projects centered on data pipelines, ML systems, model tooling, search, inference, and analytics.",
  },
  "Security & Privacy": {
    color: "#7e8c73",
    tagline: "Hardening the commons",
    description:
      "Libraries and platforms for protecting systems, identities, secrets, networks, and user data.",
  },
  "Scientific Computing": {
    color: "#8d8db4",
    tagline: "Research and simulation",
    description:
      "Research and numerical computing tools used for simulation, statistics, optimization, and reproducible science.",
  },
  "Community Knowledge": {
    color: "#b09478",
    tagline: "Standards and memory",
    description:
      "Documentation ecosystems, standards, educational content, and community-maintained reference projects.",
  },
  "Protocols & Networks": {
    color: "#78938e",
    tagline: "Coordination layers",
    description:
      "Projects focused on internet protocols, distributed systems, networking primitives, and coordination layers.",
  },
};

export function getContinent(repo) {
  return (
    repo?.taxonomy?.continent ||
    repo?.classification?.continent ||
    repo?.classification?.island ||
    "Unclassified"
  );
}

export function normalizeRepo(repo, index) {
  const continent = getContinent(repo);

  return {
    ...repo,
    id:
      repo.id ||
      repo.repo_full_name?.replace("/", "-").toLowerCase() ||
      `${repo.name.toLowerCase().replace(/\s+/g, "-")}-${index}`,
    taxonomy: {
      ...repo.taxonomy,
      continent,
      country: repo.taxonomy?.country || repo.classification?.country || null,
      state: repo.taxonomy?.state || repo.classification?.state || null,
    },
    classification: {
      ...repo.classification,
      continent,
      island: continent,
    },
  };
}
