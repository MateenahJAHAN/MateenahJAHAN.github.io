const navLinks = Array.from(document.querySelectorAll('.nav-links a'));
const sectionMap = new Map();

for (const link of navLinks) {
  const hash = link.getAttribute('href');
  if (!hash || !hash.startsWith('#')) continue;
  const section = document.querySelector(hash);
  if (section) sectionMap.set(section, link);
}

const setActiveLink = (activeLink) => {
  for (const link of navLinks) {
    link.classList.toggle('is-active', link === activeLink);
  }
};

if (navLinks.length) {
  setActiveLink(navLinks[0]);
}

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    const activeLink = sectionMap.get(visible.target);
    if (activeLink) setActiveLink(activeLink);
  },
  {
    rootMargin: '-30% 0px -55% 0px',
    threshold: [0.15, 0.3, 0.5, 0.75],
  }
);

for (const section of sectionMap.keys()) {
  observer.observe(section);
}
