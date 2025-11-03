// ✅ /utils/pptxToText.js (amélioré)
const fs = require("fs");
const unzipper = require("unzipper");
const xml2js = require("xml2js");

async function pptxToText(filePath) {
  const texts = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(unzipper.Parse())
      .on("entry", async (entry) => {
        const fileName = entry.path;

        if (fileName.startsWith("ppt/slides/slide") && fileName.endsWith(".xml")) {
          const content = await entry.buffer();
          xml2js.parseString(content.toString(), (err, result) => {
            if (err) return;

            try {
              const shapes =
                result["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0]?.["p:sp"] || [];

              for (const shape of shapes) {
                const paragraphs = shape?.["p:txBody"]?.[0]?.["a:p"] || [];
                for (const p of paragraphs) {
                  let line = "";
                  if (p["a:r"]) {
                    line = p["a:r"].map(r => r["a:t"]?.[0] || "").join(" ");
                  } else if (p["a:fld"]) {
                    line = p["a:fld"].map(r => r["a:t"]?.[0] || "").join(" ");
                  }
                  if (line.trim()) texts.push(line.trim());
                }
              }
            } catch (e) {
              // skip slide silently
            }
          });
        } else {
          entry.autodrain();
        }
      })
      .on("close", () => {
        const allText = texts.join("\n");
        console.log("📊 Contenu final PPTX extrait :", allText.slice(0, 300));
        resolve(allText);
      })
      .on("error", (err) => {
        reject("❌ Erreur extraction PPTX : " + err);
      });
  });
}

module.exports = pptxToText;
