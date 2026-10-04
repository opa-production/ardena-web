// Newsroom account (/newsroom/account): the signed in writer's photo, name
// and password. Depends on newsroom.js.
(function () {
  "use strict";

  var NR = window.ArdenaNewsroom;
  if (!NR || document.body.getAttribute("data-nr-page") !== "account") return;
  var api = NR.api;

  var $ = function (id) { return document.getElementById(id); };
  var card = $("nrAccount");
  var avatarBox = $("nrAvatar");
  var uploadBtn = $("nrAvatarUpload");
  var removeBtn = $("nrAvatarRemove");
  var fileInput = $("nrAvatarInput");
  var photoNote = $("nrAvatarNote");
  var PHOTO_HINT = photoNote.textContent;
  var nameForm = $("nrNameForm");
  var passwordForm = $("nrPasswordForm");
  var field = function (form, name) { return form.elements.namedItem(name); };
  var nameField = field(nameForm, "name");
  var me = null;
  var profile = null;

  NR.mockBanner();
  NR.passwordToggles(card);
  $("nrBackToWrite").href = NR.urls.write();

  function render(next) {
    me = next;
    avatarBox.innerHTML = NR.avatar(me, "nr-avatar--lg");
    removeBtn.hidden = !me.avatar_url;
    uploadBtn.textContent = me.avatar_url ? "Change photo" : "Upload photo";
    $("nrAccountEmail").textContent = me.email || "";
    field(passwordForm, "username").value = me.email || "";
    if (profile) profile.update(me);
    else profile = NR.profileMenu($("nrProfile"), me);
  }

  // Signing in happens on the editor page; come back here afterwards.
  api.me().then(function (user) {
    if (!user) { window.location.replace(NR.urls.write()); return; }
    render(user);
    nameField.value = user.name || "";
    card.setAttribute("aria-busy", "false");
  });

  function note(form, message, isError) {
    var el = form.querySelector(".nr-gate-msg");
    el.textContent = message || "";
    el.hidden = !message;
    el.classList.toggle("is-error", !!isError);
  }

  function busy(form, on) {
    form.querySelector('button[type="submit"]').disabled = on;
  }

  function signedOut(err) {
    if (err && err.status === 401) { window.location.replace(NR.urls.write()); return true; }
    return false;
  }

  // ------------------------------------------------------------ name
  nameForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = nameField.value.trim().replace(/\s+/g, " ");
    if (name.length < 2) { note(nameForm, "Enter your full name.", true); return; }
    if (me && name === me.name) { note(nameForm, "That's already your name."); return; }
    busy(nameForm, true);
    note(nameForm, "");
    api.updateProfile({ name: name })
      .then(function (user) {
        render(user);
        nameField.value = user.name;
        note(nameForm, "Name saved.");
      })
      .catch(function (err) {
        if (signedOut(err)) return;
        note(nameForm, err.status === 422 ? err.message : "Couldn't save your name. Try again.", true);
      })
      .then(function () { busy(nameForm, false); });
  });

  // ------------------------------------------------------------ password
  passwordForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = passwordForm;
    if (field(f, "password").value !== field(f, "confirm").value) { note(f, "New passwords don't match.", true); return; }
    if (field(f, "password").value === field(f, "current").value) { note(f, "Pick a new password that differs from the current one.", true); return; }
    busy(f, true);
    note(f, "");
    api.changePassword(field(f, "current").value, field(f, "password").value)
      .then(function () {
        f.reset();
        field(f, "username").value = (me && me.email) || "";
        note(f, "Password updated.");
      })
      .catch(function (err) {
        if (signedOut(err)) return;
        note(f,
          err.status === 400 ? "Your current password isn't right." :
          err.status === 429 ? "Too many attempts. Try again in a few minutes." :
          err.status === 422 ? err.message : "Couldn't update your password. Try again.", true);
      })
      .then(function () { busy(f, false); });
  });

  // ------------------------------------------------------------ photo
  // Crop to a centred square and shrink to 512px before uploading, so a
  // phone photo goes up as a small JPEG. Falls back to the original file.
  function squareJpeg(file) {
    return new Promise(function (ok) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var side = Math.min(img.naturalWidth, img.naturalHeight);
          var size = Math.min(512, side);
          var canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            ok(blob ? new File([blob], "avatar.jpg", { type: "image/jpeg" }) : file);
          }, "image/jpeg", 0.9);
        } catch (e) { URL.revokeObjectURL(url); ok(file); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok(file); };
      img.src = url;
    });
  }

  function photoMessage(text, isError) {
    photoNote.textContent = text || PHOTO_HINT;
    photoNote.classList.toggle("is-error", !!isError);
  }

  function photoBusy(on) { uploadBtn.disabled = removeBtn.disabled = on; }

  uploadBtn.addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { photoMessage("Use a JPEG, PNG or WebP image.", true); return; }
    if (file.size > 10 * 1024 * 1024) { photoMessage("That image is over 10 MB.", true); return; }
    photoBusy(true);
    photoMessage("Uploading photo");
    squareJpeg(file)
      .then(function (small) { return api.uploadAvatar(small); })
      .then(function (user) { render(user); photoMessage("Photo updated."); })
      .catch(function (err) {
        if (signedOut(err)) return;
        photoMessage(err.status === 422 || err.status === 413 ? err.message : "Upload failed. Try again.", true);
      })
      .then(function () { photoBusy(false); });
  });

  removeBtn.addEventListener("click", function () {
    photoBusy(true);
    api.removeAvatar()
      .then(function (user) { render(user); photoMessage("Photo removed."); })
      .catch(function (err) {
        if (signedOut(err)) return;
        photoMessage("Couldn't remove your photo. Try again.", true);
      })
      .then(function () { photoBusy(false); });
  });
})();
