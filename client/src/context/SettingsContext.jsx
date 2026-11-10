import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api.js';

const SettingsContext = createContext({ settings: null });

/** Public, admin-configured site settings (contact details, social links). Empty until configured. */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    api
      .get('/settings')
      .then((r) => setSettings(r.data.data))
      .catch(() => setSettings({ contact: {}, social: {}, site: {} }));
  }, []);
  return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => useContext(SettingsContext);
