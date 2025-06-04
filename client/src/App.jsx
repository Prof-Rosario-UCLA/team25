import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// pages
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Lobby from './pages/Lobby.jsx'
import Room from './pages/Room.jsx'

function App() {

  return (
    <>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/room/:roomId" element={<Room />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        
        </BrowserRouter>
    </>
  )
}

export default App
