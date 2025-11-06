import React from 'react';
import {createDrawerNavigator} from '@react-navigation/drawer';

// Pantallas de Barbershop
import BarbershopDashboardScreen from '../screens/barbershop/BarbershopDashboardScreen';
import BarbersScreen from '../screens/barbershop/BarbersScreen';
import SchedulesScreen from '../screens/barbershop/SchedulesScreen';
import AppointmentsScreen from '../screens/barbershop/AppointmentsScreen';
import WhatsAppScreen from '../screens/barbershop/WhatsAppScreen';

const Drawer = createDrawerNavigator();

const BarbershopNavigator = () => {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerActiveTintColor: '#007AFF',
        headerTintColor: '#007AFF',
      }}>
      <Drawer.Screen
        name="Dashboard"
        component={BarbershopDashboardScreen}
        options={{title: 'Panel Principal'}}
      />
      <Drawer.Screen
        name="Barbers"
        component={BarbersScreen}
        options={{title: 'Mis Barberos'}}
      />
      <Drawer.Screen
        name="Schedules"
        component={SchedulesScreen}
        options={{title: 'Horarios'}}
      />
      <Drawer.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{title: 'Turnos'}}
      />
      <Drawer.Screen
        name="WhatsApp"
        component={WhatsAppScreen}
        options={{title: 'WhatsApp Bot'}}
      />
    </Drawer.Navigator>
  );
};

export default BarbershopNavigator;
