import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';

const BarbershopDashboardScreen = () => {
  console.log('=== BARBERSHOP DASHBOARD RENDERING ===');

  const [stats, setStats] = useState({
    today_appointments: 0,
    monthly_appointments: 0,
    active_barbers: 0,
    waiting_clients: 0,
    todayRevenue: 0,
    totalClients: 0,
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
        user: auth?.user || {name: 'Usuario', business_name: 'Mi Barbería'},
        logout: auth?.logout || (() => console.log('Logout')),
        navigate: nav?.navigate || (() => console.log('Navigate')),
      };
    } catch (error) {
      console.error('Error getting context:', error);
      return {
        user: {name: 'Usuario', business_name: 'Mi Barbería'},
        logout: () => console.log('Logout'),
        navigate: () => console.log('Navigate'),
      };
    }
  };

  const {user, logout, navigate} = getSafeContext();

  console.log('User:', user?.name);

  const loadStats = async () => {
    try {
      console.log('Loading barbershop stats for:', user?.barbershop_id);

      // Timeout de 5 segundos para la carga de stats
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Stats loading timeout')), 5000)
      );

      const response = await Promise.race([
        api.get(`/api/barbershops/${user?.barbershop_id}/stats`),
        timeoutPromise
      ]);

      console.log('Stats loaded:', response.data);
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
      // Continuar con stats por defecto, no bloquear la UI
      setStats({
        today_appointments: 0,
        monthly_appointments: 0,
        active_barbers: 0,
        waiting_clients: 0,
        todayRevenue: 0,
        totalClients: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.barbershop_id) {
      loadStats();
    } else {
      // Si no hay barbershop_id después de 2 segundos, dejar de cargar
      const timeout = setTimeout(() => {
        console.log('No barbershop_id found, stopping loading');
        setLoading(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [user?.barbershop_id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3498db']} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hola, {user?.name || 'Usuario'}</Text>
            <Text style={styles.businessName}>{user?.business_name || 'Mi Barbería'}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutIcon}>🚪</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📅</Text>
            <Text style={styles.statValue}>{stats.today_appointments || 0}</Text>
            <Text style={styles.statLabel}>Citas Hoy</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>${stats.todayRevenue || 0}</Text>
            <Text style={styles.statLabel}>Ingresos Hoy</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>✂</Text>
            <Text style={styles.statValue}>{stats.active_barbers || 0}</Text>
            <Text style={styles.statLabel}>Barberos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statValue}>{stats.totalClients || 0}</Text>
            <Text style={styles.statLabel}>Clientes</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestión</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('Navigate to Barbers');
              navigate('Barbers');
            }}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuIcon}>✂️</Text>
              <View>
                <Text style={styles.menuTitle}>Barberos</Text>
                <Text style={styles.menuSubtitle}>Gestionar equipo de trabajo</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('Navigate to Appointments');
              navigate('Appointments');
            }}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuIcon}>📅</Text>
              <View>
                <Text style={styles.menuTitle}>Citas</Text>
                <Text style={styles.menuSubtitle}>Ver y gestionar citas</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('Navigate to Schedules');
              navigate('Schedules');
            }}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuIcon}>🕒</Text>
              <View>
                <Text style={styles.menuTitle}>Horarios</Text>
                <Text style={styles.menuSubtitle}>Configurar disponibilidad</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('Navigate to WhatsApp');
              navigate('WhatsApp');
            }}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuIcon}>💬</Text>
              <View>
                <Text style={styles.menuTitle}>WhatsApp</Text>
                <Text style={styles.menuSubtitle}>Integración y mensajes</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('Navigate to Reports');
              navigate('Reports');
            }}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuIcon}>📊</Text>
              <View>
                <Text style={styles.menuTitle}>Reportes</Text>
                <Text style={styles.menuSubtitle}>Ingresos y comisiones</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              console.log('Navigate to Profile');
              navigate('Profile');
            }}>
            <View style={styles.menuItemLeft}>
              <Text style={styles.menuIcon}>👤</Text>
              <View>
                <Text style={styles.menuTitle}>Mi Perfil</Text>
                <Text style={styles.menuSubtitle}>Configuración de cuenta</Text>
              </View>
            </View>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>mibarberiaweb.com</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#2c3e50',
  },
  greeting: {
    fontSize: 16,
    color: '#bdc3c7',
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  logoutIcon: {
    fontSize: 28,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
    marginLeft: '1%',
    marginRight: '1%',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#7f8c8d',
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 20,
    color: '#bdc3c7',
  },
  footer: {
    alignItems: 'center',
    padding: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#3498db',
    fontWeight: '600',
  },
});

export default BarbershopDashboardScreen;
