import { calcFighterRates, fighterDisplayName } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { ResolvedFighter } from "@/lib/feeds/resolveFighter";
import type { OrgTag, OrgTagKey } from "@/lib/orgTags";
import { weightSortKey } from "@/lib/weightClasses";
import { MULTI_ORG_RECORD_LABEL } from "@/lib/mnewsRating/multiOrgRecord";

const TAG_COLOR: Record<OrgTagKey, string> = {
  ufc: SOURCES.ufc.color,
  rizin: SOURCES.rizin.color,
  deep: SOURCES.deep.color,
  pancrase: SOURCES.pancrase.color,
  shooto: SOURCES.shooto.color,
  one: SOURCES.one.color,
};

// 団体の並び順(選手ソートの第2キー): UFC → RIZIN → DEEP → パンクラス → 修斗 → ONE
const ORG_SORT_ORDER: Record<string, number> = {
  ufc: 0,
  rizin: 1,
  deep: 2,
  pancrase: 3,
  shooto: 4,
  one: 5,
};

// 半角/全角スペースを除いて正規化(FighterFilterGrid.tsxのクライアント側フィルタと
// 同じ正規化ルールを使い、data-name-ja属性へ焼き込む)。
function normNameForSearch(s: string): string {
  return s.replace(/[\s　]/g, "");
}

// カードグリッドの実描画(Server Component)。useSearchParams()に依存しないため
// Suspense境界の外に置ける = ISR生成の静的HTMLに全件がそのまま出力される。
// フィルタの適用はここでは行わず(全件を無条件描画)、各カードにdata属性
// (階級・団体タグ・検索用正規化文字列)を持たせるだけに留める。実際の
// 表示/非表示切り替えはFighterFilterGrid.tsx側がクライアントJSでdata属性を
// 見てclassList操作する(.fighter-card.is-filtered-out{display:none})。
export default function FighterCardGrid({
  fighters,
  tagsBySlug = {},
}: {
  fighters: ResolvedFighter[];
  tagsBySlug?: Record<string, OrgTag[]>;
}) {
  // 第1キー: 階級(共有の体重ソートキー) / 第2キー: 団体(UFC→RIZIN→DEEP→パンクラス→修斗→ONE)
  // フィルタ無しの初期表示順と一致させる(旧FighterFilterGrid.tsxのfilteredソートと同一ロジック)。
  const sorted = [...fighters].sort((a, b) => {
    const wa = weightSortKey(a.weightClass);
    const wb = weightSortKey(b.weightClass);
    if (wa !== wb) return wa - wb;
    const orgA = ORG_SORT_ORDER[a.org] ?? 9;
    const orgB = ORG_SORT_ORDER[b.org] ?? 9;
    return orgA - orgB;
  });

  return (
    <>
      <div
        id="fighter-empty-message"
        style={{ display: "none", padding: "48px 24px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}
      >
        該当なし
      </div>
      <div className="fighter-grid" id="fighter-grid">
        {sorted.map((f) => {
          const { winRate, finishRate } = calcFighterRates(f);
          const tags = tagsBySlug[f.slug] || [];
          return (
            <a
              key={f.slug}
              href={`/fighters/${f.slug}`}
              className="fighter-card"
              style={{ borderLeftColor: SOURCES[f.org].color }}
              data-weight={f.weightClass}
              data-orgs={tags.map((t) => t.key).join(",")}
              data-name-ja={normNameForSearch(f.nameJa)}
              data-name-en={f.nameEn.toLowerCase()}
            >
              {/* 団体はタグ1系統に統一(org由来の重複バッジは出さない)。タグ＋階級を上部に。 */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 2 }}>
                {tags.map((t) => (
                  <span
                    key={t.key}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 4,
                      color: "#fff",
                      background: TAG_COLOR[t.key],
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.label}
                  </span>
                ))}
                {/* 階級も団体タグと同じチップ体裁に統一(区切り"/"や細字添字は廃止)。
                    色はorgと区別する中立チップ(枠線＋muted)。 */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                    color: "var(--muted)",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.weightClass}
                </span>
              </div>
              <div className="fighter-name">{fighterDisplayName(f)}</div>
              {f.nickname && <div className="fighter-card-nickname">「{f.nickname}」</div>}
              {/* f.multiOrgRecordは「1行目(Wikipedia通算)を信頼できない選手」
                  (noRecordData、またはneedsReview/recordFromResultsで1行目が
                  4団体合算を下回る選手)にのみ付与される(visibleFighters.ts
                  getVisibleFighters参照)。noRecordData自体で分岐せず、まず
                  multiOrgRecordの有無で分岐することで、/fighters/[slug]の
                  suppressNoRecordRowと矛盾しない表示にする。 */}
              {f.multiOrgRecord ? (
                <>
                  <div className="fighter-record">
                    {f.multiOrgRecord.wins}-{f.multiOrgRecord.losses}-{f.multiOrgRecord.draws}
                  </div>
                  {/* 指示書I(2026-08-03): ソース表記(集計元ラベル)を数字の直下に置く。
                      旧配置(breakdown/rates行より下)だとカードの一番下に来て
                      数字との対応が視覚的に分かりにくかった。 */}
                  <div className="fighter-record-source">{MULTI_ORG_RECORD_LABEL}</div>
                  <div className="fighter-breakdown">
                    KO {f.multiOrgRecord.ko} / 一本 {f.multiOrgRecord.sub} / 判定 {f.multiOrgRecord.decision}
                  </div>
                  <div className="fighter-rates">
                    {f.multiOrgRecord.winRate !== null && <span>勝率 {f.multiOrgRecord.winRate}%</span>}
                    {f.multiOrgRecord.finishRate !== null && <span>フィニッシュ率 {f.multiOrgRecord.finishRate}%</span>}
                  </div>
                </>
              ) : f.noRecordData ? (
                <div className="fighter-record" style={{ fontSize: 14, color: "var(--muted)" }}>
                  データなし
                </div>
              ) : (
                <>
                  <div className="fighter-record">
                    {f.wins}-{f.losses}-{f.draws}
                  </div>
                  <div className="fighter-breakdown">
                    KO {f.ko} / 一本 {f.sub} / 判定 {f.decision}
                  </div>
                  <div className="fighter-rates">
                    {winRate !== null && <span>勝率 {winRate}%</span>}
                    {finishRate !== null && <span>フィニッシュ率 {finishRate}%</span>}
                  </div>
                </>
              )}
            </a>
          );
        })}
      </div>
    </>
  );
}
