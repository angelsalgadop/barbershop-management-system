import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useAuth} from '../../contexts/AuthContext';
import api from '../../services/api';
import socketService from '../../services/socket';
import {ENDPOINTS} from '../../config/api';

const BarberDashboardScreen = ({navigation}) => {
  const {user, logout} = useAuth();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    setupSocketListeners();

    return () => {
      socketService.removeAllListeners('queue_updated');
      socketService.removeAllListeners('appointment_updated');
    };
  }, []);

  const setupSocketListeners = () => {
    socketService.on('queue_updated', data => {
      if (data.barberId === user.id) {
        setQueue(data.queue);
      }
    });

    socketService.on('appointment_updated', () => {
      loadData();
    });
  };

  const loadData = async () => {
    try {
      const [dashboardRes, queueRes] = await Promise.all([
        api.get(ENDPOINTS.BARBER_DASHBOARD),
        api.get(ENDPOINTS.BARBER_QUEUE),
      ]);

      if (dashboardRes.data.success) {
        setStats(dashboardRes.data.data);
      }

      if (queueRes.data.success) {
        setQueue(queueRes.data.queue || []);
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCallNext = async () => {
    try {
      const response = await api.post(`${ENDPOINTS.BARBER_QUEUE}/call-next`);
      if (response.data.success) {
        Alert.alert('Éxito', 'Cliente llamado correctamente');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Error al llamar cliente');
    }
  };

  const handleCompleteService = async appointmentId => {
    try {
      const response = await api.post(
        `${ENDPOINTS.BARBER_APPOINTMENTS}/${appointmentId}/complete`,
      );
      if (response.data.success) {
        Alert.alert('Éxito', 'Servicio completado');
        loadData();
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo completar el servicio');
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro que deseas salir?', [
      {text: 'Cancelar', style: 'cancel'},
      {text: 'Salir', onPress: logout, style: 'destructive'},
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>¡Hola, {user.name}!</Text>
          <Text style={styles.subtitleText}>Panel de Barbero</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, {backgroundColor: '#007AFF'}]}>
          <Text style={styles.statNumber}>{stats?.today_appointments || 0}</Text>
          <Text style={styles.statLabel}>Turnos Hoy</Text>
        </View>

        <View style={[styles.statCard, {backgroundColor: '#34C759'}]}>
          <Text style={styles.statNumber}>{stats?.completed_today || 0}</Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>

        <View style={[styles.statCard, {backgroundColor: '#FF9500'}]}>
          <Text style={styles.statNumber}>{queue.length}</Text>
          <Text style={styles.statLabel}>En Cola</Text>
        </View>
      </View>

      {/* Cola de Turnos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cola de Turnos</Text>

        {queue.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No hay turnos en cola</Text>
          </View>
        ) : (
          <>
            {/* Próximo turno */}
            {queue[0] && (
              <View style={styles.nextAppointment}>
                <Text style={styles.nextLabel}>PRÓXIMO</Text>
                <Text style={styles.clientName}>{queue[0].client_name}</Text>
                <Text style={styles.clientPhone}>{queue[0].client_phone}</Text>
                <Text style={styles.serviceText}>
                  Servicio: {queue[0].service_name}
                </Text>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.callButton]}
                    onPress={handleCallNext}>
                    <Text style={styles.buttonText}>Llamar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.completeButton]}
                    onPress={() => handleCompleteService(queue[0].id)}>
                    <Text style={styles.buttonText}>Completar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Siguientes turnos */}
            {queue.slice(1).map((appointment, index) => (
              <View key={appointment.id} style={styles.queueItem}>
                <View style={styles.queueNumber}>
                  <Text style={styles.queueNumberText}>{index + 2}</Text>
                </View>
                <View style={styles.queueInfo}>
                  <Text style={styles.queueClientName}>
                    {appointment.client_name}
                  </Text>
                  <Text style={styles.queueService}>
                    {appointment.service_name}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => navigation.navigate('Queue')}>
          <Text style={styles.viewAllText}>Ver todas las colas</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
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
  nextAppointment: {
    backgroundColor: '#F0F8FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  clientPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  serviceText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  callButton: {
    backgroundColor: '#007AFF',
  },
  completeButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  queueNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  queueNumberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  queueInfo: {
    flex: 1,
  },
  queueClientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  queueService: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  viewAllButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
  },
});

export default BarberDashboardScreen;
