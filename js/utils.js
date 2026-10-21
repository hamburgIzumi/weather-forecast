/**
 * 汎用ユーティリティ（日付計算・数値整形・デバウンスなど）
 * 日付はすべて「YYYY-MM-DD」形式の文字列を基本として扱い、
 * タイムゾーンのずれを避けるためにローカル日付として計算する。
 */
const Utils = (() => {
  const pad = (n) => String(n).padStart(2, '0');

  /** Date → 'YYYY-MM-DD' */
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /** 'YYYY-MM-DD' → Date（ローカル時刻の0時） */
  const parseISO = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  /** n日後（負数なら前）の Date を返す */
  const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };

  /** 日本時間（Asia/Tokyo）基準の「今日」を返す */
  const todayJST = () => {
    const s = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return parseISO(s);
  };

  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

  /**
   * 指定年・月・日から 'YYYY-MM-DD' を作る。
   * 2/29 が存在しない年は 2/28 に読み替える（うるう日対策）。
   */
  const makeDate = (y, m, d) => {
    if (m === 2 && d === 29 && !isLeap(y)) d = 28;
    return `${y}-${pad(m)}-${pad(d)}`;
  };

  /** 'YYYY-MM-DD' を k 年前にずらした日付文字列を返す */
  const shiftYears = (dateStr, k) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return makeDate(y - k, m, d);
  };

  /** a → b までの日数差 */
  const diffDays = (a, b) => Math.round((b - a) / 86400000);

  /** null を除いた平均値（要素がなければ null） */
  const mean = (arr) => {
    const v = arr.filter((x) => typeof x === 'number' && !Number.isNaN(x));
    if (!v.length) return null;
    return v.reduce((s, x) => s + x, 0) / v.length;
  };

  /** 'YYYY-MM-DD' → '2026年10月22日（木）' */
  const formatJP = (dateStr) => {
    const d = parseISO(dateStr);
    const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${w}）`;
  };

  /** 'YYYY-MM-DD' → '10/22' */
  const formatMD = (dateStr) => {
    const d = parseISO(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  /** 符号付きの数値文字列（例: +1.2 / -0.4 / ±0.0） */
  const signed = (n, digits = 1) => {
    const v = Number(n.toFixed(digits));
    if (v === 0) return `±${(0).toFixed(digits)}`;
    return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;
  };

  /** 小数点以下を指定桁で丸めた文字列（null は '—'） */
  const fmt = (n, digits = 1) => (typeof n === 'number' ? n.toFixed(digits) : '—');

  /** 一定時間入力が止まってから実行するデバウンス関数 */
  const debounce = (fn, ms) => {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };

  /** HTML エスケープ（外部APIの文字列を安全に描画するため） */
  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  return {
    pad, toISO, parseISO, addDays, todayJST, isLeap, makeDate, shiftYears,
    diffDays, mean, formatJP, formatMD, signed, fmt, debounce, escapeHTML,
  };
})();
