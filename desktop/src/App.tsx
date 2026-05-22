import { Navigate, Route, Routes } from "react-router-dom";

import LoginView from "@/views/Login";
import RegisterView from "@/views/Register";
import ProjectPickerView from "@/views/ProjectPicker";
import SettingsView from "@/views/Settings";
import CockpitView from "@/views/Cockpit";
import AgentDashboardView from "@/views/AgentDashboard";

import { useAuthStore } from "@/store/auth";

function RequireAuth({ children }: { children: JSX.Element }) {
  const tokens = useAuthStore((s) => s.tokens);
  if (!tokens) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route path="/register" element={<RegisterView />} />
      <Route
        path="/projects"
        element={
          <RequireAuth>
            <ProjectPickerView />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsView />
          </RequireAuth>
        }
      />
      <Route
        path="/cockpit/:projectId"
        element={
          <RequireAuth>
            <CockpitView />
          </RequireAuth>
        }
      />
      <Route
        path="/cockpit/:projectId/agent/:role"
        element={
          <RequireAuth>
            <AgentDashboardView />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
