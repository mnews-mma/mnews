// 「ある階級の王者＋Eloコンテンダー」を組み立てる唯一の共有関数。
// ランキングページ(/rankings/[division]・/rankings)とトップページウィジェット
// (MnewsRatingSection)は、必ずこの関数経由でdata/rankings.jsonの
// DivisionRankingsから表示用データを取り出す(それぞれが独自に組み立てない)。
// 王者はentries(番号付きリスト)からは既にbuildDivisionRankings側で除外済み
// なので、ここでは「champion + entriesの先頭N件」を返すだけ。両者を必ず
// セットで返す型にすることで、片方だけを取り出して王者を出し忘れるドリフトを
// 構造的に防ぐ。
import type { DivisionRankings, ChampionOverlay, RankingEntry } from "./rankingsFile";
import { MnewsDivision, PUBLISHED_DIVISIONS } from "./divisions";

export interface DivisionRankingView {
  champion: ChampionOverlay | null;
  contenders: RankingEntry[];
}

// topN省略時は全件(ランキングページ本体用)。指定時は先頭N件(ウィジェット用)。
export function getDivisionRankingView(data: DivisionRankings | null | undefined, topN?: number): DivisionRankingView {
  if (!data) return { champion: null, contenders: [] };
  const contenders = topN !== undefined ? data.entries.slice(0, topN) : data.entries;
  return { champion: data.champion, contenders };
}

// クライアントコンポーネント("use client")へpropsとして渡す前に、rating/
// rawRatingを必ず除去する。"use client"へ渡したpropsはRSCペイロードとして
// HTML/JSにそのままシリアライズされるため、コンポーネント側が画面に描画しない
// 値でも、含めたままpropsに渡すとページの生HTML上には出力されてしまう
// (レート数値を外向き出力に出さない方針(D-2)に反する)。サーバーコンポーネント
// 側(/rankings/[division]・/rankings)はJSXへ個々のフィールドを文字列展開する
// だけで、オブジェクト全体をクライアントへは送らないため対象外(ここを通す
// 必要があるのはMnewsRatingSectionのようなクライアントコンポーネントへ渡す
// 経路のみ)。
export type ClientSafeRankingEntry = Omit<RankingEntry, "rawRating" | "rating">;
export type ClientSafeChampionOverlay = Omit<ChampionOverlay, "rating"> | null;

export interface ClientSafeDivisionRankingView {
  champion: ClientSafeChampionOverlay;
  contenders: ClientSafeRankingEntry[];
}

export function toClientSafeDivisionRankingView(view: DivisionRankingView): ClientSafeDivisionRankingView {
  const champion = view.champion ? (({ rating: _rating, ...safe }) => safe)(view.champion) : null;
  return {
    champion,
    contenders: view.contenders.map(({ rawRating: _rawRating, rating: _rating, ...safe }) => safe),
  };
}

export interface ResolvedRankingEntry extends RankingEntry {
  nameJa: string;
  displayRank: number; // 表示順位(1始まり)。解決失敗エントリを除外した後に振り直す
}

export interface ResolvedChampionOverlay extends ChampionOverlay {
  nameJa: string;
}

export interface ResolvedDivisionRankingView {
  champion: ResolvedChampionOverlay | null;
  contenders: ResolvedRankingEntry[];
}

// fighters.tsに存在しないfighterIdを画面にスラッグのまま出さない(生スラッグ
// 表示フォールバック禁止)。王者が解決できない場合は王者行ごと非表示にする
// (代替表示はしない)。挑戦者は解決できないエントリを除外した上で表示順位を
// 1から振り直す(=繰り上げ)。全スラッグがfighters.tsに存在することは
// scripts/check-rankings-fighter-slugs.tsでビルド時に保証しているため、ここで
// 弾かれるのは異常系(データ生成側の不整合)に対する最終防衛ラインという位置づけ。
//
// topNは「解決・除外・繰り上げ後」の件数に適用する(除外前に切ると、除外分だけ
// 表示件数が欠けたり、本来繰り上がるはずの選手が表示から漏れたりするため、
// 必ずこの順序を守る)。
export function resolveDivisionRankingView(
  view: DivisionRankingView,
  nameBySlug: Map<string, string> | Record<string, string>,
  topN?: number
): ResolvedDivisionRankingView {
  const lookup = (id: string): string | undefined =>
    nameBySlug instanceof Map ? nameBySlug.get(id) : nameBySlug[id];

  const championName = view.champion ? lookup(view.champion.fighterId) : undefined;
  const champion = view.champion && championName ? { ...view.champion, nameJa: championName } : null;

  const contenders: ResolvedRankingEntry[] = [];
  for (const e of view.contenders) {
    const nameJa = lookup(e.fighterId);
    if (!nameJa) continue;
    contenders.push({ ...e, nameJa, displayRank: contenders.length + 1 });
  }

  return { champion, contenders: topN !== undefined ? contenders.slice(0, topN) : contenders };
}

// resolveDivisionRankingView後のデータを"use client"コンポーネントへpropsとして
// 渡す前に、rating/rawRatingを必ず除去する(toClientSafeDivisionRankingViewと
// 同じ理由・同じ方針(D-2)。nameJa/displayRankはクライアント側で表示に使うため保持)。
export type ClientSafeResolvedRankingEntry = Omit<ResolvedRankingEntry, "rawRating" | "rating">;
export type ClientSafeResolvedChampionOverlay = Omit<ResolvedChampionOverlay, "rating"> | null;

export interface ClientSafeResolvedDivisionRankingView {
  champion: ClientSafeResolvedChampionOverlay;
  contenders: ClientSafeResolvedRankingEntry[];
}

export function toClientSafeResolvedDivisionRankingView(
  view: ResolvedDivisionRankingView
): ClientSafeResolvedDivisionRankingView {
  const champion = view.champion ? (({ rating: _rating, ...safe }) => safe)(view.champion) : null;
  return {
    champion,
    contenders: view.contenders.map(({ rawRating: _rawRating, rating: _rating, ...safe }) => safe),
  };
}

// ランキング表示のキャップ(王者は別枠・番号付きは1〜この値までのみ表示)。
// /rankings各階級一覧・選手ページのランクバッジ・X投稿のランキング注入の3面が
// 必ずこの定数を経由してキャップ値を参照する(値を変える箇所を1つに保つ)。
export const RANKING_DISPLAY_CAP = 15;

// 「表示ランク」の判定結果。"champion"=王者(番号付きランキングの対象外・
// 別枠で常に表示)/ number=1〜RANKING_DISPLAY_CAPの順位番号 / null=圏外
// (RANKING_DISPLAY_CAPより下、または未掲載)。表示上は「未ランク」として
// 扱う=順位を出さない。
export type DisplayRank = "champion" | number | null;

// 指定階級のランキングデータ内で、slugの「表示ランク」を返す唯一のヘルパー。
// /rankings各階級一覧・選手ページのランクバッジ・X投稿のランキング注入
// (findRankLabelInDivision経由)、この3面すべてがここを参照する(各所で個別に
// キャップ判定を書かない=単一ソース)。buildDivisionRankings確定後のrank番号を
// 表示用に判定するだけで、スコア計算・資格判定には一切関与しない。
export function getDisplayRank(data: DivisionRankings | null | undefined, slug: string): DisplayRank {
  if (!data) return null;
  if (data.champion?.fighterId === slug) return "champion";
  const entry = data.entries.find((e) => e.fighterId === slug);
  if (!entry || entry.rank > RANKING_DISPLAY_CAP) return null;
  return entry.rank;
}

// 指定階級のランキングデータ内で、slugが王者/表示ランク内のランカーのいずれかに
// 該当すれば表示用の順位ラベル("王者"または"◯位")を返す。掲載無し(未ランク・
// RANKING_DISPLAY_CAPより下)はnull(順位を捏造しない)。getDisplayRankの薄い
// フォーマッタで、キャップ判定はgetDisplayRank側の単一ソースに委ねる。
// /api/og/vs-compareのfindRankBadgeと同じ「rankのみ参照」方針だが、あちらは
// 複数階級を横断探索するのに対し、こちらは呼び出し側が特定した1階級のみを見る
// (ライブ結果入力は「その試合の階級」で判定するため)。
export function findRankLabelInDivision(data: DivisionRankings | null | undefined, slug: string): string | null {
  const displayRank = getDisplayRank(data, slug);
  if (displayRank === null) return null;
  return displayRank === "champion" ? "王者" : `${displayRank}位`;
}

// 「公開可否」の判定はPUBLISHED_DIVISIONS(divisions.ts)を唯一の真実源とする。
// /rankings/[division]・/rankings(ハブ)は既にこのホワイトリストを直接参照して
// 非公開階級を「準備中」として扱っている。トップページのウィジェットも同じ
// ホワイトリストをここ経由で参照することで、階級ごとの公開判定が2箇所に
// コピペされる状態を防ぐ(ライト級等を追加する際はPUBLISHED_DIVISIONS1箇所の
// 変更で両方に反映される)。
//
// 非公開階級は挑戦者ランキング(1〜5位)を出さない(Elo算出は済んでいても、
// 掲載品質の確認が済むまで一般公開しないという/rankingsの原則をトップでも守る)。
// 王者は「事実」としてElo公開可否とは独立に扱う既存方針(overlay設計)を踏襲し、
// 非公開階級でも表示を維持する(王者情報自体はデータ整合しているため)。
export function getPublishedDivisionRankingView(
  division: MnewsDivision,
  data: DivisionRankings | null | undefined,
  topN?: number
): DivisionRankingView {
  const view = getDivisionRankingView(data, topN);
  if (PUBLISHED_DIVISIONS.includes(division)) return view;
  return { champion: view.champion, contenders: [] };
}
