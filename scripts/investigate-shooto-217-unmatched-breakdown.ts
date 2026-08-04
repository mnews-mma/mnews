// 指示書I: #423で未特定だった217名(216 unmatched + 1 ambiguous)の内訳を
// 実データで切り分ける。追加fetchは行わない(read-only、既存の取得済み
// データのみで完結):
// - out/shooto-crossorg-listing-raw.json(修斗公式選手一覧1,909行、#423で取得済み)
// - data/shootoRecords.json + data/shootoProfileBouts.json(大会結果ページ由来、
//   対戦相手名として出現する選手も含む)
//
// 分類:
// A. 一覧に正規化ゆらぎ(異体字/表記ゆれ)で近似ヒットする(距離1-2)
// B. 一覧には無いが、data/shootoRecords.json等の対戦相手名としては出現する
//    (=大会結果ページ経由では捕捉されている、一覧ページの収録範囲が限定的)
// C. 一覧・大会結果ページのいずれにも見当たらない
// D. 名寄せ軸(aliases)で一覧に一致する追加候補
//
// 実行: npx tsx scripts/investigate-shooto-217-unmatched-breakdown.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { normalize as bfNormalize, levenshtein } from "./lib/fighterNameBackfill";

interface ListingRow {
  id: string;
  siteNameJa: string;
  siteNameEn: string;
  gym: string;
  lastDate: string;
  weightClass: string;
}

// ローマ字表記の正規化: 大文字化+空白除去。FIGHTERS.nameEnは"Given Surname"順、
// 修斗公式一覧のsiteNameEnは"Given Surname"/全角大文字("KOYURU TANOUE")等
// 表記が揺れているため、語順入れ替え版も候補に含めて突合する。
function romajiVariants(name: string): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const plain = words.join("").toUpperCase();
  const reversed = [...words].reverse().join("").toUpperCase();
  return [...new Set([plain, reversed])];
}

interface IdMatch {
  slug: string;
  nameJa: string;
  org: string;
  matched: boolean;
  ambiguous: boolean;
  highCollisionRisk: boolean;
  matchAxis: string | null;
  matchedRaw: string | null;
  id: string | null;
  siteNameJa: string | null;
  ambiguousIds: string[];
}

function isHighCollisionRiskName(name: string): boolean {
  return bfNormalize(name).length <= 3;
}

function main() {
  const listing: ListingRow[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "out", "shooto-crossorg-listing-raw.json"), "utf8"));
  const idMatches: IdMatch[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "out", "shooto-crossorg-id-matches.json"), "utf8"));

  const shootoArchive = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoRecords.json"), "utf8"));
  const shootoProfile = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoProfileBouts.json"), "utf8"));
  const shootoEvents = [...shootoArchive, ...shootoProfile];

  // 大会結果ページ由来の全対戦相手名(正規化済み) -> 生表記の集合
  const boutOpponentNames = new Map<string, Set<string>>(); // norm -> raw[]
  for (const ev of shootoEvents) {
    for (const b of ev.bouts) {
      for (const raw of [b.fighterAName, b.fighterBName]) {
        if (!raw) continue;
        const norm = bfNormalize(raw);
        if (!norm) continue;
        const set = boutOpponentNames.get(norm) ?? new Set<string>();
        set.add(raw);
        boutOpponentNames.set(norm, set);
      }
    }
  }

  const listingNorms = listing.map((r) => ({ row: r, norm: bfNormalize(r.siteNameJa) }));
  // ローマ字表記 -> 一覧行(複数語順候補を全て登録)
  const romajiIndex = new Map<string, ListingRow>();
  for (const row of listing) {
    if (!row.siteNameEn.trim()) continue;
    for (const v of romajiVariants(row.siteNameEn)) {
      if (!romajiIndex.has(v)) romajiIndex.set(v, row);
    }
  }

  const targets = idMatches.filter((m) => !m.matched); // unmatched(216) + ambiguous(1) = 217

  interface Result {
    slug: string;
    nameJa: string;
    org: string;
    highCollisionRisk: boolean;
    category: "E_romaji_hit" | "A_near_miss_listing" | "B_bout_opponent_only" | "C_not_found_anywhere" | "D_alias_axis_hit";
    detail: string;
  }

  const results: Result[] = [];

  for (const t of targets) {
    const fighter = FIGHTERS.find((f) => f.slug === t.slug);
    const namesToTry = [t.nameJa, ...((fighter?.aliases as string[] | undefined) ?? [])];
    const highCollisionRisk = isHighCollisionRiskName(t.nameJa);

    // E: ローマ字表記(FIGHTERS.nameEn vs 一覧のsiteNameEn)の完全一致。
    // #423の当初実装はsiteNameJa(日本語)のみを見ておりこの軸を試していなかった
    // (R-7が謳っていた「ローマ字表記との完全一致」を#423は実際には使っていなかった)。
    if (fighter?.nameEn) {
      let romajiHit: ListingRow | null = null;
      for (const v of romajiVariants(fighter.nameEn)) {
        const hit = romajiIndex.get(v);
        if (hit) {
          romajiHit = hit;
          break;
        }
      }
      if (romajiHit) {
        results.push({
          slug: t.slug,
          nameJa: t.nameJa,
          org: t.org,
          highCollisionRisk,
          category: "E_romaji_hit",
          detail: `nameEn「${fighter.nameEn}」が一覧の「${romajiHit.siteNameEn}」(${romajiHit.siteNameJa}, id=${romajiHit.id})に一致`,
        });
        continue;
      }
    }

    // D: alias軸で一覧に一致(#423のスクリプトは既にaliasesも試しているはずだが、
    // ambiguous(kintaro等)はalias経路をスキップしていた可能性があるため再確認)
    let aliasHit: { alias: string; siteNameJa: string } | null = null;
    for (const alias of (fighter?.aliases as string[] | undefined) ?? []) {
      const aliasNorm = bfNormalize(alias);
      const hit = listingNorms.find((l) => l.norm === aliasNorm);
      if (hit) {
        aliasHit = { alias, siteNameJa: hit.row.siteNameJa };
        break;
      }
    }
    if (aliasHit) {
      results.push({
        slug: t.slug,
        nameJa: t.nameJa,
        org: t.org,
        highCollisionRisk,
        category: "D_alias_axis_hit",
        detail: `alias「${aliasHit.alias}」が一覧の「${aliasHit.siteNameJa}」に一致`,
      });
      continue;
    }

    // A: 距離1の近似ヒットのみ(一覧内)。実測の結果、距離2まで許容すると
    // 姓名4-6文字程度の日本語名では完全な別人同士がほぼ確実に距離2圏内に
    // 入ってしまい(例: 「朝倉海」⇔「朝日昇」)ノイズにしかならないと判明した
    // ため、距離1(1文字違い)のみを候補とする。短い名前(4文字以下)は
    // 距離1でも別人の可能性が高いため除外(既存の近似候補抑制方針を踏襲)。
    const norm = bfNormalize(t.nameJa);
    let nearMiss: { siteNameJa: string; distance: number } | null = null;
    if (norm && norm.length > 4) {
      for (const l of listingNorms) {
        if (Math.abs(l.norm.length - norm.length) > 1) continue;
        const dist = levenshtein(norm, l.norm);
        if (dist === 1) {
          nearMiss = { siteNameJa: l.row.siteNameJa, distance: dist };
          break;
        }
      }
    }
    if (nearMiss) {
      results.push({
        slug: t.slug,
        nameJa: t.nameJa,
        org: t.org,
        highCollisionRisk,
        category: "A_near_miss_listing",
        detail: `一覧の「${nearMiss.siteNameJa}」と編集距離${nearMiss.distance}`,
      });
      continue;
    }

    // B: 一覧には無いが大会結果ページの対戦相手名としては出現する
    let boutHit: string | null = null;
    for (const n of namesToTry) {
      const key = bfNormalize(n);
      if (key && boutOpponentNames.has(key)) {
        boutHit = [...boutOpponentNames.get(key)!][0];
        break;
      }
    }
    if (boutHit) {
      results.push({
        slug: t.slug,
        nameJa: t.nameJa,
        org: t.org,
        highCollisionRisk,
        category: "B_bout_opponent_only",
        detail: `data/shootoRecords.jsonの対戦相手名「${boutHit}」として出現`,
      });
      continue;
    }

    // C: どちらにも見当たらない
    results.push({
      slug: t.slug,
      nameJa: t.nameJa,
      org: t.org,
      highCollisionRisk,
      category: "C_not_found_anywhere",
      detail: "一覧・大会結果ページのいずれにも見当たらない",
    });
  }

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.category] = (counts[r.category] ?? 0) + 1;

  console.log(`対象(217名相当): ${targets.length}`);
  console.log("内訳:", JSON.stringify(counts, null, 2));

  const highRiskInE = results.filter((r) => r.category === "E_romaji_hit" && r.highCollisionRisk).length;
  const highRiskInB = results.filter((r) => r.category === "B_bout_opponent_only" && r.highCollisionRisk).length;
  const highRiskInA = results.filter((r) => r.category === "A_near_miss_listing" && r.highCollisionRisk).length;
  console.log(`E(ローマ字一致)のうち要裏取り(高衝突リスク): ${highRiskInE}`);
  console.log(`B(追加監査候補)のうち要裏取り(高衝突リスク): ${highRiskInB}`);
  console.log(`A(近似ヒット)のうち要裏取り(高衝突リスク): ${highRiskInA}`);

  console.log("\n=== E: ローマ字表記一致(全件) ===");
  for (const r of results.filter((x) => x.category === "E_romaji_hit")) {
    console.log(`${r.slug} (${r.nameJa}, ${r.org}${r.highCollisionRisk ? ", 要裏取り" : ""}): ${r.detail}`);
  }
  console.log("\n=== A: 近似ヒット(距離1のみ、要個別裏取り) ===");
  for (const r of results.filter((x) => x.category === "A_near_miss_listing")) {
    console.log(`${r.slug} (${r.nameJa}, ${r.org}${r.highCollisionRisk ? ", 要裏取り" : ""}): ${r.detail}`);
  }
  console.log("\n=== D: alias軸ヒット ===");
  for (const r of results.filter((x) => x.category === "D_alias_axis_hit")) {
    console.log(`${r.slug} (${r.nameJa}, ${r.org}): ${r.detail}`);
  }
  console.log("\n=== B: 大会結果ページのみ出現(全件) ===");
  for (const r of results.filter((x) => x.category === "B_bout_opponent_only")) {
    console.log(`${r.slug} (${r.nameJa}, ${r.org}${r.highCollisionRisk ? ", 要裏取り" : ""}): ${r.detail}`);
  }

  fs.writeFileSync(
    path.join(process.cwd(), "out", "shooto-217-unmatched-breakdown.json"),
    JSON.stringify({ counts, highRiskInB, highRiskInA, results }, null, 2) + "\n"
  );
  console.log("\n書き出し: out/shooto-217-unmatched-breakdown.json");
}

main();
