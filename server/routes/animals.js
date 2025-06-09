import express from 'express';
import animalSet from '../animalList.js'
const router = express.Router();



// POST /api/animals/check
router.post('/check', (req, res) => {
  const { animal, requiredStartLetter } = req.body;

  if (!animal || typeof animal !== 'string') {
    return res.status(400).json({ valid: false, message: 'Animal name required' });
  }

  const formatted = animal.trim().toLowerCase();
  
  if (!animalSet.has(formatted)) {
    return res.json({ valid: false, message: 'Animal not in list' });
  }

  if (requiredStartLetter && formatted[0] !== requiredStartLetter.toLowerCase()) {
    return res.json({ valid: false, message: `Animal must start with "${requiredStartLetter}"` });
  }

  return res.json({ valid: true });
});

export default router;
