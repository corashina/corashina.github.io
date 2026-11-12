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
      "I build platforms for business workflows, operational systems, mobile applications, integrations, and document processing. I work across TypeScript, C#, Dart, and XSLT, connecting user-facing products with APIs, data flows, cloud services, and delivery pipelines.",
      "My experience covers logistics, manufacturing, workflow automation, e-invoicing, and document AI. I take products from application architecture through integration and release. I also build WebGL side projects with Three.js.",
    ],
    toolkit: "Toolkit",
    languages: "Languages",
    platforms: "Platforms",
    systems: "Systems",
    delivery: "Delivery",
  },
  works: {
    title: "Work",
    commercial: "commercial",
    freelance: "freelance",
    experiments: "experiments",
    productLink: "Product overview →",
    githubLink: "github →",
  },
  contact: {
    title: "Contact",
    findMe: "find me",
    linksLabel: "Contact links",
    cv: "cv",
    flairAlt: "Profile for corashina on Stack Exchange",
  },
  blog: {
    label: "Articles",
    empty: "No articles published yet.",
    topics: "Topics",
    readArticle: "Read article",
    readArticleLabel: "Read",
    englishOnly: "",
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
    homeTitle: "Tomasz Zielinski · Full-stack developer (React, TypeScript, .NET)",
    homeDescription:
      "Full-stack developer with six years at Xelto building React, TypeScript and .NET products: warehouse scanning, approval workflows, Polish e-invoicing (KSeF) and document AI.",
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
      "Tworzę platformy do obsługi procesów biznesowych, systemy wspierające operacje firm, aplikacje mobilne, integracje i narzędzia do przetwarzania dokumentów. Pracuję w TypeScripcie, C#, Dart i XSLT, łącząc aplikacje dla użytkowników z API, przepływami danych, usługami chmurowymi i procesem wdrożeń.",
      "Mam doświadczenie w logistyce, produkcji, automatyzacji procesów, e-fakturowaniu i AI do analizy dokumentów. Prowadzę produkty od architektury aplikacji, przez integracje, aż po wdrożenie. Po godzinach tworzę projekty WebGL w Three.js.",
    ],
    toolkit: "Narzędzia",
    languages: "Języki",
    platforms: "Platformy",
    systems: "Systemy",
    delivery: "Wdrażanie",
  },
  works: {
    title: "Projekty",
    commercial: "komercyjne",
    freelance: "freelance",
    experiments: "eksperymenty",
    productLink: "Opis produktu →",
    githubLink: "github →",
  },
  contact: {
    title: "Kontakt",
    findMe: "znajdź mnie",
    linksLabel: "Linki kontaktowe",
    cv: "cv",
    flairAlt: "Profil corashina w serwisie Stack Exchange",
  },
  blog: {
    label: "Artykuły",
    empty: "Nie ma jeszcze artykułów.",
    topics: "Tematy",
    readArticle: "Czytaj artykuł",
    readArticleLabel: "Czytaj:",
    englishOnly: "Artykuły są napisane po angielsku.",
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
    body: "Przepraszam, ta strona nie istnieje.",
  },
  meta: {
    homeTitle: "Tomasz Zielinski · Programista full-stack (React, TypeScript, .NET)",
    homeDescription:
      "Programista full-stack z sześcioletnim doświadczeniem w Xelto. Tworzę produkty w React, TypeScript i .NET: skanowanie magazynowe, obieg akceptacji, e-fakturowanie w KSeF i AI do analizy dokumentów.",
    worksTitle: "Projekty",
    worksDescription:
      "Produkty komercyjne, zlecenia freelance i projekty własne Tomasza Zielinskiego, programisty full-stack.",
    contactTitle: "Kontakt",
    contactDescription: "Kontakt z Tomaszem Zielinskim, programistą full-stack: e-mail, CV, LinkedIn i GitHub.",
    notFoundTitle: "Nie znaleziono strony",
    articlesTitle: "Artykuły",
    articlesDescription: "Artykuły i notatki techniczne Tomasza Zielinskiego, pisane po angielsku.",
    articleNotFoundTitle: "404",
    shareImageAlt: "Tomasz Zielinski, programista full-stack: React, TypeScript, .NET",
    noscript: "Tomasz Zielinski, programista full-stack (React, TypeScript, .NET).",
    jobTitle: "Programista full-stack",
  },
};

const dictionaries: Record<Locale, Messages> = { en, pl };

export const messagesFor = (locale: Locale): Messages => dictionaries[locale];
