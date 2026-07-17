import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { HomePage } from "./HomePage";

const approvedParagraphs = [
  "I build web and mobile applications for operations, approvals, document processing, and ERP-connected workflows. My work spans React and TypeScript interfaces, reusable component systems, native mobile clients, .NET services, and automation tooling.",
  "I focus on software that turns complex business rules into clear, reliable tools—from scanner-led warehouse processes and editable document workflows to e-invoicing, integrations, and WebGL experiments.",
];

const approvedSkillGroups = [
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

it("renders the exact approved introduction and skill groups", () => {
  render(<HomePage />);

  const positioning = screen.getByRole("heading", {
    level: 2,
    name: "a full-stack software engineer",
  });
  const introduction = positioning.parentElement;
  expect(introduction).not.toBeNull();

  const paragraphs = Array.from(introduction?.querySelectorAll("p") ?? []);
  expect(paragraphs).toHaveLength(2);
  expect(paragraphs.map((paragraph) => paragraph.textContent)).toEqual(approvedParagraphs);

  const skillsRegion = screen.getByRole("region", { name: "Skills" });
  const groupHeadings = within(skillsRegion).getAllByRole("heading", { level: 3 });
  expect(groupHeadings).toHaveLength(5);
  expect(groupHeadings.map((heading) => heading.textContent)).toEqual(
    approvedSkillGroups.map((group) => group.name),
  );

  for (const group of approvedSkillGroups) {
    const heading = within(skillsRegion).getByRole("heading", {
      level: 3,
      name: group.name,
    });
    const groupElement = heading.parentElement;
    expect(groupElement).not.toBeNull();

    const items = within(groupElement as HTMLElement).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(group.skills);
  }
});
