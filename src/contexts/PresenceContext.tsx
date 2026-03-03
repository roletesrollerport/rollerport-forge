import { createContext, useContext } from 'react';

interface PresenceContextType {
  onlineUserIds: Set<string>;
}

export const PresenceContext = createContext<PresenceContextType>({ onlineUserIds: new Set() });

export function usePresenceContext() {
  return useContext(PresenceContext);
}
