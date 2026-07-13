// 決着方法の生テキスト(日本語、例:"2R 2:24 TKO（パウンド）" "1R 4:31 三角絞め"
// "5分3R終了 判定1-2")をKO/一本/判定に分類する共通ロジック。
// fighterStrip.ts(表示用の勝敗内訳バー)とmnewsRating側のRIZIN公式集計
// (rizinRecordsAggregate.ts)の両方から使う単一の分類ソース(表記ゆれの
// 判定基準を二重定義しない)。推定はしない、実データのテキスト分類のみ。
export interface MethodCounts {
  ko: number;
  sub: number;
  decision: number;
  other: number;
}

export interface MethodClassifiable {
  result: string;
  method: string;
}

// 決着方法データが実質存在しない(round/time以外の記述が「N/A」のみ等)試合を
// 検出する。「2R N/A 洗濯ばさみ」のようにtimeだけがN/Aで決まり技名は実在する
// ケースを誤って弾かないよう、round+time相当のプレフィックスを取り除いた
// 残りが本当に空/N/Aの場合のみ「不明」とする(捏造ゼロ: 存在しない決着方法を
// 「その他」という決着があったかのように集計しない)。
export function isUnknownMethod(method: string): boolean {
  const trimmed = method.trim();
  if (trimmed === "" || trimmed === "—") return true;
  const stripped = trimmed.replace(/^\S*\s+[\d:]+\s+/, "").trim();
  return /^N\/A$/i.test(stripped);
}

export function classifyMethodJa(method: string): keyof MethodCounts {
  // RIZIN公式(rizinRecords.json)は決着方法の先頭に"SUB"を明示的に付ける
  // (例:"SUB（タップアウト：リアネイキッドチョーク）")。これを最優先で見る。
  if (/^SUB/i.test(method)) return "sub";
  if (method.includes("判定")) return "decision";
  if (/TKO|KO/i.test(method)) return "ko";
  // 一本(サブミッション)は決まり技名で表現されることが多いため、代表的な
  // 関節技・絞め技のキーワードで判定する。history実データを全選手分棚卸しして
  // 判明した表記ゆれを網羅する:
  // 絞め系(絞め/チョーク/スリーパー[ホールド]/ドラゴンスリーパー/ネックシザース/
  // 洗濯ばさみ)、関節技系(固め/腕ひしぎ/三角/クランク/ロック/ヒール[フック・
  // ホールド]/アームバー/オモプラッタ/アメリカーナ/ツイスター/アンクルホールド/
  // ニーバー/ストレッチ[スロエフストレッチ・ネックストレッチ等])、その他
  // 「サブミッション」表記そのもの・「一本」。
  if (
    /絞め|クランク|固め|三角|チョーク|腕ひしぎ|ロック|一本|スリーパー|ホールド|ヒール|アームバー|オモプラッタ|アメリカーナ|ツイスター|ネックシザース|洗濯ばさみ|サブミッション|スロエフ|ニーバー|ストレッチ/.test(
      method
    )
  )
    return "sub";
  return "other";
}

export function tallyMethods(fights: MethodClassifiable[]): MethodCounts {
  const counts: MethodCounts = { ko: 0, sub: 0, decision: 0, other: 0 };
  for (const f of fights) {
    if (isUnknownMethod(f.method)) continue; // 集計から除外(捏造ゼロ)
    counts[classifyMethodJa(f.method)]++;
  }
  return counts;
}

// 注意: 通算戦績(総合格闘技 戦績。RIZIN外を含む全キャリア)をhistory配列から
// 都度カウントして導出する関数はここに置かない。2026-07-13、GAMMA戦績のように
// 「Wikipediaの試合履歴表には載っているが編集方針上プロ戦績には数えない」試合が
// 混入し、シェイドゥラエフの通算が19-0→22-0に水増しされる事故が発生した
// (Wikipedia infoboxの編集判断でしか弾けない除外がある)。通算戦績は
// Wikipedia/DATA MMA/シード値(resolveFighterの戻り値)をそのまま信頼する。
// RIZIN限定の集計(ランキング/Elo駆動)はrizinRecordsAggregate.tsのcomputeFighterMmaRecord
// が別途rizinRecords.json(公式ソース)から導出する。
