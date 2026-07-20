import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { HomePage } from "./HomePage";

const paragraphs = [
  "Web enthusiast with experience in software development and architecture. Interested in network programming, web-based architecture, web-based authentication and unix systems. Advocate of fast paced development environments that embrace continuous change. Student at the University of Southampton.",
  "Accomplishing my goals with a variety of tools, predominantly web stuff such as Javascript, React, Redux, Node. Always ready to grasp new concepts and learn different technologies.",
];

it("renders the original homepage verbatim", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1, name: "Tomasz Zielinski" })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 2, name: "an aspiring software engineer" }),
  ).toBeInTheDocument();
  paragraphs.forEach((copy) => expect(screen.getByText(copy)).toBeInTheDocument());
  expect(screen.getByRole("heading", { level: 2, name: "i use" })).toBeInTheDocument();
  expect(screen.getByLabelText("Technologies")).toHaveTextContent(
    "javascript typescript scss three react redux gatsby node nosql mongo",
  );
});
