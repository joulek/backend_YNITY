const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  askChatbot,
  getConversationHistory,
  getAllConversations,
  getConversationById,
  createConversation,
  deleteConversation,
  renameConversation,
  transcribeAudio,
  chatbotReplyWithTTS,
} = require("../controllers/chatbotController");

const upload = multer({ dest: "uploads/" });
const analyzeFile = require("../controllers/analyzeFile");
router.post("/file", upload.single("file"), analyzeFile);
// ✅ Routes les plus spécifiques en premier
router.post("/", askChatbot);
router.get("/history", getConversationHistory);
router.get("/all", getAllConversations);
router.post("/new", createConversation);
router.put("/rename/:id", renameConversation);
router.delete("/delete/:id", deleteConversation);
router.post("/voice", upload.single("audio"), transcribeAudio);
router.post("/voice-reply", chatbotReplyWithTTS);

// ✅ Cette route dynamique DOIT être en dernier
router.get("/:id", getConversationById);

module.exports = router;
