const GAS_URL = "https://script.google.com/macros/s/AKfycby6LfrcxCnlpeT3hj-4NIP-U4bJj6PV52VsCNN-ARIHeIihdB1jn280oF_r11Igto9F/exec";

const TEST_NAMES = ["テスト","テスト2","GASTEST","GASTEST_77","GASTEST_77777",
                    "VERIFY","VERIFY2","FINALTEST","TEST","テスト1"];

async function gasRequest(url) {
  const r1 = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" } });
  let finalUrl = url;
  if (r1.status === 302 || r1.status === 301) {
    const loc = r1.headers.get("location");
    if (loc) finalUrl = loc;
  }
  const r2 = await fetch(finalUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  return r2.json();
}

function filterAndRank(entries) {
  if (!Array.isArray(entries)) return [];
  const filtered = entries.filter(e => !TEST_NAMES.includes(e.name));
  const best = {};
  for (const e of filtered) {
    if (!best[e.name] || Number(e.score) > Number(best[e.name].score)) best[e.name] = e;
  }
  return Object.values(best).sort((a, b) => Number(b.score) - Number(a.score));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, name, score } = req.query;

  try {
    if (!action || action === "get") {
      // ランキング取得：テスト名除外・重複排除・上位10件
      const url = GAS_URL + "?action=get&_t=" + Date.now();
      const data = await gasRequest(url);
      const ranked = filterAndRank(data).slice(0, 10);
      return res.status(200).json(ranked);

    } else if (action === "submit") {
      // スコア登録：GASに送信後、フィルタ済みランクで上書き
      let url = GAS_URL + "?action=submit&_t=" + Date.now();
      if (name)  url += "&name="  + encodeURIComponent(name);
      if (score) url += "&score=" + encodeURIComponent(score);

      const data = await gasRequest(url);

      // フィルタ済み全件を取得してランクを再計算
      if (data && data.ok) {
        try {
          const allUrl = GAS_URL + "?action=get&_t=" + (Date.now() + 1);
          const allEntries = await gasRequest(allUrl);
          const sorted = filterAndRank(allEntries);
          const myScore = parseInt(score, 10);
          // 自分より高いスコアの件数 + 1 = 自分のランク
          data.rank = sorted.filter(e => Number(e.score) > myScore).length + 1;
        } catch (_) { /* ランク再計算失敗時はGAS値をそのまま使用 */ }
      }

      return res.status(200).json(data);

    } else {
      // その他のactionはそのままGASに転送
      let url = GAS_URL + "?action=" + action + "&_t=" + Date.now();
      if (name)  url += "&name="  + encodeURIComponent(name);
      if (score) url += "&score=" + encodeURIComponent(score);
      const data = await gasRequest(url);
      return res.status(200).json(data);
    }

  } catch (e) {
    return res.status(500).json({ error: "proxy error", detail: String(e) });
  }
}
