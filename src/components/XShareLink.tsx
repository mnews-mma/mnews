import type { CSSProperties, ReactNode } from "react";
import { buildXIntentUrl } from "@/lib/xShare";

// ユーザー向けXシェア導線の共通<a>コンポーネント。target=_blank/relを
// ここに集約することで、遷移方式(アプリ優先ロジック)を1箇所修正すれば
// 全シェア導線に反映される構造にする。見た目はサーバーコンポーネントからも
// 使えるよう<a>のみで完結させ、クライアント状態は持たない。
export default function XShareLink({
  text,
  url,
  children,
  style,
  className,
}: {
  text?: string;
  url: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <a
      href={buildXIntentUrl({ text, url })}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
