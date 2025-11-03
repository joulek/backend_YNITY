const fs = require("fs");
const docx = require("docx-parser");

async function extractTextFromDOCX(filePath) {
  return new Promise((resolve, reject) => {
    docx.parseDocx(filePath, (data) => {
      if (!data) reject("Impossible d'extraire le DOCX");
      else resolve(data);
    });
  });
}

module.exports = { extractTextFromDOCX };
