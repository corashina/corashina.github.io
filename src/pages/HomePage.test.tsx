import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { HomePage } from "./HomePage";

const approvedParagraphs = [
  "I build web and mobile software for operational workflows, business platforms, integrations, and document-heavy systems. My work covers React and TypeScript interfaces, API and ERP integrations, mobile applications, e-invoicing, and document AI.",
  "I work across product UI, backend services, and delivery tooling to turn complex processes into software people can use under real working conditions.",
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
