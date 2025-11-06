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

const AdminDashboardScreen = () => {
  console.log('=== ADMIN DASHBOARD RENDERING ===');

  const [stats, setStats] = useState({
    totalBarbershops: 0,
    totalBarbers: 0,
    todayAppointments: 0,
    monthRevenue: 0,
    suspendedBarbershops: 0,
    pendingPayments: 0,
  });
  const [barbershopsCount, setBarbershopsCount] = useState(0);
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
        user: auth?.user || {name: 'Admin'},
        logout: auth?.logout || (() => console.log('Logout')),
        navigate: nav?.navigate || (() => console.log('Navigate')),
      };
    } catch (error) {
      console.error('Error getting context:', error);
      return {
        user: {name: 'Admin'},
        logout: () => console.log('Logout'),
        navigate: () => console.log('Navigate'),
      };
    }
  };

  const {user, logout, navigate} = getSafeContext();

  console.log('Admin user:', user?.name);

  const loadStats = async () => {
    try {
      console.log('Loading admin dashboard stats...');

      // Timeout de 5 segundos para la carga de stats
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Stats loading timeout')), 5000)
      );

      const [dashboardResponse, barbershopsResponse] = await Promise.race([
        Promise.all([
          api.get('/api/admin/dashboard'),
          api.get('/api/barbershops'),
        ]),
        timeoutPromise
      ]);

      setStats(dashboardResponse.data);
      setBarbershopsCount(barbershopsResponse.data.length);
      console.log('Admin stats loaded:', dashboardResponse.data);
    } catch (error) {
      console.error('Error loading admin stats:', error);
      // Continuar con stats por defecto, no bloquear la UI
      setStats({
        totalBarbershops: 0,
        totalBarbers: 0,
        todayAppointments: 0,
        monthRevenue: 0,
        suspendedBarbershops: 0,
        pendingPayments: 0,
      });
      setBarbershopsCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
    // Timeout de seguridad: si no carga en 10 segundos, detener loading
    const timeout = setTimeout(() => {
      console.log('Stats loading timeout, stopping loading');
      setLoading(false);
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

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
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3498db']} />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Panel de Administración</Text>
          <Text style={styles.adminName}>{user?.name || 'Admin'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutIcon}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* Global Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estadísticas Globales</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, {backgroundColor: '#3498db'}]}>
            <Text style={styles.statIcon}>🏪</Text>
            <Text style={styles.statValue}>{stats.totalBarbershops || 0}</Text>
            <Text style={styles.statLabel}>Barberías</Text>
          </View>
          <View style={[styles.statCard, {backgroundColor: '#2ecc71'}]}>
            <Text style={styles.statIcon}>✂</Text>
            <Text style={styles.statValue}>{stats.totalBarbers || 0}</Text>
            <Text style={styles.statLabel}>Barberos</Text>
          </View>
          <View style={[styles.statCard, {backgroundColor: '#9b59b6'}]}>
            <Text style={styles.statIcon}>📅</Text>
            <Text style={styles.statValue}>{stats.todayAppointments || 0}</Text>
            <Text style={styles.statLabel}>Citas Hoy</Text>
          </View>
          <View style={[styles.statCard, {backgroundColor: '#e74c3c'}]}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>${stats.monthRevenue || 0}</Text>
            <Text style={styles.statLabel}>Ingresos Mes</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gestión</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            console.log('Navigate to Barbershops');
            navigate('Barbershops');
          }}>
          <View style={styles.menuItemLeft}>
            <Text style={styles.menuIcon}>🏪</Text>
            <View>
              <Text style={styles.menuTitle}>Barberías</Text>
              <Text style={styles.menuSubtitle}>Gestionar barberías registradas</Text>
            </View>
          </View>
          <View style={styles.menuBadge}>
            <Text style={styles.badgeText}>{barbershopsCount || 0}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            console.log('Navigate to Billing');
            navigate('Billing');
          }}>
          <View style={styles.menuItemLeft}>
            <Text style={styles.menuIcon}>💳</Text>
            <View>
              <Text style={styles.menuTitle}>Facturación</Text>
              <Text style={styles.menuSubtitle}>Pagos y suscripciones</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>mibarberiaweb.com - Admin Panel</Text>
        <Text style={styles.footerVersion}>v3.0.0</Text>
      </View>
    </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#2c3e50',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  adminName: {
    fontSize: 14,
    color: '#bdc3c7',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  logoutIcon: {
    fontSize: 28,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
    marginLeft: '1%',
    marginRight: '1%',
  },
  statIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
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
  menuBadge: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
  footerVersion: {
    fontSize: 10,
    color: '#95a5a6',
    marginTop: 4,
  },
});

export default AdminDashboardScreen;
