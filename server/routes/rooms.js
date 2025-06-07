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

// POST /api/:room/join
router.post('/:roomCode/join', async (req, res) => {
  const { username, socketId } = req.body;
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });

  // If this player is already in the room, don't add them again
  const existingPlayer = room.players.find(p => 
    (socketId && p.socketId === socketId) || 
    (username && p.username === username)
  );
  
  if (!existingPlayer) {
    room.players.push({ username, socketId });
    await room.save();
  }
  
  res.json({ success: true });
});

// GET /api/rooms
router.get('/', async (req, res) => {
  try {
      const rooms = await Room.find({ gameStarted: false });
      const formattedRooms = rooms.map(room => ({
          id: room._id,
          code: room.code,
          players: room.players.length,
      }));
      res.json(formattedRooms);
  } catch (err) {
      console.error('Error fetching rooms:', err);
      res.status(500).json({ error: 'Failed to fetch rooms' });
  }
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

  // Require at least 2 players to start the game
  if (room.players.length < 2) {
    return res.status(400).json({ 
      success: false, 
      message: 'At least 2 players are required to start the game' 
    });
  }

  // Generate random starting letter
  const startLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  
  room.gameStarted = true;
  room.expectedStartLetter = startLetter;
  await room.save();

  // Use the io object to emit to all clients in the room
  req.app.get('io').to(req.params.roomCode).emit('game-started', { 
    expectedStartLetter: startLetter 
  });

  res.json({ success: true });
});

// POST /api/rooms/:roomCode/submit-animal
router.post('/:roomCode/submit-animal', async (req, res) => {
  const { animal } = req.body;
  
  try {
    // Find the room
    const room = await Room.findOne({ code: req.params.roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // Only update the animal and letter
    // The socket handler will handle turn changes
    await Room.findOneAndUpdate(
      { code: req.params.roomCode },
      { 
        currentAnimal: animal,
        expectedStartLetter: animal.slice(-1).toUpperCase()
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting animal:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/:roomCode/eliminate
router.post('/:roomCode/eliminate', async (req, res) => {
  const { socketId } = req.body;
  
  try {
    const room = await Room.findOne({ code: req.params.roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // Use findOneAndUpdate to avoid version conflicts
    await Room.findOneAndUpdate(
      { code: req.params.roomCode, "players.socketId": socketId },
      { $set: { "players.$.isEliminated": true } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminating player:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
