import React, {useState, useEffect} from 'react';
import { useNavigate } from 'react-router-dom';

const Lobby = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [rooms, setRooms] = useState([]);
    const [joinCode, setJoinCode] = useState('');
    
      
    useEffect(() => {
    const checkAuth = async () => {
        try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/check`, {
            method: 'GET',
            credentials: 'include', // Important for cookies
        });
        
        // If response is not OK or user is not authenticated, redirect to home
        if (!response.ok) {
            navigate('/'); // Redirect to home if not authenticated
            return;
        }
        
        const data = await response.json();
        if (!data.authenticated) {
            navigate('/'); // Redirect to home if not authenticated
        }
        } catch (error) {
        console.error('Error checking authentication:', error);
        navigate('/'); // Redirect on error as well
        } finally {
        setLoading(false);
        }
    }
    checkAuth();
    }, []); // Add navigate to dependency array

    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
                    method: 'GET',
                    credentials: 'include',
                });
                if (!res.ok) throw new Error('Failed to fetch rooms');
                const data = await res.json();
                setRooms(data);
            } catch (err) {
                console.error('Error fetching rooms:', err);
            }
        };
    
        fetchRooms();
        const interval = setInterval(fetchRooms, 10000); // refresh every 5 sec
    
        return () => clearInterval(interval);
    }, []);
    
    if (loading) {
    return (
        <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-100">
        <div className="text-green-800 text-2xl">Loading...</div>
        </main>
    );
    }
    


    const handleCreateRoom = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
      
          const data = await res.json();
          navigate(`/room/${data.roomCode}`);
        } catch (err) {
          console.error('Failed to create room:', err);
        }
    };

    // Replace with this simpler function:
    const handleJoinRoom = async (roomCode) => {
        try {
            // Just navigate to the room, Socket.IO will handle joining
            navigate(`/room/${roomCode}`);
        } catch (err) {
            console.error('Failed to join room:', err);
        }
    };
      

    const handleLogout = () => {
        fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include', // Important for cookies
        })
            .then(response => {
            if (response.ok) {
                // Clear local storage
                localStorage.removeItem('username');
                // Redirect to login or home page
                navigate('/');
            }
            })
            .catch(error => {
            console.error('Error during logout:', error);
            });
    };

    return (
        <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-green-800">Game Lobby</h1>
                <button
                    onClick={handleLogout}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-colors"
                >
                    LogOut
                </button>
            </header>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left column - Create/Join (wider) */}
                <section className="lg:w-2/3">
                    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Create a New Room</h2>
                        <p className="text-gray-600 mb-4">Start a new game and invite your friends to join!</p>
                        <button
                            onClick={handleCreateRoom}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors shadow-md"
                        >
                            Create Room
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Join a Room</h2>
                        <p className="text-gray-600 mb-4">Enter a room code to join an existing game.</p>
                        
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="Enter room code"
                                className="flex-grow border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                            />
                            <button
                                onClick={() => handleJoinRoom(joinCode)}
                                className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-medium transition-colors shadow-md"
                            >
                                Join
                            </button>
                        </div>
                    </div>
                </section>

                {/* Right column - Room list (narrower) */}
                <section className="lg:w-1/3">
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Available Rooms</h2>
                        
                        {rooms.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No rooms available. Create one!</p>
                        ) : (
                            <div className="overflow-y-auto max-h-96">
                                <table className="w-full">
                                    <thead className="border-b">
                                        <tr>
                                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Code</th>
                                            <th className="text-center py-2 px-2 font-semibold text-gray-600">Players</th>
                                            <th className="text-right py-2 px-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rooms.map(room => (
                                            <tr key={room.id} className="border-b hover:bg-green-50">
                                                <td className="py-3 px-3 font-medium">{room.code}</td>
                                                <td className="py-3 px-2 text-center">
                                                    <span className="inline-flex items-center bg-green-100 text-green-800 py-1 px-2 rounded-full text-sm">
                                                        {room.players}/4
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-right">
                                                    <button
                                                        onClick={() => handleJoinRoom(room.code)}
                                                        className="bg-green-100 hover:bg-green-200 text-green-600 px-3 py-1 rounded-lg transition-colors text-sm"
                                                    >
                                                        Join
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
};

export default Lobby;