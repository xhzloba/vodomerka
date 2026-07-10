import { execSync } from 'node:child_process';
import os from 'node:os';

function formatLoginName(username: string): string {
  const cleaned = username.split(/[\\/]/).pop()?.trim() ?? username;

  if (!cleaned) {
    return '';
  }

  return cleaned
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function readMacGivenName(username: string): string | null {
  try {
    const output = execSync(`dscl . -read /Users/${username} RealName`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.match(/RealName:\s*\n?\s*(.+)/);
    const realName = match?.[1]?.trim();

    if (!realName || realName.toLowerCase() === username.toLowerCase()) {
      return null;
    }

    return realName.split(/\s+/)[0] ?? realName;
  } catch {
    return null;
  }
}

function readWindowsGivenName(username: string): string | null {
  try {
    const output = execSync(`net user "${username}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.match(/Full Name\s+(.+)/i);
    const fullName = match?.[1]?.trim();

    if (!fullName) {
      return null;
    }

    return fullName.split(/\s+/)[0] ?? fullName;
  } catch {
    return null;
  }
}

export function getSystemUserDisplayName(): string | null {
  try {
    const { username } = os.userInfo();

    if (!username) {
      return null;
    }

    const loginName = username.split(/[\\/]/).pop() ?? username;

    if (process.platform === 'darwin') {
      return readMacGivenName(loginName) ?? formatLoginName(loginName);
    }

    if (process.platform === 'win32') {
      return readWindowsGivenName(loginName) ?? formatLoginName(loginName);
    }

    return formatLoginName(loginName);
  } catch {
    return null;
  }
}
