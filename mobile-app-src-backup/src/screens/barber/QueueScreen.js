import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity, Alert} from 'react-native';
import api from '../../services/api';
import socketService from '../../services/socket';
import {ENDPOINTS} from '../../config/api';
import {useAuth} from '../../contexts/AuthContext';

const QueueScreen = () => {
  const {user} = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();

    socketService.on('queue_updated', data => {
      if (data.barberId === user.id) {
        setQueue(data.queue);
      }
    });

    return () => socketService.off('queue_updated');
  }, []);

  const loadQueue = async () => {
    try {
      const response = await api.get(ENDPOINTS.BARBER_QUEUE);
      if (response.data.success) {
        setQueue(response.data.queue || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderQueueItem = ({item, index}) => (
    <View style={styles.item}>
      <View style={styles.position}>
        <Text style={styles.positionText}>{index + 1}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.client_name}</Text>
        <Text style={styles.service}>{item.service_name}</Text>
        <Text style={styles.time}>Llegada: {new Date(item.created_at).toLocaleTimeString()}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={queue}
        renderItem={renderQueueItem}
        keyExtractor={item => item.id.toString()}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay turnos en cola</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  item: {flexDirection: 'row', padding: 16, backgroundColor: '#fff', marginBottom: 1},
  position: {width: 50, height: 50, borderRadius: 25, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 12},
  positionText: {color: '#fff', fontSize: 20, fontWeight: 'bold'},
  info: {flex: 1, justifyContent: 'center'},
  name: {fontSize: 18, fontWeight: '600', color: '#333'},
  service: {fontSize: 14, color: '#666', marginTop: 4},
  time: {fontSize: 12, color: '#999', marginTop: 4},
  empty: {padding: 40, alignItems: 'center'},
  emptyText: {color: '#999', fontSize: 16},
});

export default QueueScreen;
