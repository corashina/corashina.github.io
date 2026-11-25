// Interface text in English and Polish. Shared by the app and by the build step
// (scripts/create-route-pages.mjs), so keep runtime imports out of this file.
import type { Locale } from "./locales";

const en = {
  nav: {
    label: "Primary navigation",
    home: "Home",
    work: "Work",
    articles: "Articles",
    contact: "Contact",
  },
  theme: {
    toDark: "Switch to dark theme",
    toLight: "Switch to light theme",
  },
  language: {
    /** Shown on English pages: the link to the Polish twin. */
    switchLabel: "Polska wersja",
    switchText: "PL",
  },
  home: {
    role: "full-stack developer",
    intro: [
      "Based in Poznań, with six years of commercial experience. I began in React and Android, and now work across the stack in React/TypeScript, React Native, C#/.NET and SQL Server.",
      "Most of my work is document-heavy business software, including LLM extraction and e-invoicing. AI coding tools such as Claude Code are part of my everyday development.",
    ],
    cvLink: "CV (PDF)",
    contactLink: "Contact",
    toolkit: "Toolkit",
    frontend: "Frontend",
    mobile: "Mobile",
    backend: "Backend",
    cloud: "Cloud",
    testing: "Testing",
    delivery: "Delivery",
  },
  works: {
    title: "Work",
    commercial: "commercial",
    freelance: "freelance",
    experiments: "experiments",
    productLink: "Product overview →",
    githubLink: "github →",
    playLink: "play →",
  },
  contact: {
    title: "Contact",
    findMe: "find me",
    linksLabel: "Contact links",
    cv: "cv",
    /** The CV file in this language. */
    cvHref: "/tomasz_zielinski.pdf",
    flairAlt: "Profile for corashina on Stack Exchange",
  },
  blog: {
    label: "Articles",
    empty: "No articles published yet.",
    topics: "Topics",
    readArticle: "Read article",
    readArticleLabel: "Read",
    backToArticles: "Back to articles",
    allArticles: "All articles",
    contents: "In this article",
    contentsLabel: "Article contents",
    loading: "Loading article…",
    loadFailed: "Unable to load this article. Please try again.",
    retry: "Retry",
    notFoundDescription: "This article could not be found.",
  },
  notFound: {
    title: "404",
    subtitle: "not found",
    body: "Sorry. This page does not exist.",
  },
  meta: {
    /** The name as written in this language. */
    name: "Tomasz Zielinski",
    homeTitle: "Tomasz Zielinski · Full-stack developer (React, TypeScript, .NET)",
    homeDescription:
      "Full-stack developer, six years at Xelto: React, TypeScript and .NET products for warehouse scanning, approval workflows, KSeF e-invoicing and document AI.",
    worksTitle: "Work",
    worksDescription:
      "Commercial products, freelance work and side projects by Tomasz Zielinski, full-stack developer.",
    contactTitle: "Contact",
    contactDescription: "Contact Tomasz Zielinski, full-stack developer: email, CV, LinkedIn and GitHub.",
    notFoundTitle: "Page not found",
    articlesTitle: "Articles",
    articlesDescription: "Articles and engineering notes by Tomasz Zielinski.",
    articleNotFoundTitle: "404",
    shareImageAlt: "Tomasz Zielinski, full-stack developer: React, TypeScript, .NET",
    noscript: "Tomasz Zielinski, full-stack developer (React, TypeScript, .NET).",
    jobTitle: "Full-stack developer",
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends readonly string[] ? readonly string[] : Widen<T[K]> };
export type Messages = Widen<typeof en>;

const pl: Messages = {
  nav: {
    label: "Główna nawigacja",
    home: "Start",
    work: "Projekty",
    articles: "Artykuły",
    contact: "Kontakt",
  },
  theme: {
    toDark: "Włącz ciemny motyw",
    toLight: "Włącz jasny motyw",
  },
  language: {
    switchLabel: "English version",
    switchText: "EN",
  },
  home: {
    role: "programista full-stack",
    intro: [
      "Mieszkam w Poznaniu, mam sześć lat doświadczenia komercyjnego. Zaczynałem od Reacta i Androida, dziś pracuję w całym stacku: React/TypeScript, React Native, C#/.NET i SQL Server.",
      "Głównie tworzę oprogramowanie biznesowe do obsługi dokumentów, w tym ekstrakcję danych przez LLM i e-fakturowanie. Narzędzia AI do programowania, takie jak Claude Code, są częścią mojej codziennej pracy.",
    ],
    cvLink: "CV (PDF)",
    contactLink: "Kontakt",
    toolkit: "Narzędzia",
    frontend: "Frontend",
    mobile: "Mobile",
    backend: "Backend",
    cloud: "Chmura",
    testing: "Testy",
    delivery: "Wdrażanie",
  },
  works: {
    title: "Projekty",
    commercial: "komercyjne",
    freelance: "freelance",
    experiments: "eksperymenty",
    productLink: "Opis produktu →",
    githubLink: "github →",
    playLink: "zagraj →",
  },
  contact: {
    title: "Kontakt",
    findMe: "znajdź mnie",
    linksLabel: "Linki kontaktowe",
    cv: "cv",
    cvHref: "/tomasz_zielinski_pl.pdf",
    flairAlt: "Profil corashina w serwisie Stack Exchange",
  },
  blog: {
    label: "Artykuły",
    empty: "Nie ma jeszcze artykułów.",
    topics: "Tematy",
    readArticle: "Czytaj artykuł",
    readArticleLabel: "Czytaj:",
    backToArticles: "Wróć do artykułów",
    allArticles: "Wszystkie artykuły",
    contents: "W tym artykule",
    contentsLabel: "Spis treści artykułu",
    loading: "Wczytywanie artykułu…",
    loadFailed: "Nie udało się wczytać artykułu. Spróbuj ponownie.",
    retry: "Wczytaj ponownie",
    notFoundDescription: "Nie znaleziono artykułu.",
  },
  notFound: {
    title: "404",
    subtitle: "nie znaleziono",
    body: "Ta strona nie istnieje.",
  },
  meta: {
    name: "Tomasz Zieliński",
    homeTitle: "Tomasz Zieliński · Programista full-stack (React, TypeScript, .NET)",
    homeDescription:
      "Programista full-stack, sześć lat w Xelto: React, TypeScript i .NET. Skanowanie magazynowe, obieg akceptacji, e-faktury w KSeF i AI do analizy dokumentów.",
    worksTitle: "Projekty",
    worksDescription:
      "Produkty komercyjne, zlecenia freelance i projekty własne Tomasza Zielińskiego, programisty full-stack.",
    contactTitle: "Kontakt",
    contactDescription: "Kontakt z Tomaszem Zielińskim, programistą full-stack: e-mail, CV, LinkedIn i GitHub.",
    notFoundTitle: "Nie znaleziono strony",
    articlesTitle: "Artykuły",
    articlesDescription: "Artykuły i notatki techniczne Tomasza Zielińskiego.",
    articleNotFoundTitle: "404",
    shareImageAlt: "Tomasz Zieliński, programista full-stack: React, TypeScript, .NET",
    noscript: "Tomasz Zieliński, programista full-stack (React, TypeScript, .NET).",
    jobTitle: "Programista full-stack",
  },
};

const dictionaries: Record<Locale, Messages> = { en, pl };

export const messagesFor = (locale: Locale): Messages => dictionaries[locale];
