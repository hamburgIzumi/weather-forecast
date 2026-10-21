# weather-forecast
天気予報

過去の気象データと直近の気象トレンドを掛け合わせて、指定した場所・日付の天気と気温を予測するフロントエンド完結型Webアプリ「Sora Lab」です。

## 使い方
`index.html` をブラウザで開くだけで動作します（ビルド・サーバー不要）。

## 主な機能
- 場所検索（Nominatim / 500msデバウンス）＋クイックタグ
- 過去N年（5/10/20年）の同日データから晴天率を算出
- 「統計70% ＋ 直近トレンド30%」のハイブリッド気温予測
- 14日以内はOpen-Meteoのリアルタイム予報と比較表示
- 服装目安・寒暖差アラート・気象リスクの注意点
- 過去N年分の同日データ履歴一覧

## ファイル構成
| ファイル | 役割 |
| --- | --- |
| `index.html` | 画面構造 |
| `css/style.css` | デザイン（グラスモーフィズム・アニメーション） |
| `js/utils.js` | 日付計算などの共通関数 |
| `js/weather-codes.js` | WMO天気コード対応表 |
| `js/api.js` | 外部API通信 |
| `js/logic.js` | 予測・集計ロジック |
| `js/calendar.js` | カスタムカレンダーピッカー（スマホ・PC両対応） |
| `js/render.js` | 結果画面の描画 |
| `js/app.js` | 入力UIと実行フロー制御 |

データ提供: [Open-Meteo](https://open-meteo.com/) / © OpenStreetMap contributors
