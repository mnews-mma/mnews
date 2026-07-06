import type { OrgRankingData } from "@/lib/orgRankings";
import { SOURCES } from "@/lib/sources";

// パンクラス/修斗の公式ランキング表示(共通)。序列は団体公式の転載。
// 順位:選手名(DB内ならリンク)。出典・取得日を明示。
export default function OrgRankingView({ data }: { data: OrgRankingData }) {
  const color = data.org === "pancrase" ? SOURCES.pancrase.color : SOURCES.shooto.color;
  return (
    <div style={{ padding: "0 24px 48px" }}>
      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.8, marginBottom: 24 }}>
        {data.source}をそのまま転載しています（順位は団体公式の値・Mニュースは順位を作成・変更しません）。
        <br />
        出典：
        <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
          {data.source}
        </a>
        {data.rankingLabel ? `（${data.rankingLabel}）` : ""} ／ 取得日：{data.fetchedDate}
      </p>

      {data.classes.map((c) => (
        <section key={c.weightClass} style={{ marginBottom: 36 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 800,
              margin: "0 0 12px",
              paddingBottom: 8,
              borderBottom: `2px solid ${color}`,
              color: "var(--fg)",
            }}
          >
            {c.weightClass}
          </h2>
          <div className="table-outer">
            <div className="table-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: 64 }}>順位</th>
                    <th>選手</th>
                  </tr>
                </thead>
                <tbody>
                  {c.entries.map((e, i) => (
                    <tr key={`${e.officialName}-${i}`}>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 700, whiteSpace: "nowrap", color: /王者/.test(e.rank) ? color : "var(--fg)" }}>
                        {/^\d+$/.test(e.rank) ? `${e.rank}位` : e.rank}
                      </td>
                      <td className="col-opponent">
                        {e.slug ? (
                          <a href={`/fighters/${e.slug}`} className="opponent-link">
                            {e.officialName}
                          </a>
                        ) : (
                          e.officialName
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
