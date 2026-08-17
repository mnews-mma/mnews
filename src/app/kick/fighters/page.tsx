import Link from "next/link";
import { getKickIndex, KickIndexEntry, KICK_PROMOTIONS } from "@/lib/kick/data";
import { pageMetadata } from "@/lib/seo";
import FighterSearch from "./FighterSearch";

export function generateMetadata() {
  const { stats } = getKickIndex();
  return pageMetadata({
    title: "キックボクシング選手一覧（五十音順）｜立ち技名鑑 - Mニュース",
    description: `対象${KICK_PROMOTIONS.length}団体の公式サイトとWikipedia全団体から収集したキックボクシング選手${stats.fighters.toLocaleString(
      "ja-JP",
    )}人を五十音順に掲載。読みが未取得の選手は空欄のまま表示しています。`,
    path: "/kick/fighters",
  });
}

const BUCKET_ORDER = ["ア", "カ", "サ", "タ", "ナ", "ハ", "マ", "ヤ", "ラ", "ワ", "―"];
const BUCKET_LABEL: Record<string, string> = { "―": "読み未取得・分類不能" };

export default function KickFightersPage() {
  const { fighters, stats } = getKickIndex();

  // 索引はビルド時に五十音順で並べ済み。ここでは行単位に束ねるだけで集計はしない。
  const buckets = new Map<string, KickIndexEntry[]>();
  for (const f of fighters) {
    if (!buckets.has(f.bucket)) buckets.set(f.bucket, []);
    buckets.get(f.bucket)!.push(f);
  }
  const rows = BUCKET_ORDER.filter((b) => buckets.has(b));

  return (
    <>
      <h1 className="kick-h1">選手一覧</h1>
      <p className="kick-lead">
        五十音順（{stats.fighters.toLocaleString("ja-JP")}人）。読みが取得できなかった{stats.kanaMissing.toLocaleString("ja-JP")}人は
        <strong>空欄のまま末尾</strong>にまとめています（推測で読みを補わないため）。
        {stats.kanaUnclassified > stats.kanaMissing && (
          <>
            読みは取得できているものの、記号始まりの表記やラテン文字表記のため五十音順に分類できない
            {(stats.kanaUnclassified - stats.kanaMissing).toLocaleString("ja-JP")}人も同じ末尾の欄にまとめているため、
            この欄には合計{stats.kanaUnclassified.toLocaleString("ja-JP")}人が並びます。
          </>
        )}
        表記名・かな・ローマ字・所属で検索できます。
      </p>

      <FighterSearch />

      <h2 className="kick-section-title">
        全選手一覧(五十音順・{stats.fighters.toLocaleString("ja-JP")}人)
        <span className="kick-fulllist-note">検索窓・団体フィルタの結果は上のパネルに出ます。この下は常に全員分です。</span>
      </h2>

      <nav className="kick-jump" aria-label="行で絞り込む">
        {rows.map((b) => (
          <a key={b} href={`#row-${b}`}>
            {BUCKET_LABEL[b] ?? `${b}行`}
          </a>
        ))}
      </nav>

      {rows.map((b) => (
        <section key={b} id={`row-${b}`} className="kick-bucket">
          <h2 className="kick-bucket__h">
            {BUCKET_LABEL[b] ?? `${b}行`}
            <span style={{ fontSize: 11, color: "var(--kick-muted)", marginLeft: 8, fontWeight: 400 }}>
              {buckets.get(b)!.length.toLocaleString("ja-JP")}人
            </span>
          </h2>
          <div className="kick-rows">
            <div className="kick-row kick-row--head" aria-hidden="true">
              <div>表記名</div>
              <div>読み</div>
              <div>所属</div>
              <div style={{ textAlign: "right" }}>戦績</div>
            </div>
            {buckets.get(b)!.map((f) => (
              <div className="kick-row" key={f.slug}>
                <div className="kick-row__name">
                  <Link href={`/kick/fighters/${encodeURIComponent(f.slug)}`}>{f.name}</Link>
                </div>
                <div className="kick-row__kana">
                  {f.kana ? (
                    <>
                      {f.kana}
                      {f.kanaType === "converted" && f.romaji ? (
                        <span className="kick-row__gym"> / {f.romaji}</span>
                      ) : null}
                    </>
                  ) : f.romaji ? (
                    <span className="kick-row__gym">{f.romaji}</span>
                  ) : (
                    <span className="kick-empty">（読み未取得）</span>
                  )}
                </div>
                <div className="kick-row__gym">{f.gym ?? <span className="kick-empty">—</span>}</div>
                <div className="kick-row__n">{f.boutCount ? `${f.boutCount}戦` : "—"}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
