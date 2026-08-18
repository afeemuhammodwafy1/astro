// ===================== CONFIG =====================
const CONFIG = {
  API_KEY: 'bsog63BaN0sXddiIP6JakDc3agNjtmZ1pnyAumxO',
  API_URL: 'https://api.nasa.gov/planetary/apod',
  DEFAULT_LANG: 'en',
  STORAGE_KEY: 'astrowafy_lang'
};

// ===================== I18N =====================
const TRANSLATIONS = {
  en: { untitled: 'Untitled' },
  bn: { untitled: 'শিরোনামহীন' }
};

// ===================== STATE =====================
const state = {
  lang: localStorage.getItem(CONFIG.STORAGE_KEY) || CONFIG.DEFAULT_LANG,
  lastData: null,
  translationCache: {},
  currentDownloadUrl: '',
  currentDownloadName: 'astrowafy-image.jpg'
};

// ===================== DOM REFS =====================
const DOM = {
  langEn: document.getElementById('langEnBtn'),
  langBn: document.getElementById('langBnBtn'),
  datePicker: document.getElementById('datePicker'),
  refreshBtn: document.getElementById('refreshBtn'),
  refreshIcon: document.getElementById('refreshIcon'),
  shareBtn: document.getElementById('shareBtn'),
  loading: document.getElementById('loadingState'),
  error: document.getElementById('errorState'),
  content: document.getElementById('content'),
  media: document.getElementById('mediaWrapper'),
  hdOverlay: document.getElementById('hdOverlay'),
  hdLink: document.getElementById('hdLink'),
  download: document.getElementById('oneClickDownloadBtn'),
  downloadLabel: document.getElementById('oneClickDownloadLabel'),
  downloadIcon: document.getElementById('oneClickDownloadIcon'),
  title: document.getElementById('apodTitle'),
  date: document.getElementById('apodDate'),
  explanation: document.getElementById('apodExplanation')
};

// ===================== DATE HELPERS =====================
const getTodayForAPOD = () => {
  const now = new Date();
  const localHours = now.getHours();
  const utcHours = now.getUTCHours();
  
  if (localHours >= 0 && localHours < 6 && utcHours >= 18) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
};

const todayUTC = () => new Date().toISOString().split('T')[0];

const formatDateDMY = (isoDate) => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
};

// ===================== LANGUAGE =====================
const applyLanguage = (lang) => {
  state.lang = lang;
  localStorage.setItem(CONFIG.STORAGE_KEY, lang);
  
  DOM.langEn.classList.toggle('active', lang === 'en');
  DOM.langBn.classList.toggle('active', lang === 'bn');
  
  if (state.lastData) renderInfo(state.lastData);
};

DOM.langEn.addEventListener('click', () => applyLanguage('en'));
DOM.langBn.addEventListener('click', () => applyLanguage('bn'));

const translateText = async (text, targetLang) => {
  if (!text || targetLang === 'en') return text;
  
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    return data[0].map(chunk => chunk[0]).join('');
  } catch (err) {
    console.error('Translation error:', err);
    return text;
  }
};

// ===================== UI HELPERS =====================
const setState = (stateType) => {
  [DOM.loading, DOM.error, DOM.content].forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('flex');
  });
  
  if (stateType === 'loading') {
    DOM.loading.classList.remove('hidden');
    DOM.loading.classList.add('flex');
  } else if (stateType === 'error') {
    DOM.error.classList.remove('hidden');
  } else if (stateType === 'content') {
    DOM.content.classList.remove('hidden');
  }
};

// ===================== RENDER =====================
const renderMedia = (data) => {
  DOM.media.innerHTML = '';
  
  if (data.media_type === 'video') {
    DOM.hdOverlay.classList.add('hidden');
    DOM.download.classList.add('hidden');
    
    const container = document.createElement('div');
    container.className = 'w-full';
    container.style.aspectRatio = '16 / 9';
    container.innerHTML = `
      <iframe
        src="${data.url}"
        class="w-full h-full"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;
    DOM.media.appendChild(container);
    return;
  }
  
  // Image
  const img = document.createElement('img');
  img.src = data.url;
  img.alt = data.title || TRANSLATIONS[state.lang].untitled;
  img.className = 'w-full object-contain';
  img.style.maxHeight = '550px';
  img.loading = 'lazy';
  DOM.media.appendChild(img);
  
  const bestUrl = data.hdurl || data.url;
  DOM.hdLink.href = bestUrl;
  
  state.currentDownloadUrl = bestUrl;
  const extMatch = bestUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
  const ext = extMatch ? extMatch[1] : 'jpg';
  const safeName = (data.title || 'astrowafy-image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  state.currentDownloadName = `astrowafy-${data.date || ''}-${safeName}.${ext}`;
  
  DOM.hdOverlay.classList.remove('hidden');
  DOM.download.classList.remove('hidden');
};

const renderInfo = async (data) => {
  const lang = state.lang;
  DOM.date.textContent = formatDateDMY(data.date);
  
  if (lang === 'en') {
    DOM.title.textContent = data.title || TRANSLATIONS.en.untitled;
    DOM.explanation.textContent = data.explanation || '';
    DOM.title.classList.remove('bn-text');
    DOM.explanation.classList.remove('bn-text');
    DOM.title.style.opacity = '1';
    DOM.explanation.style.opacity = '1';
    return;
  }
  
  const cacheKey = `${data.date}_${lang}`;
  if (state.translationCache[cacheKey]) {
    DOM.title.textContent = state.translationCache[cacheKey].title;
    DOM.explanation.textContent = state.translationCache[cacheKey].explanation;
    DOM.title.classList.add('bn-text');
    DOM.explanation.classList.add('bn-text');
    DOM.title.style.opacity = '1';
    DOM.explanation.style.opacity = '1';
    return;
  }
  
  DOM.title.style.opacity = '0.4';
  DOM.explanation.style.opacity = '0.4';
  
  const [translatedTitle, translatedExplanation] = await Promise.all([
    translateText(data.title || '', lang),
    translateText(data.explanation || '', lang)
  ]);
  
  state.translationCache[cacheKey] = {
    title: translatedTitle || data.title || TRANSLATIONS[lang].untitled,
    explanation: translatedExplanation || data.explanation || ''
  };
  
  if (state.lang === lang && state.lastData?.date === data.date) {
    DOM.title.textContent = state.translationCache[cacheKey].title;
    DOM.explanation.textContent = state.translationCache[cacheKey].explanation;
    DOM.title.classList.add('bn-text');
    DOM.explanation.classList.add('bn-text');
    DOM.title.style.opacity = '1';
    DOM.explanation.style.opacity = '1';
  }
};

// ===================== FETCH =====================
const fetchAPOD = async (dateStr) => {
  setState('loading');
  DOM.refreshIcon.classList.add('animate-spin');
  
  try {
    const url = dateStr 
      ? `${CONFIG.API_URL}?api_key=${CONFIG.API_KEY}&date=${dateStr}`
      : `${CONFIG.API_URL}?api_key=${CONFIG.API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    state.lastData = data;
    
    renderMedia(data);
    await renderInfo(data);
    setState('content');
  } catch (err) {
    console.error('Fetch error:', err);
    setState('error');
  } finally {
    DOM.refreshIcon.classList.remove('animate-spin');
  }
};

// ===================== SHARE =====================
const shareAPOD = async () => {
  if (!state.lastData) return;
  
  const shareData = {
    title: state.lastData.title || 'AstroWafy',
    text: `${state.lastData.title || 'AstroWafy'}\n${(state.lastData.explanation || '').slice(0, 150)}...`,
    url: window.location.href
  };
  
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.href);
      const label = DOM.downloadLabel.textContent;
      DOM.downloadLabel.textContent = '✅ Copied!';
      setTimeout(() => { DOM.downloadLabel.textContent = label; }, 2000);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share error:', err);
    }
  }
};

// ===================== DOWNLOAD =====================
const downloadAPOD = async () => {
  if (!state.currentDownloadUrl) return;
  
  DOM.download.disabled = true;
  DOM.downloadIcon.classList.add('animate-bounce');
  DOM.downloadLabel.textContent = 'Downloading…';
  
  try {
    const response = await fetch(state.currentDownloadUrl);
    if (!response.ok) throw new Error('Download failed');
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = state.currentDownloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Download error:', err);
    window.open(state.currentDownloadUrl, '_blank');
  } finally {
    DOM.download.disabled = false;
    DOM.downloadIcon.classList.remove('animate-bounce');
    DOM.downloadLabel.textContent = 'Download';
  }
};

// ===================== KEYBOARD SHORTCUTS =====================
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    DOM.refreshBtn.click();
  }
  if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    DOM.shareBtn?.click();
  }
  if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    DOM.download?.click();
  }
});

// ===================== EVENT LISTENERS =====================
document.addEventListener('DOMContentLoaded', () => {
  applyLanguage(state.lang);
  
  const today = getTodayForAPOD();
  const maxDate = todayUTC();
  
  DOM.datePicker.value = today;
  DOM.datePicker.max = maxDate;
  
  fetchAPOD(today);
});

DOM.datePicker.addEventListener('change', () => {
  if (DOM.datePicker.value) {
    fetchAPOD(DOM.datePicker.value);
  }
});

DOM.refreshBtn.addEventListener('click', () => {
  const selected = DOM.datePicker.value || getTodayForAPOD();
  fetchAPOD(selected);
});

DOM.shareBtn?.addEventListener('click', shareAPOD);
DOM.download.addEventListener('click', downloadAPOD);

// ===================== SERVICE WORKER (PWA) =====================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .catch(err => console.log('SW registration failed:', err));
}

// ===================== ANALYTICS (Privacy-Friendly) =====================
// If you want to add analytics, use this pattern:
// window.addEventListener('load', () => {
//   // Your analytics code here
// });

console.log('🚀 AstroWafy initialized successfully!');
console.log(`📍 Language: ${state.lang}`);
console.log(`📅 Today: ${getTodayForAPOD()}`);