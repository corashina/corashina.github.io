from __future__ import annotations

from dataclasses import dataclass


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


@dataclass(frozen=True)
class Education:
    institution: str
    qualification: str
    period: str


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
        return "\n".join(values)


CV_DATA = CvData(
    identity=Identity(
        name="Tomasz Zielinski",
        role="Full-Stack Developer",
        phone="+48 791 748 226",
        email="corashina@gmail.com",
        website_text="corashina.github.io",
        website_url="https://corashina.github.io",
        github_text="github.com/corashina",
        github_url="https://github.com/corashina",
        linkedin_text="linkedin.com/in/tomasz-zielinski-a97999161",
        linkedin_url="https://www.linkedin.com/in/tomasz-zielinski-a97999161/",
    ),
    profile=(
        "Full-stack developer with six years at Xelto, building React and TypeScript "
        "applications, .NET integrations, and React Native and Flutter mobile apps. My "
        "work covers warehouse and manufacturing scanning, approval workflows, Polish "
        "e-invoicing (KSeF), and document AI. I build both the interface and the API "
        "behind it, and I maintain the CI/CD pipelines and shared npm packages that ship "
        "them."
    ),
    technology_groups=(
        (
            "Frontend",
            (
                "React",
                "TypeScript",
                "JavaScript",
                "Redux Toolkit",
                "TanStack Query",
                "Tailwind CSS",
                "React Native/Expo",
                "Flutter",
            ),
        ),
        ("Backend", ("C#", ".NET", "Node.js", "REST APIs", "JWT")),
        ("Integrations", ("Oracle JD Edwards", "KSeF", "XSLT/XML", "n8n")),
        ("Testing", ("Playwright", "Vitest", "React Testing Library")),
        ("Delivery", ("GitHub Actions", "CI/CD", "npm packages", "Vite")),
        ("Other", ("Python", "Rust")),
    ),
    employment=Employment(
        company="Xelto",
        period="2020–2026",
        roles=(
            Role(
                title="Full-Stack Developer",
                period="2024–2026",
                products=(
                    Project(
                        "Workflow",
                        "2024–2026",
                        "React, TypeScript, REST APIs",
                        "Built configurable approval and business-process modules that "
                        "handle documents.",
                    ),
                    Project(
                        "e-Invoicing / KSeF",
                        "2024–2026",
                        "React, TypeScript, .NET, XSLT/XML",
                        "Built screens for KSeF integration rules, logs, and PDF/XML invoice "
                        "views, with XSLT rendering of invoice XML.",
                    ),
                    Project(
                        "Document AI / ICR",
                        "2025–2026",
                        "React, TypeScript, PDF, JSON",
                        "Built the interface where users upload PDFs, configure extraction "
                        "prompts, and review the structured JSON results.",
                    ),
                    Project(
                        "XELapps and mobile",
                        "2024–2026",
                        "React Native/Expo, Flutter, JWT",
                        "Built the platform's user and application setup and JWT sign-in, "
                        "plus React Native/Expo and Flutter apps for business-process access.",
                    ),
                ),
                bullets=(
                    "Maintained the GitHub Actions CI/CD pipelines, release versioning, and "
                    "npm publishing for shared packages.",
                ),
            ),
            Role(
                title="Frontend Developer",
                period="2020–2024",
                products=(
                    Project(
                        "Xelcode",
                        "2020–2026",
                        "React, JavaScript, Oracle JD Edwards",
                        "Built React scanner apps for warehouses and production lines, "
                        "deployed at 12 client companies: barcode reading, per-step validation, "
                        "label printing, and Oracle JD Edwards integration.",
                    ),
                ),
                bullets=(
                    "Added localisation and multi-step process state to the scanner screens.",
                    "Maintained the shared UI components and API code used across Xelto's "
                    "products.",
                ),
            ),
        ),
    ),
    earlier_experience=(
        "Freelance Web Development | Poznan, Poland | May–August 2018",
        "Built responsive single-page application components and improved page speed "
        "and SEO.",
    ),
    personal_projects=(
        Project(
            "MIBSI Cluster Bridge",
            "2026",
            "Java, Python, QNX, Android Auto, CarPlay",
            "Reverse-engineered Audi's head unit to show Android Auto and CarPlay navigation "
            "in the Virtual Cockpit, and packaged an installer with verification checks.",
            "https://github.com/corashina/mibsi-cluster-bridge",
            "github.com/corashina/mibsi-cluster-bridge",
        ),
        Project(
            "The Long Drive",
            "2026",
            "Rust, Bevy, Rapier, WebAssembly",
            "Recreated the desktop driving-survival game for the browser in Rust, using "
            "Bevy and Rapier physics, compiled to WebAssembly.",
            "https://github.com/corashina/the-long-slop",
            "github.com/corashina/the-long-slop",
        ),
    ),
    education=(
        Education("University of Southampton", "BSc Computer Science", "2017–2020"),
        Education(
            "Poznan University of Technology",
            "Information Engineering",
            "2016–2017",
        ),
    ),
    languages=("Polish (native)", "English (fluent)", "Spanish (basic)"),
)

FORBIDDEN_PUBLIC_TERMS = (
    "3,342",
    "17 private",
    "Roldrob",
    "Filtron",
    "Fakro",
    "Bakoma",
    "Walstead",
    "LSC",
    "Malow",
)
