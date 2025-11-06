import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {useAuth} from '../contexts/AuthContext';
import {ActivityIndicator, View} from 'react-native';

// Pantallas de autenticación
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Navegadores por rol
import AdminNavigator from './AdminNavigator';
import BarbershopNavigator from './BarbershopNavigator';
import BarberNavigator from './BarberNavigator';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const {isAuthenticated, loading, userType} = useAuth();

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        // Stack de autenticación
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      ) : (
        // Navegación según tipo de usuario
        <>
          {userType === 'admin' && <AdminNavigator />}
          {userType === 'barbershop' && <BarbershopNavigator />}
          {userType === 'barber' && <BarberNavigator />}
        </>
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;
