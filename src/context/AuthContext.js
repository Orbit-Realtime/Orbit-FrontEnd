import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const memberId = sessionStorage.getItem("memberId");
    const nickname = sessionStorage.getItem("nickname");
    if (memberId && nickname) {
      return { memberId: Number(memberId), nickname };
    }
    return null;
  });

  const signin = (memberId, nickname) => {
    sessionStorage.setItem("memberId", memberId);
    sessionStorage.setItem("nickname", nickname);
    setAuth({ memberId, nickname });
  };

  const signout = () => {
    sessionStorage.removeItem("memberId");
    sessionStorage.removeItem("nickname");
    setAuth(null);
  };

  return (
    <AuthContext.Provider value={{ auth, signin, signout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
