import express from 'express';
import Room from '../models/Room.js';
import { nanoid } from 'nanoid';
import redis from '../redis.js'

const router = express.Router();

// POST /api/rooms/create
router.post('/create', async (req, res) => {
  const roomCode = nanoid(6).toUpperCase();
  const room = new Room({ code: roomCode, players: [] });
  await room.save();
  await redis.del('rooms:open');
  res.json({ roomCode });
});

// POST /api/:room/join
router.post('/:roomCode/join', async (req, res) => {
  const { username, socketId } = req.body;
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });
  await redis.set(`room:${req.params.roomCode}`, JSON.stringify(room), 'EX', 300);

  // If this player is already in the room, don't add them again
  const existingPlayer = room.players.find(p => 
    (socketId && p.socketId === socketId) || 
    (username && p.username === username)
  );
  
  if (!existingPlayer) {
    room.players.push({ username, socketId });
    await room.save();
  }
  await redis.del('rooms:open');
  await redis.del(`room:${req.params.roomCode}`);
  res.json({ success: true });
});

// GET /api/rooms
router.get('/', async (req, res) => {
  try {
      // try cache before hitting db
      const cachedRooms = await redis.get('rooms:open');
      if (cachedRooms) {
        // console.log('CACHE HIT:', JSON.parse(cachedRooms));
        return res.json(JSON.parse(cachedRooms));
      }
      const rooms = await Room.find({ gameStarted: false });
      const formattedRooms = rooms.map(room => ({
          id: room._id,
          code: room.code,
          players: room.players.length,
      }));
      // cache result for 5 minutes
      await redis.set('rooms:open', JSON.stringify(formattedRooms), 'EX', 300);
      res.json(formattedRooms);
  } catch (err) {
      console.error('Error fetching rooms:', err);
      res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/rooms/:roomCode
router.get('/:roomCode', async (req, res) => {
  const { roomCode } = req.params;
  try {
    // hit cache before db
    const cacheKey = `room:${roomCode}`;
    const cachedRoom = await redis.get(cacheKey);
    if (cachedRoom) {
      // console.log('CACHE HIT:', JSON.parse(cachedRoom));
      return res.json(JSON.parse(cachedRoom));
    }
    // hit db
    const room = await Room.findOne({ code: req.params.roomCode });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    // cache result for 5 minutes
    await redis.set(cacheKey, JSON.stringify(room), 'EX', 300);
    res.json(room);
  } catch (err) {
    console.error('Error fetching room: ', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/rooms/:roomCode/leave
router.post('/:roomCode/leave', async (req, res) => {
  const { socketId } = req.body;
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });
  await redis.set(`room:${req.params.roomCode}`, JSON.stringify(room), 'EX', 300);

  room.players = room.players.filter(p => p.socketId !== socketId);
  await room.save();
  await redis.del('rooms:open');
  await redis.del(`room:${req.params.roomCode}`);
  res.json({ success: true });
});

// POST /api/rooms/:roomCode/start
router.post('/:roomCode/start', async (req, res) => {
  const room = await Room.findOne({ code: req.params.roomCode });
  if (!room) return res.status(404).json({ message: 'Room not found' });
  await redis.set(`room:${req.params.roomCode}`, JSON.stringify(room), 'EX', 300);

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
  await redis.del(`room:${req.params.roomCode}`);
  res.json({ success: true });
});

// POST /api/rooms/:roomCode/submit-animal
router.post('/:roomCode/submit-animal', async (req, res) => {
  const { animal } = req.body;
  
  try {
    // Find the room
    let room = false;
    console.log('CACHE HIT');
    if (room) {
      room = JSON.parse(room);
    } else {
      room = await Room.findOne({ code: req.params.roomCode });
      if (!room) return res.status(404).json({ message: 'Room not found' });
    }

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
    await redis.set(`room:${req.params.roomCode}`, JSON.stringify(room), 'EX', 300);

    // Use findOneAndUpdate to avoid version conflicts
    await Room.findOneAndUpdate(
      { code: req.params.roomCode, "players.socketId": socketId },
      { $set: { "players.$.isEliminated": true } }
    );
    await redis.del(`room:${req.params.roomCode}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminating player:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
