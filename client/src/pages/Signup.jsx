import React, {useEffect, useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Signup = () => {
    const navigate = useNavigate();

    const handleSubmit = (event) => {
        event.preventDefault();
        const username = event.target.username.value;
        const password = event.target.password.value;
        const confirmPassword = event.target.confirmPassword.value;

        if (!username.trim() || !password || !confirmPassword) {
            alert("Please fill in all fields.");
            return;
        }
        if (password.length < 8) {
            alert("Password must be at least 8 characters long!");
            return;
        }
        const hasUpperCase = /[A-Z]/.test(password);
        if (!hasUpperCase) {
            alert("Password must contain at least one uppercase letter!");
            return;
        }
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        if (!hasSpecialChar) {
            alert("Password must contain at least one special character!");
            return;
        }
        if (password !== confirmPassword) {
            alert("Passwords do not match!");
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
                navigate('/login'); 
            } else {
                response.json().then(data => {
                    alert(data.message || "This username already exists!");
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
            credentials: 'include', 
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.authenticated) {
            navigate('/lobby'); 
            }
        }
        } catch (error) {
        console.error('Error checking authentication:', error);
        } finally {
        setLoading(false);
        }
    }
    checkAuth();
    }, [navigate]);

    if (loading) {
    return (
        <main className="flex items-center justify-center min-h-screen bg-gradient-to-b from-green-50 to-green-100 p-4">
        <div className="text-green-800 text-xl sm:text-2xl">Loading...</div>
        </main>
    );
    }
    
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 flex flex-col items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row lg:gap-6">
        <section className="bg-white rounded-xl shadow-lg p-4 py-6 sm:p-6 md:p-8 w-full lg:w-2/3 flex flex-col items-center">
          <header className="text-center w-full max-w-md mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Create an Account</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-2 mb-4 sm:mb-6">Join LoopZoo to test your animal knowledge!</p>
          </header>
          
          <form className="signup-form w-full max-w-md" onSubmit={handleSubmit}>
            <fieldset className="mb-4 sm:mb-5">
              <legend className="sr-only">Personal Information</legend>
              
              <div className="form-group mb-3 sm:mb-4">
                <label htmlFor="username" className="block mb-1.5 text-sm sm:text-base font-medium text-gray-700">Username</label>
                <input 
                  type="text" 
                  id="username" 
                  name="username"
                  className="w-full border border-gray-300 p-2 sm:p-2.5 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm sm:text-base" 
                  required 
                />
              </div>
            </fieldset>
            
            <fieldset className="mb-4 sm:mb-5">
              <legend className="sr-only">Security Information</legend>
              
              <div className="form-group mb-3 sm:mb-4">
                <label htmlFor="password" className="block mb-1.5 text-sm sm:text-base font-medium text-gray-700">Password</label>
                <input 
                  type="password" 
                  id="password" 
                  name="password"
                  className="w-full border border-gray-300 p-2 sm:p-2.5 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm sm:text-base" 
                  required 
                />
                <small className="text-gray-500 mt-1 block text-xs sm:text-sm">Must be 8+ characters, with an uppercase letter & a special character.</small>
              </div>
              
              <div className="form-group mb-4 sm:mb-5">
                <label htmlFor="confirmPassword" className="block mb-1.5 text-sm sm:text-base font-medium text-gray-700">Confirm Password</label>
                <input 
                  type="password" 
                  id="confirmPassword" 
                  name="confirmPassword"
                  className="w-full border border-gray-300 p-2 sm:p-2.5 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm sm:text-base" 
                  required 
                />
              </div>
            </fieldset>
            
            <button 
              type="submit" 
              className="bg-green-600 hover:bg-green-700 text-white py-2 sm:py-2.5 px-4 rounded-lg transition-colors w-full font-medium text-sm sm:text-base shadow-sm"
            >
              Sign Up
            </button>
          </form>
          
          <footer className="w-full max-w-md text-center mt-6 sm:mt-8">
            <p className="text-sm sm:text-base text-gray-600">Already have an account? <Link to="/login" className="text-green-600 hover:text-green-700 hover:underline font-medium">Log In</Link></p>
          </footer>
        </section>
        
        <aside className="lg:w-1/3 mt-6 lg:mt-0 bg-green-50 rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-green-800">Benefits of joining:</h2>
          <ul className="space-y-2.5 sm:space-y-3 text-sm sm:text-base text-gray-700">
            <li className="flex items-start">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
              </svg>
              <span>Create and join game rooms with friends</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
              </svg>
              <span>Compete in naming animals in succession</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
              </svg>
              <span>Make a mistake or repeat a name, and you're out!</span>
            </li>
            <li className="flex items-start">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
              </svg>
              <span>Up to 4 players per room</span>
            </li>
          </ul>
          
          <div className="mt-4 sm:mt-6 bg-white p-3 sm:p-4 rounded-lg border border-green-200">
            <h3 className="font-semibold text-sm sm:text-base md:text-lg mb-1 sm:mb-2 text-gray-800">How to Play:</h3>
            <p className="text-xs sm:text-sm text-gray-700">When one player names an animal, the next has to name one starting with the letter the previous animal's name ended with.</p>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default Signup;