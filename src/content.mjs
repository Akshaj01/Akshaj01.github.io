// Everything the site says lives here. The page (build.mjs) and the book's
// contents page (book/pages.mjs) both read it, so they can't drift apart.

export const PERSON = {
  name: "Akshaj Srirambhatla",
  first: "Akshaj",
  last: "Srirambhatla",
  role: "AI Engineer",
  tagline: "Building AI systems and the infrastructure they run on.",
  focus: "AI systems and infrastructure",
  location: "San Diego, CA",
  region: "San Diego · California",
  email: "akshajsrirambhatla@gmail.com",
  github: "https://github.com/Akshaj01",
  githubLabel: "github.com/Akshaj01",
  linkedin: "https://www.linkedin.com/in/akshaj-srirambhatla",
  linkedinLabel: "linkedin.com/in/akshaj-srirambhatla",
  intro:
    "I build the data and retrieval systems behind AI agents: ETL pipelines, MCP servers, RAG services and the APIs other teams depend on. Before that I wrote real-time C for vehicle networks at Toyota.",
};

export const EXPERIENCE = [
  {
    company: "Western Digital",
    title: "Software Engineer",
    place: "San Jose, CA",
    dates: "Jul 2025 – Present",
    points: [
      "Built ETL pipelines feeding an internal AI agent’s MCP server, replacing manual MySQL analysis and reporting and eliminating 50+ analyst-hours of work a month.",
      "Own the REST API that exposes the pipeline’s data to a partner engineering team: schema design, query-plan tuning and ongoing support as their access patterns change.",
      "Containerized the MCP servers with Docker and deployed them to AWS EKS with rolling updates, keeping the agent available through releases.",
      "Built a retrieval-augmented pipeline on AWS Bedrock and S3 that generates analytical reports end to end, which were previously assembled by hand.",
      "Cut failure-investigation time by 90% with a Python trace-dump analyzer that surfaces critical events from system memory dumps, and automated integration and diagnostic runs to remove 20+ hours of manual validation a month.",
    ],
  },
  {
    company: "Toyota Motor North America",
    title: "Software Engineer Intern",
    place: "Plano, TX",
    dates: "Jun – Aug 2023",
    points: [
      "Built a fault-injection framework in C to stress-test real-time CAN bus resilience: an in-house test bench at roughly 75% lower bill-of-materials cost than commercial equipment.",
      "Developed modules that simulate concurrent data corruption on the bus to validate fail-safe recovery and measure recovery latency under peak load.",
      "Automated network-protocol validation suites covering adversarial edge cases, profiling response times across distributed vehicle components.",
    ],
  },
];

export const PROJECTS = [
  {
    name: "SEC GraphRAG",
    date: "Aug 2026",
    stack: ["Python", "FastAPI", "Neo4j", "PostgreSQL/pgvector", "Docker"],
    link: "https://github.com/Akshaj01/sec-graph-rag",
    linkLabel: "Akshaj01/sec-graph-rag",
    points: [
      "Hybrid knowledge-graph + vector RAG over 10-K filings from 10 companies: a closed ontology (6 entity and 8 relationship types) extracted with structured LLM outputs into idempotent Neo4j writes, cross-linked to an HNSW index by chunk ID.",
      "Graph lookups go through allowlisted, parameterized Cypher templates, so the model never writes database queries; any answer citing evidence outside the retrieved set is regenerated.",
      "A hop-stratified 24-question benchmark: hybrid retrieval raised keyword recall from 0.71 to 0.85 overall and from 0.69 to 0.94 on single-hop relationship questions, with correct refusals on every out-of-scope question.",
    ],
  },
  {
    name: "Froggy",
    date: "2026",
    stack: ["Swift", "macOS"],
    link: "https://github.com/Akshaj01/Froggy",
    linkLabel: "Akshaj01/Froggy",
    points: ["A tiny Mac menu-bar frog that turns a file into a PDF, takes a screenshot, and lets you pick the save folder."],
  },
  {
    name: "Autonomous Delivery System",
    date: "Sep 2023 – Jun 2024",
    stack: ["Python", "C++", "Multithreading"],
    points: [
      "Real-time computer-vision pipeline for physical marker detection with sub-second target acquisition, streaming telemetry over a serial interface.",
      "Control software built on inter-process communication and multithreading, driving low-latency state machines from perception output.",
      "Designed the integration layer between perception modules and the control loops, with lossless hand-off between vision tasks and execution.",
    ],
  },
];

export const SKILLS = [
  ["Languages", ["Python", "C++", "C", "SQL"]],
  ["Databases", ["PostgreSQL (pgvector)", "MySQL", "Neo4j"]],
  ["Frameworks", ["FastAPI", "Pydantic", "REST APIs", "PyTest"]],
  ["Cloud & tools", ["AWS (EKS, Bedrock, S3)", "Docker", "Kubernetes", "Git", "Linux", "CI/CD"]],
  ["AI systems", ["RAG", "Knowledge graphs", "Vector search (HNSW)", "MCP", "LLM structured outputs", "Evaluation harnesses"]],
];

export const EDUCATION = [
  {
    school: "California Polytechnic State University, San Luis Obispo",
    degree: "B.S. Computer Engineering",
    place: "San Luis Obispo, CA",
    dates: "Dec 2024",
  },
];

// The site's sections, in order. `page` is where each one starts in the book,
// so the contents page drawn in the intro matches the nav on the site.
export const SECTIONS = [
  { id: "experience", num: "01", title: "Experience", page: 1 },
  { id: "projects", num: "02", title: "Projects", page: 9 },
  { id: "skills", num: "03", title: "Skills", page: 17 },
  { id: "education", num: "04", title: "Education", page: 21 },
  { id: "contact", num: "05", title: "Contact", page: 23 },
];
