import { useState, useEffect, useRef } from 'react';
import { Isoflow } from 'fossflow';
import { flattenCollections } from '@isoflow/isopacks/dist/utils';
import isoflowIsopack from '@isoflow/isopacks/dist/isoflow';
import { useTranslation } from 'react-i18next';
import {
  DiagramData,
  mergeDiagramData,
  extractSavableData
} from './diagramUtils';
import { StorageManager } from './StorageManager';
import { DiagramManager } from './components/DiagramManager';
import { storageManager } from './services/storageService';
import ChangeLanguage from './components/ChangeLanguage';
import { allLocales } from 'fossflow';
import { useIconPackManager, IconPackName } from './services/iconPackManager';
import './App.css';
import { BrowserRouter, Navigate, Route, Routes, useParams, useLocation } from 'react-router-dom';
import LoginPage from "./pages/LoginPage";
import EditorPage from "./EditorPage";
import Dashboard from "./pages/Dashboard";
import InventoryPage from "./pages/InventoryPage";
import AssetsPage from "./pages/AssetsPage";
import { getToken, isAdmin, logout, isExpired, getExpiry} from "./auth/auth";

// Load core isoflow icons (always loaded)
const coreIcons = flattenCollections([isoflowIsopack]);

interface SavedDiagram {
  id: string;
  name: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = getToken();

  if (!token) return <Navigate to="/login" replace />;

  if (isExpired()) {
    logout();
    return (
      <Navigate
        to="/login"
        replace
        state={{ sessionExpired: true }}
      />
    );
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<LoginPage />} />

        <Route path="/logout" element={<LogoutHandler />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flow"
          element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assets"
          element={
            <ProtectedRoute>
              <AssetsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

function LogoutHandler() {
  logout();
  return <Navigate to="/login" replace />;
}


// export default App;