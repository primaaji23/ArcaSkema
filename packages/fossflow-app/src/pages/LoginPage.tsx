import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        alert("Login gagal");
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      window.location.reload();
    } catch (error) {
      alert("Terjadi kesalahan koneksi");
      setIsLoading(false);
    }
  }

  return (
    <div className="login-container">
      <style>{`
        .login-container {
          height: 100vh; 
          width: 100vw; 
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(to right, #b91c1c, #dc2626);
          font-family: 'Segoe UI', sans-serif;
          overflow: hidden; 
          position: fixed; 
          top: 0;
          left: 0;
          padding: 20px;
          box-sizing: border-box; 
        }


        .animated-bg {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          z-index: 0;
          pointer-events: none;
        }
      
        .login-card {
          position: relative;
          z-index: 1;
          background: white;
          width: 100%;
          max-width: 400px;
          padding: 30px; 
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          text-align: center;
          max-height: 90vh;
          overflow-y: auto; 
        }

        .logo {
          width: 200px;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 20px;
          text-align: left;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          color: #333;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .form-group input {
          width: 100%;
          padding: 12px 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 16px;
          box-sizing: border-box;
          transition: border-color 0.3s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #dc2626;
        }

        .toggle-btn {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
        }

        .login-btn {
          width: 100%;
          background: #dc2626;
          color: white;
          padding: 14px;
          font-size: 1rem;
          font-weight: bold;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.3s;
          margin-top: 10px;
        }

        .login-btn:hover {
          background: #b91c1c;
        }

        .login-btn:disabled {
          background: #999;
          cursor: not-allowed;
        }

        .powered-by {
          font-size: 0.8rem;
          color: #666;
          margin-top: 20px;
        }

        .powered-by b {
          color: #dc2626;
        }
      `}</style>

      <svg
        className="animated-bg"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="200" cy="100" r="80" fill="#ffffff22">
          <animate
            attributeName="cy"
            values="100;150;100"
            dur="6s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="600" cy="400" r="120" fill="#ffffff15">
          <animate
            attributeName="cy"
            values="400;450;400"
            dur="8s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="400" cy="300" r="50" fill="#ffffff18">
          <animate
            attributeName="r"
            values="50;60;50"
            dur="5s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      <div className="login-card">
        {/* <img className="logo" src="img/candilite.png" alt="Candi Logo" /> */}

        <form onSubmit={login}>
          <div className="form-group">
            <label>Username</label>
            <input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button className="login-btn" type="submit" disabled={isLoading}>
            {isLoading ? "Loading..." : "Login"}
          </button>
        </form>

        <p className="powered-by">
          Powered by <b>Candi Elektronik</b>
        </p>
      </div>
    </div>
  );
}
