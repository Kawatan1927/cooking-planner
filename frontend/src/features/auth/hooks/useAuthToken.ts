import { useAuth } from './useAuth';

export function useAuthToken(): string | null {
  return useAuth().token;
}
