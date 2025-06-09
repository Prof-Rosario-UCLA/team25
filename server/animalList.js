import fs from 'fs';

const animalSet = new Set(fs.readFileSync('animals.txt', 'utf-8').split('\n').map(a => a.trim().toLowerCase()));

export default animalSet;