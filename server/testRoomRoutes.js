// // testRoomRoutes.js
// import axios from 'axios';

// const baseURL = 'http://localhost:3000/api/rooms';

// async function testRoutes() {
//   try {
//     // 1. Create a room
//     const createRes = await axios.post(`${baseURL}/create`);
//     const roomCode = createRes.data.roomCode;
//     console.log('Room created:', roomCode);

//     // 2. Join the room
//     const joinRes = await axios.post(`${baseURL}/${roomCode}/join`, {
//       username: 'TestUser',
//       socketId: 'socket123'
//     });
//     console.log('Join status:', joinRes.data);

//     // 3. Start the game
//     const startRes = await axios.post(`${baseURL}/${roomCode}/start`);
//     console.log('Game start status:', startRes.data);

//     // 4. Submit an animal
//     const submitRes = await axios.post(`${baseURL}/${roomCode}/submit-animal`, {
//       animal: 'Elephant'
//     });
//     console.log('Animal submit:', submitRes.data);

//     // 5. Eliminate a player
//     const elimRes = await axios.post(`${baseURL}/${roomCode}/eliminate`, {
//       socketId: 'socket123'
//     });
//     console.log('Elimination result:', elimRes.data);

//     // 6. Get final room data
//     const getRes = await axios.get(`${baseURL}/${roomCode}`);
//     console.log('Final room state:', getRes.data);

//   } catch (err) {
//     console.error(err.response?.data || err.message);
//   }
// }

// testRoutes();
