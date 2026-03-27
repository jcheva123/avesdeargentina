const BASE_PATH = '/';
const MANIFEST_URL = `${BASE_PATH}/data/manifest.json`;

const PLACEHOLDER_MAIN_1 = `${BASE_PATH}/assets/placeholder-main-1.svg`;
const PLACEHOLDER_MAIN_2 = `${BASE_PATH}/assets/placeholder-main-2.svg`;
const PLACEHOLDER_MAIN_3 = `${BASE_PATH}/assets/placeholder-main-3.svg`;

const SLIDESHOW_MS = 8000;

const state = {
  data: null,
  filteredFamilies: [],
  currentFamilyIndex: 0,
  currentSpeciesIndex: 0,
  currentPhotoIndex: 0,
  slideshowTimer: null,
  slideshowActive: false,
};

const els = {
  familyList: document.getElementById('familyList'),
  familySearchInput: document.getElementById('familySearchInput'),
  currentFamilyCommon: document.getElementById('currentFamilyCommon'),
  currentFamilyScientific: document.getElementById('currentFamilyScientific'),
  currentSpeciesCommon: document.getElementById('currentSpeciesCommon'),
  currentSpeciesScientific: document.getElementById('currentSpeciesScientific'),
  noPhotoNotice: document.getElementById('noPhotoNotice'),
  mainImage: document.getElementById('mainImage'),
  thumbStrip: document.getElementById('thumbStrip'),
  speciesList: document.getElementById('speciesList'),
  viewerCard: document.querySelector('.viewer'),
  familyCount: document.getElementById('familyCount'),
  speciesCount: document.getElementById('speciesCount'),
  photoCounter: document.getElementById('photoCounter'),
  speciesOrderBadge: document.getElementById('speciesOrderBadge'),
  familyOrderBadge: document.getElementById('familyOrderBadge'),
  toggleSpeciesSlideshowBtn: document.getElementById('toggleSpeciesSlideshowBtn'),
  prevSpeciesBtn: document.getElementById('prevSpeciesBtn'),
  nextSpeciesBtn: document.getElementById('nextSpeciesBtn'),
  prevPhotoBtn: document.getElementById('prevPhotoBtn'),
  nextPhotoBtn: document.getElementById('nextPhotoBtn'),
  slideshowBadge: document.getElementById('slideshowBadge'),
};

init();

async function init() {
  bindEvents();

  try {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`No se pudo leer ${MANIFEST_URL} (${response.status})`);
    }

    const raw = await response.json();
    state.data = normalizeManifest(raw);
    state.filteredFamilies = [...state.data.families];

    updateCounters();
    renderFamilies();
    renderCurrentView();
  } catch (error) {
    console.error('Error cargando manifest:', error);
    showEmptyState(`No se pudo cargar el manifest. Revisá que exista ${MANIFEST_URL} y que su estructura sea válida.`);
  }
}

function bindEvents() {
  els.familySearchInput?.addEventListener('input', handleFamilySearch);

  els.toggleSpeciesSlideshowBtn?.addEventListener('click', () => {
    if (state.slideshowActive) {
      stopSlideshow();
    } else {
      startSlideshow();
    }
  });

  els.prevSpeciesBtn?.addEventListener('click', () => {
    stopSlideshow();
    moveSpecies(-1);
  });

  els.nextSpeciesBtn?.addEventListener('click', () => {
    stopSlideshow();
    moveSpecies(1);
  });

  els.prevPhotoBtn?.addEventListener('click', () => {
    stopSlideshow();
    movePhoto(-1);
  });

  els.nextPhotoBtn?.addEventListener('click', () => {
    stopSlideshow();
    movePhoto(1);
  });
}

function normalizeManifest(raw) {
  const families = (raw.families || [])
    .map((family, familyIndex) => {
      const parsedFamily = parseFolderName(family.folderName || '');

      const species = (family.species || [])
        .map((species, speciesIndex) => {
          const parsedSpecies = parseSpeciesName(
            species.filePattern ||
            species.rawName ||
            species.commonName ||
            species.coverImage?.name ||
            species.introImage?.name ||
            ''
          );

          const normalizedAllImages = (species.allImages || species.photos || [])
            .map((photo, photoIndex) => normalizePhoto(photo, photoIndex))
            .sort((a, b) => a.order - b.order);

          const normalizedDisplayPhotos = (species.photos || [])
            .map((photo, photoIndex) => normalizePhoto(photo, photoIndex))
            .sort((a, b) => a.order - b.order);

          const introImage = species.introImage ? normalizePhoto(species.introImage, 0, true) : null;
          const coverImage = species.coverImage ? normalizePhoto(species.coverImage, 0, false) : null;

          const displayPhotos =
            normalizedDisplayPhotos.length > 0
              ? normalizedDisplayPhotos
              : coverImage
                ? [coverImage]
                : normalizedAllImages.filter(photo => !photo.isReferenceSheet);

          const hasPhotos = species.hasPhotos ?? displayPhotos.length > 0;

          return {
            ...species,
            order: species.order ?? speciesIndex + 1,
            commonName: (species.commonName || parsedSpecies.commonName || 'AVE SIN NOMBRE').toUpperCase(),
            scientificName: species.scientificName || parsedSpecies.scientificName || 'Nombre científico no definido',
            introImage,
            coverImage,
            photos: displayPhotos,
            allImages: normalizedAllImages,
            displayPhotos,
            firstDisplayPhoto: displayPhotos[0]?.renderUrl || coverImage?.renderUrl || '',
            hasPhotos,
            noPhotoMessage: species.noPhotoMessage || 'Aún sin registro fotográfico',
          };
        })
        .sort((a, b) => a.order - b.order);

      return {
        ...family,
        order: family.order ?? parsedFamily.order ?? familyIndex + 1,
        commonName: (family.commonName || parsedFamily.commonName || 'FAMILIA').toUpperCase(),
        scientificName: family.scientificName || parsedFamily.scientificName || '',
        species,
      };
    })
    .sort((a, b) => a.order - b.order);

  return { ...raw, families };
}

function normalizePhoto(photo, photoIndex = 0, isReferenceSheet = false) {
  const order = photo?.order ?? photoIndex + 1;
  const renderUrl = getRenderableImageUrl(photo);

  return {
    ...photo,
    order,
    isReferenceSheet: Boolean(photo?.isReferenceSheet) || isReferenceSheet,
    renderUrl,
  };
}

function getRenderableImageUrl(photo) {
  if (!photo) return '';

  const id =
    photo.id ||
    extractDriveId(photo.url) ||
    extractDriveId(photo.largeUrl) ||
    extractDriveId(photo.openUrl);

  if (!id) return '';

  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w2000`;
}

function extractDriveId(url = '') {
  if (!url || typeof url !== 'string') return '';

  let match = url.match(/[?&]id=([^&]+)/i);
  if (match) return match[1];

  match = url.match(/\/d\/([^/]+)/i);
  if (match) return match[1];

  return '';
}

function parseFolderName(folderName = '') {
  const cleaned = folderName.replace(/_/g, ' ').trim();
  const match = cleaned.match(/^(\d+)[-_]?([a-záéíóúüñ-]+)\s+(.+)$/i);

  if (!match) {
    return {
      order: null,
      commonName: cleaned.toUpperCase(),
      scientificName: '',
    };
  }

  return {
    order: Number(match[1]),
    scientificName: match[2].replace(/-/g, ' '),
    commonName: match[3].trim().toUpperCase(),
  };
}

function parseSpeciesName(rawName = '') {
  const noExt = String(rawName).replace(/\.[a-z0-9]+$/i, '').trim();
  const withoutPrefix = noExt.includes('-')
    ? noExt.split('-').slice(1).join('-').trim()
    : noExt;

  const tokens = withoutPrefix.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return { commonName: '', scientificName: '' };
  }

  let scientificStart = tokens.findIndex(token => /[a-záéíóúüñ]/.test(token));
  if (scientificStart === -1) scientificStart = tokens.length;

  const commonName = tokens.slice(0, scientificStart).join(' ').trim().toUpperCase();
  const scientificName = tokens.slice(scientificStart).join(' ').trim();

  return { commonName, scientificName };
}

function updateCounters() {
  if (!state.data) return;

  const familyTotal = state.data.families.length;
  const speciesTotal = state.data.families.reduce((acc, family) => acc + family.species.length, 0);

  if (els.familyCount) els.familyCount.textContent = familyTotal;
  if (els.speciesCount) els.speciesCount.textContent = speciesTotal;
}

function handleFamilySearch(event) {
  const value = event.target.value.trim().toLowerCase();
  if (!state.data) return;

  stopSlideshow();

  state.filteredFamilies = state.data.families.filter(family => {
    const familyText = `${family.commonName} ${family.scientificName}`.toLowerCase();

    const speciesMatch = family.species.some(species => {
      const speciesText = `${species.commonName} ${species.scientificName} ${species.order}`.toLowerCase();
      return speciesText.includes(value);
    });

    return familyText.includes(value) || speciesMatch;
  });

  state.currentFamilyIndex = 0;
  state.currentSpeciesIndex = 0;
  state.currentPhotoIndex = 0;

  renderFamilies();
  renderCurrentView();
}

function getCurrentFamily() {
  return state.filteredFamilies[state.currentFamilyIndex] || null;
}

function getCurrentSpecies() {
  const family = getCurrentFamily();
  return family?.species[state.currentSpeciesIndex] || null;
}

function renderFamilies() {
  if (!els.familyList) return;

  els.familyList.innerHTML = '';
  const tpl = document.getElementById('familyButtonTemplate');

  if (!state.filteredFamilies.length) {
    els.familyList.innerHTML = '<div class="empty-state">No se encontraron familias o especies con ese criterio.</div>';
    return;
  }

  state.filteredFamilies.forEach((family, index) => {
    const node = tpl.content.firstElementChild.cloneNode(true);

    node.querySelector('.family-item__number').textContent = family.order;
    node.querySelector('strong').textContent = family.commonName;
    node.querySelector('small').textContent = family.scientificName;

    node.classList.toggle('is-active', index === state.currentFamilyIndex);

    node.addEventListener('click', () => {
      stopSlideshow();
      state.currentFamilyIndex = index;
      state.currentSpeciesIndex = 0;
      state.currentPhotoIndex = 0;
      renderFamilies();
      renderCurrentView();
    });

    els.familyList.appendChild(node);
  });
}

function renderCurrentView() {
  const family = getCurrentFamily();
  const species = getCurrentSpecies();

  if (!family || !species) {
    showEmptyState('Todavía no hay familias o especies para mostrar.');
    return;
  }

  if (els.currentFamilyCommon) els.currentFamilyCommon.textContent = family.commonName;
  if (els.currentFamilyScientific) els.currentFamilyScientific.textContent = family.scientificName;
  if (els.currentSpeciesCommon) els.currentSpeciesCommon.textContent = species.commonName;
  if (els.currentSpeciesScientific) els.currentSpeciesScientific.textContent = species.scientificName;
  if (els.speciesOrderBadge) els.speciesOrderBadge.textContent = `Especie ${species.order}`;
  if (els.familyOrderBadge) els.familyOrderBadge.textContent = `Familia ${family.order}`;

  if (els.noPhotoNotice) {
    els.noPhotoNotice.hidden = species.hasPhotos;
    els.noPhotoNotice.textContent = species.noPhotoMessage || 'Aún sin registro fotográfico';
  }

  renderMainImage(species);
  renderThumbnails(species);
  renderSpeciesCards(family);
  updateSlideshowButtonState(species);
}

function renderMainImage(species) {
  const displayPhotos = species.displayPhotos || [];
  const safeIndex = clampIndex(state.currentPhotoIndex, displayPhotos.length);
  state.currentPhotoIndex = safeIndex;

  if (!species.hasPhotos || displayPhotos.length === 0) {
    if (els.mainImage) {
      els.mainImage.style.display = 'none';
      els.mainImage.src = PLACEHOLDER_MAIN_1;
    }
    if (els.prevPhotoBtn) els.prevPhotoBtn.hidden = true;
    if (els.nextPhotoBtn) els.nextPhotoBtn.hidden = true;
    if (els.photoCounter) els.photoCounter.textContent = 'Sin fotos';
    return;
  }

  if (els.mainImage) {
    els.mainImage.style.display = '';
  }
  if (els.prevPhotoBtn) els.prevPhotoBtn.hidden = false;
  if (els.nextPhotoBtn) els.nextPhotoBtn.hidden = false;

  const currentPhoto = displayPhotos[safeIndex];
  const imageUrl = currentPhoto?.renderUrl || PLACEHOLDER_MAIN_1;

  if (els.mainImage) {
    els.mainImage.onerror = function () {
      this.onerror = null;
      this.src = PLACEHOLDER_MAIN_1;
    };
    els.mainImage.src = imageUrl;
    els.mainImage.alt = `${species.commonName} — foto ${safeIndex + 1}`;
  }

  if (els.photoCounter) {
    els.photoCounter.textContent = `Foto ${displayPhotos.length ? safeIndex + 1 : 1}/${displayPhotos.length || 1}`;
  }
}

function renderThumbnails(species) {
  if (!els.thumbStrip) return;

  els.thumbStrip.innerHTML = '';

  if (!species.hasPhotos || !species.displayPhotos?.length) {
    els.thumbStrip.innerHTML = `<div class="empty-state">${species.noPhotoMessage || 'Aún sin registro fotográfico'}</div>`;
    return;
  }

  (species.displayPhotos || []).forEach((photo, index) => {
    const button = document.createElement('button');
    button.className = `thumb ${index === state.currentPhotoIndex ? 'is-active' : ''}`;
    button.type = 'button';

    const thumbUrl = photo.renderUrl || PLACEHOLDER_MAIN_2;
    const img = document.createElement('img');
    img.src = thumbUrl;
    img.alt = `Miniatura ${index + 1} de ${species.commonName}`;
    img.onerror = function () {
      this.onerror = null;
      this.src = PLACEHOLDER_MAIN_2;
    };

    button.appendChild(img);

    button.addEventListener('click', () => {
      stopSlideshow();
      state.currentPhotoIndex = index;
      renderMainImage(species);
      renderThumbnails(species);
      updateSlideshowButtonState(species);
    });

    els.thumbStrip.appendChild(button);
  });
}
function scrollToViewer() {
  if (!els.viewerCard) return;

  window.requestAnimationFrame(() => {
    els.viewerCard.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
}
function renderSpeciesCards(family) {
  if (!els.speciesList) return;

  els.speciesList.innerHTML = '';
  const tpl = document.getElementById('speciesCardTemplate');

  family.species.forEach((species, index) => {
    const node = tpl.content.firstElementChild.cloneNode(true);

    node.querySelector('.species-card__order').textContent = `N° ${species.order}`;
    node.querySelector('strong').textContent = species.commonName;
    node.querySelector('small').textContent = species.scientificName;

    const preview = node.querySelector('.species-card__preview');
    preview.innerHTML = '';

    if (species.hasPhotos && species.firstDisplayPhoto) {
      preview.style.backgroundImage = `url("${cssUrl(species.firstDisplayPhoto)}")`;
    } else {
      preview.style.backgroundImage = 'none';
      preview.innerHTML = '<span class="species-card__no-photo">Sin foto</span>';
    }

    node.classList.toggle('is-active', index === state.currentSpeciesIndex);

node.addEventListener('click', () => {
  stopSlideshow();
  state.currentSpeciesIndex = index;
  state.currentPhotoIndex = 0;
  renderCurrentView();
  scrollToViewer();
});

    els.speciesList.appendChild(node);
  });
}

function moveSpecies(step) {
  const family = getCurrentFamily();
  if (!family) return;

  const nextIndex = state.currentSpeciesIndex + step;

  if (nextIndex >= 0 && nextIndex < family.species.length) {
    state.currentSpeciesIndex = nextIndex;
    state.currentPhotoIndex = 0;
    renderCurrentView();
    return;
  }

  const nextFamilyIndex = state.currentFamilyIndex + step;

  if (nextFamilyIndex >= 0 && nextFamilyIndex < state.filteredFamilies.length) {
    state.currentFamilyIndex = nextFamilyIndex;
    state.currentSpeciesIndex = step > 0 ? 0 : state.filteredFamilies[nextFamilyIndex].species.length - 1;
    state.currentPhotoIndex = 0;
    renderFamilies();
    renderCurrentView();
  }
}

function movePhoto(step) {
  const species = getCurrentSpecies();
  if (!species) return;

  const length = species.displayPhotos.length;
  if (!length) return;

  state.currentPhotoIndex = (state.currentPhotoIndex + step + length) % length;
  renderMainImage(species);
  renderThumbnails(species);
  updateSlideshowButtonState(species);
}

function updateSlideshowButtonState(species) {
  const btn = els.toggleSpeciesSlideshowBtn;
  if (!btn) return;

  const photoCount = species?.displayPhotos?.length || 0;
  const canPlay = species?.hasPhotos && photoCount > 1;

  btn.disabled = !canPlay;

  if (!canPlay) {
    btn.textContent = species?.hasPhotos ? '▶ Solo una foto' : 'Sin fotos';
    return;
  }

  btn.textContent = state.slideshowActive
    ? '⏸ Detener automático'
    : '▶ Pasar automáticamente';
}

function startSlideshow() {
  const species = getCurrentSpecies();
  const photoCount = species?.displayPhotos?.length || 0;

  if (!species || !species.hasPhotos || photoCount < 2) {
    updateSlideshowButtonState(species);
    return;
  }

  stopSlideshow(false);
  state.slideshowActive = true;

  if (els.slideshowBadge) els.slideshowBadge.hidden = false;
  updateSlideshowButtonState(species);

  state.slideshowTimer = window.setInterval(() => {
    const currentSpecies = getCurrentSpecies();
    const currentCount = currentSpecies?.displayPhotos?.length || 0;

    if (!currentSpecies || !currentSpecies.hasPhotos || currentCount < 2) {
      stopSlideshow();
      return;
    }

    movePhoto(1);
  }, SLIDESHOW_MS);
}

function stopSlideshow(refreshButton = true) {
  state.slideshowActive = false;

  if (els.slideshowBadge) els.slideshowBadge.hidden = true;

  if (state.slideshowTimer) {
    window.clearInterval(state.slideshowTimer);
    state.slideshowTimer = null;
  }

  if (refreshButton) {
    updateSlideshowButtonState(getCurrentSpecies());
  }
}

function clampIndex(index, length) {
  if (!length) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function cssUrl(value = '') {
  return String(value).replace(/"/g, '\\"');
}

function showEmptyState(message) {
  if (els.familyList) {
    els.familyList.innerHTML = `<div class="empty-state">${message}</div>`;
  }

  if (els.speciesList) {
    els.speciesList.innerHTML = `<div class="empty-state">${message}</div>`;
  }

  if (els.thumbStrip) {
    els.thumbStrip.innerHTML = '';
  }

  if (els.mainImage) {
    els.mainImage.src = PLACEHOLDER_MAIN_1;
  }

  if (els.toggleSpeciesSlideshowBtn) {
    els.toggleSpeciesSlideshowBtn.disabled = true;
    els.toggleSpeciesSlideshowBtn.textContent = 'Sin fotos';
  }
}
