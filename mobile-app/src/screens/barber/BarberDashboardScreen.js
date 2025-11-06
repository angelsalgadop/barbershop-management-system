import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';

const BarberDashboardScreen = () => {
  console.log('=== BARBER DASHBOARD RENDERING ===');

  const [stats, setStats] = useState({
    totalToday: 0,
    completed: 0,
    inQueue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Función para obtener contextos de forma segura
  const getSafeContext = () => {
    try {
      const {useAuth} = require('../../contexts/AuthContext');
      const {useNavigation} = require('../../contexts/NavigationContext');

      const auth = useAuth();
      const nav = useNavigation();

      return {
        user: auth?.user || {name: 'Barbero'},
        logout: auth?.logout || (() => console.log('Logout')),
        navigate: nav?.navigate || (() => console.log('Navigate')),
      };
    } catch (error) {
      console.error('Error getting context:', error);
      return {
        user: {name: 'Barbero'},
        logout: () => console.log('Logout'),
        navigate: () => console.log('Navigate'),
      };
    }
  };

  const {user, logout, navigate} = getSafeContext();

  console.log('Barber user:', user?.name);

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log('Loading barber stats for:', user?.barber_id, 'date:', today);

      // Timeout de 5 segundos para la carga de stats
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Stats loading timeout')), 5000)
      );

      const response = await Promise.race([
        api.get(`/api/appointments/barber/${user?.barber_id}/${today}`),
        timeoutPromise
      ]);

      const appointments = response.data;

      const totalToday = appointments.length;
      const completed = appointments.filter(a => a.status === 'completed').length;
      const inQueue = appointments.filter(a => a.status === 'waiting').length;

      setStats({ totalToday, completed, inQueue });
      console.log('Barber stats:', { totalToday, completed, inQueue });
    } catch (error) {
      console.error('Error loading barber stats:', error);
      // Continuar con stats por defecto, no bloquear la UI
      setStats({
        totalToday: 0,
        completed: 0,
        inQueue: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.barber_id) {
      loadStats();
    } else {
      // Si no hay barber_id después de 2 segundos, dejar de cargar
      const timeout = setTimeout(() => {
        console.log('No barber_id found, stopping loading');
        setLoading(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [user?.barber_id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>¡Hola, {user?.name || 'Barbero'}!</Text>
          <Text style={styles.subtitleText}>Panel de Barbero</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, {backgroundColor: '#007AFF'}]}>
          <Text style={styles.statNumber}>{stats.totalToday || 0}</Text>
          <Text style={styles.statLabel}>Turnos Hoy</Text>
        </View>

        <View style={[styles.statCard, {backgroundColor: '#34C759'}]}>
          <Text style={styles.statNumber}>{stats.completed || 0}</Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>

        <View style={[styles.statCard, {backgroundColor: '#FF9500'}]}>
          <Text style={styles.statNumber}>{stats.inQueue || 0}</Text>
          <Text style={styles.statLabel}>En Cola</Text>
        </View>
      </View>

      {/* Cola de Turnos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cola de Turnos</Text>

        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No hay turnos en cola</Text>
        </View>

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => {
            console.log('Navigate to Queue');
            navigate('Queue');
          }}>
          <Text style={styles.viewAllText}>Ver todas las colas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => {
            console.log('Navigate to BarberSchedule');
            navigate('BarberSchedule');
          }}>
          <Text style={styles.viewAllText}>Mi Horario</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewAllButton, {backgroundColor: '#9b59b6'}]}
          onPress={() => {
            console.log('Navigate to Profile');
            navigate('Profile');
          }}>
          <Text style={styles.viewAllText}>Mi Perfil</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitleText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  viewAllButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  viewAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BarberDashboardScreen;
