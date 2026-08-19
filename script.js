// ===================== CONFIG =====================
const apiKey = 'bsog63BaN0sXddiIP6JakDc3agNjtmZ1pnyAumxO';
const API_URL = 'https://api.nasa.gov/planetary/apod';

// ===================== I18N =====================
// Only the APOD title + explanation change language.
// All other interface text always stays in English.
const translations = {
  en: {
    untitled: 'Untitled'
  },
  bn: {
    untitled: 'শিরোনামহীন'
  }
};

let currentLang = localStorage.getItem('astrowafy_lang') || 'en';
let lastAPODData = null;
const translationCache = {};

// ===================== DOM REFERENCES =====================
const langEnBtn = document.getElementById('langEnBtn');
const langBnBtn = document.getElementById('langBnBtn');

const datePicker = document.getElementById('datePicker');
const refreshBtn = document.getElementById('refreshBtn');
const refreshIcon = document.getElementById('refreshIcon');

const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const content = document.getElementById('content');

const mediaWrapper = document.getElementById('mediaWrapper');
const hdOverlay = document.getElementById('hdOverlay');
const hdLink = document.getElementById('hdLink');

const oneClickDownloadBtn = document.getElementById('oneClickDownloadBtn');
const oneClickDownloadLabel = document.getElementById('oneClickDownloadLabel');
const oneClickDownloadIcon = document.getElementById('oneClickDownloadIcon');

const apodTitle = document.getElementById('apodTitle');
const apodDate = document.getElementById('apodDate');
const apodExplanation = document.getElementById('apodExplanation');

let currentDownloadUrl = '';
let currentDownloadName = 'astrowafy-image.jpg';

// ===================== LANGUAGE =====================
function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('astrowafy_lang', lang);

  langEnBtn.classList.toggle('active', lang === 'en');
  langBnBtn.classList.toggle('active', lang === 'bn');

  if (lastAPODData) {
    renderInfo(lastAPODData);
  }
}

langEnBtn.addEventListener('click', () => applyLanguage('en'));
langBnBtn.addEventListener('click', () => applyLanguage('bn'));

async function translateText(text, targetLang) {
  if (!text || targetLang === 'en') return text;
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    if (!res.ok) throw new Error('Translation request failed');
    const data = await res.json();
    return data[0].map((chunk) => chunk[0]).join('');
  } catch (err) {
    console.error('AstroWafy translation error:', err);
    return text;
  }
}

// ===================== HELPERS =====================
function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0];
}

function formatDateDMY(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

function setState(state) {
  loadingState.classList.add('hidden');
  loadingState.classList.remove('flex');
  errorState.classList.add('hidden');
  content.classList.add('hidden');

  if (state === 'loading') {
    loadingState.classList.remove('hidden');
    loadingState.classList.add('flex');
  } else if (state === 'error') {
    errorState.classList.remove('hidden');
  } else if (state === 'content') {
    content.classList.remove('hidden');
  }
}

// ===================== RENDER =====================
function renderMedia(data) {
  mediaWrapper.innerHTML = '';

  if (data.media_type === 'video') {
    // Videos have no direct downloadable file, hide both download controls.
    hdOverlay.classList.add('hidden');
    oneClickDownloadBtn.classList.add('hidden');

    const iframeContainer = document.createElement('div');
    iframeContainer.className = 'w-full';
    iframeContainer.style.aspectRatio = '16 / 9';
    iframeContainer.innerHTML = `
      <iframe
        src="${data.url}"
        class="w-full h-full"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;
    mediaWrapper.appendChild(iframeContainer);
  } else {
    const img = document.createElement('img');
    img.src = data.url;
    img.alt = data.title || translations[currentLang].untitled;
    img.className = 'w-full object-contain';
    img.style.maxHeight = '550px';
    mediaWrapper.appendChild(img);

    const bestUrl = data.hdurl || data.url;
    hdLink.href = bestUrl;

    currentDownloadUrl = bestUrl;
    const extMatch = bestUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
    const ext = extMatch ? extMatch[1] : 'jpg';
    const safeName = (data.title || 'astrowafy-image')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    currentDownloadName = `astrowafy-${data.date || ''}-${safeName}.${ext}`;

    hdOverlay.classList.remove('hidden');
    oneClickDownloadBtn.classList.remove('hidden');
  }
}

async function renderInfo(data) {
  const lang = currentLang;
  apodDate.textContent = formatDateDMY(data.date);

  if (lang === 'en') {
    apodTitle.textContent = data.title || translations.en.untitled;
    apodExplanation.textContent = data.explanation || '';
    apodTitle.classList.remove('bn-text');
    apodExplanation.classList.remove('bn-text');
    apodTitle.style.opacity = '1';
    apodExplanation.style.opacity = '1';
    return;
  }

  const cacheKey = `${data.date}_${lang}`;
  if (translationCache[cacheKey]) {
    apodTitle.textContent = translationCache[cacheKey].title;
    apodExplanation.textContent = translationCache[cacheKey].explanation;
    apodTitle.classList.add('bn-text');
    apodExplanation.classList.add('bn-text');
    apodTitle.style.opacity = '1';
    apodExplanation.style.opacity = '1';
    return;
  }

  apodTitle.style.opacity = '0.4';
  apodExplanation.style.opacity = '0.4';

  const [translatedTitle, translatedExplanation] = await Promise.all([
    translateText(data.title || '', lang),
    translateText(data.explanation || '', lang)
  ]);

  translationCache[cacheKey] = {
    title: translatedTitle || data.title || translations[lang].untitled,
    explanation: translatedExplanation || data.explanation || ''
  };

  // Guard against race conditions (language or date changed mid-translation)
  if (currentLang === lang && lastAPODData && lastAPODData.date === data.date) {
    apodTitle.textContent = translationCache[cacheKey].title;
    apodExplanation.textContent = translationCache[cacheKey].explanation;
    apodTitle.classList.add('bn-text');
    apodExplanation.classList.add('bn-text');
    apodTitle.style.opacity = '1';
    apodExplanation.style.opacity = '1';
  }
}

// ===================== FETCH =====================
async function fetchAPOD(dateStr) {
  setState('loading');
  refreshIcon.classList.add('animate-spin');

  try {
    const url = `${API_URL}?api_key=${apiKey}&date=${dateStr}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    lastAPODData = data;

    renderMedia(data);
    await renderInfo(data);
    setState('content');
  } catch (err) {
    console.error('AstroWafy fetch error:', err);
    setState('error');
  } finally {
    refreshIcon.classList.remove('animate-spin');
  }
}

// ===================== EVENTS =====================
document.addEventListener('DOMContentLoaded', () => {
  applyLanguage(currentLang);

  const today = todayISO();
  datePicker.value = today;
  datePicker.max = today;
  fetchAPOD(today);
});

datePicker.addEventListener('change', () => {
  if (datePicker.value) {
    fetchAPOD(datePicker.value);
  }
});

refreshBtn.addEventListener('click', () => {
  const selected = datePicker.value || todayISO();
  fetchAPOD(selected);
});

// ===================== ONE-CLICK DOWNLOAD =====================
// Always visible on the media card (no hover/tap-to-reveal needed first).
// Fetches the image as a blob and triggers an instant save; falls back to
// opening the image in a new tab if the host blocks the cross-origin fetch.
oneClickDownloadBtn.addEventListener('click', async () => {
  if (!currentDownloadUrl) return;

  oneClickDownloadBtn.disabled = true;
  oneClickDownloadIcon.classList.add('animate-bounce');
  oneClickDownloadLabel.textContent = 'Downloading…';

  try {
    const response = await fetch(currentDownloadUrl);
    if (!response.ok) throw new Error('Download request failed');

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = currentDownloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('AstroWafy download error:', err);
    window.open(currentDownloadUrl, '_blank');
  } finally {
    oneClickDownloadBtn.disabled = false;
    oneClickDownloadIcon.classList.remove('animate-bounce');
    oneClickDownloadLabel.textContent = 'Download';
  }
});
