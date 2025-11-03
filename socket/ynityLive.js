const { Server } = require("socket.io");
let rooms = {};

function getSafeRoom(room) {
  return {
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      ready: p.ready,
    })),
  };
}

function ynityLive(server) {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket connecté :", socket.id);

    socket.on("createRoom", ({ playerName }, callback) => {
      const roomId = Math.random().toString(36).substring(2, 8);
      rooms[roomId] = {
        players: [{ id: socket.id, name: playerName, score: 0, ready: false }],
        courseId: null,
      };
      socket.join(roomId);
      callback(roomId);
      io.to(roomId).emit("roomUpdate", getSafeRoom(rooms[roomId]));
    });

    socket.on("joinRoom", ({ roomId, playerName }) => {
      const room = rooms[roomId];
      if (!room) return;

      room.players.push({
        id: socket.id,
        name: playerName,
        score: 0,
        ready: false,
      });
      socket.join(roomId);
      io.to(roomId).emit("roomUpdate", getSafeRoom(room));
    });
socket.on("playerReady", async ({ roomId, courseId }) => {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players.find((p) => p.id === socket.id);
  if (player) player.ready = true;

  if (!room.courseId && courseId) {
    room.courseId = courseId;
  }

  io.to(roomId).emit("roomUpdate", getSafeRoom(room));

  if (room.players.length >= 2 && room.players.every((p) => p.ready)) {
    console.log("🎬 Tous les joueurs sont prêts. Chargement des questions...");

    let coachMessage = ""; // ✅ On le déclare ici AVANT utilisation

    const courseIdUsed = room.courseId;
    const res = await fetch("http://localhost:8003/quiz/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: courseIdUsed }),
    });

    const data = await res.json();
    const questions = data.questions || [];
    coachMessage = data.coach || "You're doing great!";

    if (!questions.length) {
      console.log(
        "❌ Aucun flashcard trouvé via quiz_agent pour le cours :",
        courseIdUsed
      );
      return;
    }

    io.to(roomId).emit("startQuiz");

    let qIndex = 0;
    let currentQuestion = null;
    let timer = null;
    const answeredPlayers = new Set();

    const motivate = () => {
      if (coachMessage) {
        io.to(roomId).emit("coachMessage", { text: coachMessage });
      }
    };

   const sendQuestion = async () => {
  if (qIndex >= questions.length) {
    const ranking = [...room.players].sort((a, b) => b.score - a.score);
    io.to(roomId).emit("quizEnd", ranking);
    return;
  }

  const res = await fetch("http://localhost:8003/quiz/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions, index: qIndex }),
  });

  const data = await res.json();

  if (data.end) {
    const ranking = [...room.players].sort((a, b) => b.score - a.score);
    io.to(roomId).emit("quizEnd", ranking);
    return;
  }

  currentQuestion = data.question;
  answeredPlayers.clear();
  io.to(roomId).emit("question", { data: currentQuestion, time: 15 });

  if (data.coach) {
    io.to(roomId).emit("coachMessage", { text: data.coach });
  }

  timer = setTimeout(() => {
    qIndex++;
    sendQuestion();
  }, 15000);
};


    // Lance la première question
    sendQuestion();
  }
});


    // ✅ Gestion des réponses de tous les sockets
    socket.on("answer", ({ correct }) => {
      const roomId = Object.keys(rooms).find((id) =>
        rooms[id].players.some((p) => p.id === socket.id)
      );
      if (!roomId) return;

      const room = rooms[roomId];
      const player = room.players.find((p) => p.id === socket.id);

      if (player && correct) {
        player.score += 10;
        io.to(roomId).emit("roomUpdate", getSafeRoom(room)); // ⬅️ met à jour les scores visibles
      }
    });

    socket.on("disconnect", () => {
      for (const [roomId, room] of Object.entries(rooms)) {
        room.players = room.players.filter((p) => p.id !== socket.id);
        io.to(roomId).emit("roomUpdate", getSafeRoom(room));
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
      }
      console.log("🔴 Déconnexion socket:", socket.id);
    });
  });
}

module.exports = ynityLive;
