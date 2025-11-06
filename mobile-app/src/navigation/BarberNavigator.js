import React from 'react';
import {createDrawerNavigator} from '@react-navigation/drawer';

// Pantallas de Barber
import BarberDashboardScreen from '../screens/barber/BarberDashboardScreen';
import QueueScreen from '../screens/barber/QueueScreen';
import BarberScheduleScreen from '../screens/barber/BarberScheduleScreen';

const Drawer = createDrawerNavigator();

const BarberNavigator = () => {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerActiveTintColor: '#007AFF',
        headerTintColor: '#007AFF',
      }}>
      <Drawer.Screen
        name="Dashboard"
        component={BarberDashboardScreen}
        options={{title: 'Mi Panel'}}
      />
      <Drawer.Screen
        name="Queue"
        component={QueueScreen}
        options={{title: 'Cola de Turnos'}}
      />
      <Drawer.Screen
        name="Schedule"
        component={BarberScheduleScreen}
        options={{title: 'Mi Horario'}}
      />
    </Drawer.Navigator>
  );
};

export default BarberNavigator;
