const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const wall = document.querySelector("#wall");
const status = document.querySelector("#status");
const photoCount = document.querySelector("#photoCount");
const modal = document.querySelector("#uploadModal");
const form = document.querySelector("#uploadForm");
const input = document.querySelector("#photoInput");
const preview = document.querySelector("#preview");
const previewImage = document.querySelector("#previewImage");
const fileName = document.querySelector("#fileName");
const fileSize = document.querySelector("#fileSize");
const uploadError = document.querySelector("#uploadError");
const uploadSuccess = document.querySelector("#uploadSuccess");
const submitUpload = document.querySelector("#submitUpload");
const progressWrap = document.querySelector("#progressWrap");
const progressBar = document.querySelector("#progressBar");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");

let knownIds = new Set();
let firstLoad = true;

function openModal() {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  setTimeout(() => input.focus(), 0);
}

function closeModal() {
  if (!modal.hidden) {
    modal.hidden = true;
    document.body.style.overflow = "";
  }
}

function openLightbox(url) {
  lightboxImage.src = url;
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.removeAttribute("src");
  document.body.style.overflow = "";
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function showMessage(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function clearMessages() {
  uploadError.hidden = true;
  uploadSuccess.hidden = true;
}

function renderPhotos(photos) {
  const incoming = new Set(photos.map((photo) => photo.publicId));
  if (!firstLoad && incoming.size === knownIds.size && [...incoming].every((id) => knownIds.has(id))) return;

  const fragment = document.createDocumentFragment();
  for (const photo of photos) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.title = "Open photo";
    card.addEventListener("click", () => openLightbox(photo.url));

    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = photo.url;
    img.alt = "Halloween event photo";

    card.appendChild(img);
    fragment.appendChild(card);
  }

  wall.replaceChildren(fragment);
  knownIds = incoming;
  photoCount.textContent = photos.length ? `· ${photos.length}` : "";
  firstLoad = false;
}

async function loadPhotos() {
  try {
    const response = await fetch("/api/photos", { cache: "no-store" });
    if (!response.ok) throw new Error("Wall unavailable");
    const data = await response.json();
    const photos = Array.isArray(data.photos) ? data.photos : [];
    renderPhotos(photos);
    status.textContent = photos.length ? "New photos appear automatically." : "No photos yet — be the first to add one.";
  } catch {
    if (firstLoad) status.textContent = "The wall is waking up. Please try again in a moment.";
  }
}

function validateFile(file) {
  if (!file) return "Please choose a photo.";
  if (file.size <= 0) return "That file is empty. Please choose another photo.";
  if (file.size > MAX_BYTES) return "That photo is over 15 MB. Please choose a smaller one.";
  if (!ACCEPTED.has(file.type.toLowerCase())) return "Please choose a JPG, PNG, WebP, HEIC or HEIF image.";
  return null;
}

function showPreview(file) {
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  preview.hidden = false;

  if (file.type.startsWith("image/") && !["image/heic", "image/heif"].includes(file.type.toLowerCase())) {
    const url = URL.createObjectURL(file);
    previewImage.onload = () => URL.revokeObjectURL(url);
    previewImage.src = url;
    previewImage.hidden = false;
  } else {
    previewImage.hidden = true;
  }
}

function uploadWithProgress(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) progressBar.style.width = `${Math.round((event.loaded / event.total) * 100)}%`;
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response || {});
      else reject(new Error(xhr.response?.error || "Upload failed."));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error. Please try again.")));
    const data = new FormData();
    data.append("photo", file, file.name);
    data.append("website", "");
    xhr.send(data);
  });
}

function setupQr() {
  const target = `${location.origin}/?upload=1`;
  if (window.QRCode) {
    new QRCode(document.querySelector("#qrcode"), {
      text: target,
      width: 170,
      height: 170,
      correctLevel: QRCode.CorrectLevel.M,
    });
  }
}

input.addEventListener("change", () => {
  clearMessages();
  const file = input.files?.[0];
  const error = validateFile(file);
  if (error) {
    showMessage(uploadError, error);
    input.value = "";
    preview.hidden = true;
    return;
  }
  showPreview(file);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();
  const file = input.files?.[0];
  const error = validateFile(file);
  if (error) return showMessage(uploadError, error);

  submitUpload.disabled = true;
  progressWrap.hidden = false;
  progressBar.style.width = "0%";
  submitUpload.textContent = "Uploading…";

  try {
    await uploadWithProgress(file);
    progressBar.style.width = "100%";
    showMessage(uploadSuccess, "Photo added! It will appear on the wall in a moment.");
    form.reset();
    preview.hidden = true;
    submitUpload.textContent = "Uploaded ✓";
    await loadPhotos();
    setTimeout(closeModal, 1700);
  } catch (err) {
    showMessage(uploadError, err.message || "Upload failed. Please try again.");
    submitUpload.disabled = false;
    submitUpload.textContent = "Upload photo";
  }
});

for (const button of [document.querySelector("#uploadTop"), document.querySelector("#uploadMain")]) button.addEventListener("click", openModal);
document.querySelector("#closeUpload").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target.hasAttribute("data-close")) closeModal(); });
document.querySelector("#closeLightbox").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
    closeLightbox();
  }
});

setupQr();
loadPhotos();
setInterval(loadPhotos, 4000);

if (new URLSearchParams(location.search).get("upload") === "1") openModal();
