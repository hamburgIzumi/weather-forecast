/**
 * アプリケーション本体
 * 入力UI（場所サジェスト・クイックタグ・日付・集計期間）と予測実行の制御を担当する。
 */
(() => {
  /** クイックタグのプリセット（緯度・経度をハードコード） */
  const PRESETS = [
    { name: '東京ディズニーランド', lat: 35.6329, lon: 139.8804, emoji: '🏰' },
    { name: '東京駅', lat: 35.6812, lon: 139.7671, emoji: '🚉' },
    { name: '横浜', lat: 35.4437, lon: 139.638, emoji: '⚓' },
    { name: '札幌', lat: 43.0618, lon: 141.3545, emoji: '❄️' },
    { name: '大阪・USJ', lat: 34.6654, lon: 135.4323, emoji: '🎢' },
    { name: '那覇', lat: 26.2124, lon: 127.6809, emoji: '🌺' },
  ];

  /** 画面の状態 */
  const state = {
    place: null, // { name, fullName, lat, lon }
    years: 10,
    suggestions: [],
    activeIndex: -1,
    searchController: null,
    loading: false,
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $('predict-form'),
    locInput: $('location-input'),
    locSpinner: $('location-spinner'),
    suggestList: $('location-suggestions'),
    locSelected: $('location-selected'),
    quickTags: $('quick-tags'),
    dateInput: $('date-input'),
    segment: $('period-segment'),
    btn: $('predict-btn'),
    empty: $('empty-state'),
    loadingBox: $('loading-state'),
    error: $('error-state'),
    content: $('result-content'),
  };

  const refreshIcons = () => window.lucide && window.lucide.createIcons();

  /* =========================================================
     場所の選択
     ========================================================= */
  const setPlace = (place, { fromPreset = false } = {}) => {
    state.place = place;
    els.locInput.value = place.name;
    els.locSelected.innerHTML = `✓ 緯度 ${place.lat.toFixed(4)} / 経度 ${place.lon.toFixed(4)}`;
    els.locSelected.classList.remove('hidden');
    hideSuggestions();
    // クイックタグのアクティブ表示を同期
    els.quickTags.querySelectorAll('.chip').forEach((chip) => {
      chip.classList.toggle('active', fromPreset && chip.dataset.name === place.name);
    });
  };

  const clearPlace = () => {
    state.place = null;
    els.locSelected.classList.add('hidden');
    els.quickTags.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  };

  /* ---------- クイックタグ ---------- */
  const renderQuickTags = () => {
    els.quickTags.innerHTML = PRESETS.map(
      (p, i) =>
        `<button type="button" id="quick-tag-${i}" class="chip" data-index="${i}" data-name="${p.name}">
          <span aria-hidden="true">${p.emoji}</span>${p.name}
        </button>`
    ).join('');
    els.quickTags.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const p = PRESETS[Number(chip.dataset.index)];
      setPlace({ name: p.name, fullName: p.name, lat: p.lat, lon: p.lon }, { fromPreset: true });
    });
  };

  /* ---------- サジェスト（Nominatim + 500msデバウンス） ---------- */
  const hideSuggestions = () => {
    els.suggestList.classList.add('hidden');
    els.locInput.setAttribute('aria-expanded', 'false');
    state.activeIndex = -1;
  };

  const renderSuggestions = () => {
    const list = state.suggestions;
    els.suggestList.innerHTML = list.length
      ? list
          .map(
            (s, i) => `
          <li id="suggest-${i}" class="suggest-item ${i === state.activeIndex ? 'active' : ''}" role="option" data-index="${i}" aria-selected="${i === state.activeIndex}">
            <i data-lucide="map-pin" class="w-4 h-4 mt-0.5 text-sky-300 shrink-0"></i>
            <span>${Utils.escapeHTML(s.name)}<small>${Utils.escapeHTML(s.fullName)}</small></span>
          </li>`
          )
          .join('')
      : '<li class="suggest-empty">候補が見つかりませんでした</li>';
    els.suggestList.classList.remove('hidden');
    els.locInput.setAttribute('aria-expanded', 'true');
    refreshIcons();
  };

  const searchPlaces = async (query) => {
    if (query.length < 2) {
      hideSuggestions();
      return;
    }
    // 前回の通信が残っていればキャンセル
    if (state.searchController) state.searchController.abort();
    state.searchController = new AbortController();
    els.locSpinner.classList.remove('hidden');
    try {
      state.suggestions = await Api.searchPlaces(query, state.searchController.signal);
      state.activeIndex = -1;
      // 入力欄にフォーカスがある場合のみ表示
      if (document.activeElement === els.locInput) renderSuggestions();
    } catch (e) {
      if (e.name !== 'AbortError') {
        state.suggestions = [];
        els.suggestList.innerHTML = '<li class="suggest-empty">場所の検索に失敗しました。時間をおいて再度お試しください</li>';
        els.suggestList.classList.remove('hidden');
      }
    } finally {
      els.locSpinner.classList.add('hidden');
    }
  };

  const debouncedSearch = Utils.debounce(searchPlaces, 500);

  const bindLocationEvents = () => {
    els.locInput.addEventListener('input', () => {
      clearPlace();
      debouncedSearch(els.locInput.value.trim());
    });

    // キーボード操作（↑↓で選択、Enterで決定、Escで閉じる）
    els.locInput.addEventListener('keydown', (e) => {
      const open = !els.suggestList.classList.contains('hidden') && state.suggestions.length;
      if (!open) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = state.suggestions.length;
        state.activeIndex = (state.activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
        renderSuggestions();
      } else if (e.key === 'Enter' && state.activeIndex >= 0) {
        e.preventDefault();
        setPlace(state.suggestions[state.activeIndex]);
      } else if (e.key === 'Escape') {
        hideSuggestions();
      }
    });

    // mousedown で選択（blur より先に発火させるため）
    els.suggestList.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.suggest-item');
      if (!item) return;
      e.preventDefault();
      setPlace(state.suggestions[Number(item.dataset.index)]);
    });

    els.locInput.addEventListener('blur', () => setTimeout(hideSuggestions, 120));
  };

  /* =========================================================
     集計期間セグメント
     ========================================================= */
  const bindSegment = () => {
    const buttons = [...els.segment.querySelectorAll('.segment-btn')];
    const indicator = els.segment.querySelector('.segment-indicator');
    const select = (btn) => {
      const idx = buttons.indexOf(btn);
      buttons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', String(on));
      });
      indicator.style.transform = `translateX(${idx * 100}%)`;
      state.years = Number(btn.dataset.years);
    };
    buttons.forEach((b) => b.addEventListener('click', () => select(b)));
    select(buttons.find((b) => b.classList.contains('active')));
  };

  /* =========================================================
     表示状態の切り替え
     ========================================================= */
  const showView = (view) => {
    els.empty.classList.toggle('hidden', view !== 'empty');
    els.loadingBox.classList.toggle('hidden', view !== 'loading');
    els.error.classList.toggle('hidden', view !== 'error');
    els.content.classList.toggle('hidden', view !== 'content');
  };

  const setLoading = (on) => {
    state.loading = on;
    els.btn.disabled = on;
    els.btn.querySelector('.btn-label').classList.toggle('hidden', on);
    const loading = els.btn.querySelector('.btn-loading');
    loading.classList.toggle('hidden', !on);
    loading.classList.toggle('flex', on);
  };

  const showError = (message) => {
    els.error.innerHTML = `
      <div class="flex items-start gap-3">
        <i data-lucide="alert-octagon" class="w-6 h-6 text-rose-300 shrink-0"></i>
        <div>
          <p class="font-bold text-rose-200">予測できませんでした</p>
          <p class="text-sm text-rose-100/80 mt-1">${Utils.escapeHTML(message)}</p>
        </div>
      </div>`;
    showView('error');
    refreshIcons();
  };

  /* =========================================================
     予測の実行
     ========================================================= */
  const runPrediction = async () => {
    if (state.loading) return; // 多重実行防止

    if (!state.place) {
      showError('場所が選択されていません。候補リストから場所を選ぶか、クイックタグをタップしてください。');
      els.locInput.focus();
      return;
    }
    const targetStr = els.dateInput.value;
    if (!targetStr) {
      showError('知りたい日付を選択してください。');
      return;
    }
    // 年の範囲チェック（過去データは1940年〜。集計年数ぶん遡れるよう1962年以降に制限）
    const targetYear = Number(targetStr.slice(0, 4));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetStr) || targetYear < 1962 || targetYear > 2100) {
      showError('日付は1962年〜2100年の範囲で指定してください。');
      return;
    }

    const place = state.place;
    const years = state.years;
    const today = Utils.todayJST();
    const daysAhead = Utils.diffDays(today, Utils.parseISO(targetStr));
    const useForecast = daysAhead >= 0 && daysAhead <= 13; // forecast_days=14 は今日〜13日後

    setLoading(true);
    showView('loading');

    try {
      const range = Logic.getFetchRange(targetStr, years, today);
      // 過去データ（1回で一括取得）と予報を並行して取得
      const [records, forecastList] = await Promise.all([
        Api.fetchHistorical(place.lat, place.lon, range.start, range.end),
        useForecast ? Api.fetchForecast(place.lat, place.lon).catch(() => null) : Promise.resolve(null),
      ]);

      const analysis = Logic.analyze(records, targetStr, years);
      const forecast = forecastList ? forecastList.find((r) => r.date === targetStr && typeof r.tmax === 'number') : null;

      els.content.innerHTML = Render.results({ place, targetStr, years, analysis, forecast, daysAhead });
      showView('content');
      refreshIcons();
      Render.animate(els.content);

      // スマホでは結果へスクロール
      if (window.innerWidth < 1024) els.content.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      console.error(e);
      showError(e.message || 'データの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     初期化
     ========================================================= */
  const init = () => {
    // 日付のデフォルトは「明日」
    els.dateInput.value = Utils.toISO(Utils.addDays(Utils.todayJST(), 1));

    renderQuickTags();
    bindLocationEvents();
    bindSegment();

    els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      runPrediction();
    });

    refreshIcons();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
