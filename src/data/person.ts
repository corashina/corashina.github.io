// schema.org Person for the home page, written into dist/index.html at build
// time by scripts/create-route-pages.mjs. Keep runtime imports out of this file:
// the build script loads it with Node.
export const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Tomasz Zielinski",
  jobTitle: "Full-stack developer",
  url: "https://www.tomasz-zielinski.com/",
  email: "mailto:corashina@gmail.com",
  sameAs: [
    "https://github.com/corashina",
    "https://www.linkedin.com/in/tomasz-zielinski-a97999161/",
    "https://stackoverflow.com/users/7306664/corashina",
    "https://x.com/corashina",
  ],
  alumniOf: { "@type": "CollegeOrUniversity", name: "University of Southampton" },
  knowsAbout: ["React", "TypeScript", ".NET", "C#", "Node.js", "React Native", "Oracle JD Edwards", "KSeF"],
};
