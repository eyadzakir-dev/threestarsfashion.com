// Careers application form: inline validation, one CV with drag and drop, multipart submit.
// No intake endpoint is wired yet: with data-endpoint empty, local previews simulate a successful send.

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;
const MAX_CV_MB = 10;
const MAX_CV_BYTES = MAX_CV_MB * BYTES_PER_MB;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;
const REQUEST_TIMEOUT_MS = 120000;
const PREVIEW_DELAY_MS = 1100;
const PREVIEW_HOST_PATTERN = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.local|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/;
const CONTACT_EMAIL = "info@tsf.com.eg";
const SUBMIT_LABEL = "Submit application";
const SENDING_LABEL = "Sending…";
const DONE_LABEL = "Application received";
const INVALID_SUMMARY = "Check the highlighted fields.";
const EMAIL_DOMAIN_PATTERN = /@[^@\s]+\.[^@\s.]+$/;
const REVEAL_THRESHOLD = 0.15;
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)");

function createText(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

/* ---------- Validation ---------- */

function getNameError(field) {
  return field.value.trim() ? "" : "Enter your full name.";
}

function getEmailError(field) {
  const value = field.value.trim();
  if (!value) return "Enter your email address.";
  if (!field.checkValidity() || !EMAIL_DOMAIN_PATTERN.test(value)) return "Enter a valid email address, like name@example.com.";
  return "";
}

function getPhoneError(field) {
  const value = field.value.trim();
  if (!value) return "Enter your phone number.";
  const digits = value.replace(/\D/g, "").length;
  const isClean = /^\+?[\d\s().-]+$/.test(value);
  if (!isClean || digits < PHONE_MIN_DIGITS || digits > PHONE_MAX_DIGITS) return "Enter a valid phone number, like +20 100 000 0000.";
  return "";
}

const VALIDATORS = { name: getNameError, email: getEmailError, phone: getPhoneError };

function setFieldError(field, message) {
  document.getElementById(`${field.id}-err`).textContent = message;
  if (message) field.setAttribute("aria-invalid", "true");
  else field.removeAttribute("aria-invalid");
}

function validateField(field) {
  const message = VALIDATORS[field.name](field);
  setFieldError(field, message);
  if (message) field.dataset.flagged = "true";
  return !message;
}

function bindRevalidation(ui) {
  ui.validated.forEach((field) => {
    const revalidate = () => {
      if (field.dataset.flagged) validateField(field);
    };
    field.addEventListener("input", revalidate);
    field.addEventListener("blur", revalidate);
  });
}

function focusField(field) {
  field.focus({ preventScroll: true });
  field.closest(".iform__field").scrollIntoView({ block: "center" });
}

/* ---------- CV attachment (one file; a new pick replaces it) ---------- */

function getExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function formatSize(bytes) {
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
}

function getFileError(file) {
  const { name } = file;
  if (!ALLOWED_EXTENSIONS.has(getExtension(name))) return `${name} isn't a PDF or Word file.`;
  if (file.size === 0) return `${name} is empty.`;
  if (file.size > MAX_CV_BYTES) return `${name} is larger than ${MAX_CV_MB} MB.`;
  return "";
}

function renderCv(ctx) {
  const { fileList } = ctx.ui;
  if (!ctx.cv) {
    fileList.replaceChildren();
    return;
  }
  const row = document.createElement("li");
  const name = createText("span", "iform__pill-name", ctx.cv.name);
  const remove = createText("button", "iform__pill-x", "×");
  row.className = "iform__pill is-new";
  name.title = ctx.cv.name;
  remove.type = "button";
  remove.dataset.removeCv = "";
  remove.setAttribute("aria-label", `Remove ${ctx.cv.name}`);
  row.append(createText("span", "iform__pill-no mono", "CV"), name, createText("span", "iform__pill-size mono", formatSize(ctx.cv.size)), remove);
  fileList.replaceChildren(row);
}

function setCv(ctx, files) {
  const [file] = files;
  if (!file) return;
  const extra = files.length > 1 ? " Only one file can be attached, so we kept the first." : "";
  const error = getFileError(file);
  ctx.ui.fileError.textContent = error ? `${error}${extra}` : extra.trim();
  if (error) return;
  ctx.cv = file;
  renderCv(ctx);
  ctx.ui.fileLive.textContent = `${file.name} attached, ${formatSize(file.size)}.`;
}

function removeCv(ctx) {
  const { name } = ctx.cv;
  ctx.cv = null;
  ctx.ui.fileError.textContent = "";
  renderCv(ctx);
  ctx.ui.fileLive.textContent = `Removed ${name}. No CV attached.`;
  ctx.ui.picker.focus();
}

const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes("Files");

function bindCv(ctx) {
  const { picker, fileList, zone, form } = ctx.ui;
  picker.addEventListener("change", () => {
    setCv(ctx, [...picker.files]);
    picker.value = "";
  });
  fileList.addEventListener("click", (event) => {
    if (event.target.closest("[data-remove-cv]")) removeCv(ctx);
  });
  const over = (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    zone.classList.add("is-over");
  };
  zone.addEventListener("dragenter", over);
  zone.addEventListener("dragover", over);
  zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
  zone.addEventListener("drop", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    zone.classList.remove("is-over");
    setCv(ctx, [...event.dataTransfer.files]);
  });
  // Stops the browser from opening a file dropped on the form outside the dropzone.
  const block = (event) => {
    if (!hasFiles(event) || event.defaultPrevented) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
  };
  form.addEventListener("dragover", block);
  form.addEventListener("drop", block);
}

/* ---------- Submit ---------- */

function buildBody(ctx) {
  const body = new FormData(ctx.ui.form);
  body.delete("cv");
  [...body.entries()].forEach(([key, value]) => {
    if (typeof value === "string") body.set(key, value.trim());
  });
  if (ctx.cv) body.append("cv", ctx.cv, ctx.cv.name);
  return body;
}

async function readReference(response) {
  if (!response.headers.get("content-type")?.includes("json")) return "";
  const data = await response.json().catch(() => null);
  return typeof data?.reference === "string" ? data.reference.trim() : "";
}

async function postApplication(endpoint, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body,
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Application endpoint responded with ${response.status}.`);
    return { reference: await readReference(response) };
  } finally {
    clearTimeout(timer);
  }
}

// Stand-in until the intake integration is wired: logs what would be sent and resolves.
function previewApplication(body) {
  const summary = Object.fromEntries([...body.entries()].map(([key, value]) => [key, typeof value === "string" ? value : `${value.name} (${formatSize(value.size)})`]));
  console.info(`[careers] Preview only, nothing was sent. Payload: ${JSON.stringify(summary)}`);
  return new Promise((resolve) => {
    setTimeout(() => resolve({ reference: "" }), PREVIEW_DELAY_MS);
  });
}

function sendApplication(form, body) {
  const endpoint = (form.dataset.endpoint || "").trim();
  if (endpoint) return postApplication(endpoint, body);
  if (PREVIEW_HOST_PATTERN.test(location.hostname)) return previewApplication(body);
  return Promise.reject(new Error("Application endpoint is not configured."));
}

function setStatus(ui, content, isError) {
  ui.status.replaceChildren(...content);
  ui.status.classList.toggle("is-error", isError);
}

function setSending(ctx, isSending) {
  const { form, submit, submitLabel } = ctx.ui;
  ctx.isSending = isSending;
  submit.disabled = isSending;
  submitLabel.textContent = isSending ? SENDING_LABEL : SUBMIT_LABEL;
  if (isSending) form.setAttribute("aria-busy", "true");
  else form.removeAttribute("aria-busy");
}

function showFailure(ui) {
  const link = createText("a", "", CONTACT_EMAIL);
  link.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Job application: ${getRoleLabel(ui)}`)}`;
  setStatus(ui, ["We couldn't send your application. Try again, or email your CV to ", link, "."], true);
  ui.submit.focus();
}

/* ---------- Confirmation ---------- */

const getFirstName = (name) => name.trim().split(/\s+/)[0];

function getRoleLabel(ui) {
  const { role } = ui.fields;
  if (role.tagName === "SELECT") return role.selectedOptions[0].textContent.replace(/^R\/\d+ · /, "").trim();
  return ui.form.dataset.roleTitle || "General application";
}

function fillDone(ctx, reference) {
  const { done, fields } = ctx.ui;
  const parts = [getRoleLabel(ctx.ui), ctx.cv ? "CV attached" : "No CV"];
  done.label.textContent = reference ? `${DONE_LABEL} · ${reference}` : DONE_LABEL;
  done.title.textContent = `Thank you, ${getFirstName(fields.name.value)}.`;
  done.reply.replaceChildren("We'll be in touch at ", createText("b", "", fields.email.value.trim()), " or by phone if your profile fits.");
  done.sent.replaceChildren(createText("span", "k", "Sent"), ` · ${parts.join(" · ")}`);
}

function showSuccess(ctx, reference) {
  const { form, done } = ctx.ui;
  fillDone(ctx, reference);
  form.hidden = true;
  done.root.hidden = false;
  done.root.classList.remove("is-in");
  void done.root.offsetWidth;
  done.root.classList.add("is-in");
  done.root.scrollIntoView({ block: "nearest" });
  done.title.focus({ preventScroll: true });
}

function resetApplication(ctx) {
  const { form, done, fields } = ctx.ui;
  form.reset();
  ctx.cv = null;
  renderCv(ctx);
  ctx.ui.validated.forEach((field) => {
    setFieldError(field, "");
    delete field.dataset.flagged;
  });
  ctx.ui.fileError.textContent = "";
  ctx.ui.fileLive.textContent = "";
  setStatus(ctx.ui, [], false);
  done.root.hidden = true;
  form.hidden = false;
  fields.name.focus();
}

async function submitApplication(ctx) {
  const body = buildBody(ctx);
  let result = null;
  setSending(ctx, true);
  try {
    result = await sendApplication(ctx.ui.form, body);
  } catch (error) {
    console.warn("Application submission failed.", error);
  }
  setSending(ctx, false);
  if (result) showSuccess(ctx, result.reference);
  else showFailure(ctx.ui);
}

function handleSubmit(event, ctx) {
  event.preventDefault();
  if (ctx.isSending) return;
  setStatus(ctx.ui, [], false);
  const invalid = ctx.ui.validated.filter((field) => !validateField(field));
  if (invalid.length) {
    setStatus(ctx.ui, [INVALID_SUMMARY], true);
    focusField(invalid[0]);
    return;
  }
  if (ctx.ui.fields.website.value) showSuccess(ctx, "");
  else submitApplication(ctx);
}

/* ---------- Entrance ---------- */

// Fieldsets rise in the first time the form is seen (on role pages, when the Application tab opens).
function initEntrance(form) {
  if (REDUCED_MOTION.matches || !("IntersectionObserver" in window)) return;
  form.classList.add("is-armed");
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    form.classList.add("is-in");
    observer.disconnect();
  }, { threshold: REVEAL_THRESHOLD });
  observer.observe(form);
}

/* ---------- Init ---------- */

function getUi(form) {
  const names = ["name", "email", "phone", "role", "website"];
  const fields = Object.fromEntries(names.map((name) => [name, form.elements.namedItem(name)]));
  const doneRoot = form.parentElement.querySelector("[data-apply-done]");
  return {
    form,
    fields,
    validated: [fields.name, fields.email, fields.phone],
    zone: form.querySelector("[data-dropzone]"),
    picker: form.querySelector("[data-file-picker]"),
    fileList: form.querySelector("[data-file-list]"),
    fileError: form.querySelector("[data-file-error]"),
    fileLive: form.querySelector("[data-file-live]"),
    submit: form.querySelector("[data-apply-submit]"),
    submitLabel: form.querySelector("[data-submit-label]"),
    status: form.querySelector("[data-apply-status]"),
    done: {
      root: doneRoot,
      label: doneRoot.querySelector("[data-done-label]"),
      title: doneRoot.querySelector("[data-done-title]"),
      reply: doneRoot.querySelector("[data-done-reply]"),
      sent: doneRoot.querySelector("[data-done-sent]"),
      again: doneRoot.querySelector("[data-apply-again]"),
    },
  };
}

function initApplicationForm() {
  const form = document.querySelector("[data-apply-form]");
  if (!form) return;
  const ctx = { ui: getUi(form), cv: null, isSending: false };
  bindRevalidation(ctx.ui);
  bindCv(ctx);
  initEntrance(form);
  form.addEventListener("submit", (event) => handleSubmit(event, ctx));
  ctx.ui.done.again?.addEventListener("click", () => resetApplication(ctx));
}

initApplicationForm();
