import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';
import {ENDPOINTS} from '../../config/api';
import socketService from '../../services/socket';
import {useAuth} from '../../contexts/AuthContext';

const AppointmentsScreen = () => {
  const {user} = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBarberId, setFilterBarberId] = useState('all');
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    barber_id: '',
    service_id: '',
    appointment_date: '',
    appointment_time: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
    setupSocketListeners();

    return () => {
      socketService.off('appointment_created');
      socketService.off('appointment_updated');
      socketService.off('appointment_cancelled');
    };
  }, []);

  const setupSocketListeners = () => {
    socketService.on('appointment_created', () => {
      loadAppointments();
    });
    socketService.on('appointment_updated', () => {
      loadAppointments();
    });
    socketService.on('appointment_cancelled', () => {
      loadAppointments();
    });
  };

  const loadData = async () => {
    await Promise.all([loadAppointments(), loadBarbers(), loadServices()]);
  };

  const loadAppointments = async () => {
    if (!user?.id) {
      console.error('No user ID available');
      setLoading(false);
      return;
    }

    try {
      const barbershopId = user.id;
      const endpoint = ENDPOINTS.APPOINTMENTS_BY_BARBERSHOP(barbershopId);

      console.log('=== CARGANDO CITAS ===');
      console.log('Barbershop ID:', barbershopId);
      console.log('Endpoint:', endpoint);

      const response = await api.get(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // La respuesta puede ser un array directo o un objeto con appointments
      if (Array.isArray(response.data)) {
        setAppointments(response.data);
        console.log('Citas cargadas:', response.data.length);
      } else if (response.data.appointments) {
        setAppointments(response.data.appointments);
        console.log('Citas cargadas:', response.data.appointments.length);
      } else {
        console.log('Response format inesperado:', response.data);
        setAppointments([]);
      }
    } catch (error) {
      console.error('=== ERROR AL CARGAR CITAS ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'No se pudieron cargar las citas. Verifica tu conexión.';

      Alert.alert('Error al Cargar Citas', errorMessage);
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadBarbers = async () => {
    if (!user?.id) {
      setBarbers([]);
      return;
    }

    try {
      const barbershopId = user.id;
      const endpoint = ENDPOINTS.BARBERS_BY_BARBERSHOP(barbershopId);

      console.log('=== CARGANDO BARBEROS ===');
      console.log('Barbershop ID:', barbershopId);
      console.log('Endpoint:', endpoint);

      const response = await api.get(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      if (Array.isArray(response.data)) {
        setBarbers(response.data);
        console.log('Barberos cargados:', response.data.length);
      } else {
        console.log('Response format inesperado:', response.data);
        setBarbers([]);
      }
    } catch (error) {
      console.error('=== ERROR AL CARGAR BARBEROS ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'No se pudieron cargar los barberos. Verifica tu conexión.';

      Alert.alert('Error al Cargar Barberos', errorMessage);
      setBarbers([]);
    }
  };

  const loadServices = async () => {
    // TODO: Implementar endpoint de servicios en el backend
    // Por ahora, servicios vacíos
    console.log('=== SERVICIOS ===');
    console.log('Endpoint de servicios no implementado aún');
    setServices([]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openCreateModal = () => {
    setFormData({
      client_name: '',
      client_phone: '',
      client_email: '',
      barber_id: barbers[0]?.id?.toString() || '',
      service_id: services[0]?.id?.toString() || '',
      appointment_date: new Date().toISOString().split('T')[0],
      appointment_time: '10:00',
      notes: '',
    });
    setModalVisible(true);
  };

  const openDetailsModal = appointment => {
    setSelectedAppointment(appointment);
    setDetailsModalVisible(true);
  };

  const handleCreateAppointment = async () => {
    if (!formData.client_name || !formData.client_phone || !formData.barber_id) {
      Alert.alert('Error', 'Por favor completa los campos obligatorios');
      return;
    }

    try {
      const response = await api.post(ENDPOINTS.BARBERSHOP_APPOINTMENTS, formData);
      if (response.data.success) {
        Alert.alert('Éxito', 'Cita creada correctamente');
        loadAppointments();
        setModalVisible(false);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo crear la cita',
      );
    }
  };

  const updateAppointmentStatus = async (appointmentId, status) => {
    const statusTexts = {
      confirmed: 'confirmar',
      completed: 'completar',
      cancelled: 'cancelar',
    };

    Alert.alert(
      'Confirmar',
      `¿Estás seguro que deseas ${statusTexts[status]} esta cita?`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const response = await api.put(
                `${ENDPOINTS.BARBERSHOP_APPOINTMENTS}/${appointmentId}`,
                {status},
              );
              if (response.data.success) {
                Alert.alert('Éxito', 'Estado actualizado correctamente');
                loadAppointments();
                setDetailsModalVisible(false);
              }
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'No se pudo actualizar el estado');
            }
          },
        },
      ],
    );
  };

  const deleteAppointment = async appointmentId => {
    Alert.alert(
      'Confirmar Eliminación',
      '¿Estás seguro que deseas eliminar esta cita?',
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(
                `${ENDPOINTS.BARBERSHOP_APPOINTMENTS}/${appointmentId}`,
              );
              if (response.data.success) {
                Alert.alert('Éxito', 'Cita eliminada correctamente');
                loadAppointments();
                setDetailsModalVisible(false);
              }
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'No se pudo eliminar la cita');
            }
          },
        },
      ],
    );
  };

  const getFilteredAppointments = () => {
    return appointments.filter(apt => {
      const statusMatch = filterStatus === 'all' || apt.status === filterStatus;
      const barberMatch =
        filterBarberId === 'all' || apt.barber_id?.toString() === filterBarberId;
      return statusMatch && barberMatch;
    });
  };

  const getStatusColor = status => {
    const colors = {
      pending: '#f39c12',
      confirmed: '#3498db',
      completed: '#27ae60',
      cancelled: '#e74c3c',
    };
    return colors[status] || '#95a5a6';
  };

  const getStatusText = status => {
    const texts = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };
    return texts[status] || status;
  };

  const renderAppointmentItem = ({item}) => (
    <TouchableOpacity
      style={styles.appointmentCard}
      onPress={() => openDetailsModal(item)}>
      <View style={styles.appointmentHeader}>
        <View style={styles.appointmentInfo}>
          <Text style={styles.clientName}>{item.client_name}</Text>
          <Text style={styles.barberName}>
            Barbero: {item.barber_name || 'No asignado'}
          </Text>
          <Text style={styles.serviceName}>
            {item.service_name || 'Sin servicio'}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: getStatusColor(item.status)},
          ]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.appointmentDetails}>
        <Text style={styles.detailText}>
          📅 {new Date(item.appointment_date).toLocaleDateString()}
        </Text>
        <Text style={styles.detailText}>🕐 {item.appointment_time}</Text>
        <Text style={styles.detailText}>📱 {item.client_phone}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2c3e50" />
      </View>
    );
  }

  const filteredAppointments = getFilteredAppointments();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Turnos</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Text style={styles.addButtonText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus === 'all' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus('all')}>
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === 'all' && styles.filterButtonTextActive,
              ]}>
              Todas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus === 'pending' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus('pending')}>
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === 'pending' && styles.filterButtonTextActive,
              ]}>
              Pendientes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus === 'confirmed' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus('confirmed')}>
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === 'confirmed' && styles.filterButtonTextActive,
              ]}>
              Confirmadas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus === 'completed' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus('completed')}>
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === 'completed' && styles.filterButtonTextActive,
              ]}>
              Completadas
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredAppointments}
        renderItem={renderAppointmentItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay citas para mostrar</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openCreateModal}>
              <Text style={styles.emptyButtonText}>Crear Primera Cita</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Modal de Crear Cita */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Nueva Cita</Text>

              <Text style={styles.label}>Cliente *</Text>
              <TextInput
                style={styles.input}
                value={formData.client_name}
                onChangeText={text => setFormData({...formData, client_name: text})}
                placeholder="Nombre del cliente"
              />

              <Text style={styles.label}>Teléfono *</Text>
              <TextInput
                style={styles.input}
                value={formData.client_phone}
                onChangeText={text =>
                  setFormData({...formData, client_phone: text})
                }
                placeholder="+1234567890"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={formData.client_email}
                onChangeText={text =>
                  setFormData({...formData, client_email: text})
                }
                placeholder="correo@ejemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Barbero *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.optionsContainer}>
                {barbers.map(barber => (
                  <TouchableOpacity
                    key={barber.id}
                    style={[
                      styles.optionButton,
                      formData.barber_id === barber.id.toString() &&
                        styles.optionButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({...formData, barber_id: barber.id.toString()})
                    }>
                    <Text
                      style={[
                        styles.optionButtonText,
                        formData.barber_id === barber.id.toString() &&
                          styles.optionButtonTextActive,
                      ]}>
                      {barber.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Servicio</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.optionsContainer}>
                {services.map(service => (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.optionButton,
                      formData.service_id === service.id.toString() &&
                        styles.optionButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({...formData, service_id: service.id.toString()})
                    }>
                    <Text
                      style={[
                        styles.optionButtonText,
                        formData.service_id === service.id.toString() &&
                          styles.optionButtonTextActive,
                      ]}>
                      {service.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Fecha *</Text>
              <TextInput
                style={styles.input}
                value={formData.appointment_date}
                onChangeText={text =>
                  setFormData({...formData, appointment_date: text})
                }
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.label}>Hora *</Text>
              <TextInput
                style={styles.input}
                value={formData.appointment_time}
                onChangeText={text =>
                  setFormData({...formData, appointment_time: text})
                }
                placeholder="HH:MM"
              />

              <Text style={styles.label}>Notas</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={text => setFormData({...formData, notes: text})}
                placeholder="Notas adicionales..."
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleCreateAppointment}>
                  <Text style={styles.modalButtonText}>Crear</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Detalles */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Detalles de la Cita</Text>

              {selectedAppointment && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cliente:</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.client_name}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Teléfono:</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.client_phone}
                    </Text>
                  </View>

                  {selectedAppointment.client_email && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Email:</Text>
                      <Text style={styles.detailValue}>
                        {selectedAppointment.client_email}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Barbero:</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.barber_name}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Servicio:</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.service_name}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fecha:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(
                        selectedAppointment.appointment_date,
                      ).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hora:</Text>
                    <Text style={styles.detailValue}>
                      {selectedAppointment.appointment_time}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Estado:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusColor(
                            selectedAppointment.status,
                          ),
                        },
                      ]}>
                      <Text style={styles.statusText}>
                        {getStatusText(selectedAppointment.status)}
                      </Text>
                    </View>
                  </View>

                  {selectedAppointment.notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Notas:</Text>
                      <Text style={styles.detailValue}>
                        {selectedAppointment.notes}
                      </Text>
                    </View>
                  )}

                  {selectedAppointment.status === 'pending' && (
                    <View style={styles.actionButtonsModal}>
                      <TouchableOpacity
                        style={[styles.actionButtonModal, styles.confirmButton]}
                        onPress={() =>
                          updateAppointmentStatus(
                            selectedAppointment.id,
                            'confirmed',
                          )
                        }>
                        <Text style={styles.actionButtonText}>Confirmar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButtonModal, styles.cancelButtonModal]}
                        onPress={() =>
                          updateAppointmentStatus(
                            selectedAppointment.id,
                            'cancelled',
                          )
                        }>
                        <Text style={styles.actionButtonText}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {selectedAppointment.status === 'confirmed' && (
                    <TouchableOpacity
                      style={[styles.actionButtonModal, styles.completeButton]}
                      onPress={() =>
                        updateAppointmentStatus(
                          selectedAppointment.id,
                          'completed',
                        )
                      }>
                      <Text style={styles.actionButtonText}>Completar</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionButtonModal, styles.deleteButtonModal]}
                    onPress={() => deleteAppointment(selectedAppointment.id)}>
                    <Text style={styles.actionButtonText}>Eliminar Cita</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.modalButton, styles.closeButton]}
                onPress={() => setDetailsModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cerrar</Text>
              </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addButton: {
    backgroundColor: '#2c3e50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ecf0f1',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2c3e50',
  },
  filterButtonText: {
    color: '#7f8c8d',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  appointmentInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  barberName: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  serviceName: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    height: 28,
    justifyContent: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  appointmentDetails: {
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    paddingTop: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#2c3e50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
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
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    marginBottom: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ecf0f1',
    marginRight: 8,
  },
  optionButtonActive: {
    backgroundColor: '#2c3e50',
  },
  optionButtonText: {
    color: '#7f8c8d',
    fontWeight: '600',
  },
  optionButtonTextActive: {
    color: '#fff',
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
    marginHorizontal: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#27ae60',
  },
  closeButton: {
    backgroundColor: '#2c3e50',
    marginTop: 20,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  detailValue: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
    textAlign: 'right',
  },
  actionButtonsModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButtonModal: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#27ae60',
  },
  cancelButtonModal: {
    backgroundColor: '#e74c3c',
  },
  completeButton: {
    backgroundColor: '#3498db',
    marginTop: 20,
  },
  deleteButtonModal: {
    backgroundColor: '#e74c3c',
    marginTop: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AppointmentsScreen;
