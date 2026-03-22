export const INTEGRATION_AUTOSTART_DEPLOY_FAILED_CODE = 'INTEGRATION_AUTOSTART_DEPLOY_FAILED';

export function buildAutoStartDeployFailureMessage(integrationType: string): string {
  return `Auto-start failed for ${integrationType} (${INTEGRATION_AUTOSTART_DEPLOY_FAILED_CODE}). Check integration runtime logs for details.`;
}
