const MAX_BYTES = 15 * 1024 * 1024;
const MAX_CAPTION = 15;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const SUPABASE_URL = "https://vjugsidfdovuwtxgcvrz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Q_HeljHf6jSNZm7nONcazw_JIlEZRVS";
const BUCKET = "wall-photos";
const TABLE = "wall_photos";

const wall = document.querySelector("#wall");
const status = document.querySelector("#status");
const modal = document.querySelector("#uploadModal");
const form = document.querySelector("#uploadForm");
const input = document.querySelector("#photoInput");
const captionInput = document.querySelector("#caption");
const cameraPrompt = document.querySelector("#cameraPrompt");
const photoReview = document.querySelector("#photoReview");
const openCamera = document.querySelector("#openCamera");
const retakePhoto = document.querySelector("#retakePhoto");
const previewImage = document.querySelector("#previewImage");
const uploadError = document.querySelector("#uploadError");
const uploadSuccess = document.querySelector("#uploadSuccess");
const submitUpload = document.querySelector("#submitUpload");
const progressWrap = document.querySelector("#progressWrap");
const progressBar = document.querySelector("#progressBar");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const honeypot = form.querySelector("input[name=website]");

const apiHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
let knownIds = new Set();
let firstLoad = true;

function showModal() {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function hideModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
  resetReview();
}
function startCamera() {
  input.value = "";
  input.click();
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
function showMessage(element, message) {
  element.textContent = message;
  element.hidden = false;
}
function clearMessages() {
  uploadError.hidden = true;
  uploadSuccess.hidden = true;
}
function publicPhotoUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
}
function renderPhotos(photos) {
  const incoming = new Set(photos.map((photo) => photo.public_id));
  if (!firstLoad && incoming.size === knownIds.size && [...incoming].every((id) => knownIds.has(id))) return;
  const fragment = document.createDocumentFragment();
  for (const photo of photos) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.title = "Open photo";
    card.addEventListener("click", () => openLightbox(publicPhotoUrl(photo.storage_path)));
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = publicPhotoUrl(photo.storage_path);
    img.alt = photo.caption ? `Halloween photo: ${photo.caption}` : "Halloween event photo";
    card.appendChild(img);
    if (photo.caption) {
      const caption = document.createElement("span");
      caption.className = "card-caption";
      caption.textContent = photo.caption;
      card.appendChild(caption);
    }
    fragment.appendChild(card);
  }
  wall.replaceChildren(fragment);
  knownIds = incoming;
  firstLoad = false;
}
async function loadPhotos() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=public_id,storage_path,created_at,caption&approved=eq.true&order=created_at.desc&limit=300`, { headers: apiHeaders, cache: "no-store" });
    if (!response.ok) throw new Error("Wall unavailable");
    const photos = await response.json();
    renderPhotos(Array.isArray(photos) ? photos : []);
    status.textContent = photos.length ? "New photos appear automatically." : "No photos yet — be the first to add one.";
  } catch {
    if (firstLoad) status.textContent = "The wall is waking up. Please try again in a moment.";
  }
}
function validateFile(file) {
  if (!file) return "Please take a photo.";
  if (file.size <= 0) return "That photo is empty. Please try again.";
  if (file.size > MAX_BYTES) return "That photo is over 15 MB. Please take a smaller one.";
  if (!ACCEPTED.has(file.type.toLowerCase())) return "Please take a JPG, PNG, WebP, HEIC or HEIF photo.";
  return null;
}
function validateCaption() {
  if ([...captionInput.value].length > MAX_CAPTION) return "Your caption can be 15 letters maximum.";
  return null;
}
function showReview(file) {
  clearMessages();
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") {
    previewImage.removeAttribute("src");
    previewImage.alt = "Photo taken — ready to pin";
  } else {
    const url = URL.createObjectURL(file);
    previewImage.onload = () => URL.revokeObjectURL(url);
    previewImage.src = url;
  }
  cameraPrompt.hidden = true;
  photoReview.hidden = false;
  showModal();
  setTimeout(() => captionInput.focus(), 120);
}
function resetReview() {
  form.reset();
  cameraPrompt.hidden = true;
  photoReview.hidden = true;
  previewImage.removeAttribute("src");
  clearMessages();
  progressWrap.hidden = true;
  progressBar.style.width = "0";
  submitUpload.disabled = false;
  submitUpload.textContent = "Pin";
}
function extensionFor(mime) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" }[mime] || "bin";
}
async function uploadPhoto(file, caption) {
  const publicId = crypto.randomUUID();
  const path = `${publicId}.${extensionFor(file.type.toLowerCase())}`;
  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...apiHeaders, "content-type": file.type, "cache-control": "31536000", "x-upsert": "false" },
    body: file,
  });
  if (!uploadResponse.ok) throw new Error((await uploadResponse.text()) || "Photo upload failed.");
  const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...apiHeaders, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ public_id: publicId, storage_path: path, bytes: file.size, mime_type: file.type.toLowerCase(), caption, approved: true }),
  });
  if (!insertResponse.ok) throw new Error((await insertResponse.text()) || "The photo could not be added to the wall.");
}
input.addEventListener("change", () => {
  clearMessages();
  const file = input.files?.[0];
  const error = validateFile(file);
  if (error) {
    showMessage(uploadError, error);
    input.value = "";
    return;
  }
  showReview(file);
});
captionInput.addEventListener("input", () => {
  const chars = [...captionInput.value];
  if (chars.length > MAX_CAPTION) captionInput.value = chars.slice(0, MAX_CAPTION).join("");
});
retakePhoto.addEventListener("click", startCamera);
openCamera?.addEventListener("click", startCamera);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();
  if (honeypot.value) return;
  const file = input.files?.[0];
  const fileError = validateFile(file);
  if (fileError) return showMessage(uploadError, fileError);
  const captionError = validateCaption();
  if (captionError) return showMessage(uploadError, captionError);
  submitUpload.disabled = true;
  progressWrap.hidden = false;
  progressBar.style.width = "25%";
  submitUpload.textContent = "Pinning…";
  try {
    await uploadPhoto(file, captionInput.value.trim());
    progressBar.style.width = "100%";
    showMessage(uploadSuccess, "Pinned! Your Polaroid is on the wall.");
    await loadPhotos();
    submitUpload.textContent = "Pinned ✓";
    setTimeout(hideModal, 1100);
  } catch (err) {
    showMessage(uploadError, err.message || "Upload failed. Please try again.");
    submitUpload.disabled = false;
    submitUpload.textContent = "Pin";
  }
});
document.querySelector("#uploadMain").addEventListener("click", startCamera);
document.querySelector("#closeUpload").addEventListener("click", hideModal);
document.querySelector("#closeLightbox").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { hideModal(); closeLightbox(); } });
loadPhotos();
setInterval(loadPhotos, 4000);
if (new URLSearchParams(location.search).get("upload") === "1") startCamera();
