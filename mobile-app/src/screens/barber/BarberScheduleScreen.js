import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import api from '../../services/api';
import {ENDPOINTS} from '../../config/api';
import {useAuth} from '../../contexts/AuthContext';

const DAYS_OF_WEEK = [
  {id: 0, name: 'Domingo', key: 'sunday'},
  {id: 1, name: 'Lunes', key: 'monday'},
  {id: 2, name: 'Martes', key: 'tuesday'},
  {id: 3, name: 'Miércoles', key: 'wednesday'},
  {id: 4, name: 'Jueves', key: 'thursday'},
  {id: 5, name: 'Viernes', key: 'friday'},
  {id: 6, name: 'Sábado', key: 'saturday'},
];

const BarberScheduleScreen = () => {
  const {user} = useAuth();
  const [schedule, setSchedule] = useState({});
  const [barbershopSchedule, setBarbershopSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [tempSchedule, setTempSchedule] = useState({
    is_available: false,
    start_time: '09:00',
    end_time: '18:00',
  });

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    if (!user?.id) {
      console.error('No user ID available');
      setLoading(false);
      return;
    }

    try {
      const barberId = user.id;
      const endpoint = ENDPOINTS.BARBER_SCHEDULE(barberId);

      console.log('=== CARGANDO HORARIOS DEL BARBERO ===');
      console.log('Barber ID:', barberId);
      console.log('Endpoint:', endpoint);

      const response = await api.get(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // El backend devuelve el horario del barbero y de la barbería
      if (response.data) {
        setSchedule(response.data.barber_schedule || {});
        setBarbershopSchedule(response.data.barbershop_schedule || {});
        console.log('Horarios cargados correctamente');
      }
    } catch (error) {
      console.error('=== ERROR AL CARGAR HORARIOS ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'No se pudieron cargar los horarios';

      Alert.alert('Error', errorMessage);
      setSchedule({});
      setBarbershopSchedule({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSchedules();
  };

  const openEditModal = day => {
    setEditingDay(day);
    const daySchedule = schedule[day.key] || {
      is_available: false,
      start_time: barbershopSchedule[day.key]?.open_time || '09:00',
      end_time: barbershopSchedule[day.key]?.close_time || '18:00',
    };
    setTempSchedule(daySchedule);
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    const barbershopDay = barbershopSchedule[editingDay.key];

    // Validar que el horario del barbero esté dentro del horario de la barbería
    if (barbershopDay && barbershopDay.is_open) {
      if (
        tempSchedule.start_time < barbershopDay.open_time ||
        tempSchedule.end_time > barbershopDay.close_time
      ) {
        Alert.alert(
          'Horario Inválido',
          `Tu horario debe estar dentro del horario de la barbería (${barbershopDay.open_time} - ${barbershopDay.close_time})`,
        );
        return;
      }
    }

    try {
      const barberId = user.id;
      const endpoint = `${ENDPOINTS.BARBER_SCHEDULE(barberId)}/${editingDay.key}`;

      console.log('Actualizando horario:', endpoint);
      const response = await api.put(endpoint, tempSchedule);

      if (response.data.message || response.status === 200) {
        Alert.alert('Éxito', 'Horario actualizado correctamente');
        loadSchedules();
        setEditModalVisible(false);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || 'No se pudo actualizar el horario';
      Alert.alert('Error', errorMessage);
    }
  };

  const toggleQuickStatus = async (day, currentStatus) => {
    if (!user?.id) return;

    try {
      const barberId = user.id;
      const newStatus = !currentStatus;
      const endpoint = `${ENDPOINTS.BARBER_SCHEDULE(barberId)}/${day.key}`;

      const response = await api.put(endpoint, {
        is_available: newStatus,
        start_time: schedule[day.key]?.start_time || '09:00',
        end_time: schedule[day.key]?.end_time || '18:00',
      });

      if (response.data.message || response.status === 200) {
        loadSchedules();
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || 'No se pudo actualizar el estado';
      Alert.alert('Error', errorMessage);
    }
  };

  const renderDayCard = day => {
    const daySchedule = schedule[day.key] || {
      is_available: false,
      start_time: '09:00',
      end_time: '18:00',
    };

    const barbershopDay = barbershopSchedule[day.key];
    const barbershopOpen = barbershopDay?.is_open;

    return (
      <View key={day.id} style={styles.dayCard}>
        <View style={styles.dayHeader}>
          <View style={styles.dayInfo}>
            <Text style={styles.dayName}>{day.name}</Text>

            {!barbershopOpen ? (
              <Text style={styles.barbershopClosed}>Barbería cerrada</Text>
            ) : daySchedule.is_available ? (
              <>
                <Text style={styles.dayTime}>
                  Mi horario: {daySchedule.start_time} - {daySchedule.end_time}
                </Text>
                <Text style={styles.barbershopTime}>
                  Barbería: {barbershopDay.open_time} - {barbershopDay.close_time}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.dayClosed}>No disponible</Text>
                {barbershopOpen && (
                  <Text style={styles.barbershopTime}>
                    Barbería: {barbershopDay.open_time} - {barbershopDay.close_time}
                  </Text>
                )}
              </>
            )}
          </View>

          <View style={styles.dayActions}>
            <Switch
              value={daySchedule.is_available}
              onValueChange={() =>
                toggleQuickStatus(day, daySchedule.is_available)
              }
              disabled={!barbershopOpen}
              trackColor={{false: '#e0e0e0', true: '#27ae60'}}
              thumbColor={daySchedule.is_available ? '#fff' : '#f4f3f4'}
            />

            {barbershopOpen && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditModal(day)}>
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2c3e50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mi Horario</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Configura tu horario de disponibilidad. Solo podrás trabajar dentro
            del horario de la barbería.
          </Text>
        </View>

        {DAYS_OF_WEEK.map(day => renderDayCard(day))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Los cambios se aplicarán inmediatamente
          </Text>
        </View>
      </ScrollView>

      {/* Modal de Edición */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                Editar Horario - {editingDay?.name}
              </Text>

              {editingDay && barbershopSchedule[editingDay.key]?.is_open && (
                <View style={styles.barbershopInfoCard}>
                  <Text style={styles.barbershopInfoTitle}>
                    Horario de la Barbería:
                  </Text>
                  <Text style={styles.barbershopInfoTime}>
                    {barbershopSchedule[editingDay.key].open_time} -{' '}
                    {barbershopSchedule[editingDay.key].close_time}
                  </Text>
                  <Text style={styles.barbershopInfoNote}>
                    Tu horario debe estar dentro de este rango
                  </Text>
                </View>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.label}>¿Disponible este día?</Text>
                <Switch
                  value={tempSchedule.is_available}
                  onValueChange={value =>
                    setTempSchedule({...tempSchedule, is_available: value})
                  }
                  trackColor={{false: '#e0e0e0', true: '#27ae60'}}
                  thumbColor={tempSchedule.is_available ? '#fff' : '#f4f3f4'}
                />
              </View>

              {tempSchedule.is_available && (
                <>
                  <Text style={styles.label}>Hora de Inicio</Text>
                  <TextInput
                    style={styles.input}
                    value={tempSchedule.start_time}
                    onChangeText={text =>
                      setTempSchedule({...tempSchedule, start_time: text})
                    }
                    placeholder="09:00"
                  />

                  <Text style={styles.label}>Hora de Fin</Text>
                  <TextInput
                    style={styles.input}
                    value={tempSchedule.end_time}
                    onChangeText={text =>
                      setTempSchedule({...tempSchedule, end_time: text})
                    }
                    placeholder="18:00"
                  />
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSave}>
                  <Text style={styles.modalButtonText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  scrollView: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  dayTime: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '600',
  },
  barbershopTime: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  dayClosed: {
    fontSize: 14,
    color: '#e74c3c',
  },
  barbershopClosed: {
    fontSize: 14,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    marginLeft: 12,
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  barbershopInfoCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  barbershopInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 4,
  },
  barbershopInfoTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  barbershopInfoNote: {
    fontSize: 12,
    color: '#1976d2',
    fontStyle: 'italic',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#27ae60',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default BarberScheduleScreen;
