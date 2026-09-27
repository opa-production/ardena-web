// Newsroom (/newsroom, /newsroom/:slug). Shared data layer plus the listing
// and article page controllers. The editor lives in newsroom-editor.js.
//
// Mock mode serves the stories in newsroom-mock.js instead of calling the API.
// It is on for localhost and preview deploys, and can be forced with ?mock=1
// or turned off with ?mock=0. Production (ardena.co.ke) always uses the API.
(function () {
  "use strict";

  var TOKEN_KEY = "ardena_newsroom_token";
  var LOCAL_KEY = "ardena_newsroom_local_stories";
  var CATEGORIES = ["Company", "Product", "Hosts", "Safety", "Travel", "Community"];
  var PAGE_SIZE = 9;

  // ------------------------------------------------------------ environment
  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function sGet(kind, k) { try { var s = store(kind); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function sSet(kind, k, v) { try { var s = store(kind); if (s) s.setItem(k, v); } catch (e) {} }
  function sDel(kind, k) { try { var s = store(kind); if (s) s.removeItem(k); } catch (e) {} }

  var host = window.location.hostname;
  var isLocal = host === "localhost" || host === "127.0.0.1" || window.location.protocol === "file:";
  var params = new URLSearchParams(window.location.search);
  if (params.get("mock") === "1") sSet("sessionStorage", "ardena_newsroom_mock", "1");
  if (params.get("mock") === "0") sDel("sessionStorage", "ardena_newsroom_mock");
  var MOCK =
    params.get("mock") !== "0" &&
    (sGet("sessionStorage", "ardena_newsroom_mock") === "1" || !/(^|\.)ardena\.co\.ke$/.test(host));

  function apiBase() {
    if (typeof getApiBase === "function") return getApiBase();
    return "https://api.ardena.xyz";
  }

  // Live Server has no rewrites, so local links point at the .html files.
  var urls = {
    list: function () { return isLocal ? "/newsroom.html" : "/newsroom"; },
    article: function (slug) {
      return isLocal ? "/newsroom-article.html?slug=" + encodeURIComponent(slug) : "/newsroom/" + encodeURIComponent(slug);
    },
    write: function (slug) {
      var base = isLocal ? "/newsroom-write.html" : "/newsroom/write";
      return slug ? base + "?slug=" + encodeURIComponent(slug) : base;
    },
  };

  // ------------------------------------------------------------ helpers
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function slugify(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "story";
  }

  // Allowlist sanitiser for article bodies. The backend sanitises too; this
  // is a second line of defence before anything reaches innerHTML.
  var ALLOWED = {
    P: [], H2: [], H3: [], STRONG: [], B: [], EM: [], I: [], U: [], BR: [], HR: [],
    BLOCKQUOTE: [], UL: [], OL: [], LI: [], FIGURE: [], FIGCAPTION: [],
    A: ["href"], IMG: ["src", "alt"],
  };
  function safeUrl(u, forImg) {
    u = String(u || "").trim();
    // Images come from Unsplash or were uploaded through the editor (our
    // storage, newsroom/ prefix). The API applies the same rule.
    if (forImg) {
      if (/^https:\/\/images\.unsplash\.com\//.test(u)) return u;
      if (/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/b2b-media\/newsroom\/[^?#]+$/.test(u) && u.indexOf("..") === -1) return u;
      if (MOCK && /^data:image\/(jpeg|png|webp);base64,/.test(u)) return u;
      return "";
    }
    return /^(https?:|mailto:|\/(?!\/))/i.test(u) ? u : "";
  }
  function sanitize(html) {
    var doc = new DOMParser().parseFromString("<div>" + (html || "") + "</div>", "text/html");
    var root = doc.body.firstChild;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1) { child.remove(); return; }
        var tag = child.tagName;
        if (tag === "DIV") {
          // contenteditable sometimes wraps lines in divs: treat them as paragraphs
          var p = doc.createElement("p");
          while (child.firstChild) p.appendChild(child.firstChild);
          child.replaceWith(p);
          child = p;
          tag = "P";
        }
        if (!ALLOWED[tag]) {
          if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|svg|TEMPLATE)$/i.test(tag)) { child.remove(); return; }
          walk(child);
          while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
          child.remove();
          return;
        }
        Array.prototype.slice.call(child.attributes).forEach(function (a) {
          if (ALLOWED[tag].indexOf(a.name) === -1) child.removeAttribute(a.name);
        });
        if (tag === "A") {
          var href = safeUrl(child.getAttribute("href"));
          if (!href) child.removeAttribute("href");
          else {
            child.setAttribute("href", href);
            if (/^https?:/i.test(href)) { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noopener noreferrer"); }
          }
        }
        if (tag === "IMG") {
          var src = safeUrl(child.getAttribute("src"), true);
          if (!src) { child.remove(); return; }
          child.setAttribute("src", src);
          child.setAttribute("loading", "lazy");
        }
        walk(child);
      });
    })(root);
    return root.innerHTML;
  }

  // ------------------------------------------------------------ data layer
  function token() { return sGet("localStorage", TOKEN_KEY); }

  function request(method, path, body) {
    var headers = { Accept: "application/json" };
    var t = token();
    if (t) headers.Authorization = "Bearer " + t;
    if (body) headers["Content-Type"] = "application/json";
    return fetch(apiBase() + "/api/v1/newsroom" + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      if (res.status === 401) sDel("localStorage", TOKEN_KEY);
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) {}
        if (!res.ok) {
          var detail = data && (data.detail || data.message);
          // FastAPI validation errors come back as a list; show the first one.
          if (Array.isArray(detail)) detail = detail[0] && detail[0].msg;
          var err = new Error(detail || "HTTP " + res.status);
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function localStories() {
    try { return JSON.parse(sGet("localStorage", LOCAL_KEY) || "[]"); } catch (e) { return []; }
  }
  function mockAll() {
    var base = (window.ARDENA_NEWSROOM_MOCK && window.ARDENA_NEWSROOM_MOCK.stories) || [];
    var local = localStories();
    var localSlugs = local.map(function (s) { return s.slug; });
    return local
      .concat(base.filter(function (s) { return localSlugs.indexOf(s.slug) === -1; }))
      .filter(function (s) { return s.status !== "draft"; })
      .sort(function (a, b) { return b.published_at < a.published_at ? -1 : 1; });
  }
  function resolve(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 120); }); }

  var api = {
    mock: MOCK,
    list: function (opts) {
      opts = opts || {};
      var offset = opts.offset || 0;
      var limit = opts.limit || PAGE_SIZE;
      if (MOCK) {
        var all = mockAll().filter(function (s) {
          return (!opts.category || s.category === opts.category) && s.slug !== opts.exclude;
        });
        var items = all.slice(offset, offset + limit);
        return resolve({ items: items, offset: offset, limit: limit, total: all.length, has_more: offset + limit < all.length });
      }
      var q = "?offset=" + offset + "&limit=" + limit;
      if (opts.category) q += "&category=" + encodeURIComponent(opts.category);
      if (opts.exclude) q += "&exclude=" + encodeURIComponent(opts.exclude);
      return request("GET", "/articles" + q);
    },
    get: function (slug) {
      if (MOCK) {
        var local = localStories().filter(function (s) { return s.slug === slug; })[0];
        var hit = local || mockAll().filter(function (s) { return s.slug === slug; })[0];
        if (!hit) { var e = new Error("Not found"); e.status = 404; return Promise.reject(e); }
        return resolve(hit);
      }
      return request("GET", "/articles/" + encodeURIComponent(slug));
    },
    me: function () {
      if (MOCK) return resolve({ id: "mock", name: "Preview publisher", can_publish: true });
      if (!token()) return Promise.resolve(null);
      return request("GET", "/me").catch(function () { return null; });
    },
    login: function (email, password) {
      return request("POST", "/auth/login", { email: email, password: password }).then(function (data) {
        sSet("localStorage", TOKEN_KEY, data.token);
        return data.user;
      });
    },
    logout: function () { sDel("localStorage", TOKEN_KEY); },
    // Anyone can ask to write; an Ardena admin approves and emails a link.
    requestAccess: function (body) {
      if (MOCK) return resolve({ detail: "Preview: no request was sent." });
      return request("POST", "/editor-requests", body);
    },
    // Who an invite or reset link (?invite= / ?reset=) is for.
    tokenInfo: function (linkToken) {
      if (MOCK) return resolve({ purpose: "invite", name: "Preview writer", email: "writer@example.com" });
      return request("POST", "/auth/token-info", { token: linkToken });
    },
    // Redeem the link with a new password; signs the editor in.
    setPassword: function (linkToken, password) {
      if (MOCK) return resolve({ id: "mock", name: "Preview writer", can_publish: true });
      return request("POST", "/auth/set-password", { token: linkToken, password: password }).then(function (data) {
        sSet("localStorage", TOKEN_KEY, data.token);
        return data.user;
      });
    },
    forgotPassword: function (email) {
      if (MOCK) return resolve({ detail: "Preview: no email was sent." });
      return request("POST", "/auth/forgot-password", { email: email });
    },
    save: function (article) {
      if (MOCK) {
        var list = localStories().filter(function (s) { return s.slug !== article.slug && s.id !== article.id; });
        article.id = article.id || "local-" + Date.now();
        article.slug = article.slug || slugify(article.title);
        article.published_at = article.published_at || new Date().toISOString().slice(0, 10);
        article.reading_minutes = Math.max(2, Math.round(article.body.replace(/<[^>]+>/g, " ").split(/\s+/).length / 200));
        list.unshift(article);
        sSet("localStorage", LOCAL_KEY, JSON.stringify(list));
        return resolve(article);
      }
      return article.id
        ? request("PATCH", "/articles/" + encodeURIComponent(article.id), article)
        : request("POST", "/articles", article);
    },
    // An image from the writer's computer. Multipart, so it can't go through
    // request(), which sends JSON.
    uploadImage: function (file) {
      if (MOCK) {
        return new Promise(function (ok, fail) {
          var reader = new FileReader();
          reader.onload = function () { ok({ id: "local", url: reader.result, thumb: reader.result, alt: "", source: "upload" }); };
          reader.onerror = fail;
          reader.readAsDataURL(file);
        });
      }
      var form = new FormData();
      form.append("file", file);
      var headers = { Accept: "application/json" };
      var t = token();
      if (t) headers.Authorization = "Bearer " + t;
      return fetch(apiBase() + "/api/v1/newsroom/uploads", { method: "POST", headers: headers, body: form })
        .then(function (res) {
          if (res.status === 401) sDel("localStorage", TOKEN_KEY);
          return res.json().catch(function () { return null; }).then(function (data) {
            if (!res.ok) {
              var detail = data && (data.detail || data.message);
              if (Array.isArray(detail)) detail = detail[0] && detail[0].msg;
              var err = new Error(detail || "HTTP " + res.status);
              err.status = res.status;
              throw err;
            }
            return data;
          });
        });
    },
    searchPhotos: function (query, page) {
      page = page || 1;
      if (MOCK) {
        var lib = (window.ARDENA_NEWSROOM_MOCK && window.ARDENA_NEWSROOM_MOCK.library) || [];
        var words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
        var hits = words.length
          ? lib.filter(function (p) {
              var hay = (p.tags + " " + p.alt).toLowerCase();
              return words.some(function (w) { return hay.indexOf(w) !== -1; });
            })
          : lib;
        return resolve({ results: hits, total_pages: 1 });
      }
      return request("GET", "/unsplash/search?query=" + encodeURIComponent(query || "car") + "&page=" + page);
    },
  };

  // ------------------------------------------------------------ shared UI
  var ICONS = {
    link: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };

  function initials(name) {
    return String(name || "A").trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  }

  function card(s, variant) {
    var img = s.cover_image || {};
    return (
      '<a class="nr-card' + (variant ? " nr-card--" + variant : "") + '" href="' + urls.article(s.slug) + '">' +
      '<div class="nr-card-media"><img src="' + esc(img.thumb || img.url) + '" alt="' + esc(img.alt || "") + '" loading="lazy"></div>' +
      '<div class="nr-card-body">' +
      '<p class="nr-meta"><span class="nr-cat">' + esc(s.category) + "</span><span>" + formatDate(s.published_at) + "</span></p>" +
      '<h3 class="nr-card-title">' + esc(s.title) + "</h3>" +
      (variant === "feature" ? '<p class="nr-card-excerpt">' + esc(s.excerpt) + '</p><span class="nr-readmore">Read the story</span>' : "") +
      "</div></a>"
    );
  }

  function mockBanner() {
    if (!MOCK) return;
    var el = document.createElement("div");
    el.className = "nr-preview-flag";
    el.innerHTML = "Preview data. Stories here are samples until the newsroom API is live.";
    document.body.appendChild(el);
  }

  function showWriteButtons(slug) {
    // The Write icon is for everyone: the editor asks who you are, and offers
    // a way to request access if you aren't a writer yet.
    Array.prototype.forEach.call(document.querySelectorAll("[data-nr-write]"), function (el) {
      if (el.tagName === "A") el.href = urls.write();
      el.hidden = false;
    });
    api.me().then(function (me) {
      if (!me || !me.can_publish) return;
      Array.prototype.forEach.call(document.querySelectorAll("[data-nr-publisher]"), function (el) {
        if (el.tagName === "A") el.href = urls.write(el.hasAttribute("data-nr-edit") ? slug : null);
        el.hidden = false;
      });
    });
  }

  // ------------------------------------------------------------ dropdown
  // Custom listbox used for the listing filter and the editor's category.
  // dropdown(el, { items: [{ value, label }], value, placeholder, onChange })
  var CHEVRON = '<svg viewBox="0 0 12 8" width="10" height="7" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHECK = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ddCount = 0;

  function dropdown(el, opts) {
    var id = "nrdd" + ++ddCount;
    var value = opts.value || "";
    el.classList.add("nr-dd");
    el.innerHTML =
      '<button type="button" class="nr-dd-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + '"' +
      (el.getAttribute("data-label") ? ' aria-label="' + esc(el.getAttribute("data-label")) + '"' : "") + ">" +
      '<span class="nr-dd-value"></span>' + CHEVRON + "</button>" +
      '<ul class="nr-dd-menu" id="' + id + '" role="listbox" tabindex="-1" hidden>' +
      opts.items.map(function (it, i) {
        return '<li role="option" id="' + id + "-" + i + '" class="nr-dd-opt" data-value="' + esc(it.value) + '" aria-selected="false">' +
          "<span>" + esc(it.label) + "</span>" + CHECK + "</li>";
      }).join("") +
      "</ul>";
    var btn = el.querySelector(".nr-dd-btn");
    var menu = el.querySelector(".nr-dd-menu");
    var options = Array.prototype.slice.call(menu.querySelectorAll(".nr-dd-opt"));
    var active = -1;

    function render() {
      var hit = opts.items.filter(function (it) { return it.value === value; })[0];
      el.querySelector(".nr-dd-value").textContent = hit ? hit.label : opts.placeholder || "Select";
      btn.classList.toggle("is-placeholder", !hit);
      options.forEach(function (o) { o.setAttribute("aria-selected", o.getAttribute("data-value") === value ? "true" : "false"); });
    }
    function highlight(i) {
      active = Math.max(0, Math.min(options.length - 1, i));
      options.forEach(function (o, j) { o.classList.toggle("is-active", j === active); });
      options[active].scrollIntoView({ block: "nearest" });
      menu.setAttribute("aria-activedescendant", options[active].id);
    }
    function open() {
      menu.hidden = false;
      el.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      var cur = options.map(function (o) { return o.getAttribute("data-value"); }).indexOf(value);
      highlight(cur === -1 ? 0 : cur);
      menu.focus();
    }
    function close(focusBtn) {
      if (menu.hidden) return;
      menu.hidden = true;
      el.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      if (focusBtn) btn.focus();
    }
    function pick(i) {
      var v = options[i].getAttribute("data-value");
      close(true);
      if (v === value) return;
      value = v;
      render();
      if (opts.onChange) opts.onChange(value);
    }

    btn.addEventListener("click", function () { if (menu.hidden) open(); else close(); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
    });
    menu.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); highlight(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight(active - 1); }
      else if (e.key === "Home") { e.preventDefault(); highlight(0); }
      else if (e.key === "End") { e.preventDefault(); highlight(options.length - 1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
      else if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "Tab") close();
    });
    options.forEach(function (o, i) {
      o.addEventListener("mousemove", function () { if (active !== i) highlight(i); });
      o.addEventListener("click", function () { pick(i); });
    });
    document.addEventListener("click", function (e) { if (!el.contains(e.target)) close(); });

    render();
    return {
      get: function () { return value; },
      set: function (v) { value = v || ""; render(); },
    };
  }

  // ------------------------------------------------------------ listing page
  function initList() {
    var grid = document.getElementById("nrGrid");
    var featured = document.getElementById("nrFeatured");
    var more = document.getElementById("nrMore");
    var empty = document.getElementById("nrEmpty");
    var title = document.getElementById("nrGridTitle");
    var head = document.getElementById("nrGridHead");
    var state = { category: params.get("category") || "", offset: 0, lead: null };
    if (CATEGORIES.indexOf(state.category) === -1) state.category = "";

    var filter = dropdown(document.getElementById("nrFilter"), {
      items: [{ value: "", label: "All stories" }].concat(CATEGORIES.map(function (c) { return { value: c, label: c }; })),
      value: state.category,
      onChange: function (v) { setCategory(v); },
    });

    function setCategory(v) {
      state.category = v;
      filter.set(v);
      var u = new URL(window.location.href);
      if (v) u.searchParams.set("category", v);
      else u.searchParams.delete("category");
      history.replaceState(null, "", u);
      load(true);
    }

    // kind: "none" (no stories at all), "category" (filter has no matches),
    // "error" (API unreachable), or "" to hide.
    var emptyTitle = empty.querySelector(".nr-empty-title");
    var emptyText = empty.querySelector(".nr-empty-text");
    var emptyAction = empty.querySelector(".nr-empty-action");
    function setEmpty(kind) {
      empty.hidden = !kind;
      if (!kind) return;
      empty.className = "nr-empty nr-empty--" + kind;
      emptyAction.hidden = kind === "none";
      if (kind === "none") {
        emptyTitle.textContent = "No stories yet";
        emptyText.textContent = "News and updates from ardena will appear here.";
      } else if (kind === "error") {
        emptyTitle.textContent = "Couldn't load the newsroom";
        emptyText.textContent = "Check your connection and try again.";
        emptyAction.textContent = "Try again";
      } else {
        emptyTitle.textContent = "No " + state.category.toLowerCase() + " stories yet";
        emptyText.textContent = "";
        emptyAction.textContent = "Show all stories";
      }
    }
    emptyAction.addEventListener("click", function () {
      if (empty.classList.contains("nr-empty--error")) window.location.reload();
      else setCategory("");
    });

    function fail() {
      grid.innerHTML = "";
      grid.setAttribute("aria-busy", "false");
      featured.hidden = true;
      head.hidden = true;
      more.hidden = true;
      setEmpty("error");
    }

    function load(reset) {
      if (reset) {
        state.offset = 0;
        title.textContent = state.category || "Latest stories";
        grid.setAttribute("aria-busy", "true");
        grid.innerHTML = new Array(7).join('<div class="nr-card nr-card--skeleton"><div class="nr-card-media"></div><div class="nr-card-body"><span></span><span></span></div></div>');
      }
      more.disabled = true;
      api.list({ category: state.category, exclude: state.lead, offset: state.offset, limit: PAGE_SIZE })
        .then(function (data) {
          var items = data.items || [];
          state.offset += items.length;
          if (reset) grid.innerHTML = "";
          grid.insertAdjacentHTML("beforeend", items.map(function (s) { return card(s); }).join(""));
          grid.setAttribute("aria-busy", "false");
          var none = !grid.children.length;
          // With only the lead story and no filter, there's nothing to list below it.
          head.hidden = none && !state.category;
          setEmpty(none && state.category ? "category" : "");
          more.hidden = !data.has_more;
          more.disabled = false;
        })
        .catch(fail);
    }

    more.addEventListener("click", function () { load(false); });

    // The lead story stays put; the filter only drives the grid below it.
    api.list({ offset: 0, limit: 1 })
      .then(function (data) {
        var lead = (data.items || [])[0];
        if (!lead) {
          // Nothing published yet: one calm message instead of an empty grid.
          grid.innerHTML = "";
          grid.setAttribute("aria-busy", "false");
          head.hidden = true;
          setEmpty("none");
          return;
        }
        state.lead = lead.slug;
        featured.innerHTML = card(lead, "feature");
        featured.hidden = false;
        load(true);
      })
      .catch(fail);
    showWriteButtons();
  }

  // ------------------------------------------------------------ article page
  function currentSlug() {
    var s = params.get("slug");
    if (s) return s;
    var m = window.location.pathname.match(/^\/newsroom\/([^/?#]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function initArticle() {
    var root = document.getElementById("nrArticle");
    var slug = currentSlug();

    if (!slug) { notFound(); return; }

    api.get(slug)
      .then(function (s) {
        document.title = s.title + " - ardena newsroom";
        var desc = document.querySelector('meta[name="description"]');
        if (desc) desc.setAttribute("content", s.excerpt || "");
        var canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute("href", "https://ardena.co.ke/newsroom/" + encodeURIComponent(slug));
        var img = s.cover_image || {};
        var shareUrl = window.location.href.split("?")[0].replace(/\/newsroom-article\.html$/, "/newsroom/" + slug);
        var credit = img.photographer_name === "Unsplash"
          ? 'Photo: <a href="https://unsplash.com/?utm_source=ardena&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>'
          : img.photographer_name
          ? 'Photo by <a href="' + esc(img.photographer_url) + '?utm_source=ardena&utm_medium=referral" target="_blank" rel="noopener noreferrer">' + esc(img.photographer_name) + '</a> on <a href="https://unsplash.com/?utm_source=ardena&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>'
          : "";

        var author = s.author || "Ardena Newsroom";
        var avatar = s.author_avatar
          ? '<img class="nr-avatar" src="' + esc(s.author_avatar) + '" alt="">'
          : '<span class="nr-avatar nr-avatar--initials" aria-hidden="true">' + esc(initials(author)) + "</span>";

        root.innerHTML =
          '<header class="nr-article-head nr-wrap nr-wrap--text">' +
          '<a class="nr-crumb" href="' + urls.list() + "?category=" + encodeURIComponent(s.category) + '">' + esc(s.category) + "</a>" +
          '<h1 class="nr-article-title">' + esc(s.title) + "</h1>" +
          '<div class="nr-byline">' +
          '<div class="nr-author">' + avatar +
          '<div><p class="nr-author-name">' + esc(author) + "</p>" +
          '<p class="nr-author-meta">' + (s.author_title ? esc(s.author_title) + " &middot; " : "") +
          formatDate(s.published_at) + " &middot; " + (s.reading_minutes || 3) + " min read</p></div></div>" +
          '<div class="nr-actions">' +
          '<button type="button" class="nr-icon-btn nr-copy" data-tip="Copy link" aria-label="Copy link">' + ICONS.link + "</button>" +
          '<div class="nr-share-wrap">' +
          '<button type="button" class="nr-icon-btn nr-share-btn" data-tip="Share" aria-label="Share" aria-haspopup="menu" aria-expanded="false">' + ICONS.share + "</button>" +
          '<div class="nr-share-menu" role="menu" hidden>' +
          '<a role="menuitem" href="https://wa.me/?text=' + encodeURIComponent(s.title + " " + shareUrl) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' +
          '<a role="menuitem" href="https://x.com/intent/post?url=' + encodeURIComponent(shareUrl) + "&text=" + encodeURIComponent(s.title) + '" target="_blank" rel="noopener noreferrer">X</a>' +
          '<a role="menuitem" href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl) + '" target="_blank" rel="noopener noreferrer">LinkedIn</a>' +
          '<a role="menuitem" href="mailto:?subject=' + encodeURIComponent(s.title) + "&body=" + encodeURIComponent(shareUrl) + '">Email</a>' +
          "</div></div>" +
          '<a class="nr-icon-btn" data-nr-publisher data-nr-edit data-tip="Edit story" aria-label="Edit story" hidden>' + ICONS.edit + "</a>" +
          "</div></div>" +
          (s.excerpt ? '<p class="nr-article-dek">' + esc(s.excerpt) + "</p>" : "") +
          "</header>" +
          (img.url
            ? '<figure class="nr-article-cover nr-wrap nr-wrap--wide"><img src="' + esc(img.url) + '" alt="' + esc(img.alt || "") + '">' +
              (credit ? "<figcaption>" + credit + "</figcaption>" : "") + "</figure>"
            : "") +
          '<div class="nr-article-body nr-prose nr-wrap nr-wrap--text">' + sanitize(s.body) + "</div>";

        var copy = root.querySelector(".nr-copy");
        copy.addEventListener("click", function () {
          var done = function () {
            copy.innerHTML = ICONS.check;
            copy.setAttribute("data-tip", "Copied");
            copy.classList.add("is-done");
            setTimeout(function () {
              copy.innerHTML = ICONS.link;
              copy.setAttribute("data-tip", "Copy link");
              copy.classList.remove("is-done");
            }, 1800);
          };
          if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(done, function () {});
        });

        var shareBtn = root.querySelector(".nr-share-btn");
        var shareMenu = root.querySelector(".nr-share-menu");
        function closeShare() { shareMenu.hidden = true; shareBtn.setAttribute("aria-expanded", "false"); }
        shareBtn.addEventListener("click", function () {
          // Phones get the native share sheet; desktops get the small menu.
          if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
            navigator.share({ title: s.title, text: s.excerpt || "", url: shareUrl }).catch(function () {});
            return;
          }
          var opening = shareMenu.hidden;
          shareMenu.hidden = !opening;
          shareBtn.setAttribute("aria-expanded", opening ? "true" : "false");
        });
        document.addEventListener("click", function (e) { if (!e.target.closest(".nr-share-wrap")) closeShare(); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeShare(); });

        showWriteButtons(slug);
        loadRelated(s);
      })
      .catch(function (err) {
        if (err && err.status === 404) notFound();
        else root.innerHTML = '<div class="nr-wrap nr-wrap--text nr-state"><h1>We couldn\'t load this story</h1><p>Please check your connection and try again.</p><a class="nr-btn" href="' + urls.list() + '">Back to the newsroom</a></div>';
      });

    function notFound() {
      document.title = "Story not found - ardena newsroom";
      root.innerHTML =
        '<div class="nr-wrap nr-wrap--text nr-state"><img src="/assets/404.svg" alt="" width="180">' +
        "<h1>This story got eaten</h1><p>It may have been moved or taken down. The rest of the newsroom is still here.</p>" +
        '<a class="nr-btn" href="' + urls.list() + '">Back to the newsroom</a></div>';
    }
  }

  function loadRelated(s) {
    var section = document.getElementById("nrRelated");
    var grid = document.getElementById("nrRelatedGrid");
    api.list({ category: s.category, exclude: s.slug, limit: 3 })
      .then(function (data) {
        var items = data.items || [];
        if (items.length < 3) {
          return api.list({ exclude: s.slug, limit: 6 }).then(function (d2) {
            var seen = items.map(function (i) { return i.slug; });
            (d2.items || []).forEach(function (i) { if (items.length < 3 && seen.indexOf(i.slug) === -1) items.push(i); });
            return items;
          });
        }
        return items;
      })
      .then(function (items) {
        if (!items.length) return;
        grid.innerHTML = items.map(function (i) { return card(i); }).join("");
        section.hidden = false;
      })
      .catch(function () {});
  }

  // ------------------------------------------------------------ boot
  window.ArdenaNewsroom = {
    api: api,
    urls: urls,
    esc: esc,
    sanitize: sanitize,
    slugify: slugify,
    formatDate: formatDate,
    categories: CATEGORIES,
    mockBanner: mockBanner,
    dropdown: dropdown,
  };

  Array.prototype.forEach.call(document.querySelectorAll("[data-nr-list]"), function (a) { a.href = urls.list(); });
  var page = document.body.getAttribute("data-nr-page");
  if (page === "list") { mockBanner(); initList(); }
  if (page === "article") { mockBanner(); initArticle(); }
})();
