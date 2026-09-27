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
    if (forImg) return /^https:\/\/images\.unsplash\.com\//.test(u) ? u : "";
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
          var err = new Error((data && (data.detail || data.message)) || "HTTP " + res.status);
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
    api.me().then(function (me) {
      if (!me || !me.can_publish) return;
      Array.prototype.forEach.call(document.querySelectorAll("[data-nr-publisher]"), function (el) {
        if (el.tagName === "A") el.href = urls.write(el.hasAttribute("data-nr-edit") ? slug : null);
        el.hidden = false;
      });
    });
  }

  // ------------------------------------------------------------ listing page
  function initList() {
    var grid = document.getElementById("nrGrid");
    var featured = document.getElementById("nrFeatured");
    var more = document.getElementById("nrMore");
    var tabs = document.querySelectorAll(".nr-tab");
    var empty = document.getElementById("nrEmpty");
    var state = { category: params.get("category") || "", offset: 0 };
    if (CATEGORIES.indexOf(state.category) === -1) state.category = "";

    function setTabs() {
      Array.prototype.forEach.call(tabs, function (t) {
        var on = (t.getAttribute("data-category") || "") === state.category;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    function load(reset) {
      if (reset) {
        state.offset = 0;
        grid.setAttribute("aria-busy", "true");
        grid.innerHTML = new Array(7).join('<div class="nr-card nr-card--skeleton"><div class="nr-card-media"></div><div class="nr-card-body"><span></span><span></span></div></div>');
        featured.innerHTML = "";
        featured.hidden = true;
      }
      more.disabled = true;
      // The first page on "All" pulls one extra story to fill the feature slot.
      var extra = !state.category && state.offset === 0 ? 1 : 0;
      var limit = PAGE_SIZE + extra;
      api.list({ category: state.category, offset: state.offset, limit: limit })
        .then(function (data) {
          var items = data.items || [];
          state.offset += items.length;
          if (reset) grid.innerHTML = "";
          if (extra && items.length) {
            var lead = items.filter(function (s) { return s.featured; })[0] || items[0];
            items = items.filter(function (s) { return s !== lead; });
            featured.innerHTML = card(lead, "feature");
            featured.hidden = false;
          }
          grid.insertAdjacentHTML("beforeend", items.map(function (s) { return card(s); }).join(""));
          grid.setAttribute("aria-busy", "false");
          empty.hidden = !!(grid.children.length || !featured.hidden);
          more.hidden = !data.has_more;
          more.disabled = false;
        })
        .catch(function () {
          grid.innerHTML = "";
          grid.setAttribute("aria-busy", "false");
          empty.hidden = false;
          empty.querySelector("p").textContent = "We couldn't load the newsroom right now. Please try again shortly.";
          more.hidden = true;
        });
    }

    Array.prototype.forEach.call(tabs, function (t) {
      t.addEventListener("click", function () {
        state.category = t.getAttribute("data-category") || "";
        var u = new URL(window.location.href);
        if (state.category) u.searchParams.set("category", state.category);
        else u.searchParams.delete("category");
        history.replaceState(null, "", u);
        setTabs();
        load(true);
      });
    });

    more.addEventListener("click", function () {
      load(false);
    });

    setTabs();
    load(true);
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

        root.innerHTML =
          '<header class="nr-article-head nr-wrap nr-wrap--text">' +
          '<a class="nr-crumb" href="' + urls.list() + "?category=" + encodeURIComponent(s.category) + '">' + esc(s.category) + "</a>" +
          '<h1 class="nr-article-title">' + esc(s.title) + "</h1>" +
          (s.excerpt ? '<p class="nr-article-dek">' + esc(s.excerpt) + "</p>" : "") +
          '<div class="nr-article-byline">' +
          '<p class="nr-meta"><span>' + esc(s.author || "Ardena Newsroom") + "</span><span>" + formatDate(s.published_at) + "</span><span>" + (s.reading_minutes || 3) + " min read</span></p>" +
          '<div class="nr-share" aria-label="Share this story">' +
          '<a href="https://wa.me/?text=' + encodeURIComponent(s.title + " " + shareUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">WhatsApp</a>' +
          '<a href="https://x.com/intent/post?url=' + encodeURIComponent(shareUrl) + "&text=" + encodeURIComponent(s.title) + '" target="_blank" rel="noopener noreferrer" aria-label="Share on X">X</a>' +
          '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">LinkedIn</a>' +
          '<button type="button" class="nr-copy" data-url="' + esc(shareUrl) + '">Copy link</button>' +
          '<a class="nr-edit-link" data-nr-publisher data-nr-edit hidden>Edit story</a>' +
          "</div></div></header>" +
          (img.url
            ? '<figure class="nr-article-cover nr-wrap nr-wrap--wide"><img src="' + esc(img.url) + '" alt="' + esc(img.alt || "") + '">' +
              (credit ? "<figcaption>" + credit + "</figcaption>" : "") + "</figure>"
            : "") +
          '<div class="nr-article-body nr-prose nr-wrap nr-wrap--text">' + sanitize(s.body) + "</div>";

        var copy = root.querySelector(".nr-copy");
        copy.addEventListener("click", function () {
          var done = function () { copy.textContent = "Link copied"; setTimeout(function () { copy.textContent = "Copy link"; }, 2000); };
          if (navigator.clipboard) navigator.clipboard.writeText(copy.getAttribute("data-url")).then(done, function () {});
        });

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
  };

  Array.prototype.forEach.call(document.querySelectorAll("[data-nr-list]"), function (a) { a.href = urls.list(); });
  var page = document.body.getAttribute("data-nr-page");
  if (page === "list") { mockBanner(); initList(); }
  if (page === "article") { mockBanner(); initArticle(); }
})();
