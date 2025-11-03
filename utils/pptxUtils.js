const extract = require("pptx-extract");

async function extractTextFromPPTX(filePath) {
  return new Promise((resolve, reject) => {
    let text = "";
    extract(filePath)
      .on("text", (data) => {
        text += data + "\n";
      })
      .on("end", () => resolve(text.trim()))
      .on("error", reject);
  });
}
