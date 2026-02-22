/** Strip the password from a connection string for safe logging. Preserves protocol, user, host, port, and path. */
export function formatConnectionStringForLogging(connectionString: string) {
  const connectionStringParsed = new URL(connectionString);
  const connectionStringInfo = `${connectionStringParsed.protocol ? `${connectionStringParsed.protocol}//` : ""}${connectionStringParsed.username ? `${connectionStringParsed.username}@` : ""}${connectionStringParsed.hostname}:${connectionStringParsed.port}${connectionStringParsed.pathname}`;
  return connectionStringInfo;
}
