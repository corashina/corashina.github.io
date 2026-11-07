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
    consent: str

    @property
    def commercial_projects(self) -> tuple[Project, ...]:
        return tuple(
            product for role in self.employment.roles for product in role.products
        )

    def visible_text(self) -> str:
        values = [
            self.identity.name,
            self.identity.role,
            self.identity.phone,
            self.identity.email,
            self.identity.website_text,
            self.identity.github_text,
            self.identity.linkedin_text,
            self.profile,
            self.employment.company,
            self.employment.period,
            self.consent,
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
        "Full-stack developer with six years of commercial software delivery across "
        "business platforms, integrations, mobile applications, logistics, manufacturing, "
        "workflow automation, e-invoicing, and document AI. I work from user-facing "
        "applications and APIs through integration, delivery, and release. I translate "
        "operational requirements into maintainable systems and take ownership across the "
        "delivery lifecycle."
    ),
    technology_groups=(
        ("Languages", ("TypeScript", "JavaScript", "C#", "Dart", "Rust", "Python", "XSLT/XML")),
        ("Platforms", ("React", "Node.js", ".NET", "React Native/Expo", "Flutter")),
        ("Graphics", ("Three.js", "WebGL", "GLSL", "Bevy", "WebAssembly")),
        ("Systems", ("REST APIs", "JWT", "n8n", "Oracle JD Edwards")),
        ("Delivery", ("GitHub Actions", "CI/CD", "npm packages", "Vite")),
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
                        "Approval and business-process modules with configurable data, "
                        "document handling, and operational actions.",
                    ),
                    Project(
                        "e-Invoicing / KSeF",
                        "2024–2026",
                        "React, TypeScript, .NET, XSLT/XML",
                        "Integration-rule, log, and PDF/XML document workflows for Polish "
                        "e-invoicing.",
                    ),
                    Project(
                        "Document AI / ICR",
                        "2025–2026",
                        "React, TypeScript, PDF, JSON",
                        "Interfaces for PDF handling, prompt configuration, document "
                        "analysis, and structured results.",
                    ),
                    Project(
                        "XELapps and mobile",
                        "2024–2026",
                        "React Native/Expo, Flutter, JWT",
                        "Platform setup and mobile workflows for users, applications, "
                        "authentication, and business-process access.",
                    ),
                ),
                bullets=(
                    "Maintained delivery pipelines, configuration, versioning, CI/CD "
                    "workflows, and shared-package publishing.",
                ),
            ),
            Role(
                title="Junior Frontend Developer",
                period="2020–2024",
                products=(
                    Project(
                        "Xelcode",
                        "2020–2026",
                        "React, JavaScript, Oracle JD Edwards",
                        "Scanner-driven warehouse and manufacturing applications with "
                        "operational state, validation, printing, and ERP integration.",
                    ),
                ),
                bullets=(
                    "Implemented process state, validation, barcode interaction, label "
                    "printing, localisation, and API-connected operational screens.",
                    "Maintained shared UI and API foundations used across commercial "
                    "applications.",
                ),
            ),
        ),
    ),
    earlier_experience=(
        "Freelance Web Development | Poznan, Poland | May–August 2018",
        "Built responsive single-page application components and improved scalability, "
        "performance, and search visibility.",
    ),
    personal_projects=(
        Project(
            "MIBSI Cluster Bridge",
            "2026",
            "Java, Python, QNX, Android Auto, CarPlay",
            "Reverse-engineered tooling that bridges Android Auto and CarPlay navigation "
            "into Audi's Virtual Cockpit, with installation packaging and verification.",
            "https://github.com/corashina/mibsi-cluster-bridge",
            "github.com/corashina/mibsi-cluster-bridge",
        ),
        Project(
            "The Long Drive",
            "2026",
            "Rust, Bevy, Rapier, WebAssembly",
            "Browser recreation of the desktop driving-survival game, built in Rust "
            "with Bevy and Rapier physics and compiled to WebAssembly.",
            "https://github.com/corashina/the-long-slop",
            "github.com/corashina/the-long-slop",
        ),
        Project(
            "Don't Sleep With The Fishes",
            "2026",
            "TypeScript, Three.js, WebGL, GLSL",
            "Browser survival game about scavenging a sinking ship and managing a lifeboat "
            "while waiting for rescue.",
            "https://github.com/corashina/dont-sleep-with-the-fishes",
            "github.com/corashina/dont-sleep-with-the-fishes",
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
    languages=("Polish (native)", "English (fluent)"),
    consent=(
        "I agree to the processing of my personal data included in this document for the "
        "purposes of the recruitment process, in accordance with Regulation (EU) 2016/679 "
        "of the European Parliament and of the Council of 27 April 2016 (GDPR)."
    ),
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
