const header = document.querySelector("[data-header]");
const nav = document.querySelector("#primary-nav");
const navToggle = document.querySelector(".nav-toggle");
const aura = document.querySelector(".cursor-aura");
const signalCanvas = document.querySelector("[data-signal-canvas]");
const typewriter = document.querySelector("[data-typewriter]");
const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll(".nav a")];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pointer = {
  x: window.innerWidth * 0.72,
  y: window.innerHeight * 0.28,
  active: false
};

const terminalLines = [
  "opening BotNas notes...",
  "verifying proof: HTB | THM | CTFTime",
  "cataloging cases: web | recon | CTF | reports",
  "redacting noise, preserving evidence",
  "status: ready for next brief"
];

function setHeaderState() {
  header?.classList.toggle("is-scrolled", window.scrollY > 24);
}

function setActiveNav() {
  const current = sections.findLast((section) => section.offsetTop - 140 <= window.scrollY);

  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${current?.id}`);
  });
}

function typeTerminal() {
  if (!typewriter) return;

  const fullText = terminalLines.map((line) => `$ ${line}`).join("\n");
  let index = 0;

  const tick = () => {
    typewriter.textContent = fullText.slice(0, index);
    index += 1;

    if (index <= fullText.length) {
      window.setTimeout(tick, 22);
    }
  };

  tick();
}

function setupSignalCanvas() {
  if (!signalCanvas || prefersReducedMotion) return;

  const context = signalCanvas.getContext("2d");
  if (!context) return;

  let width = 0;
  let height = 0;
  let nodes = [];

  const buildNodes = () => {
    const count = Math.min(86, Math.max(42, Math.floor((width * height) / 23000)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.24,
      vy: (Math.random() - 0.5) * 0.24,
      pulse: Math.random() * Math.PI * 2
    }));
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    signalCanvas.width = Math.floor(width * ratio);
    signalCanvas.height = Math.floor(height * ratio);
    signalCanvas.style.width = `${width}px`;
    signalCanvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    buildNodes();
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";

    const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 280);
    glow.addColorStop(0, "rgba(217, 53, 125, 0.22)");
    glow.addColorStop(0.46, "rgba(21, 52, 88, 0.12)");
    glow.addColorStop(1, "rgba(3, 11, 24, 0)");
    context.fillStyle = glow;
    context.fillRect(pointer.x - 280, pointer.y - 280, 560, 560);

    nodes.forEach((node) => {
      const dx = node.x - pointer.x;
      const dy = node.y - pointer.y;
      const distance = Math.hypot(dx, dy) || 1;
      const pull = Math.max(0, 180 - distance) / 180;

      node.x += node.vx + (dx / distance) * pull * 1.2;
      node.y += node.vy + (dy / distance) * pull * 1.2;
      node.pulse += 0.018;

      if (node.x < -24) node.x = width + 24;
      if (node.x > width + 24) node.x = -24;
      if (node.y < -24) node.y = height + 24;
      if (node.y > height + 24) node.y = -24;
    });

    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const nodeDistance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
      const nodeAlpha = 0.12 + Math.max(0, 190 - nodeDistance) / 190 * 0.34;

      context.beginPath();
      context.arc(node.x, node.y, 1.1 + Math.sin(node.pulse) * 0.45, 0, Math.PI * 2);
      context.fillStyle = `rgba(255, 154, 182, ${nodeAlpha})`;
      context.fill();

      for (let j = i + 1; j < nodes.length; j += 1) {
        const next = nodes[j];
        const distance = Math.hypot(node.x - next.x, node.y - next.y);
        if (distance > 128) continue;

        const pointerBoost = Math.max(0, 210 - Math.min(nodeDistance, Math.hypot(next.x - pointer.x, next.y - pointer.y))) / 210;
        const alpha = (1 - distance / 128) * (0.12 + pointerBoost * 0.24);

        context.beginPath();
        context.moveTo(node.x, node.y);
        context.lineTo(next.x, next.y);
        context.strokeStyle = `rgba(217, 53, 125, ${alpha})`;
        context.lineWidth = 1;
        context.stroke();
      }
    }

    window.requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener("resize", resize);
}

function setupCertShowcase() {
  const showcases = [...document.querySelectorAll("[data-cert-showcase]")];
  if (!showcases.length) return;

  showcases.forEach((showcase) => {
    const triggers = [...showcase.querySelectorAll("[data-cert-trigger]")];
    const panels = [...showcase.querySelectorAll("[data-cert-panel]")];

    const setActiveCert = (id) => {
      triggers.forEach((trigger) => {
        const isActive = trigger.dataset.certTrigger === id;
        trigger.classList.toggle("is-active", isActive);
        trigger.setAttribute("aria-pressed", String(isActive));
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.certPanel === id;
        panel.classList.toggle("is-active", isActive);
        panel.setAttribute("aria-hidden", String(!isActive));
      });
    };

    showcase.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-cert-trigger]");
      if (!trigger || !showcase.contains(trigger)) return;

      setActiveCert(trigger.dataset.certTrigger);
    });
  });
}

function setupBlogToc() {
  const tocLinks = [...document.querySelectorAll('.blog-sidebar__toc a[href^="#"]')];
  if (!tocLinks.length) return;

  const sectionsById = new Map(
    tocLinks
      .map((link) => [link.hash.slice(1), document.getElementById(link.hash.slice(1))])
      .filter(([, section]) => section)
  );

  const setActiveLink = (id) => {
    tocLinks.forEach((link) => {
      link.classList.toggle("is-active", link.hash === `#${id}`);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

      if (visible?.target.id) setActiveLink(visible.target.id);
    },
    { rootMargin: "-18% 0px -68%", threshold: 0 }
  );

  sectionsById.forEach((section) => observer.observe(section));
  setActiveLink(tocLinks[0].hash.slice(1));
}

navToggle?.addEventListener("click", () => {
  const isOpen = nav?.classList.toggle("is-open") ?? false;
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    nav?.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

window.addEventListener("scroll", () => {
  setHeaderState();
  setActiveNav();
});

window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;

  if (!aura) return;
  aura.style.transform = `translate3d(${event.clientX - aura.offsetWidth / 2}px, ${event.clientY - aura.offsetHeight / 2}px, 0)`;
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  { threshold: 0.14 }
);

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

setHeaderState();
setActiveNav();
typeTerminal();
setupSignalCanvas();
setupCertShowcase();
setupBlogToc();
