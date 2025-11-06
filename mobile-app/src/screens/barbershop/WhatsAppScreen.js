import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import api from '../../services/api';
import {ENDPOINTS} from '../../config/api';
import socketService from '../../services/socket';
import {useAuth} from '../../contexts/AuthContext';

const WhatsAppScreen = () => {
  const {user} = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  useEffect(() => {
    loadWhatsAppStatus();
    setupSocketListeners();

    return () => {
      socketService.off('whatsapp_qr');
      socketService.off('whatsapp_connected');
      socketService.off('whatsapp_disconnected');
    };
  }, []);

  const setupSocketListeners = () => {
    socketService.on('whatsapp_qr', data => {
      console.log('QR Code received');
      setQrCode(data.qr);
      setIsGeneratingQR(false);
    });

    socketService.on('whatsapp_connected', () => {
      console.log('WhatsApp connected');
      setIsConnected(true);
      setQrCode(null);
      loadWhatsAppStatus();
      Alert.alert('Éxito', 'WhatsApp conectado correctamente');
    });

    socketService.on('whatsapp_disconnected', () => {
      console.log('WhatsApp disconnected');
      setIsConnected(false);
      setQrCode(null);
      Alert.alert('Desconectado', 'WhatsApp se ha desconectado');
    });
  };

  const loadWhatsAppStatus = async () => {
    if (!user?.id) {
      console.error('No user ID available');
      setLoading(false);
      return;
    }

    try {
      const barbershopId = user.id;
      const endpoint = ENDPOINTS.WHATSAPP_STATUS(barbershopId);

      console.log('=== CARGANDO ESTADO DE WHATSAPP ===');
      console.log('Barbershop ID:', barbershopId);
      console.log('Endpoint:', endpoint);

      const response = await api.get(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // Backend devuelve: {status: 'connected|waiting_qr|disconnected', phone?: string, qr_code?: string}
      if (response.data.status === 'connected') {
        setIsConnected(true);
        setQrCode(null);
        setSessionInfo({
          phone: response.data.phone || 'Desconocido',
          name: response.data.name || '',
          platform: response.data.platform || 'WhatsApp Web'
        });
        console.log('WhatsApp conectado:', response.data.phone);
      } else if (response.data.status === 'waiting_qr') {
        setIsConnected(false);
        setQrCode(response.data.qr_code || null);
        setSessionInfo(null);
        console.log('Esperando escaneo de QR');
      } else {
        // disconnected
        setIsConnected(false);
        setQrCode(null);
        setSessionInfo(null);
        console.log('WhatsApp desconectado');
      }
    } catch (error) {
      console.error('=== ERROR AL CARGAR ESTADO DE WHATSAPP ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      // No mostramos alert aquí porque puede ser que WhatsApp no esté configurado aún
      setIsConnected(false);
      setSessionInfo(null);
      setQrCode(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsGeneratingQR(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWhatsAppStatus();
  };

  const generateQRCode = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    setIsGeneratingQR(true);
    setQrCode(null);

    try {
      const barbershopId = user.id;
      const endpoint = ENDPOINTS.WHATSAPP_INIT(barbershopId);

      console.log('=== GENERANDO QR DE WHATSAPP ===');
      console.log('Barbershop ID:', barbershopId);
      console.log('Endpoint:', endpoint);

      const response = await api.post(endpoint);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // Backend devuelve: {status: 'qr_available', qr_code: qrCode} o {status: 'already_connected', phone: phone}
      if (response.data.status === 'qr_available') {
        if (response.data.qr_code) {
          setQrCode(response.data.qr_code);
          setIsGeneratingQR(false);
          console.log('QR generado correctamente');
        } else {
          // Si no hay QR en la respuesta, puede llegar por socket
          console.log('Esperando QR por socket...');
        }
      } else if (response.data.status === 'already_connected') {
        Alert.alert('Ya Conectado', `WhatsApp ya está conectado con el número ${response.data.phone}`);
        setIsConnected(true);
        setIsGeneratingQR(false);
        loadWhatsAppStatus();
      } else {
        Alert.alert('Error', response.data.message || 'No se pudo generar el código QR');
        setIsGeneratingQR(false);
      }
    } catch (error) {
      console.error('=== ERROR AL GENERAR QR ===');
      console.error('Error completo:', error);
      console.error('Error response:', error.response?.data);

      const errorMessage = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'No se pudo generar el código QR';

      Alert.alert('Error', errorMessage);
      setIsGeneratingQR(false);
    }
  };

  const disconnectWhatsApp = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    Alert.alert(
      'Confirmar Desconexión',
      '¿Estás seguro que deseas desconectar WhatsApp? Tendrás que escanear el QR nuevamente.',
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              const barbershopId = user.id;
              const endpoint = ENDPOINTS.WHATSAPP_DISCONNECT(barbershopId);

              console.log('=== DESCONECTANDO WHATSAPP ===');
              console.log('Barbershop ID:', barbershopId);
              console.log('Endpoint:', endpoint);

              const response = await api.post(endpoint);
              console.log('Response status:', response.status);
              console.log('Response data:', response.data);

              // Backend devuelve: {status: 'disconnected', message: '...'}
              if (response.data.status === 'disconnected') {
                setIsConnected(false);
                setQrCode(null);
                setSessionInfo(null);
                Alert.alert('Éxito', 'WhatsApp desconectado correctamente');
                console.log('WhatsApp desconectado correctamente');
              } else {
                Alert.alert('Error', response.data.message || 'No se pudo desconectar WhatsApp');
              }
            } catch (error) {
              console.error('=== ERROR AL DESCONECTAR WHATSAPP ===');
              console.error('Error completo:', error);
              console.error('Error response:', error.response?.data);

              const errorMessage = error.response?.data?.error
                || error.response?.data?.message
                || error.message
                || 'No se pudo desconectar WhatsApp';

              Alert.alert('Error', errorMessage);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#25D366" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Integración WhatsApp</Text>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: isConnected ? '#25D366' : '#95a5a6'},
          ]}>
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>
      </View>

      {isConnected ? (
        <View style={styles.connectedContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>

          <Text style={styles.connectedTitle}>WhatsApp Conectado</Text>
          <Text style={styles.connectedMessage}>
            Tu cuenta de WhatsApp está activa y lista para enviar mensajes
            automáticos a tus clientes.
          </Text>

          {sessionInfo && (
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionTitle}>Información de la Sesión</Text>
              {sessionInfo.name && (
                <View style={styles.sessionRow}>
                  <Text style={styles.sessionLabel}>Nombre:</Text>
                  <Text style={styles.sessionValue}>{sessionInfo.name}</Text>
                </View>
              )}
              {sessionInfo.phone && (
                <View style={styles.sessionRow}>
                  <Text style={styles.sessionLabel}>Teléfono:</Text>
                  <Text style={styles.sessionValue}>{sessionInfo.phone}</Text>
                </View>
              )}
              {sessionInfo.platform && (
                <View style={styles.sessionRow}>
                  <Text style={styles.sessionLabel}>Plataforma:</Text>
                  <Text style={styles.sessionValue}>{sessionInfo.platform}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.disconnectButton]}
              onPress={disconnectWhatsApp}>
              <Text style={styles.actionButtonText}>Desconectar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Funcionalidades Activas:</Text>
            <Text style={styles.infoItem}>✓ Confirmación automática de citas</Text>
            <Text style={styles.infoItem}>✓ Recordatorios de citas</Text>
            <Text style={styles.infoItem}>✓ Notificaciones de cancelación</Text>
            <Text style={styles.infoItem}>✓ Mensajes personalizados</Text>
          </View>
        </View>
      ) : (
        <View style={styles.disconnectedContainer}>
          <Text style={styles.disconnectedTitle}>WhatsApp No Conectado</Text>
          <Text style={styles.disconnectedMessage}>
            Conecta tu cuenta de WhatsApp para enviar mensajes automáticos a tus
            clientes sobre sus citas.
          </Text>

          {qrCode ? (
            <View style={styles.qrContainer}>
              <Text style={styles.qrTitle}>Escanea este código QR</Text>
              <Text style={styles.qrInstructions}>
                1. Abre WhatsApp en tu teléfono{'\n'}
                2. Ve a Configuración → Dispositivos Vinculados{'\n'}
                3. Toca "Vincular un dispositivo"{'\n'}
                4. Escanea este código QR
              </Text>

              <View style={styles.qrImageContainer}>
                <Image
                  source={{uri: qrCode}}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>

              <TouchableOpacity
                style={[styles.actionButton, styles.generateButton]}
                onPress={generateQRCode}>
                <Text style={styles.actionButtonText}>Generar Nuevo QR</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.generateQRContainer}>
              {isGeneratingQR ? (
                <>
                  <ActivityIndicator size="large" color="#25D366" />
                  <Text style={styles.generatingText}>
                    Generando código QR...{'\n'}Por favor espera
                  </Text>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.generateButton]}
                    onPress={generateQRCode}>
                    <Text style={styles.actionButtonText}>Generar Código QR</Text>
                  </TouchableOpacity>

                  <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>Beneficios de WhatsApp:</Text>
                    <Text style={styles.infoItem}>
                      • Confirmación automática de citas
                    </Text>
                    <Text style={styles.infoItem}>
                      • Recordatorios antes de la cita
                    </Text>
                    <Text style={styles.infoItem}>• Mayor asistencia de clientes</Text>
                    <Text style={styles.infoItem}>
                      • Mejor comunicación con tus clientes
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.helpBox}>
        <Text style={styles.helpTitle}>¿Necesitas ayuda?</Text>
        <Text style={styles.helpText}>
          Si tienes problemas para conectar WhatsApp, intenta reiniciar la sesión
          o generar un nuevo código QR.
        </Text>
      </View>
    </ScrollView>
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  connectedContainer: {
    padding: 20,
    alignItems: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIconText: {
    fontSize: 48,
    color: '#fff',
    fontWeight: 'bold',
  },
  connectedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  connectedMessage: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  sessionInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  sessionLabel: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  sessionValue: {
    fontSize: 16,
    color: '#2c3e50',
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  restartButton: {
    backgroundColor: '#f39c12',
  },
  disconnectButton: {
    backgroundColor: '#e74c3c',
  },
  generateButton: {
    backgroundColor: '#25D366',
    marginTop: 20,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disconnectedContainer: {
    padding: 20,
  },
  disconnectedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  disconnectedMessage: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  qrContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    lineHeight: 22,
  },
  qrImageContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#25D366',
    marginBottom: 20,
  },
  qrImage: {
    width: 250,
    height: 250,
  },
  generateQRContainer: {
    alignItems: 'center',
    padding: 20,
  },
  generatingText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  infoItem: {
    fontSize: 14,
    color: '#27ae60',
    marginBottom: 8,
    lineHeight: 20,
  },
  helpBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    margin: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});

export default WhatsAppScreen;
