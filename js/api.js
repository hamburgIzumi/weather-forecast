/**
 * 外部API通信レイヤー
 * - Nominatim（場所検索）
 * - Open-Meteo Historical Weather API（過去データ：1リクエストで一括取得）
 * - Open-Meteo Forecast API（14日以内のリアルタイム予報）
 * すべて APIキー不要の無料エンドポイント。
 */
const Api = (() => {
  const DAILY_VARS = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max';
  const TIMEZONE = 'Asia/Tokyo';

  /** fetch して JSON を返す。エラー時は API の reason をメッセージにする */
  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, options);
    if (!res.ok) {
      let reason = '';
      try {
        const body = await res.json();
        reason = body.reason || body.error || '';
      } catch (_) {
        /* JSON でないレスポンスは無視 */
      }
      const err = new Error(reason || `通信エラーが発生しました（HTTP ${res.status}）`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  };

  /** Open-Meteo の daily 配列を扱いやすいレコード配列に変換 */
  const toRecords = (daily) =>
    daily.time.map((date, i) => ({
      date,
      code: daily.weather_code[i],
      tmax: daily.temperature_2m_max[i],
      tmin: daily.temperature_2m_min[i],
      precip: daily.precipitation_sum[i],
      wind: daily.wind_speed_10m_max[i],
    }));

  /**
   * 場所検索（Nominatim）
   * @param {string} query 検索キーワード
   * @param {AbortSignal} signal 前回リクエストのキャンセル用
   */
  const searchPlaces = async (query, signal) => {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json' +
      `&q=${encodeURIComponent(query)}&accept-language=ja&limit=5`;
    const list = await fetchJSON(url, { signal });
    return list.map((p) => ({
      name: p.name || p.display_name.split(',')[0],
      fullName: p.display_name,
      lat: Number(p.lat),
      lon: Number(p.lon),
    }));
  };

  const buildParams = (lat, lon, extra) =>
    new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      daily: DAILY_VARS,
      timezone: TIMEZONE,
      wind_speed_unit: 'ms', // 風速を m/s で取得（デフォルトは km/h）
      ...extra,
    }).toString();

  /**
   * 過去気象データを 1 回のリクエストで一括取得する。
   * end_date が API の提供範囲外だった場合は、7日前まで遡って再試行する。
   */
  const fetchHistorical = async (lat, lon, startDate, endDate) => {
    const request = (end) =>
      fetchJSON(`https://archive-api.open-meteo.com/v1/archive?${buildParams(lat, lon, { start_date: startDate, end_date: end })}`);

    let data;
    try {
      data = await request(endDate);
    } catch (e) {
      // 400 系（日付範囲外など）の場合のみフォールバック
      if (e.status && e.status >= 400 && e.status < 500) {
        const fallback = Utils.toISO(Utils.addDays(Utils.parseISO(endDate), -7));
        data = await request(fallback);
      } else {
        throw e;
      }
    }
    return toRecords(data.daily);
  };

  /** 14日間のリアルタイム予報を取得 */
  const fetchForecast = async (lat, lon) => {
    const data = await fetchJSON(`https://api.open-meteo.com/v1/forecast?${buildParams(lat, lon, { forecast_days: 14 })}`);
    return toRecords(data.daily);
  };

  return { searchPlaces, fetchHistorical, fetchForecast };
})();
