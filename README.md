# LoopZoo

LoopZoo is a full-stack web application that lets users play a chaining game with animals, which we built with React, Express, MongoDB, Redis, and deployed on Google App Engine. Users can create accounts and join rooms where they can play with other players, create their own rooms with generated join codes, and enable and disable video and audio access. We implemented authentication using cookies with JWT, video streaming using web sockets, and PWA functionalities with a manifest.json file. 
---

You can find the paper explaining how we satisfied the spec items here: 
https://docs.google.com/document/d/1tt77zfyClT2exlRyw-0cnS-bsVAfziNd21VLNcDW3lU/edit?usp=sharing

## Project Structure

- /client - Frontend (React, Vite, Tailwind) 
- /server - Backend (Express, MongoDB, Redis) 
- /node_modules - Dependencies for the Node.js project
- .github/workflows/ - CI/CD automation for testing, building, and deployment

## Deployment Instructions

### 1. Clone the repository
git clone https://github.com/Prof-Rosario-UCLA/team25.git  
cd team25
### 2. Create environmental variables
Create a .env file in /server with:    
MONGO_URI=mongodb+srv://hatajyan:HHrUmvlTCqTrt0zC@in-quiz-itive.findqlm.mongodb.net/?retryWrites=true&w=majority&appName=In-quiz-itive  
JWT_SECRET=*hidden for security*  
PORT=3000  
Create a .env file in /client with:  
VITE_API_URL=http://localhost:3000
### 3. Deploy the app on Google App Engine
- This project is configured to run on Google App Engine. We deploy the client and server side separately.
- Backend:  cd server, gcloud app deploy  
- Frontend:  cd client, npm install, npm run build, gcloud app deploy app.yaml  

## REST API Documentation

### POST /api/auth/register
- Registers a new user.
- Request body:
{
  "username": "ethan",
  "password": "secret"
}
- Response: 201 Created

### POST /api/auth/login
- Authenticates a user and sets a JWT in a HTTP-only cookie.
- Request body: 
{
  "username": "ethan",
  "password": "secret"
}
- Response: { "message": "Logged in", "token": "<jwt>" }

### POST /api/auth/logout
- Clears the JWT cookie and logs out the user.
- Response: { "message": "Logged out" }

### GET /api/auth/check
- Checks if a user is authenticated by verifying the JWT cookie.
- Response:
{
  "authenticated": true,
  "user": { "id": "001" }
}

### POST /api/rooms/create
- Creates a new room by generating a 6-character room code. Additionally, create the Room object in MongoDB and invalidate the cached open rooms list.
- Response: { "roomCode": "ABC123" }

### POST /api/rooms/:roomCode/join
- Join a user to a room.
- Request body:
{
  "username": "ethan",
  "socketId": "abc123",
  "persistentUserId": "user123"
}
- Response: { "success": true, "room": { ...roomData } }

### GET /api/rooms
- Get a list of all rooms that haven't started yet.
- Response: 
[
  { "id": "abc123", "code": "RKLSJD", "players": 3 },
  ...

]

### GET /api/rooms/:roomCode
- Fetches the data for a specific room.
- Response: Full room object (long, in JSON format)

### POST /api/rooms/:roomCode/leave
- Remove a player from the room using their socketId.
- Request body:
{ "socketId": "abc123" }
- Response: { "success": true }

### POST /api/rooms/:roomCode/start
- Start the game by checking requirements (like if the room has at least 2 players) and set the different values accordingly in the database.
- Response: { "success": true, "room": { ... } }

### POST /api/rooms/:roomCode/submit-animal
- Save the current animal that a player submits.
- Request body:
{ "animal": "Elephant" }
- Response: { "success": true }

### POST /api/rooms/:roomCode/eliminate
- Mark a player as eliminated.
- Request body:
{ "socketId": "abc123" }
- Response: { "success": true, "room": { ...updatedRoom } }

### POST /api/animals/check
- Check whether a submitted animal is a valid answer (starts with the required letter, or the letter that the previous animal ended with)
- Request body:
{
  "animal": "Dog",
  "requiredStartLetter": "D"
}
- Response: { "valid": true }


