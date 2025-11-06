import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useAuth} from '../../contexts/AuthContext';

const AdminDashboardScreen = () => {
  const {user, logout} = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panel Administrador</Text>
      <Text style={styles.subtitle}>Bienvenido, {user.name}</Text>
      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20},
  title: {fontSize: 24, fontWeight: 'bold', color: '#333'},
  subtitle: {fontSize: 16, color: '#666', marginTop: 8, marginBottom: 32},
  button: {backgroundColor: '#FF3B30', padding: 16, borderRadius: 8},
  buttonText: {color: '#fff', fontSize: 16, fontWeight: '600'},
});

export default AdminDashboardScreen;
