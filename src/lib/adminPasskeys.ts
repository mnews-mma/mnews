import storedPasskeys from "../../data/adminPasskeys.json";

// /admin のパスキー（WebAuthn）認証。
//
// 保存するのは公開鍵のみで、秘密鍵は端末のSecure Enclave等から出ない。
// そのため data/adminPasskeys.json が公開リポジトリ上で誰でも読めても、
// それだけではログインできない（認証には端末内の秘密鍵が必須）。
//
// counter（署名回数）は本来リプレイ検知のため更新保存すべき値だが、
// Vercelのファイルシステムは実行時に書き込めないため保存しない。
// iCloudキーチェーン等で同期される「マルチデバイス対応パスキー」は
// 仕様上 counter が常に0で増加しないため、実質的な検知能力は元々無い。
// counter を 0 のまま扱うと SimpleWebAuthn は counter 検証をスキップする。

export type StoredPasskey = {
  /** Base64URL形式のcredential ID */
  id: string;
  /** Base64URL形式のCOSE公開鍵 */
  publicKey: string;
  counter: number;
  transports?: string[];
  /** 人間が識別するためのラベル（例: iPhone） */
  label: string;
  /** 登録日（YYYY-MM-DD） */
  addedAt: string;
};

export const RP_NAME = "Mニュース 管理画面";

/** 登録済みパスキー一覧 */
export function getStoredPasskeys(): StoredPasskey[] {
  return storedPasskeys as StoredPasskey[];
}

export type RpContext = { rpID: string; origin: string };

// パスキーは「どのドメインで登録したか」に紐づくため、許可するoriginと
// RP IDを固定する。RP IDを mnews.jp にしておくと www 有無の両方で同じ
// パスキーが使える。Vercelのプレビュー環境は別ドメインになるため対象外
// （プレビューでは従来どおり ?token= でログインする）。
const ORIGIN_TO_RP_ID: Record<string, string> = {
  "https://www.mnews.jp": "mnews.jp",
  "https://mnews.jp": "mnews.jp",
  "http://localhost:3000": "localhost",
};

/** リクエストのOriginヘッダから、許可済みならRP設定を返す（不許可はnull） */
export function resolveRp(origin: string | null | undefined): RpContext | null {
  if (!origin) return null;
  const rpID = ORIGIN_TO_RP_ID[origin];
  return rpID ? { rpID, origin } : null;
}

export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

// 戻り値の型は明示しない。Buffer をそのまま包むと Uint8Array<ArrayBufferLike>
// になり、SimpleWebAuthn が要求する Uint8Array<ArrayBuffer> と食い違うため、
// 新しい ArrayBuffer にコピーして推論させる。
export function fromBase64Url(value: string) {
  const buf = Buffer.from(value, "base64url");
  const bytes = new Uint8Array(new ArrayBuffer(buf.byteLength));
  bytes.set(buf);
  return bytes;
}
