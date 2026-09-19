import { ChatInputBar } from "../components/ChatInputBar";
import { Conversation } from "../components/Conversation";
import { Header } from "../components/Header";

export function ChatPage() {
  return (
    <main className="relative flex h-screen flex-col">
      <Header />
      <Conversation />
      <ChatInputBar />
    </main>
  );
}
