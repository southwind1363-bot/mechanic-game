const GAS_URL = "https://script.google.com/macros/s/AKfycbxtPJwzLPixbx4gCvU8oY34mUrfDGCEVS4imnDyekdBdd4gM-qXmE93nrvX68wrefWy/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { action, name, score } = req.query;
  let url = GAS_URL + "?action=" + (action || "get");
  if (name)  url += "&name="  + encodeURIComponent(name);
  if (score) url += "&score=" + encodeURIComponent(score);

  try {
    const r = await fetch(url, { redirect: "follow" });
    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "proxy error", detail: String(e) });
  }
}
