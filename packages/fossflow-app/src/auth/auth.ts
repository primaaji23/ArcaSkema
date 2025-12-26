import { useNavigate } from "react-router-dom";

export function useLogout(){
  const navigate = useNavigate();

  return () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };
}

let accessToken: string | null = null;

export function setToken(token: string) {
  accessToken = token;
  localStorage.setItem("access_token", token);
}

export function getToken() {
  const token = localStorage.getItem("token");
  const expiresAt = localStorage.getItem("expiresAt");

  if (!token || !expiresAt) return null;

  const now = Date.now();

  // Check expiry
  if (now > Number(expiresAt)) {
    logout();
    return null;
  }

  return token;
}

export function getRole(): "admin" | "user" | null {
  return localStorage.getItem("role") as any;
}

export function isAdmin() {
  return getRole() === "admin";
}

// export function isExpired() {
//   const exp = localStorage.getItem("expiresAt");
//   if (!exp) return true;
//   return Date.now() > Number(exp);
// }

export function isExpired() {
  try {
    const token = getToken();
    if (!token) return true;

    const payload = JSON.parse(
      decodeURIComponent(
        atob(token.split('.')[1])
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    );

    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// export function getToken() {
//   return localStorage.getItem("token");
// }

export function getExpiry() {
  const exp = localStorage.getItem("expiresAt");
  return exp ? Number(exp) : 0;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("expiresAt");

  // window.location.href = "/login";
}
