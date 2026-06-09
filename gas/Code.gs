/**
 * 整備士育成シミュレーター 全国ランキング用 Google Apps Script
 *
 * 【データ保存先】PropertiesService（ScriptProperties）の "ranking" に JSON 配列。
 *   ※スプレッドシートではない。アクセス数は "views"。
 *
 * 【修正した問題】2026-06-10
 *   旧版は submit のたびに {name,score,date} を push してスコア順 top30 保持していたが、
 *   名前で重複排除していなかった。そのため同じ人が同じ自己ベストを何度も送ると
 *   top30 がその人の重複で埋まり、他プレイヤーが枠から押し出されて消えていた
 *   （実例：むぎを 88454 が10件並び、get が全部むぎを）。
 *   → submit時・get時の両方で dedupeByName_（名前ごと最高点だけ残す）を追加。
 *
 * 【デプロイ】Apps Scriptに全文貼付→保存→「デプロイを管理」→既存デプロイの鉛筆
 *   →バージョン「新バージョン」→デプロイ（URL維持のため新規デプロイにしない）。
 */

function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var action = e.parameter.action || "get";

  if (action === "view") {
    var views = parseInt(props.getProperty("views") || "0") + 1;
    props.setProperty("views", String(views));
    return out_({ views: views });
  }

  if (action === "submit") {
    var name = (e.parameter.name || "名無し").slice(0, 10).replace(/[<>"'&]/g, "");
    var score = Math.min(999999, Math.max(0, parseInt(e.parameter.score) || 0));
    var raw = props.getProperty("ranking") || "[]";
    var ranking = JSON.parse(raw);
    var now = new Date();
    var date = (now.getMonth() + 1) + "/" + now.getDate();
    ranking.push({ name: name, score: score, date: date });
    ranking = dedupeByName_(ranking);     // ★名前ごとに最高点だけ残す（重複防止）
    ranking = ranking.slice(0, 30);
    props.setProperty("ranking", JSON.stringify(ranking));
    var myRank = -1;
    for (var i = 0; i < ranking.length; i++) {
      if (ranking[i].name === name && ranking[i].score === score) { myRank = i + 1; break; }
    }
    return out_({ ok: true, rank: myRank });
  }

  var raw2 = props.getProperty("ranking") || "[]";
  var data = dedupeByName_(JSON.parse(raw2)).slice(0, 10);   // ★取得時も重複排除
  return out_(data);
}

// 名前ごとに最高点だけ残し、スコア降順で返す
function dedupeByName_(arr) {
  var best = {};
  for (var i = 0; i < arr.length; i++) {
    var en = arr[i];
    if (!best[en.name] || en.score > best[en.name].score) best[en.name] = en;
  }
  var out = [];
  for (var k in best) out.push(best[k]);
  out.sort(function(a, b) { return b.score - a.score; });
  return out;
}

// JSON出力の共通化
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
