import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { HomePage } from "./HomePage";

const introduction = [
  "I build platforms for business workflows, operational systems, mobile applications, integrations, and document processing. I work across TypeScript, C#, Dart, and XSLT, connecting user-facing products with APIs, data flows, cloud services, and delivery pipelines.",
  "My experience covers logistics, manufacturing, workflow automation, e-invoicing, and document AI. I take products from application architecture through integration and release. I also build WebGL side projects with Three.js.",
];

const toolkit = {
  Languages: ["TypeScript", "JavaScript", "C#", "Dart", "XSLT/XML", "GLSL"],
  Platforms: [".NET", "Node.js", "React", "React Native/Expo", "Flutter", "Three.js/WebGL"],
  Systems: ["REST APIs", "JWT", "n8n", "Oracle JD Edwards"],
  Delivery: ["GitHub Actions", "CI/CD", "npm packages", "Vite"],
} as const;

it("renders the approved full-stack Home content and grouped toolkit", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { level: 1, name: "Tomasz Zielinski" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "Full-Stack Developer" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "Toolkit" })).toBeInTheDocument();
  introduction.forEach((copy) => expect(screen.getByText(copy)).toBeInTheDocument());

  Object.entries(toolkit).forEach(([group, technologies]) => {
    const heading = screen.getByRole("heading", { level: 3, name: group });
    const list = heading.nextElementSibling;

    expect(list).toHaveProperty("tagName", "UL");
    technologies.forEach((technology) => {
      expect(within(list as HTMLElement).getByText(technology)).toBeInTheDocument();
    });
  });

  expect(screen.queryByText("an aspiring software engineer")).not.toBeInTheDocument();
  expect(screen.queryByText("i use")).not.toBeInTheDocument();
  expect(screen.queryByText(/Student at the University of Southampton/)).not.toBeInTheDocument();
});
