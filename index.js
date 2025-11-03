const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const path = require("path");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
require("./reminderScheduler");

const User = require("./models/User"); // ✅ Missing import
const setupLiveSocket = require("./socket/ynityLive");

const app = express();
const server = http.createServer(app);
setupLiveSocket(server);

// ✅ CORS FIRST (before session)
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// ✅ Express JSON
app.use(express.json());

// ✅ Session BEFORE passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secretkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // HTTPS only = true in production
      sameSite: "lax"
    }
  })
);

// ✅ Passport
app.use(passport.initialize());
app.use(passport.session());

// ✅ Serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// ✅ Deserialization
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

/* ---------------- ROUTES ---------------- */

const authRoutes = require("./routes/auth");
app.use(authRoutes);

const courseRoutes = require("./routes/course");
app.use("/api/course", courseRoutes);

const flashcardRoutes = require("./routes/flashcard");
app.use("/api/flashcards", flashcardRoutes);

const attemptRoutes = require("./routes/Attempt");
app.use("/api/attempts", attemptRoutes);

const planningRoutes = require("./routes/Planning");
app.use("/api/planning", planningRoutes);

const SubjectsRoutes = require("./routes/Subject");
app.use("/api/subject", SubjectsRoutes);

const examRoutes = require("./routes/Exam");
app.use("/api/exam", examRoutes);

app.use("/files", express.static(path.join(__dirname, "public/files")));
app.use("/audio", express.static(path.join(__dirname, "public/audio")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/notifications", require("./routes/notificationUI"));
app.use("/api/chatbot", require("./routes/chatbot"));
app.use("/api/usage", require("./routes/tracking"));
app.use("/api/revision", require("./routes/revision"));
const chapterAgent = require ("./routes/chapterAgent.js");
app.use("/api/ai", chapterAgent);
// ✅ Logout
app.get("/auth/logout", (req, res) => {
  req.logout(() => {
    res.redirect("http://localhost:5173/login");
  });
});

// ✅ Root route
app.get("/", (req, res) => {
  res.send("🚀 Backend is running with Passport sessions");
});

/* ---------------- DB ---------------- */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 5000;

// ❌ Remove app.listen — use ONLY server.listen
server.listen(PORT, () =>
  console.log(`✅ Server + WebSocket running on port ${PORT}`)
);
