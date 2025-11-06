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
  ScrollView,
} from 'react-native';
import api from '../../services/api';
import {ENDPOINTS} from '../../config/api';
import {useAuth} from '../../contexts/AuthContext';

const BillingScreen = () => {
  const {userType} = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const endpoint = userType === 'admin'
        ? ENDPOINTS.ADMIN_BILLING
        : '/api/barbershop/billing';

      console.log('=== CARGANDO FACTURAS ===');
      console.log('Endpoint:', endpoint);
      const response = await api.get(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      if (response.data.success) {
        setInvoices(response.data.invoices || []);
        console.log('Facturas cargadas correctamente');
      } else {
        console.log('Response no exitosa:', response.data);
        setInvoices([]);
      }
    } catch (error) {
      console.error('=== ERROR AL CARGAR FACTURAS ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      const errorMessage = error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'No se pudieron cargar las facturas. Verifica tu conexión.';

      Alert.alert('Error al Cargar Facturas', errorMessage);
      setInvoices([]); // Asegurar que se muestre la pantalla en lugar de loading
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInvoices();
  };

  const openDetailsModal = invoice => {
    setSelectedInvoice(invoice);
    setDetailsModalVisible(true);
  };

  const markAsPaid = async invoice => {
    Alert.alert(
      'Marcar como Pagado',
      `¿Confirmar pago de factura #${invoice.invoice_number}?`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const response = await api.put(
                `${ENDPOINTS.ADMIN_BILLING}/${invoice.id}/pay`,
              );
              if (response.data.success) {
                Alert.alert('Éxito', 'Factura marcada como pagada');
                loadInvoices();
                setDetailsModalVisible(false);
              }
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'No se pudo actualizar la factura');
            }
          },
        },
      ],
    );
  };

  const getStatusColor = status => {
    const colors = {
      pending: '#f39c12',
      paid: '#27ae60',
      overdue: '#e74c3c',
      cancelled: '#95a5a6',
    };
    return colors[status] || '#95a5a6';
  };

  const getStatusText = status => {
    const texts = {
      pending: 'Pendiente',
      paid: 'Pagado',
      overdue: 'Vencido',
      cancelled: 'Cancelado',
    };
    return texts[status] || status;
  };

  const getFilteredInvoices = () => {
    if (filterStatus === 'all') return invoices;
    return invoices.filter(inv => inv.status === filterStatus);
  };

  const renderInvoiceItem = ({item}) => (
    <TouchableOpacity
      style={styles.invoiceCard}
      onPress={() => openDetailsModal(item)}>
      <View style={styles.invoiceHeader}>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceNumber}>#{item.invoice_number}</Text>
          <Text style={styles.barbershopName}>
            {item.barbershop_name || 'N/A'}
          </Text>
          <Text style={styles.invoiceDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.invoiceRight}>
          <Text style={styles.invoiceAmount}>${parseFloat(item.amount).toFixed(2)}</Text>
          <View
            style={[
              styles.statusBadge,
              {backgroundColor: getStatusColor(item.status)},
            ]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
      </View>

      {item.due_date && (
        <Text style={styles.dueDate}>
          Vencimiento: {new Date(item.due_date).toLocaleDateString()}
        </Text>
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

  const filteredInvoices = getFilteredInvoices();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Facturación</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{invoices.length}</Text>
        </View>
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
              filterStatus === 'paid' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus('paid')}>
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === 'paid' && styles.filterButtonTextActive,
              ]}>
              Pagadas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStatus === 'overdue' && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus('overdue')}>
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === 'overdue' && styles.filterButtonTextActive,
              ]}>
              Vencidas
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredInvoices}
        renderItem={renderInvoiceItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay facturas para mostrar</Text>
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
              <Text style={styles.modalTitle}>Detalles de Factura</Text>

              {selectedInvoice && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Número:</Text>
                    <Text style={styles.detailValue}>
                      #{selectedInvoice.invoice_number}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Barbería:</Text>
                    <Text style={styles.detailValue}>
                      {selectedInvoice.barbershop_name || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Monto:</Text>
                    <Text style={styles.detailValue}>
                      ${parseFloat(selectedInvoice.amount).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Plan:</Text>
                    <Text style={styles.detailValue}>
                      {selectedInvoice.plan || 'Básico'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Estado:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusColor(selectedInvoice.status),
                        },
                      ]}>
                      <Text style={styles.statusText}>
                        {getStatusText(selectedInvoice.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fecha emisión:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedInvoice.created_at).toLocaleDateString()}
                    </Text>
                  </View>

                  {selectedInvoice.due_date && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Vencimiento:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedInvoice.due_date).toLocaleDateString()}
                      </Text>
                    </View>
                  )}

                  {selectedInvoice.paid_at && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Fecha de pago:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedInvoice.paid_at).toLocaleDateString()}
                      </Text>
                    </View>
                  )}

                  {selectedInvoice.description && (
                    <View style={styles.descriptionRow}>
                      <Text style={styles.detailLabel}>Descripción:</Text>
                      <Text style={styles.descriptionText}>
                        {selectedInvoice.description}
                      </Text>
                    </View>
                  )}

                  {userType === 'admin' && selectedInvoice.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.payButton]}
                      onPress={() => markAsPaid(selectedInvoice)}>
                      <Text style={styles.actionButtonText}>Marcar como Pagado</Text>
                    </TouchableOpacity>
                  )}
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
  invoiceCard: {
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
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  barbershopName: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  invoiceDate: {
    fontSize: 12,
    color: '#95a5a6',
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dueDate: {
    fontSize: 12,
    color: '#e67e22',
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
    textAlign: 'right',
  },
  descriptionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  descriptionText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 8,
    lineHeight: 20,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  payButton: {
    backgroundColor: '#27ae60',
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
    marginTop: 20,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default BillingScreen;
