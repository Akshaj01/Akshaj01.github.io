// Builds the static site into dist/: index.html from src/content.mjs, plus the
// stylesheet and the intro's modules, copied as they are. No dependencies.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PERSON, EXPERIENCE, PROJECTS, SKILLS, EDUCATION, SECTIONS } from "./src/content.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "dist");

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const section = (id) => SECTIONS.find((s) => s.id === id);
const heading = (id) => {
  const s = section(id);
  return `<h2 id="${s.id}-title"><span class="num">${s.num}</span>${esc(s.title)}</h2>`;
};
const list = (points) => `<ul>${points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;

const contents = `<nav class="contents" aria-labelledby="contents-title">
  <h2 id="contents-title">Contents</h2>
  <ol>${SECTIONS.map((s) => `<li><a href="#${s.id}"><span class="num">${s.num}</span><span class="title">${esc(s.title)}</span><span class="leader" aria-hidden="true"></span><span class="page" aria-hidden="true">${s.page}</span></a></li>`).join("")}</ol>
</nav>`;

const experience = `<section class="section" id="experience" aria-labelledby="experience-title">
  ${heading("experience")}
  ${EXPERIENCE.map((job) => `<article class="entry">
    <p class="when">${esc(job.dates)}</p>
    <div>
      <h3>${esc(job.company)}</h3>
      <p class="sub">${esc(job.title)} · ${esc(job.place)}</p>
      ${list(job.points)}
    </div>
  </article>`).join("\n  ")}
</section>`;

const projects = `<section class="section" id="projects" aria-labelledby="projects-title">
  ${heading("projects")}
  ${PROJECTS.map((p) => `<article class="entry">
    <p class="when">${esc(p.date)}</p>
    <div>
      <h3>${p.link ? `<a href="${esc(p.link)}">${esc(p.name)}</a>` : esc(p.name)}</h3>
      <p class="stack">${p.stack.map(esc).join(" · ")}</p>
      ${list(p.points)}
      ${p.link ? `<p class="repo"><a href="${esc(p.link)}">${esc(p.linkLabel)}</a></p>` : ""}
    </div>
  </article>`).join("\n  ")}
</section>`;

const skills = `<section class="section" id="skills" aria-labelledby="skills-title">
  ${heading("skills")}
  <dl class="skills">${SKILLS.map(([group, items]) => `<dt>${esc(group)}</dt><dd>${items.map(esc).join(", ")}</dd>`).join("")}</dl>
</section>`;

const education = `<section class="section" id="education" aria-labelledby="education-title">
  ${heading("education")}
  ${EDUCATION.map((e) => `<article class="entry">
    <p class="when">${esc(e.dates)}</p>
    <div>
      <h3>${esc(e.school)}</h3>
      <p class="sub">${esc(e.degree)} · ${esc(e.place)}</p>
    </div>
  </article>`).join("\n  ")}
</section>`;

const contact = `<section class="section contact" id="contact" aria-labelledby="contact-title">
  ${heading("contact")}
  <p>The quickest way to reach me is email. I’m always happy to talk about retrieval, agents and the infrastructure under them.</p>
  <p><a class="email" href="mailto:${esc(PERSON.email)}">${esc(PERSON.email)}</a></p>
  <ul class="links">
    <li><a href="${esc(PERSON.github)}">${esc(PERSON.githubLabel)}</a></li>
    <li><a href="${esc(PERSON.linkedin)}">${esc(PERSON.linkedinLabel)}</a></li>
  </ul>
</section>`;

// Runs before first paint: if the intro is going to play, cover the page now so the
// site doesn't flash first. If the module never loads, give the page back after 4 s.
const pending = `(function(){try{var d=document.documentElement,q=location.search;if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;if(q.indexOf("intro")<0&&q.indexOf("t=")<0&&sessionStorage.getItem("intro-seen")==="1")return;d.classList.add("intro-pending");if(document.fonts){document.fonts.load('500 12px "Outfit"');document.fonts.load('400 12px "Source Serif 4"')}setTimeout(function(){d.classList.remove("intro-pending")},4000)}catch(e){}})();`;

const description = `${PERSON.name}, ${PERSON.role} in ${PERSON.location}. ${PERSON.tagline}`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(PERSON.name)} · ${esc(PERSON.role)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(PERSON.name)}">
<meta property="og:description" content="${esc(description)}">
<meta name="theme-color" content="#f6f4ef">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;1,8..60,400&display=swap">
<link rel="stylesheet" href="assets/book/kit/iso.css">
<link rel="stylesheet" href="assets/site.css">
${["intro.mjs", "book/scene.mjs", "book/kit/iso-kit.mjs", "book/dims.mjs", "book/pages.mjs", "content.mjs"].map((m) => `<link rel="modulepreload" href="assets/${m}">`).join("\n")}
<script>${pending}</script>
</head>
<body>
<div class="intro iso" id="intro" data-theme="light" hidden>
  <svg class="iso-svg book" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A cloth-bound book titled ${esc(PERSON.name)} opens on its hinge; its leaves turn to the contents and riffle past until the last blank page fills the screen and becomes this page." preserveAspectRatio="xMidYMid slice"></svg>
  <button class="intro-skip" type="button">Skip intro</button>
</div>
<div class="site">
<header class="masthead">
  <p class="kicker">${esc(PERSON.location)} · ${esc(PERSON.role)}</p>
  <h1>${esc(PERSON.name)}</h1>
  <p class="role">${esc(PERSON.tagline)}</p>
  <p class="intro-text">${esc(PERSON.intro)}</p>
  <ul class="links">
    <li><a href="mailto:${esc(PERSON.email)}">Email</a></li>
    <li><a href="${esc(PERSON.github)}">GitHub</a></li>
    <li><a href="${esc(PERSON.linkedin)}">LinkedIn</a></li>
  </ul>
</header>
${contents}
<main>
${experience}
${projects}
${skills}
${education}
${contact}
</main>
<footer class="colophon">
  <span>© ${new Date().getFullYear()} ${esc(PERSON.name)}</span>
  <span><button type="button" data-replay>Replay the opening</button> · Book drawn with <a href="https://github.com/wheresryan22/anatomy">Anatomy</a></span>
</footer>
</div>
<script type="module" src="assets/intro.mjs"></script>
</body>
</html>
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(HERE, "src"), join(OUT, "assets"), { recursive: true });
writeFileSync(join(OUT, "index.html"), page);
writeFileSync(join(OUT, ".nojekyll"), "");
console.log("built dist/index.html");
