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
      "TanStack Table",
      "Three.js",
      "WebGL",
      "Mantine",
      "Material UI",
      "Sass",
      "Tailwind CSS",
      "Vite",
      "Storybook",
    ],
  },
  {
    name: "Backend & Integration",
    skills: [".NET", "C#", "Node.js", "REST APIs", "JWT", "n8n", "Oracle JD Edwards"],
  },
  {
    name: "Mobile",
    skills: ["React Native", "Expo", "Flutter", "React Navigation", "EAS Build"],
  },
  {
    name: "Data & Documents",
    skills: [
      "KSeF",
      "XML",
      "XSLT",
      "PDF workflows",
      "JSON",
      "Document AI",
      "dynamic forms",
    ],
  },
  {
    name: "Delivery",
    skills: [
      "GitHub Actions",
      "CI/CD",
      "npm publishing",
      "Vitest",
      "Testing Library",
      "Playwright",
      "accessibility testing",
    ],
  },
];
