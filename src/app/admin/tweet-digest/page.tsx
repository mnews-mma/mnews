import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { fetchRawArticles } from "@/lib/feeds/aggregate";
import { buildTweetDigest, buildNewsPost, fullWidthLength } from "@/lib/tweetDigest";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "X投稿用テキスト確認 | Mニュース",
  robots: { index: false, follow: false },
};

export default async function TweetDigestPreviewPage() {
  const { articles } = await fetchRawArticles();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = articles
    .filter((a) => new Date(a.publishedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const digest = buildTweetDigest(recent);

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">X投稿用テキスト確認</div>
        <div className="page-sub">過去24時間の記事 {recent.length}件から自動生成（毎朝のX投稿用フォーマット）</div>
      </div>
      <div style={{ padding: "0 24px 40px" }}>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "var(--mono)",
            fontSize: 13,
            background: "var(--s2)",
            padding: 20,
            border: "1px solid var(--border)",
            userSelect: "all",
          }}
        >
          {digest.text}
        </pre>

        <h3 style={{ fontSize: 13, marginTop: 32, fontFamily: "var(--mono)", letterSpacing: 1 }}>
          選定された上位{digest.topNews.length}件
        </h3>
        <ul style={{ fontSize: 13, lineHeight: 1.8 }}>
          {digest.topNews.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                {a.title}
              </a>
            </li>
          ))}
        </ul>

        <h3 style={{ fontSize: 13, marginTop: 32, fontFamily: "var(--mono)", letterSpacing: 1 }}>
          個別投稿用（短縮版・直近{Math.min(recent.length, 5)}件）
        </h3>
        <div className="page-sub" style={{ marginBottom: 12 }}>
          1ニュース＝1投稿。全角100字以内目安・【ラベル】+要約1文+リンク+ハッシュタグ（最大2個）
        </div>
        {recent.slice(0, 5).map((a) => {
          const post = buildNewsPost(a);
          return (
            <div key={a.id} style={{ marginBottom: 16 }}>
              <div className="page-sub" style={{ fontSize: 11, marginBottom: 4 }}>
                全角{Math.round(fullWidthLength(post))}字
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  background: "var(--s2)",
                  padding: 14,
                  border: "1px solid var(--border)",
                  userSelect: "all",
                }}
              >
                {post}
              </pre>
            </div>
          );
        })}
      </div>
      <Footer />
    </>
  );
}
