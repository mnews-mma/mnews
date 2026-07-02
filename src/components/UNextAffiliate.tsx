/**
 * U-NEXT アフィリエイトリンクコンポーネント
 *
 * - UNEXT_AFFILIATE_URL 環境変数が設定されていない場合は何も表示しない
 * - rel="sponsored nofollow" で広告リンクであることを明示
 * - PR 表記を含むことで景品表示法・ASA ガイドライン対応
 *
 * 使用方法:
 *   import UNextAffiliate from "@/components/UNextAffiliate";
 *   <UNextAffiliate />                   // デフォルトテキスト
 *   <UNextAffiliate label="U-NEXTで見る" /> // カスタムラベル
 */

interface Props {
  label?: string;
}

export default function UNextAffiliate({ label = "U-NEXTで視聴する" }: Props) {
  const url = process.env.UNEXT_AFFILIATE_URL;
  if (!url) return null;

  return (
    <div className="event-affiliate">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer sponsored nofollow"
        className="event-affiliate-btn"
      >
        {label}
        <span className="event-affiliate-pr">PR</span>
      </a>
      <p className="event-affiliate-disc">
        ※このリンクはアフィリエイトリンクです。リンク経由でご契約いただくと当サイトに報酬が発生する場合があります。
      </p>
    </div>
  );
}
