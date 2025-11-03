const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const textract = require("textract");

function getExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

async function extractText(filePath) {
  const ext = getExtension(filePath);

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === ".pptx" || ext === ".txt") {
    return new Promise((resolve, reject) => {
      textract.fromFileWithPath(filePath, (err, text) => {
        if (err) return reject(err);
        resolve(text);
      });
    });
  }

  throw new Error(`Format de fichier non pris en charge : ${ext}`);
}

module.exports = { extractText };
