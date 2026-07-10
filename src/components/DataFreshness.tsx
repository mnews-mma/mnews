// 戦績データの最終更新日表示。fighterRecordsMeta.json(バッチ実行時刻)から取得した
// 値のみを表示し、取得できない場合(初回デプロイ直後等)はこの要素ごと出さない
// (日付のハードコード・捏造はしない)。
export default function DataFreshness({ generatedAt }: { generatedAt: string | null }) {
  if (!generatedAt) return null;
  // JST日付表示(fighterRecordsCache.tsの他の日付表示と同じ+9h変換)。
  const jst = new Date(new Date(generatedAt).getTime() + 9 * 3600_000);
  const dateStr = jst.toISOString().slice(0, 10);
  return (
    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 6 }}>
      データ最終更新: {dateStr}
    </div>
  );
}
