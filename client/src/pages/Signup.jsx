import React, {useEffect, useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';
// signup form
const Signup = () => {

    const navigate = useNavigate();

    // handle form submission
    const handleSubmit = (event) => {
        event.preventDefault();
        const username = event.target.username.value;
        const password = event.target.password.value;
        const confirmPassword = event.target.confirmPassword.value;
        if (password.length < 8) {
            alert("Password must be at least 8 characters long!");
            return;
        }

        const hasUpperCase = /[A-Z]/.test(password);
        if (!hasUpperCase) {
            alert("Password must contain at least one uppercase letter!");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        if (!hasSpecialChar) {
            alert("Password must contain at least one special character!");
            return;
        }
    
        fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        }).then(response => {
            if (response.ok) {
                alert("Account created successfully!");
                navigate('/login'); // redirect to login page
            } else {
                response.json().then(data => {
                    alert("This username already exists!");
                });
            }
        }).catch(error => {
            console.error("Error during signup:", error);
            alert("An error occurred while creating the account.");
        });
      };

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
    <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row lg:gap-8">
      <section className="bg-white rounded-lg shadow-md p-6 lg:p-8 w-full lg:w-2/3 flex flex-col items-center">
        <header className="text-center w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6">Create an Account</h1>
          <p className="text-gray-600 mb-8">Join LoopZoo to test your animal knowledge!</p>
        </header>
        
        <form className="signup-form w-full max-w-md" onSubmit={handleSubmit}>
          <fieldset className="mb-6">
            <legend className="sr-only">Personal Information</legend>
            
            <div className="form-group mb-4">
              <label htmlFor="username" className="block mb-2 font-medium">Username</label>
              <input 
                type="text" 
                id="username" 
                name="username"
                className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" 
                required 
              />
            </div>
          </fieldset>
          
          <fieldset className="mb-6">
            <legend className="sr-only">Security Information</legend>
            
            <div className="form-group mb-4">
              <label htmlFor="password" className="block mb-2 font-medium">Password</label>
              <input 
                type="password" 
                id="password" 
                name="password"
                className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" 
                required 
              />
              <small className="text-gray-500 mt-1 block">Must be at least 8 characters long and include a capital letter and special character.</small>
            </div>
            
            <div className="form-group mb-4">
              <label htmlFor="confirmPassword" className="block mb-2 font-medium">Confirm Password</label>
              <input 
                type="password" 
                id="confirmPassword" 
                name="confirmPassword"
                className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" 
                required 
              />
            </div>
          </fieldset>
          
          <button 
            type="submit" 
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors w-full font-medium"
          >
            Sign Up
          </button>
        </form>
        
        <footer className="w-full max-w-md text-center mt-8">
          <p>Already have an account? <a href="/login" className="text-green-600 hover:underline">Log In</a></p>
        </footer>
      </section>
      
      {/* Benefits aside - positioned to the right on large screens */}
      <aside className="lg:w-1/3 mt-8 lg:mt-0 bg-green-50 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4 text-green-800">Benefits of joining:</h2>
        <ul className="space-y-3">
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
            </svg>
            <span>Create and join game rooms with friends</span>
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
            </svg>
            <span>Compete against eachother in naming animals in succession</span>
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
            </svg>
            <span>Make a mistake, or repeat a name, and you're out!</span>
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
            </svg>
            <span>Up to 4 players per room</span>
          </li>
        </ul>
        
        <div className="mt-6 bg-white p-4 rounded-lg border border-green-100">
          <h3 className="font-medium text-lg mb-2">When one player names an animal, the next has to name one starting with the letter the previous ended with</h3>
        </div>
      </aside>
    </main>
  );
};

export default Signup;