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
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';
import {ENDPOINTS} from '../../config/api';
import {useAuth} from '../../contexts/AuthContext';

const BarbersScreen = () => {
  const {user} = useAuth();
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBarber, setEditingBarber] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    commission_rate: '30',
    is_active: true,
  });

  useEffect(() => {
    loadBarbers();
  }, []);

  const loadBarbers = async () => {
    if (!user?.id) {
      console.error('No user ID available');
      setLoading(false);
      return;
    }

    try {
      const barbershopId = user.id; // Para barbershop, user.id ES el barbershopId
      const endpoint = ENDPOINTS.BARBERS_BY_BARBERSHOP(barbershopId);

      console.log('=== CARGANDO BARBEROS ===');
      console.log('Barbershop ID:', barbershopId);
      console.log('Endpoint:', endpoint);

      const response = await api.get(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // La respuesta es un array directo, no un objeto con success
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

      // Mostrar error más detallado
      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'No se pudieron cargar los barberos. Verifica tu conexión.';

      Alert.alert('Error al Cargar Barberos', errorMessage);
      setBarbers([]); // Asegurar que se muestre la lista vacía en lugar de loading
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBarbers();
  };

  const openCreateModal = () => {
    setEditingBarber(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      commission_rate: '30',
      is_active: true,
    });
    setModalVisible(true);
  };

  const openEditModal = barber => {
    setEditingBarber(barber);
    setFormData({
      name: barber.name,
      email: barber.email,
      phone: barber.phone || '',
      password: '',
      commission_rate: barber.commission_rate?.toString() || '30',
      is_active: barber.is_active === 1,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      Alert.alert('Error', 'Nombre y email son obligatorios');
      return;
    }

    if (!editingBarber && !formData.password) {
      Alert.alert('Error', 'La contraseña es obligatoria para nuevos barberos');
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        is_active: formData.is_active ? 1 : 0,
        commission_rate: parseFloat(formData.commission_rate) || 30,
      };

      const barbershopId = user.id;

      if (editingBarber) {
        // Editar barbero existente
        const response = await api.put(
          ENDPOINTS.BARBER_DETAIL(editingBarber.id),
          dataToSend,
        );
        if (response.data.message) {
          Alert.alert('Éxito', 'Barbero actualizado correctamente');
          loadBarbers();
          setModalVisible(false);
        }
      } else {
        // Crear nuevo barbero
        const response = await api.post(
          ENDPOINTS.BARBERS_BY_BARBERSHOP(barbershopId),
          dataToSend,
        );
        if (response.data.message) {
          Alert.alert('Éxito', 'Barbero creado correctamente');
          loadBarbers();
          setModalVisible(false);
        }
      }
    } catch (error) {
      console.error('Error al guardar barbero:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'No se pudo guardar el barbero',
      );
    }
  };

  const toggleBarberStatus = async barber => {
    const newStatus = barber.is_active === 1 ? 0 : 1;
    const action = newStatus === 1 ? 'activar' : 'desactivar';

    Alert.alert(
      'Confirmar',
      `¿Estás seguro que deseas ${action} a ${barber.name}?`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const response = await api.patch(
                `${ENDPOINTS.BARBER_DETAIL(barber.id)}/toggle-status`,
                {is_active: newStatus},
              );
              if (response.data.message) {
                Alert.alert('Éxito', `Barbero ${action === 'activar' ? 'activado' : 'desactivado'} correctamente`);
                loadBarbers();
              }
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'No se pudo cambiar el estado');
            }
          },
        },
      ],
    );
  };

  const deleteBarber = async barber => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro que deseas eliminar a ${barber.name}? Esta acción no se puede deshacer.`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(
                ENDPOINTS.BARBER_DETAIL(barber.id),
              );
              if (response.data.message) {
                Alert.alert('Éxito', 'Barbero eliminado correctamente');
                loadBarbers();
              }
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'No se pudo eliminar el barbero');
            }
          },
        },
      ],
    );
  };

  const renderBarberItem = ({item}) => (
    <View style={styles.barberCard}>
      <View style={styles.barberHeader}>
        <View style={styles.barberInfo}>
          <Text style={styles.barberName}>{item.name}</Text>
          <Text style={styles.barberEmail}>{item.email}</Text>
          {item.phone && <Text style={styles.barberPhone}>{item.phone}</Text>}
        </View>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: item.is_active === 1 ? '#4CAF50' : '#F44336'},
          ]}>
          <Text style={styles.statusText}>
            {item.is_active === 1 ? 'Activo' : 'Inactivo'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.total_appointments || 0}</Text>
          <Text style={styles.statLabel}>Citas</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.commission_rate || 30}%</Text>
          <Text style={styles.statLabel}>Comisión</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            ${parseFloat(item.total_earnings || 0).toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>Ganado</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}>
          <Text style={styles.actionButtonText}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            item.is_active === 1 ? styles.deactivateButton : styles.activateButton,
          ]}
          onPress={() => toggleBarberStatus(item)}>
          <Text style={styles.actionButtonText}>
            {item.is_active === 1 ? 'Desactivar' : 'Activar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => deleteBarber(item)}>
          <Text style={styles.actionButtonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
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
      <View style={styles.header}>
        <Text style={styles.title}>Gestión de Barberos</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Text style={styles.addButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={barbers}
        renderItem={renderBarberItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay barberos registrados</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={openCreateModal}>
              <Text style={styles.emptyButtonText}>Agregar Barbero</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Modal de Crear/Editar */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {editingBarber ? 'Editar Barbero' : 'Nuevo Barbero'}
              </Text>

              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={text => setFormData({...formData, name: text})}
                placeholder="Nombre completo"
              />

              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={text => setFormData({...formData, email: text})}
                placeholder="correo@ejemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={text => setFormData({...formData, phone: text})}
                placeholder="+1234567890"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>
                Contraseña {editingBarber ? '(dejar vacío para no cambiar)' : '*'}
              </Text>
              <TextInput
                style={styles.input}
                value={formData.password}
                onChangeText={text => setFormData({...formData, password: text})}
                placeholder="Contraseña"
                secureTextEntry
              />

              <Text style={styles.label}>Comisión (%)</Text>
              <TextInput
                style={styles.input}
                value={formData.commission_rate}
                onChangeText={text =>
                  setFormData({...formData, commission_rate: text})
                }
                placeholder="30"
                keyboardType="numeric"
              />

              <View style={styles.switchRow}>
                <Text style={styles.label}>Activo</Text>
                <Switch
                  value={formData.is_active}
                  onValueChange={value =>
                    setFormData({...formData, is_active: value})
                  }
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}>
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
  listContainer: {
    padding: 16,
  },
  barberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  barberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  barberInfo: {
    flex: 1,
  },
  barberName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  barberEmail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  barberPhone: {
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ecf0f1',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3498db',
  },
  activateButton: {
    backgroundColor: '#27ae60',
  },
  deactivateButton: {
    backgroundColor: '#f39c12',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
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
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default BarbersScreen;
