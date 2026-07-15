import { fetchFighterRecords } from "@/lib/fighterRecordsCache";
import TitleFightCard from "@/components/matchup/TitleFightCard";
import { buildTapeData } from "@/components/matchup/matchupData";

// 確認専用ページ(noindex・ナビ非掲載)。対戦カードUI再挑戦の第1弾として
// TITLE戦カード1枚だけをKainaのスクショ確認用に置く。OKが出るまで他ページ
// には一切組み込まない。
export const metadata = {
  title: "対戦カード試作 | preview",
  robots: { index: false, follow: false },
};

export default async function CardPreviewPage() {
  const records = await fetchFighterRecords();

  const sabatello = records["sabatello-danny"];
  const kashimura = records["kashimura-ninnosuke"];
  const shinryu = records["shinryu-makoto"];
  const kim = records["kim-soochul"];

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 80px", background: "#f4f2ed" }}>
      <p style={{ fontSize: 12, color: "#8b887e", marginBottom: 24 }}>
        対戦カードUI 再挑戦・第1弾(1カード方式)。このページはnoindexで本番導線には組み込まれていません。
      </p>

      <h2 style={{ fontSize: 13, color: "#8b887e", marginBottom: 8 }}>① 本来のスコープ: TITLE戦(実データ)</h2>
      {sabatello && kashimura ? (
        <TitleFightCard
          left={buildTapeData("ダニー・サバテロ", "sabatello-danny", sabatello, {
            nickname: "The Italian Gangster",
            withLast5: true,
          })}
          right={buildTapeData("鹿志村仁之介", "kashimura-ninnosuke", kashimura, {
            nickname: "黒帯のリベリオン",
            withLast5: true,
          })}
          weightClass="バンタム級（61.0kg）"
        />
      ) : (
        <p>データ取得に失敗しました(sabatello-danny / kashimura-ninnosuke)</p>
      )}

      <h2 style={{ fontSize: 13, color: "#8b887e", margin: "32px 0 8px" }}>
        ② 通称の行数差ストレステスト(神龍誠×キム・スーチョル)
      </h2>
      {shinryu && kim ? (
        <TitleFightCard
          left={buildTapeData("神龍誠", "shinryu-makoto", shinryu, {
            nickname: "日本のラフ・ダイヤモンド",
            withLast5: true,
          })}
          right={buildTapeData("キム・スーチョル", "kim-soochul", kim, {
            nickname: "韓流お茶目ゾンビ",
            withLast5: true,
          })}
          weightClass="バンタム級（61.0kg）"
        />
      ) : (
        <p>データ取得に失敗しました(shinryu-makoto / kim-soochul)</p>
      )}
    </main>
  );
}
