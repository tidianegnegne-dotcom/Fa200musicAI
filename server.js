
const http = require("http");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, {"Content-Type": "application/json"});
    return res.end(JSON.stringify({status: "FA200 MUSIC AI server ready"}));
  }

  if (req.method !== "POST" || req.url !== "/api/generate") {
    res.writeHead(404);
    return res.end("Route introuvable");
  }

  if (!API_KEY) {
    res.writeHead(500, {"Content-Type": "application/json"});
    return res.end(JSON.stringify({error: "Clé API non configurée sur le serveur."}));
  }

  let body = "";

  try {
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 20000) {
        res.writeHead(413);
        return res.end(JSON.stringify({error: "Demande trop longue"}));
      }
    }

    const data = JSON.parse(body);
    const prompt = String(data.prompt || "").trim();

    if (!prompt || prompt.length > 5000) {
      res.writeHead(400, {"Content-Type": "application/json"});
      return res.end(JSON.stringify({error: "Décris ta chanson (maximum 5000 caractères)."}));
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          model: "lyria-3.5",
          input: prompt
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Google API error:", result);
      res.writeHead(response.status, {"Content-Type": "application/json"});
      return res.end(JSON.stringify({
        error: "Google n'a pas pu générer la musique. Vérifie ton accès API et ton quota."
      }));
    }

    let audio = null;
    let lyrics = [];

    for (const step of result.steps || []) {
      if (step.type === "model_output") {
        for (const item of step.content || []) {
          if (item.type === "audio") audio = item.data;
          if (item.type === "text") lyrics.push(item.text);
        }
      }
    }

    if (!audio) {
      throw new Error("Aucun fichier audio reçu de Google.");
    }

    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({
      success: true,
      audioBase64: audio,
      lyrics: lyrics.join("\n"),
      format: "mp3"
    }));

  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500, {"Content-Type": "application/json"});
      res.end(JSON.stringify({error: "Erreur pendant la génération musicale."}));
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("FA200 MUSIC AI server running on port " + PORT);
});

