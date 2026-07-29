// 選手ページ「RIZIN・DEEP・パンクラス・修斗 通算」(4団体合算)の表示と、
// その集計方法を説明する /methodology/records の公開可否を1箇所で管理する。
// DEEPのデータが未投入で、片方だけtrueに切り替わると
// (a) methodologyだけ公開: DEEPのデータが無いのに「DEEP 2002年〜」と書かれたページが出る
// (b) 選手ページだけ公開: 「集計について」リンクが404に飛ぶ
// という事故になるため、必ずこの定数を両方から参照する。
export const SHOW_MULTI_ORG_RECORD = false;
