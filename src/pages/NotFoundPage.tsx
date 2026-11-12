import type { JSX } from "react";
import { useMessages } from "../i18n/useLocale";

export function NotFoundPage(): JSX.Element {
  const { notFound } = useMessages();
  return (
    <section aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">{notFound.title}</h1>
      <p>{notFound.subtitle}</p>
      <p>{notFound.body}</p>
    </section>
  );
}
