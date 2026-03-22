import { useDesktopApp } from './lib/useDesktopApp';
import { Sidebar, type NavTab } from './components/Sidebar';
import { ChatPanel } from './panels/ChatPanel';
import { ApprovalsPanel } from './panels/ApprovalsPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { LogPanel } from './panels/LogPanel';

function App() {
  const app = useDesktopApp();

  function renderPanel() {
    switch (app.activeTab as NavTab) {
      case 'chat':
        return (
          <ChatPanel
            chatId={app.config.chat_id}
            token={app.token}
            timeline={app.timeline}
            sending={app.sending}
            syncing={app.syncingTimeline}
            onSend={app.onSend}
            onRefresh={app.onRefreshTimeline}
          />
        );
      case 'approvals':
        return (
          <ApprovalsPanel
            approvals={app.approvals}
            actioning={app.approvalActioning}
            token={app.token}
            onVote={app.onVoteApproval}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            config={app.config}
            token={app.token}
            deviceCode={app.deviceCode}
            verifyUrl={app.verifyUrl}
            deviceBusy={app.deviceBusy}
            onConfigChange={app.setConfig}
            onSaveConfig={app.onSaveConfig}
            onDeviceLogin={app.onDeviceLogin}
            onRefreshSession={app.onRefreshSession}
            onSignOut={app.onSignOut}
          />
        );
      case 'log':
        return (
          <LogPanel
            logs={app.logs}
            onClear={app.onClearLogs}
          />
        );
    }
  }

  return (
    <div className="shell">
      <Sidebar
        active={app.activeTab}
        onNavigate={app.setActiveTab}
        pendingApprovals={app.approvals.length}
        status={app.status}
      />
      <main className="main-content">
        {renderPanel()}
      </main>
    </div>
  );
}

export default App;

