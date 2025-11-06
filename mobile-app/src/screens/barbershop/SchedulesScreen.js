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

const DAYS_OF_WEEK = [
  {id: 0, name: 'Domingo', key: 'sunday'},
  {id: 1, name: 'Lunes', key: 'monday'},
  {id: 2, name: 'Martes', key: 'tuesday'},
  {id: 3, name: 'Miércoles', key: 'wednesday'},
  {id: 4, name: 'Jueves', key: 'thursday'},
  {id: 5, name: 'Viernes', key: 'friday'},
  {id: 6, name: 'Sábado', key: 'saturday'},
];

const SchedulesScreen = () => {
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDay, setEditingDay] = useState(null);
  const [tempSchedule, setTempSchedule] = useState({
    is_open: false,
    open_time: '09:00',
    close_time: '18:00',
  });

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      console.log('=== CARGANDO HORARIOS ===');
      console.log('Endpoint:', ENDPOINTS.BARBERSHOP_SCHEDULES);
      const response = await api.get(`${ENDPOINTS.BARBERSHOP_SCHEDULES}`);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      if (response.data.success) {
        setSchedules(response.data.schedules || {});
        console.log('Horarios cargados correctamente');
      } else {
        console.log('Response no exitosa:', response.data);
        setSchedules({});
      }
    } catch (error) {
      console.error('=== ERROR AL CARGAR HORARIOS ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'No se pudieron cargar los horarios. Verifica tu conexión.';

      Alert.alert('Error al Cargar Horarios', errorMessage);
      setSchedules({}); // Asegurar que se muestre la pantalla en lugar de loading
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
    const daySchedule = schedules[day.key] || {
      is_open: false,
      open_time: '09:00',
      close_time: '18:00',
    };
    setTempSchedule(daySchedule);
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const response = await api.put(
        `${ENDPOINTS.BARBERSHOP_SCHEDULES}/${editingDay.key}`,
        tempSchedule,
      );
      if (response.data.success) {
        Alert.alert('Éxito', 'Horario actualizado correctamente');
        loadSchedules();
        setEditModalVisible(false);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudo actualizar el horario');
    }
  };

  const toggleQuickStatus = async (day, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const response = await api.put(
        `${ENDPOINTS.BARBERSHOP_SCHEDULES}/${day.key}`,
        {
          is_open: newStatus,
          open_time: schedules[day.key]?.open_time || '09:00',
          close_time: schedules[day.key]?.close_time || '18:00',
        },
      );
      if (response.data.success) {
        loadSchedules();
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado');
    }
  };

  const applyToAll = () => {
    Alert.alert(
      'Aplicar a Todos',
      `¿Aplicar este horario (${tempSchedule.open_time} - ${tempSchedule.close_time}) a todos los días?`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Aplicar',
          onPress: async () => {
            try {
              const promises = DAYS_OF_WEEK.map(day =>
                api.put(`${ENDPOINTS.BARBERSHOP_SCHEDULES}/${day.key}`, tempSchedule),
              );
              await Promise.all(promises);
              Alert.alert('Éxito', 'Horario aplicado a todos los días');
              loadSchedules();
              setEditModalVisible(false);
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'No se pudo aplicar el horario');
            }
          },
        },
      ],
    );
  };

  const renderDayCard = day => {
    const daySchedule = schedules[day.key] || {
      is_open: false,
      open_time: '09:00',
      close_time: '18:00',
    };

    return (
      <View key={day.id} style={styles.dayCard}>
        <View style={styles.dayHeader}>
          <View style={styles.dayInfo}>
            <Text style={styles.dayName}>{day.name}</Text>
            {daySchedule.is_open ? (
              <Text style={styles.dayTime}>
                {daySchedule.open_time} - {daySchedule.close_time}
              </Text>
            ) : (
              <Text style={styles.dayClosed}>Cerrado</Text>
            )}
          </View>

          <View style={styles.dayActions}>
            <Switch
              value={daySchedule.is_open}
              onValueChange={() => toggleQuickStatus(day, daySchedule.is_open)}
              trackColor={{false: '#e0e0e0', true: '#27ae60'}}
              thumbColor={daySchedule.is_open ? '#fff' : '#f4f3f4'}
            />

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => openEditModal(day)}>
              <Text style={styles.editButtonText}>Editar</Text>
            </TouchableOpacity>
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
        <Text style={styles.title}>Horarios de Atención</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Configura los horarios de atención para cada día de la semana. Los
            clientes podrán agendar citas dentro de estos horarios.
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
            <Text style={styles.modalTitle}>
              Editar Horario - {editingDay?.name}
            </Text>

            <View style={styles.switchRow}>
              <Text style={styles.label}>¿Abierto este día?</Text>
              <Switch
                value={tempSchedule.is_open}
                onValueChange={value =>
                  setTempSchedule({...tempSchedule, is_open: value})
                }
                trackColor={{false: '#e0e0e0', true: '#27ae60'}}
                thumbColor={tempSchedule.is_open ? '#fff' : '#f4f3f4'}
              />
            </View>

            {tempSchedule.is_open && (
              <>
                <Text style={styles.label}>Hora de Apertura</Text>
                <TextInput
                  style={styles.input}
                  value={tempSchedule.open_time}
                  onChangeText={text =>
                    setTempSchedule({...tempSchedule, open_time: text})
                  }
                  placeholder="09:00"
                />

                <Text style={styles.label}>Hora de Cierre</Text>
                <TextInput
                  style={styles.input}
                  value={tempSchedule.close_time}
                  onChangeText={text =>
                    setTempSchedule({...tempSchedule, close_time: text})
                  }
                  placeholder="18:00"
                />

                <TouchableOpacity
                  style={[styles.modalButton, styles.applyAllButton]}
                  onPress={applyToAll}>
                  <Text style={styles.modalButtonText}>
                    Aplicar a Todos los Días
                  </Text>
                </TouchableOpacity>
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
    backgroundColor: '#e3f2fd',
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
    color: '#1976d2',
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
  },
  dayClosed: {
    fontSize: 14,
    color: '#e74c3c',
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
  applyAllButton: {
    backgroundColor: '#3498db',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SchedulesScreen;
