// @vercel/og(satori)にはDOMが無く、描画中に幅を測れない。
// そのため描画前に、折り返し行とフォントサイズを確定させる。

export type FitOpts = {
  maxWidth: number; // 名前ゾーンの幅(px / 1200x630座標系)
  maxHeight: number; // 名前ゾーンの高さ(px)
  maxFont: number; // 上限フォント(px)
  minFont: number; // 下限フォント(px)
  lineHeight?: number; // 行間倍率(既定 1.05)
  maxLines?: number; // 最大行数(既定 2)
  safety?: number; // 幅の安全係数(既定 0.96 / 近似幅の誤差吸収)
};

// 1文字の概算幅(em)。全角=1.0、ASCII=0.55、半角空白=0.3、全角空白=1.0
function charEm(ch: string): number {
  if (ch === " ") return 0.3;
  if (ch === "　") return 1.0;
  const code = ch.codePointAt(0)!;
  return code < 0x100 ? 0.55 : 1.0;
}
function strEm(s: string): number {
  let w = 0;
  for (const ch of s) w += charEm(ch);
  return w;
}

// 「・」の"後ろ"でだけ改行できるよう、・を前の単位に付けて分割。
// 各単位の内部では絶対に折らない（＝カタカナ途中割れ防止）。
function toUnits(name: string): string[] {
  const parts = name.split("・");
  return parts
    .map((p, i) => (i < parts.length - 1 ? p + "・" : p))
    .filter((u) => u.length > 0);
}

// 単位を貪欲に行へ詰める
function pack(units: string[], maxEm: number): string[] {
  const lines: string[] = [];
  let cur = "";
  let curEm = 0;
  for (const u of units) {
    const w = strEm(u);
    if (cur && curEm + w > maxEm) {
      lines.push(cur);
      cur = u;
      curEm = w;
    } else {
      cur += u;
      curEm += w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function fitName(
  name: string,
  o: FitOpts
): { fontSize: number; lines: string[] } {
  const lineHeight = o.lineHeight ?? 1.05;
  const maxLines = o.maxLines ?? 2;
  const safety = o.safety ?? 0.96;
  const units = toUnits(name);

  for (let size = o.maxFont; size >= o.minFont; size--) {
    const maxEm = (o.maxWidth * safety) / size;
    const lines = pack(units, maxEm);
    const widthOk = lines.every((l) => strEm(l) <= maxEm);
    const heightOk = lines.length * size * lineHeight <= o.maxHeight;
    if (widthOk && heightOk && lines.length <= maxLines) {
      return { fontSize: size, lines };
    }
  }
  // ここまでで(縮小しても)maxLines以内に収まる組み合わせが無かった場合
  // (極端に長い名前)。minFontでpackした上でmaxLinesを超えるぶんは
  // 打ち切る(3行目以降は表示しない)。呼び出し側の固定高name-zoneに
  // overflow:hiddenを併用することで、万一の幅超過も含め固定高から
  // 確実にはみ出さないようにする(2026-07-18・3行名対策)。
  const maxEm = (o.maxWidth * safety) / o.minFont;
  return { fontSize: o.minFont, lines: pack(units, maxEm).slice(0, maxLines) };
}
