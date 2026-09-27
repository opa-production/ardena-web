// Newsroom editor (/newsroom/write). Publisher-only. Depends on newsroom.js.
(function () {
  "use strict";

  var NR = window.ArdenaNewsroom;
  if (!NR || document.body.getAttribute("data-nr-page") !== "write") return;
  var api = NR.api;
  var esc = NR.esc;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    gate: $("nrGate"),
    gateForm: $("nrGateForm"),
    gateMsg: $("nrGateMsg"),
    editor: $("nrEditor"),
    status: $("nrSaveStatus"),
    publish: $("nrPublish"),
    saveDraft: $("nrSaveDraft"),
    signOut: $("nrSignOut"),
    category: $("nrCategory"),
    cover: $("nrCover"),
    title: $("nrTitle"),
    excerpt: $("nrExcerpt"),
    body: $("nrBody"),
    toolbar: $("nrToolbar"),
    blockSelect: $("nrBlock"),
    linkBar: $("nrLinkBar"),
    linkInput: $("nrLinkInput"),
    words: $("nrWords"),
    error: $("nrError"),
    modal: $("nrPhotoModal"),
    photoForm: $("nrPhotoForm"),
    photoQuery: $("nrPhotoQuery"),
    photoGrid: $("nrPhotoGrid"),
    photoMore: $("nrPhotoMore"),
  };

  var params = new URLSearchParams(window.location.search);
  var editingSlug = params.get("slug") || "";
  var DRAFT_KEY = "ardena_newsroom_draft:" + (editingSlug || "new");
  var state = { id: null, slug: editingSlug, cover: null, downloads: [], published_at: null, dirty: false };

  // ------------------------------------------------------------ access
  NR.mockBanner();
  var category = NR.dropdown(els.category, {
    items: NR.categories.map(function (c) { return { value: c, label: c }; }),
    placeholder: "Choose a category",
    onChange: function () { markDirty(); },
  });

  function openEditor(me) {
    els.gate.hidden = true;
    els.editor.hidden = false;
    els.publish.hidden = els.saveDraft.hidden = false;
    els.signOut.hidden = api.mock;
    if (me && me.name) $("nrWho").textContent = me.name;
    if (editingSlug) loadExisting();
    else restoreDraft();
    placeholderCheck();
    countWords();
  }

  // ------------------------------------------------------------ gate
  // Four views in one card: sign in, request to write, forgot password, and
  // set password (from an ?invite= or ?reset= link). Writing needs an account
  // with publishing rights; the server checks that on every save, so the gate
  // is a convenience, never the lock.
  var gateViews = Array.prototype.slice.call(els.gate.querySelectorAll("[data-view]"));
  var linkToken = params.get("invite") || params.get("reset") || "";

  function note(message) {
    els.gateMsg.textContent = message || "";
    els.gateMsg.hidden = !message;
  }

  function showView(name, message) {
    els.editor.hidden = true;
    els.publish.hidden = els.saveDraft.hidden = true;
    els.gate.hidden = false;
    gateViews.forEach(function (v) { v.hidden = v.getAttribute("data-view") !== name; });
    note(message);
    var first = els.gate.querySelector('[data-view="' + name + '"] input');
    if (first) first.focus();
  }

  function showGate(message) { showView("signin", message); }

  // Signed in but not (yet) allowed to publish: say so, and let them switch account.
  function showPending(me) {
    showView("signin", "Your account is waiting for approval.");
    els.signOut.hidden = false;
  }

  function withButton(form, work) {
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    return work().then(function () { btn.disabled = false; }, function () { btn.disabled = false; });
  }

  Array.prototype.forEach.call(els.gate.querySelectorAll("[data-go]"), function (b) {
    b.addEventListener("click", function () { showView(b.getAttribute("data-go")); });
  });

  function forgetLinkToken() {
    linkToken = "";
    params.delete("invite");
    params.delete("reset");
    var q = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? "?" + q : ""));
  }

  if (linkToken) {
    // A link from an email: find out who it's for before asking for a password.
    api.tokenInfo(linkToken)
      .then(function (info) {
        var reset = info.purpose === "reset";
        $("nrSetTitle").textContent = reset ? "New password" : "Welcome, " + info.name.split(" ")[0];
        $("nrSetIntro").textContent = info.email + ". At least 10 characters.";
        showView("set");
      })
      .catch(function (err) {
        forgetLinkToken();
        showGate(err.status === 410 ? "That link has expired. Request a new one with Forgot password." : "Couldn't check that link. Try again.");
      });
  } else {
    api.me().then(function (me) {
      if (me && me.can_publish) openEditor(me);
      else if (me) showPending(me);
      else showGate();
    });
  }

  els.gateForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var form = els.gateForm;
    withButton(form, function () {
      return api.login(form.email.value.trim(), form.password.value)
        .then(function (user) {
          if (user && user.can_publish) openEditor(user);
          else showPending(user);
        })
        .catch(function (err) {
          showGate(
            err.status === 401 ? "Wrong email or password." :
            err.status === 429 ? "Too many attempts. Try again in a few minutes." :
            "Couldn't sign in. Try again."
          );
        });
    });
  });

  $("nrRequestForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    withButton(form, function () {
      return api.requestAccess({
        full_name: form.full_name.value.trim(),
        email: form.email.value.trim(),
        about: form.about.value.trim(),
        portfolio_url: form.portfolio_url.value.trim() || null,
      })
        .then(function () {
          form.reset();
          showGate("Request sent. We'll email you.");
        })
        .catch(function (err) {
          note(err.status === 429 ? "Too many requests. Try again later." :
               err.status === 422 ? err.message : "Couldn't send that. Try again.");
        });
    });
  });

  $("nrForgotForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    withButton(form, function () {
      return api.forgotPassword(form.email.value.trim())
        .then(function () { showGate("If that email is registered, a link is on its way."); })
        .catch(function () { note("Couldn't send that. Try again in a few minutes."); });
    });
  });

  $("nrSetForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target;
    if (form.password.value !== form.confirm.value) { note("Passwords don't match."); return; }
    withButton(form, function () {
      return api.setPassword(linkToken, form.password.value)
        .then(function (user) {
          forgetLinkToken();
          if (user && user.can_publish) openEditor(user);
          else showPending(user);
        })
        .catch(function (err) {
          if (err.status === 410) { forgetLinkToken(); showGate(err.message); }
          else note(err.status === 422 ? err.message : "Couldn't save that. Try again.");
        });
    });
  });

  els.signOut.addEventListener("click", function () {
    api.logout();
    window.location.href = NR.urls.list();
  });

  // ------------------------------------------------------------ load / autosave
  function snapshot() {
    return {
      id: state.id,
      slug: state.slug,
      category: category.get(),
      title: els.title.value.trim(),
      excerpt: els.excerpt.value.trim(),
      cover_image: state.cover,
      body: NR.sanitize(els.body.innerHTML),
      unsplash_downloads: state.downloads,
      published_at: state.published_at,
    };
  }

  function fill(a) {
    state.id = a.id || null;
    state.slug = a.slug || state.slug;
    state.cover = a.cover_image || null;
    state.published_at = a.published_at || null;
    state.downloads = a.unsplash_downloads || [];
    category.set(a.category);
    els.title.value = a.title || "";
    els.excerpt.value = a.excerpt || "";
    els.body.innerHTML = NR.sanitize(a.body || "") || "<p><br></p>";
    renderCover();
    autoGrow(els.title);
    autoGrow(els.excerpt);
    placeholderCheck();
    countWords();
  }

  function loadExisting() {
    setStatus("Loading story");
    api.get(editingSlug)
      .then(function (a) {
        fill(a);
        var draft = readDraft();
        if (draft && draft.saved_at > (a.updated_at ? Date.parse(a.updated_at) : 0)) {
          fill(draft);
          setStatus("Restored your unsaved changes");
        } else setStatus("Editing published story");
      })
      .catch(function () {
        setStatus("");
        showError("We couldn't load that story. You can still write a new one.");
        editingSlug = "";
      });
  }

  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { return null; }
  }
  function restoreDraft() {
    var d = readDraft();
    if (d) { fill(d); setStatus("Draft restored"); }
    else els.body.innerHTML = "<p><br></p>";
  }

  var saveTimer = null;
  function markDirty() {
    state.dirty = true;
    setStatus("Saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var snap = snapshot();
      snap.saved_at = Date.now();
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(snap)); setStatus("Draft saved on this device"); }
      catch (e) { setStatus("Couldn't save a local draft"); }
    }, 700);
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  function setStatus(t) { els.status.textContent = t; }
  function showError(t) {
    els.error.textContent = t;
    els.error.hidden = !t;
    if (t) els.error.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  window.addEventListener("beforeunload", function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  // ------------------------------------------------------------ fields
  function autoGrow(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
  [els.title, els.excerpt].forEach(function (t) {
    t.addEventListener("input", function () { autoGrow(t); markDirty(); });
    t.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        (t === els.title ? els.excerpt : els.body).focus();
      }
    });
  });

  function countWords() {
    var text = els.body.innerText || "";
    var n = (text.trim().match(/\S+/g) || []).length;
    els.words.textContent = n + (n === 1 ? " word" : " words") + " · " + Math.max(1, Math.round(n / 200)) + " min read";
  }
  function placeholderCheck() {
    var empty = !els.body.textContent.trim() && !els.body.querySelector("img,hr,li");
    els.body.classList.toggle("is-empty", empty);
  }

  // ------------------------------------------------------------ rich text
  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}

  els.body.addEventListener("input", function () {
    if (!els.body.firstChild) els.body.innerHTML = "<p><br></p>";
    placeholderCheck();
    countWords();
    markDirty();
  });

  els.body.addEventListener("paste", function (e) {
    var cd = e.clipboardData;
    if (!cd) return;
    e.preventDefault();
    var html = cd.getData("text/html");
    if (html) {
      document.execCommand("insertHTML", false, NR.sanitize(html));
    } else {
      var text = cd.getData("text/plain") || "";
      var paras = text.split(/\n{2,}/).map(function (p) { return "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>"; });
      document.execCommand("insertHTML", false, paras.length > 1 ? paras.join("") : esc(text));
    }
  });

  var savedRange = null;
  function saveRange() {
    var sel = window.getSelection();
    if (sel.rangeCount && els.body.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  }
  function restoreRange() {
    els.body.focus();
    if (!savedRange) return;
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  function currentBlock() {
    var v = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "");
    return v === "div" || !v ? "p" : v;
  }

  function exec(cmd) {
    els.body.focus();
    switch (cmd) {
      case "bold":
      case "italic":
        document.execCommand(cmd);
        break;
      case "quote":
        document.execCommand("formatBlock", false, currentBlock() === "blockquote" ? "<p>" : "<blockquote>");
        break;
      case "ul":
        document.execCommand("insertUnorderedList");
        break;
      case "ol":
        document.execCommand("insertOrderedList");
        break;
      case "hr":
        document.execCommand("insertHTML", false, "<hr><p><br></p>");
        break;
      case "link":
        saveRange();
        openLinkBar();
        return;
      case "image":
        saveRange();
        openPicker("inline");
        return;
      case "upload":
        saveRange();
        startUpload("inline");
        return;
    }
    syncToolbar();
    els.body.dispatchEvent(new Event("input"));
  }

  els.toolbar.addEventListener("mousedown", function (e) {
    // keep the text selection when clicking toolbar buttons
    if (e.target.closest("button")) e.preventDefault();
  });
  els.toolbar.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-cmd]");
    if (b) exec(b.getAttribute("data-cmd"));
  });
  var blockStyle = NR.dropdown(els.blockSelect, {
    items: [
      { value: "p", label: "Paragraph" },
      { value: "h2", label: "Heading" },
      { value: "h3", label: "Subheading" },
    ],
    value: "p",
    onChange: function (v) {
      restoreRange();
      document.execCommand("formatBlock", false, "<" + v + ">");
      els.body.dispatchEvent(new Event("input"));
      syncToolbar();
    },
  });
  // The menu takes focus, so remember where the caret was before it opens.
  els.blockSelect.addEventListener("mousedown", saveRange, true);
  els.blockSelect.addEventListener("keydown", function (e) {
    if (e.target.classList.contains("nr-dd-btn")) saveRange();
  }, true);

  function syncToolbar() {
    var sel = window.getSelection();
    if (!sel.rangeCount || !els.body.contains(sel.anchorNode)) return;
    var map = { bold: "bold", italic: "italic", ul: "insertUnorderedList", ol: "insertOrderedList" };
    Object.keys(map).forEach(function (k) {
      var btn = els.toolbar.querySelector('[data-cmd="' + k + '"]');
      var on = false;
      try { on = document.queryCommandState(map[k]); } catch (e) {}
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var block = currentBlock();
    if (block === "h2" || block === "h3") {
      // headings are bold by style, so don't show Bold as switched on
      var bold = els.toolbar.querySelector('[data-cmd="bold"]');
      bold.classList.remove("is-on");
      bold.setAttribute("aria-pressed", "false");
    }
    els.toolbar.querySelector('[data-cmd="quote"]').classList.toggle("is-on", block === "blockquote");
    blockStyle.set(block === "h2" || block === "h3" ? block : "p");
    var node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode);
    els.toolbar.querySelector('[data-cmd="link"]').classList.toggle("is-on", !!(node && node.closest("a")));
  }
  document.addEventListener("selectionchange", syncToolbar);

  els.body.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      exec("link");
    }
  });

  // ------------------------------------------------------------ links
  function openLinkBar() {
    var sel = window.getSelection();
    var node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode);
    var a = node && node.closest ? node.closest("a") : null;
    els.linkInput.value = a ? a.getAttribute("href") : "";
    els.linkBar.hidden = false;
    els.linkInput.focus();
  }
  function closeLinkBar() {
    els.linkBar.hidden = true;
    restoreRange();
  }
  $("nrLinkForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var url = els.linkInput.value.trim();
    closeLinkBar();
    if (!url) { document.execCommand("unlink"); }
    else {
      if (!/^(https?:|mailto:|\/)/i.test(url)) url = "https://" + url;
      if (window.getSelection().isCollapsed) document.execCommand("insertHTML", false, '<a href="' + esc(url) + '">' + esc(url) + "</a>");
      else document.execCommand("createLink", false, url);
    }
    els.body.dispatchEvent(new Event("input"));
  });
  $("nrLinkRemove").addEventListener("click", function () {
    closeLinkBar();
    document.execCommand("unlink");
    els.body.dispatchEvent(new Event("input"));
  });
  els.linkInput.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLinkBar(); });

  // ------------------------------------------------------------ cover
  function credit(p) {
    if (!p.photographer_name) return ""; // our own upload: nothing to credit
    if (p.photographer_name === "Unsplash") return 'Photo: <a href="https://unsplash.com/?utm_source=ardena&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>';
    return (
      'Photo by <a href="' + esc(p.photographer_url) + '?utm_source=ardena&utm_medium=referral" target="_blank" rel="noopener noreferrer">' +
      esc(p.photographer_name) + '</a> on <a href="https://unsplash.com/?utm_source=ardena&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>'
    );
  }

  function renderCover() {
    var c = state.cover;
    if (!c) {
      els.cover.innerHTML =
        '<div class="nr-cover-empty">' +
        "<p>Add a cover image</p>" +
        '<div class="nr-cover-choices">' +
        '<button type="button" class="nr-cover-primary" data-cover="upload">Upload image</button>' +
        '<button type="button" class="nr-cover-secondary" data-cover="pick">Choose from Unsplash</button>' +
        "</div></div>";
      return;
    }
    els.cover.innerHTML =
      '<figure class="nr-cover-set"><img src="' + esc(c.url) + '" alt="' + esc(c.alt || "") + '">' +
      '<div class="nr-cover-actions"><button type="button" data-cover="upload">Upload</button><button type="button" data-cover="pick">Unsplash</button><button type="button" data-cover="remove">Remove</button></div>' +
      (credit(c) ? "<figcaption>" + credit(c) + "</figcaption>" : "") + "</figure>";
  }
  els.cover.addEventListener("click", function (e) {
    var b = e.target.closest("[data-cover]");
    if (!b) return;
    var action = b.getAttribute("data-cover");
    if (action === "remove") { state.cover = null; renderCover(); markDirty(); }
    else if (action === "upload") startUpload("cover");
    else openPicker("cover");
  });

  // ------------------------------------------------------------ unsplash picker
  var picker = { mode: "cover", query: "", page: 1, results: [] };

  function openPicker(mode) {
    picker.mode = mode;
    els.modal.hidden = false;
    document.body.classList.add("nr-modal-open");
    $("nrPhotoTitle").textContent = mode === "cover" ? "Choose a cover image" : "Insert an image";
    els.photoQuery.focus();
    if (!picker.results.length) search(els.photoQuery.value || "car");
  }
  function closePicker() {
    els.modal.hidden = true;
    document.body.classList.remove("nr-modal-open");
    if (picker.mode === "inline") restoreRange();
  }

  function search(q, append) {
    picker.query = q;
    picker.page = append ? picker.page + 1 : 1;
    if (!append) els.photoGrid.innerHTML = '<p class="nr-photo-note">Searching Unsplash</p>';
    els.photoMore.hidden = true;
    api.searchPhotos(q, picker.page)
      .then(function (data) {
        var res = data.results || [];
        picker.results = append ? picker.results.concat(res) : res;
        if (!picker.results.length) {
          els.photoGrid.innerHTML = '<p class="nr-photo-note">No photos for "' + esc(q) + '". Try a broader word like car, road or Kenya.</p>';
          return;
        }
        els.photoGrid.innerHTML = picker.results.map(function (p, i) {
          return (
            '<button type="button" class="nr-photo" data-i="' + i + '" style="' + (p.color ? "background:" + esc(p.color) : "") + '">' +
            '<img src="' + esc(p.thumb) + '" alt="' + esc(p.alt || "") + '" loading="lazy">' +
            '<span class="nr-photo-by">' + esc(p.photographer_name) + "</span></button>"
          );
        }).join("");
        els.photoMore.hidden = !(data.total_pages && picker.page < data.total_pages);
      })
      .catch(function () {
        els.photoGrid.innerHTML = '<p class="nr-photo-note">Unsplash isn\'t available yet. Upload an image from your computer instead.</p>';
      });
  }

  els.photoForm.addEventListener("submit", function (e) {
    e.preventDefault();
    search(els.photoQuery.value.trim());
  });
  Array.prototype.forEach.call(document.querySelectorAll(".nr-chip"), function (c) {
    c.addEventListener("click", function () {
      els.photoQuery.value = c.textContent;
      search(c.textContent);
    });
  });
  els.photoMore.addEventListener("click", function () { search(picker.query, true); });
  els.modal.addEventListener("click", function (e) {
    if (e.target === els.modal || e.target.closest("[data-close]")) closePicker();
    var b = e.target.closest(".nr-photo");
    if (b) choose(picker.results[+b.getAttribute("data-i")]);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.modal.hidden) closePicker();
  });

  function choose(p) {
    if (!p) return;
    if (p.download_location && state.downloads.indexOf(p.download_location) === -1) state.downloads.push(p.download_location);
    var photo = {
      id: p.id, url: p.url, thumb: p.thumb, alt: p.alt || "",
      photographer_name: p.photographer_name, photographer_url: p.photographer_url, unsplash_url: p.unsplash_url,
      source: p.source,
    };
    if (picker.mode === "cover") {
      state.cover = photo;
      renderCover();
      closePicker();
    } else {
      closePicker();
      document.execCommand(
        "insertHTML",
        false,
        '<figure><img src="' + esc(photo.url) + '" alt="' + esc(photo.alt) + '">' +
          (credit(photo) ? "<figcaption>" + credit(photo) + "</figcaption>" : "") + "</figure><p><br></p>"
      );
    }
    markDirty();
  }

  // ------------------------------------------------------------ upload
  var uploadBtn = $("nrUploadBtn");
  var uploadInput = $("nrUploadInput");
  var uploadNote = $("nrUploadNote");
  var UPLOAD_HINT = uploadNote.textContent;

  // Upload can start from the cover, the toolbar or the picker window. Report
  // in the picker when it's open, otherwise in the editor itself.
  function startUpload(mode) {
    picker.mode = mode;
    uploadInput.click();
  }
  function uploadMessage(text, isError) {
    if (!els.modal.hidden) { uploadNote.textContent = text || UPLOAD_HINT; return; }
    if (isError) showError(text);
    else setStatus(text || "");
  }

  uploadBtn.addEventListener("click", function () { uploadInput.click(); });
  uploadInput.addEventListener("change", function () {
    var file = uploadInput.files && uploadInput.files[0];
    uploadInput.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { uploadMessage("Use a JPEG, PNG or WebP image.", true); return; }
    if (file.size > 10 * 1024 * 1024) { uploadMessage("That image is over 10 MB.", true); return; }
    uploadBtn.disabled = true;
    showError("");
    uploadMessage("Uploading image");
    api.uploadImage(file)
      .then(function (img) {
        uploadMessage("");
        choose(img);
      })
      .catch(function (err) {
        uploadMessage(err.status === 422 || err.status === 413 ? err.message : "Upload failed. Try again.", true);
      })
      .then(function () { uploadBtn.disabled = false; });
  });

  // ------------------------------------------------------------ publish
  function validate(a) {
    if (!a.title) return "Give your story a title.";
    if (!a.category) return "Choose a category.";
    if (!a.cover_image) return "Add a cover image.";
    if ((els.body.innerText || "").trim().split(/\s+/).length < 30) return "The story needs a little more text before it can go live.";
    return "";
  }

  function submit(status) {
    var a = snapshot();
    a.status = status;
    var problem = status === "published" ? validate(a) : !a.title ? "Give your draft a title first." : "";
    showError(problem);
    if (problem) return;
    if (!a.excerpt) a.excerpt = (els.body.innerText || "").trim().split(/\s+/).slice(0, 28).join(" ");
    els.publish.disabled = els.saveDraft.disabled = true;
    setStatus(status === "published" ? "Publishing" : "Saving draft");
    api.save(a)
      .then(function (saved) {
        state.dirty = false;
        state.id = saved.id;
        state.slug = saved.slug;
        clearDraft();
        if (status === "published") window.location.href = NR.urls.article(saved.slug);
        else setStatus("Draft saved");
      })
      .catch(function (err) {
        showError(err.status === 403 ? "Your account can't publish. Ask an admin for publisher rights." : "We couldn't save that. Your draft is still on this device.");
        setStatus("Not saved");
      })
      .then(function () { els.publish.disabled = els.saveDraft.disabled = false; });
  }

  els.publish.addEventListener("click", function () { submit("published"); });
  els.saveDraft.addEventListener("click", function () { submit("draft"); });

  renderCover();
})();
