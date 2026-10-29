/**
 * Returns the repository name when a pathname points into repository settings.
 * @param pathname - Current browser pathname.
 * @returns The owner/repository name, or `null` outside settings.
 */
export const getRepositoryName = (pathname: string): string | null => {
  const [, owner, repository, section] = pathname.split("/");

  return owner !== undefined &&
    repository !== undefined &&
    section === "settings"
    ? `${owner}/${repository}`
    : null;
};
