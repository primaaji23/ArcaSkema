export function getToken() {
  return localStorage.getItem("token");
}

export function getRole(): "admin" | "user" | null {
  return localStorage.getItem("role") as any;
}

export function isAdmin() {
  return getRole() === "admin";
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.reload();
}
