import { ImageResponse } from "next/og";
import { loadOgFonts, OG_FONT_FAMILIES } from "@/lib/ogShared";

export const runtime = "edge";

// トップページ(サイト共通デフォルト)のOG画像。1200×630。
// 方針: 赤(#e8002d = サイトの --accent)を主役の"塊"として使い、
// 「Mニュース」ワードマークをキャンバスの6〜7割まで大きく置く。
// 団体名は各団体の実表記(RIZIN・DEEP・パンクラス・修斗)。
// ?variant=a|b|c で3案を出し分ける(レビュー用)。確定したら1案を静的PNG化する。

const RED = "#e8002d";
const SUMI = "#0E0D0C";
const WASHI = "#EDE6D6";
const ASH = "#8A8478";

const ORGS = ["RIZIN", "DEEP", "パンクラス", "修斗"];
const TAGLINE = "日本のMMA、ぜんぶここに。";

// 団体名を区切り文字(既定「・」)で並べる行。区切りの既定色は赤だが、赤地の上に
// 置く時は赤同士で消えるため sepColor で上書きする。sep で「/」等に変更可。
function OrgRow({
  size,
  gap,
  color,
  sep = "・",
  sepColor = RED,
}: {
  size: number;
  gap: number;
  color: string;
  sep?: string;
  sepColor?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {ORGS.map((o, i) => (
        <div key={o} style={{ display: "flex", alignItems: "center" }}>
          {i > 0 && (
            <div
              style={{
                display: "flex",
                width: `${gap}px`,
                justifyContent: "center",
                color: sepColor,
                fontFamily: "Noto Sans JP",
                fontWeight: 900,
                fontSize: `${size}px`,
              }}
            >
              {sep}
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontFamily: "Noto Sans JP",
              fontWeight: 900,
              fontSize: `${size}px`,
              color,
              letterSpacing: "1px",
            }}
          >
            {o}
          </div>
        </div>
      ))}
    </div>
  );
}

// 案A: 左に赤パネル+巨大M(ロゴの塊)、右にワードマーク+団体+タグライン
function VariantA() {
  return (
    <div style={{ width: "1200px", height: "630px", display: "flex", backgroundColor: SUMI }}>
      {/* 左: 赤の塊パネル */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "460px",
          height: "630px",
          backgroundColor: RED,
        }}
      >
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "400px", color: "#fff", lineHeight: 1 }}>
          M
        </div>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "56px", color: "#fff", letterSpacing: "14px", marginTop: "-8px", paddingLeft: "14px" }}>
          ニュース
        </div>
      </div>
      {/* 右: テキスト */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 64px" }}>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "112px", color: WASHI, lineHeight: 1.05 }}>
          Mニュース
        </div>
        <div style={{ display: "flex", width: "120px", height: "10px", backgroundColor: RED, margin: "26px 0 30px" }} />
        <OrgRow size={44} gap={30} color={WASHI} />
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "30px", color: ASH, marginTop: "34px" }}>
          {TAGLINE}
        </div>
      </div>
    </div>
  );
}

// 案B: 赤M+白ニュースの特大ワードマーク、下辺フルワイド赤帯に団体名
function VariantB() {
  return (
    <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", backgroundColor: SUMI }}>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", padding: "0 80px" }}>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "24px", color: ASH, letterSpacing: "6px", marginBottom: "18px" }}>
          日本のMMA速報・戦績データベース
        </div>
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "230px", color: RED, lineHeight: 0.9 }}>
            M
          </div>
          <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "170px", color: WASHI, lineHeight: 0.9, letterSpacing: "4px" }}>
            ニュース
          </div>
        </div>
      </div>
      {/* 下辺: 赤帯 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "130px", backgroundColor: RED }}>
        <OrgRow size={52} gap={30} color="#fff" sepColor="rgba(255,255,255,0.6)" />
      </div>
    </div>
  );
}

// 案C(確定): トップページ同様の赤地(#e8002d)に白。エディトリアル構図。
// 白の太いルール、団体名は「/」区切り。
function VariantC() {
  return (
    <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", justifyContent: "center", backgroundColor: RED, padding: "0 90px" }}>
      <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "26px", color: "rgba(255,255,255,0.82)", letterSpacing: "8px", marginBottom: "22px" }}>
        {TAGLINE}
      </div>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "200px", color: "#fff", lineHeight: 0.9 }}>
          M
        </div>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "168px", color: "#fff", lineHeight: 0.9, letterSpacing: "4px" }}>
          ニュース
        </div>
      </div>
      <div style={{ display: "flex", width: "560px", height: "12px", backgroundColor: "#fff", margin: "30px 0 34px" }} />
      <OrgRow size={50} gap={40} color="#fff" sep="/" sepColor="rgba(255,255,255,0.72)" />
    </div>
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const variant = (searchParams.get("variant") || "c").toLowerCase();
  const fonts = await loadOgFonts();
  const node = variant === "b" ? <VariantB /> : variant === "c" ? <VariantC /> : <VariantA />;
  return new ImageResponse(node, { width: 1200, height: 630, fonts: OG_FONT_FAMILIES(fonts) });
}
