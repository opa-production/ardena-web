// Status page (/status): renders GET /api/v1/status from the Ardena API.
(function () {
  "use strict";

  var REFRESH_MS = 60000;
  var MOBILE_QUERY = window.matchMedia("(max-width: 640px)");

  var LABELS = {
    operational: "Operational",
    degraded: "Degraded performance",
    partial_outage: "Partial outage",
    major_outage: "Major outage",
    no_data: "No data",
  };
  var ICONS = { operational: "✓", degraded: "!", partial_outage: "!", major_outage: "✕", no_data: "–" };
  var BANNER = {
    operational: "All systems operational",
    degraded: "Some systems are running slowly",
    partial_outage: "Some systems are having problems",
    major_outage: "Major outage in progress",
    no_data: "Status temporarily unavailable",
  };

  var els = {
    banner: document.getElementById("statusBanner"),
    bannerTitle: document.getElementById("statusBannerTitle"),
    bannerMeta: document.getElementById("statusBannerMeta"),
    components: document.getElementById("statusComponents"),
    activeSection: document.getElementById("activeIncidentsSection"),
    active: document.getElementById("activeIncidents"),
    past: document.getElementById("pastIncidents"),
    rangeBtns: document.querySelectorAll(".status-range-btn"),
  };
  if (!els.components) return;

  var selectedDays = 90;
  var inFlight = null;
  var tip = document.createElement("div");
  tip.className = "status-tip";
  tip.hidden = true;
  document.body.appendChild(tip);

  function apiBase() {
    if (typeof getApiBase === "function") return getApiBase();
    return "https://api.ardena.xyz";
  }

  // Phones get 30 bars: 90 bars on a 360px screen are too thin to read or tap.
  function effectiveDays() {
    return MOBILE_QUERY.matches ? 30 : selectedDays;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtDay(isoDate) {
    var d = new Date(isoDate + "T12:00:00+03:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi",
    }) + " EAT";
  }

  function fmtPct(pct) {
    return pct == null ? "—" : pct.toFixed(2) + "%";
  }

  function setBanner(status, meta) {
    els.banner.className = "status-banner is-" + status;
    els.banner.querySelector(".status-banner-icon").textContent = ICONS[status] || "";
    els.bannerTitle.textContent = BANNER[status] || BANNER.no_data;
    els.bannerMeta.textContent = meta;
  }

  function renderComponent(c, days) {
    var bars = c.days.map(function (d) {
      var tipText = fmtDay(d.date) + "|" + LABELS[d.status] + (d.uptime_pct != null ? " · " + fmtPct(d.uptime_pct) + " uptime" : "");
      return '<span class="status-bar is-' + esc(d.status) + '" tabindex="0" data-tip="' + esc(tipText) +
        '" aria-label="' + esc(tipText.replace("|", ": ")) + '"></span>';
    }).join("");

    return (
      '<article class="status-card">' +
        '<div class="status-card-head">' +
          "<div>" +
            '<h3 class="status-card-name">' + esc(c.name) + "</h3>" +
            '<p class="status-card-desc">' + esc(c.description) + "</p>" +
          "</div>" +
          '<span class="status-pill is-' + esc(c.status) + '">' +
            '<span class="status-pill-icon" aria-hidden="true">' + (ICONS[c.status] || "") + "</span>" +
            esc(c.status === "degraded" ? "Degraded" : LABELS[c.status]) +
          "</span>" +
        "</div>" +
        '<div class="status-bars" role="img" aria-label="' + esc(c.name + " daily status, last " + days + " days") + '">' + bars + "</div>" +
        '<div class="status-card-foot">' +
          "<span>" + days + " days ago</span>" +
          '<span class="status-uptime">' + fmtPct(c.uptime_pct) + " uptime</span>" +
          "<span>Today</span>" +
        "</div>" +
      "</article>"
    );
  }

  function renderIncident(inc, names) {
    var affected = inc.components.length
      ? inc.components.map(function (k) { return names[k] || k; }).join(", ")
      : "All systems";
    var cls = inc.resolved_at ? "is-resolved" : "is-" + inc.impact;
    var meta = inc.resolved_at
      ? "Resolved " + fmtTime(inc.resolved_at) + " · " + affected
      : LABELS[inc.impact] + " · " + affected + " · since " + fmtTime(inc.created_at);
    var updates = inc.updates.map(function (u) {
      return (
        "<li>" +
          '<span class="status-update-label">' + esc(u.status) + "</span>" +
          '<span class="status-update-time">' + esc(fmtTime(u.created_at)) + "</span>" +
          "<p>" + esc(u.message) + "</p>" +
        "</li>"
      );
    }).join("");
    return (
      '<article class="status-incident ' + cls + '">' +
        '<h3 class="status-incident-title">' + esc(inc.title) + "</h3>" +
        '<p class="status-incident-meta">' + esc(meta) + "</p>" +
        '<ul class="status-updates">' + updates + "</ul>" +
      "</article>"
    );
  }

  function render(data) {
    var names = {};
    data.components.forEach(function (c) { names[c.key] = c.name; });

    var meta = "Last updated " + fmtTime(data.generated_at);
    if (data.active_incidents.length) {
      meta = data.active_incidents.length === 1
        ? data.active_incidents[0].title + " · " + meta
        : data.active_incidents.length + " active incidents · " + meta;
    }
    setBanner(data.status, meta);

    els.components.innerHTML = data.components.map(function (c) {
      return renderComponent(c, data.window_days);
    }).join("");
    els.components.setAttribute("aria-busy", "false");

    els.activeSection.hidden = !data.active_incidents.length;
    els.active.innerHTML = data.active_incidents.map(function (i) { return renderIncident(i, names); }).join("");

    els.past.innerHTML = data.recent_incidents.length
      ? data.recent_incidents.map(function (i) { return renderIncident(i, names); }).join("")
      : '<p class="status-note">No incidents reported in the last 14 days.</p>';
  }

  function renderUnreachable() {
    // The status API lives on the same servers as the apps: if it can't be
    // reached, the apps almost certainly can't either.
    setBanner("major_outage", "We can't reach Ardena's servers right now. We're on it — please try again shortly.");
    els.banner.querySelector(".status-banner-icon").textContent = ICONS.major_outage;
    els.bannerTitle.textContent = "Ardena is currently unreachable";
    if (els.components.querySelector(".status-card--skeleton")) {
      els.components.innerHTML = '<p class="status-note" style="padding:1rem 1.5rem;margin:0">Uptime history will appear once the connection is restored.</p>';
    }
    els.past.innerHTML = '<p class="status-note">Unavailable right now.</p>';
  }

  function load() {
    var days = effectiveDays();
    if (inFlight) inFlight.abort();
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    inFlight = ctrl;
    fetch(apiBase() + "/api/v1/status?days=" + days, { signal: ctrl ? ctrl.signal : undefined, cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (inFlight === ctrl) inFlight = null;
        render(data);
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        if (inFlight === ctrl) inFlight = null;
        renderUnreachable();
      });
  }

  // --- range toggle
  Array.prototype.forEach.call(els.rangeBtns, function (btn) {
    btn.addEventListener("click", function () {
      selectedDays = parseInt(btn.getAttribute("data-days"), 10);
      Array.prototype.forEach.call(els.rangeBtns, function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      load();
    });
  });
  function syncRangeVisibility() {
    var range = document.querySelector(".status-range");
    if (range) range.hidden = MOBILE_QUERY.matches;
  }
  syncRangeVisibility();
  var onMedia = function () { syncRangeVisibility(); load(); };
  if (MOBILE_QUERY.addEventListener) MOBILE_QUERY.addEventListener("change", onMedia);
  else if (MOBILE_QUERY.addListener) MOBILE_QUERY.addListener(onMedia);

  // --- bar tooltip (one shared element, positioned over the hovered/focused bar)
  function showTip(bar) {
    var parts = (bar.getAttribute("data-tip") || "").split("|");
    tip.innerHTML = "<strong>" + esc(parts[0]) + "</strong>" + esc(parts[1] || "");
    var r = bar.getBoundingClientRect();
    var x = Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90);
    tip.style.left = x + "px";
    tip.style.top = r.top + "px";
    tip.hidden = false;
  }
  function hideTip() { tip.hidden = true; }
  els.components.addEventListener("mouseover", function (e) {
    if (e.target.classList && e.target.classList.contains("status-bar")) showTip(e.target);
  });
  els.components.addEventListener("focusin", function (e) {
    if (e.target.classList && e.target.classList.contains("status-bar")) showTip(e.target);
  });
  els.components.addEventListener("mouseleave", hideTip);
  els.components.addEventListener("focusout", hideTip);
  window.addEventListener("scroll", hideTip, { passive: true });

  load();
  setInterval(function () {
    if (!document.hidden) load();
  }, REFRESH_MS);
})();
