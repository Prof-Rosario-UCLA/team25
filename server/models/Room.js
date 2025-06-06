import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  socketId: String,
  username: String,
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