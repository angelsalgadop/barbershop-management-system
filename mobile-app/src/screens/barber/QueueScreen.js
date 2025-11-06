import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import api from '../../services/api';
import socketService from '../../services/socket';
import {ENDPOINTS} from '../../config/api';
import {useAuth} from '../../contexts/AuthContext';

const QueueScreen = () => {
  const {user} = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentClient, setCurrentClient] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [notes, setNotes] = useState('');
  const [serviceAmount, setServiceAmount] = useState('');

  useEffect(() => {
    loadQueue();
    loadCurrentClient();

    socketService.on('queue_updated', data => {
      if (data.barberId === user.id) {
        setQueue(data.queue);
      }
    });

    socketService.on('appointment_updated', () => {
      loadQueue();
      loadCurrentClient();
    });

    return () => {
      socketService.off('queue_updated');
      socketService.off('appointment_updated');
    };
  }, []);

  const loadQueue = async () => {
    if (!user?.id) {
      console.error('No user ID available');
      setLoading(false);
      return;
    }

    try {
      const barberId = user.id;
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const endpoint = ENDPOINTS.APPOINTMENTS_BY_BARBER(barberId, today);

      console.log('=== CARGANDO COLA ===');
      console.log('Barber ID:', barberId);
      console.log('Date:', today);
      console.log('Endpoint:', endpoint);

      const response = await api.get(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // El backend devuelve un array directo de citas/appointments
      if (Array.isArray(response.data)) {
        // Filtrar solo las que están en cola (waiting)
        const waitingQueue = response.data.filter(apt => apt.status === 'waiting');
        setQueue(waitingQueue);
        console.log('Cola cargada:', waitingQueue.length, 'clientes esperando');
      } else {
        console.log('Response format inesperado:', response.data);
        setQueue([]);
      }
    } catch (error) {
      console.error('=== ERROR AL CARGAR COLA ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'No se pudo cargar la cola. Verifica tu conexión.';

      Alert.alert('Error al Cargar Cola', errorMessage);
      setQueue([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCurrentClient = async () => {
    if (!user?.id) {
      setCurrentClient(null);
      return;
    }

    try {
      const barberId = user.id;
      const today = new Date().toISOString().split('T')[0];
      const endpoint = ENDPOINTS.APPOINTMENTS_BY_BARBER(barberId, today);

      console.log('=== CARGANDO CLIENTE ACTUAL ===');
      console.log('Barber ID:', barberId);
      console.log('Endpoint:', endpoint);

      const response = await api.get(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // Buscar la cita que está "in_service" (actualmente siendo atendida)
      if (Array.isArray(response.data)) {
        const inService = response.data.find(apt => apt.status === 'in_service');
        setCurrentClient(inService || null);
        console.log('Cliente actual:', inService ? inService.client_name : 'Ninguno');
      } else {
        console.log('Response format inesperado:', response.data);
        setCurrentClient(null);
      }
    } catch (error) {
      console.error('=== ERROR AL CARGAR CLIENTE ACTUAL ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'No se pudo cargar el cliente actual. Verifica tu conexión.';

      Alert.alert('Error al Cargar Cliente Actual', errorMessage);
      setCurrentClient(null); // Asegurar que se muestre la pantalla en lugar de loading
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadQueue();
    loadCurrentClient();
  };

  const callNextClient = async () => {
    if (queue.length === 0) {
      Alert.alert('Información', 'No hay clientes en la cola');
      return;
    }

    if (currentClient) {
      Alert.alert(
        'Cliente en Servicio',
        'Ya tienes un cliente en servicio. Debes completarlo primero.',
      );
      return;
    }

    const nextClient = queue[0];
    Alert.alert(
      'Llamar Siguiente Cliente',
      `¿Llamar a ${nextClient.client_name}?`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Llamar',
          onPress: async () => {
            try {
              const endpoint = ENDPOINTS.APPOINTMENT_CALL_NEXT(nextClient.id);
              console.log('=== LLAMANDO SIGUIENTE CLIENTE ===');
              console.log('Appointment ID:', nextClient.id);
              console.log('Endpoint:', endpoint);

              const response = await api.patch(endpoint);
              console.log('Response status:', response.status);
              console.log('Response data:', response.data);

              if (response.data.success || response.status === 200) {
                Alert.alert('Éxito', 'Cliente llamado correctamente');
                loadQueue();
                loadCurrentClient();
              }
            } catch (error) {
              console.error('=== ERROR AL LLAMAR CLIENTE ===');
              console.error('Error completo:', error);
              console.error('Error response:', error.response?.data);

              const errorMessage = error.response?.data?.error
                || error.response?.data?.message
                || error.message
                || 'No se pudo llamar al cliente';

              Alert.alert('Error', errorMessage);
            }
          },
        },
      ],
    );
  };

  const startService = async () => {
    if (!currentClient) {
      Alert.alert('Error', 'No hay cliente para iniciar servicio');
      return;
    }

    try {
      const endpoint = ENDPOINTS.APPOINTMENT_START(currentClient.id);
      console.log('=== INICIANDO SERVICIO ===');
      console.log('Appointment ID:', currentClient.id);
      console.log('Endpoint:', endpoint);

      const response = await api.patch(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      if (response.data.success || response.status === 200) {
        Alert.alert('Éxito', 'Servicio iniciado correctamente');
        loadQueue();
        loadCurrentClient();
      }
    } catch (error) {
      console.error('=== ERROR AL INICIAR SERVICIO ===');
      console.error('Error completo:', error);
      console.error('Error response:', error.response?.data);

      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'No se pudo iniciar el servicio';

      Alert.alert('Error', errorMessage);
    }
  };

  const completeService = async () => {
    if (!currentClient) {
      Alert.alert('Error', 'No hay cliente para completar');
      return;
    }

    setSelectedClient(currentClient);
    setNotes('');
    setServiceAmount('');
    setModalVisible(true);
  };

  const handleCompleteService = async () => {
    // Validar que se haya ingresado el monto
    const amount = parseFloat(serviceAmount);
    if (!serviceAmount || isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Por favor ingresa un monto válido para el servicio');
      return;
    }

    try {
      const endpoint = ENDPOINTS.APPOINTMENT_COMPLETE(selectedClient.id);
      console.log('=== COMPLETANDO SERVICIO ===');
      console.log('Appointment ID:', selectedClient.id);
      console.log('Endpoint:', endpoint);
      console.log('Amount:', amount);
      console.log('Notes:', notes);

      const response = await api.patch(endpoint, {
        service_amount: amount,
        notes: notes || '',
      });

      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      if (response.data.success || response.status === 200) {
        Alert.alert('Éxito', 'Servicio completado correctamente');
        setModalVisible(false);
        setCurrentClient(null);
        loadQueue();
        loadCurrentClient();
      }
    } catch (error) {
      console.error('=== ERROR AL COMPLETAR SERVICIO ===');
      console.error('Error completo:', error);
      console.error('Error response:', error.response?.data);

      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'No se pudo completar el servicio';

      Alert.alert('Error', errorMessage);
    }
  };

  const cancelAppointment = async (appointment, reason = 'Cliente no se presentó') => {
    if (!appointment) {
      Alert.alert('Error', 'No hay cita para cancelar');
      return;
    }

    Alert.alert(
      'Cancelar Cita',
      `¿Cancelar la cita de ${appointment.client_name}?`,
      [
        {text: 'No', style: 'cancel'},
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const endpoint = ENDPOINTS.APPOINTMENT_CANCEL(appointment.id);
              console.log('=== CANCELANDO CITA ===');
              console.log('Appointment ID:', appointment.id);
              console.log('Endpoint:', endpoint);
              console.log('Reason:', reason);

              const response = await api.patch(endpoint, {
                cancellation_reason: reason,
              });

              console.log('Response status:', response.status);
              console.log('Response data:', response.data);

              if (response.data.success || response.status === 200) {
                Alert.alert('Éxito', 'Cita cancelada correctamente');
                if (currentClient && currentClient.id === appointment.id) {
                  setCurrentClient(null);
                }
                loadQueue();
                loadCurrentClient();
              }
            } catch (error) {
              console.error('=== ERROR AL CANCELAR CITA ===');
              console.error('Error completo:', error);
              console.error('Error response:', error.response?.data);

              const errorMessage = error.response?.data?.error
                || error.response?.data?.message
                || error.message
                || 'No se pudo cancelar la cita';

              Alert.alert('Error', errorMessage);
            }
          },
        },
      ],
    );
  };

  const getEstimatedTime = index => {
    // Estimamos 30 minutos por cliente
    const minutes = (index + 1) * 30;
    if (minutes < 60) {
      return `~${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `~${hours}h ${remainingMinutes}min`;
  };

  const renderQueueItem = ({item, index}) => (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <View style={styles.position}>
          <Text style={styles.positionText}>{index + 1}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.client_name}</Text>
          <Text style={styles.service}>{item.service_name || 'Sin servicio'}</Text>
          <Text style={styles.time}>
            Llegada: {new Date(item.created_at).toLocaleTimeString()}
          </Text>
          <Text style={styles.estimated}>Espera: {getEstimatedTime(index)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => cancelAppointment(item, 'Cancelado por barbero')}>
        <Text style={styles.removeButtonText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2c3e50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Current Client Card */}
      {currentClient ? (
        <View style={styles.currentClientCard}>
          <Text style={styles.currentClientTitle}>Cliente Actual</Text>
          <View style={styles.currentClientInfo}>
            <Text style={styles.currentClientName}>{currentClient.client_name}</Text>
            <Text style={styles.currentClientService}>
              {currentClient.service_name || 'Sin servicio'}
            </Text>
            <Text style={styles.currentClientPhone}>{currentClient.client_phone}</Text>
            {currentClient.notes && (
              <Text style={styles.currentClientNotes}>
                Notas: {currentClient.notes}
              </Text>
            )}
          </View>

          <View style={styles.currentClientActions}>
            {currentClient.status === 'called' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.startButton]}
                onPress={startService}>
                <Text style={styles.actionButtonText}>Iniciar Servicio</Text>
              </TouchableOpacity>
            )}

            {currentClient.status === 'in_service' && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.completeButton]}
                  onPress={completeService}>
                  <Text style={styles.actionButtonText}>Completar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => cancelAppointment(currentClient, 'Cancelado por barbero')}>
                  <Text style={styles.actionButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.emptyCurrentClient}>
          <Text style={styles.emptyCurrentClientText}>
            No hay cliente en servicio
          </Text>
          <TouchableOpacity style={styles.callButton} onPress={callNextClient}>
            <Text style={styles.callButtonText}>Llamar Siguiente Cliente</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Queue Header */}
      <View style={styles.queueHeader}>
        <Text style={styles.queueTitle}>Cola de Espera ({queue.length})</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.refreshButton}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      {/* Queue List */}
      <FlatList
        data={queue}
        renderItem={renderQueueItem}
        keyExtractor={item => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay turnos en cola</Text>
          </View>
        }
      />

      {/* Complete Service Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Completar Servicio</Text>

              {selectedClient && (
                <>
                  <Text style={styles.modalLabel}>Cliente:</Text>
                  <Text style={styles.modalValue}>{selectedClient.client_name}</Text>

                  <Text style={styles.modalLabel}>Servicio:</Text>
                  <Text style={styles.modalValue}>
                    {selectedClient.service_name}
                  </Text>

                  <Text style={styles.modalLabel}>Monto del Servicio: *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={serviceAmount}
                    onChangeText={setServiceAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.modalLabel}>Notas Adicionales:</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Agregar notas sobre el servicio..."
                    multiline
                    numberOfLines={4}
                  />

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalCancelButton]}
                      onPress={() => setModalVisible(false)}>
                      <Text style={styles.modalButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalCompleteButton]}
                      onPress={handleCompleteService}>
                      <Text style={styles.modalButtonText}>Completar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
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
  currentClientCard: {
    backgroundColor: '#2c3e50',
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 16,
  },
  currentClientTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  currentClientInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  currentClientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  currentClientService: {
    fontSize: 16,
    color: '#ecf0f1',
    marginBottom: 4,
  },
  currentClientPhone: {
    fontSize: 14,
    color: '#bdc3c7',
    marginBottom: 4,
  },
  currentClientNotes: {
    fontSize: 14,
    color: '#bdc3c7',
    fontStyle: 'italic',
    marginTop: 8,
  },
  currentClientActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#27ae60',
  },
  completeButton: {
    backgroundColor: '#3498db',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyCurrentClient: {
    backgroundColor: '#ecf0f1',
    padding: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 16,
  },
  emptyCurrentClientText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  callButton: {
    backgroundColor: '#2c3e50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  callButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  refreshButton: {
    color: '#3498db',
    fontWeight: '600',
  },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  position: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  positionText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  service: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 2,
  },
  estimated: {
    fontSize: 12,
    color: '#e67e22',
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  removeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#7f8c8d',
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
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 8,
    marginTop: 12,
  },
  modalValue: {
    fontSize: 18,
    color: '#2c3e50',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#95a5a6',
  },
  modalCompleteButton: {
    backgroundColor: '#27ae60',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default QueueScreen;
