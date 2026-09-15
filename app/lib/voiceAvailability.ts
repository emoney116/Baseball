export function voiceDeploymentEnabled(environment: string | undefined, nodeEnvironment: string | undefined) {
  return environment === "preview" || (!environment && nodeEnvironment === "development");
}
