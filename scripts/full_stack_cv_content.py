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


@dataclass(frozen=True)
class Education:
    institution: str
    qualification: str
    period: str


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
        website_url="https://corashina.github.io",
        github_text="github.com/corashina",
        github_url="https://github.com/corashina",
        linkedin_text="linkedin.com/in/tomasz-zielinski-a97999161",
        linkedin_url="https://www.linkedin.com/in/tomasz-zielinski-a97999161/",
    ),
    profile=(
        "Full-stack developer with six years at Xelto, building software that runs "
        "behind the paperwork at manufacturing and logistics companies. I wrote much of "
        "our document AI service, which reads invoices with an LLM and gets better as "
        "users correct it. I also built our KSeF e-invoicing and approval workflow "
        "products, warehouse scanning tied to the client's ERP, and the mobile app that "
        "covers them. I work in C#/.NET on Azure and in React/TypeScript, and I set up "
        "the pipelines that deploy it."
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
            ),
        ),
        ("Backend", ("C#", ".NET", "Node.js", "JWT")),
        ("Integrations", ("KSeF", "XSLT/XML", "n8n")),
        ("Testing", ("Playwright", "Vitest", "React Testing Library")),
        ("Delivery", ("GitHub Actions", "Vite")),
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
                        "Document AI / ICR",
                        "2025–2026",
                        "React, TypeScript",
                        "Built the interface where users upload PDFs, configure extraction "
                        "prompts, and review the structured JSON results.",
                    ),
                    Project(
                        "Cloud and integration",
                        "2025–2026",
                        "C#, .NET, Azure Functions, Event Grid, Bicep, Azure DevOps",
                        "Event-driven processing on Azure Functions and Event Grid, e-mail "
                        "intake via SendGrid, webhooks to client systems, Bicep and Azure DevOps.",
                    ),
                    Project(
                        "e-Invoicing / KSeF",
                        "2024–2026",
                        "XSLT/XML",
                        "Built screens for KSeF integration rules, logs, and PDF/XML invoice "
                        "views, with XSLT rendering of invoice XML.",
                    ),
                    Project(
                        "Approval workflows",
                        "2024–2026",
                        "REST APIs",
                        "Built the workflow designer (versions, history), approval chains with "
                        "substitutes, and a configurable invoice editor.",
                    ),
                    Project(
                        "XELapps and mobile",
                        "2024–2026",
                        "React Native/Expo, Flutter",
                        "Built the platform's user and application setup and JWT sign-in, "
                        "and one Expo app for six products with SSO and store releases via EAS.",
                    ),
                ),
                bullets=(
                    "Set up build and release pipelines in Azure DevOps and GitHub Actions, "
                    "and published our shared React components to npm.",
                ),
            ),
            Role(
                title="Frontend Developer",
                period="2020–2024",
                products=(
                    Project(
                        "Xelcode",
                        "2020–2026",
                        "React, JavaScript",
                        "Scanner apps for warehouses and production lines at 12 "
                        "manufacturers. Workers scan barcodes on handheld terminals to receive "
                        "goods, move stock between locations and report production steps. Each "
                        "step is checked against the ERP before it is saved, and the app prints "
                        "labels for the scanned items. Processes are configured per client as "
                        "step-by-step flows, so one codebase served every site.",
                    ),
                ),
                bullets=(),
            ),
        ),
    ),
    # The 2018 freelance entry was dropped to keep the CV on one page.
    earlier_experience=(),
    personal_projects=(
        Project(
            "MIBSI Cluster Bridge",
            "2026",
            "Java, QNX, Android Auto, CarPlay",
            "Integrated Android Auto and CarPlay with the Audi instrument cluster on MIB2 "
            "firmware, with Java modules running on QNX.",
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
    languages=("Polish (native)", "English (fluent)", "Spanish (basic)"),
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

CV_VARIANTS = {"default": CV_DATA, "wielkopolska": WIELKOPOLSKA_CV_DATA}

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
