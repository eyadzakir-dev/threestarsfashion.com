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
const CRM_TIMEOUT_MS = 15000;
const PREVIEW_DELAY_MS = 800;
const PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1"]);
const CONTACT_EMAIL = "info@tsf.com.eg";
const EMAIL_DOMAIN_PATTERN = /@[^@\s]+\.[^@\s.]+$/;
const COUNT_FORMAT = new Intl.NumberFormat("en-US");
const IS_AR = document.documentElement.lang === "ar";
const CRM_FORM_TYPE = "TSF_INQUIRY";
const CRM_SOURCE_SITE = "THREE_STARS_FASHION";
const CRM_SOURCE_LOGO = "https://threestarsfashion.com/assets/Brands/tsflogo.png";

const pad2 = (n) => String(n).padStart(2, "0");
// Keeps a Latin file name in one piece inside Arabic text.
const isolate = (text) => `\u2068${text}\u2069`;
const countFilesEn = (count) => `${count} file${count === 1 ? "" : "s"}`;

// Visitor-facing text in the page's language. Data sent to the endpoint (field names, option values) stays as is.
const T = IS_AR ? {
  submit: "أرسل الاستفسار",
  sending: "جارٍ الإرسال…",
  done: "تم استلام الاستفسار",
  invalid: "راجع الحقول المحددة.",
  quantityBad: "اكتب عددًا صحيحًا بين 1 و10,000,000.",
  nameMissing: "اكتب اسمك بالكامل.",
  emailMissing: "اكتب البريد الإلكتروني للعمل.",
  emailBad: "اكتب بريدًا إلكترونيًا صحيحًا، مثل buyer@brand.com.",
  mb: "ميجابايت",
  kb: "كيلوبايت",
  fileDuplicate: (name) => `الملف ${isolate(name)} مرفق بالفعل.`,
  fileType: (name) => `نوع الملف ${isolate(name)} غير مدعوم.`,
  fileEmpty: (name) => `الملف ${isolate(name)} فارغ.`,
  fileBig: (name) => `الملف ${isolate(name)} أكبر من ${MAX_TOTAL_MB} ميجابايت.`,
  tooMany: (name) => `يمكنك إرفاق ${MAX_FILES} ملفات بحد أقصى. احذف ملفًا لإضافة ${isolate(name)}.`,
  tooLarge: (name) => `الحد الأقصى لإجمالي الملفات ${MAX_TOTAL_MB} ميجابايت. احذف ملفًا لإضافة ${isolate(name)}.`,
  remove: (name) => `حذف ${name}`,
  attachedSummary: (count, size) => `الملفات المرفقة: ${count}، بحجم ${size} من ${MAX_TOTAL_MB} ميجابايت.`,
  noFiles: "لا توجد ملفات مرفقة.",
  removed: (name) => `تم حذف ${isolate(name)}. `,
  failure: ["تعذّر إرسال استفسارك. حاول مرة أخرى، أو راسلنا على ", "."],
  pieces: (count) => `${count} قطعة`,
  brief: "وصف المشروع",
  filesAttached: (count) => `المرفقات: ${count}`,
  thanks: (name) => `شكرًا، ${name}.`,
  reply: ["سنرد عليك على ", "."],
  sent: "أُرسل",
} : {
  submit: "Submit inquiry",
  sending: "Sending…",
  done: "Inquiry received",
  invalid: "Check the highlighted fields.",
  quantityBad: "Enter a whole number between 1 and 10,000,000.",
  nameMissing: "Enter your full name.",
  emailMissing: "Enter your business email.",
  emailBad: "Enter a valid email address, like buyer@brand.com.",
  mb: "MB",
  kb: "KB",
  fileDuplicate: (name) => `${name} is already attached.`,
  fileType: (name) => `${name} isn't a supported file type.`,
  fileEmpty: (name) => `${name} is empty.`,
  fileBig: (name) => `${name} is larger than ${MAX_TOTAL_MB} MB.`,
  tooMany: (name) => `You can attach up to ${MAX_FILES} files. Remove a file to add ${name}.`,
  tooLarge: (name) => `Files can total ${MAX_TOTAL_MB} MB. Remove a file to add ${name}.`,
  remove: (name) => `Remove ${name}`,
  attachedSummary: (count, size) => `${countFilesEn(count)} attached, ${size} of ${MAX_TOTAL_MB} MB.`,
  noFiles: "No files attached.",
  removed: (name) => `Removed ${name}. `,
  failure: ["We couldn't send your inquiry. Try again, or email ", "."],
  pieces: (count) => `${count} pcs`,
  brief: "Brief",
  filesAttached: (count) => `${countFilesEn(count)} attached`,
  thanks: (name) => `Thank you, ${name}.`,
  reply: ["We'll reply to ", "."],
  sent: "Sent",
};

function createText(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

/* ---------- Validation ---------- */

function getNameError(field) {
  return field.value.trim() ? "" : T.nameMissing;
}

function getEmailError(field) {
  const value = field.value.trim();
  if (!value) return T.emailMissing;
  if (!field.checkValidity() || !EMAIL_DOMAIN_PATTERN.test(value)) return T.emailBad;
  return "";
}

function getQuantityError(field) {
  if (field.validity.badInput) return T.quantityBad;
  if (field.value === "") return "";
  const quantity = Number(field.value);
  const isInRange = quantity >= QUANTITY_MIN && quantity <= QUANTITY_MAX;
  return Number.isInteger(quantity) && isInRange ? "" : T.quantityBad;
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
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1)} ${T.mb}`;
  return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} ${T.kb}`;
}

function getFileError(files, file) {
  const { name } = file;
  if (files.some((added) => getFileKey(added) === getFileKey(file))) return T.fileDuplicate(name);
  if (!ALLOWED_EXTENSIONS.has(getExtension(name))) return T.fileType(name);
  if (file.size === 0) return T.fileEmpty(name);
  if (file.size > MAX_TOTAL_BYTES) return T.fileBig(name);
  if (files.length >= MAX_FILES) return T.tooMany(name);
  if (getTotalBytes(files) + file.size > MAX_TOTAL_BYTES) return T.tooLarge(name);
  return "";
}

function createRemoveButton(name, index) {
  const button = createText("button", "iform__pill-x", "×");
  button.type = "button";
  button.dataset.index = String(index);
  button.setAttribute("aria-label", T.remove(name));
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
    ? T.attachedSummary(files.length, formatSize(getTotalBytes(files)))
    : T.noFiles;
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
  announceFiles(ctx, T.removed(removed.name));
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

function trimField(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildCrmPayload(ctx) {
  const { fields, marketOther } = ctx.ui;
  const market = fields.market.value === OTHER_MARKET
    ? trimField(marketOther.value) || OTHER_MARKET
    : trimField(fields.market.selectedOptions[0]?.textContent || fields.market.value);
  const payload = {
    formType: CRM_FORM_TYPE,
    sourceSite: CRM_SOURCE_SITE,
    name: trimField(fields.name.value),
    email: trimField(fields.email.value),
    sourceLogoUrl: CRM_SOURCE_LOGO,
    sourcePageUrl: location.href.split("#")[0],
    submittedAt: new Date().toISOString(),
  };
  const company = trimField(ctx.ui.form.elements.namedItem("company")?.value);
  const phone = trimField(ctx.ui.form.elements.namedItem("phone")?.value);
  const product = trimField(fields.product.value);
  const quantity = trimField(fields.quantity.value);
  const message = trimField(fields.message.value);
  if (company) payload.company = company;
  if (phone) payload.phone = phone;
  if (product) payload.product = product;
  if (quantity) payload.quantity = quantity;
  if (market) payload.market = market;
  if (message) payload.message = message;
  return payload;
}

async function postCrm(form, payload) {
  const endpoint = (form.dataset.crmEndpoint || "").trim();
  if (!endpoint) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRM_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`CRM endpoint responded with ${response.status}.`);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

function sendCrm(ctx) {
  const endpoint = (ctx.ui.form.dataset.crmEndpoint || "").trim();
  if (!endpoint) return Promise.resolve(null);
  return postCrm(ctx.ui.form, buildCrmPayload(ctx));
}

function setStatus(ui, content, isError) {
  ui.status.replaceChildren(...content);
  ui.status.classList.toggle("is-error", isError);
}

function setSending(ctx, isSending) {
  const { form, submit, submitLabel } = ctx.ui;
  ctx.isSending = isSending;
  submit.disabled = isSending;
  submitLabel.textContent = isSending ? T.sending : T.submit;
  if (isSending) form.setAttribute("aria-busy", "true");
  else form.removeAttribute("aria-busy");
}

function showFailure(ui) {
  const link = createText("a", "", CONTACT_EMAIL);
  link.href = `mailto:${CONTACT_EMAIL}`;
  setStatus(ui, [T.failure[0], link, T.failure[1]], true);
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
    quantity.value ? T.pieces(COUNT_FORMAT.format(Number(quantity.value))) : "",
    getMarketLabel(ctx.ui),
    message.value.trim() ? T.brief : "",
    ctx.files.length ? T.filesAttached(ctx.files.length) : "",
  ].filter(Boolean);
}

function fillDone(ctx, reference) {
  const { done, fields } = ctx.ui;
  const parts = getSentParts(ctx);
  done.label.textContent = reference ? `${T.done} · ${reference}` : T.done;
  done.title.textContent = T.thanks(getFirstName(fields.name.value));
  done.reply.replaceChildren(T.reply[0], createText("b", "", fields.email.value.trim()), T.reply[1]);
  done.sent.replaceChildren(createText("span", "k", T.sent), ` · ${parts.join(" · ")}`);
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
  setSending(ctx, true);
  const [fabrik, crm] = await Promise.allSettled([
    sendInquiry(ctx.ui.form, body),
    sendCrm(ctx),
  ]);
  setSending(ctx, false);
  if (crm.status === "rejected") console.warn("CRM inquiry submission failed.", crm.reason);
  if (fabrik.status === "fulfilled") showSuccess(ctx, fabrik.value.reference);
  else {
    console.warn("Inquiry submission failed.", fabrik.reason);
    showFailure(ctx.ui);
  }
}

function handleSubmit(event, ctx) {
  event.preventDefault();
  if (ctx.isSending) return;
  setStatus(ctx.ui, [], false);
  const invalid = ctx.ui.validated.filter((field) => !validateField(field));
  if (invalid.length) {
    setStatus(ctx.ui, [T.invalid], true);
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
