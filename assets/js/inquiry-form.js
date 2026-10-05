// Contact page inquiry form: inline validation, multi-file attachments with drag and drop, multipart submit.

const MAX_FILES = 10;
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;
const MAX_TOTAL_MB = 25;
const MAX_TOTAL_BYTES = MAX_TOTAL_MB * BYTES_PER_MB;
const ALLOWED_EXTENSIONS = new Set(["pdf", "ai", "zip", "png", "jpg", "jpeg"]);
const QUANTITY_MIN = 1;
const QUANTITY_MAX = 10000000;
const OTHER_MARKET = "other";
const REQUEST_TIMEOUT_MS = 120000;
const PREVIEW_DELAY_MS = 800;
const PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1"]);
const CONTACT_EMAIL = "info@tsf.com.eg";
const SUBMIT_LABEL = "Submit inquiry";
const SENDING_LABEL = "Sending…";
const DONE_LABEL = "Inquiry received";
const INVALID_SUMMARY = "Check the highlighted fields.";
const QUANTITY_ERROR = "Enter a whole number between 1 and 10,000,000.";
const EMAIL_DOMAIN_PATTERN = /@[^@\s]+\.[^@\s.]+$/;
const COUNT_FORMAT = new Intl.NumberFormat("en-US");

const pad2 = (n) => String(n).padStart(2, "0");
const pluralize = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

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
  if (!value) return "Enter your business email.";
  if (!field.checkValidity() || !EMAIL_DOMAIN_PATTERN.test(value)) return "Enter a valid email address, like buyer@brand.com.";
  return "";
}

function getQuantityError(field) {
  if (field.validity.badInput) return QUANTITY_ERROR;
  if (field.value === "") return "";
  const quantity = Number(field.value);
  const isInRange = quantity >= QUANTITY_MIN && quantity <= QUANTITY_MAX;
  return Number.isInteger(quantity) && isInRange ? "" : QUANTITY_ERROR;
}

const VALIDATORS = { name: getNameError, email: getEmailError, quantity: getQuantityError };

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

/* ---------- Attachments ---------- */

function getExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

const getFileKey = (file) => `${file.name}:${file.size}:${file.lastModified}`;
const getTotalBytes = (files) => files.reduce((sum, file) => sum + file.size, 0);

function formatSize(bytes) {
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
}

function getFileError(files, file) {
  const { name } = file;
  if (files.some((added) => getFileKey(added) === getFileKey(file))) return `${name} is already attached.`;
  if (!ALLOWED_EXTENSIONS.has(getExtension(name))) return `${name} isn't a supported file type.`;
  if (file.size === 0) return `${name} is empty.`;
  if (file.size > MAX_TOTAL_BYTES) return `${name} is larger than ${MAX_TOTAL_MB} MB.`;
  if (files.length >= MAX_FILES) return `You can attach up to ${MAX_FILES} files. Remove a file to add ${name}.`;
  if (getTotalBytes(files) + file.size > MAX_TOTAL_BYTES) return `Files can total ${MAX_TOTAL_MB} MB. Remove a file to add ${name}.`;
  return "";
}

function createRemoveButton(name, index) {
  const button = createText("button", "iform__pill-x", "×");
  button.type = "button";
  button.dataset.index = String(index);
  button.setAttribute("aria-label", `Remove ${name}`);
  return button;
}

function createFileRow(file, index) {
  const row = document.createElement("li");
  const name = createText("span", "iform__pill-name", file.name);
  row.className = "iform__pill";
  name.title = file.name;
  row.append(
    createText("span", "iform__pill-no mono", `F/${pad2(index + 1)}`),
    name,
    createText("span", "iform__pill-size mono", formatSize(file.size)),
    createRemoveButton(file.name, index),
  );
  return row;
}

function renderFiles(ctx) {
  ctx.ui.fileList.replaceChildren(...ctx.files.map(createFileRow));
}

function announceFiles(ctx, prefix = "") {
  const { files } = ctx;
  const summary = files.length
    ? `${pluralize(files.length, "file")} attached, ${formatSize(getTotalBytes(files))} of ${MAX_TOTAL_MB} MB.`
    : "No files attached.";
  ctx.ui.fileLive.textContent = `${prefix}${summary}`;
}

function addFiles(ctx, incoming) {
  const errors = [];
  [...incoming].forEach((file) => {
    const error = getFileError(ctx.files, file);
    if (error) errors.push(error);
    else ctx.files = [...ctx.files, file];
  });
  ctx.ui.fileError.textContent = errors.join(" ");
  renderFiles(ctx);
  announceFiles(ctx);
}

function removeFile(ctx, index) {
  const [removed] = ctx.files.slice(index, index + 1);
  ctx.files = ctx.files.filter((_, i) => i !== index);
  ctx.ui.fileError.textContent = "";
  renderFiles(ctx);
  announceFiles(ctx, `Removed ${removed.name}. `);
  const buttons = ctx.ui.fileList.querySelectorAll("[data-index]");
  (buttons[Math.min(index, buttons.length - 1)] || ctx.ui.picker).focus();
}

function bindFiles(ctx) {
  const { picker, fileList } = ctx.ui;
  picker.addEventListener("change", () => {
    addFiles(ctx, picker.files);
    picker.value = "";
  });
  fileList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-index]");
    if (button) removeFile(ctx, Number(button.dataset.index));
  });
}

/* ---------- Drag and drop ---------- */

const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes("Files");

function handleDragOver(event, zone) {
  if (!hasFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  zone.classList.add("is-over");
}

function handleDrop(event, ctx) {
  if (!hasFiles(event)) return;
  event.preventDefault();
  ctx.ui.zone.classList.remove("is-over");
  addFiles(ctx, event.dataTransfer.files);
}

// Stops the browser from opening a file dropped on the form outside the dropzone.
function blockStrayDrop(event) {
  if (!hasFiles(event) || event.defaultPrevented) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "none";
}

function bindDropzone(ctx) {
  const { zone, form } = ctx.ui;
  zone.addEventListener("dragenter", (event) => handleDragOver(event, zone));
  zone.addEventListener("dragover", (event) => handleDragOver(event, zone));
  zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
  zone.addEventListener("drop", (event) => handleDrop(event, ctx));
  form.addEventListener("dragover", blockStrayDrop);
  form.addEventListener("drop", blockStrayDrop);
}

/* ---------- Submit ---------- */

function buildBody(ctx) {
  const body = new FormData(ctx.ui.form);
  body.delete("files");
  [...body.entries()].forEach(([key, value]) => {
    if (typeof value === "string") body.set(key, value.trim());
  });
  ctx.files.forEach((file) => body.append("files", file, file.name));
  return body;
}

async function readReference(response) {
  if (!response.headers.get("content-type")?.includes("json")) return "";
  // A 2xx already means success; the JSON body is optional.
  const data = await response.json().catch(() => null);
  return typeof data?.reference === "string" ? data.reference.trim() : "";
}

async function postInquiry(endpoint, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body,
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Inquiry endpoint responded with ${response.status}.`);
    return { reference: await readReference(response) };
  } finally {
    clearTimeout(timer);
  }
}

function previewInquiry() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ reference: "" }), PREVIEW_DELAY_MS);
  });
}

function sendInquiry(form, body) {
  const endpoint = (form.dataset.endpoint || "").trim();
  if (endpoint) return postInquiry(endpoint, body);
  if (PREVIEW_HOSTS.has(location.hostname)) return previewInquiry();
  return Promise.reject(new Error("Inquiry endpoint is not configured."));
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
  link.href = `mailto:${CONTACT_EMAIL}`;
  setStatus(ui, ["We couldn't send your inquiry. Try again, or email ", link, "."], true);
  ui.submit.focus();
}

/* ---------- Confirmation ---------- */

const getFirstName = (name) => name.trim().split(/\s+/)[0];

function getMarketLabel(ui) {
  const { market } = ui.fields;
  if (!market.value) return "";
  const otherText = market.value === OTHER_MARKET ? ui.marketOther.value.trim() : "";
  return otherText || market.selectedOptions[0].textContent;
}

function getSentParts(ctx) {
  const { product, quantity, message } = ctx.ui.fields;
  return [
    product.value.trim(),
    quantity.value ? `${COUNT_FORMAT.format(Number(quantity.value))} pcs` : "",
    getMarketLabel(ctx.ui),
    message.value.trim() ? "Brief" : "",
    ctx.files.length ? `${pluralize(ctx.files.length, "file")} attached` : "",
  ].filter(Boolean);
}

function fillDone(ctx, reference) {
  const { done, fields } = ctx.ui;
  const parts = getSentParts(ctx);
  done.label.textContent = reference ? `${DONE_LABEL} · ${reference}` : DONE_LABEL;
  done.title.textContent = `Thank you, ${getFirstName(fields.name.value)}.`;
  done.reply.replaceChildren("We'll reply to ", createText("b", "", fields.email.value.trim()), ".");
  done.sent.replaceChildren(createText("span", "k", "Sent"), ` · ${parts.join(" · ")}`);
  done.sent.hidden = parts.length === 0;
}

function showSuccess(ctx, reference) {
  const { form, done } = ctx.ui;
  fillDone(ctx, reference);
  form.hidden = true;
  done.root.hidden = false;
  done.root.scrollIntoView({ block: "nearest" });
  done.title.focus({ preventScroll: true });
}

function clearErrors(ui) {
  ui.validated.forEach((field) => {
    setFieldError(field, "");
    delete field.dataset.flagged;
  });
  ui.fileError.textContent = "";
  ui.fileLive.textContent = "";
  setStatus(ui, [], false);
}

function resetInquiry(ctx) {
  const { form, done, fields } = ctx.ui;
  form.reset();
  syncMarketOther(ctx.ui);
  ctx.files = [];
  renderFiles(ctx);
  clearErrors(ctx.ui);
  done.root.hidden = true;
  form.hidden = false;
  fields.name.focus();
}

async function submitInquiry(ctx) {
  const body = buildBody(ctx);
  let result = null;
  setSending(ctx, true);
  try {
    result = await sendInquiry(ctx.ui.form, body);
  } catch (error) {
    console.warn("Inquiry submission failed.", error);
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
  else submitInquiry(ctx);
}

/* ---------- Init ---------- */

function getFields(form) {
  const names = ["name", "email", "product", "quantity", "market", "message", "website"];
  return Object.fromEntries(names.map((name) => [name, form.elements.namedItem(name)]));
}

function getDoneUi(panel) {
  const root = panel.querySelector("[data-inquiry-done]");
  return {
    root,
    label: root.querySelector("[data-done-label]"),
    title: root.querySelector("[data-done-title]"),
    reply: root.querySelector("[data-done-reply]"),
    sent: root.querySelector("[data-done-sent]"),
    again: root.querySelector("[data-inquiry-again]"),
  };
}

function getUi(form) {
  const fields = getFields(form);
  return {
    form,
    fields,
    validated: [fields.name, fields.email, fields.quantity],
    marketOther: form.elements.namedItem("market_other"),
    marketOtherField: form.querySelector("[data-market-other]"),
    zone: form.querySelector("[data-dropzone]"),
    picker: form.querySelector("[data-file-picker]"),
    fileList: form.querySelector("[data-file-list]"),
    fileError: form.querySelector("[data-file-error]"),
    fileLive: form.querySelector("[data-file-live]"),
    submit: form.querySelector("[data-inquiry-submit]"),
    submitLabel: form.querySelector("[data-submit-label]"),
    status: form.querySelector("[data-inquiry-status]"),
    done: getDoneUi(form.closest(".inq__form")),
  };
}

// The free-text market only shows, and only submits, when "Other" is picked.
function syncMarketOther(ui) {
  const isOther = ui.fields.market.value === OTHER_MARKET;
  ui.marketOtherField.hidden = !isOther;
  ui.marketOther.disabled = !isOther;
}

function initInquiryForm() {
  const form = document.querySelector("[data-inquiry-form]");
  if (!form) return;
  const ctx = { ui: getUi(form), files: [], isSending: false };
  syncMarketOther(ctx.ui);
  ctx.ui.fields.market.addEventListener("change", () => syncMarketOther(ctx.ui));
  bindRevalidation(ctx.ui);
  bindFiles(ctx);
  bindDropzone(ctx);
  form.addEventListener("submit", (event) => handleSubmit(event, ctx));
  ctx.ui.done.again.addEventListener("click", () => resetInquiry(ctx));
}

initInquiryForm();
