export type SourceKey =
  | "rizin"
  | "ufc"
  | "shooto"
  | "deep"
  | "pancrase"
  | "one"
  | "other"
  | "gonkaku"
  | "mmaplanet"
  | "efight";

export interface SourceDef {
  key: SourceKey;
  label: string;
  color: string;
  type: "official" | "media";
  url: string;
}

export const SOURCES: Record<SourceKey, SourceDef> = {
  rizin: { key: "rizin", label: "RIZIN", color: "#E8002D", type: "official", url: "https://rizin-ff.com" },
  ufc: { key: "ufc", label: "UFC", color: "#B8860B", type: "official", url: "https://jp.ufc.com" },
  shooto: { key: "shooto", label: "修斗", color: "#1266B3", type: "official", url: "https://shooto.co.jp" },
  deep: { key: "deep", label: "DEEP", color: "#E8710C", type: "official", url: "https://deep2001.com" },
  pancrase: { key: "pancrase", label: "パンクラス", color: "#1A1A1A", type: "official", url: "https://pancrase.co.jp" },
  // Display-only source kept for visual parity with mnews.html; not in the spec's scrape list.
  one: { key: "one", label: "ONE", color: "#059669", type: "official", url: "https://www.onefc.com" },
  other: { key: "other", label: "その他", color: "#999999", type: "media", url: "#" },
  gonkaku: { key: "gonkaku", label: "ゴング格闘技", color: "#555555", type: "media", url: "https://gonkaku.jp" },
  mmaplanet: { key: "mmaplanet", label: "MMAPLANET", color: "#888888", type: "media", url: "https://mmaplanet.jp" },
  efight: { key: "efight", label: "イーファイト", color: "#059669", type: "media", url: "https://efight.jp" },
};

export const SOURCE_LIST = Object.values(SOURCES);
