/**
 * scripts/standup-pipeline/ingest_wikipedia.py の一部関数のTS移植(CI検証専用)。
 *
 * なぜ移植が必要か: /kickのWikipedia戦績取り込み(bouts_wikipedia.json生成)は
 * ingest_wikipedia.py(Python、scripts/standup-pipeline/)がオフラインで実行し、結果を
 * data/kick/bouts_wikipedia.json としてコミットする運用になっている。`npm run build` の
 * チェーン(package.jsonのbuildスクリプト)はNode/TSのみで完結する設計であり、Pythonを
 * ビルド依存に加えるとVercelのビルド環境でpython3が使えるとは限らない
 * (このリポジトリの「本番を落とさないこと」の方針に反するリスクを取らない)。
 *
 * そのため、PR-14(ネストしたテンプレート)・PR-21.5(wikitableセル属性による列ずれ)で
 * 実際に発生したバグの再発をNode/TSのテスト(scripts/test-kick-wikitext-*.ts)で
 * 検知できるよう、該当ロジックのみをここに複製する。
 *
 * ★注意: これはPython本体(ingest_wikipedia.py)を検査するものではない。Python側の
 * find_fight_cont_blocks / _strip_cell_attrs を変更した場合は、このファイルも手動で
 * 同期すること(自動同期の仕組みは無い)。
 */

// ingest_wikipedia.py の find_fight_cont_blocks() の移植。
// {{Fight-cont|...}}を、途中に現れるネストしたテンプレート("{{"の深さ)を数えて
// 正しく終端まで抽出する(PR-14: 旧実装は非貪欲マッチで最初の"}}"を閉じタグとみなしており、
// {{仮リンク|名前|en|英語名}}のようなネストがあると決着・大会名・日付が丸ごと空になっていた)。
const FIGHT_CONT_START_RE = /\{\{Fight-cont\s*\|/g;

export function findFightContBlocksMirror(wikitext: string): { start: number; content: string }[] {
  const blocks: { start: number; content: string }[] = [];
  const re = new RegExp(FIGHT_CONT_START_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const n = wikitext.length;
    while (i < n && depth > 0) {
      const two = wikitext.slice(i, i + 2);
      if (two === "{{") {
        depth += 1;
        i += 2;
      } else if (two === "}}") {
        depth -= 1;
        i += 2;
      } else {
        i += 1;
      }
    }
    const contentEnd = depth === 0 ? i - 2 : i;
    blocks.push({ start: m.index, content: wikitext.slice(m.index + m[0].length, contentEnd) });
  }
  return blocks;
}

// ingest_wikipedia.py の非貪欲マッチ版(PR-14修正前)の移植。回帰テストで
// 「新実装が旧実装と違う結果を返す(=修正が効いている)」ことを示すために使う。
export function findFightContBlocksLegacyBuggyMirror(wikitext: string): { start: number; content: string }[] {
  const blocks: { start: number; content: string }[] = [];
  const re = /\{\{Fight-cont\s*\|([\s\S]*?)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext))) {
    blocks.push({ start: m.index, content: m[1] });
  }
  return blocks;
}

// ingest_wikipedia.py の _strip_cell_attrs() の移植。
// PR-21.5(#559): wikitableのセル属性(align=left・style=...・colspan=N等)がFight-cont行の
// 引数として紛れ込むと、以降の全フィールドが1つずつ後ろにずれる(対戦相手欄にセル属性文字列が
// 入り、決着欄が相手名、大会名が決着、日付が大会名になる)。位置引数に数える前に取り除く。
const CELL_ATTR_RE = /^(align|style|colspan|rowspan|valign|class|width|bgcolor|cellpadding|cellspacing)\s*=/i;

export function stripCellAttrsMirror(parts: string[]): string[] {
  return parts.filter((p) => !CELL_ATTR_RE.test(p.trim()));
}
