import AdminBackLink from "@/components/AdminBackLink";
import {
  fetchScheduleDiff,
  type ScheduleDiffASection,
  type ScheduleDiffBSection,
  type ScheduleDiffEventRef,
} from "../_lib/scheduleDiffIssue";

export const metadata = {
  title: "大会日程 差分チェック | Mニュース",
  robots: { index: false, follow: false },
};

// Issue取得自体(GitHub Issues API呼び出し)は_lib側でrevalidateされるため、
// ページ側は毎リクエストSSRでよい(他のadminツールと同じ規約)。
export const dynamic = "force-dynamic";

function formatJst(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function EventLinks({ slug, sourceUrl }: { slug: string | null; sourceUrl: string | null }) {
  return (
    <span style={{ fontSize: 12, marginLeft: 8 }}>
      {slug && (
        <a href={`/events/${slug}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", marginRight: 8 }}>
          大会ページ
        </a>
      )}
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--muted)" }}>
          公式
        </a>
      )}
    </span>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>{children}</div>
  );
}

function ASectionRow({ item }: { item: ScheduleDiffASection }) {
  switch (item.kind) {
    case "event_missing":
      return (
        <Row>
          <strong>未掲載</strong>: {item.eventName}({item.date ?? "日付不明"}, {item.venue ?? "会場不明"})
          <EventLinks slug={item.slug} sourceUrl={item.sourceUrl} />
        </Row>
      );
    case "event_unconfirmed":
      return (
        <Row>
          {item.fetchFailure ? "取得失敗のため未確認" : "公式で確認できず"}: {item.eventName}({item.date})
          <EventLinks slug={item.slug} sourceUrl={item.sourceUrl} />
          {item.cancelMention && (
            <div style={{ color: "var(--warn, #b45309)", fontSize: 12, marginTop: 2 }}>
              公式の他記事に「延期」または「中止」の言及あり、要確認
            </div>
          )}
        </Row>
      );
    case "date_change":
      return (
        <Row>
          <strong>変更疑い(日付)</strong>: {item.eventName} events.ts={item.localDate} ⇔ 公式={item.officialDate}
          <EventLinks slug={item.slug} sourceUrl={item.sourceUrl} />
        </Row>
      );
    case "venue_change":
      return (
        <Row>
          <strong>変更疑い(会場)</strong>: {item.eventName} events.ts={item.localVenue ?? "未設定"} ⇔ 公式={item.officialVenue ?? "不明"}
          <EventLinks slug={item.slug} sourceUrl={item.sourceUrl} />
        </Row>
      );
  }
}

function BSectionCard({ entry }: { entry: ScheduleDiffBSection }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        [{entry.orgLabel}] {entry.eventName}
        <EventLinks slug={entry.slug} sourceUrl={entry.sourceUrl} />
      </div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
        {entry.items.map((it, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {it.kind === "missing_on_local" && (
              <>
                <strong>未掲載</strong>: {it.weightClass ?? ""} {it.fighterA} vs {it.fighterB}
              </>
            )}
            {it.kind === "missing_on_official" && (
              <>
                公式カードで確認できず: {it.weightClass ?? ""} {it.fighterA} vs {it.fighterB}
                {it.cancelMention && (
                  <span style={{ color: "var(--warn, #b45309)" }}>(本文に「延期」または「中止」の言及あり、要確認)</span>
                )}
              </>
            )}
            {it.kind === "opponent_change" && (
              <>
                <strong>対戦相手変更疑い</strong>: events.ts「{it.localFighterA} vs {it.localFighterB}」⇔ 公式「
                {it.officialFighterA} vs {it.officialFighterB}」
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CSectionRow({ item }: { item: ScheduleDiffEventRef }) {
  return (
    <Row>
      [{item.orgLabel}] {item.eventName}: 対戦カードの並び順が公式と異なる(対戦相手ペア自体は一致)
      <EventLinks slug={item.slug} sourceUrl={item.sourceUrl} />
    </Row>
  );
}

export default async function ScheduleDiffPage() {
  const result = await fetchScheduleDiff();

  return (
    <div style={{ padding: "40px 24px", maxWidth: "760px" }}>
      <AdminBackLink />
      <h1 style={{ fontFamily: "var(--os)", fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
        大会日程 差分チェック
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
        RIZIN/修斗/パンクラス/DEEP公式サイトと events.ts の突き合わせ結果(Issue #446、毎日JST6:00自動更新)。
      </p>

      {result.status === "fetch_error" && (
        <div style={{ border: "1px solid #dc2626", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13 }}>
          GitHub APIの取得に失敗しました: {result.message}
        </div>
      )}

      {result.status === "no_diff" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13 }}>
          差分なし。
          {result.lastCheckedAt ? ` 最終確認: ${formatJst(result.lastCheckedAt)}(JST)` : " (まだ実行履歴がありません)"}
          {result.issueUrl && (
            <>
              {" "}
              <a href={result.issueUrl} target="_blank" rel="noreferrer" style={{ color: "var(--muted)" }}>
                Issueを見る
              </a>
            </>
          )}
        </div>
      )}

      {result.status === "parse_error" && (
        <div style={{ border: "1px solid #d97706", background: "#fffbeb", color: "#92400e", borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13 }}>
          Issue本文から構造化データ(JSON)を読み取れませんでした。旧フォーマットのIssue、または本文の破損の可能性があります。
          <a href={result.issueUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: "var(--muted)" }}>
            Issue本文を直接確認
          </a>
          (最終更新: {formatJst(result.updatedAt)} JST)
        </div>
      )}

      {result.status === "diff" && (
        <>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
            検出日時: {formatJst(result.data.detectedAtUtc)}(JST) / 差分{result.data.diffCount}件
            <a href={result.issueUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: "var(--muted)" }}>
              Issueを見る
            </a>
          </div>

          {result.data.fetchErrorCount > 0 && (
            <div style={{ border: "1px solid #dc2626", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13 }}>
              <strong>取得エラー({result.data.fetchErrorCount}件、該当団体はスキップして継続)</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {result.data.fetchErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8 }}>A: 大会単位</h2>
          {result.data.a.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>差分なし</p>
          ) : (
            result.data.a.map((item, i) => <ASectionRow key={i} item={item} />)
          )}

          <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 8 }}>B: カード単位(高/中信頼度)</h2>
          {result.data.b.filter((e) => e.confidence !== "low").length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>差分なし</p>
          ) : (
            result.data.b.filter((e) => e.confidence !== "low").map((entry, i) => <BSectionCard key={i} entry={entry} />)
          )}

          <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 4 }}>
            B: カード単位 — 参考情報(修斗/確度低)
          </h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            本文の自由記述からの推定のため誤検知の可能性がある。参考情報として扱うこと。
          </p>
          {result.data.b.filter((e) => e.confidence === "low").length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>差分なし</p>
          ) : (
            result.data.b.filter((e) => e.confidence === "low").map((entry, i) => <BSectionCard key={i} entry={entry} />)
          )}

          <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 4 }}>C: バウトオーダー</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            対戦相手ペアは一致、順序のみ差分。暫定順で登録している大会があるため参考情報。
          </p>
          {result.data.c.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>差分なし</p>
          ) : (
            result.data.c.map((item, i) => <CSectionRow key={i} item={item} />)
          )}
        </>
      )}
    </div>
  );
}
