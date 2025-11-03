const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

exports.generateTextFile = (text) => {
  const filename = `chat-${Date.now()}.txt`;
  const filePath = path.join(__dirname, "../public/files", filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
  return `/files/${filename}`;
};

exports.generatePDF = (text) => {
  const filename = `chat-${Date.now()}.pdf`;
  const filePath = path.join(__dirname, "../public/files", filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));
  doc.fontSize(12).text(text);
  doc.end();

  return `/files/${filename}`;
};
