import { ChatProvider, useChatSettings } from "./context/ChatContext";
import { ChatPage } from "./pages/ChatPage";
import { SettingsPage } from "./pages/SettingsPage";

function AppContent() {
  const { settingsOpen } = useChatSettings();
  return settingsOpen ? <SettingsPage /> : <ChatPage />;
}

export function App() {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  );
}
