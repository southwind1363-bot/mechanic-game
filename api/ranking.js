const GAS_URL = "https://script.google.com/macros/s/AKfycby6LfrcxCnlpeT3hj-4NIP-U4bJj6PV52VsCNN-ARIHeIihdB1jn280oF_r11Igto9F/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { action, name, score } = req.query;
  // キャッシュ回避のため常にタイムスタンプを付加
  let url = GAS_URL + "?action=" + (action || "get") + "&_t=" + Date.now();
  if (name)  url += "&name="  + encodeURIComponent(name);
  if (score) url += "&score=" + encodeURIComponent(score);

  try {
    // Step1: GASにリクエスト（リダイレクトを自動追跡しない）
    const r1 = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    let finalUrl = url;
    if (r1.status === 302 || r1.status === 301) {
      const loc = r1.headers.get("location");
      if (loc) finalUrl = loc;
    }

    // Step2: リダイレクト先から実データを取得
    const r2 = await fetch(finalUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    let data = await r2.json();

    // GETの場合: テストデータ除去・名前重複排除（最高スコアのみ残す）・ソート
    if (!action || action === "get") {
      if (Array.isArray(data)) {
        const TEST_NAMES = ["テスト","テスト2","GASTEST","GASTEST_77","GASTEST_77777",
                            "VERIFY","VERIFY2","FINALTEST","TEST","テスト1"];
        data = data.filter(e => !TEST_NAMES.includes(e.name));
        // 名前ごとに最高スコアのエントリだけ残す
        const best = {};
        for (const e of data) {
          if (!best[e.name] || e.score > best[e.name].score) best[e.name] = e;
        }
        data = Object.values(best).sort((a, b) => b.score - a.score).slice(0, 10);
      }
    }

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "proxy error", detail: String(e) });
  }
}
