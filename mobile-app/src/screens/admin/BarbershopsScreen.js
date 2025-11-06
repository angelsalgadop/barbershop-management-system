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
  Switch,
  Modal,
  ScrollView,
} from 'react-native';
import api from '../../services/api';
import {ENDPOINTS} from '../../config/api';

const BarbershopsScreen = () => {
  const [barbershops, setBarbershops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBarbershop, setSelectedBarbershop] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  useEffect(() => {
    loadBarbershops();
  }, []);

  const loadBarbershops = async () => {
    try {
      console.log('=== CARGANDO BARBERÍAS ===');
      console.log('Endpoint:', ENDPOINTS.ADMIN_BARBERSHOPS);
      const response = await api.get(ENDPOINTS.ADMIN_BARBERSHOPS);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // El backend devuelve un array directo de barberías
      if (Array.isArray(response.data)) {
        setBarbershops(response.data);
        console.log('Barberías cargadas:', response.data.length);
      } else {
        console.log('Response format inesperado:', response.data);
        setBarbershops([]);
      }
    } catch (error) {
      console.error('=== ERROR AL CARGAR BARBERÍAS ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'No se pudieron cargar las barberías. Verifica tu conexión.';

      Alert.alert('Error al Cargar Barberías', errorMessage);
      setBarbershops([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBarbershops();
  };

  const openDetailsModal = barbershop => {
    setSelectedBarbershop(barbershop);
    setDetailsModalVisible(true);
  };

  const toggleSuspension = async barbershop => {
    const action = barbershop.is_suspended ? 'activar' : 'suspender';

    Alert.alert(
      `Confirmar ${action}`,
      `¿Estás seguro que deseas ${action} a ${barbershop.business_name}?`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const response = await api.put(
                `${ENDPOINTS.ADMIN_BARBERSHOPS}/${barbershop.id}/suspension`,
                {is_suspended: !barbershop.is_suspended},
              );
              if (response.data.success) {
                Alert.alert('Éxito', `Barbería ${action}da correctamente`);
                loadBarbershops();
                setDetailsModalVisible(false);
              }
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', `No se pudo ${action} la barbería`);
            }
          },
        },
      ],
    );
  };

  const deleteBarbershop = async barbershop => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro que deseas eliminar ${barbershop.business_name}? Esta acción no se puede deshacer.`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(
                `${ENDPOINTS.ADMIN_BARBERSHOPS}/${barbershop.id}`,
              );
              if (response.data.success) {
                Alert.alert('Éxito', 'Barbería eliminada correctamente');
                loadBarbershops();
                setDetailsModalVisible(false);
              }
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'No se pudo eliminar la barbería');
            }
          },
        },
      ],
    );
  };

  const renderBarbershopItem = ({item}) => (
    <TouchableOpacity
      style={styles.barbershopCard}
      onPress={() => openDetailsModal(item)}>
      <View style={styles.cardHeader}>
        <View style={styles.barbershopInfo}>
          <Text style={styles.businessName}>{item.business_name}</Text>
          <Text style={styles.ownerName}>{item.owner_name}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: item.is_suspended ? '#e74c3c' : '#27ae60'},
          ]}>
          <Text style={styles.statusText}>
            {item.is_suspended ? 'Suspendida' : 'Activa'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.total_barbers || 0}</Text>
          <Text style={styles.statLabel}>Barberos</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.total_appointments || 0}</Text>
          <Text style={styles.statLabel}>Citas</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.plan || 'Básico'}</Text>
          <Text style={styles.statLabel}>Plan</Text>
        </View>
      </View>

      {item.address && (
        <Text style={styles.address}>📍 {item.address}</Text>
      )}
    </TouchableOpacity>
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
        <Text style={styles.title}>Barberías</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{barbershops.length}</Text>
        </View>
      </View>

      <FlatList
        data={barbershops}
        renderItem={renderBarbershopItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay barberías registradas</Text>
          </View>
        }
      />

      {/* Modal de Detalles */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Detalles de Barbería</Text>

              {selectedBarbershop && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Negocio:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBarbershop.business_name}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Propietario:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBarbershop.owner_name}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBarbershop.email}
                    </Text>
                  </View>

                  {selectedBarbershop.phone && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Teléfono:</Text>
                      <Text style={styles.detailValue}>
                        {selectedBarbershop.phone}
                      </Text>
                    </View>
                  )}

                  {selectedBarbershop.address && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Dirección:</Text>
                      <Text style={styles.detailValue}>
                        {selectedBarbershop.address}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Plan:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBarbershop.plan || 'Básico'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Barberos:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBarbershop.total_barbers || 0}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Citas totales:</Text>
                    <Text style={styles.detailValue}>
                      {selectedBarbershop.total_appointments || 0}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Estado:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: selectedBarbershop.is_suspended
                            ? '#e74c3c'
                            : '#27ae60',
                        },
                      ]}>
                      <Text style={styles.statusText}>
                        {selectedBarbershop.is_suspended ? 'Suspendida' : 'Activa'}
                      </Text>
                    </View>
                  </View>

                  {selectedBarbershop.created_at && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Registrado:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(
                          selectedBarbershop.created_at,
                        ).toLocaleDateString()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        selectedBarbershop.is_suspended
                          ? styles.activateButton
                          : styles.suspendButton,
                      ]}
                      onPress={() => toggleSuspension(selectedBarbershop)}>
                      <Text style={styles.actionButtonText}>
                        {selectedBarbershop.is_suspended ? 'Activar' : 'Suspender'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => deleteBarbershop(selectedBarbershop)}>
                      <Text style={styles.actionButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
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
  countBadge: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  barbershopCard: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  barbershopInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  ownerName: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  email: {
    fontSize: 14,
    color: '#3498db',
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
  address: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 8,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  activateButton: {
    backgroundColor: '#27ae60',
  },
  suspendButton: {
    backgroundColor: '#f39c12',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#2c3e50',
    marginTop: 12,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default BarbershopsScreen;
