"use strict";

const map = document.querySelector("[data-research-map]");

if (map) {
  fetch(new URL("assets/research-map-public.json", document.baseURI))
    .then(response => {
      if (!response.ok) throw new Error("Research map data is unavailable");
      return response.json();
    })
    .then(data => initializeResearchMap(map, data))
    .catch(() => {
      // The project and source links in the HTML remain available.
    });
}

function initializeResearchMap(map, data) {
  const find = selector => map.querySelector(selector);
  const nodes = new Map(data.nodes.map(node => [node.id, node]));
  const sources = new Map(data.sources.map(source => [source.id, source]));
  const projects = data.nodes.filter(node => node.type === "project");
  const select = find("#project-select");
  const title = find("#selection-title");
  const svg = find("#research-graph");
  const drawing = find("#graph-content");
  const connections = find("#connection-list");
  const reset = find("#reset-project");
  const narrow = matchMedia("(max-width: 620px)");
  const standalone = map.dataset.researchMap === "standalone";
  const hashPrefix = standalone ? "" : "map-";
  const sectionAnchors = new Set(["main-content", "research-map", "graph-heading", "connections-text"]);
  const typeNames = {
    project: "Project",
    person: "Person",
    dataset: "Dataset",
    method: "Method",
    method_source: "Method source",
    software: "Software",
    output: "Output",
    publication: "Framework publication",
    institution: "Institution / affiliation",
    programme: "Fellowship",
  };
  let activeProject = data.default_project;
  let selected = activeProject;

  const edgesFor = id => data.edges.filter(edge => edge.source === id || edge.target === id);
  const neighbor = (edge, id) => nodes.get(edge.source === id ? edge.target : edge.source);
  const relation = (edge, id) => edge.source === id ? edge.label : edge.reverse_label;

  function choose(id, moveFocus = true) {
    const node = nodes.get(id);
    if (!node) return;

    if (node.type === "project") activeProject = id;
    selected = id;
    const type = node.type === "project" ? "project" : "item";
    const hash = `#${hashPrefix}${type}-${encodeURIComponent(id)}`;
    if (location.hash !== hash) history.pushState(selectionState(), "", hash);
    render();
    if (moveFocus) title.focus();
  }

  function route(shouldScroll = false) {
    let hash;
    try {
      hash = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }

    const pattern = standalone ? /^(?:map-)?(project|item)-(.+)$/ : /^map-(project|item)-(.+)$/;
    const match = pattern.exec(hash);
    if (!match && sectionAnchors.has(hash)) {
      const saved = history.state;
      if (nodes.has(saved?.researchMapSelection) && nodes.get(saved.researchMapProject)?.type === "project") {
        selected = saved.researchMapSelection;
        activeProject = saved.researchMapProject;
        render();
      } else {
        history.replaceState(selectionState(), "");
      }
      return;
    }
    const node = match && nodes.get(match[2]);
    if (!node || (node.type === "project") !== (match[1] === "project")) return;

    if (node.type === "project") {
      activeProject = node.id;
    } else {
      const fromHistory = nodes.get(history.state?.researchMapProject);
      const relatedProject = edgesFor(node.id).map(edge => neighbor(edge, node.id))
        .find(item => item.type === "project");
      activeProject = fromHistory?.type === "project"
        ? fromHistory.id
        : relatedProject?.id ?? data.default_project;
    }
    selected = node.id;
    history.replaceState(selectionState(), "");
    render();
    if (shouldScroll) map.scrollIntoView({ block: "start", behavior: "instant" });
  }

  function selectionState() {
    return { ...history.state, researchMapProject: activeProject, researchMapSelection: selected };
  }

  function populateProjects() {
    const groups = new Set(projects.map(project => project.group));
    for (const group of groups) {
      const options = element("optgroup");
      options.label = group;
      for (const project of projects.filter(item => item.group === group)) {
        const option = element("option", project.label);
        option.value = project.id;
        options.append(option);
      }
      select.append(options);
    }
    select.addEventListener("change", () => choose(select.value, false));
    reset.addEventListener("click", () => choose(activeProject));
  }

  function render() {
    const node = nodes.get(selected);
    select.value = activeProject;
    find("#selection-type").textContent = typeNames[node.type];
    title.textContent = node.label;
    find("#selection-summary").textContent = node.summary;
    const stage = find("#selection-stage");
    stage.textContent = node.stage || "";
    stage.hidden = !node.stage;
    find("#selection-sources").replaceChildren(...sourceLinks(node.source_ids));
    reset.hidden = selected === activeProject;
    renderFigure(node.figure);
    renderGraph();
    renderConnections();
  }

  function sourceLinks(ids) {
    const links = [];
    for (const id of new Set(ids)) {
      const source = sources.get(id);
      if (!source || new URL(source.url).protocol !== "https:") continue;
      const link = element("a", source.label);
      link.href = source.url;
      links.push(link);
    }
    return links;
  }

  function renderFigure(figure) {
    const box = find("#selection-figure");
    box.replaceChildren();
    box.hidden = !figure;
    if (!figure) return;
    const link = element("a");
    link.href = figure.source;
    const image = element("img");
    image.src = figure.src;
    image.alt = figure.alt;
    image.width = figure.width;
    image.height = figure.height;
    image.loading = "lazy";
    image.decoding = "async";
    link.append(image);
    box.append(link, element("figcaption", figure.caption));
  }

  function renderConnections() {
    const items = edgesFor(selected).map(edge => {
      const node = neighbor(edge, selected);
      const item = element("li", undefined, "map-connection");
      const button = element("button", node.label, "map-connection-button");
      button.type = "button";
      button.addEventListener("click", () => choose(node.id));
      item.append(button, element("p", relation(edge, selected), "map-connection-relation"));
      const links = element("div", undefined, "map-source-links");
      links.append(...sourceLinks(edge.source_ids));
      if (links.childElementCount) item.append(links);
      if (edge.note) item.append(element("p", edge.note, "map-connection-note"));
      return item;
    });
    connections.replaceChildren(...items);
  }

  function renderGraph() {
    const center = nodes.get(selected);
    const connections = edgesFor(selected);
    const compact = narrow.matches;
    const origin = compact ? { x: 210, y: 55 } : { x: 500, y: 315 };
    const height = compact ? Math.max(200, 116 + 98 * Math.ceil(connections.length / 2)) : 630;
    svg.setAttribute("viewBox", `0 0 ${compact ? 420 : 1000} ${height}`);
    find("#svg-title").textContent = `${center.label} · direct connections`;

    const children = [];
    const points = connections.map((edge, index) => {
      if (compact) {
        const x = connections.length === 1 ? origin.x : 104 + 212 * (index % 2);
        return { edge, x, y: 154 + 98 * Math.floor(index / 2) };
      }
      const radians = (-90 + 360 * index / connections.length) * Math.PI / 180;
      return {
        edge,
        x: origin.x + 370 * Math.cos(radians),
        y: origin.y + 222 * Math.sin(radians),
      };
    });
    for (const { x, y } of points) {
      children.push(graphElement("line", {
        x1: origin.x, y1: origin.y, x2: x, y2: y, class: "map-edge",
      }));
    }
    children.push(renderNode(center, origin.x, origin.y, true, compact));
    for (const { edge, x, y } of points) {
      children.push(renderNode(neighbor(edge, selected), x, y, false, compact));
    }
    drawing.replaceChildren(...children);
    drawing.classList.remove("map-drawing-enter");
    requestAnimationFrame(() => drawing.classList.add("map-drawing-enter"));
  }

  function renderNode(node, x, y, center, compact) {
    const width = center ? 240 : compact ? 182 : 190;
    const height = center ? 84 : 78;
    const label = `${node.label} · ${typeNames[node.type]}`;
    const group = graphElement("g", {
      class: center ? "map-node map-node-center" : "map-node",
      "data-type": node.type,
      transform: `translate(${x},${y})`,
      tabindex: 0,
      role: "button",
      "aria-label": label,
    });
    group.append(
      graphElement("title", {}, label),
      graphElement("rect", { x: -width / 2, y: -height / 2, width, height, rx: 12 }),
    );
    const lines = wrapLabel(node.label, center ? 23 : 18);
    const text = graphElement("text", { y: -(lines.length - 1) * 8 - 2 });
    lines.forEach((line, index) => text.append(graphElement("tspan", { x: 0, dy: index ? 16 : 0 }, line)));
    group.append(text, graphElement("text", {
      x: 0, y: height / 2 - 9, class: "map-node-type",
    }, typeNames[node.type]));
    group.addEventListener("click", () => choose(node.id));
    group.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      choose(node.id);
    });
    return group;
  }

  populateProjects();
  render();
  find(".map-layout").hidden = false;
  find(".map-controls").hidden = false;
  find(".map-fallback").hidden = true;
  route(location.hash.startsWith("#map-") || standalone);
  if (location.hash === "#connections-text" || location.hash === "#graph-heading") {
    find(location.hash).scrollIntoView({ block: "start", behavior: "instant" });
  }
  narrow.addEventListener("change", renderGraph);
  addEventListener("hashchange", () => route(!standalone));
  addEventListener("popstate", event => {
    if (!location.hash && event.state === null) {
      activeProject = data.default_project;
      selected = activeProject;
      render();
    }
  });
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function graphElement(tag, attributes, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function wrapLabel(label, maxLength) {
  const lines = [];
  let line = "";
  for (const word of label.split(/\s+/)) {
    const visibleWord = word.length > maxLength ? `${word.slice(0, maxLength - 1)}…` : word;
    if (line && line.length + word.length + 1 > maxLength) {
      lines.push(line);
      line = visibleWord;
    } else {
      line += (line ? " " : "") + visibleWord;
    }
  }
  if (line) lines.push(line);
  return lines.length > 3 ? [...lines.slice(0, 2), `${lines[2].trimEnd()}…`] : lines;
}

const calendar = document.querySelector(".contribution-calendar img");
if (calendar) {
  const showSavedCalendar = () => { calendar.src = "assets/github-contributions.svg"; };
  calendar.addEventListener("error", showSavedCalendar, { once: true });
  if (calendar.complete && !calendar.naturalWidth) showSavedCalendar();
}

const listLink = document.querySelector('.map-panel-heading a[href="#connections-text"]');
listLink?.addEventListener("click", () => {
  document.getElementById("connections-text").open = true;
});

const navigation = document.querySelector(".portfolio-masthead nav");
const menu = navigation?.querySelector(".menu-toggle");
if (menu) {
  const mobile = matchMedia("(max-width: 780px)");
  const setOpen = open => menu.setAttribute("aria-expanded", String(open));
  const sync = () => {
    menu.hidden = !mobile.matches;
    setOpen(false);
  };
  sync();
  mobile.addEventListener("change", sync);
  menu.addEventListener("click", () => setOpen(menu.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("click", event => {
    if (!navigation.contains(event.target) || event.target.closest("a")) setOpen(false);
  });
  navigation.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      menu.focus();
    }
  });
  navigation.addEventListener("focusout", event => {
    if (!navigation.contains(event.relatedTarget)) setOpen(false);
  });
}
