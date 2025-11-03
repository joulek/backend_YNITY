const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const PDFDocument = require("pdfkit");

/**
 * Extrait le texte brut d'un fichier PDF
 * @param {string} filePath - Chemin vers le fichier PDF
 * @returns {Promise<string>} - Texte extrait
 */
async function extractTextFromPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Génère un fichier PDF contenant le texte donné
 * @param {string} text - Le texte à enregistrer
 * @param {string} filename - Le nom du fichier PDF généré
 * @returns {Promise<string>} - Chemin relatif du fichier enregistré
 */
function saveTextAsPDF(text, filename) {
  const doc = new PDFDocument();
  const outputDir = path.join(__dirname, "../uploads/resumes");

  // Crée le dossier s'il n'existe pas
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, filename);
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);
  doc.font("Times-Roman").fontSize(12).text(text, {
    align: "left",
    lineGap: 4,
  });
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(`resumes/${filename}`));
    stream.on("error", reject);
  });
}

module.exports = {
  extractTextFromPDF,
  saveTextAsPDF,
};
