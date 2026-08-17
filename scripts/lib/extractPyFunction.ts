// PR-G(2026-08-17、修正2): Pythonファイルから特定のトップレベル関数のテキストだけを
// 抽出するユーティリティ。scripts/check-kick-wikitext-mirror-sync.ts が、
// scripts/standup-pipeline/ingest_wikipedia.py の特定関数が変更されたかどうかを
// ファイル全体ではなく関数単位で検知するために使う(ファイル全体のハッシュにすると、
// 対象外の変更(#563のような無関係な修正)のたびに毎回ゲートが落ちるノイズになるため)。
//
// 抽出方法: `def <name>(` で始まる行から、インデントが無い(=トップレベルの)次の非空行の
// 直前までを関数の本体とみなす(次のdef/classに限らず、トップレベルのコメント行が
// 挟まっていてもそこで区切る)。末尾の空行はハッシュの安定性のため除去する。
export function extractPyFunction(source: string, functionName: string): string | null {
  const lines = source.split("\n");
  const startRe = new RegExp(`^def\\s+${functionName}\\s*\\(`);
  const startIdx = lines.findIndex((l) => startRe.test(l));
  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue; // 空行はスキップして継続
    if (!/^\s/.test(line)) {
      // インデントの無い(トップレベルの)非空行に到達した = 関数の終わり
      endIdx = i;
      break;
    }
  }

  const body = lines.slice(startIdx, endIdx);
  while (body.length > 0 && body[body.length - 1].trim() === "") body.pop();
  return body.join("\n");
}
