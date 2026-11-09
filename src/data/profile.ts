import type { ContactMethod } from "../analytics/analytics";

export const email = "corashina@gmail.com";
export const cvUrl = "/tomasz_zielinski.pdf";

export type ProfileLink = {
  method: ContactMethod;
  label: string;
  href: string;
};

export const emailLink: ProfileLink = { method: "email", label: "Email", href: `mailto:${email}` };
export const cvLink: ProfileLink = { method: "cv", label: "Download CV (PDF)", href: cvUrl };
export const linkedInLink: ProfileLink = {
  method: "linkedin",
  label: "LinkedIn",
  href: "https://www.linkedin.com/in/tomasz-zielinski-a97999161/",
};
export const gitHubLink: ProfileLink = {
  method: "github",
  label: "GitHub",
  href: "https://github.com/corashina",
};

export const primaryLinks: readonly ProfileLink[] = [cvLink, emailLink, linkedInLink, gitHubLink];

export type ExperienceEntry = {
  title: string;
  organisation: string;
  period: string;
};

export const experience: readonly ExperienceEntry[] = [
  { title: "Full-Stack Developer", organisation: "Xelto", period: "2024–2026" },
  { title: "Frontend Developer", organisation: "Xelto", period: "2020–2024" },
  { title: "BSc Computer Science", organisation: "University of Southampton", period: "2017–2020" },
];

export type ToolkitGroup = {
  title: string;
  technologies: readonly string[];
};

// Mirrors the Technologies section of the CV (scripts/full_stack_cv_content.py).
export const toolkitGroups: readonly ToolkitGroup[] = [
  {
    title: "Frontend",
    technologies: [
      "React",
      "TypeScript",
      "JavaScript",
      "Redux Toolkit",
      "TanStack Query",
      "Tailwind CSS",
      "React Native/Expo",
      "Flutter",
    ],
  },
  { title: "Backend", technologies: ["C#", ".NET", "Node.js", "REST APIs", "JWT"] },
  { title: "Integrations", technologies: ["Oracle JD Edwards", "KSeF", "XSLT/XML", "n8n"] },
  { title: "Testing", technologies: ["Playwright", "Vitest", "React Testing Library"] },
  { title: "Delivery", technologies: ["GitHub Actions", "CI/CD", "npm packages", "Vite"] },
];

export type FeaturedProject = {
  slug: string;
  title: string;
  evidence: string;
};

export const featuredProjects: readonly FeaturedProject[] = [
  {
    slug: "xelcode",
    title: "Xelcode",
    evidence:
      "React scanner apps for warehouses and production lines, deployed at 12 client companies and integrated with Oracle JD Edwards.",
  },
  {
    slug: "icr",
    title: "Doc AI",
    evidence:
      "The interface where users upload PDFs, configure extraction prompts and review the structured JSON results.",
  },
  {
    slug: "einvoicing",
    title: "eInvoicing",
    evidence:
      "Screens for Polish e-invoicing (KSeF) integration rules, logs and PDF/XML invoice views, with XSLT rendering of invoice XML.",
  },
];

// schema.org Person for the home page (written into dist/index.html at build time).
export const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Tomasz Zielinski",
  jobTitle: "Full-stack developer",
  url: "https://www.tomasz-zielinski.com/",
  email: `mailto:${email}`,
  sameAs: [
    gitHubLink.href,
    linkedInLink.href,
    "https://stackoverflow.com/users/7306664/corashina",
    "https://x.com/corashina",
  ],
  alumniOf: { "@type": "CollegeOrUniversity", name: "University of Southampton" },
  knowsAbout: ["React", "TypeScript", ".NET", "C#", "Node.js", "React Native", "Oracle JD Edwards", "KSeF"],
};
