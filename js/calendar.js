/**
 * カスタムカレンダーピッカーコンポーネント
 * PC・スマートフォンのどちらでもキーボード不要で快適に月・日を選択できる
 * ダーク＆グラスモーフィズム調のインライン/ドロップダウンカレンダー
 */
const CalendarPicker = (() => {
  const { pad, toISO, parseISO, addDays, todayJST, formatJP, diffDays } = Utils;

  /** カレンダーの状態管理 */
  let selectedDate = null; // 'YYYY-MM-DD'
  let viewYear = 2026;
  let viewMonth = 10; // 1-12
  let isOpen = false;
  let onSelectCallback = null;

  let dom = {};

  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  /**
   * カレンダーピッカーの初期化
   * @param {Object} options
   * @param {string} options.initialDate 初期選択日 'YYYY-MM-DD'
   * @param {HTMLElement} options.container ピッカーを設置するラッパー要素
   * @param {Function} options.onSelect 日付変更時のコールバック
   */
  const init = ({ initialDate, container, onSelect }) => {
    selectedDate = initialDate || toISO(addDays(todayJST(), 1));
    const [y, m] = selectedDate.split('-').map(Number);
    viewYear = y;
    viewMonth = m;
    onSelectCallback = onSelect;

    renderStructure(container);
    bindEvents();
    updateDisplay();
    renderCalendarGrid();
    if (window.lucide) window.lucide.createIcons();
  };

  /** DOM構造の生成 */
  const renderStructure = (container) => {
    container.innerHTML = `
      <div class="calendar-wrapper relative">
        <!-- クイック日付チップ -->
        <div class="quick-dates flex flex-wrap gap-1.5 mb-2.5" aria-label="クイック日付選択">
          <button type="button" class="qdate-chip" data-offset="0">今日</button>
          <button type="button" class="qdate-chip active" data-offset="1">明日</button>
          <button type="button" class="qdate-chip" data-offset="2">明後日</button>
          <button type="button" class="qdate-chip" data-offset="7">1週間後</button>
          <button type="button" class="qdate-chip" data-offset="weekend">今週末</button>
        </div>

        <!-- 日付選択バー（クリックでカレンダー展開） -->
        <div class="date-trigger-bar flex items-center gap-1.5 w-full">
          <button type="button" id="date-prev-btn" class="day-step-btn" title="前日" aria-label="前日">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
          </button>
          <button type="button" id="date-trigger" class="date-trigger flex-1 min-w-0 flex items-center justify-between px-2.5 sm:px-3 py-2 rounded-xl text-left" aria-haspopup="dialog" aria-expanded="false">
            <span class="flex items-center gap-2 min-w-0">
              <i data-lucide="calendar" class="w-4 h-4 text-sky-300 shrink-0"></i>
              <span id="date-display-text" class="font-bold text-slate-100 text-xs sm:text-sm truncate">----</span>
            </span>
            <span class="flex items-center gap-1 text-[11px] text-sky-300 shrink-0 bg-sky-500/15 px-1.5 py-0.5 rounded border border-sky-400/25 ml-1">
              <span id="date-days-badge">明日</span>
              <i data-lucide="chevron-down" id="date-chevron" class="w-3 h-3 transition-transform duration-200"></i>
            </span>
          </button>
          <button type="button" id="date-next-btn" class="day-step-btn" title="翌日" aria-label="翌日">
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- 隠し input（フォーム送信用・外部アクセス用） -->
        <input type="hidden" id="date-input" name="date" value="${selectedDate}" />

        <!-- 背景バックドロップ（半透明の黒幕） -->
        <div id="cal-backdrop" class="cal-backdrop hidden" aria-hidden="true"></div>

        <!-- カレンダーポップアップパネル -->
        <div id="calendar-dropdown" class="calendar-dropdown hidden" role="dialog" aria-modal="true" aria-label="日付選択カレンダー">
          <!-- ヘッダー（月送り & 年月ジャンプ） -->
          <div class="cal-header flex items-center justify-between pb-3 mb-2 border-b border-slate-700/60">
            <button type="button" id="cal-prev-month" class="cal-nav-btn" aria-label="前月">
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            <div class="flex items-center gap-1.5">
              <select id="cal-year-select" class="cal-select"></select>
              <select id="cal-month-select" class="cal-select"></select>
            </div>
            <button type="button" id="cal-next-month" class="cal-nav-btn" aria-label="翌月">
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- 曜日ヘッダー -->
          <div class="cal-weekdays grid grid-cols-7 text-center text-xs font-semibold mb-1">
            ${WEEKDAYS.map((w, idx) => `<span class="${idx === 0 ? 'text-rose-400' : idx === 6 ? 'text-sky-400' : 'text-slate-400'}">${w}</span>`).join('')}
          </div>

          <!-- 日付グリッド -->
          <div id="cal-grid" class="cal-grid grid grid-cols-7 gap-1"></div>

          <!-- フッター -->
          <div class="cal-footer flex items-center justify-between pt-3 mt-2 border-t border-slate-700/60 text-xs">
            <button type="button" id="cal-today-btn" class="text-sky-300 hover:text-sky-200 font-semibold px-2 py-1 rounded hover:bg-sky-500/10">
              今日に戻る
            </button>
            <span class="text-[11px] text-slate-400 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>14日予報枠
            </span>
            <button type="button" id="cal-close-btn" class="text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700/40">
              閉じる
            </button>
          </div>
        </div>
      </div>
    `;

    dom = {
      wrapper: container.querySelector('.calendar-wrapper'),
      trigger: container.querySelector('#date-trigger'),
      chevron: container.querySelector('#date-chevron'),
      displayText: container.querySelector('#date-display-text'),
      daysBadge: container.querySelector('#date-days-badge'),
      prevBtn: container.querySelector('#date-prev-btn'),
      nextBtn: container.querySelector('#date-next-btn'),
      hiddenInput: container.querySelector('#date-input'),
      backdrop: container.querySelector('#cal-backdrop'),
      dropdown: container.querySelector('#calendar-dropdown'),
      prevMonth: container.querySelector('#cal-prev-month'),
      nextMonth: container.querySelector('#cal-next-month'),
      yearSelect: container.querySelector('#cal-year-select'),
      monthSelect: container.querySelector('#cal-month-select'),
      grid: container.querySelector('#cal-grid'),
      todayBtn: container.querySelector('#cal-today-btn'),
      closeBtn: container.querySelector('#cal-close-btn'),
      quickChips: container.querySelectorAll('.qdate-chip'),
    };

    populateYearMonthSelects();
  };

  /** 年月セレクトボックスの選択肢を生成 */
  const populateYearMonthSelects = () => {
    const curYear = todayJST().getFullYear();
    // 過去データ取得可能な1962年から2100年まで
    let yOptions = '';
    for (let y = 1962; y <= 2100; y++) {
      yOptions += `<option value="${y}">${y}年</option>`;
    }
    dom.yearSelect.innerHTML = yOptions;

    let mOptions = '';
    for (let m = 1; m <= 12; m++) {
      mOptions += `<option value="${m}">${m}月</option>`;
    }
    dom.monthSelect.innerHTML = mOptions;
  };

  /** イベント登録 */
  const bindEvents = () => {
    // 開閉
    dom.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    // 閉じるボタン
    dom.closeBtn.addEventListener('click', () => closeDropdown());

    // バックドロップクリックで閉じる
    dom.backdrop.addEventListener('click', () => closeDropdown());

    // 枠外クリックで閉じる
    document.addEventListener('click', (e) => {
      if (isOpen && !dom.wrapper.contains(e.target)) {
        closeDropdown();
      }
    });

    // キーボード（Escで閉じる）
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeDropdown();
    });

    // 前日 / 翌日
    dom.prevBtn.addEventListener('click', () => stepDays(-1));
    dom.nextBtn.addEventListener('click', () => stepDays(1));

    // 月送り
    dom.prevMonth.addEventListener('click', () => changeMonth(-1));
    dom.nextMonth.addEventListener('click', () => changeMonth(1));

    // セレクトボックス変更
    dom.yearSelect.addEventListener('change', () => {
      viewYear = Number(dom.yearSelect.value);
      renderCalendarGrid();
    });
    dom.monthSelect.addEventListener('change', () => {
      viewMonth = Number(dom.monthSelect.value);
      renderCalendarGrid();
    });

    // 今日ボタン
    dom.todayBtn.addEventListener('click', () => {
      setDate(toISO(todayJST()));
      viewYear = todayJST().getFullYear();
      viewMonth = todayJST().getMonth() + 1;
      renderCalendarGrid();
      closeDropdown();
    });

    // クイック日付チップ
    dom.quickChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const offset = chip.dataset.offset;
        const today = todayJST();
        let target;
        if (offset === 'weekend') {
          // 次の土曜日
          const day = today.getDay();
          const diff = day === 6 ? 7 : (6 - day);
          target = addDays(today, diff);
        } else {
          target = addDays(today, Number(offset));
        }
        setDate(toISO(target));
        viewYear = target.getFullYear();
        viewMonth = target.getMonth() + 1;
        renderCalendarGrid();
      });
    });

    // 日付クリック（グリッド内イベントデリゲーション）
    dom.grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.cal-day-cell');
      if (!cell || cell.disabled) return;
      const date = cell.dataset.date;
      if (date) {
        setDate(date);
        closeDropdown();
      }
    });
  };

  /** カレンダーの展開・収納 */
  const toggleDropdown = () => (isOpen ? closeDropdown() : openDropdown());

  const openDropdown = () => {
    isOpen = true;
    dom.dropdown.classList.remove('hidden');
    dom.backdrop.classList.remove('hidden');
    dom.trigger.setAttribute('aria-expanded', 'true');
    dom.chevron.style.transform = 'rotate(180deg)';
    // 選択された日付の年月を表示
    const [y, m] = selectedDate.split('-').map(Number);
    viewYear = y;
    viewMonth = m;
    renderCalendarGrid();
    if (window.lucide) window.lucide.createIcons();
  };

  const closeDropdown = () => {
    isOpen = false;
    dom.dropdown.classList.add('hidden');
    dom.backdrop.classList.add('hidden');
    dom.trigger.setAttribute('aria-expanded', 'false');
    dom.chevron.style.transform = 'rotate(0deg)';
  };

  /** 日付の加減（前日/翌日） */
  const stepDays = (delta) => {
    const d = parseISO(selectedDate);
    const next = addDays(d, delta);
    setDate(toISO(next));
    viewYear = next.getFullYear();
    viewMonth = next.getMonth() + 1;
    if (isOpen) renderCalendarGrid();
  };

  /** 月送り */
  const changeMonth = (delta) => {
    viewMonth += delta;
    if (viewMonth > 12) {
      viewMonth = 1;
      viewYear += 1;
    } else if (viewMonth < 1) {
      viewMonth = 12;
      viewYear -= 1;
    }
    renderCalendarGrid();
  };

  /** 日付の確定と反映 */
  const setDate = (dateStr) => {
    selectedDate = dateStr;
    dom.hiddenInput.value = dateStr;
    updateDisplay();
    syncQuickChips();
    if (typeof onSelectCallback === 'function') {
      onSelectCallback(dateStr);
    }
  };

  /** 表示テキスト等の更新 */
  const updateDisplay = () => {
    const today = todayJST();
    const d = parseISO(selectedDate);
    const days = diffDays(today, d);

    dom.displayText.textContent = formatJP(selectedDate);

    let badgeText = '';
    if (days === 0) badgeText = '今日';
    else if (days === 1) badgeText = '明日';
    else if (days === 2) badgeText = '明後日';
    else if (days > 2) badgeText = `${days}日後`;
    else badgeText = `${-days}日前`;

    dom.daysBadge.textContent = badgeText;
  };

  /** クイックチップのアクティブ状態を同期 */
  const syncQuickChips = () => {
    const today = todayJST();
    const cur = parseISO(selectedDate);
    const diff = diffDays(today, cur);

    // 次の土曜日の判定
    const day = today.getDay();
    const weekendDiff = day === 6 ? 7 : (6 - day);

    dom.quickChips.forEach((chip) => {
      const offset = chip.dataset.offset;
      let match = false;
      if (offset === 'weekend') {
        match = diff === weekendDiff;
      } else {
        match = diff === Number(offset);
      }
      chip.classList.toggle('active', match);
    });
  };

  /** カレンダーグリッドの描画 */
  const renderCalendarGrid = () => {
    dom.yearSelect.value = String(viewYear);
    dom.monthSelect.value = String(viewMonth);

    const today = todayJST();
    const todayStr = toISO(today);

    // 月の最初の日と最終日
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0);
    const totalDays = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0(日) - 6(土)

    // 前月の日数
    const prevMonthLastDay = new Date(viewYear, viewMonth - 1, 0).getDate();

    let cellsHTML = '';

    // 前月分パディング
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevM = viewMonth === 1 ? 12 : viewMonth - 1;
      const prevY = viewMonth === 1 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${pad(prevM)}-${pad(d)}`;
      cellsHTML += renderDayCell(dateStr, d, { isCurrentMonth: false });
    }

    // 当月分
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${viewYear}-${pad(viewMonth)}-${pad(d)}`;
      cellsHTML += renderDayCell(dateStr, d, { isCurrentMonth: true, todayStr });
    }

    // 翌月分パディング（合計行数を整える）
    const filledCells = startWeekday + totalDays;
    const nextPadding = (7 - (filledCells % 7)) % 7;
    for (let d = 1; d <= nextPadding; d++) {
      const nextM = viewMonth === 12 ? 1 : viewMonth + 1;
      const nextY = viewMonth === 12 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${pad(nextM)}-${pad(d)}`;
      cellsHTML += renderDayCell(dateStr, d, { isCurrentMonth: false });
    }

    dom.grid.innerHTML = cellsHTML;
  };

  /** 1日分のセルHTMLを生成 */
  const renderDayCell = (dateStr, dayNum, { isCurrentMonth, todayStr }) => {
    const isSelected = dateStr === selectedDate;
    const isToday = dateStr === todayStr;
    const dateObj = parseISO(dateStr);
    const dayOfWeek = dateObj.getDay();

    // 14日以内（Open-Meteo LIVE予報対象）の判定
    const today = todayJST();
    const diff = diffDays(today, dateObj);
    const isForecastable = diff >= 0 && diff <= 13;

    // クラス決定
    let classes = ['cal-day-cell'];
    if (!isCurrentMonth) classes.push('other-month');
    if (isSelected) classes.push('selected');
    if (isToday) classes.push('is-today');
    if (isForecastable && !isSelected) classes.push('is-forecastable');

    // 曜日の色味
    if (dayOfWeek === 0) classes.push('col-sun');
    if (dayOfWeek === 6) classes.push('col-sat');

    return `
      <button type="button" class="${classes.join(' ')}" data-date="${dateStr}" aria-label="${formatJP(dateStr)}">
        <span class="day-number">${dayNum}</span>
        ${isToday ? '<span class="today-dot" title="今日"></span>' : ''}
        ${isForecastable && !isSelected ? '<span class="forecast-dot" title="予報対象"></span>' : ''}
      </button>
    `;
  };

  /** 選択中の日付を取得 */
  const getDate = () => selectedDate;

  return {
    init,
    getDate,
    setDate,
    open: openDropdown,
    close: closeDropdown,
  };
})();
