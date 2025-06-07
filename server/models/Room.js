import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  socketId: String,
  persistentUserId: String,
  username: String,
  isHost: { type: Boolean, default: false },
  isEliminated: { type: Boolean, default: false },
});

const roomSchema = new mongoose.Schema({
  code: String,
  players: [playerSchema],
  gameStarted: { type: Boolean, default: false },
  currentAnimal: String,
  expectedStartLetter: String,
  currentTurnIndex: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Room', roomSchema);