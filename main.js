const normalizeContactSection = () => {
  const contactSections = Array.from(document.querySelectorAll('section#contact'));
  if (contactSections.length > 1) {
    contactSections.slice(1).forEach((section) => section.remove());
  }

  const canonicalEmail = 'jahanmateenah55@gmail.com';
  const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
  emailLinks.forEach((link) => {
    link.href = `mailto:${canonicalEmail}`;
    link.textContent = canonicalEmail;
  });
};

normalizeContactSection();

const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
const sectionMap = new Map();

for (const link of navLinks) {
  const id = link.getAttribute('href')?.slice(1);
  const section = id ? document.getElementById(id) : null;
  if (section) sectionMap.set(section, link);
}

const setActiveLink = (link) => {
  for (const item of navLinks) {
    item.classList.toggle('active', item === link);
  }

  if (link && window.matchMedia('(max-width: 768px)').matches) {
    link.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
};

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

    if (visible.length > 0) {
      const topSection = visible[0].target;
      setActiveLink(sectionMap.get(topSection));
    }
  },
  {
    rootMargin: '-30% 0px -55% 0px',
    threshold: [0.2, 0.4, 0.6],
  },
);

for (const section of sectionMap.keys()) {
  observer.observe(section);
}

for (const link of navLinks) {
  link.addEventListener('click', () => setActiveLink(link));
}

if (navLinks.length > 0) {
  setActiveLink(navLinks[0]);
}
