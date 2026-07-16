import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ActivityPage } from "./pages/ActivityPage";
import { AgentsPage } from "./pages/AgentsPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { ChatPage } from "./pages/ChatPage";
import { ControlCenterPage } from "./pages/ControlCenterPage";
import { CronPage } from "./pages/CronPage";
import { FilesPage } from "./pages/FilesPage";
import { InboxPage } from "./pages/InboxPage";
import { KanbanPage } from "./pages/KanbanPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { MemoryPage } from "./pages/MemoryPage";
import { ObservatoryPage } from "./pages/ObservatoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SkillsPage } from "./pages/SkillsPage";
import { SwitchboardPage } from "./pages/SwitchboardPage";
import { TradingPage } from "./pages/TradingPage";
import { UsagePage } from "./pages/UsagePage";
import { VibePage } from "./pages/VibePage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/observatory" replace />} />
        <Route path="observatory" element={<ObservatoryPage />} />
        <Route path="chat" element={<Navigate to="/chat/pi" replace />} />
        <Route path="chat/pi" element={<ChatPage agent="pi" />} />
        <Route path="chat/codex" element={<ChatPage agent="codex" />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="cron" element={<CronPage />} />
        <Route path="kanban" element={<KanbanPage />} />
        <Route path="missions" element={<Navigate to="/kanban" replace />} />
        <Route path="automations" element={<Navigate to="/cron" replace />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="artifacts" element={<ArtifactsPage />} />
        <Route path="memory" element={<MemoryPage />} />
        <Route path="vibe" element={<VibePage />} />
        <Route path="trading" element={<TradingPage />} />
        <Route path="switchboard" element={<SwitchboardPage />} />
        <Route path="control" element={<ControlCenterPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/observatory" replace />} />
    </Routes>
  );
}
