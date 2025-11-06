import React, {useEffect, useRef, Component} from 'react';
import {SafeAreaView, StatusBar, StyleSheet, ActivityIndicator, View, BackHandler, Alert, ToastAndroid, Text, TouchableOpacity} from 'react-native';
import {AuthProvider, useAuth} from './src/contexts/AuthContext';
import {NavigationProvider, useNavigation} from './src/contexts/NavigationContext';

// Error Boundary Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {hasError: false, error: null, errorInfo: null};
  }

  static getDerivedStateFromError(error) {
    return {hasError: true};
  }

  componentDidCatch(error, errorInfo) {
    console.error('=== ERROR BOUNDARY CAUGHT ERROR ===');
    console.error('Error:', error);
    console.error('Error Stack:', error?.stack);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo?.componentStack);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Error en la Aplicación</Text>
            <Text style={styles.errorMessage}>
              La aplicación encontró un error inesperado.
            </Text>
            <Text style={styles.errorDetails}>
              {this.state.error?.toString()}
            </Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => {
                this.setState({hasError: false, error: null, errorInfo: null});
              }}>
              <Text style={styles.errorButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

// Import screens
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';

// Admin screens
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import BarbershopsScreen from './src/screens/admin/BarbershopsScreen';
import BillingScreen from './src/screens/admin/BillingScreen';

// Barbershop screens
import BarbershopDashboardScreen from './src/screens/barbershop/BarbershopDashboardScreen';
import BarbersScreen from './src/screens/barbershop/BarbersScreen';
import SchedulesScreen from './src/screens/barbershop/SchedulesScreen';
import AppointmentsScreen from './src/screens/barbershop/AppointmentsScreen';
import WhatsAppScreen from './src/screens/barbershop/WhatsAppScreen';

// Barber screens
import BarberDashboardScreen from './src/screens/barber/BarberDashboardScreen';
import QueueScreen from './src/screens/barber/QueueScreen';
import BarberScheduleScreen from './src/screens/barber/BarberScheduleScreen';

// Common screens
import ProfileScreen from './src/screens/common/ProfileScreen';
import ReportsScreen from './src/screens/barbershop/ReportsScreen';

// Screen mapping
const SCREENS = {
  Login: LoginScreen,
  Register: RegisterScreen,

  // Admin
  AdminDashboard: AdminDashboardScreen,
  Barbershops: BarbershopsScreen,
  Billing: BillingScreen,

  // Barbershop
  BarbershopDashboard: BarbershopDashboardScreen,
  Barbers: BarbersScreen,
  Schedules: SchedulesScreen,
  Appointments: AppointmentsScreen,
  WhatsApp: WhatsAppScreen,
  Reports: ReportsScreen,

  // Barber
  BarberDashboard: BarberDashboardScreen,
  Queue: QueueScreen,
  BarberSchedule: BarberScheduleScreen,

  // Common
  Profile: ProfileScreen,
};

// Main Navigator Component
const AppNavigator = () => {
  const {isAuthenticated, loading, userType} = useAuth();
  const {currentScreen, navigate, goBack, replace, reset, params, canGoBack} = useNavigation();
  const backPressCount = useRef(0);
  const backPressTimer = useRef(null);

  // Navigate to appropriate dashboard after login
  useEffect(() => {
    console.log('=== APP NAVIGATION EFFECT ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('userType:', userType);
    console.log('currentScreen:', currentScreen);
    console.log('loading:', loading);

    if (isAuthenticated && userType) {
      console.log('User is authenticated with type:', userType);
      if (currentScreen === 'Login' || currentScreen === 'Register') {
        console.log('Navigating from', currentScreen, 'to dashboard');
        switch (userType) {
          case 'admin':
            console.log('Navigating to AdminDashboard');
            reset('AdminDashboard');
            break;
          case 'barbershop':
            console.log('Navigating to BarbershopDashboard');
            reset('BarbershopDashboard');
            break;
          case 'barber':
            console.log('Navigating to BarberDashboard');
            reset('BarberDashboard');
            break;
          default:
            console.log('Unknown userType:', userType);
        }
      } else {
        console.log('Already on screen:', currentScreen);
      }
    } else if (!isAuthenticated && !loading) {
      console.log('User not authenticated, loading:', loading);
      // Not authenticated, ensure we're on Login
      if (currentScreen !== 'Login' && currentScreen !== 'Register') {
        console.log('Resetting to Login from:', currentScreen);
        reset('Login');
      }
    }
  }, [isAuthenticated, userType, currentScreen]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Determine if we're on a dashboard screen (main screens)
      const dashboardScreens = ['AdminDashboard', 'BarbershopDashboard', 'BarberDashboard'];
      const isOnDashboard = dashboardScreens.includes(currentScreen);

      // If we can go back (not on dashboard), navigate back
      if (canGoBack && !isOnDashboard) {
        goBack();
        return true; // Prevent default behavior
      }

      // If on dashboard or can't go back, implement double-tap to exit
      if (isOnDashboard || !canGoBack) {
        backPressCount.current += 1;

        if (backPressCount.current === 1) {
          // First press - show toast
          ToastAndroid.show('Presiona de nuevo para salir', ToastAndroid.SHORT);

          // Reset counter after 2 seconds
          backPressTimer.current = setTimeout(() => {
            backPressCount.current = 0;
          }, 2000);

          return true; // Prevent exit
        } else if (backPressCount.current === 2) {
          // Second press within 2 seconds - show confirmation
          clearTimeout(backPressTimer.current);
          backPressCount.current = 0;

          Alert.alert(
            'Salir de la aplicación',
            '¿Estás seguro que deseas salir?',
            [
              {
                text: 'Cancelar',
                onPress: () => {},
                style: 'cancel',
              },
              {
                text: 'Salir',
                onPress: () => BackHandler.exitApp(),
                style: 'destructive',
              },
            ],
            {cancelable: true}
          );

          return true; // Prevent exit until user confirms
        }
      }

      return true; // Prevent default back behavior
    });

    // Cleanup
    return () => {
      backHandler.remove();
      if (backPressTimer.current) {
        clearTimeout(backPressTimer.current);
      }
    };
  }, [currentScreen, canGoBack, goBack]);

  // Show loading indicator while checking auth
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#2c3e50" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2c3e50" />
        </View>
      </SafeAreaView>
    );
  }

  // Get the current screen component
  let ScreenComponent = SCREENS[currentScreen];

  console.log('=== RENDERING SCREEN ===');
  console.log('currentScreen:', currentScreen);
  console.log('ScreenComponent found:', !!ScreenComponent);
  console.log('Available screens:', Object.keys(SCREENS));

  // Fallback si no se encuentra el componente
  if (!ScreenComponent) {
    console.error('SCREEN NOT FOUND:', currentScreen);
    ScreenComponent = () => (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorTitle}>Pantalla No Encontrada</Text>
        <Text style={styles.errorMessage}>
          La pantalla "{currentScreen}" no existe.
        </Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => reset('Login')}>
          <Text style={styles.errorButtonText}>Volver al Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Create navigation object compatible with React Navigation API
  const navigation = {
    navigate,
    goBack,
    replace,
    reset,
    canGoBack: () => canGoBack,
  };

  // Create route object
  const route = {
    params: params || {},
    name: currentScreen,
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#2c3e50" />
      <ErrorBoundary>
        <ScreenComponent navigation={navigation} route={route} />
      </ErrorBoundary>
    </SafeAreaView>
  );
};

// Root App Component
const App = () => {
  return (
    <AuthProvider>
      <NavigationProvider>
        <AppNavigator />
      </NavigationProvider>
    </AuthProvider>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f6fa',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorDetails: {
    fontSize: 12,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#fee',
    borderRadius: 8,
  },
  errorButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default App;
