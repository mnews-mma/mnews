import { fetchAllArticles } from "@/lib/feeds/aggregate";
import { fetchFirstSeenMap, enrichFirstSeen } from "@/lib/firstSeen";
import { diagnoseBreaking } from "@/lib/tweetDigest";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BREAKING診断 | Mニュース",
  robots: { index: false, follow: false },
};

export default async function BreakingDiagPage() {
  const [res, fsMap] = await Promise.all([
    fetchAllArticles().catch(() => null),
    fetchFirstSeenMap().catch(() => new Map<string, string>()),
  ]);
  const articles = res?.articles ?? [];
  const diag = diagnoseBreaking(enrichFirstSeen(articles, fsMap));

  return (
    <div style={{ padding: "32px 24px", maxWidth: 900 }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        BREAKING診断
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8, lineHeight: 1.7 }}>
        失効窓（検知から）: <b>{diag.windowH}h</b> ／ 公開上限: <b>{diag.maxPublishH}h</b> ／
        閾値: <b>{diag.threshold}</b> ／ フォールバック下限: <b>{diag.floor}</b> ／
        firstSeenAt登録: <b>{diag.candidates.filter((c) => c.hasFirstSeen).length}</b>/{diag.candidates.length}件
      </p>
      <p style={{ fontSize: 14, marginBottom: 20 }}>
        現在の選定:{" "}
        {diag.selectedTitle ? (
          <b style={{ color: "var(--accent)" }}>{diag.selectedTitle}</b>
        ) : (
          <span style={{ color: "var(--muted)" }}>なし（該当記事なし＝バー非表示）</span>
        )}
      </p>

      <div className="table-outer">
        <div className="table-scroll">
          <table className="result-table">
            <thead>
              <tr>
                <th>スコア</th>
                <th>公開</th>
                <th>検知</th>
                <th>fs</th>
                <th>状態</th>
                <th>タイトル</th>
              </tr>
            </thead>
            <tbody>
              {diag.candidates.slice(0, 25).map((c, i) => (
                <tr key={i} style={c.selected ? { background: "rgba(232,0,45,0.08)" } : undefined}>
                  <td style={{ fontFamily: "var(--mono)", textAlign: "center" }}>
                    {c.score === -999 ? "—" : c.score}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", textAlign: "center", fontSize: 12 }}>{c.publishedAgeH}h</td>
                  <td style={{ fontFamily: "var(--mono)", textAlign: "center", fontSize: 12 }}>{c.detectionAgeH}h</td>
                  <td style={{ textAlign: "center", fontSize: 12 }}>{c.hasFirstSeen ? "✓" : "—"}</td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap", color: c.reason === "候補" ? "#16a34a" : "var(--muted)" }}>
                    {c.selected ? "★選定" : c.reason}
                  </td>
                  <td style={{ fontSize: 12 }}>{c.title.slice(0, 44)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
