export interface SkillGroup {
  name: string;
  skills: readonly string[];
}

export const skillGroups: readonly SkillGroup[] = [
  {
    name: "Frontend",
    skills: [
      "TypeScript",
      "JavaScript",
      "React",
      "Redux Toolkit",
      "TanStack Query",
      "Three.js",
      "WebGL",
      "Material UI",
      "Mantine",
      "Sass",
      "Tailwind CSS",
      "Vite",
    ],
  },
  {
    name: "Backend & Integration",
    skills: [".NET", "C#", "Node.js", "REST APIs", "JWT", "n8n", "Oracle JD Edwards"],
  },
  {
    name: "Mobile",
    skills: ["React Native", "Expo", "Flutter"],
  },
  {
    name: "Data & Documents",
    skills: ["KSeF", "XML", "XSLT", "PDF workflows", "JSON", "Document AI"],
  },
  {
    name: "Delivery",
    skills: ["GitHub Actions", "CI/CD", "npm publishing", "Vitest", "Testing Library"],
  },
];
