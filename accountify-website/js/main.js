document.documentElement.classList.add("js");

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("site-nav");
toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!open));
  nav.classList.toggle("is-open", !open);
});

// "Services" dropdown: click to open (touch screens), click outside to close
document.querySelectorAll(".nav__trigger").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    trigger.setAttribute("aria-expanded", String(trigger.getAttribute("aria-expanded") !== "true"));
  });
});
document.addEventListener("click", (event) => {
  document.querySelectorAll(".nav__trigger[aria-expanded='true']").forEach((trigger) => {
    if (!trigger.parentElement.contains(event.target)) trigger.setAttribute("aria-expanded", "false");
  });
});

// Keep the copyright year current
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Animations ---------- */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Count numbers up from zero (keeps the final value in the HTML for no-JS visitors)
function countUp(el) {
  const end = Number(el.dataset.count);
  const prefix = el.dataset.prefix || "";
  if (reduceMotion || !end) return;
  const start = performance.now(), duration = 1400;
  const fmt = (n) => prefix + Math.round(n).toLocaleString("en-US");
  (function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = fmt(end * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}

// Elements that fade up as they scroll into view, staggered within each group
const revealSelectors = [
  ".section__head", ".card", ".why__card", ".pillar", ".tile", ".steps li", ".quote", ".feature",
  ".faq", ".case", ".founder > *", ".facts", ".cred__item", ".stat", ".contact-list li", ".form", ".vision__inner > *", ".cta__inner > *", ".prose > *",
];
const revealEls = document.querySelectorAll(revealSelectors.join(","));
revealEls.forEach((el) => {
  el.classList.add("reveal");
  const siblings = [...el.parentElement.children].filter((c) => c.matches(revealSelectors.join(",")));
  el.style.setProperty("--d", `${Math.min(siblings.indexOf(el), 5) * 80}ms`);
});
document.querySelectorAll(".ledger tbody tr").forEach((tr, i) => tr.style.setProperty("--d", `${i * 110}ms`));

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-in");
    entry.target.querySelectorAll("[data-count]").forEach(countUp);
    io.unobserve(entry.target);
  });
}, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

[...revealEls, ...document.querySelectorAll(".dash, .ledger")].forEach((el) => io.observe(el));

/* ---------- Newsletter popup ---------- */
(function () {
  const pop = document.getElementById("newsletter");
  if (!pop) return;
  const KEY = "acc-nl-dismissed";
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  let lastFocus = null;

  const recentlyDismissed = () => {
    try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < WEEK; } catch (e) { return false; }
  };
  const remember = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} };

  function open() {
    if (!pop.hidden) return;
    lastFocus = document.activeElement;
    pop.hidden = false;
    pop.classList.add("is-open");
    document.body.style.overflow = "hidden";
    setTimeout(() => pop.querySelector("input[name=name]")?.focus(), 350);
  }
  function close() {
    pop.hidden = true;
    pop.classList.remove("is-open");
    document.body.style.overflow = "";
    remember();
    if (lastFocus) lastFocus.focus();
  }

  pop.querySelectorAll("[data-nl-close]").forEach((el) => el.addEventListener("click", close));
  document.addEventListener("keydown", (e) => {
    if (pop.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "Tab") { // keep keyboard focus inside the dialog
      const f = [...pop.querySelectorAll("button, input:not([type=hidden]), a")].filter((el) => el.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // Submit the newsletter to FormSubmit and keep the existing popup confirmation.
  const form = pop.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    if (btn.disabled) return;
    const label = btn.textContent;
    const oldNote = form.querySelector(".form__status");
    if (oldNote) oldNote.remove();
    btn.disabled = true; btn.textContent = "Signing you up…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch("https://formsubmit.co/ajax/frameloft.marketing@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || (result?.success !== true && result?.success !== "true")) {
        throw new Error("Newsletter submission was not confirmed.");
      }
      form.hidden = true;
      pop.querySelector(".nl__done").hidden = false;
      remember();
    } catch (error) {
      showNote(form, "We couldn't confirm your sign-up. Please try again.");
    } finally {
      clearTimeout(timeout);
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  // Show once after a short delay, unless the visitor closed it in the last 7 days
  if (!recentlyDismissed()) setTimeout(open, 4000);
})();

/* ---------- Newsletter: existing Netlify Forms helpers ---------- */
// These helpers are used by the newsletter popup above.
// The contact form uses its own HTML action to send directly to FormSubmit.
function sendForm(form) {
  const body = new URLSearchParams(new FormData(form)).toString();
  return fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })
    .then((r) => { if (!r.ok) throw new Error("Form post failed: " + r.status); });
}
function emailFallback(form, subject, intro) {
  const skip = ["form-name", "company-website", "nl-website"];
  const lines = [intro, ""];
  new FormData(form).forEach((value, key) => {
    if (!skip.includes(key) && String(value).trim()) lines.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`);
  });
  location.href = `mailto:info@accountifyllc.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
function showNote(form, text) {
  let note = form.querySelector(".form__status");
  if (!note) { note = document.createElement("p"); note.className = "form__status"; note.setAttribute("role", "status"); form.appendChild(note); }
  note.textContent = text;
}

/* ---------- Contact form ---------- */
// No JavaScript submit handler is needed here.
// contact.html POSTs to FormSubmit, which handles verification and the
// configured thank-you redirect. Do not intercept this form with sendForm().
