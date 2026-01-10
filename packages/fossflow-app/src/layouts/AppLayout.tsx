import React, { ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: "flex" }}>
      <aside
        style={{
          width: collapsed ? "64px" : "240px",
          transition: "0.25s",
          height: "100vh",
          background: "#1F2937",
          color: "#fff",
          position: "fixed",
          left: 0,
          top: 0,
          overflow: "hidden",
        }}
      >
        <button
          style={{
            margin: 16,
            background: "#374151",
            border: "none",
            color: "#fff",
            padding: "6px 10px",
            cursor: "pointer",
            borderRadius: 6,
          }}
          onClick={() => setCollapsed(prev => !prev)}
        >
          {collapsed ? "☰" : "×"}
        </button>

        {!collapsed && (
          <ul style={{ listStyle: "none", padding: 12 }}>
            <li>
              <NavLink
                to="/dashboard"
                onClick={() => setTimeout(() => window.location.reload(), 0)}
                style={({ isActive }) => ({
                  display: "block",
                  padding: 8,
                  borderRadius: 6,
                  textDecoration: "none",
                  color: "#fff",
                  background: isActive ? "#374151" : "transparent",
                })}
              >
                Dashboard
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/inventory"
                onClick={() => setTimeout(() => window.location.reload(), 0)}
                style={({ isActive }) => ({
                  display: "block",
                  padding: 8,
                  borderRadius: 6,
                  textDecoration: "none",
                  color: "#fff",
                  background: isActive ? "#374151" : "transparent",
                })}
              >
                Inventory
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/assets"
                onClick={() => setTimeout(() => window.location.reload(), 0)}
                style={({ isActive }) => ({
                  display: "block",
                  padding: 8,
                  borderRadius: 6,
                  textDecoration: "none",
                  color: "#fff",
                  background: isActive ? "#374151" : "transparent",
                })}
              >
                Assets
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/flow"
                onClick={() => setTimeout(() => window.location.reload(), 0)}
                style={({ isActive }) => ({
                  display: "block",
                  padding: 8,
                  borderRadius: 6,
                  textDecoration: "none",
                  color: "#fff",
                  background: isActive ? "#374151" : "transparent",
                })}
              >
                Flow Jaringan
              </NavLink>
            </li>
          </ul>
        )}
      </aside>

      <main
        style={{
          marginLeft: collapsed ? "64px" : "240px",
          transition: "0.25s",
          padding: 24,
          width: "100%",
        }}
      >
        {children}
      </main>
    </div>
  );
}
