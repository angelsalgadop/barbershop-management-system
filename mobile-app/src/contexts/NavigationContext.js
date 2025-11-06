import React, {createContext, useState, useContext} from 'react';

const NavigationContext = createContext({});

export const NavigationProvider = ({children}) => {
  const [currentScreen, setCurrentScreen] = useState('Login');
  const [navigationStack, setNavigationStack] = useState(['Login']);
  const [params, setParams] = useState({});

  const navigate = (screenName, screenParams = {}) => {
    setCurrentScreen(screenName);
    setNavigationStack(prev => [...prev, screenName]);
    setParams(screenParams);
  };

  const goBack = () => {
    if (navigationStack.length > 1) {
      const newStack = [...navigationStack];
      newStack.pop(); // Remove current screen
      const previousScreen = newStack[newStack.length - 1];
      setCurrentScreen(previousScreen);
      setNavigationStack(newStack);
    }
  };

  const replace = (screenName, screenParams = {}) => {
    setCurrentScreen(screenName);
    const newStack = [...navigationStack];
    newStack[newStack.length - 1] = screenName;
    setNavigationStack(newStack);
    setParams(screenParams);
  };

  const reset = (screenName) => {
    setCurrentScreen(screenName);
    setNavigationStack([screenName]);
    setParams({});
  };

  return (
    <NavigationContext.Provider
      value={{
        currentScreen,
        navigate,
        goBack,
        replace,
        reset,
        params,
        canGoBack: navigationStack.length > 1,
      }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

export default NavigationContext;
