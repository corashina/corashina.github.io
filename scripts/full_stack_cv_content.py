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
class Role:
    title: str
    period: str
    bullets: tuple[str, ...]


@dataclass(frozen=True)
class Employment:
    company: str
    period: str
    roles: tuple[Role, ...]


@dataclass(frozen=True)
class Project:
    title: str
    period: str
    tools: str
    description: str
    url: str = ""


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
    commercial_projects: tuple[Project, ...]
    earlier_experience: tuple[str, ...]
    personal_projects: tuple[Project, ...]
    education: tuple[Education, ...]
    languages: tuple[str, ...]
    consent: str

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
        for project in (*self.commercial_projects, *self.personal_projects):
            values.extend((project.title, project.period, project.tools, project.description))
        values.extend(self.earlier_experience)
        for education in self.education:
            values.extend((education.institution, education.qualification, education.period))
        values.extend(self.languages)
        return "\n".join(values)


CV_DATA = CvData(
    identity=Identity(
        name="Tomasz Zielinski",
        role="Full-Stack Engineer",
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
        "Full-stack engineer with five years of commercial software delivery across "
        "business platforms, integrations, mobile applications, logistics, manufacturing, "
        "workflow automation, e-invoicing, and document AI. I work from user-facing "
        "applications and APIs through integration, delivery, and release."
    ),
    technology_groups=(
        ("Languages", ("TypeScript", "JavaScript", "C#", "Dart", "XSLT/XML")),
        ("Platforms", ("React", "Node.js", ".NET", "React Native/Expo", "Flutter")),
        ("Systems", ("REST APIs", "JWT", "n8n", "Oracle JD Edwards")),
        ("Delivery", ("GitHub Actions", "CI/CD", "npm packages", "Vite")),
    ),
    employment=Employment(
        company="Xelto",
        period="2021–2026",
        roles=(
            Role(
                title="Full-Stack Engineer",
                period="2024–2026",
                bullets=(
                    "Delivered platform applications, integrations, reusable components, "
                    "mobile experiences, and operational tooling.",
                    "Built administration, system setup, workflow approval, e-invoicing, "
                    "document-processing, and document-AI interfaces.",
                    "Worked across React/TypeScript, REST/JWT, React Native/Expo, Flutter, "
                    ".NET/C#, XSLT/XML, and integration tooling.",
                    "Maintained delivery pipelines, configuration, versioning, CI/CD "
                    "workflows, and shared-package publishing.",
                ),
            ),
            Role(
                title="Junior Frontend Developer",
                period="2021–2024",
                bullets=(
                    "Built React/JavaScript applications for warehouse and manufacturing "
                    "workflows on scanners and mobile devices.",
                    "Implemented process state, validation, barcode interaction, label "
                    "printing, localisation, and API-connected operational screens.",
                    "Maintained shared UI and API foundations used across commercial "
                    "applications.",
                ),
            ),
        ),
    ),
    commercial_projects=(
        Project(
            "Xelcode",
            "2021–2026",
            "React, JavaScript, Oracle JD Edwards",
            "Scanner-driven warehouse and manufacturing workflows with operational state, "
            "validation, printing, and ERP integration.",
        ),
        Project(
            "Workflow",
            "2024–2026",
            "React, TypeScript, REST APIs",
            "Approval and business-process modules with configurable data, document "
            "handling, and operational actions.",
        ),
        Project(
            "Document AI / ICR",
            "2025–2026",
            "React, TypeScript, PDF, JSON",
            "Interfaces for PDF handling, prompt configuration, document analysis, and "
            "structured results.",
        ),
        Project(
            "e-Invoicing / KSeF",
            "2024–2026",
            "React, TypeScript, .NET, XSLT/XML",
            "Document and integration-rule workflows covering PDF/XML views, logs, and "
            "Polish e-invoicing processes.",
        ),
        Project(
            "XELapps and mobile",
            "2024–2026",
            "React Native/Expo, Flutter, JWT",
            "Platform setup and mobile workflows for users, applications, authentication, "
            "and business-process access.",
        ),
    ),
    earlier_experience=(
        "Freelance Web Development | Poznan, Poland | May–August 2018",
        "Built responsive single-page application components and improved scalability, "
        "performance, and search visibility.",
    ),
    personal_projects=(
        Project(
            "Endless City",
            "September 2018",
            "JavaScript, Three.js, WebGL, glTF",
            "Interactive infinite city scene with a custom glTF 2.0 loader.",
            "https://github.com/corashina/Endless-City",
        ),
        Project(
            "Flappy-Pixie",
            "October 2018",
            "JavaScript, Three.js, WebGL",
            "Flappy Bird-style game with a 3D parallax background, completed as a one-week "
            "interview challenge.",
            "https://github.com/corashina/Flappy-Pixie",
        ),
        Project(
            "Fitmed",
            "July 2018",
            "React, Redux, Node.js, Express, MongoDB",
            "Prototype platform for dietitians with API integration, authentication, and "
            "input validation.",
            "https://github.com/corashina/Fitmed",
        ),
    ),
    education=(
        Education("University of Southampton", "BSc Computer Science", "July 2020"),
        Education(
            "Poznan University of Technology",
            "Information Engineering",
            "2016–2017",
        ),
    ),
    languages=("English", "Polish"),
    consent=(
        "I hereby consent to the processing of personal data in this document by anyone "
        "who receives it for the sole purpose of considering my skills and experience for "
        "professional opportunities."
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
