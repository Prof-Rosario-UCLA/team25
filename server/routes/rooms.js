import express from 'express';
import Room from '../models/Room.js';
import { nanoid } from 'nanoid';

const router = express.Router();

// POST /api/rooms/create
router.post('/create', async (req, res) => {
  const roomCode = nanoid(6).toUpperCase();
  const room = new Room({ code: roomCode, players: [] });
  await room.save();
  res.json({ roomCode });
});

// POST /api/rooms/:roomCode/join
router.post('/:roomCode/join', async (req, res) => {
  const { username, socketId } = req.body;
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });

  room.players.push({ username, socketId });
  await room.save();
  res.json({ success: true });
});

// GET /api/rooms/:roomCode
router.get('/:roomCode', async (req, res) => {
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });
  res.json(room);
});

// POST /api/rooms/:roomCode/leave
router.post('/:roomCode/leave', async (req, res) => {
  const { socketId } = req.body;
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });

  room.players = room.players.filter(p => p.socketId !== socketId);
  await room.save();
  res.json({ success: true });
});

// POST /api/rooms/:roomCode/start
router.post('/:roomCode/start', async (req, res) => {
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });

  room.gameStarted = true;
  room.expectedStartLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  await room.save();

  res.json({ success: true });
});

// POST /api/rooms/:roomCode/submit-animal
router.post('/:roomCode/submit-animal', async (req, res) => {
  const { animal } = req.body;
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });

  room.currentAnimal = animal;
  room.expectedStartLetter = animal.slice(-1).toUpperCase();
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
  await room.save();

  res.json({ success: true });
});

// POST /api/rooms/:roomCode/eliminate
router.post('/:roomCode/eliminate', async (req, res) => {
  const { socketId } = req.body;
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });

  const player = room.players.find(p => p.socketId === socketId);
  if (player) player.isEliminated = true;
  await room.save();

  res.json({ success: true });
});

export default router;
