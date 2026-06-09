/**
 * 整備士育成シミュレーター 全国ランキング用 Google Apps Script
 *
 * 【これが解決する問題】
 *  旧GASは「最新10行」しか返さず、同じ人の重複行が枠を占有すると
 *  他のプレイヤーが消えていた。
 *  この版は「シート全行を読む → 名前ごとに最高点だけ残す → スコア順 →
 *  上位を返す」ため、重複行が溜まっていても自動的に正しいランキングになる。
 *  （= 既存のむぎを重複10行も手動削除なしで1件に畳まれる）
 *
 * 【シートの想定】
 *  1列目 = 名前 / 2列目 = スコア / 3列目 = 日付
 *  ヘッダー行があってもOK（スコア列が数値でない行は自動スキップ）
 *
 * 【デプロイ手順】
 *  1. このコードを Apps Script エディタに全文貼り付けて保存
 *  2. 「デプロイ」→「デプロイを管理」→ 既存デプロイの鉛筆(編集)
 *     →「バージョン」を「新バージョン」にして「デプロイ」
 *     ※ URL を変えないため必ず「既存デプロイの編集」で更新すること
 *  3. アクセス権は「全員」のまま
 */

const SHEET_NAME = '';   // 空文字なら先頭シートを使用。特定シート名があればここに記入
const RETURN_MAX = 50;   // 返す最大件数（プロキシ側でテスト名除外後に上位10へ絞る）

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'get';
  if (action === 'submit') return submitScore_(e);
  return json_(getRanking_());
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
}

// シート全行を読み、{name, score, date} の配列にして返す（不正行はスキップ）
function readEntries_() {
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 1) return [];
  const lastCol = Math.min(3, Math.max(1, sh.getLastColumn()));
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const name = String(row[0] == null ? '' : row[0]).trim();
    const scoreRaw = row[1];
    const score = Number(scoreRaw);
    if (!name) continue;                         // 名前なし行はスキップ
    if (scoreRaw === '' || scoreRaw == null) continue;
    if (isNaN(score)) continue;                  // ヘッダー行など数値でない行はスキップ
    const date = lastCol >= 3 ? String(row[2] == null ? '' : row[2]) : '';
    out.push({ name: name, score: score, date: date });
  }
  return out;
}

// 名前ごとに最高点だけ残し、スコア降順で上位 RETURN_MAX 件
function getRanking_() {
  const entries = readEntries_();
  const best = {};
  for (let i = 0; i < entries.length; i++) {
    const en = entries[i];
    if (!best[en.name] || en.score > best[en.name].score) best[en.name] = en;
  }
  return Object.keys(best)
    .map(function (k) { return best[k]; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, RETURN_MAX);
}

// スコア登録：1行追記し、登録後の順位を返す
function submitScore_(e) {
  const p = (e && e.parameter) || {};
  const name = String(p.name || '').slice(0, 10).trim() || '名無し';
  const score = Number(p.score);
  if (isNaN(score) || score <= 0) return json_({ ok: false, error: 'invalid score' });

  const sh = getSheet_();
  const d = new Date();
  const date = (d.getMonth() + 1) + '/' + d.getDate();
  sh.appendRow([name, score, date]);

  // 名前ごと最高点で順位算出（重複行があっても正しく出る）
  const ranking = getRanking_();
  const rank = ranking.filter(function (x) { return x.score > score; }).length + 1;
  return json_({ ok: true, rank: rank });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
