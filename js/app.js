(function () {
  const SESSION_KEY = "tertiary-brain-open";
  const PT = "America/Los_Angeles";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const ANATOMY = {
    life: "Frontal",
    work: "Parietal",
    house: "Temporal",
    professorship: "Occipital",
  };

  const SLOTS = {
    life: [
      [246, 150],
      [322, 126],
      [214, 204],
      [308, 196],
      [262, 188],
    ],
    work: [
      [486, 122],
      [566, 112],
      [524, 176],
      [448, 168],
      [590, 168],
    ],
    house: [
      [236, 358],
      [322, 350],
      [408, 356],
      [268, 396],
      [356, 398],
      [446, 388],
      [500, 360],
    ],
    professorship: [
      [708, 168],
      [754, 214],
      [700, 224],
      [768, 168],
    ],
  };

  const CENTROIDS = {
    life: [270, 180],
    work: [530, 150],
    house: [360, 380],
    professorship: [730, 200],
  };

  const state = {
    data: null,
    region: null,
    thoughtId: null,
    announced: false,
  };

  let lastPointer = false;

  const $ = (id) => document.getElementById(id);

  document.addEventListener("pointerdown", () => {
    lastPointer = true;
  });
  document.addEventListener("keydown", () => {
    lastPointer = false;
  });

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    apply(node, attrs);
    for (const child of children || []) node.append(child);
    return node;
  }

  function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    apply(node, attrs);
    return node;
  }

  function apply(node, attrs) {
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value == null || value === false) continue;
      if (key === "class") node.setAttribute("class", value);
      else node.setAttribute(key, value);
    }
  }

  function text(value) {
    return document.createTextNode(value == null ? "" : String(value));
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function hashesMatch(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function pacificISO(date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: PT,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function addDays(iso, days) {
    const [y, m, d] = iso.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + days));
    return next.toISOString().slice(0, 10);
  }

  function formatISO(iso) {
    const date = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  function formatUpdated(value) {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value || "");
    if (!match) return value ? `Updated ${value}` : "";
    const date = new Date(Date.UTC(+match[1].slice(0, 4), +match[1].slice(5, 7) - 1, +match[1].slice(8, 10)));
    const pretty = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
    return `Updated ${pretty}`;
  }

  function formatDue(due) {
    if (!due) return "";
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(due).trim());
    if (!match) return String(due).trim();
    const iso = match[1];
    const today = pacificISO(new Date());
    if (iso === today) return "Today";
    if (iso === addDays(today, 1)) return "Tomorrow";
    return formatISO(iso);
  }

  function rank(map, value, fallback) {
    return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : fallback;
  }

  function normalize(raw) {
    const categories = (raw.categories || []).map((category) => {
      const thoughts = (category.thoughts || []).map((thought, index) => ({
        id: String(thought.id || `${category.id}-${index + 1}`),
        title: String(thought.title || "Untitled"),
        notes: String(thought.notes || ""),
        status: thought.status || "active",
        priority: thought.priority || "medium",
        due: thought.due ? String(thought.due) : "",
        tags: Array.isArray(thought.tags) ? thought.tags.map(String) : [],
        categoryId: category.id,
        order: index,
      }));
      return {
        id: String(category.id),
        label: String(category.label || category.id),
        thoughts,
      };
    });
    return { updated: raw.updated || "", categories };
  }

  function sortedThoughts(thoughts) {
    const statusRank = { active: 0, waiting: 1, done: 2 };
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return thoughts.slice().sort((a, b) => {
      const byStatus = rank(statusRank, a.status, 3) - rank(statusRank, b.status, 3);
      if (byStatus) return byStatus;
      const byPriority = rank(priorityRank, a.priority, 3) - rank(priorityRank, b.priority, 3);
      if (byPriority) return byPriority;
      const aIso = /^(\d{4}-\d{2}-\d{2})/.exec(a.due || "");
      const bIso = /^(\d{4}-\d{2}-\d{2})/.exec(b.due || "");
      if (aIso && bIso && aIso[1] !== bIso[1]) return aIso[1] < bIso[1] ? -1 : 1;
      if (aIso && !bIso) return -1;
      if (!aIso && bIso) return 1;
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return a.order - b.order;
    });
  }

  function allThoughts() {
    if (!state.data) return [];
    return state.data.categories.flatMap((category) => category.thoughts);
  }

  function findThought(id) {
    return allThoughts().find((thought) => thought.id === id) || null;
  }

  function categoryById(id) {
    return state.data?.categories.find((category) => category.id === id) || null;
  }

  function isHot(thought) {
    return thought.priority === "high" && thought.status === "active";
  }

  function slotFor(categoryId, index) {
    const slots = SLOTS[categoryId];
    if (slots && slots[index]) return slots[index];
    const center = CENTROIDS[categoryId] || [480, 250];
    const n = index - (slots ? slots.length : 0);
    const angle = n * 2.399963;
    const radius = 22 + n * 14;
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
  }

  function statusLabel(status) {
    if (status === "waiting") return "Waiting";
    if (status === "done") return "Done";
    if (status === "active") return "Active";
    return status;
  }

  function priorityLabel(priority) {
    if (priority === "high") return "High";
    if (priority === "medium") return "Medium";
    if (priority === "low") return "Low";
    return priority;
  }

  function announce(message) {
    const live = $("live");
    if (!live) return;
    live.textContent = "";
    requestAnimationFrame(() => {
      live.textContent = message;
    });
  }

  function captureFocus() {
    const node = document.activeElement;
    if (!node || node === document.body) return null;
    return {
      thought: node.getAttribute("data-thought"),
      region: node.getAttribute("data-region"),
      action: node.getAttribute("data-action"),
      chip: node.classList.contains("chip"),
      lobe: node.classList.contains("lobe"),
      node: node.classList.contains("node"),
    };
  }

  function restoreFocus(saved) {
    if (!saved || lastPointer) return;
    let selector = "";
    if (saved.thought && saved.node) selector = `.node[data-thought="${cssEscape(saved.thought)}"]`;
    else if (saved.thought) selector = `.thought[data-thought="${cssEscape(saved.thought)}"]`;
    else if (saved.chip) selector = `.chip[data-region="${cssEscape(saved.region || "")}"]`;
    else if (saved.lobe && saved.region) selector = `.lobe[data-region="${cssEscape(saved.region)}"]`;
    else if (saved.action) selector = `[data-action="${cssEscape(saved.action)}"]`;
    if (selector) document.querySelector(selector)?.focus();
  }

  function renderNodes() {
    const group = $("nodes");
    group.replaceChildren();
    if (!state.data) return;
    state.data.categories.forEach((category) => {
      category.thoughts.forEach((thought, index) => {
        const [x, y] = slotFor(category.id, index);
        const classes = ["node"];
        if (isHot(thought)) classes.push("is-hot");
        if (thought.status === "done") classes.push("is-done");
        if (state.region && thought.categoryId === state.region) classes.push("is-in-region");
        if (state.thoughtId === thought.id) classes.push("is-selected");
        const node = svg("g", {
          class: classes.join(" "),
          tabindex: "0",
          role: "button",
          "data-thought": thought.id,
          "data-region": category.id,
          "aria-label": `${thought.title}, ${category.label}, ${statusLabel(thought.status)}`,
          "aria-pressed": state.thoughtId === thought.id ? "true" : "false",
        });
        node.append(
          svg("circle", { class: "hit", cx: x, cy: y, r: 18 }),
          svg("circle", { class: "pulse", cx: x, cy: y, r: 7 }),
          svg("circle", { class: "ring", cx: x, cy: y, r: 6.5 }),
          svg("circle", { class: "core", cx: x, cy: y, r: 3.5 }),
          svg("circle", { class: "core-tint", cx: x, cy: y, r: 3.5 })
        );
        group.append(node);
      });
    });
  }

  function renderLobes() {
    const brain = $("brain");
    brain.classList.toggle("is-filtered", Boolean(state.region));
    document.querySelectorAll(".lobe").forEach((lobe) => {
      const id = lobe.getAttribute("data-region");
      const category = categoryById(id);
      const count = category ? category.thoughts.length : 0;
      const label = category ? category.label : id;
      const active = state.region === id;
      lobe.classList.toggle("is-active", active);
      lobe.setAttribute("aria-pressed", active ? "true" : "false");
      lobe.setAttribute("aria-label", `${label}, ${count} thought${count === 1 ? "" : "s"}`);
      const textNode = document.getElementById(`label-${id}`);
      if (textNode && category) textNode.textContent = category.label;
    });
  }

  function renderChips() {
    const bar = $("chips");
    bar.replaceChildren();
    if (!state.data) return;
    const total = allThoughts().length;
    const items = [{ id: "", label: "All", count: total }].concat(
      state.data.categories.map((category) => ({
        id: category.id,
        label: category.label,
        count: category.thoughts.length,
      }))
    );
    for (const item of items) {
      const pressed = (state.region || "") === item.id;
      const button = el("button", {
        type: "button",
        class: "chip",
        "data-region": item.id,
        "aria-pressed": pressed ? "true" : "false",
      });
      if (item.id) button.append(el("span", { class: "dot", "aria-hidden": "true" }));
      button.append(text(item.label), el("span", { class: "count" }, [text(String(item.count))]));
      bar.append(button);
    }
  }

  function metaLine(thought) {
    const parts = [statusLabel(thought.status), priorityLabel(thought.priority)];
    const due = formatDue(thought.due);
    if (due) parts.push(due);
    return parts.join(" · ");
  }

  function thoughtButton(thought) {
    const classes = ["thought"];
    if (thought.status === "done") classes.push("is-done");
    if (isHot(thought)) classes.push("is-hot");
    const button = el(
      "button",
      {
        type: "button",
        class: classes.join(" "),
        "data-thought": thought.id,
        "data-region": thought.categoryId,
        "aria-current": state.thoughtId === thought.id ? "true" : "false",
      },
      [
        el("span", {}, [
          el("span", { class: "thought-title" }, [text(thought.title)]),
          el("span", { class: "thought-meta" }, [text(metaLine(thought))]),
        ]),
      ]
    );
    if (isHot(thought)) button.append(el("span", { class: "hot-mark", "aria-hidden": "true" }));
    return button;
  }

  function renderDetail(thought) {
    const category = categoryById(thought.categoryId);
    const pills = [
      el("li", { class: thought.status === "waiting" ? "is-waiting" : "is-accent" }, [text(statusLabel(thought.status))]),
      el("li", { class: thought.priority === "high" ? "is-accent" : "" }, [text(priorityLabel(thought.priority))]),
    ];
    const due = formatDue(thought.due);
    if (due) pills.push(el("li", {}, [text(due)]));

    const card = el(
      "article",
      { class: "detail", id: "detail", "data-region": thought.categoryId },
      [
        el("div", { class: "detail-top" }, [
          el("div", {}, [
            el("p", { class: "kicker" }, [text(category ? category.label : thought.categoryId)]),
            el("h3", {}, [text(thought.title)]),
          ]),
          el("button", { type: "button", class: "text-btn", "data-action": "clear-thought" }, [text("Close")]),
        ]),
        el("ul", { class: "pills" }, pills),
      ]
    );
    if (thought.notes) card.append(el("p", { class: "notes" }, [text(thought.notes)]));
    if (thought.tags.length) {
      card.append(el("ul", { class: "tags" }, thought.tags.map((tag) => el("li", {}, [text(tag)]))));
    }
    return card;
  }

  function renderList(categories) {
    const wrap = el("div", { class: "groups" });
    const showGroups = !state.region && categories.length > 1;
    categories.forEach((category) => {
      const group = el("section", { class: "group", "data-region": category.id });
      if (showGroups) {
        group.append(
          el(
            "button",
            { type: "button", class: "group-h", "data-region": category.id },
            [
              el("span", { class: "dot", "aria-hidden": "true" }),
              text(category.label),
              el("span", { class: "count" }, [text(String(category.thoughts.length))]),
            ]
          )
        );
      }
      if (!category.thoughts.length) {
        group.append(el("p", { class: "empty" }, [text("Nothing parked here.")]));
      } else {
        sortedThoughts(category.thoughts).forEach((thought) => group.append(thoughtButton(thought)));
      }
      wrap.append(group);
    });
    return wrap;
  }

  function renderPanel() {
    const body = $("panel-body");
    body.replaceChildren();
    if (!state.data) {
      body.append(el("p", { class: "status-line" }, [text("Reading thoughts…")]));
      return;
    }

    const selected = state.region ? categoryById(state.region) : null;
    const visible = selected ? [selected] : state.data.categories;
    const count = visible.reduce((sum, category) => sum + category.thoughts.length, 0);
    const kicker = selected
      ? `${ANATOMY[selected.id] || "Lobe"} · ${count}`
      : `${count} thought${count === 1 ? "" : "s"}`;
    const title = selected ? selected.label : "All thoughts";

    const head = el("div", { class: "panel-head" }, [
      el("div", {}, [el("p", { class: "kicker", "data-region": selected ? selected.id : "" }, [text(kicker)]), el("h2", {}, [text(title)])]),
    ]);
    if (selected) {
      head.append(el("button", { type: "button", class: "text-btn", "data-action": "clear-region" }, [text("All lobes")]));
    }
    body.append(head);

    const thought = state.thoughtId ? findThought(state.thoughtId) : null;
    if (thought && (!state.region || thought.categoryId === state.region)) {
      body.append(renderDetail(thought));
    }
    body.append(renderList(visible));
  }

  function renderHeader() {
    const urgent = $("urgent");
    const updated = $("updated");
    if (!state.data) {
      urgent.hidden = true;
      updated.textContent = "";
      return;
    }
    const hot = allThoughts().filter(isHot).length;
    urgent.hidden = hot === 0;
    urgent.textContent = hot === 1 ? "1 urgent" : `${hot} urgent`;
    updated.textContent = formatUpdated(state.data.updated);
  }

  function render() {
    const saved = captureFocus();
    renderHeader();
    renderLobes();
    renderChips();
    renderNodes();
    renderPanel();
    restoreFocus(saved);
  }

  function selectRegion(id) {
    const next = id || null;
    state.region = state.region === next ? null : next;
    if (state.thoughtId) {
      const thought = findThought(state.thoughtId);
      if (state.region && thought && thought.categoryId !== state.region) state.thoughtId = null;
    }
    render();
    const label = state.region ? categoryById(state.region)?.label || state.region : "All lobes";
    announce(state.region ? `${label} lobe` : "All thoughts");
  }

  function selectThought(id, fromBrain) {
    const thought = findThought(id);
    if (!thought) return;
    state.thoughtId = thought.id;
    state.region = thought.categoryId;
    render();
    announce(`${thought.title}. ${metaLine(thought)}.`);
    if (fromBrain) {
      const detail = $("detail");
      if (detail) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        detail.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
      }
    }
  }

  async function loadData() {
    $("panel-body").replaceChildren(el("p", { class: "status-line" }, [text("Reading thoughts…")]));
    try {
      const response = await fetch("data/thoughts.json", { cache: "no-store" });
      if (!response.ok) throw new Error("http");
      const raw = await response.json();
      if (!raw || !Array.isArray(raw.categories)) throw new Error("shape");
      state.data = normalize(raw);
      render();
      if (!state.announced) {
        state.announced = true;
        const count = allThoughts().length;
        announce(`Tertiary Brain open. ${count} thought${count === 1 ? "" : "s"}.`);
      }
    } catch (err) {
      state.data = null;
      const message =
        err && err.message === "shape"
          ? "thoughts.json didn’t parse into categories. Check the commas and reload."
          : "Couldn’t load thoughts. Serve this folder over HTTP, then reload.";
      $("panel-body").replaceChildren(el("p", { class: "status-line" }, [text(message)]));
    }
  }

  function lock() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (err) {
      /* ignore */
    }
    document.documentElement.classList.remove("is-open");
    state.data = null;
    state.region = null;
    state.thoughtId = null;
    state.announced = false;
    $("nodes").replaceChildren();
    $("panel-body").replaceChildren();
    $("chips").replaceChildren();
    $("password").value = "";
    $("gate-error").textContent = "";
    hideTip();
    $("password").focus();
  }

  function hideTip() {
    const tip = $("tip");
    tip.hidden = true;
    tip.textContent = "";
  }

  function showTip(node) {
    const thought = findThought(node.getAttribute("data-thought"));
    if (!thought) return;
    const rect = node.querySelector(".core").getBoundingClientRect();
    const tip = $("tip");
    tip.textContent = thought.title;
    tip.hidden = false;
    const left = Math.min(window.innerWidth - 16, Math.max(16, rect.left + rect.width / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${rect.top}px`;
  }

  async function onSubmit(event) {
    event.preventDefault();
    const input = $("password");
    const error = $("gate-error");
    error.textContent = "";
    const config = window.TERTIARY_BRAIN || {};
    if (!config.passwordHash) {
      error.textContent = "The gate is missing its hash in js/config.js.";
      return;
    }
    if (!window.crypto?.subtle) {
      error.textContent = "Unlock needs localhost or https. A file:// tab can’t hash the password.";
      return;
    }
    const digest = (await sha256(input.value)).toLowerCase();
    if (hashesMatch(digest, String(config.passwordHash).toLowerCase())) {
      input.value = "";
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch (err) {
        /* unlocking still works for this view; a refresh would ask again */
      }
      document.documentElement.classList.add("is-open");
      await loadData();
      return;
    }
    error.textContent = "That doesn’t open it.";
    const form = $("gate-form");
    form.classList.remove("is-shaking");
    void form.offsetWidth;
    form.classList.add("is-shaking");
    input.focus();
    input.select();
  }

  function onBrainClick(event) {
    const thought = event.target.closest(".node");
    if (thought) {
      selectThought(thought.getAttribute("data-thought"), true);
      return;
    }
    const lobe = event.target.closest(".lobe");
    if (lobe) selectRegion(lobe.getAttribute("data-region"));
  }

  function onBrainKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const thought = event.target.closest(".node");
    const lobe = event.target.closest(".lobe");
    if (!thought && !lobe) return;
    event.preventDefault();
    if (thought) selectThought(thought.getAttribute("data-thought"), true);
    else selectRegion(lobe.getAttribute("data-region"));
  }

  function onChipsClick(event) {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    selectRegion(chip.getAttribute("data-region"));
  }

  function onPanelClick(event) {
    const action = event.target.closest("[data-action]");
    if (action) {
      if (action.getAttribute("data-action") === "clear-thought") state.thoughtId = null;
      if (action.getAttribute("data-action") === "clear-region") {
        state.region = null;
        state.thoughtId = null;
      }
      render();
      return;
    }
    const thought = event.target.closest(".thought");
    if (thought) {
      selectThought(thought.getAttribute("data-thought"), false);
      return;
    }
    const region = event.target.closest(".group-h");
    if (region) selectRegion(region.getAttribute("data-region"));
  }

  function bind() {
    $("gate-form").addEventListener("submit", onSubmit);
    $("lock").addEventListener("click", lock);
    $("brain").addEventListener("click", onBrainClick);
    $("brain").addEventListener("keydown", onBrainKeydown);
    $("chips").addEventListener("click", onChipsClick);
    $("panel").addEventListener("click", onPanelClick);
    $("brain").addEventListener("pointerover", (event) => {
      const node = event.target.closest(".node");
      if (!node || event.pointerType === "touch") return;
      showTip(node);
    });
    $("brain").addEventListener("pointerout", (event) => {
      const node = event.target.closest(".node");
      if (!node) return;
      hideTip();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!document.documentElement.classList.contains("is-open")) return;
      if (state.thoughtId) {
        state.thoughtId = null;
        render();
        return;
      }
      if (state.region) {
        state.region = null;
        render();
      }
    });
  }

  bind();
  if (document.documentElement.classList.contains("is-open")) {
    loadData();
  } else {
    $("password").focus();
  }
})();
