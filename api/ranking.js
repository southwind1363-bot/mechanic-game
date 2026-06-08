const GAS_URL = "https://script.google.com/macros/s/AKfycbxtPJwzLPixbx4gCvU8oY34mUrfDGCEVS4imnDyekdBdd4gM-qXmE93nrvX68wrefWy/exec";

// GASのスコア上限(9999)を回避するエンコーディング
// score >= 10000 の場合:
//   gasName  = "{overflow}‡{name（切り詰め）}"  ← 合計10文字以内
//   gasScore = score % 10000  ← 必ず0〜9999に収まる
// score < 10000 の場合: そのまま送信
function encodeForGas(name, score) {
  const sep = "‡"; // ‡
  if (score >= 10000) {
    const overflow   = Math.floor(score / 10000);
    const overflowStr = String(overflow);
    const maxNameLen  = 10 - overflowStr.length - sep.length;
    const gasName     = overflowStr + sep + name.slice(0, Math.max(0, maxNameLen));
    const gasScore    = score % 10000;
    return { gasName, gasScore };
  }
  return { gasName: name, gasScore: score };
}

// GASから取得したエントリを元のスコア・名前に復元
function decodeFromGas(entry) {
  const sep = "‡"; // ‡
  if (entry.name && entry.name.includes(sep)) {
    const idx      = entry.name.indexOf(sep);
    const overflow = parseInt(entry.name.slice(0, idx), 10) || 0;
    const realName  = entry.name.slice(idx + 1);
    const realScore = overflow * 10000 + (entry.score || 0);
    return { ...entry, name: realName, score: realScore };
  }
  return entry;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { action, name, score } = req.query;
  const scoreNum = parseInt(score, 10) || 0;

  // submit 時: スコアをエンコードしてGASのキャップを回避
  let gasName  = name  || "";
  let gasScore = scoreNum;
  if (action === "submit" && name && scoreNum > 0) {
    const enc = encodeForGas(name, scoreNum);
    gasName  = enc.gasName;
    gasScore = enc.gasScore;
  }

  let url = GAS_URL + "?action=" + (action || "get") + "&_t=" + Date.now();
  if (action === "submit") {
    url += "&name="  + encodeURIComponent(gasName);
    url += "&score=" + encodeURIComponent(gasScore);
  }

  try {
    // Step1: GASへリクエスト（リダイレクト手動追跡）
    const r1 = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    let finalUrl = url;
    if (r1.status === 302 || r1.status === 301) {
      const loc = r1.headers.get("location");
      if (loc) finalUrl = loc;
    }

    // Step2: リダイレクト先から実データ取得
    const r2   = await fetch(finalUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    let   data = await r2.json();

    // get 時: エンコードされたエントリを復元してスコア順に並び替え
    if (!action || action === "get") {
      if (Array.isArray(data)) {
        data = data.map(decodeFromGas);
        data.sort((a, b) => b.score - a.score);
        data = data.slice(0, 10);
      }
    }

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "proxy error", detail: String(e) });
  }
}
