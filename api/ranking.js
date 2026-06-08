const GAS_URL = "https://script.google.com/macros/s/AKfycbxtPJwzLPixbx4gCvU8oY34mUrfDGCEVS4imnDyekdBdd4gM-qXmE93nrvX68wrefWy/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { action, name, score } = req.query;
  let url = GAS_URL + "?action=" + (action || "get");
  if (name)  url += "&name="  + encodeURIComponent(name);
  if (score) url += "&score=" + encodeURIComponent(score);

  try {
    // Step1: GASにリクエスト（リダイレクトを自動追跡しない）
    const r1 = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    let finalUrl = url;
    // 302リダイレクトならLocationヘッダーを取得
    if (r1.status === 302 || r1.status === 301) {
      const loc = r1.headers.get("location");
      if (loc) finalUrl = loc;
    }

    // Step2: リダイレクト先（script.googleusercontent.com）から実データを取得
    const r2 = await fetch(finalUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const data = await r2.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "proxy error", detail: String(e) });
  }
}
