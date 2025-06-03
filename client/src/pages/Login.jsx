import React from 'react';

const Login = () => {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 md:p-6 lg:p-8 bg-gray-50">
      <section className="bg-white rounded-lg shadow-md p-6 lg:p-8 w-full max-w-md flex flex-col items-center">
        <header className="text-center w-full">
          <h1 className="text-3xl font-bold mb-6">Welcome Back</h1>
          <p className="text-gray-600 mb-8">Log in to continue to LoopZoo!</p>
        </header>
        
        <form className="login-form w-full">
          <fieldset className="mb-6">
            <legend className="sr-only">Login Information</legend>
            
            <div className="form-group mb-4">
              <label htmlFor="email" className="block mb-2 font-medium">Email Address</label>
              <input 
                type="email" 
                id="email" 
                name="email"
                className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" 
                required 
              />
            </div>
            
            <div className="form-group mb-4">
              <label htmlFor="password" className="block mb-2 font-medium">Password</label>
              <input 
                type="password" 
                id="password" 
                name="password"
                className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" 
                required 
              />
            </div>
          </fieldset>
        
          
          <button 
            type="submit" 
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors w-full font-medium"
          >
            Log In
          </button>
        </form>
        
        <footer className="w-full text-center mt-8">
          <p>Don't have an account? <a href="/signup" className="text-green-600 hover:underline">Sign Up</a></p>
        </footer>
      </section>
    </main>
  );
};

export default Login;