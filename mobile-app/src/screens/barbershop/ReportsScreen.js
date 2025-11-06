import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import api from '../../services/api';

const ReportsScreen = () => {
  const [period, setPeriod] = useState('today');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const getSafeContext = () => {
    try {
      const {useAuth} = require('../../contexts/AuthContext');
      const {useNavigation} = require('../../contexts/NavigationContext');

      const auth = useAuth();
      const nav = useNavigation();

      return {
        user: auth?.user,
        goBack: nav?.goBack || (() => console.log('GoBack')),
      };
    } catch (error) {
      return {
        user: null,
        goBack: () => console.log('GoBack'),
      };
    }
  };

  const {user, goBack} = getSafeContext();

  useEffect(() => {
    loadReport();
  }, [period]);

  const getDateRange = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    switch (period) {
      case 'today':
        return {startDate: today, endDate: today};
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return {
          startDate: weekAgo.toISOString().split('T')[0],
          endDate: today,
        };
      }
      case 'month': {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return {
          startDate: monthAgo.toISOString().split('T')[0],
          endDate: today,
        };
      }
      default:
        return {startDate: today, endDate: today};
    }
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      const {startDate, endDate} = getDateRange();

      const response = await api.get(
        `/api/revenue/barbershop/${user?.barbershop_id}`,
        {
          params: {
            startDate,
            endDate,
          },
        },
      );

      setReport(response.data);
    } catch (error) {
      console.error('Error loading report:', error);
      Alert.alert('Error', 'No se pudo cargar el reporte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reportes Financieros</Text>
        <View style={{width: 40}} />
      </View>

      {/* Period Selector */}
      <View style={styles.periodContainer}>
        <TouchableOpacity
          style={[
            styles.periodButton,
            period === 'today' && styles.periodButtonActive,
          ]}
          onPress={() => setPeriod('today')}>
          <Text
            style={[
              styles.periodText,
              period === 'today' && styles.periodTextActive,
            ]}>
            Hoy
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.periodButton,
            period === 'week' && styles.periodButtonActive,
          ]}
          onPress={() => setPeriod('week')}>
          <Text
            style={[
              styles.periodText,
              period === 'week' && styles.periodTextActive,
            ]}>
            Última Semana
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.periodButton,
            period === 'month' && styles.periodButtonActive,
          ]}
          onPress={() => setPeriod('month')}>
          <Text
            style={[
              styles.periodText,
              period === 'month' && styles.periodTextActive,
            ]}>
            Último Mes
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Cargando reporte...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Total Revenue Card */}
          <View style={[styles.card, {backgroundColor: '#27ae60'}]}>
            <Text style={styles.cardTitle}>Ingresos Totales</Text>
            <Text style={styles.cardValue}>
              ${report?.totalRevenue || 0}
            </Text>
            <Text style={styles.cardSubtitle}>
              {report?.totalServices || 0} servicios
            </Text>
          </View>

          {/* Barber Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Por Barbero</Text>
            {report?.barbers?.length > 0 ? (
              report.barbers.map((barber, index) => (
                <View key={index} style={styles.barberCard}>
                  <View style={styles.barberInfo}>
                    <Text style={styles.barberName}>{barber.barber_name}</Text>
                    <Text style={styles.barberServices}>
                      {barber.total_services} servicios
                    </Text>
                  </View>
                  <View style={styles.barberRevenue}>
                    <Text style={styles.revenueAmount}>
                      ${barber.total_revenue}
                    </Text>
                    <View style={styles.commissionContainer}>
                      <View style={styles.commissionItem}>
                        <Text style={styles.commissionLabel}>Barbero</Text>
                        <Text style={styles.commissionValue}>
                          ${barber.barber_commission}
                        </Text>
                      </View>
                      <View style={styles.commissionItem}>
                        <Text style={styles.commissionLabel}>Barbería</Text>
                        <Text style={styles.commissionValue}>
                          ${barber.barbershop_commission}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No hay datos para este período</Text>
            )}
          </View>

          {/* Summary Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>💵</Text>
              <Text style={styles.statValue}>
                ${report?.barbershopTotal || 0}
              </Text>
              <Text style={styles.statLabel}>Para Barbería</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>👨‍💼</Text>
              <Text style={styles.statValue}>
                ${report?.barbersTotal || 0}
              </Text>
              <Text style={styles.statLabel}>Para Barberos</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>💰</Text>
              <Text style={styles.statValue}>
                ${report?.averageService || 0}
              </Text>
              <Text style={styles.statLabel}>Servicio Promedio</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>📊</Text>
              <Text style={styles.statValue}>{report?.totalServices || 0}</Text>
              <Text style={styles.statLabel}>Servicios Totales</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#2c3e50',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  periodContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ecf0f1',
    marginHorizontal: 4,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#3498db',
  },
  periodText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  periodTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  content: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  barberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  barberInfo: {
    marginBottom: 12,
  },
  barberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  barberServices: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  barberRevenue: {
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    paddingTop: 12,
  },
  revenueAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 8,
  },
  commissionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  commissionItem: {
    flex: 1,
  },
  commissionLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  commissionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: '1%',
    marginRight: '1%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    paddingVertical: 40,
  },
});

export default ReportsScreen;
