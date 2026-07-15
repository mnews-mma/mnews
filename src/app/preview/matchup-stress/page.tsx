import styles from "@/styles/matchup.module.css";
import MatchupTape from "@/components/matchup/MatchupTape";
import { CommonOpponentsHeader, CommonOpponentsToggle, CommonOpponentsInline } from "@/components/matchup/CommonOpponentsList";
import type { TapeFighterData } from "@/components/matchup/matchupData";
import type { CommonOpponent } from "@/lib/originalArticles";

// §5堅牢性の受け入れ基準を確認するための一時的なQAページ(本番非公開・非リンク)。
// ここで使う数値は全て「レイアウト崩れが起きないか」の確認専用ダミーで、実在選手の
// 戦績として表示・保存する意図は無い(§4の対象外・実ページには一切使わない)。
// 実DB最長名4種(ラジャブアリ・シェイドゥラエフ/カルシャガ・ダウトベック/
// 柴田"MONKEY"有哉/日比野"エビ中"純也)は全てdata/fighterRecords.json由来の
// 実在文字列(コピー元: 選手名フィールド or history.opponentの生テキスト)。
// v2マージ前に削除すること。
export const metadata = { robots: { index: false, follow: false } };

const LONG_NAMES = [
  "ラジャブアリ・シェイドゥラエフ",
  "カルシャガ・ダウトベック",
  '柴田"MONKEY"有哉',
  "日比野“エビ中”純也",
];

function tape(name: string, record: string, last5?: TapeFighterData["last5"], methodCounts?: TapeFighterData["methodCounts"]): TapeFighterData {
  return {
    name,
    record,
    winRate: 86,
    finishRate: 79,
    last5,
    methodCounts,
  };
}

const dummyCommons = (names: string[]): CommonOpponent[] =>
  names.map((n, i) => ({ name: n, resultA: i % 3 === 0 ? "win" : i % 3 === 1 ? "loss" : "draw", resultB: i % 2 === 0 ? "loss" : "win" }));

export default function MatchupStressPage() {
  return (
    <div className={styles.mv2} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 24, maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        §5堅牢性チェック用の一時ページ(本番非公開・リンクなし)。実DB最長名4種の総当たり確認に使用。
      </p>

      <section>
        <h2 style={{ fontSize: 13, marginBottom: 8 }}>1. 最長名 x 最長名(タペ両コーナー)</h2>
        <div className={styles.card}>
          <MatchupTape
            left={tape(LONG_NAMES[0], "19-0-0", ["win", "win", "win", "loss", "draw"])}
            right={tape(LONG_NAMES[1], "19-3-0", ["win", "win", "loss", "win", "win"])}
          />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 13, marginBottom: 8 }}>2. クォート/記号入り最長名 x 最長名</h2>
        <div className={styles.card}>
          <MatchupTape left={tape(LONG_NAMES[2], "11-15-1", ["loss", "loss", "win", "win", "loss"])} right={tape(LONG_NAMES[3], "6-8-0")} />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 13, marginBottom: 8 }}>3. 共通対戦相手 列見出し(fighter向け): 最長名 x 最長名</h2>
        <div className={styles.card}>
          <CommonOpponentsHeader
            selfName={LONG_NAMES[0]}
            opponentName={LONG_NAMES[1]}
            commons={dummyCommons([LONG_NAMES[2], LONG_NAMES[3], "通常の名前"])}
            visibleSlugs={new Set()}
          />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 13, marginBottom: 8 }}>4. 共通対戦相手 開閉式(events向け): 0件</h2>
        <div className={styles.card}>
          <CommonOpponentsToggle commons={[]} visibleSlugs={new Set()} />
          <p style={{ fontSize: 12, color: "var(--muted)", padding: "8px 14px" }}>
            (0件の場合トグル自体が非表示になる仕様。上に何も出ていなければ正しい)
          </p>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 13, marginBottom: 8 }}>5. 共通対戦相手 開閉式(events向け): 12件(10人超)</h2>
        <div className={styles.card}>
          <CommonOpponentsToggle
            commons={dummyCommons([
              LONG_NAMES[0],
              "選手A",
              "選手B",
              "選手C",
              "選手D",
              LONG_NAMES[2],
              "選手E",
              "選手F",
              "選手G",
              "選手H",
              LONG_NAMES[3],
              "選手I",
            ])}
            visibleSlugs={new Set()}
          />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 13, marginBottom: 8 }}>6. 夢のカード向け: 共通対戦相手なし(空状態)</h2>
        <div className={styles.card} style={{ padding: 8 }}>
          <CommonOpponentsInline commons={[]} visibleSlugs={new Set()} />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 13, marginBottom: 8 }}>7. 直近5戦: 引き分け含む・5戦未満</h2>
        <div className={styles.card}>
          <MatchupTape left={tape("選手X", "3-1-2", ["draw", "win", "draw"])} right={tape("選手Y", "1-0-0", ["win"])} />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 13, marginBottom: 8 }}>8. 決着内訳が2桁(夢のカード向け)</h2>
        <div className={styles.card}>
          <MatchupTape
            compact
            left={tape("選手Z", "45-29-10", undefined, { ko: 24, sub: 15, decision: 33 })}
            right={tape("選手W", "22-4-1", undefined, { ko: 18, sub: 2, decision: 4 })}
          />
        </div>
      </section>
    </div>
  );
}
