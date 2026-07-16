import type { JSX } from "react";

export function NotFoundPage(): JSX.Element {
  return (
    <section aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">404</h1>
      <p>not found</p>
      <p>Sorry. This page does not exist.</p>
    </section>
  );
}
