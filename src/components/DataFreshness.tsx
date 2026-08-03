// 戦績データの最終取得日表示。fighterRecordsMeta.json(バッチ実行時刻)から取得した
// 値のみを表示し、取得できない場合(初回デプロイ直後等)はこの要素ごと出さない
// (日付のハードコード・捏造はしない)。
// 「最終更新」ではなく「最終取得」とする(2026-08-03): バッチはWikipedia等を
// 毎回取り直すが、内容が変わらない日もある。「更新」だと内容が変わっていない
// 日にも「更新した」と言うことになり捏造ゼロの原則に反する。
export default function DataFreshness({ generatedAt }: { generatedAt: string | null }) {
  if (!generatedAt) return null;
  // JST日付表示(fighterRecordsCache.tsの他の日付表示と同じ+9h変換)。
  const jst = new Date(new Date(generatedAt).getTime() + 9 * 3600_000);
  const dateStr = jst.toISOString().slice(0, 10);
  return (
    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 6 }}>
      データ最終取得: {dateStr}
    </div>
  );
}
