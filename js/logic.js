/**
 * 予測・集計ロジック（仕様書「3. 予測・集計ロジック仕様」に対応）
 * 画面描画には依存しない純粋な計算処理のみをまとめる。
 */
const Logic = (() => {
  const SUNNY_CODES = new Set([0, 1, 2, 3]);
  const TREND_WEIGHT = 0.3; // 統計70% : 直近トレンド30%
  const TREND_DAYS = 7;

  const isValid = (r) => r && typeof r.tmax === 'number' && typeof r.tmin === 'number';

  /** 雨雪なし（晴れ・曇り かつ 降水量1.0mm未満）の判定 */
  const isSunny = (r) => SUNNY_CODES.has(r.code) && typeof r.precip === 'number' && r.precip < 1.0;

  /**
   * 取得すべき過去データの期間を求める。
   * 同日データ（N年分）と、直近7日間の平年比較（N年分 + 年またぎ）をカバーする。
   */
  const getFetchRange = (targetStr, years, today) => {
    const targetYear = Number(targetStr.slice(0, 4));
    const baseYear = Math.min(targetYear, today.getFullYear());
    const startYear = Math.max(1940, baseYear - years - 1);
    const end = Utils.toISO(Utils.addDays(today, -1)); // 昨日
    return { start: `${startYear}-01-01`, end };
  };

  /** 気温が揃っている最新の日付（Historical API は直近数日が欠損することがある） */
  const findLatestDate = (records) => {
    for (let i = records.length - 1; i >= 0; i--) {
      if (isValid(records[i])) return records[i].date;
    }
    return null;
  };

  /**
   * 過去N年分の「同じ月日」のデータを抽出（新しい年順）。
   * ターゲット日より前、かつデータが存在する日に限る。
   */
  const collectSameDay = (map, targetStr, latestStr, years) => {
    const [ty, tm, td] = targetStr.split('-').map(Number);
    const latestYear = Number(latestStr.slice(0, 4));
    const out = [];
    const startYear = Math.min(ty, latestYear);
    for (let y = startYear; y >= 1940 && out.length < years; y--) {
      // 取得済みのデータ範囲を超えたら打ち切り
      if (y < startYear - years - 1) break;
      const dateStr = Utils.makeDate(y, tm, td);
      if (dateStr >= targetStr || dateStr > latestStr) continue;
      const rec = map.get(dateStr);
      if (isValid(rec)) out.push({ ...rec, year: y });
    }
    return out;
  };

  /** ① 晴天率（%） */
  const calcSunnyRate = (sameDay) => {
    const valid = sameDay.filter((r) => r.code !== null && r.precip !== null);
    if (!valid.length) return { rate: null, sunnyDays: 0, total: 0 };
    const sunnyDays = valid.filter(isSunny).length;
    return { rate: (sunnyDays / valid.length) * 100, sunnyDays, total: valid.length };
  };

  /**
   * ② 直近トレンド（平年差）
   * 最新7日間の実測平均気温 − 過去N年の同じ7日間の平均気温
   */
  const calcTrend = (map, latestStr, years) => {
    const latest = Utils.parseISO(latestStr);
    const recentDates = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) recentDates.push(Utils.toISO(Utils.addDays(latest, -i)));

    const avgTemp = (r) => (isValid(r) ? (r.tmax + r.tmin) / 2 : null);
    const recentAvg = Utils.mean(recentDates.map((d) => avgTemp(map.get(d))));

    const normals = [];
    for (let k = 1; k <= years; k++) {
      const yearAvg = Utils.mean(recentDates.map((d) => avgTemp(map.get(Utils.shiftYears(d, k)))));
      if (yearAvg !== null) normals.push(yearAvg);
    }
    const normalAvg = Utils.mean(normals);

    if (recentAvg === null || normalAvg === null) {
      return { diff: 0, recentAvg, normalAvg, from: recentDates[0], to: latestStr, available: false };
    }
    return { diff: recentAvg - normalAvg, recentAvg, normalAvg, from: recentDates[0], to: latestStr, available: true };
  };

  /** ② ハイブリッド気温予測 */
  const calcHybridTemp = (sameDay, trend) => {
    const baseMax = Utils.mean(sameDay.map((r) => r.tmax));
    const baseMin = Utils.mean(sameDay.map((r) => r.tmin));
    const adjust = trend.diff * TREND_WEIGHT;
    return {
      baseMax,
      baseMin,
      adjust,
      predMax: baseMax !== null ? baseMax + adjust : null,
      predMin: baseMin !== null ? baseMin + adjust : null,
    };
  };

  /** ④ 服装目安 */
  const getClothing = (predMax, predMin) => {
    const levels = [
      { min: 25, emoji: '👕', title: '半袖', desc: 'Tシャツ・ポロシャツなど夏物の装い' },
      { min: 20, emoji: '👔', title: '長袖シャツ・薄手の羽織', desc: '快適に過ごせる服装' },
      { min: 15, emoji: '🧶', title: 'カーディガン・スウェット', desc: '少し肌寒いため重ね着がおすすめ' },
      { min: 10, emoji: '🧥', title: 'ジャケット・トレンチコート', desc: '春・秋物のアウターが必要' },
      { min: -Infinity, emoji: '🧣', title: '冬物コート・ダウン', desc: 'しっかりとした防寒対策が必要' },
    ];
    const level = levels.find((l) => predMax >= l.min);
    const range = predMax - predMin;
    return { ...level, range, bigRange: range >= 10 };
  };

  /** ⑤ 気象データ上の注意点 */
  const getNotices = (sameDay) => {
    const n = sameDay.length;
    const notices = [];
    if (!n) return notices;

    // 大雨リスク
    const heavyRain = sameDay.filter((r) => typeof r.precip === 'number' && r.precip >= 10).length;
    if (heavyRain > 0) {
      notices.push({ type: 'rain', icon: 'cloud-rain-wind', text: `過去${n}年のうち${heavyRain}回、10mm以上の強い雨が降っています` });
    }

    // 強風リスク
    const winds = sameDay.map((r) => r.wind).filter((w) => typeof w === 'number');
    const windAvg = Utils.mean(winds);
    const strongWindYears = winds.filter((w) => w >= 10).length;
    if (windAvg !== null && (windAvg >= 7 || strongWindYears >= 2)) {
      notices.push({
        type: 'wind',
        icon: 'wind',
        text: `風が強い傾向があります（過去平均 ${windAvg.toFixed(1)}m/s${strongWindYears ? `、10m/s以上が${strongWindYears}回` : ''}）。海沿いやテーマパーク等では防風対策に注意してください`,
      });
    }

    // 極端な気温
    const extremeHot = sameDay.filter((r) => r.tmax >= 35).length;
    const hot = sameDay.filter((r) => r.tmax >= 30).length;
    const freezing = sameDay.filter((r) => r.tmin < 0).length;
    if (extremeHot > 0) {
      notices.push({ type: 'fire', icon: 'flame', text: `過去${n}年のうち${extremeHot}回、最高気温35℃以上の猛暑日になっています。熱中症に厳重警戒を` });
    }
    if (hot > extremeHot) {
      notices.push({ type: 'hot', icon: 'thermometer-sun', text: `過去${n}年のうち${hot}回、最高気温30℃以上の真夏日になっています。こまめな水分補給を` });
    }
    if (freezing > 0) {
      notices.push({ type: 'cold', icon: 'snowflake', text: `過去${n}年のうち${freezing}回、最低気温が0℃未満の冬日になっています。路面凍結や防寒に注意してください` });
    }
    return notices;
  };

  /**
   * 全体の分析を実行してまとめた結果を返す
   * @param {Array} records 過去データのレコード配列
   * @param {string} targetStr 予測対象日 'YYYY-MM-DD'
   * @param {number} years 集計年数
   */
  const analyze = (records, targetStr, years) => {
    const latestStr = findLatestDate(records);
    if (!latestStr) throw new Error('過去の気象データを取得できませんでした。');

    const map = new Map(records.map((r) => [r.date, r]));
    const sameDay = collectSameDay(map, targetStr, latestStr, years);
    if (!sameDay.length) throw new Error('指定した日付に対応する過去データが見つかりませんでした。');

    const sunny = calcSunnyRate(sameDay);
    const trend = calcTrend(map, latestStr, years);
    const temp = calcHybridTemp(sameDay, trend);
    const clothing = getClothing(temp.predMax, temp.predMin);
    const notices = getNotices(sameDay);

    return { latestStr, sameDay, sunny, trend, temp, clothing, notices };
  };

  return { getFetchRange, analyze, isSunny };
})();
