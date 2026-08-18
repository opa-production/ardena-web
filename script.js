// API base URL: local development (localhost / 127.0.0.1) vs production
function getApiBase() {
  if (typeof window.ARDENA_API_BASE === "string" && window.ARDENA_API_BASE) {
    return window.ARDENA_API_BASE.replace(/\/$/, "");
  }
  var host =
    typeof window !== "undefined" && window.location
      ? window.location.hostname
      : "";
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:8001";
  }
  return "https://api.ardena.xyz";
}

// Mobile Navigation Toggle
const navToggle = document.getElementById("navToggle");
const navMenu = document.getElementById("navMenu");

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    navToggle.classList.toggle("active");
  });

  // Close menu when clicking on a link
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("active");
      navToggle.classList.remove("active");
    });
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
      navMenu.classList.remove("active");
      navToggle.classList.remove("active");
    }
  });
}

// Contact Form Handling
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Get form data
    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData);

    // Simple validation
    if (!data.name || !data.email || !data.subject || !data.message) {
      showFormMessage("Please fill in all required fields.", "error");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      showFormMessage("Please enter a valid email address.", "error");
      return;
    }

    // Simulate form submission (in production, this would send to a server)
    showFormMessage(
      "Thank you for your message! We will get back to you soon.",
      "success",
    );
    contactForm.reset();

    // In production, you would send the data to your server:
    // fetch('/api/contact', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(data)
    // })
    // .then(response => response.json())
    // .then(data => {
    //     showFormMessage('Thank you for your message! We will get back to you soon.', 'success');
    //     contactForm.reset();
    // })
    // .catch(error => {
    //     showFormMessage('Sorry, there was an error sending your message. Please try again.', 'error');
    // });
  });
}

function showFormMessage(message, type) {
  if (formMessage) {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`;
    formMessage.style.display = "block";

    // Scroll to message
    formMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Hide message after 5 seconds
    setTimeout(() => {
      formMessage.style.display = "none";
    }, 5000);
  }
}

// Help Contact Form Handling
const helpContactForm = document.getElementById("helpContactForm");
const helpFormMessage = document.getElementById("helpFormMessage");

if (helpContactForm) {
  helpContactForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Get form data
    const formData = new FormData(helpContactForm);
    const data = Object.fromEntries(formData);

    // Simple validation
    if (!data.name || !data.email || !data.subject || !data.message) {
      showHelpFormMessage("Please fill in all required fields.", "error");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      showHelpFormMessage("Please enter a valid email address.", "error");
      return;
    }

    // Simulate form submission (in production, this would send to a server)
    showHelpFormMessage(
      "Thank you for your message! We will get back to you soon.",
      "success",
    );
    helpContactForm.reset();
  });
}

function showHelpFormMessage(message, type) {
  if (helpFormMessage) {
    helpFormMessage.textContent = message;
    helpFormMessage.className = `form-message ${type}`;
    helpFormMessage.style.display = "block";

    // Scroll to message
    helpFormMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Hide message after 5 seconds
    setTimeout(() => {
      helpFormMessage.style.display = "none";
    }, 5000);
  }
}

// Delete Account Form Handling
const deleteAccountForm = document.getElementById("deleteAccountForm");
const deleteFormMessage = document.getElementById("deleteFormMessage");

if (deleteAccountForm) {
  deleteAccountForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Get form data
    const formData = new FormData(deleteAccountForm);
    const data = Object.fromEntries(formData);

    // Simple validation
    if (!data.username || !data.email || !data.password) {
      showDeleteFormMessage("Please fill in all required fields.", "error");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      showDeleteFormMessage("Please enter a valid email address.", "error");
      return;
    }

    // Submit to Formspree
    fetch("https://formspree.io/f/xovkloaq", {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    })
      .then((response) => {
        if (response.ok) {
          showDeleteFormMessage(
            "Your deletion request has been submitted successfully. We will process it shortly.",
            "success",
          );
          deleteAccountForm.reset();
        } else {
          showDeleteFormMessage(
            "Sorry, there was an error submitting your request. Please try again.",
            "error",
          );
        }
      })
      .catch((error) => {
        showDeleteFormMessage(
          "Sorry, there was an error submitting your request. Please try again.",
          "error",
        );
      });
  });
}

function showDeleteFormMessage(message, type) {
  if (deleteFormMessage) {
    deleteFormMessage.textContent = message;
    deleteFormMessage.className = `form-message ${type}`;
    deleteFormMessage.style.display = "block";

    // Scroll to message
    deleteFormMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Hide message after 5 seconds
    setTimeout(() => {
      deleteFormMessage.style.display = "none";
    }, 5000);
  }
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// Add active class to current page nav link
const pathname = window.location.pathname.replace(/\/$/, "") || "/";
const navLinks = document.querySelectorAll(".nav-link");

navLinks.forEach((link) => {
  const linkHref = link.getAttribute("href");
  if (!linkHref || linkHref.charAt(0) === "#") {
    return;
  }
  const linkPath = linkHref.split("#")[0].replace(/\/$/, "") || "/";
  if (linkPath === pathname) {
    link.classList.add("active");
  } else {
    link.classList.remove("active");
  }
});

// Header scroll effect
const header = document.querySelector(".header");
if (header) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
}

// Optimize hero image loading
const heroImage = document.querySelector(".hero-image");
if (heroImage) {
  // Check if image is already loaded (cached)
  if (heroImage.complete && heroImage.naturalHeight !== 0) {
    heroImage.classList.add("loaded");
  } else {
    // Wait for image to load
    heroImage.addEventListener("load", () => {
      heroImage.classList.add("loaded");
    });
    // Fallback: show image after timeout even if load event doesn't fire
    setTimeout(() => {
      heroImage.classList.add("loaded");
    }, 100);
  }
}

// Host page hero image loading
const hostHeroImage = document.querySelector(".host-page-hero-image");
if (hostHeroImage) {
  if (hostHeroImage.complete && hostHeroImage.naturalHeight !== 0) {
    hostHeroImage.classList.add("loaded");
  } else {
    hostHeroImage.addEventListener("load", () => {
      hostHeroImage.classList.add("loaded");
    });
    setTimeout(() => {
      hostHeroImage.classList.add("loaded");
    }, 100);
  }
}

// Intersection Observer for scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
};

const scrollObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("animate");
      scrollObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

// Initialize scroll animations on page load
document.addEventListener("DOMContentLoaded", () => {
  // Add scroll-fade-in class to all cards and interactive elements
  const animatedElements = document.querySelectorAll(`
        .feature-card,
        .trust-item,
        .host-benefit-card,
        .problem-item,
        .differentiator-item,
        .host-step-card,
        .host-step-item,
        .support-link-card,
        .finance-info-card,
        .booking-feature-item,
        .help-contact-form-wrapper,
        .blog-card,
        .car-item,
        .benefit-content,
        .faq-item,
        .host-section-block,
        .content-block,
        .legal-section
    `);

  animatedElements.forEach((el, index) => {
    // Skip if element is in a hero section
    if (
      el.closest(
        ".hero, .about-hero, .host-page-hero, .legal-hero, .page-header, .apps-hero",
      )
    ) {
      return;
    }

    el.classList.add("scroll-fade-in");

    // Add staggered delay for cards in grids (only for direct children)
    const parent = el.parentElement;
    if (
      parent &&
      (parent.classList.contains("features-grid") ||
        parent.classList.contains("trust-grid") ||
        parent.classList.contains("problems-grid") ||
        parent.classList.contains("differentiators-grid") ||
        parent.classList.contains("differentiators-list") ||
        parent.classList.contains("host-steps-list") ||
        parent.classList.contains("host-steps-grid") ||
        parent.classList.contains("finances-info-grid") ||
        parent.classList.contains("bookings-features-grid") ||
        parent.classList.contains("blogs-grid") ||
        parent.classList.contains("host-benefits"))
    ) {
      const siblings = Array.from(parent.children);
      const delayIndex = siblings.indexOf(el) % 3;
      if (delayIndex === 1) el.classList.add("scroll-fade-in-delay-1");
      if (delayIndex === 2) el.classList.add("scroll-fade-in-delay-2");
    }

    scrollObserver.observe(el);
  });

  // Animate sections (excluding hero sections)
  const sections = document.querySelectorAll(`
        .features,
        .safety-trust,
        .become-host,
        .faq-section,
        .cta,
        .problems-section,
        .differentiators-section,
        .story-section,
        .help-section,
        .blogs-section,
        .host-content-section,
        .host-steps-section,
        .bookings-section,
        .content-section
    `);

  sections.forEach((section) => {
    section.classList.add("scroll-fade-in");
    scrollObserver.observe(section);
  });

  // Animate section titles
  const sectionTitles = document.querySelectorAll(".section-title");
  sectionTitles.forEach((title) => {
    if (
      !title.closest(
        ".hero, .about-hero, .host-page-hero, .legal-hero, .page-header, .apps-hero",
      )
    ) {
      title.classList.add("scroll-fade-in");
      scrollObserver.observe(title);
    }
  });

  // Hero traction count-up animation
  const tractionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const counters = entry.target.querySelectorAll(".traction-number");
        counters.forEach((counter) => {
          if (counter.dataset.animated === "true") return;
          const valueText = counter.textContent.trim();
          // Values are not always plain numbers ("52+", "100%", "24/7"), so pull
          // out the leading number and keep whatever wraps it intact.
          const parsed = valueText.match(/^(\D*)(\d+)(.*)$/);
          if (!parsed) {
            counter.dataset.animated = "true";
            return;
          }
          const [, prefix, numberText, suffix] = parsed;
          const targetValue = Number(numberText);
          const duration = 1100;
          let start = null;

          const step = (timestamp) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            const current = Math.floor(1 + (targetValue - 1) * progress);
            counter.textContent = `${prefix}${current}${suffix}`;
            if (progress < 1) {
              window.requestAnimationFrame(step);
            } else {
              counter.textContent = valueText;
              counter.dataset.animated = "true";
            }
          };

          window.requestAnimationFrame(step);
        });
        tractionObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.2 },
  );

  const heroTraction = document.querySelector(".hero-traction");
  if (heroTraction) {
    tractionObserver.observe(heroTraction);
  }
});

// FAQ Accordion
document.addEventListener("DOMContentLoaded", () => {
  const faqQuestions = document.querySelectorAll(".faq-question");
  faqQuestions.forEach((question) => {
    question.addEventListener("click", () => {
      const faqItem = question.closest(".faq-item");
      if (!faqItem) return;
      const isActive = faqItem.classList.contains("active");

      // Close all FAQ items
      document.querySelectorAll(".faq-item").forEach((item) => {
        item.classList.remove("active");
        const btn = item.querySelector(".faq-question");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });

      // Open clicked item if it wasn't active
      if (!isActive) {
        faqItem.classList.add("active");
        question.setAttribute("aria-expanded", "true");
      }
    });
  });
});

// Help page: toggle Renters / Car host
(function () {
  const toggleBtns = document.querySelectorAll(".help-toggle-btn");
  const panels = document.querySelectorAll(".help-panel");
  if (!toggleBtns.length || !panels.length) return;

  toggleBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const panelId = btn.getAttribute("data-help-panel");
      if (!panelId) return;
      const targetPanel = document.getElementById("help-panel-" + panelId);
      if (!targetPanel) return;

      toggleBtns.forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");

      panels.forEach(function (panel) {
        panel.classList.remove("is-active");
        panel.hidden = true;
        panel.setAttribute("aria-hidden", "true");
      });
      targetPanel.classList.add("is-active");
      targetPanel.hidden = false;
      targetPanel.setAttribute("aria-hidden", "false");
    });
  });
})();

// Help page newsletter form: one form, one button (Subscribe / Unsubscribe). POST /api/v1/subscribe and /api/v1/unsubscribe
(function () {
  var form = document.getElementById("help-newsletter-form");
  var messageEl = document.getElementById("help-newsletter-message");
  var unsubscribeLink = document.querySelector(
    ".help-newsletter-unsubscribe-link",
  );
  if (!form || !messageEl) return;

  var mode = "subscribe"; // 'subscribe' | 'unsubscribe'
  var submitBtn = form.querySelector(".help-newsletter-submit");

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "help-newsletter-message " + (type || "");
    messageEl.hidden = false;
  }

  function setMode(newMode) {
    mode = newMode;
    if (submitBtn)
      submitBtn.textContent =
        mode === "unsubscribe" ? "Unsubscribe" : "Subscribe";
  }

  function subscribe(email) {
    var base = getApiBase();
    return fetch(base + "/api/v1/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: email }),
    });
  }

  function unsubscribe(email) {
    var base = getApiBase();
    return fetch(base + "/api/v1/unsubscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: email }),
    });
  }

  if (unsubscribeLink) {
    unsubscribeLink.addEventListener("click", function () {
      setMode("unsubscribe");
      var emailInput = form.querySelector(
        'input[name="email"], input[type="email"]',
      );
      if (emailInput) {
        emailInput.focus();
        emailInput.value = "";
      }
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var emailInput = form.querySelector(
      'input[name="email"], input[type="email"]',
    );
    var email = emailInput ? emailInput.value.trim() : "";
    if (!email) {
      showMessage("Please enter your email address.", "error");
      return;
    }
    var originalText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent =
        mode === "unsubscribe" ? "Unsubscribing…" : "Subscribing…";
    }
    messageEl.hidden = true;

    var request =
      mode === "unsubscribe" ? unsubscribe(email) : subscribe(email);
    request
      .then(function (r) {
        if (!r.ok)
          return r.json().then(function (body) {
            throw new Error(
              body.message ||
                body.detail ||
                (mode === "unsubscribe"
                  ? "Unsubscribe failed"
                  : "Subscribe failed"),
            );
          });
        return r.json().catch(function () {
          return {};
        });
      })
      .then(function () {
        if (mode === "unsubscribe") {
          showMessage(
            "You have been unsubscribed from our newsletter.",
            "success",
          );
          setMode("subscribe");
        } else {
          showMessage(
            "Thanks! You’re subscribed. We’ll send updates to your email.",
            "success",
          );
          setMode("unsubscribe");
        }
        form.reset();
        if (submitBtn) submitBtn.disabled = false;
      })
      .catch(function (err) {
        showMessage(
          err && err.message
            ? err.message
            : "Something went wrong. Please try again or email support@ardena.co.ke.",
          "error",
        );
        if (submitBtn) {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      });
  });
})();

// Nav dropdown subscribe forms (Resources/Legal)
(function () {
  var dropdownInners = document.querySelectorAll(
    ".nav-dropdown-panel .nav-dropdown-inner",
  );
  if (!dropdownInners.length) return;

  dropdownInners.forEach(function (inner, idx) {
    if (inner.querySelector(".nav-dropdown-subscribe")) return;
    var section = document.createElement("aside");
    section.className = "nav-dropdown-subscribe";
    section.innerHTML =
      "" +
      '<h4 class="nav-dropdown-subscribe-title">Stay in the loop</h4>' +
      '<p class="nav-dropdown-subscribe-text">Get product updates and platform news.</p>' +
      '<form class="nav-dropdown-subscribe-form" data-nav-subscribe-form="' +
      idx +
      '" novalidate>' +
      '  <label class="visually-hidden" for="nav-subscribe-email-' +
      idx +
      '">Email address</label>' +
      '  <input id="nav-subscribe-email-' +
      idx +
      '" class="nav-dropdown-subscribe-input" type="email" name="email" placeholder="your@email.com" required autocomplete="email">' +
      '  <button type="submit" class="nav-dropdown-subscribe-btn">Subscribe</button>' +
      '  <p class="nav-dropdown-subscribe-message" role="status" aria-live="polite" hidden></p>' +
      "</form>";
    inner.appendChild(section);
  });

  function subscribe(email) {
    var base = getApiBase();
    return fetch(base + "/api/v1/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: email }),
    });
  }

  document
    .querySelectorAll(".nav-dropdown-subscribe-form")
    .forEach(function (form) {
      var input = form.querySelector(".nav-dropdown-subscribe-input");
      var btn = form.querySelector(".nav-dropdown-subscribe-btn");
      var messageEl = form.querySelector(".nav-dropdown-subscribe-message");
      if (!input || !btn || !messageEl) return;

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = input.value.trim();
        if (!email) {
          messageEl.textContent = "Please enter your email.";
          messageEl.className = "nav-dropdown-subscribe-message error";
          messageEl.hidden = false;
          return;
        }
        var originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Subscribing...";
        messageEl.hidden = true;

        subscribe(email)
          .then(function (r) {
            if (!r.ok)
              return r.json().then(function (body) {
                throw new Error(
                  body.message || body.detail || "Subscribe failed",
                );
              });
            return r.json().catch(function () {
              return {};
            });
          })
          .then(function () {
            messageEl.textContent = "Subscribed successfully.";
            messageEl.className = "nav-dropdown-subscribe-message success";
            messageEl.hidden = false;
            form.reset();
          })
          .catch(function (err) {
            messageEl.textContent =
              err && err.message
                ? err.message
                : "Could not subscribe right now.";
            messageEl.className = "nav-dropdown-subscribe-message error";
            messageEl.hidden = false;
          })
          .finally(function () {
            btn.disabled = false;
            btn.textContent = originalText;
          });
      });
    });
})();
