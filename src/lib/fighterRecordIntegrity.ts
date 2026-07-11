// data/fighterRecords.json の内部整合性チェック(共通ロジック)。
// バッチ(scripts/update-fighter-records.ts)実行後の検知ログと、
// デプロイ前ゲート(scripts/check-fighter-records-integrity.ts)の両方から
// 同じ判定基準を使う(判定ロジックの二重定義を避ける)。
//
// 「集計値(wins/losses/draws・ko/sub/decision)」と「historyを再集計した内訳」の
// 不一致には2種類ある:
// - 論理破綻(fatal): 勝ちの決着内訳合計(ko+sub+decision)がwinsを超える等、
//   物理的にあり得ない状態。ya-man案件(手動編集とバッチ更新の取りこぼしマージで
//   wins=2なのにko+sub+decision=4になった)はこれに該当。デプロイをブロックする。
// - 非破綻の不一致(warning): stored(infobox由来)とhistory再集計の件数が
//   合わないが、どちらも単体では矛盾していない(=一次ソースでの確認が必要な
//   ケース。クレベル・コイケ型のhistory欠損や、佐藤将光・所英男のような保留中
//   ケースがこれに該当)。デプロイは止めず、警告ログ+保留リストに残す。
export interface FighterRecordIntegrityInput {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  sub: number;
  decision: number;
  history: { result: "win" | "loss" | "draw" | "nc" }[];
}

export interface IntegrityIssue {
  slug: string;
  nameJa: string;
  severity: "fatal" | "warning";
  message: string;
}

export function checkFighterRecordIntegrity(
  slug: string,
  nameJa: string,
  entry: FighterRecordIntegrityInput
): IntegrityIssue | null {
  // 負数は物理的にあり得ない(データ破損)。
  const numericFields: [string, number][] = [
    ["wins", entry.wins],
    ["losses", entry.losses],
    ["draws", entry.draws],
    ["ko", entry.ko],
    ["sub", entry.sub],
    ["decision", entry.decision],
  ];
  const negative = numericFields.filter(([, v]) => v < 0);
  if (negative.length > 0) {
    return {
      slug,
      nameJa,
      severity: "fatal",
      message: `負数を検出: ${negative.map(([k, v]) => `${k}=${v}`).join(", ")}`,
    };
  }

  // 勝ちの決着内訳合計(ko+sub+decision)がwinsを超えるのは物理的にあり得ない
  // (「その他」を除いても超過している時点で破綻。「その他」を含めればwins以下に
  // 収まるのは正常、ko+sub+decisionだけでwinsを超えるのは異常)。
  const koSubDec = entry.ko + entry.sub + entry.decision;
  if (koSubDec > entry.wins) {
    return {
      slug,
      nameJa,
      severity: "fatal",
      message: `勝ちの決着内訳合計(ko${entry.ko}+sub${entry.sub}+decision${entry.decision}=${koSubDec})がwins(${entry.wins})を超過`,
    };
  }

  // historyが空(集計値のみ持つ記事。例: 住村竜市朗)は既知の正常状態のため対象外。
  if (entry.history.length === 0) return null;

  const hw = entry.history.filter((h) => h.result === "win").length;
  const hl = entry.history.filter((h) => h.result === "loss").length;
  const hd = entry.history.filter((h) => h.result === "draw").length;

  // history再集計側でも同じ超過チェック(念のため二重に見る。上のstored側チェックを
  // すり抜けるケースがあれば、こちらで拾う)。
  if (hw < 0 || hl < 0 || hd < 0) {
    return { slug, nameJa, severity: "fatal", message: "history内訳が負数(データ破損)" };
  }

  if (hw === entry.wins && hl === entry.losses && hd === entry.draws) return null;

  return {
    slug,
    nameJa,
    severity: "warning",
    message: `集計(${entry.wins}-${entry.losses}-${entry.draws}) vs history内訳(${hw}-${hl}-${hd})`,
  };
}
