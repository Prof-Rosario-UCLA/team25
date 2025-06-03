import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
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