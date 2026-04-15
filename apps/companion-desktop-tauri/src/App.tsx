import { useDesktopApp } from './lib/useDesktopApp';
import { Sidebar, type NavTab } from './components/Sidebar';
import { ChatPanel } from './panels/ChatPanel';
import { ApprovalsPanel } from './panels/ApprovalsPanel';
import { InferencePanel } from './panels/InferencePanel';
import { AiDashboardPanel } from './panels/AiDashboardPanel';
import { BrainPanel } from './panels/BrainPanel';
import { CommunityAgentsPanel } from './panels/CommunityAgentsPanel';
import { FederationPanel } from './panels/FederationPanel';
import { ProfilePanel } from './panels/ProfilePanel';
import ThemePanel from './panels/ThemePanel';
import OrgSwitcherPanel from './panels/OrgSwitcherPanel';
import ActivityPanel from './panels/ActivityPanel';
import SearchPanel from './panels/SearchPanel';
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
      case 'inference':
        return (
          <InferencePanel
            ollamaOnline={app.ollamaOnline}
            models={app.localModels}
            activeModelId={app.activeLocalModelId}
            lastResponse={app.lastInferenceResponse}
            pulling={app.pullingModel}
            generating={app.generating}
            onPullModel={app.onPullModel}
            onDeleteModel={app.onDeleteModel}
            onGenerate={app.onLocalGenerate}
            onSetActiveModel={app.setActiveLocalModelId}
            onRefreshModels={app.onRefreshLocalModels}
          />
        );
      case 'ai-dashboard':
        return (
          <AiDashboardPanel
            token={app.token}
            apiBase={app.config.gateway_url ?? ''}
          />
        );
      case 'brain':
        return (
          <BrainPanel
            token={app.token}
            apiBase={app.config.gateway_url ?? ''}
          />
        );
      case 'community-agents':
        return (
          <CommunityAgentsPanel
            token={app.token}
            apiBase={app.config.gateway_url ?? ''}
          />
        );
      case 'federation':
        return (
          <FederationPanel
            token={app.token}
            apiBase={app.config.gateway_url ?? ''}
          />
        );
      case 'profile':
        return (
          <ProfilePanel
            token={app.token}
            apiBase={app.config.gateway_url ?? ''}
          />
        );
      case 'theme':
        return <ThemePanel />;
      case 'workspaces':
        return <OrgSwitcherPanel />;
      case 'activity':
        return <ActivityPanel />;
      case 'search':
        return <SearchPanel />;
      case 'settings':
        return (
          <SettingsPanel
            config={app.config}
            token={app.token}
            deviceCode={app.deviceCode}
            verifyUrl={app.verifyUrl}
            deviceBusy={app.deviceBusy}
            savedAccounts={app.savedAccounts}
            onConfigChange={app.setConfig}
            onSaveConfig={app.onSaveConfig}
            onDeviceLogin={app.onDeviceLogin}
            onRefreshSession={app.onRefreshSession}
            onSignOut={app.onSignOut}
            onKeepSignedIn={app.onKeepSignedIn}
            onSwitchAccount={app.onSwitchAccount}
            onUnlinkAccount={app.onUnlinkAccount}
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

