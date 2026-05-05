import { createContext, useContext } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  return (
    <UserContext.Provider value={{ user: null, token: null, loading: false, login: () => {}, logout: () => {} }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
