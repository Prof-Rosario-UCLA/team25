import React, {useEffect, useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/check`, {
          method: 'GET',
          credentials: 'include', // Important for cookies
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            navigate('/lobby'); // Redirect to lobby if authenticated
          }
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-100">
        <div className="text-green-800 text-2xl">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4">
      <section className="text-center max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-green-800 mb-6">LoopZoo</h1>
          <p className="text-xl text-gray-700 mb-8">Try to chain as many animals as possible!</p>
        </header>
        
        <div className="space-y-4 md:space-y-0 md:space-x-4 md:flex md:justify-center">
          <Link 
            to="/login" 
            className="inline-block bg-green-600 text-white py-3 px-8 rounded-lg font-medium text-lg hover:bg-green-700 transition-colors shadow-md w-full md:w-auto"
          >
            Log In
          </Link>
          
          <Link 
            to="/signup" 
            className="inline-block bg-white text-green-600 border border-green-600 py-3 px-8 rounded-lg font-medium text-lg hover:bg-green-100 transition-colors shadow-md w-full md:w-auto"
          >
            Sign Up
          </Link>
        </div>
        
        <footer className="mt-16 text-gray-600">
          <p className="text-sm">© 2025 LoopZoo. All rights reserved.</p>
        </footer>
      </section>
    </main>
  );
};

export default Home;