import { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../translations";

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem("app_lang");
      return saved === "en" ? "en" : "vi";
    } catch {
      return "vi";
    }
  });

  useEffect(() => {
    localStorage.setItem("app_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key) => {
    // Basic nested key support (e.g. 'thinkingSteps.step1')
    const keys = key.split(".");
    let value = translations[lang];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
