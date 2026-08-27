import { useAuth } from '@immediately-run/sdk/auth';
import type { Config } from '../lib/types';

/** Who is playing: the host login when signed in, else the name typed into the
 *  lobby, else '' (correspondence needs a name; solo play does not). */
export function useMe(config: Config): { me: string; fromHost: boolean; authKnown: boolean } {
  const { user, status } = useAuth();
  const login = user?.login?.trim() ?? '';
  if (login) return { me: login, fromHost: true, authKnown: true };
  return { me: config.name?.trim() ?? '', fromHost: false, authKnown: status !== 'unknown' };
}
