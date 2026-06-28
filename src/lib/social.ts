import { SourceKey } from "./sources";

// X（Twitter）は公式APIが無いと最新投稿を安定取得できないため、
// 今回はプロフィールへのリンクのみを表示する。
export const X_PROFILES: { org: SourceKey; orgLabel: string; url: string }[] = [
  { org: "rizin", orgLabel: "RIZIN", url: "https://x.com/rizin_PR" },
  { org: "deep", orgLabel: "DEEP", url: "https://x.com/jewels_deep" },
  { org: "shooto", orgLabel: "修斗", url: "https://x.com/xshooto" },
];
