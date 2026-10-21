/**
 * WMO 天気コード → 日本語名・アイコン・配色の対応表
 * 参考: https://open-meteo.com/en/docs （WMO Weather interpretation codes）
 */
const WeatherCodes = (() => {
  // type はアイコン背景の配色クラス（wi-xxx）に対応
  const TABLE = {
    0: { name: '快晴', icon: 'sun', type: 'sun' },
    1: { name: '晴れ', icon: 'sun', type: 'sun' },
    2: { name: '一部曇り', icon: 'cloud-sun', type: 'sun' },
    3: { name: '曇り', icon: 'cloud', type: 'cloud' },
    45: { name: '霧', icon: 'cloud-fog', type: 'fog' },
    48: { name: '着氷性の霧', icon: 'cloud-fog', type: 'fog' },
    51: { name: '弱い霧雨', icon: 'cloud-drizzle', type: 'rain' },
    53: { name: '霧雨', icon: 'cloud-drizzle', type: 'rain' },
    55: { name: '強い霧雨', icon: 'cloud-drizzle', type: 'rain' },
    56: { name: '着氷性の霧雨', icon: 'cloud-drizzle', type: 'rain' },
    57: { name: '強い着氷性の霧雨', icon: 'cloud-drizzle', type: 'rain' },
    61: { name: '弱い雨', icon: 'cloud-rain', type: 'rain' },
    63: { name: '雨', icon: 'cloud-rain', type: 'rain' },
    65: { name: '強い雨', icon: 'cloud-rain', type: 'rain' },
    66: { name: '着氷性の雨', icon: 'cloud-hail', type: 'rain' },
    67: { name: '強い着氷性の雨', icon: 'cloud-hail', type: 'rain' },
    71: { name: '弱い雪', icon: 'snowflake', type: 'snow' },
    73: { name: '雪', icon: 'snowflake', type: 'snow' },
    75: { name: '大雪', icon: 'snowflake', type: 'snow' },
    77: { name: '霧雪', icon: 'snowflake', type: 'snow' },
    80: { name: '弱いにわか雨', icon: 'cloud-sun-rain', type: 'rain' },
    81: { name: 'にわか雨', icon: 'cloud-rain-wind', type: 'rain' },
    82: { name: '激しいにわか雨', icon: 'cloud-rain-wind', type: 'rain' },
    85: { name: '弱いにわか雪', icon: 'cloud-snow', type: 'snow' },
    86: { name: '強いにわか雪', icon: 'cloud-snow', type: 'snow' },
    95: { name: '雷雨', icon: 'cloud-lightning', type: 'storm' },
    96: { name: '雷雨（ひょう）', icon: 'cloud-lightning', type: 'storm' },
    99: { name: '激しい雷雨（ひょう）', icon: 'cloud-lightning', type: 'storm' },
  };

  const UNKNOWN = { name: '不明', icon: 'help-circle', type: 'cloud' };

  /** コードから情報を取得（未定義コードは「不明」） */
  const get = (code) => (code === null || code === undefined ? UNKNOWN : TABLE[code] || UNKNOWN);

  return { get };
})();
