import React from 'react';
import {createDrawerNavigator} from '@react-navigation/drawer';
import {createStackNavigator} from '@react-navigation/stack';

// Pantallas de Admin
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import BarbershopsScreen from '../screens/admin/BarbershopsScreen';
import BillingScreen from '../screens/admin/BillingScreen';

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

const AdminNavigator = () => {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerActiveTintColor: '#007AFF',
        headerTintColor: '#007AFF',
      }}>
      <Drawer.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{title: 'Panel Admin'}}
      />
      <Drawer.Screen
        name="Barbershops"
        component={BarbershopsScreen}
        options={{title: 'Barberías'}}
      />
      <Drawer.Screen
        name="Billing"
        component={BillingScreen}
        options={{title: 'Facturación'}}
      />
    </Drawer.Navigator>
  );
};

export default AdminNavigator;
