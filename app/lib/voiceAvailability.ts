export function voiceDeploymentEnabled(environment: string | undefined, nodeEnvironment: string | undefined, configured?: string) {
  if (configured !== undefined) return configured.trim().toLowerCase() === "true";
  return environment === "preview" || (!environment && nodeEnvironment === "development");
}
