/**
 * 結果画面の描画（仕様書「4. 出力画面の構成」に対応）
 * HTML文字列を組み立て、挿入後にアニメーションを適用する。
 */
const Render = (() => {
  const { fmt, signed, escapeHTML, formatJP, formatMD } = Utils;
  const RING_R = 54;
  const RING_C = 2 * Math.PI * RING_R;

  /** 天気アイコン（配色付きの角丸ボックス） */
  const weatherIcon = (code, size = 'md') => {
    const w = WeatherCodes.get(code);
    const dims = { sm: ['w-9 h-9', 'w-5 h-5'], md: ['w-14 h-14', 'w-7 h-7'], lg: ['w-20 h-20', 'w-10 h-10'] }[size];
    return `<div class="weather-icon wi-${w.type} ${dims[0]}" title="${w.name}"><i data-lucide="${w.icon}" class="${dims[1]}"></i></div>`;
  };

  /** 差分バッジ（+なら暖色、-なら寒色） */
  const diffBadge = (diff, label = '過去平均比') => {
    const cls = Math.abs(diff) < 0.05 ? 'badge-neutral' : diff > 0 ? 'badge-warm' : 'badge-cool';
    const icon = Math.abs(diff) < 0.05 ? 'minus' : diff > 0 ? 'trending-up' : 'trending-down';
    return `<span class="badge ${cls}"><i data-lucide="${icon}" class="w-3 h-3"></i>${label} ${signed(diff)}℃</span>`;
  };

  /** 数値カウントアップ用の要素 */
  const counter = (value, digits = 1) =>
    typeof value === 'number' ? `<span data-count="${value}" data-digits="${digits}">${(0).toFixed(digits)}</span>` : '—';

  /* ---------- 1. サマリーヘッダー ---------- */
  const summaryHeader = ({ place, targetStr, years, analysis, daysAhead }) => {
    let when = '';
    if (daysAhead === 0) when = '今日';
    else if (daysAhead === 1) when = '明日';
    else if (daysAhead > 1) when = `${daysAhead}日後`;
    else when = `${-daysAhead}日前`;

    return `
    <div class="glass-card p-5 sm:p-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i>予測地点</p>
          <h2 class="text-xl sm:text-2xl font-bold truncate" title="${escapeHTML(place.fullName || place.name)}">${escapeHTML(place.name)}</h2>
          <p class="text-sm text-slate-300 mt-1 flex items-center gap-1.5">
            <i data-lucide="calendar" class="w-4 h-4 text-sky-300"></i>${formatJP(targetStr)}
            <span class="badge badge-sky ml-1">${when}</span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2 sm:justify-end">
          <span class="badge badge-violet"><i data-lucide="database" class="w-3 h-3"></i>過去${analysis.sameDay.length}年分を集計</span>
          <span class="badge badge-neutral"><i data-lucide="clock" class="w-3 h-3"></i>実測データ：${formatMD(analysis.latestStr)}まで</span>
          ${years !== analysis.sameDay.length ? `<span class="badge badge-neutral">指定：過去${years}年</span>` : ''}
        </div>
      </div>
    </div>`;
  };

  /* ---------- 2. メイン予測カード（統計） ---------- */
  const statsCard = ({ analysis, years }) => {
    const { sunny, temp, trend } = analysis;
    const rate = sunny.rate ?? 0;
    const rateColor = rate >= 70 ? 'text-amber-300' : rate >= 40 ? 'text-sky-300' : 'text-indigo-300';
    const verdict = rate >= 70 ? 'お出かけ日和の可能性大！' : rate >= 40 ? '天気はやや不安定な傾向' : '雨具の準備がおすすめ';

    return `
    <article class="glass-card p-5 sm:p-6 flex flex-col gap-5">
      <div class="flex items-center justify-between gap-2">
        <h3 class="card-title"><i data-lucide="bar-chart-3" class="w-4 h-4 text-violet-300"></i>過去データからの統計予測</h3>
        <span class="badge badge-violet">統計70%＋トレンド30%</span>
      </div>

      <div class="flex flex-col sm:flex-row items-center gap-5">
        <div class="ring-wrap" role="img" aria-label="晴天率 ${fmt(sunny.rate, 0)}%">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <defs>
              <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#f97316" />
              </linearGradient>
            </defs>
            <circle class="ring-bg" cx="75" cy="75" r="${RING_R}" fill="none" stroke-width="12" />
            <circle class="ring-fg" cx="75" cy="75" r="${RING_R}" fill="none" stroke-width="12"
              stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}" data-target-offset="${RING_C * (1 - rate / 100)}" />
          </svg>
          <div class="ring-center">
            <span class="text-[11px] text-slate-400">晴天率</span>
            <span class="text-4xl font-extrabold ${rateColor}">${counter(sunny.rate, 0)}<span class="text-lg">%</span></span>
          </div>
        </div>
        <div class="text-center sm:text-left">
          <p class="text-lg font-bold">${verdict}</p>
          <p class="text-sm text-slate-400 mt-1 leading-relaxed">
            過去${sunny.total}年のうち <strong class="text-slate-200">${sunny.sunnyDays}回</strong> が雨や雪の降らない
            「晴れ・曇り」でした。
          </p>
          <p class="text-[11px] text-slate-500 mt-2">※天気コード0〜3 かつ 降水量1.0mm未満の日を判定</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="temp-box temp-max">
          <p class="text-xs text-slate-300 flex items-center gap-1"><i data-lucide="thermometer-sun" class="w-3.5 h-3.5"></i>予想最高気温</p>
          <p class="temp-value text-3xl sm:text-4xl font-extrabold mt-1">${counter(temp.predMax)}<span class="text-lg">℃</span></p>
          <p class="text-[11px] text-slate-400 mt-1">平年 ${fmt(temp.baseMax)}℃</p>
        </div>
        <div class="temp-box temp-min">
          <p class="text-xs text-slate-300 flex items-center gap-1"><i data-lucide="thermometer-snowflake" class="w-3.5 h-3.5"></i>予想最低気温</p>
          <p class="temp-value text-3xl sm:text-4xl font-extrabold mt-1">${counter(temp.predMin)}<span class="text-lg">℃</span></p>
          <p class="text-[11px] text-slate-400 mt-1">平年 ${fmt(temp.baseMin)}℃</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        ${diffBadge(temp.adjust)}
        ${
          trend.available
            ? `<span>直近7日間（${formatMD(trend.from)}〜${formatMD(trend.to)}）は平年より ${signed(trend.diff)}℃</span>`
            : '<span>直近トレンドのデータが不足しているため補正なし</span>'
        }
      </div>
    </article>`;
  };

  /* ---------- 2'. リアルタイム予報カード（14日以内） ---------- */
  const forecastCard = ({ forecast, analysis }) => {
    const w = WeatherCodes.get(forecast.code);
    const dMax = forecast.tmax - analysis.temp.predMax;
    const dMin = forecast.tmin - analysis.temp.predMin;
    return `
    <article class="glass-card forecast-card p-5 sm:p-6 flex flex-col gap-5">
      <div class="flex items-center justify-between gap-2">
        <h3 class="card-title"><i data-lucide="radio-tower" class="w-4 h-4 text-sky-300"></i>現在の最新天気予報</h3>
        <span class="badge badge-sky"><span class="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse"></span>LIVE</span>
      </div>

      <div class="flex items-center gap-4">
        ${weatherIcon(forecast.code, 'lg')}
        <div>
          <p class="text-2xl font-bold">${w.name}</p>
          <p class="text-sm text-slate-400">Open-Meteo 予報モデル</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="temp-box temp-max">
          <p class="text-xs text-slate-300">最高気温</p>
          <p class="temp-value text-3xl sm:text-4xl font-extrabold mt-1">${counter(forecast.tmax)}<span class="text-lg">℃</span></p>
          <p class="text-[11px] text-slate-400 mt-1">統計予測比 ${signed(dMax)}℃</p>
        </div>
        <div class="temp-box temp-min">
          <p class="text-xs text-slate-300">最低気温</p>
          <p class="temp-value text-3xl sm:text-4xl font-extrabold mt-1">${counter(forecast.tmin)}<span class="text-lg">℃</span></p>
          <p class="text-[11px] text-slate-400 mt-1">統計予測比 ${signed(dMin)}℃</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="stat-mini"><i data-lucide="umbrella" class="w-4 h-4 text-sky-300"></i>降水量 <strong class="ml-auto">${fmt(forecast.precip)} mm</strong></div>
        <div class="stat-mini"><i data-lucide="wind" class="w-4 h-4 text-teal-300"></i>最大風速 <strong class="ml-auto">${fmt(forecast.wind)} m/s</strong></div>
      </div>
    </article>`;
  };

  /* ---------- 2''. 予報範囲外のときのトレンド詳細カード ---------- */
  const trendCard = ({ analysis, daysAhead }) => {
    const { trend, temp, sameDay } = analysis;
    const precipAvg = Utils.mean(sameDay.map((r) => r.precip));
    const windAvg = Utils.mean(sameDay.map((r) => r.wind));
    const reason =
      daysAhead < 0
        ? '過去の日付のため、リアルタイム予報との比較はありません。'
        : 'リアルタイム予報は14日先までのため、統計予測のみを表示しています。';
    return `
    <article class="glass-card p-5 sm:p-6 flex flex-col gap-5">
      <h3 class="card-title"><i data-lucide="activity" class="w-4 h-4 text-rose-300"></i>直近の気象トレンド</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="stat-mini flex-col !items-start">
          <span class="text-[11px] text-slate-400">直近7日の平均気温</span>
          <strong class="text-2xl">${fmt(trend.recentAvg)}℃</strong>
        </div>
        <div class="stat-mini flex-col !items-start">
          <span class="text-[11px] text-slate-400">同時期の平年値</span>
          <strong class="text-2xl">${fmt(trend.normalAvg)}℃</strong>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        ${trend.available ? diffBadge(trend.diff, '平年差') : ''}
        ${diffBadge(temp.adjust, '予測への補正')}
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="stat-mini"><i data-lucide="umbrella" class="w-4 h-4 text-sky-300"></i>平均降水量 <strong class="ml-auto">${fmt(precipAvg)} mm</strong></div>
        <div class="stat-mini"><i data-lucide="wind" class="w-4 h-4 text-teal-300"></i>平均最大風速 <strong class="ml-auto">${fmt(windAvg)} m/s</strong></div>
      </div>
      <p class="text-xs text-slate-500 flex items-start gap-1.5"><i data-lucide="info" class="w-3.5 h-3.5 mt-0.5 shrink-0"></i>${reason}</p>
    </article>`;
  };

  /* ---------- 3. 服装アドバイス＆注意点 ---------- */
  const adviceCard = ({ analysis }) => {
    const { clothing, notices, sameDay } = analysis;
    const noticeHTML = notices.length
      ? notices
          .map(
            (n) => `
          <li class="notice-item">
            <span class="notice-icon ni-${n.type}"><i data-lucide="${n.icon}" class="w-4 h-4"></i></span>
            <span class="text-slate-200">${n.text}</span>
          </li>`
          )
          .join('')
      : `<li class="notice-item">
          <span class="notice-icon ni-ok"><i data-lucide="shield-check" class="w-4 h-4"></i></span>
          <span class="text-slate-200">過去${sameDay.length}年の同日データでは、大雨・強風・極端な気温などの目立ったリスクは見られません。</span>
        </li>`;

    return `
    <article class="glass-card p-5 sm:p-6">
      <div class="grid gap-6 md:grid-cols-2">
        <div class="flex flex-col gap-4">
          <h3 class="card-title"><i data-lucide="shirt" class="w-4 h-4 text-violet-300"></i>服装アドバイス</h3>
          <div class="clothing-hero">
            <div class="clothing-emoji" aria-hidden="true">${clothing.emoji}</div>
            <div>
              <p class="text-lg font-bold">${clothing.title}</p>
              <p class="text-sm text-slate-300 mt-0.5">${clothing.desc}</p>
              <p class="text-[11px] text-slate-500 mt-1">予想最高気温 ${fmt(analysis.temp.predMax)}℃ を基準に判定</p>
            </div>
          </div>
          ${
            clothing.bigRange
              ? `<div class="alert-tag"><span>⚠️</span><span>朝晩の寒暖差に注意（日較差 ${fmt(clothing.range)}℃）。脱ぎ着しやすい服装がおすすめです</span></div>`
              : `<div class="stat-mini text-slate-300"><i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-300"></i>日較差は ${fmt(clothing.range)}℃ で、寒暖差は穏やかです</div>`
          }
        </div>
        <div class="flex flex-col gap-4">
          <h3 class="card-title"><i data-lucide="alert-triangle" class="w-4 h-4 text-amber-300"></i>気象データ上の注意点</h3>
          <ul class="flex flex-col gap-2.5">${noticeHTML}</ul>
        </div>
      </div>
    </article>`;
  };

  /* ---------- 4. 過去N年分の同日データ履歴 ---------- */
  const historyCard = ({ analysis, targetStr }) => {
    const { sameDay } = analysis;
    const maxPrecip = Math.max(10, ...sameDay.map((r) => r.precip || 0));
    const rows = sameDay
      .map((r) => {
        const w = WeatherCodes.get(r.code);
        const sunny = Logic.isSunny(r);
        const barW = r.precip ? Math.max(4, (r.precip / maxPrecip) * 60) : 0;
        return `
        <tr class="${sunny ? 'is-sunny' : 'is-rainy'}">
          <td class="font-semibold">${r.year}年</td>
          <td>
            <div class="flex items-center gap-2.5">${weatherIcon(r.code, 'sm')}<span>${w.name}</span></div>
          </td>
          <td><span class="text-rose-300 font-semibold">${fmt(r.tmax)}℃</span><span class="text-slate-500 mx-1">/</span><span class="text-sky-300 font-semibold">${fmt(r.tmin)}℃</span></td>
          <td>${fmt(r.precip)} mm${barW ? `<span class="precip-bar" style="width:${barW}px"></span>` : ''}</td>
          <td class="${r.wind >= 10 ? 'text-teal-300 font-semibold' : ''}">${fmt(r.wind)} m/s</td>
        </tr>`;
      })
      .join('');

    return `
    <article class="glass-card p-5 sm:p-6">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 class="card-title"><i data-lucide="table-2" class="w-4 h-4 text-sky-300"></i>過去${sameDay.length}年の ${formatMD(targetStr)} の天気</h3>
        <div class="flex gap-3 text-[11px] text-slate-400">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400"></span>晴れ・曇り</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-sky-400"></span>雨・雪など</span>
        </div>
      </div>
      <div class="overflow-x-auto -mx-1 px-1">
        <table class="history-table">
          <thead><tr><th>年</th><th>天気</th><th>最高 / 最低</th><th>降水量</th><th>最大風速</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>`;
  };

  /** 結果全体のHTML */
  const results = (ctx) => {
    const second = ctx.forecast ? forecastCard(ctx) : trendCard(ctx);
    return `
      <div class="stagger space-y-6">
        ${summaryHeader(ctx)}
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          ${statsCard(ctx)}
          ${second}
        </div>
        ${adviceCard(ctx)}
        ${historyCard(ctx)}
      </div>`;
  };

  /** 挿入後のアニメーション（リング・数値カウントアップ） */
  const animate = (root) => {
    requestAnimationFrame(() => {
      root.querySelectorAll('.ring-fg').forEach((c) => {
        c.style.strokeDashoffset = c.dataset.targetOffset;
      });
    });

    root.querySelectorAll('[data-count]').forEach((el) => {
      const to = Number(el.dataset.count);
      const digits = Number(el.dataset.digits);
      const duration = 1100;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (to * eased).toFixed(digits);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };

  return { results, animate };
})();
