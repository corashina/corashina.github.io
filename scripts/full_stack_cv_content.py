from __future__ import annotations

from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Identity:
    name: str
    role: str
    phone: str
    email: str
    website_text: str
    website_url: str
    github_text: str
    github_url: str
    linkedin_text: str
    linkedin_url: str
    location: str = ""


@dataclass(frozen=True)
class Project:
    title: str
    period: str
    tools: str
    description: str
    url: str = ""
    url_text: str = ""


@dataclass(frozen=True)
class Role:
    title: str
    period: str
    bullets: tuple[str, ...]
    products: tuple[Project, ...] = ()

    @property
    def stack(self) -> tuple[str, ...]:
        """Every technology used across this role's products, once, in order."""
        seen: list[str] = []
        for product in self.products:
            for technology in product.tools.split(", "):
                if technology not in seen:
                    seen.append(technology)
        return tuple(seen)


@dataclass(frozen=True)
class Employment:
    company: str
    period: str
    roles: tuple[Role, ...]
    # Shown after the company name, like the freelance entry's place. Empty hides it.
    location: str = ""
    # A plain sentence after the role bullets. Empty hides it.
    client_note: str = ""


@dataclass(frozen=True)
class Education:
    institution: str
    qualification: str
    period: str


@dataclass(frozen=True)
class CvLabels:
    """Fixed wording the generator prints around the content, per language."""

    about: str = "About me"
    experience: str = "Professional experience"
    technologies: str = "Technologies"
    projects: str = "Projects"
    education: str = "Education"
    additional: str = "Additional information"
    languages: str = "Languages"
    subject: str = "Curriculum Vitae"
    docx_title: str = "Tomasz Zielinski - CV"
    pdf_title: str = "Tomasz Zielinski - Full-Stack Developer CV"


POLISH_LABELS = CvLabels(
    about="O mnie",
    experience="Doświadczenie zawodowe",
    technologies="Technologie",
    projects="Projekty",
    education="Wykształcenie",
    additional="Informacje dodatkowe",
    languages="Języki",
    subject="Życiorys",
    docx_title="Tomasz Zieliński - CV",
    pdf_title="Tomasz Zieliński - CV, Full-Stack Developer",
)


# One recruitment-consent line for every employer. Polish recruiters expect it,
# and it covers future processes too, so it does not name a company.
GDPR_CONSENT = (
    "I consent to the processing of my personal data for the purposes of current "
    "and future recruitment processes, in accordance with Art. 6(1)(a) and (b) GDPR "
    "(Regulation (EU) 2016/679)."
)


@dataclass(frozen=True)
class CvData:
    identity: Identity
    profile: str
    technology_groups: tuple[tuple[str, tuple[str, ...]], ...]
    employment: Employment
    earlier_experience: tuple[str, ...]
    personal_projects: tuple[Project, ...]
    education: tuple[Education, ...]
    languages: tuple[str, ...]
    # Extra labelled lines under Additional information, after Languages.
    additional_lines: tuple[tuple[str, str], ...] = ()
    # Printed in small grey type at the foot of the page. Empty hides it.
    consent: str = GDPR_CONSENT
    labels: CvLabels = CvLabels()

    @property
    def commercial_projects(self) -> tuple[Project, ...]:
        return tuple(
            product for role in self.employment.roles for product in role.products
        )

    def visible_text(self) -> str:
        values = [
            self.identity.name,
            self.identity.role,
            self.identity.location,
            self.identity.phone,
            self.identity.email,
            self.identity.website_text,
            self.identity.github_text,
            self.identity.linkedin_text,
            self.profile,
            self.employment.company,
            self.employment.period,
            self.employment.location,
            self.employment.client_note,
        ]
        for label, technologies in self.technology_groups:
            values.extend((label, *technologies))
        for role in self.employment.roles:
            values.extend((role.title, role.period, *role.bullets))
            for product in role.products:
                values.extend((product.title, product.tools, product.description))
        for project in self.personal_projects:
            values.extend(
                (project.title, project.period, project.tools, project.description, project.url_text)
            )
        values.extend(self.earlier_experience)
        for education in self.education:
            values.extend((education.institution, education.qualification, education.period))
        values.extend(self.languages)
        for label, value in self.additional_lines:
            values.extend((label, value))
        if self.consent:
            values.append(self.consent)
        return "\n".join(values)


CV_DATA = CvData(
    identity=Identity(
        name="Tomasz Zielinski",
        role="Full-Stack Developer",
        phone="+48 791 748 226",
        email="corashina@gmail.com",
        website_text="corashina.github.io",
        website_url="https://corashina.github.io/",
        github_text="github.com/corashina",
        github_url="https://github.com/corashina",
        linkedin_text="linkedin.com/in/corashina",
        linkedin_url="https://www.linkedin.com/in/corashina/",
    ),
    profile=(
        "Based in Poznań, with six years of commercial experience. I began in React and "
        "Android, and now work across the stack in React/TypeScript, React Native, "
        "C#/.NET and SQL Server. Most of my work is document-heavy business software, including LLM "
        "extraction and e-invoicing. AI coding tools such as Claude Code are part "
        "of my everyday development."
    ),
    technology_groups=(
        (
            "Frontend",
            (
                "TypeScript",
                "React",
                "Redux",
                "TanStack",
                "Mantine",
            ),
        ),
        ("Mobile", ("React Native", "Expo", "Android (Java, Kotlin)")),
        ("Backend", ("C#/.NET", "SQL Server", "Node.js")),
        ("Cloud", ("Azure", "Firebase")),
        ("Testing", ("Playwright", "Vitest")),
        ("Delivery", ("GitHub Actions", "EAS")),
    ),
    employment=Employment(
        company="Xelto",
        period="2020–2026",
        location="Warsaw, Poland",
        roles=(
            Role(
                title="Full-Stack Developer",
                period="2024–2026",
                products=(
                    Project(
                        "XELapps",
                        "2024–2026",
                        "React, TypeScript, React Native/Expo, Flutter",
                        "Worked on user and application setup and JWT sign-in for the web shell "
                        "that hosts our React business apps, and on SSO sign-in and EAS store "
                        "releases for the Expo app that covers six of our products.",
                    ),
                    Project(
                        "Document AI / ICR",
                        "2025–2026",
                        "C#, .NET, Azure Functions, Azure SQL, React, TypeScript",
                        "Co-developed the .NET 8 service on Azure Functions that reads emailed "
                        "invoices with Gemini (Vertex AI) and sends structured JSON to client "
                        "webhooks, matching supplier layouts with embeddings and Azure SQL vector "
                        "search. Built the React screens for reviewing results and tuning prompts.",
                    ),
                    Project(
                        "e-Invoicing / KSeF",
                        "2024–2026",
                        "XSLT/XML, React, TypeScript",
                        "Created the XSLT templates that render FA(3) invoice XML as HTML and PDF "
                        "previews, and built parts of the React dashboard and integration rules for "
                        "sending and receiving invoices through Poland's KSeF.",
                    ),
                    Project(
                        "Approval workflows",
                        "2024–2026",
                        "React, TypeScript",
                        "Helped build the designer clients use to set up approval chains for "
                        "invoices, purchase orders and holiday requests. Approvers act from the web, mobile swipe cards or "
                        "email.",
                    ),
                    Project(
                        "VendorPortal",
                        "2024–2026",
                        "React, TypeScript",
                        "Worked on the container views and the dictionaries that map supplier codes "
                        "and units to the client's, in a portal that tracks inbound shipments down "
                        "to lot and order.",
                    ),
                ),
                bullets=(
                    "Worked directly with Pernod Ricard, Fakro, Filtron, Walstead, CTK Logistics, "
                    "Melle, IMI Hydronic Engineering, Efektor and Drosed.",
                ),
            ),
            Role(
                title="Frontend Developer",
                period="2020–2024",
                products=(
                    Project(
                        "Xelcode",
                        "2020–2026",
                        "React, JavaScript, Java, Kotlin, Android, Zebra/Honeywell/Urovo SDKs",
                        "Android scanner suite for warehouses and production, integrated with "
                        "Oracle JD Edwards E1. Built the scanning layer in Java and Kotlin on "
                        "the Zebra, Honeywell and Urovo SDKs.",
                    ),
                ),
                bullets=(
                    "Set up CI/CD pipelines in GitHub Actions and published our shared React "
                    "components to npm.",
                ),
            ),
        ),
    ),
    earlier_experience=(
        "Freelance Web Development | Poznań, Poland | 2018–2020",
        "Built responsive single-page application components and improved page speed "
        "and SEO.",
    ),
    personal_projects=(
        Project(
            "MIBSI Cluster Bridge",
            "2026",
            "Java, QNX, Android Auto, CarPlay",
            "Integrated Android Auto and CarPlay with the Audi instrument cluster on MIB2 "
            "firmware, using Java modules on QNX.",
            "https://github.com/corashina/mibsi-cluster-bridge",
            "github.com/corashina/mibsi-cluster-bridge",
        ),
    ),
    education=(
        Education(
            "University of Southampton",
            "BSc Computer Science, School of Electronics and Computer Science",
            "2017–2020",
        ),
        Education(
            "Poznan University of Technology",
            "Information Engineering, Faculty of Electrical Engineering",
            "2016–2017",
        ),
    ),
    languages=("English (C1)", "Polish (native)", "Spanish (basic)"),
)

# Variant for employers in Wielkopolska hiring on a full-time employment
# contract: Additional information states the EU hiring subsidy (Tomasz was
# accepted into the project on 2026-11-12). Figures follow the PUP Konin
# rules for the "Droga do zatrudnienia po węglu" project. The profile stays
# the same as the default CV. Since 2026-11-12 the site's CV link
# (static/tomasz_zielinski.pdf and the editable DOCX) serves this variant;
# the default variant is for foreign and B2B applications.
WIELKOPOLSKA_CV_DATA = replace(
    CV_DATA,
    additional_lines=(
        (
            "Hiring subsidy",
            'Participant in the "Droga do zatrudnienia po węglu" programme (EU Just '
            "Transition Fund). The employer can be reimbursed up to PLN 7,000/month in "
            "salary and social-security costs for up to 24 months (full-time employment "
            "contract, workplace in Wielkopolska).",
        ),
    ),
)

# Polish CV: the Wielkopolska variant in Polish, linked from the /pl/ pages.
# Job titles, product names and technologies stay in English, as Polish IT
# recruiters read them that way. Straight quotes only (unslop rules).
POLISH_GDPR_CONSENT = (
    "Wyrażam zgodę na przetwarzanie moich danych osobowych na potrzeby obecnych "
    "i przyszłych procesów rekrutacyjnych, zgodnie z art. 6 ust. 1 lit. a i b RODO "
    "(Rozporządzenie (UE) 2016/679)."
)

POLISH_CV_DATA = replace(
    WIELKOPOLSKA_CV_DATA,
    identity=replace(CV_DATA.identity, name="Tomasz Zieliński"),
    profile=(
        "Mieszkam w Poznaniu, mam sześć lat doświadczenia komercyjnego. Zaczynałem od "
        "Reacta i Androida, dziś pracuję w całym stacku: React/TypeScript, React Native, "
        "C#/.NET i SQL Server. Głównie tworzę oprogramowanie biznesowe do obsługi "
        "dokumentów, w tym ekstrakcję danych przez LLM i e-fakturowanie. Narzędzia AI do "
        "programowania, takie jak Claude Code, są częścią mojej codziennej pracy."
    ),
    technology_groups=(
        ("Frontend", CV_DATA.technology_groups[0][1]),
        ("Mobile", CV_DATA.technology_groups[1][1]),
        ("Backend", CV_DATA.technology_groups[2][1]),
        ("Chmura", CV_DATA.technology_groups[3][1]),
        ("Testy", CV_DATA.technology_groups[4][1]),
        ("Wdrażanie", CV_DATA.technology_groups[5][1]),
    ),
    employment=Employment(
        company="Xelto",
        period="2020–2026",
        location="Warszawa",
        roles=(
            Role(
                title="Full-Stack Developer",
                period="2024–2026",
                products=(
                    Project(
                        "XELapps",
                        "2024–2026",
                        "React, TypeScript, React Native/Expo, Flutter",
                        "Pracowałem nad konfiguracją użytkowników i aplikacji oraz logowaniem JWT "
                        "w webowej powłoce dla naszych aplikacji biznesowych w React. W aplikacji "
                        "Expo, która obsługuje sześć naszych produktów, robiłem logowanie SSO "
                        "i publikację w sklepach przez EAS.",
                    ),
                    Project(
                        "Document AI / ICR",
                        "2025–2026",
                        "C#, .NET, Azure Functions, Azure SQL, React, TypeScript",
                        "Współtworzyłem usługę .NET 8 (Azure Functions), która czyta faktury z "
                        "e-maili przez Gemini (Vertex AI) i wysyła ustrukturyzowany JSON do "
                        "webhooków klientów. Układ dokumentu dostawcy rozpoznaje przez embeddingi "
                        "i wyszukiwanie wektorowe w Azure SQL. Zbudowałem ekrany React do "
                        "przeglądu wyników i dostrajania promptów.",
                    ),
                    Project(
                        "E-fakturowanie / KSeF",
                        "2024–2026",
                        "XSLT/XML, React, TypeScript",
                        "Stworzyłem szablony XSLT, które zamieniają XML faktur FA(3) na podglądy "
                        "HTML i PDF. Budowałem też część panelu React i reguły integracji do "
                        "wysyłania i odbierania faktur przez KSeF.",
                    ),
                    Project(
                        "Obieg akceptacji",
                        "2024–2026",
                        "React, TypeScript",
                        "Współtworzyłem kreator, w którym klienci ustawiają ścieżki akceptacji "
                        "faktur, zamówień zakupu i wniosków urlopowych. Akceptujący decydują w przeglądarce, w aplikacji mobilnej "
                        "(przesuwane karty) lub e-mailem.",
                    ),
                    Project(
                        "VendorPortal",
                        "2024–2026",
                        "React, TypeScript",
                        "Pracowałem nad widokami kontenerów i słownikami, które mapują kody "
                        "i jednostki dostawców na kody klienta, w portalu śledzącym dostawy "
                        "przychodzące aż do poziomu partii i zamówienia.",
                    ),
                ),
                bullets=(
                    "Współpracowałem bezpośrednio z Pernod Ricard, Fakro, Filtron, "
                    "Walstead, CTK Logistics, Melle, IMI Hydronic Engineering, Efektor i Drosed.",
                ),
            ),
            Role(
                title="Frontend Developer",
                period="2020–2024",
                products=(
                    Project(
                        "Xelcode",
                        "2020–2026",
                        "React, JavaScript, Java, Kotlin, Android, Zebra/Honeywell/Urovo SDKs",
                        "Aplikacje na skanery z Androidem dla magazynów i produkcji, zintegrowane "
                        "z Oracle JD Edwards E1. Warstwę skanowania napisałem w Javie i Kotlinie "
                        "(SDK Zebra, Honeywell, Urovo).",
                    ),
                ),
                bullets=(
                    "Skonfigurowałem pipeline'y CI/CD w GitHub Actions i opublikowałem nasze "
                    "współdzielone komponenty React w npm.",
                ),
            ),
        ),
    ),
    earlier_experience=(
        "Web Developer (freelance) | Poznań | 2018–2020",
        "Tworzyłem responsywne komponenty aplikacji SPA, poprawiałem szybkość ładowania "
        "stron i SEO.",
    ),
    personal_projects=(
        Project(
            "MIBSI Cluster Bridge",
            "2026",
            "Java, QNX, Android Auto, CarPlay",
            "Połączyłem Android Auto i CarPlay z cyfrowymi zegarami Audi na oprogramowaniu "
            "MIB2, używając modułów w Javie działających na QNX.",
            "https://github.com/corashina/mibsi-cluster-bridge",
            "github.com/corashina/mibsi-cluster-bridge",
        ),
    ),
    education=(
        Education(
            "University of Southampton",
            "Informatyka, BSc (School of Electronics and Computer Science)",
            "2017–2020",
        ),
        Education(
            "Politechnika Poznańska",
            "Informatyka, Wydział Elektryczny",
            "2016–2017",
        ),
    ),
    languages=("angielski (C1)", "polski (ojczysty)", "hiszpański (podstawowy)"),
    additional_lines=(
        (
            "Dofinansowanie zatrudnienia",
            'Uczestnik projektu "Droga do zatrudnienia po węglu" (FST). Pracodawca może '
            "dostać zwrot wynagrodzenia i składek ZUS do 7000 zł/mies. przez maks. 24 "
            "miesiące (umowa o pracę na pełny etat, praca w Wielkopolsce).",
        ),
    ),
    consent=POLISH_GDPR_CONSENT,
    labels=POLISH_LABELS,
)

CV_VARIANTS = {"default": CV_DATA, "wielkopolska": WIELKOPOLSKA_CV_DATA, "polish": POLISH_CV_DATA}

FORBIDDEN_PUBLIC_TERMS = (
    "3,342",
    "17 private",
    "Roldrob",
    "LSC",
    "Malow",
)
